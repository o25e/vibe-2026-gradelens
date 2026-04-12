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
  const { confirmed_score, feedback_short, status, publish, rubric_scores } = body

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

  // ── 교수 확정 내용 기반으로 section1_summary 재생성 ────────────────────────
  // rubric_scores / confirmed_score / feedback_short 중 하나라도 변경되면
  // 학생이 보게 될 "점수 산출 근거" 요약 텍스트를 교수 확정 내용으로 덮어씀
  let updatedSection1: string | null = null

  const effectiveRubrics: { rubric_text: string; max_pts: number; score: number }[] | null =
    rubric_scores ??
    (grade.rubric_scores ? JSON.parse(grade.rubric_scores as string) : null)

  const effectiveFeedback: string | null =
    feedback_short ?? (grade.feedback_short as string | null)

  const effectiveScore: number | null =
    confirmed_score ??
    (grade.confirmed_score as number | null) ??
    (grade.ai_score as number | null)

  if (rubric_scores || confirmed_score != null || feedback_short != null) {
    const totalMax = effectiveRubrics?.reduce((a, r) => a + r.max_pts, 0) ?? 100
    const highItems = (effectiveRubrics ?? [])
      .filter(r => r.score >= r.max_pts * 0.85)
      .map(r => r.rubric_text)
    const lowItems = (effectiveRubrics ?? [])
      .filter(r => r.score < r.max_pts * 0.7)
      .map(r => r.rubric_text)

    updatedSection1 =
      `최종 확정 점수 ${effectiveScore}점 (${totalMax}점 만점)입니다.` +
      (highItems.length > 0
        ? ` ${highItems.join(', ')} 항목에서 우수한 성과를 보였습니다.`
        : '') +
      (lowItems.length > 0
        ? ` ${lowItems.join(', ')} 항목에서 추가 보완이 필요합니다.`
        : '') +
      (effectiveFeedback ? ` ${effectiveFeedback}` : '')
  }

  // 점수/피드백/루브릭/상태/section1_summary 업데이트
  db.prepare(`
    UPDATE grades
    SET confirmed_score  = COALESCE(?, confirmed_score),
        feedback_short   = COALESCE(?, feedback_short),
        status           = COALESCE(?, status),
        rubric_scores    = COALESCE(?, rubric_scores),
        section1_summary = COALESCE(?, section1_summary),
        confirmed_at     = datetime('now')
    WHERE id = ?
  `).run(
    confirmed_score ?? null,
    feedback_short ?? null,
    status ?? null,
    rubric_scores ? JSON.stringify(rubric_scores) : null,
    updatedSection1,   // null이면 COALESCE가 기존 값 유지
    params.id,
  )

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
