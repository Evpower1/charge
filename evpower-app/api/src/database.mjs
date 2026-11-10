import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(path = '.data/mobile.sqlite') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      phone TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer',
      email_verified INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), family TEXT NOT NULL,
      access_hash TEXT NOT NULL UNIQUE, refresh_hash TEXT NOT NULL UNIQUE,
      access_expires TEXT NOT NULL, refresh_expires TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0,
      revoked INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_family ON sessions(family);
    CREATE TABLE IF NOT EXISTS action_tokens (
      hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL,
      expires_at TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), make TEXT NOT NULL,
      model TEXT NOT NULL, plate TEXT NOT NULL, connector TEXT NOT NULL, battery_kwh REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS addresses (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), label TEXT NOT NULL,
      address TEXT NOT NULL, latitude REAL, longitude REAL
    );
    CREATE TABLE IF NOT EXISTS stations (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, address TEXT NOT NULL,
      latitude REAL NOT NULL, longitude REAL NOT NULL, verified INTEGER NOT NULL DEFAULT 0,
      is_demo INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS connectors (
      id TEXT NOT NULL, station_id TEXT NOT NULL REFERENCES stations(id), type TEXT NOT NULL,
      power_kw REAL NOT NULL, status TEXT NOT NULL DEFAULT 'unknown', last_seen_at TEXT,
      PRIMARY KEY(station_id,id)
    );
    CREATE TABLE IF NOT EXISTS telemetry_events (id TEXT PRIMARY KEY, received_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL, city TEXT NOT NULL, address TEXT NOT NULL, latitude REAL, longitude REAL,
      connector TEXT NOT NULL, requested_kwh REAL NOT NULL, scheduled_at TEXT, notes TEXT NOT NULL,
      vehicle_id TEXT, quote_minor INTEGER, payment_status TEXT NOT NULL DEFAULT 'unpaid',
      dispatch_name TEXT, dispatch_phone TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL, UNIQUE(user_id,idempotency_key)
    );
    CREATE TABLE IF NOT EXISTS booking_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, booking_id TEXT NOT NULL REFERENCES bookings(id),
      status TEXT NOT NULL, message TEXT NOT NULL, at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS balances (user_id TEXT PRIMARY KEY REFERENCES users(id), balance_minor INTEGER NOT NULL DEFAULT 0 CHECK(balance_minor>=0));
    CREATE TABLE IF NOT EXISTS ledger (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL,
      amount_minor INTEGER NOT NULL, balance_after_minor INTEGER NOT NULL, reference TEXT NOT NULL,
      created_at TEXT NOT NULL, UNIQUE(kind,reference)
    );
    CREATE TRIGGER IF NOT EXISTS ledger_no_update BEFORE UPDATE ON ledger BEGIN SELECT RAISE(ABORT,'Ledger is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON ledger BEGIN SELECT RAISE(ABORT,'Ledger is append-only'); END;
    CREATE TABLE IF NOT EXISTS topups (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), reference TEXT NOT NULL UNIQUE,
      amount_minor INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', checkout_url TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
      message TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), subject TEXT NOT NULL,
      message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT NOT NULL, action TEXT NOT NULL,
      target_id TEXT NOT NULL, created_at TEXT NOT NULL
    );
  `);
  if (path !== ':memory:') chmodSync(path, 0o600);
  return db;
}

export function transaction(db, callback) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = callback(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
