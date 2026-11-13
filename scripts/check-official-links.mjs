// Manual check (not part of CI): opens each official source cited in the scam-defense guides in real headless Chrome
// and reports the final URL, HTTP status of the main document and page title. Some government/NPCI hosts reject
// non-browser clients (curl/PowerShell get 403 or TLS errors), so a real browser is the fair test.
// Usage: node scripts/check-official-links.mjs     (requires Google Chrome)
import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";

const CHROME = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
if (!CHROME) { console.error("Chrome not found; set CHROME_PATH"); process.exit(2); }

const urls = new Set();
for (const slug of JSON.parse(readFileSync("content/guides/guides.json", "utf8")).map((g) => g.slug)) {
  const md = readFileSync(`content/guides/${slug}.md`, "utf8");
  for (const m of md.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) urls.add(m[1]);
}
console.log(`Checking ${urls.size} official URLs cited in the guides…\n`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9800 + Math.floor(Math.random() * 100);
const proc = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${path.join(os.tmpdir(), "cipherati-links-" + Date.now())}`, "--headless=new", "--no-first-run", "--disable-gpu", "--no-sandbox", "about:blank"], { stdio: "ignore" });
let ver;
for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(250); } }
if (!ver) { proc.kill(); throw new Error("Chrome did not start"); }

const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const handlers = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m.error); pending.delete(m.id); } else handlers.forEach((h) => h(m)); };
const send = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Network.enable", {}, sessionId); await send("Page.enable", {}, sessionId); await send("Runtime.enable", {}, sessionId);
await send("Network.setUserAgentOverride", { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" }, sessionId);

let docStatus = null, docUrl = null;
handlers.push((m) => { if (m.sessionId === sessionId && m.method === "Network.responseReceived" && m.params.type === "Document") { docStatus = m.params.response.status; docUrl = m.params.response.url; } });

for (const url of urls) {
  docStatus = null; docUrl = null;
  await send("Page.navigate", { url }, sessionId);
  for (let i = 0; i < 40; i++) { await sleep(500); if (docStatus) break; }
  await sleep(1500);
  const t = await send("Runtime.evaluate", { expression: "document.title", returnByValue: true }, sessionId);
  console.log(`${docStatus ?? "no-response"}\t${url}\n\t→ ${docUrl ?? "-"}\n\ttitle: ${String(t?.result?.value ?? "").slice(0, 90)}`);
}
await send("Browser.close").catch(() => {});
proc.kill();
process.exit(0);
