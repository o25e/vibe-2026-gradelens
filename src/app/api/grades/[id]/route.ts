import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession } from '@/lib/session'

// PATCH /api/grades/[id] — professor confirms or edits a grade
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req)
  if (!session || session.role !== 'instructor') {
    return NextResponse.json({ error: 'Instructor only' }, { status: 403 })
  }

  const body = await req.json()
  const { confirmed_score, feedback_short, status } = body

  const grade = db.prepare('SELECT * FROM grades WHERE id = ?').get(params.id)
  if (!grade) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  db.prepare(`
    UPDATE grades
    SET confirmed_score = COALESCE(?, confirmed_score),
        feedback_short = COALESCE(?, feedback_short),
        status = COALESCE(?, status),
        confirmed_at = datetime('now')
    WHERE id = ?
  `).run(
    confirmed_score ?? null,
    feedback_short ?? null,
    status ?? null,
    params.id,
  )

  const updated = db.prepare(`
    SELECT g.*, s.student_id, u.name as student_name
    FROM grades g
    JOIN submissions s ON s.id = g.submission_id
    JOIN users u ON u.id = s.student_id
    WHERE g.id = ?
  `).get(params.id)

  return NextResponse.json({ grade: updated })
}
