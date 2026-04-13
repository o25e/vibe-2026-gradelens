// Client-side auth helpers — all calls go to Next.js API routes.
// Session is stored in an HTTP-only cookie managed by the server.

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'instructor' | 'student'
  department?: string
  studentId?: string
}

export async function login(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) return { ok: false, error: data.error ?? '로그인에 실패했습니다.' }
  return { ok: true }
}

export async function signup(data: {
  name: string
  email: string
  password: string
  role: 'instructor' | 'student'
  department?: string
  studentId?: string
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) return { ok: false, error: json.error ?? '회원가입에 실패했습니다.' }
  return { ok: true }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return data.user ?? null
  } catch {
    return null
  }
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' })
}
