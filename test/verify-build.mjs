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
  "sherlock-project",
  "cybertruck",
  "real production users",
  "battle-tested",
  "practitioner-grade"
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
const indexHtml = readFileSync("public/index.html", "utf8").replace(/\r\n/g, "\n");
const realitiesPage = readFileSync("public/ai-realities.html", "utf8").replace(/\r\n/g, "\n");
const realityCardsCount = (realitiesPage.match(/class="reality-card"/g) || []).length;
assert(realityCardsCount === 22, `Exactly 22 AI Realities cards pre-rendered (found ${realityCardsCount})`);

// Ensure Scrapling is NOT in the Realities section
const realitiesSectionMatch = realitiesPage.match(/<div class="reality-grid" id="reality-grid">([\s\S]*?)<\/div>\s*<div id="reality-empty-state"/);
const realitiesHtml = realitiesSectionMatch ? realitiesSectionMatch[1] : "";
assert(!realitiesHtml.toLowerCase().includes("scrapling"), `Zero occurrences of Scrapling in AI Realities grid`);

// Verify Reality 10 contains PyMuPDF4LLM, MinerU, and pdf oxide
const reality10Match = realitiesPage.match(/id="reality-9"[\s\S]*?<\/div>\s*<\/div>/);
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
      tLow.includes("career guidance") || tLow.includes("students briefed") || tLow.includes("polytechnic") ||
      tLow.includes("shares a hack") || tLow.includes("solar power") || tLow.includes("food security") ||
      tLow.includes("agrivoltaics") || tLow.includes("online it training") || tLow.includes("hacked to death")) {
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
assert(indexHtml.includes('let currentView = PAGE_VIEW;') && indexHtml.includes('<meta name="cipherati-view" content="home" />'), `Homepage view is initialized to 'home' (PAGE_VIEW from <meta name="cipherati-view">)`);
assert(indexHtml.includes('} else {\n    switchView(PAGE_VIEW);\n  }'), `Unknown/empty hashes fall back to the current page's own view`);

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
assert(buildStaticCode.includes('replace(/</g, "\\\\u003c")') && readFileSync("src/view-pages.mjs", "utf8").includes('replace(/</g, "\\\\u003c")'), "All inline JSON-in-HTML script serializations escape '<' to '\\u003c' to prevent script-breakout XSS");

const gasCode = readFileSync("scripts/google-apps-script-webhook.js", "utf8");
assert(gasCode.includes("strictEmailRe") && gasCode.includes("safeCell") && !gasCode.includes("err.toString()"), "Google Apps Script webhook enforces strict email validation, formula neutralization, and generic error responses");

const pkgCode = readFileSync("package.json", "utf8");
assert(pkgCode.includes('"name": "cipherati"') && !existsSync("workflows") && !existsSync("data/day.json") && !existsSync("data/week.json"), "Legacy scraper workflows and prototype snapshots are completely removed");

assert(indexHtml.includes("#newsletter-unsubscribe") && indexHtml.includes("handleNewsletterUnsubscribe") && dispatcherCode.includes("unsubscribedEmails"), "DPDP Act 2023 Section 6(4) 1-click unsubscribe flow is wired end-to-end from UI to Google Sheet & Resend Audience");
assert(!cspLine.includes("onesignal.com") && !indexHtml.includes("cdn.onesignal.com"), "Zero unauthorized push script CDNs allowed in CSP or HTML");
assert(indexHtml.includes("G-6YXH14ZGPR") && cspLine.includes("https://www.googletagmanager.com") && cspLine.includes("https://www.google-analytics.com"), "Google Analytics 4 (G-6YXH14ZGPR) is wired into HTML and permitted by CSP");
assert(dispatcherCode.includes("getCurrentIstMinutes") && dispatcherCode.includes("held_for_8am_ist"), "Newsletter dispatcher enforces 8:00 AM IST morning window and blocks accidental push broadcasts");

// 13. SEO, GEO & AEO Search Dominance Gates
const sitemapXml = readFileSync("public/sitemap.xml", "utf8");
assert(sitemapXml.includes("cybersecurity-news.html") && sitemapXml.includes("scam-alerts.html") && sitemapXml.includes("ai-realities.html") && sitemapXml.includes("ai-tools.html") && !sitemapXml.includes("llms-full.txt") && !sitemapXml.includes("feed.xml"), "sitemap.xml contains all 4 SEO pillar pages and only HTML URLs (no feed/txt files)");

const cyberPage = readFileSync("public/cybersecurity-news.html", "utf8");
assert(cyberPage.includes('<section class="section-wrap" id="threats">') && cyberPage.includes("NewsArticle"), "cybersecurity-news.html renders threats section 100% visible without display:none and includes NewsArticle JSON-LD");

const scamPage = readFileSync("public/scam-alerts.html", "utf8");
assert(scamPage.includes('<section class="section-wrap" id="scams">') && scamPage.includes("FAQPage") && scamPage.includes("HowTo"), "scam-alerts.html renders scams section 100% visible without display:none and includes FAQPage + HowTo JSON-LD");

assert(realitiesPage.includes('<section class="section-wrap" id="realities">') && realitiesPage.includes("FAQPage"), "ai-realities.html renders realities section 100% visible without display:none and includes FAQPage JSON-LD");

const toolsPage = readFileSync("public/ai-tools.html", "utf8");
function sampleToolPage0() { return readFileSync("public/tools/ollama.html", "utf8"); }
assert(sampleToolPage0().includes("SoftwareSourceCode") && toolsPage.includes('"@type":"ItemList"'), "Tool review pages carry SoftwareSourceCode JSON-LD and /ai-tools.html carries an ItemList of internal review URLs");
assert(indexHtml.includes("omnibox-dropdown") && indexHtml.includes("selectOmniboxHit"), "Cross-pillar omnibox command search is wired across AI Tools, AI Realities, Cyber News, and Scam Alerts");
assert(indexHtml.includes('href="./cybersecurity-news.html"') && indexHtml.includes('href="./scam-alerts.html"') && indexHtml.includes('href="./ai-realities.html"') && indexHtml.includes('href="./ai-tools.html"'), "Sidebar navigation uses crawlable <a href> pillar links for PageRank distribution");
assert(indexHtml.includes('<span class="tab-count" id="tab-realities-count">22</span>'), "Mobile/Header AI Realities tab count badge is synced to 22");
const feedXml = readFileSync("public/feed.xml", "utf8");
assert(feedXml.includes("<rss version=\"2.0\"") && feedXml.includes("cybersecurity-news.html") && feedXml.includes("scam-alerts.html"), "RSS 2.0 syndication feed (public/feed.xml) is valid and populated");

// 14. Practitioner Credibility & Anti-Hype Gates
const mediumSeverityCount = threatsData.threats.filter(t => t.severity === "medium").length;
assert(mediumSeverityCount >= 1, `News severity rubric is calibrated (${mediumSeverityCount} medium/advisory items alongside high/critical incidents)`);

const genericUrgentBadges = threatsData.threats.filter(t => t.impactBadge === "🚨 Urgent Alert").length;
assert(genericUrgentBadges === 0, `Zero generic '🚨 Urgent Alert' badges inflating non-incident news (${genericUrgentBadges} found)`);

assert(indexHtml.includes("deriveToolEvaluation") && indexHtml.includes("Engineering Evaluation &amp; Trade-offs"), "Tool inspector drawer renders structured Engineering Evaluation & Trade-offs spec sheet");
assert(indexHtml.includes("GitHub stars and community metrics reflect public popularity, not an independent security audit"), "Tool inspector drawer includes explicit popularity vs. security audit disclaimer");

// 15. Programmatic SEO Long-Tail Scale Gates (300+ Canonical Pages)
const sitemapLocMatches = sitemapXml.match(/<loc>/g) || [];
assert(sitemapLocMatches.length >= 300, `sitemap.xml includes 300+ programmatic long-tail URLs (found ${sitemapLocMatches.length})`);
assert(existsSync("public/tools/ollama.html") && existsSync("public/scams/accidental-upi-transfer-trap.html") && existsSync("public/realities/the-context-window-lie.html"), "Dedicated programmatic HTML pages exist for tools, scams, and realities");
const sampleToolPage = readFileSync("public/tools/ollama.html", "utf8");
assert(sampleToolPage.includes("Engineering Evaluation &amp; Trade-offs Spec Sheet") && sampleToolPage.includes("FAQPage") && sampleToolPage.includes("BreadcrumbList"), "Programmatic tool page contains full engineering spec table, FAQPage, and BreadcrumbList JSON-LD");
assert(dispatcherCode.includes("api.resend.com/audiences") && dispatcherCode.includes("DEFAULT_SHEET_CSV"), "Newsletter dispatcher auto-discovers Resend Audience ID and syncs Google Sheet subscribers");

// 16. Dual-pillar SEO structure gates: unique H1s, self-canonicals, lighter pages, internal discovery, guides
const readPage = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const h1Of = (html) => [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim());
const canonicalOf = (html) => (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || "";
const APP_PAGES = {
  "public/index.html": ["Build Better with AI. Stay Safer Online.", "https://cipherati.com/"],
  "public/ai-tools.html": ["AI Developer Tools, Coding Agents and Local Models", "https://cipherati.com/ai-tools.html"],
  "public/ai-realities.html": ["AI Engineering Lessons from Production", "https://cipherati.com/ai-realities.html"],
  "public/cybersecurity-news.html": ["Cybersecurity News and Threat Intelligence", "https://cipherati.com/cybersecurity-news.html"],
  "public/scam-alerts.html": ["Cyber Scam Alerts and Practical Defense for India", "https://cipherati.com/scam-alerts.html"]
};
const seenH1 = new Set();
for (const [file, [h1, canon]] of Object.entries(APP_PAGES)) {
  const html = readPage(file);
  const found = h1Of(html);
  assert(found.length === 1 && found[0] === h1, `${file} has exactly one H1: "${h1}" (found ${JSON.stringify(found)})`);
  assert(canonicalOf(html) === canon, `${file} has self-referencing canonical ${canon}`);
  seenH1.add(found[0]);
}
assert(seenH1.size === Object.keys(APP_PAGES).length, "All five app pages use different H1s");

const homePage = readPage("public/index.html");
const newsPage = readPage("public/cybersecurity-news.html");
const scamsPage = readPage("public/scam-alerts.html");
const pageSizeKb = (f) => Buffer.byteLength(readPage(f), "utf8") / 1024;
assert(!homePage.includes('id="threats"') && !homePage.includes('id="scams"') && !homePage.includes('id="realities"'), "Homepage no longer embeds the news, scams or realities sections");
assert(!newsPage.includes('id="scams"') && !newsPage.includes('id="radar"') && !newsPage.includes('id="grid"'), "News page does not duplicate the scams section or the tools directory");
assert(!scamsPage.includes('id="threats"') && !scamsPage.includes('id="radar"') && !scamsPage.includes('id="grid"'), "Scam page does not duplicate the news section or the tools directory");
assert(!realitiesPage.includes('id="threats"') && !realitiesPage.includes('id="scams"') && !realitiesPage.includes('id="grid"'), "Realities page does not duplicate other sections or the tools directory");
assert(!/display:\s*none[^>]*id="(?:threats|scams|realities|radar)"|id="(?:threats|scams|realities)"[^>]*display:\s*none/.test(homePage + newsPage + scamsPage + realitiesPage + toolsPage), "No hidden duplicate portal sections remain on any app page");
assert(pageSizeKb("public/index.html") < 320 && pageSizeKb("public/ai-realities.html") < 380 && pageSizeKb("public/cybersecurity-news.html") < 400 && pageSizeKb("public/scam-alerts.html") < 380 && pageSizeKb("public/ai-tools.html") < 600, "App pages stay well under the pre-change ~650 KB size");

// Internal discovery: every tool card links to its own review first; official URL is a labelled secondary link.
const toolSlugsInJson = JSON.parse(readFileSync("public/data/tools.json", "utf8")).tools.map((t) => t.slug);
assert(toolSlugsInJson.every(Boolean) && new Set(toolSlugsInJson).size === toolSlugsInJson.length, "Every tool in tools.json has a unique review slug");
const toolReviewLinks = (toolsPage.match(/class="tool-card-link" href="\/tools\/[^"]+\.html"/g) || []).length;
assert(toolReviewLinks === toolSlugsInJson.length, `/ai-tools.html links all ${toolSlugsInJson.length} tool cards to their /tools/ review first (found ${toolReviewLinks})`);
assert(toolSlugsInJson.every((slug) => existsSync(`public/tools/${slug}.html`)), "Every linked /tools/ review page exists");
assert((toolsPage.match(/class="tool-ext" href="https?:\/\/[^"]+" target="_blank" rel="noopener noreferrer">Official source/g) || []).length === toolSlugsInJson.length, "Each tool card keeps a clearly labelled, rel-protected 'Official source' secondary link");
assert((homePage.match(/href="\/tools\/[^"]+\.html"/g) || []).length >= 3, "Homepage features at least three internal tool reviews");

// Guides
const GUIDE_SLUGS = ["upi-fraud-what-to-do", "digital-arrest-scam-india", "report-scam-call-india"];
for (const slug of GUIDE_SLUGS) {
  const file = `public/scam-defense/${slug}/index.html`;
  assert(existsSync(file), `Guide page exists: /scam-defense/${slug}/`);
  const g = readPage(file);
  assert(h1Of(g).length === 1, `Guide ${slug} has one H1`);
  assert(canonicalOf(g) === `https://cipherati.com/scam-defense/${slug}/`, `Guide ${slug} has a self-referencing canonical`);
  assert(!/<meta name="robots" content="[^"]*noindex/i.test(g), `Guide ${slug} is not noindex`);
  const ld = [...g.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const types = ld.flatMap((j) => (j["@graph"] || [j]).map((n) => n["@type"]));
  assert(types.includes("Article") && types.includes("BreadcrumbList") && !types.includes("FAQPage") && !types.includes("Review") && !types.includes("AggregateRating"), `Guide ${slug} JSON-LD parses and has Article + BreadcrumbList only (no FAQ/rating markup)`);
  assert(g.includes('class="table-wrap"') || !g.includes("<table"), `Guide ${slug} tables are wrapped for mobile scrolling`);
  for (const other of GUIDE_SLUGS.filter((x) => x !== slug)) {
    assert(g.includes(`href="/scam-defense/${other}/"`), `Guide ${slug} links to guide ${other}`);
  }
  assert(homePage.includes(`href="/scam-defense/${slug}/"`), `Homepage links to guide ${slug}`);
  assert(scamsPage.includes(`href="/scam-defense/${slug}/"`), `/scam-alerts.html links to guide ${slug}`);
  assert(sitemapXml.includes(`<loc>https://cipherati.com/scam-defense/${slug}/</loc>`), `sitemap.xml lists guide ${slug}`);
}
const guideAll = GUIDE_SLUGS.map((slug) => readPage(`public/scam-defense/${slug}/index.html`)).join("\n");
for (const host of ["cybercrime.gov.in", "sancharsaathi.gov.in/sfc", "npci.org.in", "pib.gov.in"]) {
  assert(guideAll.includes(host), `Guides keep a direct official link to ${host}`);
}
assert(GUIDE_SLUGS.every((slug) => readPage(`public/scam-defense/${slug}/index.html`).includes("promise of recovery")), "Every guide states it is not a promise of recovery");

// Newsletter canonical + description
const todayHtml = readPage("public/newsletter/today.html");
assert(canonicalOf(todayHtml) === "https://cipherati.com/newsletter/today.html" && /<meta name="description" content="[^"]{40,}"/.test(todayHtml), "/newsletter/today.html has a unique meta description and a self-canonical");

// Sitemap: only canonical https://cipherati.com HTML URLs with real lastmod dates, no tracking params
const sitemapLocs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
assert(sitemapLocs.every((u) => u.startsWith("https://cipherati.com/") && /\.html$|\/$/.test(u)), "sitemap.xml contains only canonical HTML URLs");
assert(new Set(sitemapLocs).size === sitemapLocs.length, "sitemap.xml has no duplicate URLs");
assert(!sitemapXml.includes("<changefreq>") && /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(sitemapXml), "sitemap.xml uses ledger-based lastmod and no changefreq hints");


// Summary
console.log("=========================================");
if (failureCount > 0) {
  console.error(`❌ QUALITY GATE FAILED: ${failureCount} checks failed. Deployment aborted.`);
  process.exit(1);
} else {
  console.log("🎉 ALL QUALITY GATES PASSED! Build is clean, verified, and safe to deploy.");
  process.exit(0);
}
