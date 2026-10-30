// Builds static data/tools.json for GitHub Pages deployment
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { getDb, now, getMeta } from "./src/db.mjs";
import { runIngestion } from "./src/ingest.mjs";
import { evaluateQuality } from "./src/quality.mjs";
import { refreshLiveMetrics } from "./src/live-metrics.mjs";
import { publishSeoArtifacts, normalizeWhyItMatters } from "./src/seo-publish.mjs";
import { getLiveCyberNews } from "./src/news-sync.mjs";

async function build() {
  console.log("Ingesting latest top-tier tools...");
  await runIngestion();

  console.log("Refreshing live stars and likes via GitHub & HuggingFace APIs...");
  await refreshLiveMetrics();

  const db = getDb();
  
  // Select top 12 curated tools per category
  const categories = [
    "Coding",
    "Agents & Automation",
    "Cybersecurity",
    "Image & Design",
    "Video",
    "Audio & Voice",
    "Chat & Assistants",
    "Productivity",
    "Research & Data",
    "Models & Infra"
  ];

  const tools = [];

  // Ranking = the real popularity number shown on the card: GitHub stars or Hugging Face likes.
  // Tools with neither (closed-source products) fall back to their seeded popularity estimate.
  const rankOf = (signals) => {
    const nums = (src) => signals.filter(s => s.startsWith(src + ":")).map(s => Number(s.split(":")[1]) || 0);
    const real = [...nums("github"), ...nums("huggingface")];
    if (real.length) return Math.max(...real);
    return Math.max(0, ...nums("app"), ...nums("hn"));
  };

  // The same project can be stored twice (once by its GitHub repo, once by its homepage, e.g.
  // github.com/ollama/ollama and ollama.com). Merge them into one card, keyed by the GitHub repo.
  const repoOf = new Map(
    db.prepare(`SELECT item_id, source_id FROM signals WHERE source = 'github'`).all()
      .map(r => [r.item_id, String(r.source_id).toLowerCase()])
  );
  const normName = (n) => String(n).toLowerCase().replace(/[^a-z0-9]/g, "");
  const rejectedAtBuild = [];
  const preference = (t) => (t.emoji ? 4 : 0) + (/github\.com/i.test(t.url) ? 2 : 0) + (t.why_it_matters ? 1 : 0);

  const all = db.prepare(`
    SELECT i.id, i.name, i.tagline, i.url, i.emoji, i.category, i.why_it_matters, i.launched_at, i.score,
           GROUP_CONCAT(s.source || ':' || s.metric, ',') as signal_summary
    FROM items i
    LEFT JOIN signals s ON s.item_id = i.id
    WHERE i.status = 'active'
    GROUP BY i.id
  `).all().map(r => {
    const signals = (r.signal_summary || "").split(",").filter(Boolean);
    return { ...r, signals, rank: rankOf(signals), repo: repoOf.get(r.id) || null };
  }).filter(t => {
    // Hand-picked tools (seeded with an "app" signal) are always kept. Everything the scrapers
    // found must pass the quality gate today, which also cleans out rows stored under older, looser rules.
    if (t.signals.some(s => s.startsWith("app:"))) return true;
    const source = t.signals.some(s => s.startsWith("github:")) ? "github"
      : t.signals.some(s => s.startsWith("huggingface:")) ? "huggingface" : "hn";
    const verdict = evaluateQuality({ name: t.name, tagline: t.tagline, url: t.url, tags: [], source, metric: t.rank });
    if (!verdict.pass) rejectedAtBuild.push(`${t.name} (${verdict.reason})`);
    else t.tagline = verdict.cleanTagline; // English-only description
    return verdict.pass;
  });

  const winners = new Map();
  for (const t of all) {
    const key = t.repo ? `repo:${t.repo}` : `name:${normName(t.name)}`;
    const cur = winners.get(key);
    if (!cur || preference(t) > preference(cur) || (preference(t) === preference(cur) && t.rank > cur.rank)) {
      winners.set(key, cur ? { ...t, rank: Math.max(t.rank, cur.rank) } : t);
    } else {
      cur.rank = Math.max(cur.rank, t.rank);
    }
  }
  // Second pass: same name but different keys (e.g. a repo and its non-GitHub homepage entry)
  const byName = new Map();
  for (const t of winners.values()) {
    const k = normName(t.name);
    const cur = byName.get(k);
    if (!cur || preference(t) > preference(cur)) byName.set(k, cur ? { ...t, rank: Math.max(t.rank, cur.rank) } : t);
    else cur.rank = Math.max(cur.rank, t.rank);
  }
  const deduped = [...byName.values()];

  for (const cat of categories) {
    const ranked = deduped
      .filter(t => t.category === cat)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 25)
      .map(({ repo, signal_summary, ...rest }) => rest);

    tools.push(...ranked);
  }

  const output = {
    updatedAt: new Date().toISOString(),
    categories,
    tools: normalizeWhyItMatters(tools)
  };

  mkdirSync("./public/data", { recursive: true });
  writeFileSync("./public/data/tools.json", JSON.stringify(output, null, 2), "utf-8");
  
  const { categories: threatCategories, threats: liveThreats } = await getLiveCyberNews();
  const threatOutput = {
    updatedAt: output.updatedAt,
    categories: threatCategories,
    threats: liveThreats
  };
  writeFileSync("./public/data/threats.json", JSON.stringify(threatOutput, null, 2), "utf-8");

  publishSeoArtifacts(tools, output.updatedAt);
  console.log(`[Gate] Dropped ${rejectedAtBuild.length} stored entries at build time:\n  ` + rejectedAtBuild.join("\n  "));
  console.log(`Generated public/data/tools.json with ${tools.length} curated tools across ${categories.length} categories.`);
  console.log(`Generated public/data/threats.json with ${liveThreats.length} verified threat intelligence records.`);
}

build().catch(console.error);
