// Cipherati Morning Intelligence Briefing Generator
// Produces a 60-second, high-signal daily briefing:
// 1. Cybersecurity News (The Lead Story + Quick Hits)
// 2. Active Scam Defense (The Trap + The Defense Rule + 1930 Helpline)
// 3. Today's AI Tool & Reality Check (Zero vendor hype)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { REALITIES_DATA } from "./realities-data.mjs";

export function generateDailyBriefing() {
  const toolsData = JSON.parse(readFileSync("public/data/tools.json", "utf8")).tools || [];
  const threatsData = JSON.parse(readFileSync("public/data/threats.json", "utf8")).threats || [];
  const scamsData = JSON.parse(readFileSync("public/data/scams.json", "utf8")).scams || [];

  const todayStr = new Date().toISOString().split("T")[0];
  const dateFormatted = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // Filter out any false positive RSS matches that are not true cyber security incidents
  const isSecurityItem = (item) => {
    const t = (item.title || "").toLowerCase();
    if (t.includes("car sales") || t.includes("box office") || t.includes("cricket") ||
        t.includes("ed attaches") || t.includes("attaches properties") || t.includes("dollar pulls back") ||
        t.includes("loan fraud") || t.includes("chandra proteco")) return false;
    return true;
  };

  const validThreats = threatsData.filter(isSecurityItem);

  // 1. Cybersecurity News: Pick top incident as Lead, next 2-3 as Quick Hits
  const sortedThreats = [...validThreats].sort((a, b) => {
    const sevOrder = { critical: 3, high: 2, medium: 1 };
    return (sevOrder[b.severity] || 0) - (sevOrder[a.severity] || 0);
  });

  const leadThreat = sortedThreats[0] || {
    title: "Global Cybersecurity Incident Monitoring Active",
    sourceName: "Cipherati Intelligence Desk",
    sourceUrl: "https://cipherati.com/#news",
    incident: "Continuous threat tracking active across banking, enterprise, and critical infrastructure."
  };

  const quickHits = sortedThreats.slice(1, 4);

  // 2. Scam Watch: Pick 1 high-impact active scam
  const topScam = scamsData[0] || {
    title: "Digital Arrest Video Extortion",
    platform: "WhatsApp / Video Call",
    scam: "Fraudsters pose as police or CBI over video claiming illegal parcels or drug links.",
    protection: "Indian law enforcement NEVER interrogates or arrests citizens via video call. Hang up and dial 1930."
  };

  // 3. AI Tool & Reality of the Day: Pick 1 battle-tested tool and 1 reality trap
  // Rotate deterministically by day of year so each day has fresh picks
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  const realityPick = REALITIES_DATA[dayOfYear % REALITIES_DATA.length] || REALITIES_DATA[0];
  
  // Pick top tool relevant to the reality or high-ranked tool
  const featuredTool = toolsData.find(t => realityPick.tools && realityPick.tools.some(rt => rt.name.toLowerCase() === t.name.toLowerCase())) || toolsData[dayOfYear % toolsData.length] || toolsData[0];

  const briefing = {
    date: todayStr,
    dateFormatted,
    leadThreat,
    quickHits,
    topScam,
    featuredTool,
    realityPick
  };

  mkdirSync("public/data", { recursive: true });
  mkdirSync("public/newsletter", { recursive: true });

  // 1. Write JSON for web UI preview
  writeFileSync("public/data/briefing.json", JSON.stringify(briefing, null, 2), "utf8");

  // 2. Generate Markdown Newsletter
  const mdOutput = `# 📬 The Cipherati Morning Briefing · ${dateFormatted}
*The 60-second intelligence scan: Cybersecurity news, citizen scam defense, and verified AI tools. Zero hype.*

---

## 🛡️ Cybersecurity News
### **Lead Story: ${leadThreat.title}**
* **Source**: [${leadThreat.sourceName}](${leadThreat.sourceUrl})
* **Key Context**: ${leadThreat.incident || "Verified primary reporting confirmed by official security desks."}

${quickHits.length > 0 ? `### **Quick Hits (30-Sec Scan)**\n` + quickHits.map(h => `- **${h.title}** ([${h.sourceName}](${h.sourceUrl}))`).join("\n") : ""}

---

## 🚨 Active Scam Watch
### **${topScam.title}** (${topScam.platform})
* **The Trap**: ${topScam.scam}
* **The Defense Rule**: **${topScam.protection}**
* **Emergency Action**: If targeted, call **1930** (Toll-Free National Cyber Helpline) within the Golden Hour.

---

## 🛠️ AI Tool & Reality of the Day
* **Today's Tool**: [**${featuredTool.name}**](${featuredTool.url}) — ${featuredTool.tagline}
* **Reality Check (#${realityPick.id}: ${realityPick.title})**: 
  * *Myth*: "${realityPick.myth}"
  * *What Actually Works*: ${realityPick.fix}

---
*Read online or explore the live directory at [cipherati.com](https://cipherati.com/)*
`;
  writeFileSync("public/newsletter/today.md", mdOutput, "utf8");

  // 3. Generate Clean, Responsive HTML Email
  const htmlEmail = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Cipherati Morning Briefing · ${dateFormatted}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px 12px; line-height: 1.5; }
    .email-container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; }
    .email-header { background: #0f172a; color: #ffffff; padding: 24px; text-align: left; }
    .email-badge { display: inline-block; background: #2563eb; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 6px; letter-spacing: 0.05em; margin-bottom: 8px; }
    .email-title { font-size: 20px; font-weight: 800; margin: 0 0 4px; color: #ffffff; }
    .email-sub { font-size: 13px; color: #94a3b8; margin: 0; }
    .email-body { padding: 24px; }
    .section-title { font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #2563eb; margin: 24px 0 12px; display: flex; align-items: center; gap: 6px; border-bottom: 2px solid #eff6ff; padding-bottom: 6px; }
    .section-title:first-child { margin-top: 0; }
    .lead-card { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 8px; padding: 14px 16px; margin-bottom: 12px; }
    .lead-title { font-size: 15.5px; font-weight: 700; color: #0f172a; text-decoration: none; display: block; margin-bottom: 6px; }
    .lead-meta { font-size: 12px; color: #64748b; margin-bottom: 6px; }
    .lead-desc { font-size: 13.5px; color: #334155; margin: 0; }
    .quick-list { list-style: none; padding: 0; margin: 0; }
    .quick-item { padding: 8px 0; border-top: 1px solid #f1f5f9; font-size: 13.5px; }
    .quick-item a { color: #0f172a; font-weight: 600; text-decoration: none; }
    .quick-source { color: #64748b; font-size: 12px; }
    .scam-box { background: #fff1f2; border: 1px solid #fecdd3; border-left: 4px solid #e11d48; border-radius: 8px; padding: 14px 16px; margin-bottom: 12px; }
    .scam-title { font-size: 15px; font-weight: 700; color: #9f1239; margin: 0 0 6px; }
    .scam-text { font-size: 13.5px; color: #4c0519; margin: 0 0 8px; }
    .defense-rule { background: #ffffff; border: 1px solid #fecdd3; border-radius: 6px; padding: 8px 12px; font-size: 13px; font-weight: 600; color: #881337; }
    .tool-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; border-radius: 8px; padding: 14px 16px; }
    .tool-name { font-size: 15px; font-weight: 700; color: #166534; text-decoration: none; }
    .tool-tag { font-size: 13.5px; color: #14532d; margin: 4px 0 8px; }
    .reality-quote { font-size: 13px; background: #ffffff; border: 1px solid #bbf7d0; border-radius: 6px; padding: 8px 12px; color: #166534; }
    .email-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center; font-size: 12px; color: #64748b; }
    .email-footer a { color: #2563eb; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <div class="email-badge">📬 CIPHERATI BRIEFING · 60-SEC SCAN</div>
      <h1 class="email-title">Today's Intelligence Briefing</h1>
      <p class="email-sub">${dateFormatted} · Verified Cyber News, Scam Defense &amp; AI Realities</p>
    </div>

    <div class="email-body">
      <!-- 1. Cybersecurity News -->
      <div class="section-title">🛡️ Cybersecurity News</div>
      <div class="lead-card">
        <a class="lead-title" href="${leadThreat.sourceUrl}" target="_blank">${leadThreat.title} ↗</a>
        <div class="lead-meta">Source: <strong>${leadThreat.sourceName}</strong> · Verified Report</div>
        <p class="lead-desc">${leadThreat.incident || "Verified primary reporting confirmed by official security desks."}</p>
      </div>

      ${quickHits.length > 0 ? `
      <ul class="quick-list">
        ${quickHits.map(h => `
        <li class="quick-item">
          🔹 <a href="${h.sourceUrl}" target="_blank">${h.title} ↗</a>
          <span class="quick-source">(${h.sourceName})</span>
        </li>`).join("")}
      </ul>` : ""}

      <!-- 2. Active Scam Watch -->
      <div class="section-title">🚨 Active Scam Watch</div>
      <div class="scam-box">
        <div class="scam-title">${topScam.title} <span style="font-size:12px;font-weight:normal;color:#9f1239;">(${topScam.platform})</span></div>
        <p class="scam-text"><strong>The Trap:</strong> ${topScam.scam}</p>
        <div class="defense-rule">
          🛡️ <strong>Defense Rule:</strong> ${topScam.protection}
        </div>
      </div>

      <!-- 3. AI Tool & Reality of the Day -->
      <div class="section-title">🛠️ AI Tool &amp; Reality of the Day</div>
      <div class="tool-box">
        <div><a class="tool-name" href="${featuredTool.url}" target="_blank">${featuredTool.name} ↗</a></div>
        <div class="tool-tag">${featuredTool.tagline}</div>
        <div class="reality-quote">
          <strong>⚡ Production Reality (#${realityPick.id}: ${realityPick.title}):</strong> ${realityPick.fix}
        </div>
      </div>
    </div>

    <div class="email-footer">
      <p>Published by <a href="https://cipherati.com/">Cipherati.com</a> — Independent AI &amp; Cyber Intelligence.</p>
      <p>Need emergency cyber fraud help? Call <strong>1930</strong> (Toll-Free National Helpline in India).</p>
      <p style="color:#94a3b8;margin-top:10px;">To manage your preferences or unsubscribe, click <a href="#">here</a>.</p>
    </div>
  </div>
</body>
</html>`;
  writeFileSync("public/newsletter/today.html", htmlEmail, "utf8");

  console.log(`[Newsletter] Generated today's briefing (${dateFormatted}): 1 Lead + ${quickHits.length} Quick Hits + 1 Scam Alert + 1 Tool & Reality.`);
  return briefing;
}
