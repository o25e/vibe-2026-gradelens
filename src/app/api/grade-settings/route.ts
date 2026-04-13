import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import db from '@/lib/db'
import { getSession } from '@/lib/session'

// GET /api/grade-settings?assignment_id=xxx — fetch saved cutoffs for an assignment
export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const assignmentId = searchParams.get('assignment_id')
  if (!assignmentId) {
    return NextResponse.json({ error: 'assignment_id required' }, { status: 400 })
  }

  const row = await db
    .prepare('SELECT cuts, updated_at FROM grade_settings WHERE assignment_id = ?')
    .get(assignmentId) as { cuts: string; updated_at: string } | undefined

  if (!row) return NextResponse.json({ cuts: null })
  return NextResponse.json({ cuts: JSON.parse(row.cuts), updated_at: row.updated_at })
}

// POST /api/grade-settings — upsert cutoff settings for an assignment
export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session || session.role !== 'instructor') {
    return NextResponse.json({ error: 'Instructor only' }, { status: 403 })
  }

  const body = await req.json()
  const { assignment_id, cuts } = body

  if (!assignment_id || !cuts || typeof cuts !== 'object') {
    return NextResponse.json({ error: 'assignment_id와 cuts 객체가 필요합니다.' }, { status: 400 })
  }

  // Verify assignment belongs to this instructor
  const assignment = await db
    .prepare('SELECT id FROM assignments WHERE id = ? AND instructor_id = ?')
    .get(assignment_id, session.id)
  if (!assignment) {
    return NextResponse.json({ error: '권한이 없거나 존재하지 않는 과제입니다.' }, { status: 403 })
  }

  await db.prepare(`
    INSERT INTO grade_settings (id, assignment_id, cuts)
    VALUES (?, ?, ?)
    ON CONFLICT(assignment_id) DO UPDATE SET
      cuts = excluded.cuts,
      updated_at = datetime('now')
  `).run(randomUUID(), assignment_id, JSON.stringify(cuts))

  return NextResponse.json({ ok: true, updated_at: new Date().toISOString() })
}
