import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import db from '@/lib/db'
import { createSession, attachSessionCookie } from '@/lib/session'
import { seedDemoUsers } from '@/lib/seed'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await seedDemoUsers()
    const { name, email, password, role, department, studentId } = await req.json()

    if (!name?.trim() || !email?.trim() || !password || !role) {
      return NextResponse.json({ error: '필수 항목을 모두 입력해주세요.' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '비밀번호는 6자 이상이어야 합니다.' }, { status: 400 })
    }
    if (!['instructor', 'student'].includes(role)) {
      return NextResponse.json({ error: '올바른 역할을 선택해주세요.' }, { status: 400 })
    }

    const existing = await db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(email.toLowerCase().trim())
    if (existing) {
      return NextResponse.json({ error: '이미 사용 중인 이메일입니다.' }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 10)
    const id = randomUUID()

    await db.prepare(`
      INSERT INTO users (id, name, email, password, role, department, student_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name.trim(),
      email.toLowerCase().trim(),
      hashed,
      role,
      department?.trim() || null,
      role === 'student' ? (studentId?.trim() || null) : null
    )

    const token = await createSession({
      id,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role,
      department: department?.trim() || undefined,
      studentId: role === 'student' ? (studentId?.trim() || undefined) : undefined,
    })

    return attachSessionCookie(NextResponse.json({ ok: true }), token)
  } catch (err) {
    console.error('[signup]', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
