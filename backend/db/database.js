const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'civic.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
// Disable CHECK constraints so we can migrate existing rows safely
db.pragma('ignore_check_constraints = ON');

// --- USERS ---
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user','worker')),
    ward TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// --- COMPLAINTS ---
db.exec(`
  CREATE TABLE IF NOT EXISTS complaints (
    id TEXT PRIMARY KEY,
    citizen_id TEXT NOT NULL,
    description TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    address TEXT,
    photo_url TEXT,
    ai_category TEXT,
    ai_confidence REAL,
    category TEXT,
    status TEXT DEFAULT 'Submitted',
    priority_score REAL DEFAULT 0,
    assigned_worker_id TEXT,
    reject_reason TEXT,
    after_photo_url TEXT,
    worker_note TEXT,
    is_duplicate INTEGER DEFAULT 0,
    duplicate_of TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT,
    FOREIGN KEY(citizen_id) REFERENCES users(id),
    FOREIGN KEY(assigned_worker_id) REFERENCES users(id)
  )
`);

// Migrate: rename any old 'Verified' status to 'Assigned' so existing data stays valid
db.prepare(`UPDATE complaints SET status = 'Assigned' WHERE status = 'Verified'`).run();

// --- STATUS HISTORY ---
db.exec(`
  CREATE TABLE IF NOT EXISTS status_history (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL,
    status TEXT NOT NULL,
    changed_by TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(complaint_id) REFERENCES complaints(id)
  )
`);

// --- RATINGS ---
db.exec(`
  CREATE TABLE IF NOT EXISTS ratings (
    id TEXT PRIMARY KEY,
    complaint_id TEXT UNIQUE NOT NULL,
    citizen_id TEXT NOT NULL,
    stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(complaint_id) REFERENCES complaints(id)
  )
`);

// --- NOTIFICATIONS ---
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )
`);

module.exports = db;

