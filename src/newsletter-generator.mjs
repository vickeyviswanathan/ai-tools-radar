// Cipherati Morning Intelligence Briefing Generator
// High-deliverability Axios / TLDR Executive Plain-Paper Format:
// - 100% domain alignment (all links point to cipherati.com/#news, #scams, #tools, #realities)
// - Exact 4 site pillars: Cybersecurity News, Scam Alerts, AI Tools, AI Realities
// - Non-repeating content ledger: tracks sent scams, realities, tools, and lead news; automatically skips any section once all items in its pool have been sent until new items are added.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { REALITIES_DATA } from "./realities-data.mjs";

const SENT_LEDGER_PATH = "public/data/newsletter-sent-ledger.json";

function loadSentLedger() {
  if (existsSync(SENT_LEDGER_PATH)) {
    try {
      return JSON.parse(readFileSync(SENT_LEDGER_PATH, "utf8"));
    } catch {}
  }
  return {
    lastUpdatedDate: null,
    sentScamIds: [],
    sentRealityIds: [],
    sentToolNames: [],
    sentLeadTitles: []
  };
}

function escHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildLeadContext(item) {
  const titleWords = (item.title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const incRaw = (item.incident || "").replace(/^key updates:\s*/i, "").trim();
  const incWords = incRaw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const overlapCount = incWords.filter((w) => titleWords.includes(w)).length;
  const overlapRatio = incWords.length > 0 ? overlapCount / incWords.length : 1;

  // Only use incident text if it adds genuinely new information (< 60% word overlap with headline)
  if (incRaw && overlapRatio < 0.6) {
    return incRaw;
  }

  // Otherwise, synthesize genuine analytical context from entities, category, and rootCause
  const sector = item.entities || "Enterprise & Critical Infrastructure";
  const desk = item.sourceName || "Primary Security Desk";
  const root =
    item.rootCause && !item.rootCause.includes("Verified reporting confirmed")
      ? item.rootCause
      : `Confirmed by ${desk}; security teams across ${sector} should assess exposure, review access controls, and monitor vendor advisories.`;
  return root;
}

/** Unique, content-derived meta description for the rolling /newsletter/today.html page (<= ~160 chars). */
export function briefingMetaDescription({ leadThreat, topScam, featuredTool, realityPick }) {
  const bits = [];
  if (leadThreat?.title) bits.push(`${leadThreat.title}`);
  const extras = [];
  if (topScam?.title) extras.push("a scam alert");
  if (featuredTool?.name) extras.push("an AI tool");
  if (realityPick?.title) extras.push("a production AI lesson");
  let text = `Today's 60-second Cipherati briefing: ${bits.join("")}${extras.length ? `, plus ${extras.join(", ")}` : ""}.`;
  if (text.length > 158) text = text.slice(0, 155).replace(/\s+\S*$/, "") + "…";
  return text;
}

export function generateDailyBriefing() {
  const toolsData = JSON.parse(readFileSync("public/data/tools.json", "utf8")).tools || [];
  const threatsData = JSON.parse(readFileSync("public/data/threats.json", "utf8")).threats || [];
  const scamsData = JSON.parse(readFileSync("public/data/scams.json", "utf8")).scams || [];

  const nowIst = new Date();
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(nowIst);
  const dateFormatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(nowIst);

  const isSecurityItem = (item) => {
    const t = (item.title || "").toLowerCase();
    if (
      t.includes("car sales") ||
      t.includes("box office") ||
      t.includes("cricket") ||
      t.includes("ed attaches") ||
      t.includes("attaches properties") ||
      t.includes("dollar pulls back") ||
      t.includes("loan fraud") ||
      t.includes("chandra proteco")
    )
      return false;
    return true;
  };

  const validThreats = threatsData.filter(isSecurityItem);

  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  const nowMs = Date.now();
  const FRESH_WINDOW_MS = 36 * 60 * 60 * 1000; // 36 hours

  // Sort strictly by newest timestamp first; only boost severity among fresh stories (<36h old)
  const sortedThreats = [...validThreats].sort((a, b) => {
    const tA = a.timestamp || new Date(a.pubDate || a.date || 0).getTime();
    const tB = b.timestamp || new Date(b.pubDate || b.date || 0).getTime();
    const aFresh = nowMs - tA <= FRESH_WINDOW_MS;
    const bFresh = nowMs - tB <= FRESH_WINDOW_MS;
    if (aFresh !== bFresh) return bFresh ? 1 : -1;
    if (aFresh && bFresh) {
      const sevOrder = { critical: 3, high: 2, medium: 1 };
      const diffSev = (sevOrder[b.severity] || 0) - (sevOrder[a.severity] || 0);
      if (diffSev !== 0) return diffSev;
    }
    return tB - tA;
  });

  // Load persistent sent ledger so no scam, reality, tool, or lead news is ever repeated
  const ledger = loadSentLedger();
  const isSameDay = ledger.lastUpdatedDate === todayStr;

  // If running again on the same day, keep today's already-picked items; otherwise pick strictly from unsent items
  const prevSentScams = new Set(isSameDay ? ledger.sentScamIds.slice(0, -1) : ledger.sentScamIds);
  const prevSentRealities = new Set(isSameDay ? ledger.sentRealityIds.slice(0, -1) : ledger.sentRealityIds);
  const prevSentTools = new Set(isSameDay ? ledger.sentToolNames.slice(0, -1) : ledger.sentToolNames);
  const prevSentLeads = new Set(isSameDay ? ledger.sentLeadTitles.slice(0, -1) : ledger.sentLeadTitles);

  // 1. Pick Lead News (must not have been featured as Lead before)
  const unsentThreats = sortedThreats.filter((t) => !prevSentLeads.has(t.title));
  const leadThreat = unsentThreats[0] || sortedThreats[0] || {
    title: "Global Cybersecurity Incident Monitoring Active",
    sourceName: "Cipherati Desk",
    sourceUrl: "https://cipherati.com/#news",
    entities: "Enterprise & Financial Infrastructure",
    incident: "Continuous threat tracking active across banking, enterprise, and critical infrastructure."
  };

  const leadContext = buildLeadContext(leadThreat);
  const quickHits = sortedThreats.filter((t) => t.title !== leadThreat.title).slice(0, 3);

  // 2. Pick Scam Alert (strictly unsent only — if all scams have been sent, topScam = null and section is skipped!)
  const unsentScams = scamsData.filter((s) => !prevSentScams.has(s.id || s.title));
  const topScam = unsentScams.length > 0 ? unsentScams[dayOfYear % unsentScams.length] : null;

  // 3. Pick AI Tool (strictly unsent only — if all tools have been sent, featuredTool = null and section is skipped!)
  const unsentTools = toolsData.filter((t) => !prevSentTools.has(t.name));
  const featuredTool = unsentTools.length > 0 ? unsentTools[dayOfYear % unsentTools.length] : null;

  // 4. Pick AI Reality (strictly unsent only — if all realities have been sent, realityPick = null and section is skipped!)
  const unsentRealities = REALITIES_DATA.filter((r) => !prevSentRealities.has(r.id));
  const realityPick = unsentRealities.length > 0 ? unsentRealities[dayOfYear % unsentRealities.length] : null;

  // Update persistent ledger for today
  if (!isSameDay) {
    ledger.lastUpdatedDate = todayStr;
    if (leadThreat?.title && !ledger.sentLeadTitles.includes(leadThreat.title)) {
      ledger.sentLeadTitles.push(leadThreat.title);
    }
    if (topScam && !ledger.sentScamIds.includes(topScam.id || topScam.title)) {
      ledger.sentScamIds.push(topScam.id || topScam.title);
    }
    if (featuredTool && !ledger.sentToolNames.includes(featuredTool.name)) {
      ledger.sentToolNames.push(featuredTool.name);
    }
    if (realityPick && !ledger.sentRealityIds.includes(realityPick.id)) {
      ledger.sentRealityIds.push(realityPick.id);
    }
  }

  const briefing = {
    date: todayStr,
    dateFormatted,
    leadThreat: { ...leadThreat, synthesizedContext: leadContext },
    quickHits,
    topScam,
    featuredTool,
    realityPick
  };

  mkdirSync("public/data", { recursive: true });
  mkdirSync("public/newsletter", { recursive: true });

  // Save updated ledger & briefing JSON
  writeFileSync(SENT_LEDGER_PATH, JSON.stringify(ledger, null, 2), "utf8");
  writeFileSync("public/data/briefing.json", JSON.stringify(briefing, null, 2), "utf8");

  // Dynamic numbering so if any section is skipped, section numbers stay sequential (01, 02, 03...)
  let plainSecNum = 1;
  const plainSections = [];

  plainSections.push(`------------------------------------------------------------
${plainSecNum++}. CYBERSECURITY NEWS
------------------------------------------------------------

LEAD: ${leadThreat.title} (${leadThreat.sourceName})
• Why it matters: ${leadContext}
• Sector: ${leadThreat.entities || "Enterprise & Public Infrastructure"}

More on the Radar:
${quickHits.map((h) => `• ${h.title} (${h.sourceName})`).join("\n")}

Explore all live incidents: https://cipherati.com/cybersecurity-news.html`);

  if (topScam) {
    plainSections.push(`------------------------------------------------------------
${plainSecNum++}. SCAM ALERTS
------------------------------------------------------------

${topScam.title} [Vector: ${topScam.platform}]
• How it works: ${topScam.scam}
• Defense rule: ${topScam.protection}
• Helpline: Dial 1930 (National Cyber Helpline) or report at https://cipherati.com/scam-alerts.html`);
  }

  if (featuredTool) {
    plainSections.push(`------------------------------------------------------------
${plainSecNum++}. AI TOOLS
------------------------------------------------------------

Featured Tool: ${featuredTool.name}
• What it does: ${featuredTool.tagline}
• Browse ${toolsData.length} indexed tools: https://cipherati.com/ai-tools.html`);
  }

  if (realityPick) {
    plainSections.push(`------------------------------------------------------------
${plainSecNum++}. AI REALITIES
------------------------------------------------------------

Reality #${realityPick.id}: ${realityPick.title}
• The Hype Myth: "${realityPick.myth}"
• What Actually Works: ${realityPick.fix}
• Read all 22 production realities: https://cipherati.com/ai-realities.html`);
  }

  // 2. Generate Plain-Text / Markdown version (also used as MIME text/plain part for Primary Inbox deliverability)
  const plainText = `THE CIPHERATI BRIEFING — ${dateFormatted}
The 60-second morning intelligence scan: Cybersecurity News, Scam Alerts, AI Tools & AI Realities.
Read online: https://cipherati.com/

${plainSections.join("\n\n")}

------------------------------------------------------------
Cipherati.com — Independent AI & Cyber Intelligence
Manage preferences or unsubscribe: https://cipherati.com/#newsletter-unsubscribe
`;
  writeFileSync("public/newsletter/today.md", plainText, "utf8");

  let htmlSecNum = 1;
  const fmtSec = () => String(htmlSecNum++).padStart(2, "0");

  // 3. Generate Clean, Editorial Plain-Paper HTML Email (Axios / TLDR style — Primary Inbox optimized)
  // All links point strictly to https://cipherati.com to guarantee 100% sender-domain alignment.
  const htmlEmail = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Cipherati Briefing — ${escHtml(dateFormatted)}</title>
  <meta name="description" content="${escHtml(briefingMetaDescription({ leadThreat, topScam, featuredTool, realityPick }))}">
  <link rel="canonical" href="https://cipherati.com/newsletter/today.html">
</head>
<body style="margin:0;padding:24px 12px;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;line-height:1.6;-webkit-font-smoothing:antialiased;">
  <div style="max-width:600px;margin:0 auto;background-color:#ffffff;">

    <!-- EDITORIAL MASTHEAD -->
    <div style="border-bottom:2px solid #111827;padding-bottom:14px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="left" style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#2563eb;">
            THE CIPHERATI BRIEFING
          </td>
          <td align="right" style="font-size:12px;color:#6b7280;">
            ${escHtml(dateFormatted)} · 60-Sec Read
          </td>
        </tr>
      </table>
      <h1 style="margin:8px 0 4px;font-size:22px;line-height:1.3;font-weight:800;color:#111827;letter-spacing:-0.01em;">
        Morning Cyber &amp; AI Intelligence
      </h1>
      <p style="margin:0;font-size:13.5px;color:#4b5563;">
        Curated across <a href="https://cipherati.com/cybersecurity-news.html" style="color:#111827;text-decoration:underline;font-weight:600;">Cybersecurity News</a>, <a href="https://cipherati.com/scam-alerts.html" style="color:#111827;text-decoration:underline;font-weight:600;">Scam Alerts</a>, <a href="https://cipherati.com/ai-tools.html" style="color:#111827;text-decoration:underline;font-weight:600;">AI Tools</a> &amp; <a href="https://cipherati.com/ai-realities.html" style="color:#111827;text-decoration:underline;font-weight:600;">AI Realities</a>.
      </p>
    </div>

    <!-- CYBERSECURITY NEWS -->
    <div style="margin-bottom:26px;padding-bottom:22px;border-bottom:1px solid #e5e7eb;">
      <div style="font-size:11.5px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#2563eb;margin-bottom:8px;">
        ${fmtSec()} · CYBERSECURITY NEWS
      </div>

      <h2 style="margin:0 0 8px;font-size:17px;line-height:1.35;font-weight:700;color:#111827;">
        <a href="https://cipherati.com/cybersecurity-news.html" style="color:#111827;text-decoration:none;">
          ${escHtml(leadThreat.title)}
        </a>
      </h2>

      <p style="margin:0 0 10px;font-size:14px;color:#374151;">
        <strong>Why it matters:</strong> ${escHtml(leadContext)}
      </p>

      <div style="font-size:12.5px;color:#6b7280;margin-bottom:16px;">
        Source: <strong>${escHtml(leadThreat.sourceName)}</strong> · Sector: ${escHtml(leadThreat.entities || "Enterprise & Public Infrastructure")} · <a href="https://cipherati.com/cybersecurity-news.html" style="color:#2563eb;text-decoration:none;font-weight:600;">Read on Cipherati →</a>
      </div>

      ${
        quickHits.length > 0
          ? `
      <div style="background-color:#f9fafb;border-left:3px solid #cbd5e1;padding:12px 16px;">
        <div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#4b5563;margin-bottom:6px;">
          Also on the Radar
        </div>
        <ul style="margin:0;padding-left:18px;font-size:13.5px;color:#1f2937;">
          ${quickHits
            .map(
              (h) => `
          <li style="margin-bottom:6px;">
            <a href="https://cipherati.com/cybersecurity-news.html" style="color:#111827;text-decoration:none;font-weight:600;">${escHtml(h.title)}</a>
            <span style="color:#6b7280;font-size:12px;"> — ${escHtml(h.sourceName)}</span>
          </li>`
            )
            .join("")}
        </ul>
      </div>`
          : ""
      }
    </div>

    ${
      topScam
        ? `<!-- SCAM ALERTS -->
    <div style="margin-bottom:26px;padding-bottom:22px;border-bottom:1px solid #e5e7eb;">
      <div style="font-size:11.5px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#b91c1c;margin-bottom:8px;">
        ${fmtSec()} · SCAM ALERTS
      </div>

      <h2 style="margin:0 0 6px;font-size:16.5px;line-height:1.35;font-weight:700;color:#111827;">
        <a href="https://cipherati.com/scam-alerts.html" style="color:#111827;text-decoration:none;">
          ${escHtml(topScam.title)}
        </a>
        <span style="font-size:12px;font-weight:500;color:#6b7280;"> (${escHtml(topScam.platform)})</span>
      </h2>

      <p style="margin:0 0 8px;font-size:14px;color:#374151;">
        <strong>The pattern:</strong> ${escHtml(topScam.scam)}
      </p>

      <p style="margin:0 0 10px;font-size:14px;color:#111827;">
        <strong>Defense rule:</strong> ${escHtml(topScam.protection)}
      </p>

      <div style="font-size:12.5px;color:#6b7280;">
        National Cyber Helpline: Dial <strong>1930</strong> · <a href="https://cipherati.com/scam-alerts.html" style="color:#2563eb;text-decoration:none;font-weight:600;">View all 19 Scam Alerts →</a>
      </div>
    </div>`
        : ""
    }

    ${
      featuredTool
        ? `<!-- AI TOOLS -->
    <div style="margin-bottom:26px;padding-bottom:22px;border-bottom:1px solid #e5e7eb;">
      <div style="font-size:11.5px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#047857;margin-bottom:8px;">
        ${fmtSec()} · AI TOOLS
      </div>

      <h2 style="margin:0 0 6px;font-size:16.5px;line-height:1.35;font-weight:700;color:#111827;">
        <a href="https://cipherati.com/ai-tools.html" style="color:#111827;text-decoration:none;">
          ${escHtml(featuredTool.name)}
        </a>
      </h2>

      <p style="margin:0 0 8px;font-size:14px;color:#374151;">
        ${escHtml(featuredTool.tagline)}
      </p>

      <div style="font-size:12.5px;color:#6b7280;">
        <a href="https://cipherati.com/ai-tools.html" style="color:#2563eb;text-decoration:none;font-weight:600;">Explore ${toolsData.length} indexed AI developer tools on Cipherati →</a>
      </div>
    </div>`
        : ""
    }

    ${
      realityPick
        ? `<!-- AI REALITIES -->
    <div style="margin-bottom:26px;padding-bottom:22px;border-bottom:1px solid #e5e7eb;">
      <div style="font-size:11.5px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#4338ca;margin-bottom:8px;">
        ${fmtSec()} · AI REALITIES
      </div>

      <h2 style="margin:0 0 6px;font-size:16.5px;line-height:1.35;font-weight:700;color:#111827;">
        <a href="https://cipherati.com/ai-realities.html" style="color:#111827;text-decoration:none;">
          Reality #${escHtml(realityPick.id)}: ${escHtml(realityPick.title)}
        </a>
      </h2>

      <p style="margin:0 0 6px;font-size:13.5px;color:#6b7280;font-style:italic;">
        <strong>Common myth:</strong> "${escHtml(realityPick.myth)}"
      </p>

      <p style="margin:0 0 10px;font-size:14px;color:#111827;">
        <strong>What works in production:</strong> ${escHtml(realityPick.fix)}
      </p>

      <div style="font-size:12.5px;color:#6b7280;">
        <a href="https://cipherati.com/ai-realities.html" style="color:#2563eb;text-decoration:none;font-weight:600;">Read all 22 AI Realities →</a>
      </div>
    </div>`
        : ""
    }

    <!-- EDITORIAL FOOTER -->
    <div style="font-size:12px;color:#6b7280;line-height:1.6;">
      <p style="margin:0 0 6px;color:#111827;font-weight:600;">
        <a href="https://cipherati.com/ai-tools.html" style="color:#111827;text-decoration:none;">AI Tools</a> &nbsp;·&nbsp;
        <a href="https://cipherati.com/ai-realities.html" style="color:#111827;text-decoration:none;">AI Realities</a> &nbsp;·&nbsp;
        <a href="https://cipherati.com/cybersecurity-news.html" style="color:#111827;text-decoration:none;">Cybersecurity News</a> &nbsp;·&nbsp;
        <a href="https://cipherati.com/scam-alerts.html" style="color:#111827;text-decoration:none;">Scam Alerts</a>
      </p>
      <p style="margin:0;">
        Published by <a href="https://cipherati.com/" style="color:#2563eb;text-decoration:none;">Cipherati.com</a> · Sent with explicit consent under the India DPDP Act 2023.<br>
        <a href="https://cipherati.com/newsletter/today.html" style="color:#6b7280;text-decoration:underline;">View web version</a> &nbsp;·&nbsp;
        <a href="https://cipherati.com/#newsletter-unsubscribe" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
      </p>
    </div>

  </div>
</body>
</html>`;
  writeFileSync("public/newsletter/today.html", htmlEmail, "utf8");

  console.log(
    `[Newsletter] Generated today's briefing (${dateFormatted}): 1 Lead + ${quickHits.length} Quick Hits + 1 Scam Alert + 1 Tool & Reality.`
  );
  return briefing;
}
