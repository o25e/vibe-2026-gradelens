import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession } from '@/lib/session'

// GET /api/submissions/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await db.prepare(`
    SELECT s.*, u.name as student_name, u.student_id as student_number, u.department,
           a.title as assignment_title, a.course, a.description as assignment_description,
           g.id as grade_id, g.ai_score, g.confirmed_score, g.status as grade_status,
           g.feedback_short, g.rubric_scores, g.radar_scores, g.section1_summary, g.section2_items
    FROM submissions s
    JOIN users u ON u.id = s.student_id
    JOIN assignments a ON a.id = s.assignment_id
    LEFT JOIN grades g ON g.submission_id = s.id
    WHERE s.id = ?
  `).get(params.id) as Record<string, unknown> | undefined

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Access control
  if (session.role === 'student' && row.student_id !== session.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({
    submission: {
      ...row,
      rubric_scores: row.rubric_scores ? JSON.parse(row.rubric_scores as string) : null,
      radar_scores: row.radar_scores ? JSON.parse(row.radar_scores as string) : null,
      section2_items: row.section2_items ? JSON.parse(row.section2_items as string) : null,
    },
  })
}
