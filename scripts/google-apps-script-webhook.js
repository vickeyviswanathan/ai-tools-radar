/**
 * Cipherati Newsletter Subscriber Webhook & Instant Alert Dispatcher
 *
 * HOW IT WORKS:
 * 1. Accepts POST requests from cipherati.com containing { email, timestampIST, consent, source }
 * 2. Appends the subscriber to your Google Sheet with audit metadata (Timestamp, Email, Consent Details, Source, Status)
 * 3. Immediately triggers MailApp.sendEmail() sending a notification directly to YOUR inbox
 * 4. Zero third-party fees, zero monthly costs, 100% Google infrastructure.
 */

// If left blank, it will automatically email the Google account owning this spreadsheet
const NOTIFICATION_RECIPIENT = ""; // e.g. "vivek@example.com" or leave empty to use current user
const SHEET_NAME = "Subscribers";

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  const headers = [
    "Timestamp (IST)",
    "Subscriber Email",
    "Consent & Compliance Details",
    "Source URL",
    "Status"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f0f4f8");
  sheet.setFrozenRows(1);
}

function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const email = (payload.email || "").toString().trim().toLowerCase();
    const strictEmailRe = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || email.length > 254 || !strictEmailRe.test(email) || /^[=+\-@\t\r]/.test(email)) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid email" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const safeCell = function(val, fallback) {
      let s = (val || fallback || "").toString().replace(/[\r\n]+/g, " ").trim().slice(0, 200);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return s;
    };

    const timestampIST = safeCell(payload.timestampIST, Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss 'IST'"));
    const consent = safeCell(payload.consent, "Explicit opt-in for Cipherati 60-Second Daily Morning Intelligence Briefing under DPDP Act 2023");
    const source = safeCell(payload.source, "https://cipherati.com");

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      setupSheet();
      sheet = ss.getSheetByName(SHEET_NAME);
    }

    // Check for duplicates
    const data = sheet.getDataRange().getValues();
    let alreadyExists = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] && data[i][1].toString().trim().toLowerCase() === email) {
        alreadyExists = true;
        break;
      }
    }

    if (!alreadyExists) {
      sheet.appendRow([timestampIST, email, consent, source, "Active"]);

      // Send instant email notification to you
      const recipient = NOTIFICATION_RECIPIENT || Session.getActiveUser().getEmail();
      if (recipient) {
        const subject = "🔔 New Cipherati Subscriber: " + email;
        const body =
          "Hello Vivek,\n\n" +
          "You have a new subscriber for The Cipherati Briefing!\n\n" +
          "• Email: " + email + "\n" +
          "• Timestamp: " + timestampIST + "\n" +
          "• Consent Record: " + consent + "\n" +
          "• Source: " + source + "\n\n" +
          "This subscriber has been recorded in your Google Sheet:\n" +
          ss.getUrl() + "\n\n" +
          "— Cipherati Notification Bot";

        MailApp.sendEmail({
          to: recipient,
          subject: subject,
          body: body
        });
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", duplicate: alreadyExists }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Request processing failed" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
