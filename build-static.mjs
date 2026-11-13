// Builds static data/tools.json for GitHub Pages deployment
import { writeFileSync, readFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import path from "node:path";
import { getDb, now, getMeta, tx } from "./src/db.mjs";
import { runIngestion } from "./src/ingest.mjs";
import { evaluateQuality } from "./src/quality.mjs";
import { refreshLiveMetrics } from "./src/live-metrics.mjs";
import { publishSeoArtifacts, normalizeWhyItMatters, pingIndexNow } from "./src/seo-publish.mjs";
import { buildToolSlugMap } from "./src/programmatic-seo.mjs";
import { getLiveCyberNews } from "./src/news-sync.mjs";
import { validateAndSanitizeScams, generateScamsHtml } from "./src/scam-guard.mjs";
import { REALITIES_DATA } from "./src/realities-data.mjs";
import { generateDailyBriefing } from "./src/newsletter-generator.mjs";
import { dispatchDailyNewsletter } from "./src/newsletter-dispatcher.mjs";
import { dispatchCriticalThreatPush } from "./src/push-dispatcher.mjs";
import { FEATURED_LEADERS } from "./src/featured.mjs";
import { canonicalKey, categorize, clip } from "./src/classify.mjs";

function seedFeaturedLeaders() {
  const currentTs = now();
  tx((d) => {
    try {
      d.exec(`ALTER TABLE items ADD COLUMN why_it_matters TEXT;`);
    } catch {}
    // Purge non-AI legacy OSINT tool and clear boilerplate star-equating why_it_matters strings
    d.prepare(`DELETE FROM items WHERE url LIKE '%sherlock-project/sherlock%' OR name = 'Sherlock'`).run();
    d.prepare(`UPDATE items SET why_it_matters = NULL WHERE why_it_matters LIKE '%production users%' OR why_it_matters LIKE '%verified GitHub stars%' OR why_it_matters LIKE '%vetted for production%'`).run();
    d.prepare(`UPDATE items SET tagline = REPLACE(tagline, 'battle-tested', 'widely used') WHERE tagline LIKE '%battle-tested%'`).run();
    const upsertItem = d.prepare(`
      INSERT INTO items (key, name, tagline, url, emoji, category, tags, why_it_matters, launched_at, first_seen, last_seen, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      ON CONFLICT(key) DO UPDATE SET
        name = excluded.name,
        last_seen = excluded.last_seen,
        tagline = excluded.tagline,
        emoji = COALESCE(items.emoji, excluded.emoji),
        category = COALESCE(items.category, excluded.category),
        tags = COALESCE(items.tags, excluded.tags),
        why_it_matters = COALESCE(excluded.why_it_matters, items.why_it_matters)
      RETURNING id
    `);
    const upsertSignal = d.prepare(`
      INSERT INTO signals (item_id, source, source_id, source_url, metric, extra, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(item_id, source) DO UPDATE SET
        metric = MAX(signals.metric, excluded.metric),
        updated_at = excluded.updated_at
    `);
    for (const item of FEATURED_LEADERS) {
      const key = canonicalKey(item.url);
      const category = item.category || categorize(`${item.name} ${item.tagline || ""} ${(item.tags || []).join(" ")}`);
      const row = upsertItem.get(
        key,
        clip(item.name, 60),
        clip(item.tagline, 200),
        item.url,
        item.emoji || null,
        category,
        JSON.stringify(item.tags || []),
        item.whyItMatters || null,
        item.launchedAt || currentTs,
        currentTs,
        currentTs
      );
      if (row && row.id) {
        upsertSignal.run(row.id, item.source, item.sourceId, item.sourceUrl, item.metric, "{}", currentTs);
      }
    }

    // Hydrate from committed public/data/tools.json when running on a fresh CI runner (where data/radar.db is ephemeral)
    if (existsSync("./public/data/tools.json")) {
      try {
        const snapshot = JSON.parse(readFileSync("./public/data/tools.json", "utf8"));
        for (const t of snapshot.tools || []) {
          if (!t.url || !t.name) continue;
          const key = canonicalKey(t.url);
          const category = t.category || categorize(`${t.name} ${t.tagline || ""}`);
          const row = upsertItem.get(
            key,
            clip(t.name, 60),
            clip(t.tagline || "", 200),
            t.url,
            t.emoji || null,
            category,
            "[]",
            t.why_it_matters || null,
            t.launched_at || currentTs,
            currentTs,
            currentTs
          );
          if (row && row.id && Array.isArray(t.signals)) {
            for (const sigStr of t.signals) {
              const [src, val] = String(sigStr).split(":");
              const metric = Number(val) || 0;
              if (src && metric > 0) {
                const sourceId = /github\.com\/([^/]+\/[^/]+)/i.exec(t.url)?.[1] || key;
                upsertSignal.run(row.id, src, sourceId, t.url, metric, "{}", currentTs);
              }
            }
          }
        }
      } catch (e) {
        console.warn("[Seed] Could not hydrate from public/data/tools.json:", e.message);
      }
    }
  });
}

// The app shell (src/shell/app.html) is the source template for all five app pages. The build mutates a working
// copy (.build/app.html, git-ignored) with live data, then app-pages.mjs renders each public page from it.
const SHELL_PATH = "./src/shell/app.html";
const WORK_HTML = "./.build/app.html";

// CIPHERATI_LOCAL=1: safe local build. No IndexNow ping, no newsletter/push dispatch,
// no live link health-check and no live news fetch (uses the committed data instead).
const LOCAL_BUILD = process.env.CIPHERATI_LOCAL === "1";

async function build() {
  mkdirSync("./.build", { recursive: true });
  copyFileSync(SHELL_PATH, WORK_HTML);
  seedFeaturedLeaders();
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
           GROUP_CONCAT(s.source || ':' || s.metric, ',') as signal_summary,
           MAX(COALESCE(s.velocity, 0)) as max_velocity
    FROM items i
    LEFT JOIN signals s ON s.item_id = i.id
    WHERE i.status = 'active'
    GROUP BY i.id
  `).all().map(r => {
    const signals = (r.signal_summary || "").split(",").filter(Boolean);
    const rank = rankOf(signals);
    const launchedAt = Number(r.launched_at) || 0;
    const isNew2026 = launchedAt >= 1767225600; // 2026-01-01T00:00:00Z
    const velocity = Number(r.max_velocity) || 0;
    const isRising = velocity >= 50 || (Number(r.score) >= 35 && rank >= 2500);
    const { max_velocity, ...cleanRow } = r;
    return { ...cleanRow, signals, rank, velocity, isRising, isNew2026, repo: repoOf.get(r.id) || null };
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
    const inCat = deduped.filter(t => t.category === cat);
    const sorted = inCat.sort((a, b) => b.rank - a.rank);
    const topRanked = sorted.slice(0, 35);
    // Guarantee hand-curated and featured leaders are never dropped by category cutoff
    for (const item of inCat) {
      if (item.signals && item.signals.some(s => s.startsWith("app:"))) {
        if (!topRanked.some(t => t.id === item.id)) {
          topRanked.push(item);
        }
      }
    }

    tools.push(...topRanked.map(({ repo, signal_summary, ...rest }) => rest));
  }

  // Canonical URL overrides for moved/closed upstream repositories
  const URL_OVERRIDES = {
    "TTS": "https://github.com/coqui-ai/TTS",
    "CosyVoice": "https://github.com/FunAudioLLM/CosyVoice",
    "memobase": "https://github.com/memodb-io/memobase",
    "LLaVA": "https://github.com/haotian-liu/LLaVA",
    "Pixelle Video": "https://github.com/AIDC-AI/Pixelle-Video",
    "ComfyUI LTXVideo": "https://github.com/Lightricks/ComfyUI-LTXVideo",
    "paperless ngx": "https://docs.paperless-ngx.com/",
    "claude mem": "https://github.com/thedotmack/claude-mem"
  };

  console.log(`[Health Check] Auditing ${tools.length} tool links for dead/404 URLs...`);
  const verifiedTools = [];
  const linkCheckBatches = [];
  const batchSize = 25;
  for (let i = 0; i < tools.length; i += batchSize) {
    linkCheckBatches.push(tools.slice(i, i + batchSize));
  }

  for (const batch of linkCheckBatches) {
    await Promise.all(batch.map(async (tool) => {
      // 1. Apply URL override if known moved/closed repository
      if (URL_OVERRIDES[tool.name]) {
        tool.url = URL_OVERRIDES[tool.name];
      }
      // 2. Force secure https
      if (tool.url && tool.url.startsWith("http://")) {
        tool.url = tool.url.replace(/^http:\/\//, "https://");
      }

      // 3. Fast HEAD / reachability check
      let reachable = true;
      if (LOCAL_BUILD) { verifiedTools.push(tool); return; }
      try {
        const res = await fetch(tool.url, {
          method: "HEAD",
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          redirect: "follow",
          signal: AbortSignal.timeout(4000)
        });
        if (res.status >= 400 && res.status !== 401 && res.status !== 403 && res.status !== 405 && res.status !== 429) {
          reachable = false;
        }
      } catch (err) {
        if (err.message && (err.message.includes("ENOTFOUND") || err.message.includes("ECONNREFUSED"))) {
          reachable = false;
        }
      }

      if (reachable) {
        verifiedTools.push(tool);
      } else {
        console.warn(`[Health Check] Dropped non-working tool link: ${tool.name} (${tool.url})`);
      }
    }));
  }

  console.log(`[Health Check] Verified tools: ${verifiedTools.length} active (dropped ${tools.length - verifiedTools.length} dead links).`);

  // Review-page slug per tool, assigned once and written into tools.json so the directory cards link to /tools/<slug>.html.
  const slugOrder = [...verifiedTools].sort((a, b) => (b.rank || 0) - (a.rank || 0));
  const toolSlugs = buildToolSlugMap(slugOrder);
  for (const t of verifiedTools) t.slug = toolSlugs.get(t.name);

  const output = {
    updatedAt: new Date().toISOString(),
    categories,
    tools: normalizeWhyItMatters(verifiedTools)
  };

  mkdirSync("./public/data", { recursive: true });
  writeFileSync("./public/data/tools.json", JSON.stringify(output, null, 2), "utf-8");
  
  let threatCategories, liveThreats;
  if (LOCAL_BUILD) {
    const prevThreats = JSON.parse(readFileSync("./public/data/threats.json", "utf8"));
    threatCategories = prevThreats.categories;
    liveThreats = prevThreats.threats;
  } else {
    ({ categories: threatCategories, threats: liveThreats } = await getLiveCyberNews());
  }
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

  syncCountsInHtml(output.tools, REALITIES_DATA, liveThreats, sanitizedScams);
  updateThreatsInHtml(threatCategories, liveThreats);
  updateScamsInHtml(sanitizedScams);
  updateRealitiesInHtml(REALITIES_DATA);
  const briefing = generateDailyBriefing();
  updateBriefingInHtml(briefing);

  const seoResult = publishSeoArtifacts(output.tools, output.updatedAt, WORK_HTML, {
    threats: liveThreats,
    scams: sanitizedScams,
    realities: REALITIES_DATA
  });
  generateLlmsTxt(output.tools, sanitizedScams, liveThreats, REALITIES_DATA);
  if (!LOCAL_BUILD) await pingIndexNow(seoResult?.sitemapUrls || [
    "https://cipherati.com/",
    "https://cipherati.com/cybersecurity-news.html",
    "https://cipherati.com/scam-alerts.html",
    "https://cipherati.com/ai-realities.html",
    "https://cipherati.com/ai-tools.html",
    "https://cipherati.com/newsletter/today.html",
    "https://cipherati.com/feed.xml",
    "https://cipherati.com/llms.txt",
    "https://cipherati.com/llms-full.txt"
  ]);
  console.log(`[Gate] Dropped ${rejectedAtBuild.length} stored entries at build time:\n  ` + rejectedAtBuild.join("\n  "));
  console.log(`Generated public/data/tools.json with ${output.tools.length} curated tools across ${categories.length} categories.`);
  console.log(`Generated public/data/threats.json with ${liveThreats.length} verified threat intelligence records.`);
  console.log(`Generated public/data/scams.json with ${sanitizedScams.length} verified scam defense playbooks.`);

  // Automated Dispatch Pipelines (Resend Email & OneSignal Web Push)
  if (!LOCAL_BUILD) {
    await dispatchDailyNewsletter();
    await dispatchCriticalThreatPush();
  }
}

function updateThreatsInHtml(categories, threats) {
  const indexPath = WORK_HTML;
  let html = readFileSync(indexPath, "utf8");

  // Strictly sort reverse-chronological (newest first)
  const sortedThreats = [...(threats || [])].sort((a, b) => {
    const tA = a.timestamp || new Date(a.pubDate || a.date || 0).getTime();
    const tB = b.timestamp || new Date(b.pubDate || b.date || 0).getTime();
    return tB - tA;
  });

  const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function generateCardsHtml(items) {
    return items.map(item => {
      const severityClass = item.severity === "critical" ? "threat-sev-critical" : item.severity === "high" ? "threat-sev-high" : "threat-sev-medium";
      const impactBadgeHtml = item.impactBadge ? `<span class="threat-badge threat-badge-impact">${esc(item.impactBadge)}</span>` : "";

      const incidentHtml = (item.incident && item.incident.trim() && item.incident.trim() !== item.title.trim() + "." && !item.incident.startsWith(item.title))
        ? `      <div class="threat-breakdown">
        <div class="threat-point point-incident">
          <strong>Key Context</strong>
          ${esc(item.incident)}
        </div>
      </div>`
        : "";

      return `    <article class="threat-card" data-category="${esc(item.category)}" id="threat-${esc(item.id)}">
      <div class="threat-top-bar">
        <div class="threat-badge-group">
          ${impactBadgeHtml}
          <span class="threat-badge threat-sev ${severityClass}">${item.severity.toUpperCase()}</span>
          <span class="threat-badge threat-prov threat-prov-${esc(item.badgeType)}">${esc(item.provenanceBadge)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="threat-meta-time">
            <span class="threat-date">${esc(item.date)}</span>
            <span class="threat-sep">·</span>
            <span class="threat-ago">${esc(item.timeAgo)}</span>
          </div>
          <button class="share-btn" type="button" title="Share cybersecurity news" aria-label="Share news" onclick="shareThreat('${esc(item.id)}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>
          </button>
        </div>
      </div>

      <h3 class="threat-title">
        <a href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">
          ${esc(item.title)} <span class="threat-ext-icon">↗</span>
        </a>
      </h3>

      <div class="threat-entities-row">
        <span class="threat-entity-label">Sector:</span>
        <span class="threat-entity-value">${esc(item.entities)}</span>
      </div>
${incidentHtml}
      <div class="threat-footer-row">
        <div class="threat-source-pill">
          <span class="threat-source-icon">📌</span>
          <span class="threat-source-name">${esc(item.sourceName)}</span>
        </div>
        <a class="threat-verify-btn" href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">
          Read on ${esc(item.sourceName)} ↗
        </a>
      </div>
    </article>`;
    }).join("\n\n");
  }

  html = html.replace(/<span class="tab-count" id="tab-threats-count">\d+<\/span>/, `<span class="tab-count" id="tab-threats-count">${sortedThreats.length}</span>`);
  html = html.replace(/<span class="side-nav-pill" id="side-threats-count">\d+<\/span>/, `<span class="side-nav-pill" id="side-threats-count">${sortedThreats.length}</span>`);
  html = html.replace(/<div class="hero-metric-num" id="stat-news">\d+<\/div>/, `<div class="hero-metric-num" id="stat-news">${sortedThreats.length}</div>`);
  html = html.replace(/<span class="reality-count-pill" id="threat-count-badge">[^<]+<\/span>/, `<span class="reality-count-pill" id="threat-count-badge">Showing all ${sortedThreats.length} news stories</span>`);
  const safeJson = (obj, space) => JSON.stringify(obj, null, space).replace(/</g, "\\u003c");
  html = html.replace(/let THREATS_DATA = \[[\s\S]*?\];/, `let THREATS_DATA = ${safeJson(sortedThreats)};`);

  if (categories && categories.length) {
    const subtabsHtml = categories.map((cat, idx) => {
      const activeClass = idx === 0 ? " active" : "";
      return `        <button type="button" class="threat-tab-btn${activeClass}" data-cat="${esc(cat.id)}" onclick="selectThreatCategory('${esc(cat.id)}', this)">${esc(cat.label)} (${cat.count})</button>`;
    }).join("\n");
    html = html.replace(/<div class="threat-subtabs" id="threat-subtabs">[\s\S]*?<\/div>/, `<div class="threat-subtabs" id="threat-subtabs">\n${subtabsHtml}\n      </div>`);
  }

  html = html.replace(/Verified Global &amp; Indian News (?:Wires|Sources)/g, "Global &amp; Indian Primary News Sources");
  html = html.replace(/Verified Global & Indian News (?:Wires|Sources)/g, "Global & Indian Primary News Sources");

  const heroNewsRegex = /<div class="hero-news-list" id="hero-live-news-list">[\s\S]*?<\/div>\s*<\/div>\s*<div class="hero-news-footer">/;
  if (heroNewsRegex.test(html) && sortedThreats.length) {
    const picked = sortedThreats.slice(0, 4);
    const heroItemsHtml = picked.map(item => {
      const rawTag = (item.sourceName || item.impactBadge || "News").replace(/\.com$/i, "").trim();
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
      const newCardsHtml = "\n" + generateCardsHtml(sortedThreats) + "\n    ";
      html = beforeContainer + newCardsHtml + afterContainer;
    }
  }

  writeFileSync(indexPath, html, "utf8");
}

function updateScamsInHtml(scams) {
  const indexPath = WORK_HTML;
  let html = readFileSync(indexPath, "utf8");

  html = html.replace(/<span class="tab-count" id="tab-scams-count">\d*<\/span>/, `<span class="tab-count" id="tab-scams-count">${scams.length}</span>`);
  html = html.replace(/<span class="reality-count-pill" id="scam-count-badge">[^<]+<\/span>/, `<span class="reality-count-pill" id="scam-count-badge">Showing all ${scams.length} scam alerts</span>`);
  html = html.replace(/let SCAMS_DATA = \[[\s\S]*?\];/, `let SCAMS_DATA = ${JSON.stringify(scams).replace(/</g, "\\u003c")};`);

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

export function generateRealitiesCardsHtml(realities) {
  const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  return realities.map((r, idx) => {
    const toolsHtml = (r.tools || []).map(t =>
      `          <a class="tool-chip" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">${esc(t.name)} ↗</a>`
    ).join("\n");

    return `      <!-- ${r.id}. ${r.title} -->
      <div class="reality-card" id="reality-${idx}" data-category="${esc(r.category)}" data-id="${r.id}">
        <div class="reality-header-bar">
          <div class="reality-category-badge">${esc(r.category)} · Trap #${r.id}</div>
          <button type="button" class="share-btn" onclick="shareRealityCard(${idx})" title="Share AI reality" aria-label="Share AI reality">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>
          </button>
        </div>
        <h3 class="reality-title">${r.id}. ${esc(r.title)}</h3>
        <div class="myth-box"><strong>The Vendor Pitch:</strong> &quot;${esc(r.myth)}&quot;</div>
        <p class="reality-body">${esc(r.reality)}</p>
        <div class="truth-box"><strong>What Actually Works:</strong> ${esc(r.fix)}</div>
        <div class="impact-box"><strong>Business Impact:</strong> ${esc(r.impact)}</div>
        <div class="tools-row">
          <span class="tools-label">Proven Tools:</span>
${toolsHtml}
        </div>
      </div>`;
  }).join("\n\n");
}

function updateRealitiesInHtml(realities) {
  const indexPath = WORK_HTML;
  let html = readFileSync(indexPath, "utf8");

  // 1. Update static card grid
  const containerStartTag = '<div class="reality-grid" id="reality-grid">';
  const startIdx = html.indexOf(containerStartTag);
  if (startIdx !== -1) {
    const emptyStateIdx = html.indexOf('<div id="reality-empty-state"', startIdx);
    const endSectionIdx = html.indexOf('</section>', startIdx);
    const searchLimit = emptyStateIdx !== -1 ? emptyStateIdx : endSectionIdx;
    const containerClosingDiv = html.lastIndexOf('</div>', searchLimit);
    if (containerClosingDiv > startIdx) {
      const beforeContainer = html.slice(0, startIdx + containerStartTag.length);
      const afterContainer = html.slice(containerClosingDiv);
      const newCardsHtml = "\n" + generateRealitiesCardsHtml(realities) + "\n    ";
      html = beforeContainer + newCardsHtml + afterContainer;
    }
  }

  // 2. Update inline JavaScript data array
  const scriptRegex = /const REALITIES_DATA = \[[\s\S]*?\];\s*\n\s*let realitySearchQ/;
  if (scriptRegex.test(html)) {
    html = html.replace(scriptRegex, `const REALITIES_DATA = ${JSON.stringify(realities, null, 2).replace(/</g, "\\u003c")};\n\nlet realitySearchQ`);
  }

  writeFileSync(indexPath, html, "utf8");
}

function updateBriefingInHtml(briefing) {
  const indexPath = WORK_HTML;
  let html = readFileSync(indexPath, "utf8");
  html = html.replace(/let BRIEFING_DATA = (?:\{[\s\S]*?\}|null);/, `let BRIEFING_DATA = ${JSON.stringify(briefing).replace(/</g, "\\u003c")};`);
  writeFileSync(indexPath, html, "utf8");
}

build().catch((err) => {
  console.error("❌ Fatal error in build-static.mjs:", err);
  process.exit(1);
});

function syncCountsInHtml(tools, realities, threats, scams) {
  const indexPath = WORK_HTML;
  let html = readFileSync(indexPath, "utf8");
  html = html.replace(/<div class="hero-metric-num" id="stat-tools">\d+<\/div>/, `<div class="hero-metric-num" id="stat-tools">${tools.length}</div>`);
  html = html.replace(/<span class="tab-count" id="tab-tools-count">\d*<\/span>/, `<span class="tab-count" id="tab-tools-count">${tools.length}</span>`);
  html = html.replace(/<span class="side-nav-pill" id="side-tools-count">\d*<\/span>/, `<span class="side-nav-pill" id="side-tools-count">${tools.length}</span>`);
  html = html.replace(/<div class="hero-metric-num" id="stat-realities">\d+<\/div>/, `<div class="hero-metric-num" id="stat-realities">${realities.length}</div>`);
  html = html.replace(/<span class="tab-count" id="tab-realities-count">\d*<\/span>/, `<span class="tab-count" id="tab-realities-count">${realities.length}</span>`);
  html = html.replace(/<span class="side-nav-pill" id="side-realities-count">\d*<\/span>/, `<span class="side-nav-pill" id="side-realities-count">${realities.length}</span>`);
  html = html.replace(/<div class="hero-metric-num" id="stat-news">\d+<\/div>/, `<div class="hero-metric-num" id="stat-news">${threats.length}</div>`);
  html = html.replace(/<span class="side-nav-pill" id="side-threats-count">\d*<\/span>/, `<span class="side-nav-pill" id="side-threats-count">${threats.length}</span>`);
  html = html.replace(/<div class="hero-metric-num" id="stat-scams">\d+<\/div>/, `<div class="hero-metric-num" id="stat-scams">${scams.length}</div>`);
  html = html.replace(/<span class="side-nav-pill" id="side-scams-count">\d*<\/span>/, `<span class="side-nav-pill" id="side-scams-count">${scams.length}</span>`);
  writeFileSync(indexPath, html, "utf8");
}

function generateLlmsTxt(tools, scams, threats = [], realities = []) {
  const SITE_URL = "https://cipherati.com/";
  
  const llmsCompact = `# Cipherati
> Independent cybersecurity news desk, citizen scam defense playbooks (1930 helpline, digital arrest, APK malware, UPI fraud), 22 production AI engineering realities, and ${tools.length} open-source AI developer tools.

- Website: https://cipherati.com/
- Cybersecurity News Desk: https://cipherati.com/cybersecurity-news.html
- Scam Alerts & 1930 Citizen Defense: https://cipherati.com/scam-alerts.html
- UPI Fraud: What to Do Immediately in India: https://cipherati.com/scam-defense/upi-fraud-what-to-do/
- Digital Arrest Scam in India: https://cipherati.com/scam-defense/digital-arrest-scam-india/
- How to Report a Scam Call in India (Chakshu & 1930): https://cipherati.com/scam-defense/report-scam-call-india/
- AI Engineering Realities in Production: https://cipherati.com/ai-realities.html
- AI Developer Tools Directory: https://cipherati.com/ai-tools.html
- Daily 60-Second Morning Briefing: https://cipherati.com/newsletter/today.html
- National Cyber Crime Helpline (India): 1930
- Official Cybercrime Reporting Portal: https://cybercrime.gov.in/
- Spam Reporting (Chakshu): https://sancharsaathi.gov.in/

## Core Sections & Canonical Pages
- [Cybersecurity News](https://cipherati.com/cybersecurity-news.html): ${threats.length || 16} verified reporting stories across Indian banking/BFSI (RBI, CERT-In), enterprise defense, and global crypto heists.
- [Scam Alerts & Citizen Defense](https://cipherati.com/scam-alerts.html): ${scams.length} verified playbooks against digital arrest, e-Challan/wedding card APK malware, and UPI financial fraud.
- [AI Realities in Production](https://cipherati.com/ai-realities.html): ${realities.length || 22} hard engineering truths and architecture fixes when deploying AI agents, RAG, and LLMs.
- [Curated AI Developer Tools Directory](https://cipherati.com/ai-tools.html): ${tools.length} production-ready developer tools, coding agents, and local model infrastructure.

## Latest Verified Cybersecurity News
${threats.slice(0, 10).map(t => `- **${t.title}** (${t.sourceName}, ${t.date || "2026"}): ${t.incident || "Verified cybersecurity reporting."}`).join("\n")}

## Emergency Cyber Crime Reporting (Golden Hour Protocol)
If funds are unauthorizedly debited or someone is targeted by online fraud:
1. **Immediate Call (Golden Hour)**: Dial 1930 or contact bank fraud desk within 2 hours to freeze stolen money before ATM withdrawal.
2. **Preserve Evidence**: Save screenshots of transaction UTR numbers, WhatsApp chats, fake APK files, and phone logs.
3. **Register e-FIR**: File a formal financial fraud complaint on https://cybercrime.gov.in.
4. **Notify Bank Branch**: Submit complaint acknowledgement receipt to home bank branch within 24 hours to secure RBI zero-liability protection.

## Key 2026 Citizen Scam Defense Rules
- **Digital Arrest**: Indian law has NO concept of 'Digital Arrest'. Police, CBI, ED, and customs never conduct interrogations, court sessions, or arrests via video call.
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
Canonical Pages:
- https://cipherati.com/cybersecurity-news.html
- https://cipherati.com/scam-alerts.html
- https://cipherati.com/ai-realities.html
- https://cipherati.com/ai-tools.html

## About Cipherati
Cipherati is an independent engineering directory of open-source AI developer tools, coding agents, and local LLM infrastructure — combined with real-time cybersecurity news, statutory threat provenance (CERT-In, RBI, I4C, SEBI), and citizen scam defense intelligence. Zero vendor hype.

---

## 1. Live Cybersecurity News & Threat Intelligence (${threats.length} Verified Stories)

${threats.map((t, idx) => `### Story #${idx + 1}: ${t.title}
- Source: ${t.sourceName} (${t.date || "2026"})
- Sector: ${t.entities || "Cybersecurity"}
- Severity: ${(t.severity || "high").toUpperCase()}
- Context: ${t.incident || "Verified primary cybersecurity reporting."}
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

## 3. AI Engineering Realities in Production (${realities.length} Architecture Truths)

${realities.map((r) => `### Reality #${r.id}: ${r.title} (${r.category})
- The Vendor Myth: "${r.myth}"
- The Engineering Reality: ${r.reality}
- What Actually Works: ${r.fix}
- Business Impact: ${r.impact}
- Proven Tools: ${(r.tools || []).map(t => `${t.name} (${t.url})`).join(", ")}
`).join("\n")}

---

## 4. Curated AI Developer Tools Directory (${tools.length} Tools)

${tools.map((t, idx) => `### ${idx + 1}. ${t.name}
- URL: ${t.url}
- Category: ${t.category}
- Tagline: ${t.tagline}
- Why it matters: ${t.why_it_matters || "Verified open-source production utility."}
`).join("\n")}

---

## 5. Emergency Golden Hour Protocol for Financial Fraud
1. Call 1930 (National Cyber Crime Helpline) within 2 hours.
2. Screenshot all chats, transaction reference numbers (UTR), and caller IDs.
3. Submit e-FIR on https://cybercrime.gov.in.
4. Deliver dispute letter with complaint acknowledgement to your bank branch within 24 hours.
`;
  writeFileSync("./public/llms-full.txt", llmsFull, "utf-8");
  console.log(`Generated public/llms.txt and public/llms-full.txt (${threats.length} news stories, ${scams.length} scams, ${realities.length} AI realities, ${tools.length} tools).`);
}
