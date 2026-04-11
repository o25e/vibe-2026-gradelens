import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import db from '@/lib/db'
import { getSession } from '@/lib/session'

// PATCH /api/grades/[id] — 교수: 점수 수정 및/또는 공지(publish)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req)
  if (!session || session.role !== 'instructor') {
    return NextResponse.json({ error: 'Instructor only' }, { status: 403 })
  }

  const body = await req.json()
  const { confirmed_score, feedback_short, status, publish } = body

  // 과제 및 학생 정보 조회
  const grade = db.prepare(`
    SELECT g.*, s.student_id, s.assignment_id, u.name as student_name, a.title as assignment_title
    FROM grades g
    JOIN submissions s ON s.id = g.submission_id
    JOIN users u ON u.id = s.student_id
    JOIN assignments a ON a.id = s.assignment_id
    WHERE g.id = ?
  `).get(params.id) as Record<string, unknown> | undefined

  if (!grade) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 점수/피드백/상태 업데이트
  db.prepare(`
    UPDATE grades
    SET confirmed_score = COALESCE(?, confirmed_score),
        feedback_short  = COALESCE(?, feedback_short),
        status          = COALESCE(?, status),
        confirmed_at    = datetime('now')
    WHERE id = ?
  `).run(confirmed_score ?? null, feedback_short ?? null, status ?? null, params.id)

  // 공지(publish) 처리
  if (publish) {
    db.prepare(`UPDATE grades SET is_published = 1, confirmed_at = datetime('now') WHERE id = ?`)
      .run(params.id)

    const wasPublished = (grade.is_published as number) === 1
    const finalScore = confirmed_score ?? grade.confirmed_score ?? grade.ai_score
    const notifType  = wasPublished ? 'grade_updated' : 'grade_published'
    const notifTitle = wasPublished ? '성적이 수정되었습니다' : '채점 결과가 공개되었습니다'
    const notifBody  = `[${grade.assignment_title}] 최종 점수: ${finalScore}점`

    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, body, assignment_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      grade.student_id as string,
      notifType,
      notifTitle,
      notifBody,
      grade.assignment_id as string,
    )
  }

  const updated = db.prepare(`
    SELECT g.*, s.student_id, u.name as student_name
    FROM grades g
    JOIN submissions s ON s.id = g.submission_id
    JOIN users u ON u.id = s.student_id
    WHERE g.id = ?
  `).get(params.id)

  return NextResponse.json({ grade: updated })
}
