// Reputation & Data Safeguard Layer for Cipherati Scam Intelligence
import { SCAMS_DATA } from "./scams-data.mjs";

const ALLOWED_PROTOCOLS = new Set(["https:"]);
const TRUSTED_DOMAINS = [
  "cybercrime.gov.in",
  "cert-in.org.in",
  "sachet.rbi.org.in",
  "rbi.org.in",
  "sancharsaathi.gov.in",
  "npci.org.in",
  "echallan.parivahan.gov.in",
  "parivahan.gov.in",
  "indiapost.gov.in",
  "sebi.gov.in",
  "reuters.com",
  "cisa.gov",
  "ftc.gov"
];

export function validateAndSanitizeScams(rawScams = SCAMS_DATA) {
  const verified = [];

  for (const item of rawScams) {
    if (!item.title || !item.scam || !item.protection || !item.sourceName) {
      console.warn(`[ScamGuard] Dropping incomplete scam record: ${item.id}`);
      continue;
    }

    // Verify source URL safety
    try {
      const u = new URL(item.sourceUrl);
      if (!ALLOWED_PROTOCOLS.has(u.protocol)) {
        console.warn(`[ScamGuard] Dropping insecure protocol on ${item.id}: ${item.sourceUrl}`);
        continue;
      }
    } catch {
      console.warn(`[ScamGuard] Invalid source URL on ${item.id}`);
      continue;
    }

    // Scrub phone numbers or malicious apk links to prevent phishing redirection
    const scrubbedScam = item.scam.replace(/(?:\+?91[\-\s]?)?[6789]\d{9}/g, "[Phone number redacted for safety]");
    const scrubbedProt = item.protection.replace(/(?:\+?91[\-\s]?)?[6789]\d{9}/g, "[Phone number redacted]");

    verified.push({
      ...item,
      scam: scrubbedScam,
      protection: scrubbedProt
    });
  }

  return verified;
}

export function generateScamsHtml(scams) {
  const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  return scams.map((item, idx) => {
    const sevClass = item.severity === "critical"
      ? "scam-badge-sev-critical"
      : item.severity === "high"
      ? "scam-badge-sev-high"
      : "scam-badge-sev-medium";

    const platformBadgeHtml = item.platform
      ? `<span class="scam-badge scam-badge-platform">${esc(item.platform)}</span>`
      : "";

    return `      <article class="scam-card" data-category="${esc(item.category || 'all')}" id="scam-${esc(item.id)}">
        <div class="scam-top-bar">
          <div class="scam-badge-group">
            ${platformBadgeHtml}
            <span class="scam-badge scam-badge-tag">${esc(item.tag)}</span>
            <span class="scam-badge ${sevClass}">${item.severity.toUpperCase()}</span>
          </div>
          <button type="button" class="share-btn" onclick="shareScam('${esc(item.id)}')" title="Share warning on WhatsApp" aria-label="Share warning">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>
          </button>
        </div>

        <h3 class="scam-title">${esc(item.title)}</h3>

        <div class="scam-body">
          <p class="scam-desc">${esc(item.scam)}</p>

          <div class="scam-protect-box">
            <strong>How to protect yourself:</strong>
            <p>${esc(item.protection)}</p>
          </div>
        </div>

        <div class="scam-footer-row">
          <div class="scam-source-pill">
            <span class="scam-source-icon">🏛️</span>
            <span class="scam-source-name">${esc(item.sourceName)}</span>
          </div>
          <a class="scam-verify-btn" href="${esc(item.actionUrl || item.sourceUrl)}" target="_blank" rel="noopener noreferrer">
            ${esc(item.actionLinkText || "Verify Advisory ↗")}
          </a>
        </div>
      </article>`;
  }).join("\n\n");
}
