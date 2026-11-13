# SEO Baseline (before changes)

Captured 2026-11-13 on branch `seo/dual-pillar-structure` from a safe local build of the committed state
(`CIPHERATI_LOCAL=1 npm run build`, `npm test`). Raw numbers: [`seo-baseline-before.json`](./seo-baseline-before.json).
Static HTML analysis only (no JavaScript executed); lab measurements, not field data.

## Commands
| Purpose | Command |
|---|---|
| Safe local build (no IndexNow/newsletter/push/live fetch) | `CIPHERATI_LOCAL=1 npm run build` (PowerShell: `$env:CIPHERATI_LOCAL='1'; npm run build`) |
| Quality gate | `npm test` |
| Metrics snapshot | `node scripts/seo-metrics.mjs reports/<file>.json` |

Local build takes ~15 s. One test failed locally before any change: `Default fallback route opens 'home'`.
Cause: the test matched a literal `\n`, but Windows git checkouts use CRLF (`core.autocrlf=true`). CI runs on Linux so it was not
failing there. Fixed by normalising line endings inside the test; no behaviour change.

## Key pages (before)
| Page | HTML size | H1 | Canonical | `/tools/` links | `<img>` (lazy / with width+height) |
|---|---|---|---|---|---|
| `/` | 672 KB | Discover, Audit & Ship Production AI Safely. | self | 0 | 225 (224 / 0) |
| `/ai-tools.html` | 652 KB | same | self | 0 | 225 (224 / 0) |
| `/ai-realities.html` | 635 KB | same | self | 0 | 225 (224 / 0) |
| `/cybersecurity-news.html` | 632 KB | same | self | 0 | 225 (224 / 0) |
| `/scam-alerts.html` | 636 KB | same | self | 0 | 225 (224 / 0) |
| `/newsletter/today.html` | 10 KB | Morning Cyber & AI Intelligence | **none** | 0 | 0 |

Titles and descriptions are unique per page (recorded in the JSON). The three target guides did not exist.

## Cross-checks against the growth pack
- Confirmed on the live site: 0 internal `/tools/` links on `/` and `/ai-tools.html`; identical H1 on five pages; `today.html` has no description or canonical.
- Not confirmed: the pack says sampled tool reviews had no JSON-LD. A live check of `/tools/ollama.html` found one JSON-LD block (BreadcrumbList + SoftwareSourceCode + FAQPage + Organization).
- Lighthouse was not installed on this machine at baseline time; results will be recorded in Phase 8 (lab data only).
