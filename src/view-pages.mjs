// Builds the five public "app" pages (/, /ai-tools.html, /ai-realities.html, /cybersecurity-news.html,
// /scam-alerts.html) from the single app shell (src/shell/app.html).
//
// Each page keeps the shared chrome (sidebar, top bar, search, theme switch, install/alerts, footer, client script)
// but renders ONLY its own content section. Previously every URL carried the entire portal (all tools, news,
// realities and scams) with the other sections merely hidden with display:none.

const SITE_URL = "https://cipherati.com/";

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const SECTION_IDS = ["radar", "realities", "threats", "scams"];

export const PAGE_H1 = {
  home: "Build Better with AI. Stay Safer Online.",
  tools: "AI Developer Tools, Coding Agents and Local Models",
  realities: "AI Engineering Lessons from Production",
  news: "Cybersecurity News and Threat Intelligence",
  scams: "Cyber Scam Alerts and Practical Defense for India"
};

const VIEW_SECTION = { tools: "radar", realities: "realities", news: "threats", scams: "scams" };

function sectionBounds(page, id) {
  const re = new RegExp(`<section class="section-wrap" id="${id}"[^>]*>`);
  const m = re.exec(page);
  if (!m) return null;
  const start = m.index;
  const end = page.indexOf("</section>", start);
  if (end === -1) throw new Error(`Unclosed section #${id}`);
  const inner = page.slice(start + m[0].length, end);
  if (inner.includes("<section")) throw new Error(`Nested <section> inside #${id}; shell structure changed`);
  return { start, end: end + "</section>".length, openTag: m[0] };
}

function cutSection(page, id) {
  const b = sectionBounds(page, id);
  if (!b) return page;
  return page.slice(0, b.start) + page.slice(b.end);
}

function setHead(page, { canonicalUrl, title, description, keywords, view, jsonLdGraph }) {
  const canonicalTags = `<link rel="canonical" href="${esc(canonicalUrl)}" />${keywords ? `\n<meta name="keywords" content="${esc(keywords)}" />` : ""}`;
  const swap = (re, repl, label) => {
    if (!re.test(page)) throw new Error(`Shell head is missing ${label}`);
    page = page.replace(re, () => repl);
  };
  swap(/<link rel="canonical" href="[^"]*" \/>/, canonicalTags, "canonical");
  swap(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`, "title");
  swap(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(description)}" />`, "description");
  swap(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(title)}" />`, "og:title");
  swap(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(description)}" />`, "og:description");
  swap(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${esc(canonicalUrl)}" />`, "og:url");
  swap(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${esc(title)}" />`, "twitter:title");
  swap(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${esc(description)}" />`, "twitter:description");
  swap(/<meta name="cipherati-view" content="[^"]*" \/>/, `<meta name="cipherati-view" content="${view}" />`, "cipherati-view");
  const safe = JSON.stringify({ "@context": "https://schema.org", "@graph": jsonLdGraph }).replace(/</g, "\\u003c");
  swap(
    /<!-- JSONLD:BEGIN -->[\s\S]*?<!-- JSONLD:END -->/,
    `<!-- JSONLD:BEGIN -->\n<script type="application/ld+json">${safe}</script>\n<!-- JSONLD:END -->`,
    "JSON-LD block"
  );
  return page;
}

function dropOtherSections(page, keepId) {
  for (const id of SECTION_IDS) if (id !== keepId) page = cutSection(page, id);
  return page;
}

/** Realities / Cyber news / Scam alerts: keep only that section, make it visible, promote its title to the page H1. */
export function buildContentViewPage(shell, view, head, { footerHtml = "" } = {}) {
  const keepId = VIEW_SECTION[view];
  let page = setHead(shell, { ...head, view });
  page = dropOtherSections(page, keepId);
  const b = sectionBounds(page, keepId);
  if (!b) throw new Error(`Section #${keepId} missing from shell`);
  const visibleOpen = `<section class="section-wrap" id="${keepId}">`;
  let section = visibleOpen + page.slice(b.start + b.openTag.length, b.end - "</section>".length) + footerHtml + "</section>";
  // Promote the section title (<h2 class="section-title">⚡ 22 AI Realities</h2>) to the unique page H1.
  section = section.replace(/<h2 class="section-title">([^<]*)<\/h2>/, (_m, text) => {
    const emoji = (text.match(/^(\p{Extended_Pictographic}\uFE0F?)/u) || [])[1] || "";
    return `<h1 class="section-title"${emoji ? ` data-emoji="${emoji}"` : ""}>${esc(PAGE_H1[view])}</h1>`;
  });
  if (!section.includes("<h1")) throw new Error(`Could not promote H1 for view ${view}`);
  return page.slice(0, b.start) + section + page.slice(b.end);
}

/** /ai-tools.html: directory only. Shell hero, news ticker, ribbons, banner and newsletter are removed. */
export function buildToolsViewPage(shell, head, { categories = [], toolCount = 0, categoryCounts = {}, footerHtml = "" }) {
  let page = setHead(shell, { ...head, view: "tools" });
  page = dropOtherSections(page, "radar");
  const catLinks = categories
    .map(
      (c) =>
        `<li><a href="#tools/${encodeURIComponent(c)}">${esc(c)} <span class="count">(${categoryCounts[c] ?? 0})</span></a></li>`
    )
    .join("");
  const hero = `<div class="page-hero">
      <h1>${esc(PAGE_H1.tools)}</h1>
      <p>Browse ${toolCount} AI developer tools, coding agents, local-model runners and RAG frameworks. Each card opens Cipherati's own review page (trade-offs, privacy posture and alternatives); the official repository or product page is a labelled secondary link.</p>
      <nav aria-label="Browse AI tools by category"><ul class="cat-links">${catLinks}</ul></nav>
    </div>`;
  if (!/<!--HOME_HERO:BEGIN-->[\s\S]*?<!--HOME_HERO:END-->/.test(page)) throw new Error("Shell is missing HOME_HERO markers");
  page = page.replace(/<!--HOME_HERO:BEGIN-->[\s\S]*?<!--HOME_HERO:END-->/, () => hero);
  const b = sectionBounds(page, "radar");
  const inner = page.slice(b.start + b.openTag.length, b.end - "</section>".length);
  const visible = `<section class="section-wrap" id="radar">` + inner + footerHtml + "</section>";
  return page.slice(0, b.start) + visible + page.slice(b.end);
}

function featureLink(href, title, desc) {
  return `<li><a href="${esc(href)}"><strong>${esc(title)}</strong>${desc ? `<span>${esc(desc)}</span>` : ""}</a></li>`;
}

const short = (s, n = 140) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t;
};

/**
 * Homepage: balanced AI Engineering + Cybersecurity pillars, two CTAs from the growth pack, briefing section.
 * ctx = { featuredTools:[{name,tagline,href}], featuredRealities:[{title,href,summary}], guides:[{title,href,summary}],
 *         latestNews:[{title,href,source}], categories:[{name,count}], counts:{tools,realities,news,scams} }
 */
export function buildHomeViewPage(shell, head, ctx) {
  let page = setHead(shell, { ...head, view: "home" });
  page = dropOtherSections(page, "radar");

  const nl = page.match(/<!--NEWSLETTER:BEGIN-->[\s\S]*?<!--NEWSLETTER:END-->/);
  if (!nl) throw new Error("Shell is missing NEWSLETTER markers");

  const catLinks = ctx.categories
    .map((c) => `<li><a href="/ai-tools.html#tools/${encodeURIComponent(c.name)}">${esc(c.name)} <span class="count">(${c.count})</span></a></li>`)
    .join("");

  const homeHtml = `
    <section class="home-hero" aria-labelledby="home-h1">
      <h1 id="home-h1">${esc(PAGE_H1.home)}</h1>
      <p>Practical intelligence for people working with AI and navigating digital risk. Compare open-source tools, learn from production failures, recognise cyber scams and find clear incident-response steps.</p>
      <div class="home-cta-row">
        <a class="btn-cta" href="/ai-tools.html">Explore AI Tools →</a>
        <a class="btn-cta-alt" href="/scam-alerts.html">Get Cyber Scam Help →</a>
      </div>
      <p class="trust-strip">Original engineering notes • Official reporting links • Plain-English checklists • No hype</p>
    </section>

    <div class="home-stats">
      <a class="home-stat" href="/ai-tools.html"><strong id="stat-tools">${ctx.counts.tools}</strong><span>AI Tools</span></a>
      <a class="home-stat" href="/ai-realities.html"><strong id="stat-realities">${ctx.counts.realities}</strong><span>AI Realities</span></a>
      <a class="home-stat" href="/cybersecurity-news.html"><strong id="stat-news">${ctx.counts.news}</strong><span>Cyber News</span></a>
      <a class="home-stat" href="/scam-alerts.html"><strong id="stat-scams">${ctx.counts.scams}</strong><span>Scam Alerts</span></a>
    </div>

    <div class="pillar-grid">
      <section class="pillar-panel pillar-ai" aria-labelledby="pillar-ai-h">
        <span class="pillar-kicker">AI Engineering</span>
        <h2 id="pillar-ai-h">AI Tools, Without the Marketing Fog</h2>
        <p>Compare open-source AI tools, coding agents and local-model infrastructure through practical notes on deployment, privacy, limitations and alternatives.</p>
        <div class="pillar-links">
          <a href="/ai-tools.html">Explore the AI tools directory</a>
          <a href="/ai-realities.html">Read production AI lessons</a>
        </div>
        <h3 class="feature-heading">Featured tool reviews</h3>
        <ul class="feature-list">${ctx.featuredTools.map((t) => featureLink(t.href, t.name, short(t.tagline))).join("")}</ul>
        <h3 class="feature-heading">Production AI guides</h3>
        <ul class="feature-list">${ctx.featuredRealities.map((r) => featureLink(r.href, r.title, short(r.summary))).join("")}</ul>
        <h3 class="feature-heading">Browse tools by category</h3>
        <ul class="cat-links">${catLinks}</ul>
      </section>

      <section class="pillar-panel pillar-cyber" aria-labelledby="pillar-cyber-h">
        <span class="pillar-kicker">Cybersecurity</span>
        <h2 id="pillar-cyber-h">Recognise the Threat. Know the Next Step.</h2>
        <p>Source-backed guidance on digital arrest, UPI fraud, suspicious communications and emerging security incidents—without panic or jargon.</p>
        <div class="pillar-links">
          <a href="/scam-alerts.html">Read scam-defense guides</a>
          <a href="/cybersecurity-news.html">View verified cybersecurity news</a>
        </div>
        <h3 class="feature-heading">Scam-defense guides</h3>
        <ul class="feature-list">${ctx.guides.map((g) => featureLink(g.href, g.title, short(g.summary))).join("")}</ul>
        <h3 class="feature-heading">Latest verified cybersecurity news</h3>
        <ul class="feature-list">${ctx.latestNews.map((n) => featureLink(n.href, n.title, n.source ? `via ${n.source}` : "")).join("")}</ul>
      </section>
    </div>

    <section aria-labelledby="home-briefing-h">
      <h2 class="home-briefing-heading" id="home-briefing-h">AI and Cybersecurity, Without the Noise</h2>
      <p class="home-briefing-copy">One concise briefing covering useful AI engineering developments, important security incidents and the scam patterns readers need to recognise.</p>
      <a class="home-briefing-link" href="/newsletter/today.html">Read today’s briefing →</a>
      ${nl[0]}
    </section>
  `;

  const b = sectionBounds(page, "radar");
  if (!b) throw new Error("Section #radar missing from shell");
  return page.slice(0, b.start) + `<section class="section-wrap" id="radar">${homeHtml}</section>` + page.slice(b.end);
}

export { SITE_URL };
