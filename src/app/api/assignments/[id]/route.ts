import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession } from '@/lib/session'

// GET /api/assignments/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(params.id)
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const rubric_items = db
    .prepare('SELECT * FROM rubric_items WHERE assignment_id = ? ORDER BY sort_order')
    .all(params.id)

  return NextResponse.json({ assignment: { ...(assignment as object), rubric_items } })
}
