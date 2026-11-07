// Cipherati Automated Email Dispatcher (powered by Resend API)
// Integrates seamlessly with the morning intelligence briefing pipeline.
// If RESEND_API_KEY is configured in environment / GitHub Secrets, broadcasts today.html.
// Otherwise, safely logs instructions and exits without blocking the build.

import { readFileSync, existsSync } from "node:fs";

export async function dispatchDailyNewsletter() {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Cipherati Briefing <briefing@cipherati.com>";

  const todayHtmlPath = "public/newsletter/today.html";
  const briefingJsonPath = "public/data/briefing.json";

  if (!existsSync(todayHtmlPath)) {
    console.log("[Newsletter] today.html does not exist yet. Skipping dispatch.");
    return { status: "skipped", reason: "no_file" };
  }

  const htmlContent = readFileSync(todayHtmlPath, "utf8");
  let subject = "The Cipherati Morning Briefing";

  if (existsSync(briefingJsonPath)) {
    try {
      const briefing = JSON.parse(readFileSync(briefingJsonPath, "utf8"));
      if (briefing.dateFormatted) {
        subject = `⚡ Cipherati Daily Intelligence — ${briefing.dateFormatted}`;
      }
    } catch {}
  }

  if (!apiKey) {
    console.log("[Newsletter] RESEND_API_KEY not configured. Briefing compiled & ready at public/newsletter/today.html.");
    console.log("[Newsletter] (Add RESEND_API_KEY and RESEND_AUDIENCE_ID to GitHub Secrets to enable automatic delivery).");
    return { status: "ready_offline", subject };
  }

  try {
    console.log(`[Newsletter] Broadcasting morning briefing via Resend API: "${subject}"...`);

    // If an Audience ID is provided, broadcast to audience or send batch
    const payload = {
      from: fromEmail,
      to: [fromEmail], // Fallback or broadcast target
      subject,
      html: htmlContent,
      headers: {
        "List-Unsubscribe": "<https://cipherati.com/#newsletter-unsubscribe>",
        "X-Entity-Ref-ID": `cipherati-${new Date().toISOString().split("T")[0]}`
      }
    };

    // If audience provided, send broadcast to audience contacts
    if (audienceId) {
      payload.audience_id = audienceId;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok) {
      console.log(`[Newsletter] Successfully dispatched morning briefing! Email ID: ${data.id}`);
      return { status: "sent", id: data.id };
    } else {
      console.warn(`[Newsletter] Resend API responded with status ${res.status}:`, data.message || data);
      return { status: "error", error: data };
    }
  } catch (err) {
    console.warn("[Newsletter] Network error contacting Resend API:", err.message);
    return { status: "error", error: err.message };
  }
}
