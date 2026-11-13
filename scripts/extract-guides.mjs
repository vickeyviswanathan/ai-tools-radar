// One-off, repeatable extraction of the three publish-ready guides from Cipherati_SEO_Growth_Pack.md into
// content/guides/<slug>.md. Text is copied verbatim; only the document-only "Related guides" line (anchors that
// only work inside the growth-pack document) and the internal editorial note are not carried over, because the
// page template renders working related-guide links and a visible disclaimer instead.
// Usage: node scripts/extract-guides.mjs <path-to-growth-pack.md>
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const src = process.argv[2];
if (!src) { console.error("usage: node scripts/extract-guides.mjs <growth-pack.md>"); process.exit(1); }
const lines = readFileSync(src, "utf8").replace(/\r\n/g, "\n").split("\n");

const GUIDES = [
  { slug: "upi-fraud-what-to-do", start: "# UPI Fraud: What to Do Immediately in India" },
  { slug: "digital-arrest-scam-india", start: "# Digital Arrest Scam in India: Spot It and Respond" },
  { slug: "report-scam-call-india", start: "# How to Report a Scam Call in India: Chakshu and 1930" }
];

mkdirSync("content/guides", { recursive: true });
for (const g of GUIDES) {
  const s = lines.findIndex((l) => l.trim() === g.start);
  if (s === -1) throw new Error(`Start heading not found: ${g.start}`);
  let e = lines.findIndex((l, idx) => idx > s && l.startsWith("**Related guides:**"));
  if (e === -1) throw new Error(`Related-guides line not found for ${g.slug}`);
  const body = lines.slice(s, e).join("\n").trim() + "\n";
  writeFileSync(`content/guides/${g.slug}.md`, body, "utf8");
  console.log(`${g.slug}: ${body.split(/\s+/).length} words`);
}
