// Live Metrics Refresher — Queries GitHub and Hugging Face APIs for exact live stars & likes
import { config, userAgent } from "./config.mjs";
import { getDb, tx, now } from "./db.mjs";

function extractGitHubRepo(url) {
  if (!url) return null;
  const match = url.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/i);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2].replace(/\.git$/, "").replace(/#.*$/, "");
  if (["topics", "explore", "trending", "features", "marketplace"].includes(owner.toLowerCase())) return null;
  return `${owner}/${repo}`;
}

function extractHuggingFaceSpaceOrModel(url) {
  if (!url) return null;
  const spaceMatch = url.match(/huggingface\.co\/spaces\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/i);
  if (spaceMatch) return { type: "space", slug: spaceMatch[1] };
  const modelMatch = url.match(/huggingface\.co\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/i);
  if (modelMatch && !modelMatch[1].startsWith("docs/") && !modelMatch[1].startsWith("blog/")) {
    return { type: "model", slug: modelMatch[1] };
  }
  return null;
}

export async function refreshLiveMetrics() {
  console.log(`[LiveMetrics] Refreshing exact stars and likes from official APIs...`);
  const db = getDb();
  const token = process.env.GITHUB_TOKEN || config.githubToken || "";
  const ghHeaders = {
    "User-Agent": userAgent(),
    Accept: "application/vnd.github.v3+json",
    ...(token ? { Authorization: `token ${token}` } : {})
  };

  const rows = db.prepare(`SELECT id, url, name FROM items WHERE status = 'active'`).all();
  const currentTs = now();
  const updates = [];

  // 1. Process GitHub Repositories
  const ghItems = [];
  for (const row of rows) {
    const repo = extractGitHubRepo(row.url);
    if (repo) ghItems.push({ rowId: row.id, name: row.name, repo });
  }

  const BATCH_SIZE = 8;
  for (let i = 0; i < ghItems.length; i += BATCH_SIZE) {
    const chunk = ghItems.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(chunk.map(async (item) => {
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 7000);
        const res = await fetch(`https://api.github.com/repos/${item.repo}`, {
          headers: ghHeaders,
          signal: ctrl.signal
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          const stars = Number(data.stargazers_count);
          if (!isNaN(stars)) {
            updates.push({
              itemId: item.rowId,
              source: "github",
              sourceId: item.repo,
              sourceUrl: `https://github.com/${item.repo}`,
              metric: stars,
              extra: JSON.stringify({ stars, forks: data.forks_count })
            });
          }
        }
      } catch (err) {
        // network or abort
      }
    }));
  }

  // 2. Process Hugging Face Spaces & Models
  const hfItems = [];
  for (const row of rows) {
    const hf = extractHuggingFaceSpaceOrModel(row.url);
    if (hf) hfItems.push({ rowId: row.id, name: row.name, slug: hf.slug, type: hf.type });
  }

  for (let i = 0; i < hfItems.length; i += BATCH_SIZE) {
    const chunk = hfItems.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(chunk.map(async (item) => {
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 7000);
        const endpoint = item.type === "space"
          ? `https://huggingface.co/api/spaces/${item.slug}`
          : `https://huggingface.co/api/models/${item.slug}`;

        const res = await fetch(endpoint, {
          headers: { "User-Agent": userAgent() },
          signal: ctrl.signal
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          const likes = Number(data.likes);
          if (!isNaN(likes)) {
            updates.push({
              itemId: item.rowId,
              source: "huggingface",
              sourceId: item.slug,
              sourceUrl: `https://huggingface.co/${item.type === "space" ? "spaces/" : ""}${item.slug}`,
              metric: likes,
              extra: JSON.stringify({ likes })
            });
          }
        }
      } catch (err) {
        // network or abort
      }
    }));
  }

  // 3. Apply all updates cleanly in a single synchronous SQLite transaction
  tx((d) => {
    const upsertSignal = d.prepare(`
      INSERT INTO signals (item_id, source, source_id, source_url, metric, extra, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(item_id, source) DO UPDATE SET
        metric = excluded.metric,
        extra = excluded.extra,
        updated_at = excluded.updated_at
    `);

    for (const u of updates) {
      upsertSignal.run(
        u.itemId,
        u.source,
        u.sourceId,
        u.sourceUrl,
        u.metric,
        u.extra,
        currentTs
      );
    }

    // Recompute item score based on updated live signals
    d.prepare(`
      UPDATE items
      SET score = (
        SELECT COALESCE(
          (SUM(s.metric) * 10.0) /
          POWER(MAX(1.0, (? - items.launched_at) / 3600.0 + 2.0), 1.2),
          0.0
        )
        FROM signals s
        WHERE s.item_id = items.id
      )
      WHERE status = 'active'
    `).run(currentTs);
  });

  const ghCount = updates.filter(u => u.source === "github").length;
  const hfCount = updates.filter(u => u.source === "huggingface").length;
  console.log(`[LiveMetrics] Successfully refreshed live metrics: ${ghCount} GitHub repos and ${hfCount} Hugging Face tools updated with exact live numbers.`);
}
