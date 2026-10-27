# 📡 AI Tools Radar — Independent Open Architecture

An independent, fully owned web application for discovering **New** and **Trending AI tools, models, and agents**, built with zero proprietary scrapers, zero IP/legal risk, and ready for public hosting with ad monetization.

---

## 🌟 Architecture & Clean IP Strategy

Unlike directory-scraping approaches that face Cloudflare blocking and database-right infringement:
1. **100% Permitted Open Sources**:
   - **Hacker News (Algolia API)**: Captures viral and real-time AI launches ("Show HN").
   - **GitHub Search API**: Captures fast-rising repositories, libraries, and open-source models.
   - **Hugging Face Hub API**: Captures trending Spaces, apps, and community demos.
   - **Public Submissions (`/api/submit`)**: Direct tool submissions from creators.
2. **Proprietary Ranking Algorithm**:
   - Rather than mirroring any third-party's list, momentum is calculated via decay velocity:
     $$\text{Score} = \frac{\sum \text{Metrics} \times 10.0}{(\text{Age In Hours} + 2.0)^{1.2}}$$
3. **Built-in Brand & Content Safety Filter** (`src/classify.mjs`):
   - Automatically filters out NSFW, gambling, jailbreak, and scam content to protect Google AdSense / EthicalAds compliance.
4. **Ad Monetization Ready**:
   - `/ads.txt` support out of the box.
   - Dynamic ad slot injection configured at regular intervals (e.g. after every 9 cards).

---

## 🚀 Running the App

```powershell
cd C:\Users\Vivek\.gemini\antigravity\scratch\ai-tools-radar
npm start
```
The server will boot at **`http://localhost:4317`**.

### Configuration (Environment Variables)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4317` | Web server port |
| `INGEST_INTERVAL_MIN` | `60` | Background sync frequency (in minutes) |
| `GITHUB_TOKEN` | *(optional)* | Unlocks high-rate-limit GitHub search |
| `ADS_ENABLED` | `false` | Enable live banner ads |
| `ADS_TXT` | `""` | Verification string served at `/ads.txt` |

---

## 📁 Project Structure

- [`src/config.mjs`](file:///C:/Users/Vivek/.gemini/antigravity/scratch/ai-tools-radar/src/config.mjs): Global settings & environment variables.
- [`src/db.mjs`](file:///C:/Users/Vivek/.gemini/antigravity/scratch/ai-tools-radar/src/db.mjs): Lightweight, zero-dependency SQLite storage (`node:sqlite`).
- [`src/sources.mjs`](file:///C:/Users/Vivek/.gemini/antigravity/scratch/ai-tools-radar/src/sources.mjs): Open API adapters (HN, GitHub, Hugging Face).
- [`src/classify.mjs`](file:///C:/Users/Vivek/.gemini/antigravity/scratch/ai-tools-radar/src/classify.mjs): AI classifier, category taxonomy, and brand safety filtering.
- [`src/ingest.mjs`](file:///C:/Users/Vivek/.gemini/antigravity/scratch/ai-tools-radar/src/ingest.mjs): Ingestion pipeline, deduplication, and trending score calculation.
- [`server.mjs`](file:///C:/Users/Vivek/.gemini/antigravity/scratch/ai-tools-radar/server.mjs): Fast HTTP server, REST endpoints, and static file server.
- [`public/index.html`](file:///C:/Users/Vivek/.gemini/antigravity/scratch/ai-tools-radar/public/index.html): Responsive dark-mode UI with filter, search, submission modal, and ad placeholders.
