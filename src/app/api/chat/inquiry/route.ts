import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import db from '@/lib/db'
import { getSession } from '@/lib/session'

// POST /api/chat/inquiry — 학생이 교수에게 긴급 문의 전송
export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'student') {
    return NextResponse.json({ error: '학생만 이용할 수 있는 기능입니다.' }, { status: 403 })
  }

  const body = await req.json()
  const { message } = body as { message?: string }
  const inquiryMessage = message?.trim() || '긴급 문의가 있습니다. 확인 부탁드립니다.'

  // 이 학생이 제출한 과제의 담당 교수 목록 조회
  const instructors = await db.prepare(`
    SELECT DISTINCT a.instructor_id, u.name AS instructor_name
    FROM assignments a
    JOIN submissions s ON a.id = s.assignment_id
    JOIN users u ON a.instructor_id = u.id
    WHERE s.student_id = ?
  `).all(session.id) as { instructor_id: string; instructor_name: string }[]

  // 제출 내역이 없으면 시스템에 등록된 교수 전원에게
  if (instructors.length === 0) {
    const all = await db.prepare(
      `SELECT id AS instructor_id, name AS instructor_name FROM users WHERE role = 'instructor'`
    ).all() as { instructor_id: string; instructor_name: string }[]
    instructors.push(...all)
  }

  if (instructors.length === 0) {
    return NextResponse.json({ error: '연결 가능한 교수를 찾을 수 없습니다.' }, { status: 404 })
  }

  const studentName = session.name
  const studentId = session.studentId ?? ''

  // assignment_id 컬럼에 student user_id를 저장 → 교수가 답변할 때 대상 학생을 특정할 수 있게
  const stmt = db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, body, assignment_id, is_read, created_at)
    VALUES (?, ?, 'student_inquiry', ?, ?, ?, 0, datetime('now'))
  `)

  for (const inst of instructors) {
    await stmt.run(
      randomUUID(),
      inst.instructor_id,
      `📩 긴급 문의: ${studentName}${studentId ? ` (${studentId})` : ''} 학생`,
      inquiryMessage,
      session.id, // assignment_id 컬럼에 학생 user_id 저장
    )
  }

  return NextResponse.json({ ok: true, notifiedCount: instructors.length })
}
