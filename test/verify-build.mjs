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
  "public/data/briefing.json",
  "public/newsletter/today.html",
  "public/newsletter/today.md",
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

// 6. Verify AI Realities Relevance, Non-duplication & Accurate Tool Stacks
const indexHtml = readFileSync("public/index.html", "utf8");
const realityCardsCount = (indexHtml.match(/class="reality-card"/g) || []).length;
assert(realityCardsCount === 22, `Exactly 22 AI Realities cards pre-rendered (found ${realityCardsCount})`);

// Ensure Scrapling is NOT in the Realities section
const realitiesSectionMatch = indexHtml.match(/<div class="reality-grid" id="reality-grid">([\s\S]*?)<\/div>\s*<div id="reality-empty-state"/);
const realitiesHtml = realitiesSectionMatch ? realitiesSectionMatch[1] : "";
assert(!realitiesHtml.toLowerCase().includes("scrapling"), `Zero occurrences of Scrapling in AI Realities grid`);

// Verify Reality 10 contains PyMuPDF4LLM, MinerU, and pdf oxide
const reality10Match = indexHtml.match(/id="reality-9"[\s\S]*?<\/div>\s*<\/div>/);
const reality10Text = reality10Match ? reality10Match[0] : "";
assert(reality10Text.includes("MinerU") && reality10Text.includes("PyMuPDF4LLM") && reality10Text.includes("pdf oxide"), `Reality #10 (PDF & Table Chunking) has exact PDF/OCR tools (MinerU, PyMuPDF4LLM, pdf oxide)`);

// 7. Verify News Hygiene (Zero Medicare/Botox, Genuine BFSI Categorization, No Lazy Copied Summaries)
let nonCyberStories = 0;
let invalidBfsiStories = 0;
let lazyCopiedSummaries = 0;

for (const threat of threatsData.threats) {
  const tLow = threat.title.toLowerCase();
  if (tLow.includes("botox") || tLow.includes("medicare") || tLow.includes("cosmetic surgery") ||
      tLow.includes("ed attaches") || tLow.includes("attaches properties") || tLow.includes("car sales") ||
      tLow.includes("dollar pulls back") || tLow.includes("loan fraud") || tLow.includes("chandra proteco") ||
      tLow.includes("warming") || tLow.includes("glacier") || tLow.includes("ice sheet") ||
      tLow.includes("career guidance") || tLow.includes("students briefed") || tLow.includes("polytechnic")) {
    nonCyberStories++;
  }

  if (threat.category === "india-bfsi") {
    const isIndian = /\b(india|indian|rbi|sebi|cbi|cert-in|sbi|hdfc|icici|pnb|axis|kotak|bob|canara|uco|idfc|indusind|au bank|au small finance|paytm|phonepe|cred|npci|neft|rtgs|imps|aadhaar|pan|crore|lakh|delhi police|mumbai police|cyber cell|digital arrest|nbfc|sc seeks|supreme court)\b/i.test(tLow);
    if (!isIndian) invalidBfsiStories++;
  }

  if (threat.incident && threat.incident.trim() === threat.title.trim()) {
    lazyCopiedSummaries++;
  }
}

assert(nonCyberStories === 0, `Zero non-cyber medical/general crimes in news feed`);
assert(invalidBfsiStories === 0, `All stories in India BFSI category have verified Indian financial/regulatory context`);
assert(lazyCopiedSummaries === 0, `Zero news stories have lazy summaries identical to headline`);

// 8. Verify App Starts on Homepage (not AI Tools)
assert(indexHtml.includes('let currentView = "home";'), `Default view is initialized to 'home'`);
assert(indexHtml.includes('else if (hash === "#home" || !hash || hash === "#") {\n    switchView("home");'), `Default fallback route opens 'home'`);

// 9. Verify Daily Intelligence Briefing Generator
const briefingData = JSON.parse(readFileSync("public/data/briefing.json", "utf8"));
assert(briefingData.leadThreat && briefingData.leadThreat.title, "Briefing has verified Lead Cyber Story");
assert(briefingData.topScam && briefingData.topScam.title, "Briefing has active Scam Watch");
assert(briefingData.featuredTool && briefingData.featuredTool.name, "Briefing has featured AI Tool");
assert(briefingData.realityPick && briefingData.realityPick.title, "Briefing has Reality Check of the day");

// Summary
console.log("=========================================");
if (failureCount > 0) {
  console.error(`❌ QUALITY GATE FAILED: ${failureCount} checks failed. Deployment aborted.`);
  process.exit(1);
} else {
  console.log("🎉 ALL QUALITY GATES PASSED! Build is clean, verified, and safe to deploy.");
  process.exit(0);
}
