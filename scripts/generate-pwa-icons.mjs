import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

async function generateIcons() {
  mkdirSync("public/icons", { recursive: true });

  const svgContent = readFileSync("public/favicon.svg", "utf8");

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // 1. Standard 192x192 icon
  await page.setViewportSize({ width: 192, height: 192 });
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent;overflow:hidden;"><div style="width:192px;height:192px;">${svgContent.replace('viewBox="0 0 64 64"', 'viewBox="0 0 64 64" width="192" height="192"')}</div></body></html>`);
  await page.screenshot({ path: "public/icons/icon-192.png", omitBackground: false });
  console.log("Generated public/icons/icon-192.png");

  // 2. Standard 512x512 icon
  await page.setViewportSize({ width: 512, height: 512 });
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent;overflow:hidden;"><div style="width:512px;height:512px;">${svgContent.replace('viewBox="0 0 64 64"', 'viewBox="0 0 64 64" width="512" height="512"')}</div></body></html>`);
  await page.screenshot({ path: "public/icons/icon-512.png", omitBackground: false });
  console.log("Generated public/icons/icon-512.png");

  // 3. Maskable 512x512 icon with safe zone padding (10% padding on dark background)
  const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="#07090e"/>
    <g transform="translate(64, 64) scale(6)">
      <circle cx="32" cy="32" r="22" fill="none" stroke="#3b82f6" stroke-opacity="0.5" stroke-width="2"/>
      <circle cx="32" cy="32" r="14" fill="none" stroke="#3b82f6" stroke-opacity="0.35" stroke-width="2"/>
      <circle cx="32" cy="32" r="6" fill="none" stroke="#3b82f6" stroke-opacity="0.25" stroke-width="2"/>
      <path d="M32 32 L32 10 A22 22 0 0 1 47.6 17.6 Z" fill="#38bdf8" fill-opacity="0.85"/>
      <circle cx="32" cy="32" r="3" fill="#3b82f6"/>
      <circle cx="43" cy="24" r="2" fill="#f59e0b"/>
    </g>
  </svg>`;

  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#07090e;overflow:hidden;"><div style="width:512px;height:512px;">${maskableSvg}</div></body></html>`);
  await page.screenshot({ path: "public/icons/icon-maskable-512.png", omitBackground: false });
  console.log("Generated public/icons/icon-maskable-512.png");

  await browser.close();
}

generateIcons().catch(err => {
  console.error("Icon generation error:", err);
  process.exit(1);
});
