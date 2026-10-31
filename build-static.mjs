// Builds static data/tools.json for GitHub Pages deployment
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { getDb, now, getMeta } from "./src/db.mjs";
import { runIngestion } from "./src/ingest.mjs";
import { evaluateQuality } from "./src/quality.mjs";
import { refreshLiveMetrics } from "./src/live-metrics.mjs";
import { publishSeoArtifacts, normalizeWhyItMatters } from "./src/seo-publish.mjs";
import { getLiveCyberNews } from "./src/news-sync.mjs";
import { validateAndSanitizeScams, generateScamsHtml } from "./src/scam-guard.mjs";

async function build() {
  if (process.env.FULL_INGEST === "true" || process.env.GITHUB_EVENT_NAME === "schedule") {
    console.log("Ingesting latest top-tier tools via full scraper...");
    await runIngestion();
    console.log("Refreshing live stars and likes via GitHub & HuggingFace APIs...");
    await refreshLiveMetrics();
  } else {
    console.log("Fast build mode: using current curated tool database.");
  }

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

  // Safeguard-validated Scam Intelligence
  const sanitizedScams = validateAndSanitizeScams();
  const scamsOutput = {
    updatedAt: output.updatedAt,
    scams: sanitizedScams
  };
  writeFileSync("./public/data/scams.json", JSON.stringify(scamsOutput, null, 2), "utf-8");

  syncToolCountsInHtml(tools);
  updateThreatsInHtml(threatCategories, liveThreats);
  updateScamsInHtml(sanitizedScams);

  publishSeoArtifacts(tools, output.updatedAt);
  generateLlmsTxt(tools, sanitizedScams);
  console.log(`[Gate] Dropped ${rejectedAtBuild.length} stored entries at build time:\n  ` + rejectedAtBuild.join("\n  "));
  console.log(`Generated public/data/tools.json with ${tools.length} curated tools across ${categories.length} categories.`);
  console.log(`Generated public/data/threats.json with ${liveThreats.length} verified threat intelligence records.`);
  console.log(`Generated public/data/scams.json with ${sanitizedScams.length} verified scam defense playbooks.`);
}

function updateThreatsInHtml(categories, threats) {
  const indexPath = "./public/index.html";
  let html = readFileSync(indexPath, "utf8");

  const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function generateCardsHtml(items) {
    return items.map(item => {
      const severityClass = item.severity === "critical" ? "threat-sev-critical" : item.severity === "high" ? "threat-sev-high" : "threat-sev-medium";
      const impactBadgeHtml = item.impactBadge ? `<span class="threat-badge threat-badge-impact">${esc(item.impactBadge)}</span>` : "";

      return `    <article class="threat-card" data-category="${esc(item.category)}" id="threat-${esc(item.id)}">
      <div class="threat-top-bar">
        <div class="threat-badge-group">
          ${impactBadgeHtml}
          <span class="threat-badge threat-sev ${severityClass}">${item.severity.toUpperCase()}</span>
          <span class="threat-badge threat-prov threat-prov-${esc(item.badgeType)}">${esc(item.provenanceBadge)}</span>
        </div>
        <button class="share-btn" type="button" title="Share cybersecurity news" aria-label="Share news" onclick="shareThreat('${esc(item.id)}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>
        </button>
      </div>

      <h3 class="threat-title">
        <a href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">
          ${esc(item.title)} <span class="threat-ext-icon">↗</span>
        </a>
      </h3>

      <div class="threat-entities-row">
        <span class="threat-entity-label">Sector / Domain:</span>
        <span class="threat-entity-value">${esc(item.entities)}</span>
      </div>

      <div class="threat-breakdown">
        <div class="threat-point point-incident">
          <strong>Wire Report Summary</strong>
          ${esc(item.incident)}
        </div>
      </div>

      <div class="threat-footer-row">
        <div class="threat-source-pill">
          <span class="threat-source-icon">📌</span>
          <span class="threat-source-name">${esc(item.sourceName)}</span>
          <span class="threat-ref">${esc(item.ref)}</span>
        </div>
        <a class="threat-verify-btn" href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">
          Read on ${esc(item.sourceName)} ↗
        </a>
      </div>
    </article>`;
    }).join("\n\n");
  }

  html = html.replace(/<span class="tab-count" id="tab-threats-count">\d+<\/span>/, `<span class="tab-count" id="tab-threats-count">${threats.length}</span>`);
  html = html.replace(/<span class="side-nav-pill" id="side-threats-count">\d+<\/span>/, `<span class="side-nav-pill" id="side-threats-count">${threats.length}</span>`);
  html = html.replace(/<div class="hero-metric-num" id="stat-news">\d+<\/div>/, `<div class="hero-metric-num" id="stat-news">${threats.length}</div>`);
  html = html.replace(/<span class="reality-count-pill" id="threat-count-badge">[^<]+<\/span>/, `<span class="reality-count-pill" id="threat-count-badge">Showing all ${threats.length} verified news stories</span>`);
  html = html.replace(/let THREATS_DATA = \\[[\\s\\S]*?\\];/, `let THREATS_DATA = ${JSON.stringify(threats)};`);

  const heroNewsRegex = /<div class="hero-news-list" id="hero-live-news-list">[\s\S]*?<\/div>\s*<\/div>\s*<div class="hero-news-footer">/;
  if (heroNewsRegex.test(html) && threats.length) {
    const picked = threats.slice(0, 4);
    const heroItemsHtml = picked.map(item => {
      const rawTag = (item.sourceName || item.impactBadge || "Live Wire").replace(/\.com$/i, "").trim();
      const shortTag = rawTag.length > 16 ? rawTag.slice(0, 15) + "…" : rawTag;
      return `            <div class="hero-news-item" onclick="jumpToThreatStory('${esc(item.id)}')" title="Click to view story in Cyber News">
              <span class="hero-news-item-title">${esc(item.title)}</span>
              <span class="hero-news-tag">${esc(shortTag)}</span>
            </div>`;
    }).join("\n");
    html = html.replace(heroNewsRegex, `<div class="hero-news-list" id="hero-live-news-list">\n${heroItemsHtml}\n          </div>\n        </div>\n        <div class="hero-news-footer">`);
  }

  const containerStartTag = '<div class="threat-cards-grid" id="threats-container">';
  const startIdx = html.indexOf(containerStartTag);
  if (startIdx !== -1) {
    const emptyStateIdx = html.indexOf('<div class="threat-empty-state"', startIdx);
    const endSectionIdx = html.indexOf('</section>', startIdx);
    const searchLimit = emptyStateIdx !== -1 ? emptyStateIdx : endSectionIdx;
    const containerClosingDiv = html.lastIndexOf('</div>', searchLimit);
    if (containerClosingDiv > startIdx) {
      const beforeContainer = html.slice(0, startIdx + containerStartTag.length);
      const afterContainer = html.slice(containerClosingDiv);
      const newCardsHtml = "\n" + generateCardsHtml(threats) + "\n    ";
      html = beforeContainer + newCardsHtml + afterContainer;
    }
  }

  writeFileSync(indexPath, html, "utf8");
}

function updateScamsInHtml(scams) {
  const indexPath = "./public/index.html";
  let html = readFileSync(indexPath, "utf8");

  html = html.replace(/<span class="tab-count" id="tab-scams-count">\d*<\/span>/, `<span class="tab-count" id="tab-scams-count">${scams.length}</span>`);
  html = html.replace(/<span class="reality-count-pill" id="scam-count-badge">[^<]+<\/span>/, `<span class="reality-count-pill" id="scam-count-badge">Showing all ${scams.length} verified scam alerts</span>`);

  const containerStartTag = '<div class="scam-grid" id="scams-container">';
  const startIdx = html.indexOf(containerStartTag);
  if (startIdx !== -1) {
    const emptyStateIdx = html.indexOf('<div id="scam-empty-state"', startIdx);
    const endSectionIdx = html.indexOf('</section>', startIdx);
    const searchLimit = emptyStateIdx !== -1 ? emptyStateIdx : endSectionIdx;
    const containerClosingDiv = html.lastIndexOf('</div>', searchLimit);
    if (containerClosingDiv > startIdx) {
      const beforeContainer = html.slice(0, startIdx + containerStartTag.length);
      const afterContainer = html.slice(containerClosingDiv);
      const newCardsHtml = "\n" + generateScamsHtml(scams) + "\n    ";
      html = beforeContainer + newCardsHtml + afterContainer;
    }
  }

  writeFileSync(indexPath, html, "utf8");
}

build().catch(console.error);

function syncToolCountsInHtml(tools) {
  const indexPath = "./public/index.html";
  let html = readFileSync(indexPath, "utf8");
  html = html.replace(/<strong id="stat-tools">\d+<\/strong>/, `<strong id="stat-tools">${tools.length}</strong>`);
  html = html.replace(/<span class="tab-count" id="tab-tools-count">\d*<\/span>/, `<span class="tab-count" id="tab-tools-count">${tools.length}</span>`);
  writeFileSync(indexPath, html, "utf8");
}

function generateLlmsTxt(tools, scams) {
  const SITE_URL = "https://cipherati.com/";
  
  const llmsCompact = `# Cipherati
> An open, curated directory of battle-tested AI developer tools, coding agents, and local models — with direct links, production realities, verified cybersecurity news, and citizen scam defense.

- Website: https://cipherati.com/
- National Cyber Crime Helpline (India): 1930
- Official Cybercrime Reporting Portal: https://cybercrime.gov.in/
- Spam Reporting (Chakshu): https://sancharsaathi.gov.in/

## Core Sections
- [Curated Tools Directory](https://cipherati.com/#tools): ${tools.length} production-ready developer tools, coding agents, and local model infrastructure.
- [AI Realities in Production](https://cipherati.com/#realities): 18 hard truths and traps when deploying AI agents and LLMs.
- [Cybersecurity News](https://cipherati.com/#news): 15 verified reporting stories across banking, enterprise defense, and critical CVEs.
- [Scam Alerts & Citizen Defense](https://cipherati.com/#scams): ${scams.length} verified playbooks against digital arrest, APK malware, and financial fraud.

## Emergency Cyber Crime Reporting (Golden Hour Protocol)
If funds are unauthorizedly debited or someone is targeted by online fraud:
1. **Immediate Call (Golden Hour)**: Dial 1930 or contact bank fraud desk within 2 hours to freeze stolen money before ATM withdrawal.
2. **Preserve Evidence**: Save screenshots of transaction UTR numbers, WhatsApp chats, fake APK files, and phone logs.
3. **Register e-FIR**: File a formal financial fraud complaint on https://cybercrime.gov.in.
4. **Notify Bank Branch**: Submit complaint acknowledgement receipt to home bank branch within 24 hours to secure RBI zero-liability protection.

## Key 2026 Citizen Scam Defense Rules
- **Digital Arrest**: Indian law has NO concept of 'Digital Arrest'. Police, CBI, ED, and customs never conduct interrogations or place citizens under arrest via Skype or WhatsApp video call.
- **WhatsApp Wedding Cards / Traffic Fines (APKs)**: Genuine wedding cards are images or PDFs; genuine traffic fines are viewed on echallan.parivahan.gov.in. Never install any file ending in .apk sent via chat or SMS.
- **Accidental UPI Transfer**: Never send money back directly via UPI. The incoming funds are stolen; sending money flags your account as a criminal mule. Direct the caller to their bank.
- **Fake IPO WhatsApp Groups**: SEBI-registered brokerages never conduct institutional IPO bidding or accept investments via WhatsApp groups or personal accounts.

## Top Curated AI Developer Tools
${tools.slice(0, 30).map(t => `- [${t.name}](${t.url}): ${t.tagline}`).join("\n")}

For complete listings and full data exports, visit https://cipherati.com/llms-full.txt or https://cipherati.com/data/tools.json.
`;
  writeFileSync("./public/llms.txt", llmsCompact, "utf-8");

  const llmsFull = `# Cipherati Full Knowledge Digest & LLM System Prompt Context
Website: https://cipherati.com/
Publisher: Cipherati Intelligence Desk

## About Cipherati
Cipherati is an independent, practitioner-grade radar of battle-tested AI developer tools, coding agents, and production systems — combined with real-time cybersecurity news, statutory threat provenance, and citizen scam defense intelligence. Zero vendor hype.

---

## 1. Curated AI Developer Tools Directory (${tools.length} Tools)

${tools.map((t, idx) => `### ${idx + 1}. ${t.name}
- URL: ${t.url}
- Category: ${t.category}
- Tagline: ${t.tagline}
- Why it matters: ${t.why_it_matters || "Verified open-source production utility."}
`).join("\n")}

---

## 2. Citizen Scam Defense Playbooks (${scams.length} Verified Modus Operandi)

${scams.map((s, idx) => `### Scam #${idx + 1}: ${s.title}
- Platform: ${s.platform || "Digital"}
- Severity: ${(s.severity || "high").toUpperCase()}
- The Trap: ${s.scam}
- Defense Rule: ${s.protection}
- Statutory Authority: ${s.sourceName} (${s.sourceUrl})
`).join("\n")}

---

## 3. Emergency Golden Hour Protocol for Financial Fraud
1. Call 1930 (National Cyber Crime Helpline) within 2 hours.
2. Screenshot all chats, transaction reference numbers (UTR), and caller IDs.
3. Submit e-FIR on https://cybercrime.gov.in.
4. Deliver dispute letter with complaint acknowledgement to your bank branch within 24 hours.
`;
  writeFileSync("./public/llms-full.txt", llmsFull, "utf-8");
  console.log(`Generated public/llms.txt and public/llms-full.txt (${tools.length} tools, ${scams.length} scams).`);
}
