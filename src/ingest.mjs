// Ingestion engine with High-Bar Editorial Quality Filters
import { getDb, tx, now, setMeta } from "./db.mjs";
import { canonicalKey, categorize, clip } from "./classify.mjs";
import { fetchHackerNews, fetchGitHub, fetchHuggingFace } from "./sources.mjs";
import { evaluateQuality } from "./quality.mjs";

export async function runIngestion() {
  console.log(`[Ingest] Starting sync across open sources...`);
  const startTime = Date.now();
  const db = getDb();

  // Run source collectors concurrently
  const [hnResults, ghResults, hfResults] = await Promise.allSettled([
    fetchHackerNews(),
    fetchGitHub(),
    fetchHuggingFace(),
  ]);

  const rawItems = [
    ...(hnResults.status === "fulfilled" ? hnResults.value : []),
    ...(ghResults.status === "fulfilled" ? ghResults.value : []),
    ...(hfResults.status === "fulfilled" ? hfResults.value : []),
  ];

  console.log(`[Ingest] Collected ${rawItems.length} raw candidates. Filtering against Thought-Leader Quality Gate...`);

  const currentTs = now();
  let passedCount = 0;
  let rejectedCount = 0;

  tx((d) => {
    // Add editorial column if not exists
    try {
      d.exec(`ALTER TABLE items ADD COLUMN why_it_matters TEXT;`);
    } catch {}

    const upsertItem = d.prepare(`
      INSERT INTO items (key, name, tagline, url, emoji, category, tags, why_it_matters, launched_at, first_seen, last_seen, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      ON CONFLICT(key) DO UPDATE SET
        last_seen = excluded.last_seen,
        tagline = COALESCE(items.tagline, excluded.tagline),
        emoji = COALESCE(items.emoji, excluded.emoji),
        category = COALESCE(items.category, excluded.category),
        tags = COALESCE(items.tags, excluded.tags),
        why_it_matters = COALESCE(items.why_it_matters, excluded.why_it_matters)
      RETURNING id
    `);

    const upsertSignal = d.prepare(`
      INSERT INTO signals (item_id, source, source_id, source_url, metric, extra, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(item_id, source) DO UPDATE SET
        metric = excluded.metric,
        extra = excluded.extra,
        updated_at = excluded.updated_at
    `);

    for (const item of rawItems) {
      // Apply strict quality gate
      const qCheck = evaluateQuality(item);
      if (!qCheck.pass) {
        rejectedCount++;
        continue;
      }
      passedCount++;

      const key = canonicalKey(item.url);
      const category = categorize(`${item.name} ${item.tagline || ""} ${(item.tags || []).join(" ")}`);
      const tagsJson = JSON.stringify(item.tags || []);

      const row = upsertItem.get(
        key,
        clip(item.name, 60),
        clip(item.tagline, 200),
        item.url,
        item.emoji || null,
        category,
        tagsJson,
        qCheck.whyItMatters,
        item.launchedAt || currentTs,
        currentTs,
        currentTs
      );

      if (row && row.id) {
        upsertSignal.run(
          row.id,
          item.source,
          item.sourceId,
          item.sourceUrl,
          item.metric,
          JSON.stringify(item.extra || {}),
          currentTs
        );
      }
    }

    // Momentum decay score
    const computeScore = d.prepare(`
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
    `);
    computeScore.run(currentTs);
  });

  setMeta("last_ingest_at", currentTs);
  console.log(`[Ingest] Finished: ${passedCount} passed quality gate (${rejectedCount} rejected as noise) in ${((Date.now() - startTime) / 1000).toFixed(1)}s.`);
}
