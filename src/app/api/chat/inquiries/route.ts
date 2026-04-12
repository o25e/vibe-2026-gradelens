import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import db from '@/lib/db'
import { getSession } from '@/lib/session'

// ── 공통 타입 ─────────────────────────────────────────────────────────────────
interface RawNotif {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  assignment_id: string | null
  is_read: number
  created_at: string
}

interface StudentThread {
  studentUserId: string
  studentName: string
  studentNo: string
  unreadCount: number
  lastAt: string
  messages: {
    id: string
    sender: 'student' | 'professor'
    body: string
    created_at: string
  }[]
}

// ── GET /api/chat/inquiries — 교수: 전체 학생 문의 목록 조회 ──────────────────
export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'instructor') {
    return NextResponse.json({ error: '교수만 조회할 수 있습니다.' }, { status: 403 })
  }

  // 이 교수에게 들어온 학생 문의 (assignment_id = student user_id)
  const inquiries = db.prepare(`
    SELECT * FROM notifications
    WHERE type = 'student_inquiry' AND user_id = ?
    ORDER BY created_at DESC
  `).all(session.id) as RawNotif[]

  // 학생별로 그룹화
  const threadMap = new Map<string, StudentThread>()

  for (const n of inquiries) {
    const stuId = n.assignment_id // 학생 user_id (inquiry/route.ts에서 저장)
    if (!stuId) continue

    if (!threadMap.has(stuId)) {
      // 학생 정보 조회
      const student = db.prepare(
        `SELECT name, student_id FROM users WHERE id = ?`
      ).get(stuId) as { name: string; student_id: string | null } | undefined

      threadMap.set(stuId, {
        studentUserId: stuId,
        studentName: student?.name ?? n.title.replace('📩 긴급 문의: ', '').replace(' 학생', ''),
        studentNo: student?.student_id ?? '',
        unreadCount: 0,
        lastAt: n.created_at,
        messages: [],
      })
    }

    const thread = threadMap.get(stuId)!
    if (!n.is_read) thread.unreadCount++
    if (n.created_at > thread.lastAt) thread.lastAt = n.created_at

    thread.messages.push({
      id: n.id,
      sender: 'student',
      body: n.body,
      created_at: n.created_at,
    })
  }

  // 각 학생 스레드에 교수 답변도 추가
  for (const [stuId, thread] of Array.from(threadMap)) {
    const replies = db.prepare(`
      SELECT id, body, created_at FROM notifications
      WHERE type = 'professor_reply' AND user_id = ? AND assignment_id = ?
      ORDER BY created_at ASC
    `).all(stuId, session.id) as { id: string; body: string; created_at: string }[]

    for (const r of replies) {
      thread.messages.push({ id: r.id, sender: 'professor', body: r.body, created_at: r.created_at })
      if (r.created_at > thread.lastAt) thread.lastAt = r.created_at
    }

    // 시간순 정렬
    thread.messages.sort((a, b) => a.created_at.localeCompare(b.created_at))
  }

  const threads = Array.from(threadMap.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt))
  const totalUnread = threads.reduce((s, t) => s + t.unreadCount, 0)

  return NextResponse.json({ threads, totalUnread }, { headers: { 'Cache-Control': 'no-store' } })
}

// ── POST /api/chat/inquiries — 교수: 학생에게 답변 전송 ──────────────────────
export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'instructor') {
    return NextResponse.json({ error: '교수만 답변할 수 있습니다.' }, { status: 403 })
  }

  const body = await req.json()
  const { studentUserId, message, inquiryIds } = body as {
    studentUserId: string
    message: string
    inquiryIds?: string[]
  }

  if (!studentUserId || !message?.trim()) {
    return NextResponse.json({ error: 'studentUserId와 message는 필수입니다.' }, { status: 400 })
  }

  // 학생 확인
  const student = db.prepare(`SELECT name, student_id FROM users WHERE id = ?`).get(studentUserId) as
    | { name: string; student_id: string | null }
    | undefined
  if (!student) return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 })

  // 학생에게 답변 알림 전송 (assignment_id = instructor user_id)
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, body, assignment_id, is_read, created_at)
    VALUES (?, ?, 'professor_reply', ?, ?, ?, 0, datetime('now'))
  `).run(
    randomUUID(),
    studentUserId,
    `📝 ${session.name} 교수님 답변`,
    message.trim(),
    session.id, // assignment_id = instructor user_id (학생이 답변자 구분에 사용)
  )

  // 해당 학생의 문의 알림을 읽음 처리
  if (inquiryIds && inquiryIds.length > 0) {
    const placeholders = inquiryIds.map(() => '?').join(',')
    db.prepare(
      `UPDATE notifications SET is_read = 1 WHERE id IN (${placeholders}) AND user_id = ?`
    ).run(...inquiryIds, session.id)
  } else {
    // inquiryIds 없으면 해당 학생의 모든 미읽음 문의 읽음 처리
    db.prepare(`
      UPDATE notifications SET is_read = 1
      WHERE type = 'student_inquiry' AND user_id = ? AND assignment_id = ? AND is_read = 0
    `).run(session.id, studentUserId)
  }

  return NextResponse.json({ ok: true })
}
