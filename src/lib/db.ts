import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'gradelens.db')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL CHECK(role IN ('instructor', 'student')),
    department  TEXT,
    student_id  TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    description   TEXT NOT NULL,
    course        TEXT NOT NULL,
    deadline      TEXT NOT NULL,
    instructor_id TEXT NOT NULL REFERENCES users(id),
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rubric_items (
    id            TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    text          TEXT NOT NULL,
    pts           INTEGER NOT NULL,
    category      TEXT NOT NULL DEFAULT 'logic',
    sort_order    INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id            TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL REFERENCES assignments(id),
    student_id    TEXT NOT NULL REFERENCES users(id),
    content       TEXT NOT NULL,
    file_name     TEXT,
    word_count    INTEGER DEFAULT 0,
    submitted_at  TEXT DEFAULT (datetime('now')),
    UNIQUE(assignment_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS grades (
    id              TEXT PRIMARY KEY,
    submission_id   TEXT NOT NULL UNIQUE REFERENCES submissions(id),
    ai_score        INTEGER,
    confirmed_score INTEGER,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','flagged')),
    rubric_scores   TEXT,
    radar_scores    TEXT,
    section1_summary TEXT,
    section2_items  TEXT,
    feedback_short  TEXT,
    graded_at       TEXT DEFAULT (datetime('now')),
    confirmed_at    TEXT
  );
`)

export default db
