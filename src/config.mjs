// Central configuration — everything is overridable with environment variables.
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = process.env;
const num = (v, d) => (v === undefined || v === "" || Number.isNaN(Number(v)) ? d : Number(v));
const bool = (v, d = false) => (v === undefined || v === "" ? d : /^(1|true|yes|on)$/i.test(v));

export const config = {
  appName: env.APP_NAME ?? "AI Tools Radar",
  // Public base URL (used in the bot User-Agent and canonical links).
  publicUrl: env.PUBLIC_URL ?? "http://localhost:4317",
  contactEmail: env.CONTACT_EMAIL ?? "",
  port: num(env.PORT, 4317),
  host: env.HOST ?? "0.0.0.0",
  // Only trust X-Forwarded-For when running behind your own reverse proxy / PaaS router.
  trustProxy: bool(env.TRUST_PROXY),
  // Send HSTS only when the site is served over HTTPS.
  https: bool(env.HTTPS),

  dataDir: path.resolve(ROOT, env.DATA_DIR ?? "data"),
  get dbFile() { return path.join(this.dataDir, "radar.db"); },
  get logoDir() { return path.join(this.dataDir, "logos"); },

  // Ingestion schedule (minutes). 0 disables the in-process scheduler (use `npm run ingest` from cron instead).
  ingestIntervalMin: num(env.INGEST_INTERVAL_MIN, 60),
  // How many items to enrich (visit their own website) per ingest run.
  enrichPerRun: num(env.ENRICH_PER_RUN, 40),
  githubToken: env.GITHUB_TOKEN ?? "",

  // Moderation: admin API is disabled unless a long random token is set.
  adminToken: env.ADMIN_TOKEN ?? "",

  // Ads stay off until you are approved by an ad network and have a consent banner.
  ads: {
    enabled: bool(env.ADS_ENABLED),
    every: num(env.ADS_EVERY, 9), // insert an ad slot after every N cards
    adsTxt: env.ADS_TXT ?? "", // contents of /ads.txt (e.g. "google.com, pub-XXXX, DIRECT, f08c47fec0942fa0")
  },
};

export const userAgent = () =>
  `AIToolsRadarBot/1.0 (+${config.publicUrl}/about.html${config.contactEmail ? "; " + config.contactEmail : ""})`;
