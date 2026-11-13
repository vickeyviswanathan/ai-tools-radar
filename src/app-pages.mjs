// Assembles the five app pages (home + four pillar pages) from the shell HTML.
// Pure function: takes data, returns { "index.html": html, "ai-tools.html": html, ... } (no file I/O).
import { buildHomeViewPage, buildToolsViewPage, buildContentViewPage, PAGE_H1, esc } from "./view-pages.mjs";
import { slugify, buildToolSlugMap } from "./programmatic-seo.mjs";

const SITE_URL = "https://cipherati.com/";

const BOILERPLATE_WHY = /verified GitHub stars\.$|upvotes on Hacker News\.$|likes on Hugging Face\.$|vetted for production\.$|real production users\.$|Community signal:|Indexed open-source|Editorially indexed/i;

function staticSignals(signals = []) {
  return signals.map((s) => {
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
  if (t.isNew2026) out += `<span class="badge new-2026">✨ New 2026</span>`;
  return out;
}

/** Server-rendered tool card: Cipherati review link first, official URL as a labelled secondary link. */
export function staticCard(t) {
  let domain = "";
  try { domain = new URL(t.url).hostname; } catch {}
  const icon = domain
    ? `<span class="icon-fallback">${esc(t.emoji || "⚡")}</span><img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&amp;sz=64" alt="" width="22" height="22" loading="lazy" style="position:absolute;inset:0;margin:auto;" />`
    : esc(t.emoji || "⚡");
  const why = t.why_it_matters && !BOILERPLATE_WHY.test(t.why_it_matters)
    ? `<div class="why-box"><strong>Why it matters:</strong> ${esc(t.why_it_matters)}</div>` : "";
  return `<article class="tool-card">
        <div class="tool-top">
          <div class="tool-icon">${icon}</div>
          <div style="flex: 1; min-width: 0;">
            <div class="tool-name"><a class="tool-card-link" href="/tools/${esc(t.slug)}.html">${esc(t.name)}</a></div>
            <p class="tool-tag">${esc(t.tagline)}</p>
          </div>
        </div>
        ${why}
        <div class="tool-meta">
          <div class="tool-meta-badges">
            <span class="badge cat">${esc(t.category)}</span>
            ${staticDecisionBadges(t)}
            ${staticSignals(t.signals)}
          </div>
          <div class="tool-meta-links"><a class="tool-ext" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">Official source ↗</a></div>
        </div>
      </article>`;
}

const TOP_PICK_CATEGORIES = ["Coding", "Models & Infra", "Agents & Automation"];

function pickFeaturedTools(ranked) {
  const picks = [];
  for (const cat of TOP_PICK_CATEGORIES) {
    const t = ranked.find(
      (x) => x.category === cat && x.why_it_matters && !BOILERPLATE_WHY.test(x.why_it_matters) && x.why_it_matters.length > 40
    );
    if (t) picks.push({ name: t.name, tagline: t.why_it_matters || t.tagline, href: `/tools/${t.slug}.html` });
  }
  return picks;
}

function seoFooterNav(guides) {
  return `<div class="seo-pillar-links" style="margin: 14px 0; display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; font-size: 13px; font-weight: 600;">
      <a href="./">Home</a> •
      <a href="./ai-tools.html">AI Developer Tools Directory</a> •
      <a href="./ai-realities.html">AI Realities in Production</a> •
      <a href="./cybersecurity-news.html">Cybersecurity News</a> •
      <a href="./scam-alerts.html">Scam Alerts (1930 Helpline)</a> •
${guides.map((g) => `      <a href="${g.path}">${esc(g.footerLabel || g.title)}</a> •`).join("\n")}
      <a href="./newsletter/today.html">Today's Morning Briefing</a> •
      <a href="./feed.xml">RSS Feed</a> •
      <a href="./llms.txt">LLMs.txt</a> •
      <a href="./llms-full.txt">Full AI Knowledge Base</a>
    </div>`;
}

function guidesBlock(guides, playbooks = []) {
  return `<div class="guides-box">
      <h2 class="guides-heading">In-depth scam-defense guides</h2>
      <ul class="feature-list">${guides
        .map((g) => `<li><a href="${esc(g.path)}"><strong>${esc(g.title)}</strong><span>${esc(g.excerpt)}</span></a></li>`)
        .join("")}</ul>
    </div>
    ${
      playbooks.length
        ? `<div class="guides-box">
      <h2 class="guides-heading">Full playbook for each scam pattern</h2>
      <ul class="cat-links">${playbooks.map((p) => `<li><a href="${esc(p.href)}">${esc(p.title)}</a></li>`).join("")}</ul>
    </div>
    `
        : ""
    }`;
}

function realitiesBlock(items = []) {
  if (!items.length) return "";
  return `
    <section class="guides-box" aria-labelledby="reality-index-h">
      <h2 class="guides-heading" id="reality-index-h">Full post-mortem for every reality</h2>
      <ul class="cat-links">${items.map((r) => `<li><a href="${esc(r.href)}">${esc(r.title)}</a></li>`).join("")}</ul>
    </section>
  `;
}

function comparisonsBlock(comparisons = []) {
  if (!comparisons.length) return "";
  return `
    <section class="guides-box" aria-labelledby="compare-index-h">
      <h2 class="guides-heading" id="compare-index-h">Head-to-head tool comparisons</h2>
      <ul class="cat-links">${comparisons.map((c) => `<li><a href="${esc(c.href)}">${esc(c.title)}</a></li>`).join("")}</ul>
    </section>
  `;
}

export function buildAppPages(ctx) {
  const { shellHtml, ranked, realities, scams, threats, guides, orgNode, howToNode, scamFaqItems, newsArticleNodes, updatedAt } = ctx;

  // Slugs: shared with /tools/ pages so every card links to a page that exists.
  const slugMap = buildToolSlugMap(ranked);
  for (const t of ranked) t.slug = t.slug || slugMap.get(t.name);

  const cards = ranked.map(staticCard).join("\n      ");
  let html = shellHtml.replace(
    /<!-- PRERENDER:BEGIN -->[\s\S]*?<!-- PRERENDER:END -->/,
    () => `<!-- PRERENDER:BEGIN -->\n      ${cards}\n      <!-- PRERENDER:END -->`
  );

  const footer = seoFooterNav(guides);
  html = html.includes('<div class="seo-pillar-links"')
    ? html.replace(/<div class="seo-pillar-links"[\s\S]*?<\/div>/, () => footer)
    : html.replace(
        "Synced automatically from live open-source and global statutory feeds every 6 hours.",
        () => `Synced automatically from live open-source and global statutory feeds every 6 hours.\n    ${footer}`
      );
  if (!html.includes('href="./feed.xml"')) {
    html = html.replace(
      '<link rel="manifest" href="./manifest.json" />',
      () => '<link rel="manifest" href="./manifest.json" />\n<link rel="alternate" type="application/rss+xml" title="Cipherati — Cybersecurity News, Scam Alerts &amp; AI Intelligence RSS Feed" href="./feed.xml" />'
    );
  }

  const categories = ctx.categories?.length ? ctx.categories : [...new Set(ranked.map((t) => t.category))];
  const categoryCounts = {};
  for (const t of ranked) categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;

  const toolItemList = (limit, withWhy) => ({
    "@type": "ItemList",
    "@id": `${SITE_URL}ai-tools.html#directory`,
    "name": "Cipherati Curated AI Developer Tools Directory",
    "numberOfItems": ranked.length,
    "itemListElement": ranked.slice(0, limit).map((t, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": t.name,
      "url": `${SITE_URL}tools/${t.slug}.html`
    }))
  });

  const pages = {};

  pages["ai-tools.html"] = buildToolsViewPage(
    html,
    {
      canonicalUrl: `${SITE_URL}ai-tools.html`,
      title: `Best AI Developer Tools, Coding Agents, MCP Servers & Local LLMs Directory (${ranked.length} Indexed Tools) | Cipherati`,
      description: `Curated, zero-affiliate directory of ${ranked.length} open-source AI developer tools, terminal coding agents (Claude Code, Gemini CLI, Codex, Aider), local LLM runners (Ollama, vLLM, llama.cpp), and RAG frameworks.`,
      keywords: "best AI developer tools, AI coding agents, MCP servers, local LLMs, Ollama, vLLM, Claude Code, Gemini CLI, open source AI tools directory, RAG frameworks, cybersecurity AI tools",
      jsonLdGraph: [
        orgNode,
        { "@type": "CollectionPage", "@id": `${SITE_URL}ai-tools.html#webpage`, "url": `${SITE_URL}ai-tools.html`, "name": PAGE_H1.tools, "isPartOf": { "@id": `${SITE_URL}#website` } },
        toolItemList(100)
      ]
    },
    { categories, toolCount: ranked.length, categoryCounts, footerHtml: comparisonsBlock(ctx.comparisons) }
  );

  pages["ai-realities.html"] = buildContentViewPage(html, "realities", {
    canonicalUrl: `${SITE_URL}ai-realities.html`,
    title: "AI Engineering Realities in Production — 22 Hard Truths on RAG, Coding Agents, Token Costs & LLM Architecture | Cipherati",
    description: "The unfiltered engineering truth on what breaks when AI meets production: 1M context window degradation, agent token cost bleed, fine-tuning vs hybrid RAG, prompt injection guardrails, and multi-agent runaway loops.",
    keywords: "AI engineering realities, production LLM failures, RAG vs fine-tuning, coding agent benchmarks, LLM token cost optimization, prompt injection defense, hybrid search BM25 vector database, enterprise AI architecture",
    jsonLdGraph: [
      orgNode,
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}ai-realities.html#faq`,
        "mainEntity": realities.map((r) => ({
          "@type": "Question",
          "name": `Trap #${r.id}: ${r.title} — Why does "${r.myth}" fail in production?`,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": `Reality: ${r.reality} What Actually Works: ${r.fix} Business Impact: ${r.impact} Proven Tools: ${(r.tools || []).map((t) => t.name).join(", ")}.`
          }
        }))
      }
    ]
  }, { footerHtml: realitiesBlock(ctx.realityIndex) });

  pages["cybersecurity-news.html"] = buildContentViewPage(html, "news", {
    canonicalUrl: `${SITE_URL}cybersecurity-news.html`,
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

  let scamPage = buildContentViewPage(html, "scams", {
    canonicalUrl: `${SITE_URL}scam-alerts.html`,
    title: "Scam Alerts India & Citizen Cyber Defense — 1930 Helpline, Digital Arrest Scam, e-Challan APK & UPI Fraud | Cipherati",
    description: "Verified citizen scam defense guide for India: how to spot and stop Digital Arrest police video calls, WhatsApp Wedding Card & Traffic e-Challan APK malware, wrong UPI transfer traps, fake IPO groups, and how to freeze stolen funds via 1930.",
    keywords: "scam alerts India, digital arrest scam, 1930 cyber crime helpline, cybercrime.gov.in reporting, e-challan APK scam, wedding card APK virus, wrong UPI transfer scam, FedEx customs parcel scam, Sanchar Saathi Chakshu, RBI Sachet",
    jsonLdGraph: [
      orgNode,
      howToNode,
      { "@type": "FAQPage", "@id": `${SITE_URL}scam-alerts.html#faq`, "mainEntity": scamFaqItems }
    ]
  });
  const scamFilterMarker = "<!-- Scam Categories & Search Filter -->";
  if (!scamPage.includes(scamFilterMarker)) throw new Error("Scam filter marker missing from shell");
  scamPage = scamPage.replace(scamFilterMarker, () => `${guidesBlock(guides, ctx.scamPlaybooks)}\n    ${scamFilterMarker}`);
  pages["scam-alerts.html"] = scamPage;

  pages["index.html"] = buildHomeViewPage(
    html,
    {
      canonicalUrl: SITE_URL,
      title: "AI Tools & Cybersecurity: Practical Guides | Cipherati",
      description: "Compare AI tools, coding agents and local models. Learn to spot cyber scams, respond to fraud and follow verified security guidance with Cipherati.",
      jsonLdGraph: [
        orgNode,
        {
          "@type": "WebSite",
          "@id": `${SITE_URL}#website`,
          "url": SITE_URL,
          "name": "Cipherati",
          "description": "Practical AI engineering guidance and verified cybersecurity and scam-defense guidance for India.",
          "publisher": { "@id": `${SITE_URL}#organization` }
        },
        {
          "@type": "ItemList",
          "@id": `${SITE_URL}#pillars`,
          "name": "Cipherati sections",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": PAGE_H1.tools, "url": `${SITE_URL}ai-tools.html` },
            { "@type": "ListItem", "position": 2, "name": PAGE_H1.realities, "url": `${SITE_URL}ai-realities.html` },
            { "@type": "ListItem", "position": 3, "name": PAGE_H1.news, "url": `${SITE_URL}cybersecurity-news.html` },
            { "@type": "ListItem", "position": 4, "name": PAGE_H1.scams, "url": `${SITE_URL}scam-alerts.html` },
            { "@type": "ListItem", "position": 5, "name": "The Cipherati Briefing", "url": `${SITE_URL}newsletter/today.html` }
          ]
        }
      ]
    },
    {
      featuredTools: pickFeaturedTools(ranked),
      featuredRealities: realities.slice(0, 3).map((r) => ({ title: r.title, href: `/realities/${slugify(r.title)}.html`, summary: r.reality })),
      guides: guides.map((g) => ({ title: g.title, href: g.path, summary: g.excerpt })),
      latestNews: (threats || []).slice(0, 3).map((n) => ({ title: n.title, href: `/cybersecurity-news.html#threat-${n.id}`, source: n.sourceName })),
      categories: categories.map((name) => ({ name, count: categoryCounts[name] || 0 })),
      counts: { tools: ranked.length, realities: realities.length, news: (threats || []).length, scams: scams.length }
    }
  );

  return pages;
}
