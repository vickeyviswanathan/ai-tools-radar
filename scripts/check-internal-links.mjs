// Internal-link & indexability audit over the BUILT site (./public). Pure static HTML — no JavaScript is executed,
// which is what a non-rendering crawler sees. It crawls from the homepage following only real <a href> links
// (never JavaScript click handlers) and compares the reachable set with sitemap.xml.
//
// Reports:
//   - orphaned indexable URLs: listed in the sitemap but not reachable via crawlable internal links from "/"
//   - broken internal links (target file does not exist)
//   - sitemap URLs without a file, with noindex, with a canonical that differs from their own URL,
//     with H1 count != 1, or with unparsable JSON-LD
// Usage: node scripts/check-internal-links.mjs [--json out.json]
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const ORIGIN = "https://cipherati.com";
const PUBLIC = path.resolve("public");

const toFile = (urlPath) => {
  let p = decodeURIComponent(urlPath);
  if (p.endsWith("/")) p += "index.html";
  return path.join(PUBLIC, p);
};
const norm = (u) => {
  const url = new URL(u, ORIGIN);
  url.hash = ""; url.search = "";
  return url.href;
};

const sitemap = readFileSync(path.join(PUBLIC, "sitemap.xml"), "utf8");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const sitemapSet = new Set(sitemapUrls.map(norm));

const problems = { missingFile: [], noindex: [], canonicalMismatch: [], h1: [], jsonld: [], broken: [], orphans: [] };
const htmlCache = new Map();
const readHtml = (url) => {
  if (htmlCache.has(url)) return htmlCache.get(url);
  const file = toFile(new URL(url).pathname);
  const html = existsSync(file) ? readFileSync(file, "utf8") : null;
  htmlCache.set(url, html);
  return html;
};

// BFS crawl over crawlable links
const queue = [`${ORIGIN}/`];
const seen = new Set(queue);
const inlinks = new Map();
while (queue.length) {
  const url = queue.shift();
  const html = readHtml(url);
  if (html == null) continue;
  const hrefs = [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/gi)].map((m) => m[1].replace(/&amp;/g, "&"));
  for (const href of hrefs) {
    if (!href || href.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(href)) continue;
    let target;
    try { target = new URL(href, url); } catch { continue; }
    if (target.origin !== ORIGIN) continue;
    if (!/(\.html|\/)$/.test(target.pathname)) continue; // assets / feeds / txt are not pages
    const n = norm(target.href);
    if (!existsSync(toFile(new URL(n).pathname))) { problems.broken.push(`${url} -> ${href}`); continue; }
    if (!inlinks.has(n)) inlinks.set(n, new Set());
    inlinks.get(n).add(url);
    if (!seen.has(n)) { seen.add(n); queue.push(n); }
  }
}

for (const url of sitemapSet) {
  const file = toFile(new URL(url).pathname);
  if (!existsSync(file)) { problems.missingFile.push(url); continue; }
  const html = readHtml(url);
  if (/<meta name="robots" content="[^"]*noindex/i.test(html)) problems.noindex.push(url);
  const canon = (html.match(/<link rel="canonical" href="([^"]*)"/i) || [])[1];
  if (canon && norm(canon) !== url) problems.canonicalMismatch.push(`${url} canonical=${canon}`);
  if (!canon) problems.canonicalMismatch.push(`${url} has no canonical`);
  const h1 = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1 !== 1) problems.h1.push(`${url} has ${h1} H1`);
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(m[1]); } catch (e) { problems.jsonld.push(`${url}: ${e.message}`); }
  }
  if (!seen.has(url) || (url !== `${ORIGIN}/` && !(inlinks.get(url) || new Set()).size)) problems.orphans.push(url);
}

const total = sitemapSet.size;
console.log(`Sitemap URLs: ${total} | reachable from "/" via crawlable links: ${[...sitemapSet].filter((u) => seen.has(u)).length}`);
let failed = false;
for (const [k, list] of Object.entries(problems)) {
  if (list.length) { failed = true; console.log(`\n${k}: ${list.length}`); list.slice(0, 15).forEach((x) => console.log("  - " + x)); if (list.length > 15) console.log(`  … and ${list.length - 15} more`); }
  else console.log(`${k}: 0`);
}
const jsonOut = process.argv.indexOf("--json");
if (jsonOut > -1) writeFileSync(process.argv[jsonOut + 1], JSON.stringify({ total, problems }, null, 2));
process.exit(failed ? 1 : 0);
