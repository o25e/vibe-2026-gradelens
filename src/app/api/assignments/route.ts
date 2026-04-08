import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import db from '@/lib/db'
import { getSession } from '@/lib/session'
import { seedDemoUsers } from '@/lib/seed'

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
    rows = db
      .prepare('SELECT * FROM assignments WHERE is_active = 1 ORDER BY created_at DESC')
      .all()
  }

  // Attach rubric items to each assignment
  const assignments = (rows as Record<string, unknown>[]).map((a) => ({
    ...a,
    rubric_items: db
      .prepare('SELECT * FROM rubric_items WHERE assignment_id = ? ORDER BY sort_order')
      .all(a.id as string),
  }))

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

  const created = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId) as Record<string, unknown>
  const rubrics = db.prepare('SELECT * FROM rubric_items WHERE assignment_id = ? ORDER BY sort_order').all(assignmentId)

  return NextResponse.json({ assignment: { ...created, rubric_items: rubrics } }, { status: 201 })
}
