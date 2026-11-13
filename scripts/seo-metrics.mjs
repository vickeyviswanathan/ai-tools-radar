// SEO metrics snapshot for key pages: title, meta description, canonical, H1s, internal /tools/ link count,
// HTML size and <img> count. Usage: node scripts/seo-metrics.mjs [outFile.json]
// Reads built HTML from ./public. Pure static HTML analysis (no JavaScript execution), which is what a
// non-rendering crawler sees. Not a substitute for field data.
import { readFileSync, existsSync, writeFileSync } from "node:fs";

const PAGES = [
  "index.html",
  "ai-tools.html",
  "ai-realities.html",
  "cybersecurity-news.html",
  "scam-alerts.html",
  "newsletter/today.html",
  "scam-defense/upi-fraud-what-to-do/index.html",
  "scam-defense/digital-arrest-scam-india/index.html",
  "scam-defense/report-scam-call-india/index.html"
];

const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export function measurePage(rel) {
  const path = `./public/${rel}`;
  if (!existsSync(path)) return { page: rel, exists: false };
  const html = readFileSync(path, "utf8");
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "";
  const desc = (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || "";
  const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/i) || [])[1] || "";
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => decode(strip(m[1])));
  const toolLinks = [...html.matchAll(/href="(?:https:\/\/cipherati\.com)?\/?(?:\.\/)?tools\/[^"#?]+\.html"/gi)].length;
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)];
  const lazyImgs = imgs.filter((m) => /loading="lazy"/i.test(m[0])).length;
  const sizedImgs = imgs.filter((m) => /\bwidth=/i.test(m[0]) && /\bheight=/i.test(m[0])).length;
  return {
    page: rel,
    exists: true,
    htmlBytes: Buffer.byteLength(html, "utf8"),
    title: decode(title),
    description: decode(desc),
    canonical,
    h1Count: h1s.length,
    h1: h1s,
    internalToolReviewLinks: toolLinks,
    images: imgs.length,
    lazyImages: lazyImgs,
    imagesWithDimensions: sizedImgs
  };
}

if (process.argv[1] && process.argv[1].endsWith("seo-metrics.mjs")) {
  const rows = PAGES.map(measurePage);
  const out = { measuredAt: new Date().toISOString(), note: "Static HTML analysis of ./public; lab measurement, not field data.", pages: rows };
  const file = process.argv[2];
  if (file) writeFileSync(file, JSON.stringify(out, null, 2), "utf8");
  for (const r of rows) {
    if (!r.exists) { console.log(`${r.page}: (not present)`); continue; }
    console.log(`${r.page}\n  size=${(r.htmlBytes / 1024).toFixed(0)}KB h1=${r.h1Count} ${JSON.stringify(r.h1)}\n  title=${r.title}\n  canonical=${r.canonical || "(none)"}\n  desc=${r.description ? r.description.slice(0, 90) + "…" : "(none)"}\n  toolReviewLinks=${r.internalToolReviewLinks} imgs=${r.images} lazy=${r.lazyImages} sized=${r.imagesWithDimensions}`);
  }
}
