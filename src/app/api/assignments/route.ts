import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import db from '@/lib/db'
import { getSession } from '@/lib/session'
import { seedDemoUsers } from '@/lib/seed'

function notifyStudentsNewAssignment(assignmentId: string, title: string, course: string) {
  const students = db.prepare(`SELECT id FROM users WHERE role = 'student'`).all() as { id: string }[]
  const insertNotif = db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, body, assignment_id)
    VALUES (?, ?, 'new_assignment', ?, ?, ?)
  `)
  db.transaction(() => {
    for (const s of students) {
      insertNotif.run(randomUUID(), s.id, `새 과제: ${title}`, `[${course}] 새로운 과제가 등록되었습니다.`, assignmentId)
    }
  })()
}

// GET /api/assignments — list assignments (instructor: all theirs; student: active ones)
export async function GET(req: NextRequest) {
  await seedDemoUsers()
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let rows
  if (session.role === 'instructor') {
    rows = db
      .prepare('SELECT * FROM assignments WHERE instructor_id = ? ORDER BY created_at DESC')
      .all(session.id)
  } else {
    // 학생: 교수 이름도 함께 조회
    rows = db
      .prepare(`
        SELECT a.*, u.name AS instructor_name
        FROM assignments a
        JOIN users u ON a.instructor_id = u.id
        WHERE a.is_active = 1 OR a.deadline < datetime('now')
        ORDER BY a.created_at DESC
      `)
      .all()
  }

  // 루브릭 및 (교수 전용) 제출 현황 카운트 첨부
  const subCountStmt = db.prepare(`
    SELECT
      COUNT(s.id)                                                                AS sub_total,
      COALESCE(SUM(CASE WHEN g.is_published = 1 THEN 1 ELSE 0 END), 0)         AS sub_published
    FROM submissions s
    LEFT JOIN grades g ON g.submission_id = s.id
    WHERE s.assignment_id = ?
  `)

  const assignments = (rows as Record<string, unknown>[]).map((a) => {
    const base = {
      ...a,
      rubric_items: db
        .prepare('SELECT * FROM rubric_items WHERE assignment_id = ? ORDER BY sort_order')
        .all(a.id as string),
    }
    if (session.role === 'instructor') {
      const counts = subCountStmt.get(a.id as string) as { sub_total: number; sub_published: number }
      return { ...base, sub_total: counts.sub_total, sub_published: counts.sub_published }
    }
    return base
  })

  return NextResponse.json({ assignments })
}

// POST /api/assignments — instructor creates assignment with rubrics
export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session || session.role !== 'instructor') {
    return NextResponse.json({ error: 'Instructor only' }, { status: 403 })
  }

  const body = await req.json()
  const { title, description, course, deadline, rubric_items } = body

  if (!title || !description || !course || !deadline || !Array.isArray(rubric_items)) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (rubric_items.length === 0) {
    return NextResponse.json({ error: '채점 기준을 최소 1개 이상 추가하세요.' }, { status: 400 })
  }

  const assignmentId = randomUUID()

  const insertAssignment = db.prepare(`
    INSERT INTO assignments (id, title, description, course, deadline, instructor_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const insertRubric = db.prepare(`
    INSERT INTO rubric_items (id, assignment_id, text, pts, category, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  db.transaction(() => {
    insertAssignment.run(assignmentId, title, description, course, deadline, session.id)
    rubric_items.forEach((r: { text: string; pts: number; category: string }, i: number) => {
      insertRubric.run(randomUUID(), assignmentId, r.text, r.pts, r.category ?? 'logic', i)
    })
  })()

  notifyStudentsNewAssignment(assignmentId, title, course)

  const created = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId) as Record<string, unknown>
  const rubrics = db.prepare('SELECT * FROM rubric_items WHERE assignment_id = ? ORDER BY sort_order').all(assignmentId)

  return NextResponse.json({ assignment: { ...created, rubric_items: rubrics } }, { status: 201 })
}
