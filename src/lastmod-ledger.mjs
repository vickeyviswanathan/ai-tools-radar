// Content-hash ledger for honest sitemap <lastmod> / dateModified values.
//
// A page's lastmod only moves when the hash of its *substantive* content changes (the caller decides what counts,
// e.g. a tool's name/tagline/summary, not its GitHub star count). New URLs are stamped with the build date the first
// time they are seen. The ledger lives in data/lastmod-ledger.json and is committed by the existing scheduled
// workflow step, so dates survive across builds instead of being reset to "today" on every run.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const DEFAULT_PATH = "./data/lastmod-ledger.json";

function hashOf(payload) {
  return createHash("sha1").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

export function createLedger({ file = DEFAULT_PATH, today = process.env.CIPHERATI_BUILD_DATE || new Date().toISOString().slice(0, 10) } = {}) {
  let previous = {};
  if (existsSync(file)) {
    try { previous = JSON.parse(readFileSync(file, "utf8")); } catch { previous = {}; }
  }
  const next = {};

  return {
    /** Returns the lastmod (YYYY-MM-DD) for `url` given its substantive-content payload. */
    stamp(url, payload) {
      const h = hashOf(payload);
      const prev = previous[url];
      const entry = prev && prev.hash === h ? prev : { hash: h, lastmod: today };
      next[url] = entry;
      return entry.lastmod;
    },
    /** Persist (only URLs stamped in this run are kept, so removed pages drop out). Returns true if the file changed. */
    save() {
      const sorted = Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]]));
      const text = JSON.stringify(sorted, null, 2) + "\n";
      const before = existsSync(file) ? readFileSync(file, "utf8").replace(/\r\n/g, "\n") : "";
      if (before === text) return false;
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, text, "utf8");
      return true;
    },
    today
  };
}
