/**
 * 서버 시작 시 데모 계정이 없으면 자동으로 생성합니다.
 * API route 또는 db.ts에서 import해서 사용하세요.
 */
import db from './db'
import bcrypt from 'bcryptjs'

const DEMO_USERS = [
  {
    id: 'demo_instructor',
    name: '이채점',
    email: 'prof@gradelens.kr',
    password: 'demo1234',
    role: 'instructor' as const,
    department: '글로벌미디어학부',
    student_id: null,
  },
  {
    id: 'demo_student',
    name: '김민준',
    email: 'student@gradelens.kr',
    password: 'demo1234',
    role: 'student' as const,
    department: '글로벌미디어학부',
    student_id: '20210342',
  },
]

let seeded = false

export async function seedDemoUsers() {
  if (seeded) return
  seeded = true

  for (const u of DEMO_USERS) {
    const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(u.id)
    if (!exists) {
      const hashed = await bcrypt.hash(u.password, 10)
      db.prepare(`
        INSERT INTO users (id, name, email, password, role, department, student_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(u.id, u.name, u.email, hashed, u.role, u.department, u.student_id)
      console.log(`[seed] 데모 계정 생성: ${u.email}`)
    }
  }
}
