// Generates a lightweight, original, text-only social card (1200x630 PNG) for each scam-defense guide.
// No imagery of victims, no alarming graphics: just the guide title and the Cipherati wordmark.
// Output: public/og/guides/<slug>.png (committed assets; re-run only when a guide title changes).
// Usage: node scripts/make-guide-og.mjs     (requires Google Chrome)
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const CHROME = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
if (!CHROME) { console.error("Chrome not found; set CHROME_PATH"); process.exit(2); }

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const meta = JSON.parse(readFileSync("content/guides/guides.json", "utf8"));
mkdirSync("public/og/guides", { recursive: true });

for (const g of meta) {
  const md = readFileSync(`content/guides/${g.slug}.md`, "utf8");
  const title = md.split("\n")[0].replace(/^#\s+/, "").trim();
  const html = `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;width:1200px;height:630px}
    body{font-family:Inter,"Segoe UI",Roboto,Arial,sans-serif;background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);color:#fff;display:flex;flex-direction:column;justify-content:space-between;padding:64px 72px;box-sizing:border-box}
    .tag{font-size:26px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#93c5fd}
    h1{font-size:68px;line-height:1.12;margin:18px 0 0;letter-spacing:-.02em;max-width:1030px}
    .foot{display:flex;justify-content:space-between;align-items:center;font-size:30px;font-weight:700;color:#e2e8f0}
    .mark{display:flex;align-items:center;gap:16px}.logo{width:52px;height:52px;border-radius:14px;background:#2563eb;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:32px}
  </style><div><div class="tag">Scam-defense guide · India</div><h1>${esc(title)}</h1></div>
  <div class="foot"><div class="mark"><div class="logo">C</div>Cipherati</div><div>cipherati.com</div></div>`;
  const tmp = path.join(os.tmpdir(), `og-${g.slug}.html`);
  writeFileSync(tmp, html, "utf8");
  const out = path.resolve(`public/og/guides/${g.slug}.png`);
  const r = spawnSync(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", `--screenshot=${out}`, "--window-size=1200,630", `file:///${tmp.replace(/\\/g, "/")}`], { stdio: "ignore", timeout: 60000 });
  rmSync(tmp, { force: true });
  console.log(`${g.slug}: ${existsSync(out) ? "ok" : "FAILED"} (exit ${r.status})`);
}
