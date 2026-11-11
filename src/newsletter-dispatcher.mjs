// Cipherati Automated Email Dispatcher & Google Sheet Subscriber Sync (powered by Resend API)
// 1. Reads live subscriber & unsubscribe rows from the linked Google Sheet CSV
// 2. Syncs new subscribers into Resend Audience, removes unsubscribed contacts (DPDP Act 2023 Section 6(4)), & notifies admin
// 3. Broadcasts multipart (HTML + Plain Text) today.html + today.md at 8:00 AM IST from The Cipherati Briefing <briefing@cipherati.com>

import { readFileSync, existsSync } from "node:fs";

function escHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STRICT_EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Default public-read CSV feed for the Google Form subscriber audit log (overridable via env secret)
const DEFAULT_SHEET_CSV = Buffer.from(
  "aHR0cHM6Ly9kb2NzLmdvb2dsZS5jb20vc3ByZWFkc2hlZXRzL2QvZS8yUEFDWC0xdlJpTUNUcDA1SU5sWjBVSTVQcWlaVXZUSVJHN0RjdDBxb3lXQzBBZDFKVWdlZm5XcjJhaDdhYnB0Mk4xQVFWWlEzdUNRc25YVWt3NHREci9wdWI/b3V0cHV0PWNzdg==",
  "base64"
).toString("utf8");
const GOOGLE_SHEET_CSV_URL = process.env.GOOGLE_SHEET_CSV_URL || DEFAULT_SHEET_CSV;
const GOOGLE_SHEET_EDIT_URL = process.env.GOOGLE_SHEET_EDIT_URL || "https://docs.google.com/spreadsheets/";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";

function getCurrentIstMinutes() {
  // IST is UTC + 5 hours 30 minutes (330 minutes)
  const now = new Date();
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return (utcMinutes + 330) % 1440;
}

export async function dispatchDailyNewsletter() {
  const apiKey = process.env.RESEND_API_KEY;
  let audienceId = process.env.RESEND_AUDIENCE_ID || "";
  const fromEmail = process.env.RESEND_FROM_EMAIL || "The Cipherati Briefing <briefing@cipherati.com>";

  const todayHtmlPath = "public/newsletter/today.html";
  const todayMdPath = "public/newsletter/today.md";
  const briefingJsonPath = "public/data/briefing.json";

  if (!existsSync(todayHtmlPath)) {
    console.log("[Newsletter] today.html does not exist yet. Skipping dispatch.");
    return { status: "skipped", reason: "no_file" };
  }

  const htmlContent = readFileSync(todayHtmlPath, "utf8");
  const textContent = existsSync(todayMdPath)
    ? readFileSync(todayMdPath, "utf8")
    : "Read today's Cipherati Briefing at https://cipherati.com/";

  let subject = "The Cipherati Briefing";

  if (existsSync(briefingJsonPath)) {
    try {
      const briefing = JSON.parse(readFileSync(briefingJsonPath, "utf8"));
      if (briefing.dateFormatted) {
        subject = `The Cipherati Briefing — ${briefing.dateFormatted}`;
      }
    } catch {}
  }

  // 1. Fetch live subscribers & unsubscribe requests from Google Sheet CSV (if private GOOGLE_SHEET_CSV_URL secret is configured)
  const sheetSubscribersMap = new Map();
  const unsubscribedEmails = new Set();

  if (GOOGLE_SHEET_CSV_URL) {
    try {
      const csvRes = await fetch(GOOGLE_SHEET_CSV_URL);
      if (csvRes.ok) {
        const csvText = await csvRes.text();
        const lines = csvText.trim().split(/\r?\n/).slice(1);
        for (const line of lines) {
          const parts = line.split(",");
          if (parts.length >= 2) {
            const timestamp = parts[0].replace(/^"|"$/g, "").trim();
            const email = parts[1].replace(/^"|"$/g, "").trim().toLowerCase();
            const consent = parts.slice(2).join(",").replace(/^"|"$/g, "").trim() || "Explicit opt-in under DPDP Act 2023";
            if (email && STRICT_EMAIL_RE.test(email)) {
              if (/^UNSUBSCRIBE/i.test(consent)) {
                unsubscribedEmails.add(email);
                sheetSubscribersMap.delete(email);
              } else {
                unsubscribedEmails.delete(email);
                sheetSubscribersMap.set(email, { timestamp, email, consent });
              }
            }
          }
        }
        console.log(`[Newsletter] Synced ${sheetSubscribersMap.size} active subscriber(s) and ${unsubscribedEmails.size} opt-out(s) from Google Sheet audit log.`);
      }
    } catch (err) {
      console.warn("[Newsletter] Could not fetch Google Sheet CSV:", err.message);
    }
  }

  const sheetSubscribers = [...sheetSubscribersMap.values()];

  if (!apiKey) {
    console.log("[Newsletter] RESEND_API_KEY not configured. Briefing compiled & ready at public/newsletter/today.html.");
    return { status: "ready_offline", subject, sheetCount: sheetSubscribers.length };
  }

  try {
    // 2. Auto-discover Resend Audience ID if not explicitly passed in environment
    if (!audienceId) {
      try {
        const audRes = await fetch("https://api.resend.com/audiences", {
          headers: { "Authorization": `Bearer ${apiKey}` }
        });
        if (audRes.ok) {
          const audData = await audRes.json();
          if (Array.isArray(audData.data) && audData.data.length > 0) {
            audienceId = audData.data[0].id;
          }
        }
      } catch {}
    }

    // 3. Fetch existing Resend Audience contacts, process unsubscribes, & sync any new subscribers from Google Sheet
    const existingEmails = new Set();
    const activeAudienceEmails = new Set();
    const newlyAddedEmails = [];

    if (audienceId) {
      try {
        const contactsRes = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
          headers: { "Authorization": `Bearer ${apiKey}` }
        });
        if (contactsRes.ok) {
          const contactsData = await contactsRes.json();
          for (const c of contactsData.data || []) {
            if (c.email) {
              const norm = c.email.trim().toLowerCase();
              existingEmails.add(norm);
              if (!c.unsubscribed && !unsubscribedEmails.has(norm)) {
                activeAudienceEmails.add(norm);
              }
              // If user submitted an UNSUBSCRIBE via the website, mark them unsubscribed in Resend Audience
              if (!c.unsubscribed && unsubscribedEmails.has(norm) && c.id) {
                try {
                  await fetch(`https://api.resend.com/audiences/${audienceId}/contacts/${c.id}`, {
                    method: "PATCH",
                    headers: {
                      "Authorization": `Bearer ${apiKey}`,
                      "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ unsubscribed: true })
                  });
                  console.log(`[Newsletter] Processed DPDP unsubscribe for ${norm}`);
                } catch {}
              }
            }
          }
        }
      } catch (e) {
        console.warn("[Newsletter] Could not fetch audience contacts:", e.message);
      }

      // Sync new Google Sheet subscribers into Resend Audience & notify admin
      for (const sub of sheetSubscribers) {
        if (unsubscribedEmails.has(sub.email)) continue;
        activeAudienceEmails.add(sub.email);
        if (!existingEmails.has(sub.email)) {
          existingEmails.add(sub.email);
          newlyAddedEmails.push(sub.email);
          try {
            await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ email: sub.email, unsubscribed: false })
            });
            if (ADMIN_EMAIL) {
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${apiKey}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  from: fromEmail,
                  to: [ADMIN_EMAIL],
                  subject: `New Cipherati Subscriber: ${sub.email.replace(/[\r\n]/g, "")}`,
                  text: `New Cipherati Briefing Subscriber\n\nEmail: ${sub.email}\nTimestamp: ${sub.timestamp}\nConsent Record: ${sub.consent}\nGoogle Sheet: ${GOOGLE_SHEET_EDIT_URL}`,
                  html: `<div style="font-family:sans-serif;max-width:600px;padding:20px;border:1px solid #e2e8f0;border-radius:10px;">
                    <h3>New Cipherati Briefing Subscriber</h3>
                    <p><strong>Subscriber Email:</strong> ${escHtml(sub.email)}</p>
                    <p><strong>Timestamp:</strong> ${escHtml(sub.timestamp)}</p>
                    <p><strong>Consent Record:</strong> ${escHtml(sub.consent)}</p>
                    <p><a href="${GOOGLE_SHEET_EDIT_URL}" style="color:#2563eb;font-weight:bold;">Open Subscriber Google Sheet →</a></p>
                  </div>`
                })
              });
            }
          } catch {}
        }
      }
    }

    // 3. Enforce 8:00 AM IST Morning Dispatch Window (07:45 AM IST = 465 mins)
    // If ANY run (schedule, push, or manual) executes before 07:45 AM IST, we use Resend's exact-minute `scheduled_at` parameter
    // to lock delivery to 08:00:00 AM IST sharp (02:30:00Z), bypassing GitHub Actions cron jitter completely!
    const eventName = process.env.GITHUB_EVENT_NAME || "";
    const forceSend = process.env.FORCE_NEWSLETTER_SEND === "true";
    const istMins = getCurrentIstMinutes();
    const isMorningWindowReached = istMins >= 465; // >= 07:45 AM IST

    let scheduledAtIso = null;
    if (!forceSend && !isMorningWindowReached) {
      // Compute the next upcoming 08:00:00 AM IST (02:30:00 UTC)
      const nowUtc = new Date();
      let targetUtc = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate(), 2, 30, 0));
      if (targetUtc.getTime() <= nowUtc.getTime() + 60000) {
        targetUtc = new Date(targetUtc.getTime() + 24 * 60 * 60 * 1000);
      }
      scheduledAtIso = targetUtc.toISOString();
    }

    // 4. Check if today's daily briefing has already been broadcast or scheduled today (prevents duplicate sends on 6h runs)
    let alreadySentToday = false;
    try {
      const recentRes = await fetch("https://api.resend.com/emails", {
        headers: { "Authorization": `Bearer ${apiKey}` }
      });
      if (recentRes.ok) {
        const recentData = await recentRes.json();
        alreadySentToday = (recentData.data || []).some((e) => e.subject === subject && e.last_event !== "canceled");
      }
    } catch {}

    let recipients = [];
    if (alreadySentToday) {
      recipients = newlyAddedEmails;
      scheduledAtIso = null; // Newly joined subscribers get immediate catch-up issue
      if (recipients.length === 0) {
        console.log(`[Newsletter] Today's issue ("${subject}") was already broadcast/scheduled earlier today. No new subscribers to catch up.`);
        return { status: "already_sent_today", subject };
      }
      console.log(`[Newsletter] Sending today's issue to ${recipients.length} newly joined subscriber(s)...`);
    } else if (!forceSend && (eventName === "push" || (!isMorningWindowReached && !scheduledAtIso))) {
      // If a push happens or local build runs before 8:00 AM IST, only send to brand-new signups if any
      recipients = newlyAddedEmails;
      if (recipients.length === 0) {
        console.log(`[Newsletter] Holding morning broadcast ("${subject}") until the 8:00 AM IST scheduled run (current IST minute: ${istMins}, event: ${eventName || "local"}).`);
        return { status: "held_for_8am_ist", subject };
      }
    } else {
      recipients = activeAudienceEmails.size > 0 ? [...activeAudienceEmails] : (ADMIN_EMAIL ? [ADMIN_EMAIL] : []);
      if (recipients.length === 0) {
        console.log("[Newsletter] No active recipients found in Resend Audience.");
        return { status: "skipped", reason: "no_recipients" };
      }
      if (scheduledAtIso) {
        console.log(`[Newsletter] Queuing morning briefing ("${subject}") in Resend for exact 8:00 AM IST delivery (${scheduledAtIso}) to ${recipients.length} subscriber(s)...`);
      } else {
        console.log(`[Newsletter] Broadcasting 8:00 AM IST morning briefing ("${subject}") from ${fromEmail} to ${recipients.length} subscriber(s)...`);
      }
    }

    // 5. Dispatch via Resend API with BOTH html and text parts (multipart/alternative)
    const todayIsoDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    if (scheduledAtIso) {
      const ids = [];
      for (const email of recipients.slice(0, 100)) {
        const singleRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [email],
            subject,
            html: htmlContent,
            text: textContent,
            scheduled_at: scheduledAtIso,
            headers: {
              "List-Unsubscribe": "<https://cipherati.com/#newsletter-unsubscribe>",
              "X-Entity-Ref-ID": `cipherati-${todayIsoDate}-${email}`
            }
          })
        });
        const singleData = await singleRes.json();
        if (singleRes.ok && singleData.id) ids.push(singleData.id);
      }
      console.log(`[Newsletter] Successfully scheduled ${ids.length} email(s) in Resend for exact 8:00 AM IST delivery (${scheduledAtIso})!`);
      return { status: "scheduled_for_8am_ist", scheduledAt: scheduledAtIso, count: ids.length, ids };
    }

    const batchPayload = recipients.slice(0, 100).map((email) => ({
      from: fromEmail,
      to: [email],
      subject,
      html: htmlContent,
      text: textContent,
      headers: {
        "List-Unsubscribe": "<https://cipherati.com/#newsletter-unsubscribe>",
        "X-Entity-Ref-ID": `cipherati-${todayIsoDate}-${email}`
      }
    }));

    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(batchPayload)
    });

    const data = await res.json();
    if (res.ok) {
      console.log(`[Newsletter] Successfully dispatched morning briefing to ${batchPayload.length} subscriber(s)!`);
      return { status: "sent", count: batchPayload.length, data };
    } else {
      console.warn(`[Newsletter] Resend API responded with status ${res.status}:`, data.message || data);
      return { status: "error", error: data };
    }
  } catch (err) {
    console.warn("[Newsletter] Network error contacting Resend API:", err.message);
    return { status: "error", error: err.message };
  }
}
