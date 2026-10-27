// SQLite storage using Node's built-in driver (no native dependencies).
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.mjs";

let db;

export function getDb() {
  if (db) return db;
  mkdirSync(config.dataDir, { recursive: true });
  mkdirSync(config.logoDir, { recursive: true });
  db = new DatabaseSync(config.dbFile);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- One row per product, de-duplicated by canonical key (domain or repo path).
    CREATE TABLE IF NOT EXISTS items (
      id           INTEGER PRIMARY KEY,
      key          TEXT NOT NULL UNIQUE,
      name         TEXT NOT NULL,
      tagline      TEXT,
      url          TEXT NOT NULL,
      icon         TEXT,              -- local file name in data/logos
      emoji        TEXT,
      category     TEXT,
      tags         TEXT,              -- JSON array
      launched_at  INTEGER NOT NULL,  -- unix seconds (earliest launch seen)
      first_seen   INTEGER NOT NULL,
      last_seen    INTEGER NOT NULL,
      score        REAL NOT NULL DEFAULT 0,
      status       TEXT NOT NULL DEFAULT 'active',  -- active | hidden
      enriched_at  INTEGER,
      name_src     INTEGER NOT NULL DEFAULT 99,     -- priority of the source that set name/tagline
      tagline_src  INTEGER NOT NULL DEFAULT 99
    );
    CREATE INDEX IF NOT EXISTS items_launched ON items(status, launched_at DESC);
    CREATE INDEX IF NOT EXISTS items_score ON items(status, score DESC);

    -- Per-source evidence for an item (HN post, GitHub repo, HF Space, submission).
    CREATE TABLE IF NOT EXISTS signals (
      item_id     INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      source      TEXT NOT NULL,
      source_id   TEXT NOT NULL,
      source_url  TEXT,
      metric      REAL NOT NULL DEFAULT 0,  -- points / stars / likes
      velocity    REAL NOT NULL DEFAULT 0,  -- source-specific momentum
      extra       TEXT,                     -- JSON (comments, trendingScore, ...)
      updated_at  INTEGER NOT NULL,
      PRIMARY KEY (item_id, source)
    );
    CREATE INDEX IF NOT EXISTS signals_updated ON signals(source, updated_at);

    -- Metric history used to compute velocity between runs.
    CREATE TABLE IF NOT EXISTS snapshots (
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      source  TEXT NOT NULL,
      value   REAL NOT NULL,
      ts      INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS snapshots_lookup ON snapshots(item_id, source, ts);

    -- Public submissions awaiting moderation. No personal data is collected.
    CREATE TABLE IF NOT EXISTS submissions (
      id          INTEGER PRIMARY KEY,
      url         TEXT NOT NULL,
      name        TEXT,
      tagline     TEXT,
      created_at  INTEGER NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
      item_id     INTEGER REFERENCES items(id) ON DELETE SET NULL
    );

    -- Aggregate outbound clicks per item per day (no IPs stored).
    CREATE TABLE IF NOT EXISTS clicks (
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      day     TEXT NOT NULL,
      count   INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (item_id, day)
    );

    CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
  `);
  return db;
}

export const now = () => Math.floor(Date.now() / 1000);

export function getMeta(k, fallback = null) {
  const row = getDb().prepare("SELECT v FROM meta WHERE k = ?").get(k);
  return row ? JSON.parse(row.v) : fallback;
}

export function setMeta(k, v) {
  getDb().prepare("INSERT INTO meta(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(k, JSON.stringify(v));
}

// Run fn inside a transaction.
export function tx(fn) {
  const d = getDb();
  d.exec("BEGIN");
  try {
    const r = fn(d);
    d.exec("COMMIT");
    return r;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
