// Cipherati Web Push Dispatcher (powered by OneSignal REST API)
// Automatically alerts subscribed users on mobile & desktop when critical breaches are flagged.

import { readFileSync, existsSync } from "node:fs";

export async function dispatchCriticalThreatPush() {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    console.log("[Push] ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY not set. PWA web push service is ready to activate.");
    return { status: "ready_offline" };
  }

  const threatsPath = "public/data/threats.json";
  if (!existsSync(threatsPath)) {
    return { status: "skipped", reason: "no_threats_file" };
  }

  try {
    const data = JSON.parse(readFileSync(threatsPath, "utf8"));
    const criticalThreats = (data.threats || []).filter(t => t.severity === "critical");

    if (criticalThreats.length === 0) {
      console.log("[Push] No critical-severity cyber incidents requiring emergency push.");
      return { status: "no_critical_incidents" };
    }

    const topThreat = criticalThreats[0];
    console.log(`[Push] Dispatching emergency cyber alert: "${topThreat.title}"...`);

    const payload = {
      app_id: appId,
      included_segments: ["Subscribed Users"],
      headings: { en: "🚨 Cipherati Urgent Cyber Alert" },
      contents: { en: `${topThreat.title} (Source: ${topThreat.sourceName})` },
      url: `https://cipherati.com/#threat-${topThreat.id}`,
      web_buttons: [
        {
          id: "read-intel",
          text: "View Threat Intel ↗",
          icon: "https://cipherati.com/favicon.svg",
          url: `https://cipherati.com/#threat-${topThreat.id}`
        }
      ]
    };

    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (res.ok) {
      console.log(`[Push] Push alert broadcasted successfully! Recipients: ${result.recipients || 0}`);
      return { status: "sent", id: result.id, recipients: result.recipients };
    } else {
      console.warn(`[Push] OneSignal API error (${res.status}):`, result.errors || result);
      return { status: "error", error: result };
    }
  } catch (err) {
    console.warn("[Push] Error dispatching push notification:", err.message);
    return { status: "error", error: err.message };
  }
}
