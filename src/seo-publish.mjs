// Static markup + SEO artifact publishing, mirroring the client render so
// crawlers and no-JS visitors see the full directory (the client re-renders
// after fetch). Imported by build-static.mjs and covered by tools/test-seo.mjs.
import { readFileSync, writeFileSync } from "node:fs";

const SITE_URL = "https://cipherati.com/";

const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const BOILERPLATE_WHY = /verified GitHub stars\.$|upvotes on Hacker News\.$|likes on Hugging Face\.$|vetted for production\.$/;

const fmtCompact = (n) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

// One-line adoption proof, phrased as information rather than badge repetition.
// Used for fresh ingests (quality.mjs) and to backfill older stored rows at build.
export function signalWhySentence(source, metric) {
  const n = fmtCompact(metric || 0);
  if (source === "github") return `Battle-tested in the open — ${n} GitHub stars from real production users.`;
  if (source === "hn") return `Earned ${metric} upvotes of practitioner scrutiny on Hacker News.`;
  if (source === "huggingface") return `Trending with the builder community — ${n} Hugging Face likes.`;
  return "Editorially vetted as a production-ready AI tool.";
}

// Older stored rows carry boilerplate why_it_matters text. Rewrite those from
// live signals so every card — existing or newly ingested — says something useful.
export function normalizeWhyItMatters(tools) {
  for (const t of tools) {
    if (t.why_it_matters && !BOILERPLATE_WHY.test(t.why_it_matters)) continue;
    const metricOf = (src) => {
      const s = (t.signals || []).find(x => x.startsWith(src + ":"));
      return s ? Number(s.split(":")[1]) || 0 : 0;
    };
    const gh = metricOf("github"), hf = metricOf("huggingface"), hn = metricOf("hn");
    if (gh) t.why_it_matters = signalWhySentence("github", gh);
    else if (hf) t.why_it_matters = signalWhySentence("huggingface", hf);
    else if (hn) t.why_it_matters = signalWhySentence("hn", hn);
    else t.why_it_matters = signalWhySentence("app", 0);
  }
  return tools;
}

function staticSignals(signals = []) {
  return signals.map(s => {
    const [src, metric] = s.split(":");
    const num = Number(metric);
    const fmt = num >= 1000 ? (num / 1000).toFixed(1) + "k" : num;
    if (src === "github") return `<span class="badge source-gh">★ ${fmt} stars</span>`;
    if (src === "hn") return `<span class="badge source-hn">▲ ${fmt} pts</span>`;
    if (src === "huggingface") return `<span class="badge source-hf">♥ ${fmt} likes</span>`;
    return "";
  }).join("");
}

function staticCard(t) {
  let domain = "";
  try { domain = new URL(t.url).hostname; } catch {}
  const icon = esc(t.emoji || "⚡") + (domain
    ? `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64" alt="" loading="lazy" onerror="this.remove()" style="position:absolute;inset:0;margin:auto;" />`
    : "");
  const why = t.why_it_matters && !BOILERPLATE_WHY.test(t.why_it_matters)
    ? `<div class="why-box"><strong>Why it matters:</strong> ${esc(t.why_it_matters)}</div>` : "";
  return `<a class="tool-card" href="${esc(t.url)}" target="_blank" rel="noopener">
        <div class="tool-top">
          <div class="tool-icon">${icon}</div>
          <div style="flex: 1; min-width: 0;">
            <div class="tool-name">${esc(t.name)} <span class="tool-name-link">↗</span></div>
            <p class="tool-tag">${esc(t.tagline)}</p>
          </div>
        </div>
        ${why}
        <div class="tool-meta">
          <span class="badge cat">${esc(t.category)}</span>
          ${staticSignals(t.signals)}
        </div>
      </a>`;
}

// Inject static cards, JSON-LD, sitemap and robots.txt so the directory is
// fully visible to search engines, LLM crawlers, and social scrapers.
export function publishSeoArtifacts(tools, updatedAt, indexPath = "./public/index.html") {
  const ranked = [...tools].sort((a, b) => (b.rank || 0) - (a.rank || 0));
  const cards = ranked.map(staticCard).join("\n      ");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "AI Tools Radar — Curated AI developer tools",
    url: SITE_URL,
    numberOfItems: tools.length,
    itemListElement: ranked.slice(0, 50).map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      url: t.url,
      description: t.tagline,
    })),
  };

  let html = readFileSync(indexPath, "utf8");
  html = html.replace(
    /<!-- PRERENDER:BEGIN -->[\s\S]*?<!-- PRERENDER:END -->/,
    `<!-- PRERENDER:BEGIN -->\n      ${cards}\n      <!-- PRERENDER:END -->`
  );
  html = html.replace(
    /<!-- JSONLD:BEGIN -->[\s\S]*?<!-- JSONLD:END -->/,
    `<!-- JSONLD:BEGIN -->\n<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n<!-- JSONLD:END -->`
  );
  writeFileSync(indexPath, html, "utf8");

  const lastmod = updatedAt.slice(0, 10);
  writeFileSync("./public/sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE_URL}</loc><lastmod>${lastmod}</lastmod><changefreq>hourly</changefreq></url>\n</urlset>\n`,
    "utf8");
  writeFileSync("./public/robots.txt",
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`,
    "utf8");
  console.log(`Pre-rendered ${ranked.length} tool cards into index.html, plus JSON-LD, sitemap.xml and robots.txt.`);
}
