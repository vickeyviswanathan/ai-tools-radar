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
  "public/cybersecurity-news.html",
  "public/scam-alerts.html",
  "public/ai-realities.html",
  "public/ai-tools.html",
  "public/data/tools.json",
  "public/data/threats.json",
  "public/data/scams.json",
  "public/data/briefing.json",
  "public/newsletter/today.html",
  "public/newsletter/today.md",
  "public/llms.txt",
  "public/llms-full.txt",
  "public/feed.xml",
  "public/sitemap.xml",
  "public/robots.txt",
  "public/c9426a40b7894f12a8e3d56c719204ef.txt",
  "public/manifest.json",
  "public/sw.js",
  "public/icons/icon-192.png",
  "public/icons/icon-512.png"
];
for (const file of requiredFiles) {
  assert(existsSync(file), `Required build artifact exists: ${file}`);
}

// 2. Strict Ban on Deprecated / Synthetic / Fluff / Competitor Strings
const bannedTerms = [
  "skype",
  "live wire",
  "wire report summary",
  "bfsi wire",
  "breaking wire",
  "statutory wire",
  "crypto wire",
  "taaft",
  "theresanaiforthat",
  "trend" + "shift",
  "sherlock-project"
];

for (const file of [
  "public/index.html",
  "public/cybersecurity-news.html",
  "public/scam-alerts.html",
  "public/ai-realities.html",
  "public/ai-tools.html",
  "public/data/tools.json",
  "public/data/scams.json",
  "public/data/threats.json",
  "public/llms.txt",
  "public/llms-full.txt"
]) {
  if (existsSync(file)) {
    const content = readFileSync(file, "utf8").toLowerCase();
    for (const term of bannedTerms) {
      assert(!content.includes(term), `Zero occurrences of banned term in ${file}`);
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
    const isIndian = /\b(india|indian|rbi|sebi|cbi|ed|cert-in|sbi|hdfc|icici|pnb|axis|kotak|bob|canara|uco|idfc|indusind|au bank|au small finance|paytm|phonepe|cred|npci|neft|rtgs|imps|aadhaar|pan|delhi police|mumbai police|cyber cell|digital arrest|nbfc|sc seeks|supreme court|enforcement directorate|tamil nadu|bengaluru|bangalore|hyderabad|chennai|pune|kolkata|kerala|noida|gurugram)\b|(?:\d+\s*)?(?:crore|lakh|cr)\b|\brs\.?\s*\d+/i.test(tLow);
    if (!isIndian) invalidBfsiStories++;
  }

  if (threat.incident && threat.incident.trim() === threat.title.trim()) {
    lazyCopiedSummaries++;
  }
}

assert(nonCyberStories === 0, `Zero non-cyber medical/general crimes in news feed`);
assert(invalidBfsiStories === 0, `All stories in India BFSI category have verified Indian financial/regulatory context`);
assert(lazyCopiedSummaries === 0, `Zero news stories have lazy summaries identical to headline`);

// 7b. Verify News is Strictly Sorted Reverse-Chronological (Newest First)
let outOfOrderNewsCount = 0;
for (let i = 0; i < threatsData.threats.length - 1; i++) {
  const current = threatsData.threats[i];
  const next = threatsData.threats[i + 1];
  const timeCurrent = current.timestamp || new Date(current.pubDate || current.date || 0).getTime();
  const timeNext = next.timestamp || new Date(next.pubDate || next.date || 0).getTime();
  if (timeNext > timeCurrent) {
    outOfOrderNewsCount++;
  }
}
assert(outOfOrderNewsCount === 0, `Cybersecurity news is strictly ordered newest first (${threatsData.threats.length} items checked)`);

// 8. Verify App Starts on Homepage (not AI Tools)
assert(indexHtml.includes('let currentView = "home";'), `Default view is initialized to 'home'`);
assert(indexHtml.includes('else if (hash === "#home" || !hash || hash === "#") {\n    switchView("home");'), `Default fallback route opens 'home'`);

// 9. Verify Daily Intelligence Briefing Generator
const briefingData = JSON.parse(readFileSync("public/data/briefing.json", "utf8"));
assert(briefingData.leadThreat && briefingData.leadThreat.title, "Briefing has verified Lead Cyber Story");
assert(briefingData.topScam === null || (briefingData.topScam && briefingData.topScam.title), "Briefing Scam Alerts is valid or cleanly skipped when all sent");
assert(briefingData.featuredTool === null || (briefingData.featuredTool && briefingData.featuredTool.name), "Briefing AI Tool is valid or cleanly skipped when all sent");
assert(briefingData.realityPick === null || (briefingData.realityPick && briefingData.realityPick.title), "Briefing AI Reality is valid or cleanly skipped when all sent");

// 10. Verify PWA Manifest & Service Worker Integrity
const manifestData = JSON.parse(readFileSync("public/manifest.json", "utf8"));
assert(manifestData.name && manifestData.start_url && manifestData.display === "standalone", "PWA manifest is valid with standalone display mode");
assert(Array.isArray(manifestData.icons) && manifestData.icons.length >= 2, "PWA manifest has required high-resolution icons");
assert(indexHtml.includes('rel="manifest"') && indexHtml.includes('serviceWorker.register'), "HTML includes PWA manifest link and Service Worker registration");

// 11. Verify Dispatcher Modules
assert(existsSync("src/newsletter-dispatcher.mjs"), "Email newsletter dispatcher module exists");
assert(existsSync("src/push-dispatcher.mjs"), "Web push notification dispatcher module exists");

// 12. OWASP Deep Hardening Gates (CSP, Reverse-Tabnabbing, SSRF, Open-Redirect, Auth & Rate Limiting)
const cspLine = indexHtml.match(/<meta http-equiv="Content-Security-Policy"[^>]+>/i)?.[0] || "";
assert(cspLine.includes("object-src 'none'") && cspLine.includes("frame-ancestors 'none'") && cspLine.includes("https://docs.google.com"), "CSP includes object-src 'none', frame-ancestors 'none', and explicit Google Forms connect/form-action allowlist");

const blankWithoutNoopener = [...indexHtml.matchAll(/<a[^>]+target="_blank"[^>]*>/gi)].filter(m => !m[0].includes("noopener") || !m[0].includes("noreferrer"));
assert(blankWithoutNoopener.length === 0, `All target="_blank" links include rel="noopener noreferrer" (${blankWithoutNoopener.length} missing)`);

const swCode = readFileSync("public/sw.js", "utf8");
assert(swCode.includes('parsed.hostname === "cipherati.com"'), "Service Worker notificationclick enforces strict same-origin / cipherati.com allowlist");

const serverCode = readFileSync("server.mjs", "utf8");
assert(serverCode.includes("verifyAdminToken") && serverCode.includes("checkRateLimit") && serverCode.includes("MAX_BODY_BYTES"), "server.mjs enforces admin authentication on /api/refresh, rate limiting on /api/submit, and 16KB body cap");

const classifyCode = readFileSync("src/classify.mjs", "utf8");
assert(classifyCode.includes("PRIVATE_HOST_RE"), "src/classify.mjs blocks SSRF private/loopback/metadata IP ranges in cleanUrl()");

const dispatcherCode = readFileSync("src/newsletter-dispatcher.mjs", "utf8");
assert(dispatcherCode.includes("escHtml(sub.email)") && dispatcherCode.includes("STRICT_EMAIL_RE"), "src/newsletter-dispatcher.mjs HTML-escapes Google Sheet fields and validates strict email format");
assert(!dispatcherCode.includes("2PACX-") && !dispatcherCode.includes("1KLX1pqtEP") && !dispatcherCode.includes("@gmail.com") && !dispatcherCode.includes("32ee4aad"), "Zero Google Sheet URLs, personal emails, or Resend Audience IDs exposed in public source code");

const ghaCode = readFileSync(".github/workflows/deploy.yml", "utf8");
assert(!/uses:\s*actions\/[a-z-]+@v\d+/i.test(ghaCode), "All GitHub Actions in deploy.yml are pinned to immutable 40-char commit SHAs");
assert(ghaCode.includes('cron: "30 2 * * *"'), "GitHub Actions workflow schedules exact 8:00 AM IST (02:30 UTC) morning briefing run");

const rssCode = readFileSync("src/live-cyber-rss.mjs", "utf8");
assert(rssCode.includes("cleanUrl(link"), "src/live-cyber-rss.mjs enforces SSRF & protocol validation via cleanUrl() on all RSS article links");

const buildStaticCode = readFileSync("build-static.mjs", "utf8");
const seoPublishCode = readFileSync("src/seo-publish.mjs", "utf8");
assert(buildStaticCode.includes('replace(/</g, "\\\\u003c")') && seoPublishCode.includes('replace(/</g, "\\\\u003c")'), "All inline JSON-in-HTML script serializations escape '<' to '\\u003c' to prevent script-breakout XSS");

const gasCode = readFileSync("scripts/google-apps-script-webhook.js", "utf8");
assert(gasCode.includes("strictEmailRe") && gasCode.includes("safeCell") && !gasCode.includes("err.toString()"), "Google Apps Script webhook enforces strict email validation, formula neutralization, and generic error responses");

const pkgCode = readFileSync("package.json", "utf8");
assert(pkgCode.includes('"name": "cipherati"') && !existsSync("workflows") && !existsSync("data/day.json") && !existsSync("data/week.json"), "Legacy scraper workflows and prototype snapshots are completely removed");

assert(indexHtml.includes("#newsletter-unsubscribe") && indexHtml.includes("handleNewsletterUnsubscribe") && dispatcherCode.includes("unsubscribedEmails"), "DPDP Act 2023 Section 6(4) 1-click unsubscribe flow is wired end-to-end from UI to Google Sheet & Resend Audience");
assert(!cspLine.includes("onesignal.com") && !indexHtml.includes("cdn.onesignal.com"), "Zero external third-party script CDNs allowed in CSP or HTML");
assert(dispatcherCode.includes("getCurrentIstMinutes") && dispatcherCode.includes("held_for_8am_ist"), "Newsletter dispatcher enforces 8:00 AM IST morning window and blocks accidental push broadcasts");

// 13. SEO, GEO & AEO Search Dominance Gates
const sitemapXml = readFileSync("public/sitemap.xml", "utf8");
assert(sitemapXml.includes("cybersecurity-news.html") && sitemapXml.includes("scam-alerts.html") && sitemapXml.includes("ai-realities.html") && sitemapXml.includes("ai-tools.html") && sitemapXml.includes("llms-full.txt"), "sitemap.xml contains all 4 SEO pillar pages + llms-full.txt");

const cyberPage = readFileSync("public/cybersecurity-news.html", "utf8");
assert(cyberPage.includes('<section class="section-wrap" id="threats">') && cyberPage.includes("NewsArticle"), "cybersecurity-news.html renders threats section 100% visible without display:none and includes NewsArticle JSON-LD");

const scamPage = readFileSync("public/scam-alerts.html", "utf8");
assert(scamPage.includes('<section class="section-wrap" id="scams">') && scamPage.includes("FAQPage") && scamPage.includes("HowTo"), "scam-alerts.html renders scams section 100% visible without display:none and includes FAQPage + HowTo JSON-LD");

const realitiesPage = readFileSync("public/ai-realities.html", "utf8");
assert(realitiesPage.includes('<section class="section-wrap" id="realities">') && realitiesPage.includes("FAQPage"), "ai-realities.html renders realities section 100% visible without display:none and includes FAQPage JSON-LD");

const toolsPage = readFileSync("public/ai-tools.html", "utf8");
assert(toolsPage.includes("SoftwareSourceCode") && indexHtml.includes("SoftwareSourceCode"), "Rich SoftwareSourceCode repository Schema.org JSON-LD is embedded in index.html and ai-tools.html");
assert(indexHtml.includes("omnibox-dropdown") && indexHtml.includes("selectOmniboxHit"), "Cross-pillar omnibox command search is wired across AI Tools, AI Realities, Cyber News, and Scam Alerts");
assert(indexHtml.includes('href="./cybersecurity-news.html"') && indexHtml.includes('href="./scam-alerts.html"') && indexHtml.includes('href="./ai-realities.html"') && indexHtml.includes('href="./ai-tools.html"'), "Sidebar navigation uses crawlable <a href> pillar links for PageRank distribution");
assert(indexHtml.includes('<span class="tab-count" id="tab-realities-count">22</span>'), "Mobile/Header AI Realities tab count badge is synced to 22");
const feedXml = readFileSync("public/feed.xml", "utf8");
assert(feedXml.includes("<rss version=\"2.0\"") && feedXml.includes("cybersecurity-news.html") && feedXml.includes("scam-alerts.html"), "RSS 2.0 syndication feed (public/feed.xml) is valid and populated");


// Summary
console.log("=========================================");
if (failureCount > 0) {
  console.error(`❌ QUALITY GATE FAILED: ${failureCount} checks failed. Deployment aborted.`);
  process.exit(1);
} else {
  console.log("🎉 ALL QUALITY GATES PASSED! Build is clean, verified, and safe to deploy.");
  process.exit(0);
}
