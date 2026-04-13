import { sql } from '@vercel/postgres'

let initialized = false
let initPromise: Promise<void> | null = null

function toPgSql(query: string): string {
  let idx = 0
  return query
    .replace(/datetime\('now'\)/g, 'NOW()')
    .replace(/\?/g, () => `$${++idx}`)
}

async function ensureInitialized() {
  if (initialized) return
  if (initPromise) return initPromise

  initPromise = (async () => {
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

    // additive migrations
    await sql.query(`ALTER TABLE grades ADD COLUMN IF NOT EXISTS is_published INTEGER NOT NULL DEFAULT 0`)
    await sql.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`)
    await sql.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS guideline_file_name TEXT`)
    await sql.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS guideline_file_path TEXT`)
    await sql.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_path TEXT`)
    await sql.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS guideline_file_blob BYTEA`)
    await sql.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS guideline_file_mime TEXT`)
    await sql.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_blob BYTEA`)
    await sql.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_mime TEXT`)

    initialized = true
  })()

  return initPromise
}

const db = {
  prepare(query: string) {
    const pgQuery = toPgSql(query)
    return {
      async get(...params: unknown[]) {
        await ensureInitialized()
        const result = await sql.query(pgQuery, params)
        return result.rows[0]
      },
      async all(...params: unknown[]) {
        await ensureInitialized()
        const result = await sql.query(pgQuery, params)
        return result.rows
      },
      async run(...params: unknown[]) {
        await ensureInitialized()
        const result = await sql.query(pgQuery, params)
        return { changes: result.rowCount }
      },
    }
  },
}

export default db
