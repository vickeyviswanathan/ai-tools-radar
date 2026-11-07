import { chromium } from "playwright";
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// Simple local server to test service worker & PWA
const mimeTypes = {
  ".html": "text/html",
  ".json": "application/json",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

const server = http.createServer((req, res) => {
  let filePath = path.join(process.cwd(), "public", req.url === "/" ? "index.html" : req.url.split("?")[0]);
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath);
  const mime = mimeTypes[ext] || "text/plain";
  res.writeHead(200, { "Content-Type": mime });
  res.end(readFileSync(filePath));
});

server.listen(8080, async () => {
  console.log("Testing server listening on http://localhost:8080");
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto("http://localhost:8080/#home", { waitUntil: "networkidle" });
    await page.screenshot({ path: "C:/Users/Vivek/.gemini/antigravity/brain/1dd3678a-6cb2-47f6-9c8c-1c946ddcbb0e/pwa_home_view.png" });
    console.log("Saved pwa_home_view.png");

    // Switch to news view via function
    await page.evaluate(() => switchView('news'));
    await page.waitForTimeout(600);
    await page.screenshot({ path: "C:/Users/Vivek/.gemini/antigravity/brain/1dd3678a-6cb2-47f6-9c8c-1c946ddcbb0e/pwa_news_view.png" });
    console.log("Saved pwa_news_view.png");

    // Open briefing preview modal via function
    await page.evaluate(() => openNewsletterPreview());
    await page.waitForTimeout(600);
    await page.screenshot({ path: "C:/Users/Vivek/.gemini/antigravity/brain/1dd3678a-6cb2-47f6-9c8c-1c946ddcbb0e/pwa_briefing_modal_view.png" });
    console.log("Saved pwa_briefing_modal_view.png");

    await browser.close();
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    server.close();
  }
});
