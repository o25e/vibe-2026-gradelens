'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, Eye, EyeOff, BookOpen, LayoutDashboard, ArrowRight, Sparkles } from 'lucide-react'
import { login, signup } from '@/lib/auth'

type Tab = 'login' | 'signup'
type Role = 'instructor' | 'student'

function RoleCard({ role, selected, onClick }: { role: Role; selected: boolean; onClick: () => void }) {
  const isInstructor = role === 'instructor'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-2.5 py-4 px-3 rounded-2xl border-2 transition-all duration-200 ${
        selected
          ? isInstructor
            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
            : 'border-violet-500 bg-violet-50 text-violet-700'
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
        selected
          ? isInstructor ? 'bg-indigo-600 text-white' : 'bg-violet-600 text-white'
          : 'bg-slate-100 text-slate-400'
      }`}>
        {isInstructor ? <LayoutDashboard size={20} /> : <BookOpen size={20} />}
      </div>
      <div className="text-center">
        <div className="text-sm font-700">{isInstructor ? '교수 / 강사' : '학생'}</div>
        <div className="text-xs mt-0.5 opacity-70">
          {isInstructor ? '성적 평가 · 채점 관리' : '성적 확인 · 리포트'}
        </div>
      </div>
      {selected && (
        <span className={`text-xs font-700 px-2 py-0.5 rounded-full ${
          isInstructor ? 'bg-indigo-600 text-white' : 'bg-violet-600 text-white'
        }`}>선택됨</span>
      )}
    </button>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('login')
  const [role, setRole] = useState<Role>('student')
  const [showPw, setShowPw] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [department, setDepartment] = useState('')
  const [studentId, setStudentId] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function resetForm() {
    setName(''); setEmail(''); setPassword(''); setDepartment(''); setStudentId(''); setError('')
  }
  function switchTab(t: Tab) { setTab(t); resetForm() }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (tab === 'login') {
      const { ok, error: err } = await login(email, password)
      if (!ok) { setError(err ?? '로그인에 실패했습니다.'); setLoading(false); return }
    } else {
      if (!name.trim()) { setError('이름을 입력해주세요.'); setLoading(false); return }
      if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); setLoading(false); return }
      const { ok, error: err } = await signup({
        name: name.trim(), email, password, role,
        department: department.trim() || undefined,
        studentId: role === 'student' ? (studentId.trim() || undefined) : undefined,
      })
      if (!ok) { setError(err ?? '회원가입에 실패했습니다.'); setLoading(false); return }
    }

    router.push('/')
  }

  function fillDemo(r: Role) {
    setTab('login')
    setEmail(r === 'instructor' ? 'prof@gradelens.kr' : 'student@gradelens.kr')
    setPassword('demo1234')
    setError('')
  }

  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute top-[-80px] right-[-80px] w-80 h-80 bg-white/5 rounded-full" />
        <div className="absolute bottom-[-60px] left-[-60px] w-64 h-64 bg-white/5 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
            <GraduationCap size={22} className="text-white" />
          </div>
          <div>
            <div className="text-xl font-800 text-white tracking-tight">GradeLens</div>
            <div className="text-xs text-indigo-200 font-500">AI 자동 채점 및 성적 분석</div>
          </div>
        </div>

        {/* Center content */}
        <div className="relative space-y-8">
          <div>
            <h2 className="text-3xl font-800 text-white leading-tight">
              AI 채점 어시스턴트,<br />교육 혁신에 날개를 달다
            </h2>
            <p className="mt-4 text-indigo-200 text-sm leading-relaxed">
              GradeLens는 AI 기반 1차 채점으로 교수님의 채점 부담을 줄이고,<br />
              학생에게는 투명한 성적 피드백을 제공합니다.
            </p>
          </div>
          <div className="space-y-3">
            {[
              'AI가 루브릭 기반으로 1차 채점',
              '교수님이 최종 점수를 검토 · 확정',
              '학생은 상세한 AI 피드백 리포트 확인',
              '성적 분포 시뮬레이션으로 공정한 등급 산출',
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-indigo-100">
                <span className="text-indigo-300 text-xs">✦</span>
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* Demo accounts */}
        <div className="relative">
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/20">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-indigo-200" />
              <span className="text-xs font-700 text-indigo-200 uppercase tracking-wider">데모 계정</span>
            </div>
            <div className="space-y-2">
              <button onClick={() => fillDemo('instructor')}
                className="w-full flex items-center justify-between px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-xs text-white">
                <span>교수 계정으로 체험</span><ArrowRight size={12} />
              </button>
              <button onClick={() => fillDemo('student')}
                className="w-full flex items-center justify-between px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-xs text-white">
                <span>학생 계정으로 체험</span><ArrowRight size={12} />
              </button>
            </div>
            <p className="text-indigo-300 text-xs mt-2 opacity-70">비밀번호: demo1234</p>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-slate-50">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <GraduationCap size={19} className="text-white" />
          </div>
          <div>
            <div className="text-base font-800 text-slate-800">GradeLens</div>
            <div className="text-xs text-slate-400">AI 자동 채점 및 성적 분석</div>
          </div>
        </div>

        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-slate-100">
              {(['login', 'signup'] as Tab[]).map(t => (
                <button key={t} onClick={() => switchTab(t)}
                  className={`flex-1 py-4 text-sm font-700 transition-all ${
                    tab === t
                      ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}>
                  {t === 'login' ? '로그인' : '회원가입'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="p-7 space-y-5">
              <div>
                <h1 className="text-xl font-800 text-slate-800">
                  {tab === 'login' ? '다시 만나서 반가워요 👋' : 'GradeLens에 오신 걸 환영해요'}
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  {tab === 'login'
                    ? '이메일과 비밀번호로 로그인하세요.'
                    : '계정을 만들고 AI 채점 시스템을 시작하세요.'}
                </p>
              </div>

              {/* Role selector (signup only) */}
              {tab === 'signup' && (
                <div className="space-y-2">
                  <label className="text-xs font-700 text-slate-600 uppercase tracking-wider">역할 선택</label>
                  <div className="flex gap-3">
                    <RoleCard role="instructor" selected={role === 'instructor'} onClick={() => setRole('instructor')} />
                    <RoleCard role="student" selected={role === 'student'} onClick={() => setRole('student')} />
                  </div>
                </div>
              )}

              {/* Name (signup only) */}
              {tab === 'signup' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-700 text-slate-600">이름</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder={role === 'instructor' ? '홍길동' : '김민준'} required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-all" />
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-700 text-slate-600">이메일</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="name@university.ac.kr" required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-all" />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-700 text-slate-600">비밀번호</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={tab === 'signup' ? '6자 이상 입력하세요' : '비밀번호 입력'} required
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-all" />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Department (signup) */}
              {tab === 'signup' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-700 text-slate-600">
                    학과 <span className="text-slate-400 font-500">(선택)</span>
                  </label>
                  <input type="text" value={department} onChange={e => setDepartment(e.target.value)}
                    placeholder="컴퓨터공학과"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-all" />
                </div>
              )}

              {/* Student ID (signup + student) */}
              {tab === 'signup' && role === 'student' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-700 text-slate-600">
                    학번 <span className="text-slate-400 font-500">(선택)</span>
                  </label>
                  <input type="text" value={studentId} onChange={e => setStudentId(e.target.value)}
                    placeholder="20210342"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-all" />
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-700 rounded-xl shadow-lg shadow-indigo-200/60 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    처리 중...
                  </span>
                ) : (
                  <>{tab === 'login' ? '로그인' : '회원가입'}<ArrowRight size={16} /></>
                )}
              </button>

              <p className="text-center text-xs text-slate-400">
                {tab === 'login' ? (
                  <>계정이 없으신가요?{' '}
                    <button type="button" onClick={() => switchTab('signup')} className="text-indigo-600 font-700 hover:underline">회원가입</button>
                  </>
                ) : (
                  <>이미 계정이 있으신가요?{' '}
                    <button type="button" onClick={() => switchTab('login')} className="text-indigo-600 font-700 hover:underline">로그인</button>
                  </>
                )}
              </p>
            </form>
          </div>

          {/* Mobile demo buttons */}
          <div className="lg:hidden mt-5 bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={13} className="text-indigo-500" />
              <span className="text-xs font-700 text-slate-600">데모 계정으로 빠르게 체험</span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => fillDemo('instructor')}
                className="flex-1 py-2 text-xs font-600 border border-indigo-200 text-indigo-600 rounded-xl hover:bg-indigo-50 transition-colors">
                교수 계정
              </button>
              <button type="button" onClick={() => fillDemo('student')}
                className="flex-1 py-2 text-xs font-600 border border-violet-200 text-violet-600 rounded-xl hover:bg-violet-50 transition-colors">
                학생 계정
              </button>
            </div>
            <p className="text-slate-400 text-xs mt-1.5">비밀번호: demo1234</p>
          </div>
        </div>
      </div>
    </div>
  )
}
