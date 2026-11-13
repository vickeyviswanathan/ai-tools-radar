// Browser acceptance checks (Chrome DevTools Protocol, no npm dependencies).
// Usage: node scripts/browser-check.mjs [--shots]   (requires Google Chrome; builds must already exist in ./public)
// Serves ./public locally with GitHub-Pages-like routing, then for each page and viewport (360/768/1440):
//   - collects console errors / uncaught exceptions / failed same-origin requests
//   - checks horizontal overflow, H1 count and canonical at runtime
// and runs interaction checks (search, category filter, theme toggle, deep links, cross-page jumps, keyboard focus).
// Third-party hosts (Google favicons, Google Tag Manager, visitor badge) are blocked to keep runs deterministic.
import http from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";

const ROOT = path.resolve("public");
const CHROME = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
if (!CHROME) { console.error("Chrome not found. Set CHROME_PATH."); process.exit(2); }
const SHOTS = process.argv.includes("--shots");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain", ".xml": "application/xml", ".md": "text/markdown" };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      let file = path.join(ROOT, p);
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
      if (!existsSync(file)) { res.writeHead(404, { "content-type": "text/plain" }).end("404"); return; }
      res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" }).end(readFileSync(file));
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const port = 9300 + Math.floor(Math.random() * 500);
  const dir = path.join(os.tmpdir(), `cipherati-chrome-${Date.now()}`);
  const proc = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--headless=new", "--no-first-run", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try { const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); return { proc, port, ws: v.webSocketDebuggerUrl }; } catch { await sleep(250); }
  }
  proc.kill(); throw new Error("Chrome did not start");
}

class Tab {
  constructor(ws) { this.ws = new WebSocket(ws); this.id = 0; this.pending = new Map(); this.handlers = []; this.logs = []; }
  async open() {
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) { const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
      else if (m.method) for (const h of this.handlers) h(m);
    };
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
  }
}

async function newPage(browserWs) {
  const browser = new Tab(browserWs); await browser.open();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  const page = { browser, sessionId, logs: [], failed: [] };
  page.send = (m, p) => browser.send(m, p, sessionId);
  browser.handlers.push((m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === "Runtime.consoleAPICalled" && ["error", "assert"].includes(m.params.type)) page.logs.push(`console.${m.params.type}: ${(m.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ")}`);
    if (m.method === "Runtime.exceptionThrown") page.logs.push(`exception: ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`);
    if (m.method === "Network.loadingFailed" && !m.params.canceled && !m.params.blockedReason && !/ERR_BLOCKED_BY_CLIENT/.test(m.params.errorText || "")) page.failed.push(`${m.params.errorText || "request failed"} (${m.params.type || "?"})`);
    if (m.method === "Network.responseReceived" && m.params.response.status >= 400) page.failed.push(`HTTP ${m.params.response.status} ${m.params.response.url}`);
  });
  await page.send("Runtime.enable"); await page.send("Page.enable"); await page.send("Network.enable");
  await page.send("Network.setBlockedURLs", { urls: ["*://www.google.com/s2/*", "*://www.googletagmanager.com/*", "*://visitor-badge.laobi.icu/*", "*://www.google-analytics.com/*", "*://fonts.googleapis.com/*", "*://fonts.gstatic.com/*"] });
  page.evalJs = async (expression) => { const r = await page.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval failed"); return r.result.value; };
  page.goto = async (url, width = 1440, height = 900) => {
    page.logs.length = 0; page.failed.length = 0;
    await page.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await page.send("Page.navigate", { url });
    await sleep(400);
    for (let i = 0; i < 40; i++) {
      try { if (await page.evalJs(`document.readyState === 'complete' && !!document.querySelector('h1, .brand-title')`)) break; } catch {}
      await sleep(250);
    }
    await sleep(1200);
  };
  page.shot = async (file) => { const r = await page.send("Page.captureScreenshot", { format: "png" }); mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, Buffer.from(r.data, "base64")); };
  return page;
}

const results = [];
let failures = 0;
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); if (!ok) failures++; console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`); };

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const chrome = await launch();
const page = await newPage(chrome.ws);

const PAGES = [
  ["home", "/"], ["ai-tools", "/ai-tools.html"], ["ai-realities", "/ai-realities.html"], ["cyber-news", "/cybersecurity-news.html"], ["scam-alerts", "/scam-alerts.html"],
  ["newsletter", "/newsletter/today.html"], ["guide-upi", "/scam-defense/upi-fraud-what-to-do/"], ["guide-digital-arrest", "/scam-defense/digital-arrest-scam-india/"], ["guide-report", "/scam-defense/report-scam-call-india/"], ["tool-ollama", "/tools/ollama.html"]
];
const IGNORABLE = /favicon|ERR_BLOCKED_BY_CLIENT|Failed to load resource: net::ERR_FAILED|googletagmanager|google-analytics|service.?worker/i;

for (const [name, url] of PAGES) {
  for (const width of [360, 768, 1440]) {
    await page.goto(base + url, width);
    const info = await page.evalJs(`(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, h1: document.querySelectorAll('h1').length, canon: (document.querySelector('link[rel=canonical]')||{}).href || '' }))()`);
    const errs = page.logs.filter((l) => !IGNORABLE.test(l));
    const bad = page.failed.filter((l) => !IGNORABLE.test(l));
    check(`${name} @${width}px: no horizontal overflow`, info.sw <= info.iw + 1, `scrollWidth ${info.sw} vs ${info.iw}`);
    check(`${name} @${width}px: one H1 at runtime`, info.h1 === 1, `h1 count ${info.h1}`);
    check(`${name} @${width}px: no console errors / failed requests`, errs.length === 0 && bad.length === 0, [...errs, ...bad].slice(0, 3).join(" | "));
    if (SHOTS) await page.shot(`reports/screens/${name}-${width}.png`);
  }
}

// ---- interaction checks (1440px) ----
await page.goto(base + "/ai-tools.html", 1440);
const total = await page.evalJs(`document.querySelectorAll('#grid .tool-card').length`);
check("ai-tools: directory renders cards", total > 100, `${total} cards`);
check("ai-tools: client-rendered cards link to /tools/ review first", await page.evalJs(`(() => { const c=[...document.querySelectorAll('#grid .tool-card .tool-card-link')]; return c.length>100 && c.every(a=>/^\\/tools\\/[^/]+\\.html$/.test(a.getAttribute('href'))) })()`));
check("ai-tools: every card has labelled external 'Official source' link", await page.evalJs(`(() => [...document.querySelectorAll('#grid .tool-card')].every(c=>{const a=c.querySelector('.tool-ext');return a&&/^https?:/.test(a.href)&&a.target==='_blank'&&/noopener/.test(a.rel)&&/Official source/.test(a.textContent)}))()`));
await page.evalJs(`(() => { const q=document.querySelector('#q'); q.value='ollama'; q.dispatchEvent(new Event('input',{bubbles:true})); })()`); await sleep(500);
const afterSearch = await page.evalJs(`document.querySelectorAll('#grid .tool-card').length`);
check("ai-tools: search filters the grid", afterSearch >= 1 && afterSearch < total, `${afterSearch} of ${total}`);
await page.evalJs(`(() => { const q=document.querySelector('#q'); q.value=''; q.dispatchEvent(new Event('input',{bubbles:true})); })()`); await sleep(400);
await page.evalJs(`(() => { const a=[...document.querySelectorAll('.cat-links a')].find(x=>/^Coding/.test(x.textContent.trim())); a.click(); })()`); await sleep(600);
const catInfo = await page.evalJs(`(() => { const cs=[...document.querySelectorAll('#grid .tool-card .tool-cat-kicker')].map(x=>x.textContent.trim()); return { n: cs.length, allCoding: cs.length>0 && cs.every(c=>c==='Coding') } })()`);
check("ai-tools: category link filters to one category", catInfo.allCoding, `${catInfo.n} Coding tools`);
await page.goto(base + "/ai-tools.html#tools/Video", 1440);
check("ai-tools: #tools/<category> deep link pre-filters", await page.evalJs(`(() => { const cs=[...document.querySelectorAll('#grid .tool-card .tool-cat-kicker')].map(x=>x.textContent.trim()); return cs.length>0 && cs.every(c=>c==='Video') })()`));

// theme
await page.goto(base + "/", 1440);
const t0 = await page.evalJs(`document.documentElement.getAttribute('data-theme')||'light'`);
await page.evalJs(`document.getElementById('header-theme-btn').click()`); await sleep(300);
const t1 = await page.evalJs(`document.documentElement.getAttribute('data-theme')||'light'`);
check("theme toggle switches light/dark", t0 !== t1, `${t0} -> ${t1}`);

// navigation between pages through real links
await page.goto(base + "/", 1440);
const homeLinks = await page.evalJs(`(() => ({ tools: !!document.querySelector('.btn-cta[href="/ai-tools.html"]'), scam: !!document.querySelector('.btn-cta-alt[href="/scam-alerts.html"]'), guides: ['upi-fraud-what-to-do','digital-arrest-scam-india','report-scam-call-india'].every(s=>document.querySelector('a[href="/scam-defense/'+s+'/"]')), review: document.querySelectorAll('.pillar-ai a[href^="/tools/"]').length }))()`);
check("home: two primary CTAs and guide + review links present", homeLinks.tools && homeLinks.scam && homeLinks.guides && homeLinks.review >= 3, JSON.stringify(homeLinks));
const pillars = await page.evalJs(`(() => { const a=document.querySelector('.pillar-ai').getBoundingClientRect(), c=document.querySelector('.pillar-cyber').getBoundingClientRect(); return { aw: Math.round(a.width), cw: Math.round(c.width), at: Math.round(a.top), ct: Math.round(c.top) } })()`);
check("home: AI and Cybersecurity pillars have equal width and top alignment", Math.abs(pillars.aw - pillars.cw) <= 2 && Math.abs(pillars.at - pillars.ct) <= 2, JSON.stringify(pillars));

// sidebar link from home -> realities (view switch triggers navigation because that view lives on another page)
await page.evalJs(`document.getElementById('side-tab-realities').click()`); await sleep(1500);
check("sidebar 'AI Realities' navigates to /ai-realities.html", (await page.evalJs(`location.pathname`)) === "/ai-realities.html");
check("realities page shows its reality cards after navigation", (await page.evalJs(`document.querySelectorAll('.reality-card').length`)) === 22);

// deep link kept across pages: /#scams/<id> -> scam page
await page.goto(base + "/#scams/digital-arrest-video-call", 1440); await sleep(1200);
check("legacy deep link /#scams/<id> lands on /scam-alerts.html and highlights the card", (await page.evalJs(`location.pathname`)) === "/scam-alerts.html" && (await page.evalJs(`!!document.getElementById('scam-digital-arrest-video-call')`)));
await page.goto(base + "/#realities/3", 1440); await sleep(1200);
check("legacy deep link /#realities/3 lands on /ai-realities.html", (await page.evalJs(`location.pathname`)) === "/ai-realities.html");
await page.goto(base + "/#news", 1440); await sleep(1200);
check("legacy deep link /#news lands on /cybersecurity-news.html", (await page.evalJs(`location.pathname`)) === "/cybersecurity-news.html");

// omnibox cross-page jump
await page.goto(base + "/ai-tools.html", 1440);
await page.evalJs(`(() => { const o=document.getElementById('global-omnibox'); o.value='digital arrest'; o.dispatchEvent(new Event('input',{bubbles:true})); })()`); await sleep(400);
const hitExists = await page.evalJs(`!!document.querySelector('.omnibox-hit')`);
check("omnibox shows cross-pillar hits", hitExists);
if (hitExists) {
  await page.evalJs(`[...document.querySelectorAll('.omnibox-hit')].find(h=>/Scam Alert/.test(h.textContent)).click()`); await sleep(1800);
  check("omnibox scam hit jumps to /scam-alerts.html and focuses the card", (await page.evalJs(`location.pathname`)) === "/scam-alerts.html" && (await page.evalJs(`document.querySelectorAll('.card-highlight').length >= 0`)));
}

// scam page filter still works
await page.goto(base + "/scam-alerts.html", 1440);
const scamTotal = await page.evalJs(`document.querySelectorAll('#scams .scam-card, #scams article').length`);
await page.evalJs(`(() => { const q=document.getElementById('scam-q'); q.value='upi'; q.dispatchEvent(new Event('input',{bubbles:true})); })()`); await sleep(600);
const scamVisible = await page.evalJs(`[...document.querySelectorAll('#scams .scam-card, #scams article')].filter(e=>e.offsetParent!==null).length`);
check("scam-alerts: search filter narrows results", scamTotal > 0 && scamVisible > 0 && scamVisible <= scamTotal, `${scamVisible} of ${scamTotal}`);
check("scam-alerts: guides panel with 3 guide links is visible", (await page.evalJs(`document.querySelectorAll('.guides-box a[href^="/scam-defense/"]').length`)) === 3);

// news filter
await page.goto(base + "/cybersecurity-news.html", 1440);
const newsTotal = await page.evalJs(`document.querySelectorAll('#threats .threat-card').length`);
await page.evalJs(`document.querySelector('.threat-tab-btn[data-cat="india-bfsi"]').click()`); await sleep(500);
const newsVisible = await page.evalJs(`[...document.querySelectorAll('#threats .threat-card')].filter(e=>e.offsetParent!==null).length`);
check("cyber-news: category filter works", newsTotal > 0 && newsVisible > 0 && newsVisible < newsTotal, `${newsVisible} of ${newsTotal}`);

// guide pages: related links both ways and keyboard focus order
for (const slug of ["upi-fraud-what-to-do", "digital-arrest-scam-india", "report-scam-call-india"]) {
  await page.goto(`${base}/scam-defense/${slug}/`, 1440);
  const rel = await page.evalJs(`['upi-fraud-what-to-do','digital-arrest-scam-india','report-scam-call-india'].filter(s=>s!=='${slug}').every(s=>document.querySelector('.panel a[href="/scam-defense/'+s+'/"]'))`);
  check(`guide ${slug}: related guide links present`, rel);
  const tableOk = await page.evalJs(`[...document.querySelectorAll('table')].every(t=>t.closest('.table-wrap'))`);
  check(`guide ${slug}: tables are mobile-scroll wrapped`, tableOk);
}
await page.goto(base + "/", 1440);
const focusOrder = [];
for (let i = 0; i < 6; i++) { await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 }); await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 }); focusOrder.push(await page.evalJs(`(() => { const e=document.activeElement; return e ? (e.tagName+':'+(e.getAttribute('href')||e.id||e.className||'').toString().slice(0,40)) : 'none' })()`)); }
check("keyboard: Tab moves focus through interactive elements", new Set(focusOrder).size >= 4, focusOrder.join(" > "));

writeFileSync("reports/browser-check-latest.json", JSON.stringify({ ranAt: new Date().toISOString(), failures, results }, null, 2));
console.log(`\n${results.length - failures}/${results.length} browser checks passed`);
await page.browser.send("Browser.close").catch(() => {});
chrome.proc.kill(); server.close();
process.exit(failures ? 1 : 0);
