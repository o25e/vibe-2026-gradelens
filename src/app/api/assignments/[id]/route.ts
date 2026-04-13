import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession } from '@/lib/session'

// GET /api/assignments/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assignment = await db.prepare('SELECT * FROM assignments WHERE id = ?').get(params.id)
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const rubric_items = await db
    .prepare('SELECT * FROM rubric_items WHERE assignment_id = ? ORDER BY sort_order')
    .all(params.id)

  return NextResponse.json({ assignment: { ...(assignment as object), rubric_items } })
}

// PUT /api/assignments/[id] — 교수: 과제 수정
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req)
  if (!session || session.role !== 'instructor') {
    return NextResponse.json({ error: 'Instructor only' }, { status: 403 })
  }

  const assignment = await db.prepare('SELECT * FROM assignments WHERE id = ?').get(params.id) as Record<string, unknown> | undefined
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (assignment.instructor_id !== session.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { title, description, course, deadline, is_active } = body

  await db.prepare(`
    UPDATE assignments
    SET title = COALESCE(?, title),
        description = COALESCE(?, description),
        course = COALESCE(?, course),
        deadline = COALESCE(?, deadline),
        is_active = COALESCE(?, is_active),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title ?? null,
    description ?? null,
    course ?? null,
    deadline ?? null,
    is_active ?? null,
    params.id,
  )

  const updated = await db.prepare('SELECT * FROM assignments WHERE id = ?').get(params.id)
  return NextResponse.json({ assignment: updated })
}

// DELETE /api/assignments/[id] — 교수: 과제 삭제
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req)
  if (!session || session.role !== 'instructor') {
    return NextResponse.json({ error: 'Instructor only' }, { status: 403 })
  }

  const assignment = await db.prepare('SELECT * FROM assignments WHERE id = ?').get(params.id) as Record<string, unknown> | undefined
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (assignment.instructor_id !== session.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // submissions → grades 등 CASCADE 삭제되므로 순서 중요
  await db.prepare('DELETE FROM grade_settings WHERE assignment_id = ?').run(params.id)
  // grades는 submissions에 FK가 있으므로 submissions 삭제 전 grades 먼저
  await db.prepare(`
    DELETE FROM grades WHERE submission_id IN (
      SELECT id FROM submissions WHERE assignment_id = ?
    )
  `).run(params.id)
  await db.prepare('DELETE FROM submissions WHERE assignment_id = ?').run(params.id)
  await db.prepare('DELETE FROM rubric_items WHERE assignment_id = ?').run(params.id)
  await db.prepare('DELETE FROM assignments WHERE id = ?').run(params.id)

  return NextResponse.json({ ok: true })
}
