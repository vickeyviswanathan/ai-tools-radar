// Strict Automated Quality, Safety & Anti-Junk Verification Gate
// Runs after every build to guarantee no corrupt, duplicate, dead, or scammy data is deployed.
import { readFileSync, existsSync } from "node:fs";

console.log("=========================================");
console.log(" Running Cipherati Quality & Safety Gate ");
console.log("=========================================");

let failureCount = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    failureCount++;
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

// 1. Verify Output Files Exist
const requiredFiles = [
  "public/index.html",
  "public/data/tools.json",
  "public/data/threats.json",
  "public/data/scams.json",
  "public/llms.txt",
  "public/sitemap.xml",
  "public/robots.txt"
];
for (const file of requiredFiles) {
  assert(existsSync(file), `Required build artifact exists: ${file}`);
}

// 2. Strict Ban on Deprecated / Synthetic / Fluff Strings
const bannedTerms = [
  "skype",
  "live wire",
  "wire report summary",
  "bfsi wire",
  "breaking wire",
  "statutory wire",
  "crypto wire"
];

for (const file of ["public/index.html", "public/data/scams.json", "public/data/threats.json", "public/llms.txt"]) {
  if (existsSync(file)) {
    const content = readFileSync(file, "utf8").toLowerCase();
    for (const term of bannedTerms) {
      assert(!content.includes(term), `No banned term "${term}" in ${file}`);
    }
  }
}

// 3. Verify Curated Tools Integrity
const toolsData = JSON.parse(readFileSync("public/data/tools.json", "utf8"));
assert(Array.isArray(toolsData.tools) && toolsData.tools.length >= 100, `Healthy tool count (${toolsData.tools.length} >= 100)`);

let insecureToolUrls = 0;
let brokenNames = 0;
const toolUrls = new Set();
let dupeToolUrls = 0;

for (const tool of toolsData.tools) {
  if (!tool.name || tool.name.trim().length < 2) brokenNames++;
  if (!tool.url || !tool.url.startsWith("https://")) insecureToolUrls++;
  if (toolUrls.has(tool.url)) dupeToolUrls++;
  toolUrls.add(tool.url);
}

assert(insecureToolUrls === 0, `All tool URLs use secure https://${insecureToolUrls > 0 ? ` (${insecureToolUrls} insecure)` : ""}`);
assert(brokenNames === 0, `All tools have valid, non-empty names`);
assert(dupeToolUrls === 0, `All tool URLs are unique (0 duplicates)`);

// 4. Verify Cybersecurity News Deduplication & Reputable Desks
const threatsData = JSON.parse(readFileSync("public/data/threats.json", "utf8"));
assert(Array.isArray(threatsData.threats) && threatsData.threats.length >= 10, `Healthy threats count (${threatsData.threats.length} >= 10)`);

let binanceCount = 0;
let auBankCount = 0;
let deadNewsUrls = 0;
const seenTitles = new Set();
let duplicateNewsTitles = 0;

for (const threat of threatsData.threats) {
  const lower = threat.title.toLowerCase();
  if (lower.includes("binance") || lower.includes("6.3 billion") || lower.includes("largest crypto")) binanceCount++;
  if (lower.includes("au small finance") || lower.includes("au bank")) auBankCount++;
  if (!threat.sourceUrl || !threat.sourceUrl.startsWith("http")) deadNewsUrls++;
  if (seenTitles.has(lower)) duplicateNewsTitles++;
  seenTitles.add(lower);
}

assert(binanceCount <= 1, `Binance heist deduplicated to at most 1 card (found ${binanceCount})`);
assert(auBankCount <= 1, `AU Bank breach deduplicated to at most 1 card (found ${auBankCount})`);
assert(duplicateNewsTitles === 0, `Zero identical news headlines in feed`);
assert(deadNewsUrls === 0, `All news items have valid source URLs`);

// 5. Verify Scam Defense Action Links Safety
const scamsData = JSON.parse(readFileSync("public/data/scams.json", "utf8"));
assert(Array.isArray(scamsData.scams) && scamsData.scams.length >= 10, `Healthy scam alerts count (${scamsData.scams.length} >= 10)`);

const TRUSTED_DOMAINS = [
  "gov.in",
  "org.in",
  "reuters.com",
  "cisa.gov",
  "ftc.gov"
];

let untrustedScamUrls = 0;
for (const scam of scamsData.scams) {
  try {
    const urlObj = new URL(scam.actionUrl);
    const host = urlObj.hostname;
    const isTrusted = TRUSTED_DOMAINS.some(d => host === d || host.endsWith("." + d));
    if (!isTrusted) untrustedScamUrls++;
  } catch {
    untrustedScamUrls++;
  }
}
assert(untrustedScamUrls === 0, `All scam defense action links point to official statutory/regulatory domains`);

// Summary
console.log("=========================================");
if (failureCount > 0) {
  console.error(`❌ QUALITY GATE FAILED: ${failureCount} checks failed. Deployment aborted.`);
  process.exit(1);
} else {
  console.log("🎉 ALL QUALITY GATES PASSED! Build is clean, verified, and safe to deploy.");
  process.exit(0);
}
