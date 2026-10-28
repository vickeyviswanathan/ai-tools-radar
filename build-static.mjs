// Builds static data/tools.json for GitHub Pages deployment
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { getDb, now, getMeta } from "./src/db.mjs";
import { runIngestion } from "./src/ingest.mjs";
import { refreshLiveMetrics } from "./src/live-metrics.mjs";

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
    "Image & Design",
    "Video",
    "Audio & Voice",
    "Chat & Assistants",
    "Productivity",
    "Research & Data",
    "Models & Infra"
  ];

  const tools = [];

  for (const cat of categories) {
    const rows = db.prepare(`
      SELECT i.id, i.name, i.tagline, i.url, i.emoji, i.category, i.why_it_matters, i.launched_at, i.score,
             GROUP_CONCAT(s.source || ':' || s.metric, ',') as signal_summary
      FROM items i
      LEFT JOIN signals s ON s.item_id = i.id
      WHERE i.status = 'active' AND i.category = ?
      GROUP BY i.id
      ORDER BY i.score DESC, i.launched_at DESC
      LIMIT 25
    `).all(cat);

    tools.push(...rows.map(r => ({
      ...r,
      signals: (r.signal_summary || "").split(",").filter(Boolean)
    })));
  }

  const output = {
    updatedAt: new Date().toISOString(),
    categories,
    tools
  };

  mkdirSync("./public/data", { recursive: true });
  writeFileSync("./public/data/tools.json", JSON.stringify(output, null, 2), "utf-8");
  console.log(`Generated public/data/tools.json with ${tools.length} curated tools across ${categories.length} categories.`);
}

build().catch(console.error);
