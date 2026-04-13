import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import db from '@/lib/db'
import { createSession, attachSessionCookie } from '@/lib/session'
import { seedDemoUsers } from '@/lib/seed'

export const dynamic = 'force-dynamic'

interface UserRow {
  id: string
  name: string
  email: string
  password: string
  role: 'instructor' | 'student'
  department: string | null
  student_id: string | null
}

export async function POST(req: NextRequest) {
  try {
    await seedDemoUsers()
    const { email, password } = await req.json()

    if (!email?.trim() || !password) {
      return NextResponse.json({ error: '이메일과 비밀번호를 입력해주세요.' }, { status: 400 })
    }

    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email.toLowerCase().trim()) as UserRow | undefined

    if (!user) {
      return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
      return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    const token = await createSession({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department ?? undefined,
      studentId: user.student_id ?? undefined,
    })

    return attachSessionCookie(NextResponse.json({ ok: true }), token)
  } catch (err) {
    console.error('[login]', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
