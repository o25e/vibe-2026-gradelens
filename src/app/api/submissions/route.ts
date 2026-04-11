import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import db from '@/lib/db'
import { getSession } from '@/lib/session'
import { gradeSubmission } from '@/lib/grading'

// GET /api/submissions — instructor: all for an assignment; student: own submissions
export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const assignmentId = searchParams.get('assignment_id')

  let rows: unknown[]
  if (session.role === 'instructor') {
    if (!assignmentId) return NextResponse.json({ error: 'assignment_id required' }, { status: 400 })
    rows = db.prepare(`
      SELECT s.*, u.name as student_name, u.student_id as student_number, u.department,
             g.ai_score, g.confirmed_score, g.status as grade_status, g.feedback_short,
             g.rubric_scores, g.radar_scores, g.section1_summary, g.section2_items, g.id as grade_id
      FROM submissions s
      JOIN users u ON u.id = s.student_id
      LEFT JOIN grades g ON g.submission_id = s.id
      WHERE s.assignment_id = ?
      ORDER BY s.submitted_at DESC
    `).all(assignmentId)
  } else {
    rows = db.prepare(`
      SELECT s.*, a.title as assignment_title, a.course,
             g.ai_score, g.confirmed_score, g.status as grade_status, g.feedback_short,
             g.rubric_scores, g.radar_scores, g.section1_summary, g.section2_items, g.id as grade_id
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

  return NextResponse.json({ submissions })
}

// POST /api/submissions — student submits + triggers AI grading
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

  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ? AND is_active = 1').get(assignment_id) as Record<string, unknown> | undefined
  if (!assignment) return NextResponse.json({ error: '존재하지 않거나 마감된 과제입니다.' }, { status: 404 })

  const rubricItems = db
    .prepare('SELECT text, pts, category FROM rubric_items WHERE assignment_id = ? ORDER BY sort_order')
    .all(assignment_id) as { text: string; pts: number; category: string }[]

  if (rubricItems.length === 0) {
    return NextResponse.json({ error: '채점 기준이 설정되지 않은 과제입니다.' }, { status: 400 })
  }

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length

  const submissionId = randomUUID()
  const gradeId = randomUUID()

  // 기존 제출 여부 확인
  const existing = db.prepare('SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ?')
    .get(assignment_id, session.id) as { id: string } | undefined

  const finalSubmissionId = existing?.id ?? submissionId

  if (existing) {
    // 재제출: 기존 ID 유지하고 내용만 업데이트
    db.prepare(`
      UPDATE submissions SET content = ?, file_name = ?, word_count = ?, submitted_at = datetime('now')
      WHERE id = ?
    `).run(content.trim(), file_name ?? null, wordCount, existing.id)
  } else {
    db.prepare(`
      INSERT INTO submissions (id, assignment_id, student_id, content, file_name, word_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(submissionId, assignment_id, session.id, content.trim(), file_name ?? null, wordCount)
  }

  // Remove old grade if resubmitting
  db.prepare('DELETE FROM grades WHERE submission_id = ?').run(finalSubmissionId)

  // AI grading
  const result = await gradeSubmission({
    assignmentTitle: assignment.title as string,
    assignmentDescription: assignment.description as string,
    rubricItems,
    submissionText: content,
    studentName: session.name,
  })

  const flagged = result.total_score < 50
  db.prepare(`
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

  return NextResponse.json({
    submission_id: finalSubmissionId,
    grade: {
      ai_score: result.total_score,
      status: flagged ? 'flagged' : 'pending',
      rubric_scores: result.rubric_scores,
      radar_scores: result.radar_scores,
      section1_summary: result.section1_summary,
      section2_items: result.section2_items,
      feedback_short: result.feedback_short,
    },
  }, { status: 201 })
}
