# 🛡️ Cipherati — AI Tools Directory, Cybersecurity News & Scam Alerts

**Live Site: [https://cipherati.com](https://cipherati.com/)**

An open, independent directory of battle-tested AI developer tools, coding agents, and local models — combined with production engineering realities, verified cybersecurity news, and citizen scam alerts.

![Cipherati](public/og-image.png)

## Four Core Pillars

1. **AI Tools Directory (`#tools`)** — 221+ verified developer tools, coding agents, and local model infrastructure across 10 categories, ranked by real community adoption (GitHub stars, Hugging Face likes, Hacker News scrutiny).
2. **AI Realities (`#realities`)** — 22 production engineering truths exposing why AI projects fail in production, with the vendor myth, the engineering reality, the business impact, and proven open-source fixes.
3. **Cybersecurity News (`#news`)** — Real-time incident intelligence across Indian banking/BFSI, crypto exchange heists, and global enterprise defense — strictly open-access and event-deduplicated.
4. **Scam Alerts (`#scams`)** — 19 verified citizen protection playbooks (Digital Arrest, e-Challan APK Trojans, Wrong UPI Transfers, AI Voice Clones) with the National Cyber Crime Helpline (**1930**) and Golden Hour reporting protocol.

## Automated Pipeline & Morning Briefing

A hardened GitHub Actions pipeline (`.github/workflows/deploy.yml`) runs automatically on schedule (including **8:00 AM IST** daily) and:

1. **Ingests & Verifies** open-source AI tools and live cybersecurity news (`src/ingest.mjs`, `src/live-cyber-rss.mjs`).
2. **Enforces Quality & Security Gates** (`src/quality.mjs`, `src/scam-guard.mjs`, `test/verify-build.mjs`).
3. **Compiles & Dispatches** *The Cipherati Briefing* (`src/newsletter-generator.mjs`, `src/newsletter-dispatcher.mjs`) at **8:00 AM IST** with a persistent non-repeating ledger (`public/data/newsletter-sent-ledger.json`).
4. **Publishes** static SEO/GEO/AEO artifacts (`public/index.html`, `public/llms.txt`, `public/sitemap.xml`, `public/robots.txt`) to GitHub Pages.

## Local Development

```bash
node build-static.mjs   # Refresh static data and pre-rendered HTML
npm test                # Run the 80+ Quality & OWASP Security Gate checks
node server.mjs         # Start local server on http://localhost:4317
```

## License

[MIT](LICENSE)
