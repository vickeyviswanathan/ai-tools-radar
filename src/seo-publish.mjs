// Static markup + SEO/GEO/AEO artifact publishing, mirroring the client render so
// crawlers, Googlebot, Bing/IndexNow, and LLM search engines (ChatGPT Search, Perplexity,
// Claude, Gemini AI Overviews) see 100%-visible dedicated pillar pages and rich Schema.org graphs.
// Imported by build-static.mjs and covered by test/verify-build.mjs.
import { readFileSync, writeFileSync } from "node:fs";

const SITE_URL = "https://cipherati.com/";
export const INDEXNOW_KEY = "c9426a40b7894f12a8e3d56c719204ef";

const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const BOILERPLATE_WHY = /verified GitHub stars\.$|upvotes on Hacker News\.$|likes on Hugging Face\.$|vetted for production\.$|real production users\.$|Community signal:|Indexed open-source|Editorially indexed/i;

const fmtCompact = (n) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

// Honest community traction note — never equates GitHub stars with production adoption.
export function signalWhySentence(source, metric) {
  const n = fmtCompact(metric || 0);
  if (source === "github") return `Community signal: ${n} GitHub stars (public repository popularity metric).`;
  if (source === "hn") return `Community signal: ${metric} Hacker News points.`;
  if (source === "huggingface") return `Community signal: ${n} Hugging Face likes.`;
  return "";
}

// Strip boilerplate star-repetition sentences so cards only show genuine architectural notes.
export function normalizeWhyItMatters(tools) {
  for (const t of tools) {
    if (t.why_it_matters && BOILERPLATE_WHY.test(t.why_it_matters)) {
      t.why_it_matters = "";
    }
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

function staticDecisionBadges(t) {
  let out = "";
  if (t.isRising) {
    const label = t.velocity >= 50 ? `🔥 +${t.velocity}/d` : `🔥 Rising`;
    out += `<span class="badge momentum">${label}</span>`;
  }
  if (t.isNew2026) {
    out += `<span class="badge new-2026">✨ New 2026</span>`;
  }
  return out;
}

function staticCard(t) {
  let domain = "";
  try { domain = new URL(t.url).hostname; } catch {}
  const icon = domain
    ? `<span class="icon-fallback">${esc(t.emoji || "⚡")}</span><img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64" alt="" loading="lazy" onload="const fb=this.parentElement.querySelector('.icon-fallback');if(fb)fb.style.display='none';" onerror="this.remove()" style="position:absolute;inset:0;margin:auto;" />`
    : esc(t.emoji || "⚡");
  const why = t.why_it_matters && !BOILERPLATE_WHY.test(t.why_it_matters)
    ? `<div class="why-box"><strong>Why it matters:</strong> ${esc(t.why_it_matters)}</div>` : "";
  return `<a class="tool-card" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">
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
          ${staticDecisionBadges(t)}
          ${staticSignals(t.signals)}
        </div>
      </a>`;
}

function buildPillarPageHtml(baseHtml, {
  slug,
  viewName,
  title,
  description,
  keywords,
  jsonLdGraph
}) {
  const canonicalUrl = `${SITE_URL}${slug}`;
  let page = baseHtml;

  // 1. Canonical URL, Title, Description, Keywords & OpenGraph/Twitter tags
  page = page.replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${esc(canonicalUrl)}" />\n<meta name="keywords" content="${esc(keywords)}" />`);
  page = page.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  page = page.replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(description)}" />`);
  page = page.replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(title)}" />`);
  page = page.replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(description)}" />`);
  page = page.replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${esc(canonicalUrl)}" />`);
  page = page.replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${esc(title)}" />`);
  page = page.replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${esc(description)}" />`);

  // 2. Make the target section 100% visible in static HTML (no display:none!) so Googlebot Mobile-First Indexer treats it as primary content
  if (viewName === "news") {
    page = page.replace('<section class="section-wrap" id="radar">', '<section class="section-wrap" id="radar" style="display: none;">');
    page = page.replace('<section class="section-wrap" id="threats" style="display: none;">', '<section class="section-wrap" id="threats">');
  } else if (viewName === "scams") {
    page = page.replace('<section class="section-wrap" id="radar">', '<section class="section-wrap" id="radar" style="display: none;">');
    page = page.replace('<section class="section-wrap" id="scams" style="display: none;">', '<section class="section-wrap" id="scams">');
  } else if (viewName === "realities") {
    page = page.replace('<section class="section-wrap" id="radar">', '<section class="section-wrap" id="radar" style="display: none;">');
    page = page.replace('<section class="section-wrap" id="realities" style="display: none;">', '<section class="section-wrap" id="realities">');
  }

  // 3. Set default client view so JS hydration preserves the active pillar view without overriding URL path
  page = page.replace('let currentView = "home";', `let currentView = "${viewName}";`);
  page = page.replace(
    'else if (hash === "#home" || !hash || hash === "#") {\n    switchView("home");',
    `else if (hash === "#home" || !hash || hash === "#") {\n    switchView("${viewName}");`
  );

  // 4. Inject page-specific JSON-LD Schema.org graph
  const safeJsonLd = JSON.stringify({ "@context": "https://schema.org", "@graph": jsonLdGraph }).replace(/</g, "\\u003c");
  page = page.replace(
    /<!-- JSONLD:BEGIN -->[\s\S]*?<!-- JSONLD:END -->/,
    `<!-- JSONLD:BEGIN -->\n<script type="application/ld+json">${safeJsonLd}</script>\n<!-- JSONLD:END -->`
  );

  return page;
}

// Ping IndexNow API (Bing, ChatGPT Search / OAI-SearchBot, Microsoft Copilot, Perplexity, Yandex)
export async function pingIndexNow(urls) {
  try {
    const payload = {
      host: "cipherati.com",
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_URL}${INDEXNOW_KEY}.txt`,
      urlList: urls
    };
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000)
    });
    console.log(`[SEO IndexNow] Pushed ${urls.length} URLs to IndexNow (Bing / ChatGPT Search / Perplexity) — HTTP ${res.status}`);
  } catch (err) {
    console.log(`[SEO IndexNow] Notice: IndexNow ping deferred (${err.message})`);
  }
}

// Inject static cards, full Schema.org JSON-LD, 4 dedicated SEO pillar pages, sitemap.xml, IndexNow key, and robots.txt.
export function publishSeoArtifacts(tools, updatedAt, indexPath = "./public/index.html", extra = {}) {
  const ranked = [...tools].sort((a, b) => (b.rank || 0) - (a.rank || 0));
  const cards = ranked.map(staticCard).join("\n      ");

  let threats = extra.threats || [];
  let scams = extra.scams || [];
  let realities = extra.realities || [];

  try {
    if (!threats.length) threats = JSON.parse(readFileSync("./public/data/threats.json", "utf8")).threats || [];
  } catch {}
  try {
    if (!scams.length) scams = JSON.parse(readFileSync("./public/data/scams.json", "utf8")).scams || [];
  } catch {}

  const orgNode = {
    "@type": "Organization",
    "@id": `${SITE_URL}#organization`,
    "name": "Cipherati",
    "url": SITE_URL,
    "logo": `${SITE_URL}icons/icon-512.png`,
    "sameAs": [
      "https://github.com/vickeyviswanathan/ai-tools-radar"
    ]
  };

  const howToNode = {
    "@type": "HowTo",
    "@id": `${SITE_URL}scam-alerts.html#howto-report-cybercrime`,
    "name": "How to Report Cyber Financial Fraud and Freeze Stolen Funds in India (1930 Golden Hour Protocol)",
    "description": "Emergency 4-step statutory cybercrime reporting protocol to freeze stolen bank/UPI funds within the Golden Hour under RBI, CERT-In, and I4C guidelines.",
    "step": [
      {
        "@type": "HowToStep",
        "position": 1,
        "name": "Call National Cyber Crime Helpline 1930 Immediately",
        "text": "Call 1930 (Toll-Free across India) or your bank's 24x7 fraud desk within 2 hours of an unauthorized UPI/bank transaction to trigger an immediate inter-bank freeze of the scammer's mule account."
      },
      {
        "@type": "HowToStep",
        "position": 2,
        "name": "Preserve Uncropped Digital Evidence",
        "text": "Capture uncropped screenshots of 12-digit UPI UTR numbers, bank SMS alerts, WhatsApp or Telegram chat logs, caller IDs, and malicious .apk files."
      },
      {
        "@type": "HowToStep",
        "position": 3,
        "name": "File Formal e-FIR on National Cyber Crime Reporting Portal",
        "text": "Register a formal complaint under Financial Fraud on https://cybercrime.gov.in and record your 14-digit Complaint Acknowledgement Number."
      },
      {
        "@type": "HowToStep",
        "position": 4,
        "name": "Submit Police Acknowledgement to Home Bank Branch within 24 Hours",
        "text": "Deliver a written dispute notice with the 1930 / cybercrime.gov.in acknowledgement receipt to your home bank branch within 24 hours to claim RBI zero-liability customer protection."
      }
    ]
  };

  // Build comprehensive FAQPage from all 19 verified Scam Alerts + top AI Engineering Realities
  const scamFaqItems = scams.map(s => ({
    "@type": "Question",
    "name": `What is ${s.title} (${s.tag || s.platform}) and how can I protect myself?`,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": `Modus Operandi (${s.platform}): ${s.scam} How to protect yourself: ${s.protection} (Verified by ${s.sourceName} — Emergency Helpline: Dial 1930 or visit ${s.actionUrl || "https://cybercrime.gov.in/"}).`
    }
  }));

  const realityFaqItems = realities.slice(0, 12).map(r => ({
    "@type": "Question",
    "name": `Why does "${r.title}" happen in production AI systems and how do engineers fix it?`,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": `The Vendor Myth: "${r.myth}" The Engineering Reality: ${r.reality} Production Fix: ${r.fix} Business Impact: ${r.impact} Recommended Open-Source Tools: ${(r.tools || []).map(t => t.name).join(", ")}.`
    }
  }));

  const newsArticleNodes = threats.slice(0, 16).map((item, idx) => ({
    "@type": "NewsArticle",
    "@id": `${SITE_URL}cybersecurity-news.html#${item.id || idx}`,
    "headline": item.title,
    "datePublished": item.date || updatedAt.slice(0, 10),
    "dateModified": item.date || updatedAt.slice(0, 10),
    "articleSection": item.entities || "Cybersecurity & Threat Intelligence",
    "description": item.incident || `${item.title} — Verified reporting via ${item.sourceName}.`,
    "author": {
      "@type": "Organization",
      "name": item.sourceName || "Cipherati Threat Desk"
    },
    "publisher": orgNode,
    "mainEntityOfPage": `${SITE_URL}cybersecurity-news.html`
  }));

  // Rich Schema.org Graph for Homepage combining WebSite, Organization, SiteNavigationElement, ItemList (Tools), ItemList (News), HowTo, and FAQPage
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      orgNode,
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}#website`,
        "url": SITE_URL,
        "name": "Cipherati — Cybersecurity News, Scam Alerts, AI Developer Tools & Production Realities",
        "alternateName": ["Cipherati", "Cipherati Radar", "Cipherati Cybersecurity & AI Intelligence"],
        "description": "Independent cybersecurity news desk, citizen scam defense playbooks (1930 helpline, digital arrest, APK malware, UPI fraud), 22 production AI engineering realities, and curated open-source AI developer tools.",
        "publisher": orgNode
      },
      {
        "@type": "ItemList",
        "@id": `${SITE_URL}#pillars`,
        "name": "Cipherati Intelligence Pillars",
        "itemListElement": [
          { "@type": "SiteNavigationElement", "position": 1, "name": "Cybersecurity News & Threat Intelligence", "url": `${SITE_URL}cybersecurity-news.html` },
          { "@type": "SiteNavigationElement", "position": 2, "name": "Scam Alerts & 1930 Citizen Cyber Defense", "url": `${SITE_URL}scam-alerts.html` },
          { "@type": "SiteNavigationElement", "position": 3, "name": "AI Engineering Realities in Production", "url": `${SITE_URL}ai-realities.html` },
          { "@type": "SiteNavigationElement", "position": 4, "name": "Curated AI Developer Tools & Coding Agents", "url": `${SITE_URL}ai-tools.html` },
          { "@type": "SiteNavigationElement", "position": 5, "name": "The Cipherati 60-Second Morning Briefing", "url": `${SITE_URL}newsletter/today.html` }
        ]
      },
      {
        "@type": "ItemList",
        "@id": `${SITE_URL}#cyber-news-list`,
        "name": "Live Cybersecurity News, RBI/CERT-In Directives, Breaches & Crypto Heists",
        "url": `${SITE_URL}cybersecurity-news.html`,
        "numberOfItems": newsArticleNodes.length,
        "itemListElement": newsArticleNodes.map((n, i) => ({
          "@type": "ListItem",
          "position": i + 1,
          "item": n
        }))
      },
      {
        "@type": "ItemList",
        "@id": `${SITE_URL}#tools`,
        "name": "Cipherati AI Developer Tools & Coding Agents Directory",
        "url": `${SITE_URL}ai-tools.html`,
        "numberOfItems": tools.length,
        "itemListElement": ranked.slice(0, 60).map((t, i) => {
          const isRepo = /github\.com/i.test(t.url);
          return {
            "@type": "ListItem",
            "position": i + 1,
            "item": isRepo ? {
              "@type": "SoftwareSourceCode",
              "name": t.name,
              "codeRepository": t.url,
              "url": t.url,
              "description": `${t.tagline} (${t.category})`,
              "dateModified": updatedAt.slice(0, 10)
            } : {
              "@type": "SoftwareApplication",
              "name": t.name,
              "url": t.url,
              "applicationCategory": t.category || "DeveloperApplication",
              "description": `${t.tagline} (${t.category})`
            }
          };
        })
      },
      howToNode,
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}#faq`,
        "mainEntity": [...scamFaqItems.slice(0, 12), ...realityFaqItems.slice(0, 8)]
      }
    ]
  };

  let html = readFileSync(indexPath, "utf8");
  html = html.replace(
    /<!-- PRERENDER:BEGIN -->[\s\S]*?<!-- PRERENDER:END -->/,
    `<!-- PRERENDER:BEGIN -->\n      ${cards}\n      <!-- PRERENDER:END -->`
  );
  const safeJsonLd = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  html = html.replace(
    /<!-- JSONLD:BEGIN -->[\s\S]*?<!-- JSONLD:END -->/,
    `<!-- JSONLD:BEGIN -->\n<script type="application/ld+json">${safeJsonLd}</script>\n<!-- JSONLD:END -->`
  );

  // Ensure semantic internal crawl links exist in the footer of index.html and all pillar pages
  const seoFooterNav = `<div class="seo-pillar-links" style="margin: 14px 0; display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; font-size: 13px; font-weight: 600;">
      <a href="./">Home</a> •
      <a href="./cybersecurity-news.html">Cybersecurity News</a> •
      <a href="./scam-alerts.html">Scam Alerts (1930 Helpline)</a> •
      <a href="./ai-realities.html">AI Realities in Production</a> •
      <a href="./ai-tools.html">AI Developer Tools Directory</a> •
      <a href="./newsletter/today.html">Today's Morning Briefing</a> •
      <a href="./feed.xml">RSS Feed</a> •
      <a href="./llms.txt">LLMs.txt</a> •
      <a href="./llms-full.txt">Full AI Knowledge Base</a>
    </div>`;

  if (html.includes('<div class="seo-pillar-links"')) {
    html = html.replace(/<div class="seo-pillar-links"[\s\S]*?<\/div>/, seoFooterNav);
  } else {
    html = html.replace(
      'Synced automatically from live open-source and global statutory feeds every 6 hours.',
      `Synced automatically from live open-source and global statutory feeds every 6 hours.\n    ${seoFooterNav}`
    );
  }

  if (!html.includes('href="./feed.xml"')) {
    html = html.replace(
      '<link rel="manifest" href="./manifest.json" />',
      '<link rel="manifest" href="./manifest.json" />\n<link rel="alternate" type="application/rss+xml" title="Cipherati — Cybersecurity News, Scam Alerts &amp; AI Intelligence RSS Feed" href="./feed.xml" />'
    );
  }

  writeFileSync(indexPath, html, "utf8");

  // Generate 4 Dedicated, 100%-Visible Static SEO Pillar Pages for Google & LLM Search Dominance
  // 1. /cybersecurity-news.html
  const cyberNewsPage = buildPillarPageHtml(html, {
    slug: "cybersecurity-news.html",
    viewName: "news",
    title: "Cybersecurity News India & Global Threat Intelligence — CERT-In, RBI BFSI Alerts, Ransomware & Crypto Heists | Cipherati",
    description: "Real-time verified cybersecurity news across Indian banking & fintech (RBI, CERT-In, I4C), enterprise ransomware breaches, critical zero-day CVEs, AI cyber threats, and global crypto heists.",
    keywords: "cybersecurity news, cybersecurity news India, CERT-In advisory, RBI cybersecurity directive, banking cyber attack India, ransomware news, crypto heist news, zero day vulnerability, AI cybersecurity threats, Cipherati",
    jsonLdGraph: [
      orgNode,
      {
        "@type": "CollectionPage",
        "@id": `${SITE_URL}cybersecurity-news.html#webpage`,
        "url": `${SITE_URL}cybersecurity-news.html`,
        "name": "Cybersecurity News India & Global Threat Intelligence — Cipherati",
        "description": "Verified cybersecurity news covering RBI/CERT-In directives, Indian banking & fintech security, global ransomware, and crypto exploits.",
        "isPartOf": { "@id": `${SITE_URL}#website` }
      },
      {
        "@type": "ItemList",
        "name": "Latest Verified Cybersecurity News Stories",
        "numberOfItems": newsArticleNodes.length,
        "itemListElement": newsArticleNodes.map((n, i) => ({ "@type": "ListItem", "position": i + 1, "item": n }))
      }
    ]
  });
  writeFileSync("./public/cybersecurity-news.html", cyberNewsPage, "utf8");

  // 2. /scam-alerts.html
  const scamAlertsPage = buildPillarPageHtml(html, {
    slug: "scam-alerts.html",
    viewName: "scams",
    title: "Scam Alerts India & Citizen Cyber Defense — 1930 Helpline, Digital Arrest Scam, e-Challan APK & UPI Fraud | Cipherati",
    description: "Verified citizen scam defense guide for India: how to spot and stop Digital Arrest police video calls, WhatsApp Wedding Card & Traffic e-Challan APK malware, wrong UPI transfer traps, fake IPO groups, and how to freeze stolen funds via 1930.",
    keywords: "scam alerts India, digital arrest scam, 1930 cyber crime helpline, cybercrime.gov.in reporting, e-challan APK scam, wedding card APK virus, wrong UPI transfer scam, FedEx customs parcel scam, Sanchar Saathi Chakshu, RBI Sachet",
    jsonLdGraph: [
      orgNode,
      howToNode,
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}scam-alerts.html#faq`,
        "mainEntity": scamFaqItems
      }
    ]
  });
  writeFileSync("./public/scam-alerts.html", scamAlertsPage, "utf8");

  // 3. /ai-realities.html
  const aiRealitiesPage = buildPillarPageHtml(html, {
    slug: "ai-realities.html",
    viewName: "realities",
    title: "AI Engineering Realities in Production — 22 Hard Truths on RAG, Coding Agents, Token Costs & LLM Architecture | Cipherati",
    description: "The unfiltered engineering truth on what breaks when AI meets production: 1M context window degradation, agent token cost bleed, fine-tuning vs hybrid RAG, prompt injection guardrails, and multi-agent runaway loops.",
    keywords: "AI engineering realities, production LLM failures, RAG vs fine-tuning, coding agent benchmarks, LLM token cost optimization, prompt injection defense, hybrid search BM25 vector database, enterprise AI architecture",
    jsonLdGraph: [
      orgNode,
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}ai-realities.html#faq`,
        "mainEntity": realities.map(r => ({
          "@type": "Question",
          "name": `Trap #${r.id}: ${r.title} — Why does "${r.myth}" fail in production?`,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": `Reality: ${r.reality} What Actually Works: ${r.fix} Business Impact: ${r.impact} Proven Tools: ${(r.tools || []).map(t => t.name).join(", ")}.`
          }
        }))
      }
    ]
  });
  writeFileSync("./public/ai-realities.html", aiRealitiesPage, "utf8");

  // 4. /ai-tools.html
  const aiToolsPage = buildPillarPageHtml(html, {
    slug: "ai-tools.html",
    viewName: "tools",
    title: `Best AI Developer Tools, Coding Agents, MCP Servers & Local LLMs Directory (${tools.length} Indexed Tools) | Cipherati`,
    description: `Curated, zero-affiliate directory of ${tools.length} open-source AI developer tools, terminal coding agents (Claude Code, Gemini CLI, Codex, Aider), local LLM runners (Ollama, vLLM, llama.cpp), and RAG frameworks.`,
    keywords: "best AI developer tools, AI coding agents, MCP servers, local LLMs, Ollama, vLLM, Claude Code, Gemini CLI, open source AI tools directory, RAG frameworks, cybersecurity AI tools",
    jsonLdGraph: [
      orgNode,
      {
        "@type": "ItemList",
        "@id": `${SITE_URL}ai-tools.html#directory`,
        "name": "Cipherati Curated AI Developer Tools Directory",
        "numberOfItems": tools.length,
        "itemListElement": ranked.slice(0, 100).map((t, i) => {
          const isRepo = /github\.com/i.test(t.url);
          return {
            "@type": "ListItem",
            "position": i + 1,
            "item": isRepo ? {
              "@type": "SoftwareSourceCode",
              "name": t.name,
              "codeRepository": t.url,
              "url": t.url,
              "description": `${t.tagline} — ${t.why_it_matters || ""}`,
              "dateModified": updatedAt.slice(0, 10)
            } : {
              "@type": "SoftwareApplication",
              "name": t.name,
              "url": t.url,
              "applicationCategory": t.category || "DeveloperApplication",
              "description": `${t.tagline} — ${t.why_it_matters || ""}`
            }
          };
        })
      }
    ]
  });
  writeFileSync("./public/ai-tools.html", aiToolsPage, "utf8");

  // Write static IndexNow key verification file for Bing / ChatGPT Search / Perplexity / Copilot
  writeFileSync(`./public/${INDEXNOW_KEY}.txt`, INDEXNOW_KEY, "utf8");

  // Generate standard RSS 2.0 feed (/feed.xml) for Google News, Feedly, and AI news aggregators
  const rssItems = [
    ...threats.slice(0, 16).map(t => ({
      title: `[Cyber News] ${t.title}`,
      link: `${SITE_URL}cybersecurity-news.html#${t.id || ""}`,
      guid: `${SITE_URL}cybersecurity-news.html#${t.id || t.title}`,
      pubDate: t.pubDate || new Date(updatedAt).toUTCString(),
      description: `${t.incident || t.title} (Source: ${t.sourceName} · Sector: ${t.entities || "Cybersecurity"})`,
      category: "Cybersecurity News"
    })),
    ...scams.slice(0, 10).map(s => ({
      title: `[Scam Alert] ${s.title} (${s.platform})`,
      link: `${SITE_URL}scam-alerts.html#${s.id}`,
      guid: `${SITE_URL}scam-alerts.html#${s.id}`,
      pubDate: new Date(updatedAt).toUTCString(),
      description: `Trap: ${s.scam} | Defense Rule: ${s.protection} (Verified by ${s.sourceName} · Emergency Helpline: 1930)`,
      category: "Scam Defense"
    })),
    ...realities.slice(0, 10).map((r, idx) => ({
      title: `[AI Reality #${r.id}] ${r.title}`,
      link: `${SITE_URL}ai-realities.html#reality-${idx}`,
      guid: `${SITE_URL}ai-realities.html#reality-${idx}`,
      pubDate: new Date(updatedAt).toUTCString(),
      description: `Vendor Myth: "${r.myth}" | Reality: ${r.reality} | Production Fix: ${r.fix}`,
      category: "AI Engineering Realities"
    }))
  ];

  const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Cipherati — Cybersecurity News, Scam Alerts, AI Developer Tools &amp; Production Realities</title>
    <link>${SITE_URL}</link>
    <description>Independent cybersecurity news desk, 1930 citizen scam defense playbooks, 22 production AI engineering realities, and ${tools.length} verified open-source AI developer tools.</description>
    <language>en-in</language>
    <lastBuildDate>${new Date(updatedAt).toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}feed.xml" rel="self" type="application/rss+xml" />
${rssItems.map(item => `    <item>
      <title>${esc(item.title)}</title>
      <link>${esc(item.link)}</link>
      <guid isPermaLink="false">${esc(item.guid)}</guid>
      <pubDate>${esc(item.pubDate)}</pubDate>
      <category>${esc(item.category)}</category>
      <description>${esc(item.description)}</description>
    </item>`).join("\n")}
  </channel>
</rss>
`;
  writeFileSync("./public/feed.xml", feedXml, "utf8");

  const lastmod = updatedAt.slice(0, 10);
  const sitemapUrls = [
    { loc: `${SITE_URL}`, changefreq: "hourly", priority: "1.0" },
    { loc: `${SITE_URL}cybersecurity-news.html`, changefreq: "hourly", priority: "0.95" },
    { loc: `${SITE_URL}scam-alerts.html`, changefreq: "daily", priority: "0.95" },
    { loc: `${SITE_URL}ai-realities.html`, changefreq: "daily", priority: "0.90" },
    { loc: `${SITE_URL}ai-tools.html`, changefreq: "daily", priority: "0.90" },
    { loc: `${SITE_URL}newsletter/today.html`, changefreq: "daily", priority: "0.85" },
    { loc: `${SITE_URL}feed.xml`, changefreq: "hourly", priority: "0.85" },
    { loc: `${SITE_URL}llms.txt`, changefreq: "daily", priority: "0.80" },
    { loc: `${SITE_URL}llms-full.txt`, changefreq: "daily", priority: "0.80" }
  ];

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join("\n")}\n</urlset>\n`;
  writeFileSync("./public/sitemap.xml", sitemapXml, "utf8");

  // Modern robots.txt explicitly welcoming all major search and generative AI engines
  const robotsTxt = `User-agent: *
Allow: /

# Explicitly permit AI Crawlers, Answer Engines & LLM Agents
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Bytespider
Allow: /

User-agent: CCBot
Allow: /

User-agent: cohere-ai
Allow: /

# AI Manifest & Knowledge Base
Allow: /llms.txt
Allow: /llms-full.txt

Sitemap: ${SITE_URL}sitemap.xml
`;
  writeFileSync("./public/robots.txt", robotsTxt, "utf8");
  console.log(`Pre-rendered ${ranked.length} tool cards into index.html + 4 dedicated SEO pillar pages (/cybersecurity-news.html, /scam-alerts.html, /ai-realities.html, /ai-tools.html), full Schema.org JSON-LD, sitemap.xml (8 URLs), and IndexNow key.`);
}
