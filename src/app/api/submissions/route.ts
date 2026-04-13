import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import db from '@/lib/db'
import { getSession } from '@/lib/session'
import { gradeSubmission } from '@/lib/grading'

// GET /api/submissions
export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const assignmentId = searchParams.get('assignment_id')

  let rows: unknown[]

  if (session.role === 'instructor') {
    // 교수: 과제별 전체 제출 현황 (is_published 포함)
    if (!assignmentId) return NextResponse.json({ error: 'assignment_id required' }, { status: 400 })
    rows = await db.prepare(`
      SELECT s.*, u.name as student_name, u.student_id as student_number, u.department,
             g.ai_score, g.confirmed_score, g.status as grade_status, g.feedback_short,
             g.rubric_scores, g.radar_scores, g.section1_summary, g.section2_items,
             g.id as grade_id, g.is_published
      FROM submissions s
      JOIN users u ON u.id = s.student_id
      LEFT JOIN grades g ON g.submission_id = s.id
      WHERE s.assignment_id = ?
      ORDER BY s.submitted_at DESC
    `).all(assignmentId)
  } else {
    // 학생: 본인 제출 목록 — 미공지 성적은 숨김
    rows = await db.prepare(`
      SELECT s.id, s.assignment_id, s.submitted_at, s.word_count, s.file_name,
             a.title as assignment_title, a.course,
             CASE WHEN g.is_published = 1 THEN g.ai_score    ELSE NULL END as ai_score,
             CASE WHEN g.is_published = 1 THEN g.confirmed_score ELSE NULL END as confirmed_score,
             CASE WHEN g.is_published = 1 THEN g.status      ELSE 'waiting' END as grade_status,
             CASE WHEN g.is_published = 1 THEN g.feedback_short ELSE NULL END as feedback_short,
             CASE WHEN g.is_published = 1 THEN g.rubric_scores  ELSE NULL END as rubric_scores,
             CASE WHEN g.is_published = 1 THEN g.radar_scores   ELSE NULL END as radar_scores,
             CASE WHEN g.is_published = 1 THEN g.section1_summary ELSE NULL END as section1_summary,
             CASE WHEN g.is_published = 1 THEN g.section2_items  ELSE NULL END as section2_items,
             g.id as grade_id
      FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id
      LEFT JOIN grades g ON g.submission_id = s.id
      WHERE s.student_id = ?
      ORDER BY s.submitted_at DESC
    `).all(session.id)
  }

  const submissions = (rows as Record<string, unknown>[]).map((r) => ({
    ...r,
    rubric_scores: r.rubric_scores ? JSON.parse(r.rubric_scores as string) : null,
    radar_scores: r.radar_scores ? JSON.parse(r.radar_scores as string) : null,
    section2_items: r.section2_items ? JSON.parse(r.section2_items as string) : null,
  }))

  return NextResponse.json({ submissions }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

// POST /api/submissions — 학생 과제 제출 + AI 자동 채점 (결과는 교수 공지 전 비공개)
export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session || session.role !== 'student') {
    return NextResponse.json({ error: 'Student only' }, { status: 403 })
  }

  const body = await req.json()
  const { assignment_id, content, file_name } = body

  if (!assignment_id || !content?.trim()) {
    return NextResponse.json({ error: '과제 ID와 제출 내용을 입력하세요.' }, { status: 400 })
  }

  const assignment = await db.prepare('SELECT * FROM assignments WHERE id = ? AND is_active = 1').get(assignment_id) as Record<string, unknown> | undefined
  if (!assignment) return NextResponse.json({ error: '존재하지 않거나 마감된 과제입니다.' }, { status: 404 })

  const rubricItems = await db
    .prepare('SELECT text, pts, category FROM rubric_items WHERE assignment_id = ? ORDER BY sort_order')
    .all(assignment_id) as { text: string; pts: number; category: string }[]

  if (rubricItems.length === 0) {
    return NextResponse.json({ error: '채점 기준이 설정되지 않은 과제입니다.' }, { status: 400 })
  }

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length
  const submissionId = randomUUID()
  const gradeId = randomUUID()

  // 기존 제출 여부 확인
  const existing = await db.prepare('SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ?')
    .get(assignment_id, session.id) as { id: string } | undefined

  const finalSubmissionId = existing?.id ?? submissionId

  if (existing) {
    await db.prepare(`
      UPDATE submissions SET content = ?, file_name = ?, word_count = ?, submitted_at = datetime('now')
      WHERE id = ?
    `).run(content.trim(), file_name ?? null, wordCount, existing.id)
  } else {
    await db.prepare(`
      INSERT INTO submissions (id, assignment_id, student_id, content, file_name, word_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(submissionId, assignment_id, session.id, content.trim(), file_name ?? null, wordCount)
  }

  // 기존 성적 삭제 (재제출)
  await db.prepare('DELETE FROM grades WHERE submission_id = ?').run(finalSubmissionId)

  // AI 채점 (결과는 DB에만 저장, 학생에게 즉시 공개 안 함)
  const result = await gradeSubmission({
    assignmentTitle: assignment.title as string,
    assignmentDescription: assignment.description as string,
    rubricItems,
    submissionText: content,
    studentName: session.name,
  })

  const flagged = result.total_score < 50
  await db.prepare(`
    INSERT INTO grades (id, submission_id, ai_score, status, rubric_scores, radar_scores,
                        section1_summary, section2_items, feedback_short)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    gradeId, finalSubmissionId, result.total_score,
    flagged ? 'flagged' : 'pending',
    JSON.stringify(result.rubric_scores),
    JSON.stringify(result.radar_scores),
    result.section1_summary,
    JSON.stringify(result.section2_items),
    result.feedback_short,
  )

  // 학생에게는 제출 완료 + 대기 상태만 반환 (점수 비공개)
  return NextResponse.json({
    submission_id: finalSubmissionId,
    waiting: true,
  }, { status: 201 })
}
