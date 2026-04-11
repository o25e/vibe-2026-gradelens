import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession } from '@/lib/session'

// GET /api/notifications — 내 알림 목록 + 미읽음 수
export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 30
  `).all(session.id)

  const { cnt: unreadCount } = db.prepare(
    'SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0'
  ).get(session.id) as { cnt: number }

  return NextResponse.json({ notifications, unreadCount }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

// PATCH /api/notifications — 전체 읽음 처리
export async function PATCH(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(session.id)
  return NextResponse.json({ ok: true })
}
