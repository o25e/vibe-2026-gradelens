export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'instructor' | 'student'
  department?: string
  studentId?: string
}

const STORAGE_KEY = 'gradelens_user'
const USERS_KEY = 'gradelens_users'

const DEMO_USERS: (AuthUser & { password: string })[] = [
  {
    id: 'demo_instructor',
    name: '이채점',
    email: 'prof@gradelens.kr',
    password: 'demo1234',
    role: 'instructor',
    department: '컴퓨터공학과',
  },
  {
    id: 'demo_student',
    name: '김민준',
    email: 'student@gradelens.kr',
    password: 'demo1234',
    role: 'student',
    studentId: '20210342',
    department: '컴퓨터공학과',
  },
]

function getStoredUsers(): (AuthUser & { password: string })[] {
  if (typeof window === 'undefined') return DEMO_USERS
  try {
    const stored = localStorage.getItem(USERS_KEY)
    if (stored) {
      const customUsers: (AuthUser & { password: string })[] = JSON.parse(stored)
      const demoEmails = DEMO_USERS.map(u => u.email)
      const nonDupe = customUsers.filter(u => !demoEmails.includes(u.email))
      return [...DEMO_USERS, ...nonDupe]
    }
  } catch { /* ignore */ }
  return DEMO_USERS
}

function persistCustomUser(user: AuthUser & { password: string }) {
  if (typeof window === 'undefined') return
  const stored = localStorage.getItem(USERS_KEY)
  let customUsers: (AuthUser & { password: string })[] = []
  try { customUsers = stored ? JSON.parse(stored) : [] } catch { /* ignore */ }
  const idx = customUsers.findIndex(u => u.email === user.email)
  if (idx >= 0) customUsers[idx] = user
  else customUsers.push(user)
  localStorage.setItem(USERS_KEY, JSON.stringify(customUsers))
}

function setSession(user: AuthUser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

export function login(email: string, password: string): { user: AuthUser | null; error?: string } {
  const users = getStoredUsers()
  const match = users.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  )
  if (!match) return { user: null, error: '이메일 또는 비밀번호가 올바르지 않습니다.' }
  const { password: _pw, ...user } = match
  setSession(user)
  return { user }
}

export function signup(data: {
  name: string
  email: string
  password: string
  role: 'instructor' | 'student'
  department?: string
  studentId?: string
}): { user: AuthUser | null; error?: string } {
  const users = getStoredUsers()
  if (users.find(u => u.email.toLowerCase() === data.email.toLowerCase())) {
    return { user: null, error: '이미 사용 중인 이메일입니다.' }
  }
  const newUser: AuthUser & { password: string } = {
    id: `u_${Date.now()}`,
    name: data.name,
    email: data.email,
    password: data.password,
    role: data.role,
    department: data.department,
    studentId: data.role === 'student' ? (data.studentId || '') : undefined,
  }
  persistCustomUser(newUser)
  const { password: _pw, ...user } = newUser
  setSession(user)
  return { user }
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY)
  }
}
