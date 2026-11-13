// Static markup + SEO/GEO/AEO artifact publishing, mirroring the client render so
// crawlers, Googlebot, Bing/IndexNow, and LLM search engines (ChatGPT Search, Perplexity,
// Claude, Gemini AI Overviews) see 100%-visible dedicated pillar pages and rich Schema.org graphs.
// Imported by build-static.mjs and covered by test/verify-build.mjs.
import { readFileSync, writeFileSync } from "node:fs";
import { generateProgrammaticSeoPages, slugify } from "./programmatic-seo.mjs";
import { buildAppPages } from "./app-pages.mjs";
import { loadGuides, generateGuidePages } from "./guides.mjs";
import { createLedger } from "./lastmod-ledger.mjs";

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
export function publishSeoArtifacts(tools, updatedAt, shellPath = "./.build/app.html", extra = {}) {
  const ranked = [...tools].sort((a, b) => (b.rank || 0) - (a.rank || 0));

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

  // The five app pages are assembled from the shell by app-pages.mjs. Each renders only its own content
  // and carries only the JSON-LD that matches that content.
  const ledger = extra.ledger || createLedger();
  const guides = extra.guides || loadGuides();
  const buildDate = updatedAt.slice(0, 10);

  // Long-tail pages first: the hubs link to them (scam playbooks, comparisons, realities) so none are orphaned.
  const progSeo = generateProgrammaticSeoPages({ tools: ranked, scams, realities, updatedAt, guides, ledger });
  const guideUrls = generateGuidePages(guides, { ledger, buildDate });

  const scamPlaybooks = scams.map((x) => ({ title: x.title, href: `/scams/${progSeo.scamSlugMap.get(x.id || x.title)}.html` }));
  const comparisons = progSeo.comparisonPairs.map((p) => ({ title: `${p.a.name} vs ${p.b.name}`, href: `/compare/${p.compSlug}.html` }));
  const realityIndex = realities.map((r) => ({ title: `#${r.id} ${r.title}`, href: `/realities/${progSeo.realitySlugMap.get(r.id)}.html` }));

  const pages = buildAppPages({
    shellHtml: readFileSync(shellPath, "utf8"),
    ranked,
    realities,
    scams,
    threats,
    guides: guides.map((g) => ({ ...g, footerLabel: g.footerLabel })),
    orgNode,
    howToNode,
    scamFaqItems,
    newsArticleNodes,
    updatedAt,
    categories: extra.categories,
    scamPlaybooks,
    comparisons,
    realityIndex
  });
  for (const [name, content] of Object.entries(pages)) writeFileSync(`./public/${name}`, content, "utf8");

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

  // 5. Programmatic long-tail pages (/tools/*, /compare/*, /scams/*, /realities/*) and the scam-defense guides.

  // Sitemap: canonical, indexable HTML URLs only. lastmod comes from the content-hash ledger, so it only moves when
  // a page's substantive content changes (not on every build). changefreq/priority are omitted (ignored by Google).
  const hubStamp = (path, payload) => ledger.stamp(`${SITE_URL}${path}`, payload);
  const guideSlugs = guides.map((g) => g.slug);
  let briefingHtml = "";
  try { briefingHtml = readFileSync("./public/newsletter/today.html", "utf8"); } catch {}
  const sitemapUrls = [
    {
      loc: SITE_URL,
      lastmod: hubStamp("", {
        g: guideSlugs,
        n: threats.slice(0, 3).map((n) => n.id),
        r: realities.slice(0, 3).map((r) => r.id),
        t: ranked.slice(0, 40).map((t) => [t.name, t.tagline])
      })
    },
    { loc: `${SITE_URL}cybersecurity-news.html`, lastmod: hubStamp("cybersecurity-news.html", threats.map((n) => [n.id, n.title])) },
    { loc: `${SITE_URL}scam-alerts.html`, lastmod: hubStamp("scam-alerts.html", { s: scams.map((x) => [x.id, x.title, x.scam, x.protection]), g: guideSlugs }) },
    { loc: `${SITE_URL}ai-realities.html`, lastmod: hubStamp("ai-realities.html", realities.map((r) => [r.id, r.title, r.reality, r.fix])) },
    { loc: `${SITE_URL}ai-tools.html`, lastmod: hubStamp("ai-tools.html", ranked.map((t) => [t.name, t.slug, t.tagline, t.category])) },
    { loc: `${SITE_URL}newsletter/today.html`, lastmod: hubStamp("newsletter/today.html", briefingHtml) },
    ...progSeo.generatedUrls,
    ...guideUrls
  ];
  ledger.save();

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join("\n")}\n</urlset>\n`;
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
  console.log(`Rendered home + 4 pillar pages (each with only its own content), ${ranked.length} tool cards, ${guides.length} scam-defense guides + ${progSeo.counts.total} programmatic long-tail pages (${progSeo.counts.tools} tools, ${progSeo.counts.comparisons} comparisons, ${progSeo.counts.scams} scams, ${progSeo.counts.realities} realities). sitemap.xml now has ${sitemapUrls.length} URLs.`);
  return { sitemapUrls: sitemapUrls.map(u => u.loc), progSeo, guideUrls };
}
