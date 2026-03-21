import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

function resolveStateDir() {
  return process.env.OPENCLAW_STATE_DIR?.trim() || path.join(os.homedir(), ".openclaw");
}

const SETUP_DB_PATH = path.join(resolveStateDir(), "setup-ui.sqlite");

let db;

function getDb() {
  if (!db) {
    fs.mkdirSync(resolveStateDir(), { recursive: true });
    db = new DatabaseSync(SETUP_DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS setup_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  return db;
}

function clampText(value, maxLength) {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n...[truncated]`;
}

export function getSetupDbPath() {
  return SETUP_DB_PATH;
}

export function listSetupEvents(limit = 120) {
  const safeLimit = Math.max(1, Math.min(500, Number.parseInt(String(limit), 10) || 120));
  const stmt = getDb().prepare(`
    SELECT id, source, title, body, created_at AS createdAt
    FROM setup_events
    ORDER BY id DESC
    LIMIT ?
  `);

  return stmt.all(safeLimit).reverse();
}

export function appendSetupEvent({ source = "system", title, body = "" }) {
  const stmt = getDb().prepare(`
    INSERT INTO setup_events (source, title, body)
    VALUES (?, ?, ?)
  `);

  stmt.run(clampText(source, 64), clampText(title, 240), clampText(body, 24_000));
}
