import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { sql } from '@vercel/postgres'

const projectRoot = process.cwd()
const envFiles = ['.env.local', '.env']

function loadEnvFile(fileName) {
  const filePath = path.join(projectRoot, fileName)
  if (!fs.existsSync(filePath)) return
  const raw = fs.readFileSync(filePath, 'utf-8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
    if (!process.env[key]) process.env[key] = value
  }
}

for (const file of envFiles) loadEnvFile(file)

const sqlitePath = process.env.SQLITE_DB_PATH?.trim() || path.join(projectRoot, 'data', 'gradelens.db')

if (!process.env.POSTGRES_URL?.trim()) {
  throw new Error('POSTGRES_URL is required. Set it before running migration.')
}

if (!fs.existsSync(sqlitePath)) {
  throw new Error(`SQLite file not found: ${sqlitePath}`)
}

const sqlite = new Database(sqlitePath, { readonly: true })

async function migrateTable(name, selectSql, upsertSql, mapper = row => row) {
  const rows = sqlite.prepare(selectSql).all()
  console.log(`[migrate] ${name}: ${rows.length} rows`)

  for (const row of rows) {
    const values = mapper(row)
    await sql.query(upsertSql, values)
  }
}

async function ensureTargetSchema() {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('instructor', 'student')),
      department TEXT,
      student_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)
  await sql.query(`
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      course TEXT NOT NULL,
      deadline TEXT NOT NULL,
      instructor_id TEXT NOT NULL REFERENCES users(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)
  await sql.query(`
    CREATE TABLE IF NOT EXISTS rubric_items (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      pts INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT 'logic',
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `)
  await sql.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES assignments(id),
      student_id TEXT NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      file_name TEXT,
      word_count INTEGER DEFAULT 0,
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(assignment_id, student_id)
    );
  `)
  await sql.query(`
    CREATE TABLE IF NOT EXISTS grades (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL UNIQUE REFERENCES submissions(id),
      ai_score INTEGER,
      confirmed_score INTEGER,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','flagged')),
      rubric_scores TEXT,
      radar_scores TEXT,
      section1_summary TEXT,
      section2_items TEXT,
      feedback_short TEXT,
      graded_at TIMESTAMPTZ DEFAULT NOW(),
      confirmed_at TIMESTAMPTZ
    );
  `)
  await sql.query(`
    CREATE TABLE IF NOT EXISTS grade_settings (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL UNIQUE REFERENCES assignments(id) ON DELETE CASCADE,
      cuts TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)
  await sql.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      assignment_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)

  await sql.query(`ALTER TABLE grades ADD COLUMN IF NOT EXISTS is_published INTEGER NOT NULL DEFAULT 0`)
  await sql.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`)
  await sql.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS guideline_file_name TEXT`)
  await sql.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS guideline_file_path TEXT`)
  await sql.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_path TEXT`)
  await sql.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS guideline_file_blob BYTEA`)
  await sql.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS guideline_file_mime TEXT`)
  await sql.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_blob BYTEA`)
  await sql.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_mime TEXT`)
}

async function run() {
  console.log(`[migrate] SQLite source: ${sqlitePath}`)
  console.log('[migrate] Target: Vercel Postgres (POSTGRES_URL)')
  await ensureTargetSchema()

  await migrateTable(
    'users',
    `SELECT id, name, email, password, role, department, student_id, created_at FROM users`,
    `
      INSERT INTO users (id, name, email, password, role, department, student_id, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        password = EXCLUDED.password,
        role = EXCLUDED.role,
        department = EXCLUDED.department,
        student_id = EXCLUDED.student_id
    `,
    r => [r.id, r.name, r.email, r.password, r.role, r.department ?? null, r.student_id ?? null, r.created_at ?? null],
  )

  await migrateTable(
    'assignments',
    `SELECT id, title, description, course, deadline, instructor_id, is_active, created_at, updated_at, guideline_file_name, guideline_file_path, guideline_file_blob, guideline_file_mime FROM assignments`,
    `
      INSERT INTO assignments (
        id, title, description, course, deadline, instructor_id, is_active, created_at, updated_at,
        guideline_file_name, guideline_file_path, guideline_file_blob, guideline_file_mime
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        course = EXCLUDED.course,
        deadline = EXCLUDED.deadline,
        instructor_id = EXCLUDED.instructor_id,
        is_active = EXCLUDED.is_active,
        updated_at = EXCLUDED.updated_at,
        guideline_file_name = EXCLUDED.guideline_file_name,
        guideline_file_path = EXCLUDED.guideline_file_path,
        guideline_file_blob = EXCLUDED.guideline_file_blob,
        guideline_file_mime = EXCLUDED.guideline_file_mime
    `,
    r => [
      r.id, r.title, r.description, r.course, r.deadline, r.instructor_id, r.is_active ?? 1,
      r.created_at ?? null, r.updated_at ?? null,
      r.guideline_file_name ?? null, r.guideline_file_path ?? null, r.guideline_file_blob ?? null, r.guideline_file_mime ?? null,
    ],
  )

  await migrateTable(
    'rubric_items',
    `SELECT id, assignment_id, text, pts, category, sort_order FROM rubric_items`,
    `
      INSERT INTO rubric_items (id, assignment_id, text, pts, category, sort_order)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (id) DO UPDATE SET
        assignment_id = EXCLUDED.assignment_id,
        text = EXCLUDED.text,
        pts = EXCLUDED.pts,
        category = EXCLUDED.category,
        sort_order = EXCLUDED.sort_order
    `,
    r => [r.id, r.assignment_id, r.text, r.pts, r.category ?? 'logic', r.sort_order ?? 0],
  )

  await migrateTable(
    'submissions',
    `SELECT id, assignment_id, student_id, content, file_name, word_count, submitted_at, file_path, file_blob, file_mime FROM submissions`,
    `
      INSERT INTO submissions (id, assignment_id, student_id, content, file_name, word_count, submitted_at, file_path, file_blob, file_mime)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (id) DO UPDATE SET
        assignment_id = EXCLUDED.assignment_id,
        student_id = EXCLUDED.student_id,
        content = EXCLUDED.content,
        file_name = EXCLUDED.file_name,
        word_count = EXCLUDED.word_count,
        submitted_at = EXCLUDED.submitted_at,
        file_path = EXCLUDED.file_path,
        file_blob = EXCLUDED.file_blob,
        file_mime = EXCLUDED.file_mime
    `,
    r => [r.id, r.assignment_id, r.student_id, r.content, r.file_name ?? null, r.word_count ?? 0, r.submitted_at ?? null, r.file_path ?? null, r.file_blob ?? null, r.file_mime ?? null],
  )

  await migrateTable(
    'grades',
    `SELECT id, submission_id, ai_score, confirmed_score, status, rubric_scores, radar_scores, section1_summary, section2_items, feedback_short, graded_at, confirmed_at, is_published FROM grades`,
    `
      INSERT INTO grades (
        id, submission_id, ai_score, confirmed_score, status, rubric_scores, radar_scores,
        section1_summary, section2_items, feedback_short, graded_at, confirmed_at, is_published
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO UPDATE SET
        submission_id = EXCLUDED.submission_id,
        ai_score = EXCLUDED.ai_score,
        confirmed_score = EXCLUDED.confirmed_score,
        status = EXCLUDED.status,
        rubric_scores = EXCLUDED.rubric_scores,
        radar_scores = EXCLUDED.radar_scores,
        section1_summary = EXCLUDED.section1_summary,
        section2_items = EXCLUDED.section2_items,
        feedback_short = EXCLUDED.feedback_short,
        graded_at = EXCLUDED.graded_at,
        confirmed_at = EXCLUDED.confirmed_at,
        is_published = EXCLUDED.is_published
    `,
    r => [
      r.id, r.submission_id, r.ai_score ?? null, r.confirmed_score ?? null, r.status ?? 'pending',
      r.rubric_scores ?? null, r.radar_scores ?? null, r.section1_summary ?? null, r.section2_items ?? null, r.feedback_short ?? null,
      r.graded_at ?? null, r.confirmed_at ?? null, r.is_published ?? 0,
    ],
  )

  await migrateTable(
    'grade_settings',
    `SELECT id, assignment_id, cuts, updated_at FROM grade_settings`,
    `
      INSERT INTO grade_settings (id, assignment_id, cuts, updated_at)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (assignment_id) DO UPDATE SET
        cuts = EXCLUDED.cuts,
        updated_at = EXCLUDED.updated_at
    `,
    r => [r.id, r.assignment_id, r.cuts, r.updated_at ?? null],
  )

  await migrateTable(
    'notifications',
    `SELECT id, user_id, type, title, body, assignment_id, is_read, created_at FROM notifications`,
    `
      INSERT INTO notifications (id, user_id, type, title, body, assignment_id, is_read, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        type = EXCLUDED.type,
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        assignment_id = EXCLUDED.assignment_id,
        is_read = EXCLUDED.is_read,
        created_at = EXCLUDED.created_at
    `,
    r => [r.id, r.user_id, r.type, r.title, r.body, r.assignment_id ?? null, r.is_read ?? 0, r.created_at ?? null],
  )

  sqlite.close()
  console.log('[migrate] done')
}

run().catch(err => {
  try { sqlite.close() } catch {}
  console.error('[migrate] failed:', err)
  process.exit(1)
})
