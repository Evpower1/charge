import 'server-only';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID, scryptSync, randomBytes } from 'node:crypto';

// A configured payment credential must never coexist with unauthenticated demo administration.
export const demoMode = process.env.APP_DEMO_MODE === 'true' && !process.env.CHAPA_SECRET_KEY;
const dbPath = resolve(/* turbopackIgnore: true */ process.env.DATABASE_PATH || '.data/evpower.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });
const globalDb = globalThis as unknown as { evDb?: DatabaseSync };
export const db = globalDb.evDb || new DatabaseSync(dbPath);
if (process.env.NODE_ENV !== 'production') globalDb.evDb = db;
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, phone TEXT DEFAULT '', role TEXT DEFAULT 'customer', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL, old_price INTEGER, description TEXT, power TEXT, connector TEXT, stock INTEGER DEFAULT 0, badge TEXT DEFAULT '', color TEXT DEFAULT 'white', featured INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS stations (id TEXT PRIMARY KEY, name TEXT, city TEXT, area TEXT, lat REAL, lng REAL, power TEXT, connectors TEXT, hours TEXT, verified INTEGER DEFAULT 0, source_url TEXT DEFAULT '', verified_at TEXT DEFAULT '', status TEXT DEFAULT 'Planned');
  CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), guest_token TEXT, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, city TEXT NOT NULL, address TEXT NOT NULL, subtotal INTEGER NOT NULL, delivery INTEGER NOT NULL, installation INTEGER NOT NULL, total INTEGER NOT NULL, status TEXT DEFAULT 'Received', payment_status TEXT DEFAULT 'pending', tx_ref TEXT UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY, order_id TEXT REFERENCES orders(id), product_id TEXT REFERENCES products(id), name TEXT, quantity INTEGER, price INTEGER);
  CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), name TEXT, email TEXT, phone TEXT, service TEXT, date TEXT, time TEXT, location TEXT, connector TEXT, notes TEXT, status TEXT DEFAULT 'Requested', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS addresses (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, label TEXT, city TEXT, address TEXT, phone TEXT);
  CREATE TABLE IF NOT EXISTS enquiries (id TEXT PRIMARY KEY, name TEXT, email TEXT, topic TEXT, message TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS content (id TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
`);
if (!db.prepare('SELECT id FROM products LIMIT 1').get()) {
  const products = [
    ['home-7', 'HomeCharge 7.4 kW', 'Home chargers', 42500, 48000, 'Your everyday charging, made effortless. A compact smart wallbox with app control, scheduled charging, and built-in safety protection. Professional installation available.', '7.4 kW', 'Type 2', 18, 'BESTSELLER', 'white', 1],
    ['home-22', 'HomeCharge Pro 22 kW', 'Home chargers', 68500, null, 'More power for your everyday. Three-phase smart charging with dynamic load balancing, RFID access, and a weatherproof enclosure.', '22 kW', 'Type 2', 12, 'SMART CHARGING', 'dark', 1],
    ['portable', 'GoCharge Portable', 'Portable chargers', 18500, 22000, 'Take a little peace of mind with you. Adjustable current, a clear display, and a five-metre cable for convenient charging wherever compatible power is available.', '3.7 kW', 'Type 2', 30, 'ON THE GO', 'portable', 1],
    ['cable', 'Type 2 Charging Cable', 'Accessories', 8500, null, 'A durable five-metre charging cable with ergonomic connectors and a protective carry bag. Supports three-phase charging up to 22 kW.', '22 kW', 'Type 2', 45, '', 'cable', 1],
    ['business-44', 'BusinessCharge Duo', 'Business chargers', 145000, null, 'Two vehicles. One elegant charging station. A dual-port solution for offices, hospitality, and commercial parking with RFID access management.', '2 × 22 kW', 'Type 2', 6, 'FOR BUSINESS', 'duo', 0],
    ['adapter', 'GB/T Charging Adapter', 'Accessories', 12500, null, 'A compact AC adapter for compatible GB/T vehicles. Check your vehicle specifications before ordering; our team can help you find the right fit.', '7.4 kW AC', 'GB/T', 20, '', 'adapter', 0]
  ];
  const insert = db.prepare('INSERT OR IGNORE INTO products VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const p of products) insert.run(...p);
}
if (!db.prepare('SELECT id FROM stations LIMIT 1').get()) {
  const insert = db.prepare('INSERT OR IGNORE INTO stations VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
  [
    ['addis-bole', 'Bole charging hub', 'Addis Ababa', 'Bole district', 8.989, 38.790, 'Up to 60 kW', 'CCS2 · Type 2', 'To be confirmed', 0, '', '', 'Planned'],
    ['addis-kazanchis', 'Kazanchis charging hub', 'Addis Ababa', 'Kirkos district', 9.011, 38.766, 'Up to 22 kW', 'Type 2 · GB/T', 'To be confirmed', 0, '', '', 'Planned'],
    ['addis-cmc', 'CMC charging hub', 'Addis Ababa', 'Yeka district', 9.030, 38.840, 'Up to 60 kW', 'CCS2 · Type 2', 'To be confirmed', 0, '', '', 'Planned'],
    ['adama-central', 'Adama charging hub', 'Adama', 'Central Adama', 8.540, 39.270, 'Up to 60 kW', 'CCS2 · Type 2', 'To be confirmed', 0, '', '', 'Planned']
  ].forEach(p => insert.run(...p));
}
db.prepare("INSERT OR IGNORE INTO content VALUES ('announcement', ?)").run('A cleaner drive. A brighter Ethiopia.');
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 12) {
  const email = process.env.ADMIN_EMAIL.toLowerCase().trim();
  if (!db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(process.env.ADMIN_PASSWORD, salt, 64).toString('hex');
    db.prepare('INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)').run(randomUUID(), 'Administrator', email, `${salt}:${hash}`, 'admin');
  }
}
