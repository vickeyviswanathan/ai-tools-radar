// Independent Server & API for AI Tools Radar
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { config, ROOT } from "./src/config.mjs";
import { getDb, getMeta, now } from "./src/db.mjs";
import { runIngestion } from "./src/ingest.mjs";
import { cleanUrl, clip } from "./src/classify.mjs";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function send(res, status, body, type = "application/json") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

let isIngesting = false;
async function triggerIngestion() {
  if (isIngesting) return;
  isIngesting = true;
  try {
    await runIngestion();
  } catch (err) {
    console.error("[Ingest Error]", err);
  } finally {
    isIngesting = false;
  }
}

// Initial ingest on launch if database is empty
setTimeout(async () => {
  const count = getDb().prepare("SELECT COUNT(*) c FROM items").get().c;
  if (count === 0) {
    console.log("[Init] Database empty, triggering first ingestion...");
    await triggerIngestion();
  }
}, 500);

// Recurring background ingestion
if (config.ingestIntervalMin > 0) {
  setInterval(() => {
    triggerIngestion();
  }, config.ingestIntervalMin * 60 * 1000);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    // 1. API: GET /api/data?view=new|trending&period=day|week|month&q=&category=
    if (url.pathname === "/api/data" && req.method === "GET") {
      const db = getDb();
      const view = url.searchParams.get("view") || "trending";
      const period = url.searchParams.get("period") || "week";
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();
      const category = url.searchParams.get("category") || "";

      let periodSeconds = 7 * 86400; // default week
      if (period === "day") periodSeconds = 86400;
      if (period === "month") periodSeconds = 30 * 86400;

      const minLaunch = now() - periodSeconds;

      let sql = `
        SELECT i.id, i.name, i.tagline, i.url, i.emoji, i.category, i.tags, i.launched_at, i.score,
               GROUP_CONCAT(s.source || ':' || s.metric, ',') as signal_summary
        FROM items i
        LEFT JOIN signals s ON s.item_id = i.id
        WHERE i.status = 'active'
      `;
      const params = [];

      if (view === "new") {
        sql += ` AND i.launched_at >= ?`;
        params.push(minLaunch);
      }

      if (category) {
        sql += ` AND i.category = ?`;
        params.push(category);
      }

      if (q) {
        sql += ` AND (LOWER(i.name) LIKE ? OR LOWER(i.tagline) LIKE ?)`;
        params.push(`%${q}%`, `%${q}%`);
      }

      sql += ` GROUP BY i.id`;

      if (view === "new") {
        sql += ` ORDER BY i.launched_at DESC LIMIT 60`;
      } else {
        sql += ` ORDER BY i.score DESC, i.launched_at DESC LIMIT 60`;
      }

      const rows = db.prepare(sql).all(...params);
      const lastIngest = getMeta("last_ingest_at", null);

      return send(res, 200, {
        items: rows.map((r) => ({
          ...r,
          tags: JSON.parse(r.tags || "[]"),
          signals: (r.signal_summary || "").split(",").filter(Boolean),
        })),
        isIngesting,
        lastIngest,
        adsConfig: config.ads,
      });
    }

    // 2. API: POST /api/refresh (Trigger manual re-sync)
    if (url.pathname === "/api/refresh" && req.method === "POST") {
      triggerIngestion();
      return send(res, 200, { ok: true, message: "Ingestion started" });
    }

    // 3. API: POST /api/submit (Public Tool Submissions)
    if (url.pathname === "/api/submit" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const data = JSON.parse(body);
          const clean = cleanUrl(data.url);
          if (!clean) return send(res, 400, { error: "Invalid website URL" });

          const db = getDb();
          db.prepare(`
            INSERT INTO submissions (url, name, tagline, created_at, status)
            VALUES (?, ?, ?, ?, 'pending')
          `).run(clean, clip(data.name, 60), clip(data.tagline, 200), now());

          return send(res, 200, { ok: true, message: "Submitted for review" });
        } catch {
          return send(res, 400, { error: "Invalid JSON" });
        }
      });
      return;
    }

    // 4. ads.txt support for ad monetization (e.g., AdSense)
    if (url.pathname === "/ads.txt" && req.method === "GET") {
      return send(res, 200, config.ads.adsTxt || "# Ads.txt placeholder\n", "text/plain");
    }

    // 5. Static file serving from /public
    const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const file = path.join(ROOT, "public", path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
    if (!file.startsWith(path.join(ROOT, "public"))) return send(res, 403, { error: "Forbidden" });

    await stat(file);
    const ext = path.extname(file);
    return send(res, 200, await readFile(file), MIME[ext] ?? "application/octet-stream");
  } catch (err) {
    if (err.code === "ENOENT") return send(res, 404, { error: "Not found" });
    console.error(err);
    return send(res, 500, { error: String(err.message || err) });
  }
});

server.listen(config.port, config.host, () => {
  console.log(`📡 AI Tools Radar running at http://localhost:${config.port}`);
});
