'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ClipboardList, BarChart3, Users, Settings, BookOpen,
  Trophy, GraduationCap, ChevronRight, ChevronLeft, Bell, Search,
  FileText, LogOut, CheckCircle2, Calendar, Plus, Clock
} from 'lucide-react'
import { MOCK_STUDENTS, MOCK_ASSIGNMENT, INITIAL_RUBRICS } from '@/lib/mockData'
import { getCurrentUser, logout } from '@/lib/auth'
import type { AuthUser } from '@/lib/auth'
import RubricBuilder from '@/components/instructor/RubricBuilder'
import GradingTable from '@/components/instructor/GradingTable'
import GradeOptimizer from '@/components/instructor/GradeOptimizer'
import GradeReport from '@/components/student/GradeReport'
import AssignmentSubmit from '@/components/student/AssignmentSubmit'
import ChatBot from '@/components/student/ChatBot'
import { Avatar } from '@/components/ui'
import type { Student } from '@/lib/mockData'

type ViewMode = 'instructor' | 'student'
type InstructorSection = 'grading' | 'stats' | 'students' | 'settings'
type StudentSection = 'report' | 'assignments' | 'ranking'
type InstructorGradingView = 'list' | 'detail' | 'create'

interface AssignmentItem {
  id: string
  title: string
  course: string
  deadline: string
  created_at: string
  is_active: number
}

const INSTRUCTOR_NAV: { id: InstructorSection; label: string; icon: React.ReactNode; sub?: string }[] = [
  { id: 'grading', label: 'AI 채점 관리', icon: <ClipboardList size={16} />, sub: '과제 · 루브릭 · 검토' },
  { id: 'stats', label: '성적 통계', icon: <BarChart3 size={16} /> },
  { id: 'students', label: '수강생 관리', icon: <Users size={16} /> },
  { id: 'settings', label: '시스템 설정', icon: <Settings size={16} /> },
]
const STUDENT_NAV: { id: StudentSection; label: string; icon: React.ReactNode }[] = [
  { id: 'report', label: '나의 성적 리포트', icon: <FileText size={16} /> },
  { id: 'assignments', label: '과제 목록', icon: <BookOpen size={16} /> },
  { id: 'ranking', label: '학급 순위', icon: <Trophy size={16} /> },
]

// ── Instructor Assignment List ────────────────────────────────────────────────
function InstructorAssignmentList({
  assignments,
  onSelect,
  onCreateNew,
}: {
  assignments: AssignmentItem[]
  onSelect: (id: string) => void
  onCreateNew: () => void
}) {
  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-700 text-slate-800">과제 목록</h2>
          <p className="text-xs text-slate-400">과제를 선택하여 AI 채점 관리를 시작하세요</p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm font-600 rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus size={14} /> 새 과제 만들기
        </button>
      </div>

      {assignments.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3">
          <ClipboardList size={36} className="opacity-30" />
          <p className="text-sm">등록된 과제가 없습니다.</p>
          <button
            onClick={onCreateNew}
            className="text-sm text-indigo-600 hover:underline"
          >
            첫 번째 과제 만들기 →
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {assignments.map((a, idx) => {
            const deadline = new Date(a.deadline)
            const now = new Date()
            const isPast = now > deadline
            const hoursLeft = Math.max(0, Math.round((deadline.getTime() - now.getTime()) / 3600000))
            return (
              <div
                key={a.id}
                onClick={() => onSelect(a.id)}
                className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-800 text-indigo-600">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-700 text-slate-800 truncate">{a.title}</span>
                      <span className={`text-xs font-600 px-2 py-0.5 rounded-full ${
                        isPast ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {isPast ? '마감됨' : '진행 중'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>{a.course}</span>
                      <span>·</span>
                      <Clock size={10} className="inline" />
                      <span>
                        {isPast
                          ? `마감 ${new Date(a.deadline).toLocaleDateString('ko-KR')}`
                          : hoursLeft < 24 ? `${hoursLeft}시간 남음` : `D-${Math.ceil(hoursLeft / 24)}`}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-xs text-indigo-600 font-600">채점 관리 →</span>
                  <ChevronRight size={14} className="text-slate-300" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Info Bar ─────────────────────────────────────────────────────────────────
function DashboardInfoBar({
  view, students, user, courseName,
}: {
  view: ViewMode; students: Student[]; user: AuthUser; courseName: string
}) {
  const confirmed = students.filter(s => s.status === 'confirmed')
  const completionPct = students.length ? Math.round(confirmed.length / students.length * 100) : 0
  const avgScore = confirmed.length > 0
    ? Math.round(confirmed.reduce((a, s) => a + (s.confirmedScore ?? s.aiScore), 0) / confirmed.length)
    : 0

  const sortedByScore = [...confirmed].sort((a, b) => (b.confirmedScore ?? 0) - (a.confirmedScore ?? 0))
  const studentRank = Math.max(
    1,
    sortedByScore.findIndex(s => s.studentId === user.studentId || s.name === user.name) + 1 || 1
  )
  const rankPct = sortedByScore.length > 0
    ? Math.round((1 - (studentRank - 1) / sortedByScore.length) * 100)
    : 100
  const topRubrics = INITIAL_RUBRICS.slice(0, 2).map(r => `${r.text.slice(0, 6)} ${r.pts}점`).join(' · ')

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <Users size={13} className="text-slate-400" />
            <div>
              <div className="text-xs text-slate-400 leading-none mb-0.5">총 수강생</div>
              <div className="text-sm font-700 text-slate-800 leading-none">{students.length}명</div>
            </div>
          </div>
          <div className="w-px h-7 bg-slate-100" />
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-500" />
            <div>
              <div className="text-xs text-slate-400 leading-none mb-0.5">채점 완료</div>
              <div className="text-sm font-700 text-emerald-600 leading-none">{completionPct}%</div>
            </div>
          </div>
          <div className="w-px h-7 bg-slate-100" />
          <div className="flex items-center gap-1.5">
            <BarChart3 size={13} className="text-indigo-500" />
            <div>
              <div className="text-xs text-slate-400 leading-none mb-0.5">전체 평균</div>
              <div className="text-sm font-700 text-indigo-600 leading-none">{avgScore || '—'}점</div>
            </div>
          </div>
          <div className="w-px h-7 bg-slate-100" />
          <div className="flex items-center gap-1.5">
            <ClipboardList size={13} className="text-violet-500" />
            <div>
              <div className="text-xs text-slate-400 leading-none mb-0.5">주요 채점 기준</div>
              <div className="text-xs font-600 text-slate-600 leading-none">{topRubrics}</div>
            </div>
          </div>

          {view === 'student' && sortedByScore.length > 0 && (
            <>
              <div className="w-px h-7 bg-slate-100" />
              <div className="flex items-center gap-2">
                <Trophy size={13} className="text-amber-500" />
                <div>
                  <div className="text-xs text-slate-400 leading-none mb-0.5">내 순위</div>
                  <div className="flex items-baseline gap-1 leading-none">
                    <span className="text-sm font-800 text-amber-600">{studentRank}위</span>
                    <span className="text-xs text-slate-400">/ {sortedByScore.length}명</span>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 ml-1">
                  <div className="text-xs font-700 text-amber-600 leading-none text-right">상위 {rankPct}%</div>
                  <div className="relative w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-300 via-amber-300 to-emerald-400 rounded-full" />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-amber-500 rounded-full shadow-sm"
                      style={{ left: `calc(${rankPct}% - 6px)` }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="text-slate-400" />
            <div>
              <div className="text-xs text-slate-400 leading-none mb-0.5">현재 학기</div>
              <div className="text-sm font-700 text-slate-700 leading-none">2026년 1학기</div>
            </div>
          </div>
          <div className="w-px h-7 bg-slate-100" />
          <div>
            <div className="text-xs text-slate-400 leading-none mb-0.5">과목명</div>
            <div className="text-sm font-700 text-indigo-700 leading-none">{courseName}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
function SidebarItem({ icon, label, active, onClick, badge }: {
  icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void; badge?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group ${
        active
          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
      }`}
    >
      <span className={active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}>{icon}</span>
      <span className="flex-1 text-sm font-600">{label}</span>
      {badge && (
        <span className={`text-xs font-700 px-2 py-0.5 rounded-full ${
          active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
        }`}>{badge}</span>
      )}
      {!badge && active && <ChevronRight size={13} className="text-white/60" />}
    </button>
  )
}

function Sidebar({
  view, instructorSection, setInstructorSection,
  studentSection, setStudentSection,
  students, user, onLogout, courseName,
}: {
  view: ViewMode
  instructorSection: InstructorSection; setInstructorSection: (s: InstructorSection) => void
  studentSection: StudentSection; setStudentSection: (s: StudentSection) => void
  students: Student[]; user: AuthUser; onLogout: () => void; courseName: string
}) {
  const pendingCount = students.filter(s => s.status === 'pending').length

  return (
    <aside className="w-56 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 min-h-screen">
      <div className="px-4 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
            <GraduationCap size={17} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-800 text-slate-800 tracking-tight">GradeLens</div>
            <div className="text-xs text-slate-400 font-500">AI 성적 관리 시스템</div>
          </div>
        </div>
      </div>

      <div className="px-3 pt-4 pb-2">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
          view === 'instructor' ? 'bg-indigo-50 border border-indigo-100' : 'bg-violet-50 border border-violet-100'
        }`}>
          <div className={`w-2 h-2 rounded-full ${view === 'instructor' ? 'bg-indigo-500' : 'bg-violet-500'}`} />
          <span className={`text-xs font-700 ${view === 'instructor' ? 'text-indigo-700' : 'text-violet-700'}`}>
            {view === 'instructor' ? '교수 · 강사 모드' : '학생 모드'}
          </span>
        </div>
      </div>

      <div className="flex-1 px-3 py-2 space-y-0.5">
        <div className="text-xs font-700 text-slate-400 uppercase tracking-widest px-2 mb-2 mt-2">
          {view === 'instructor' ? '교수 메뉴' : '학생 메뉴'}
        </div>
        {view === 'instructor'
          ? INSTRUCTOR_NAV.map(item => (
              <SidebarItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={instructorSection === item.id}
                onClick={() => setInstructorSection(item.id)}
                badge={item.id === 'grading' && pendingCount > 0 ? String(pendingCount) : undefined}
              />
            ))
          : STUDENT_NAV.map(item => (
              <SidebarItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={studentSection === item.id}
                onClick={() => setStudentSection(item.id)}
              />
            ))
        }
      </div>

      <div className="px-3 pb-3">
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
          <div className="text-xs font-700 text-indigo-700 mb-1">현재 과목</div>
          <div className="text-xs text-indigo-600 leading-snug font-500">{courseName}</div>
          <div className="text-xs text-indigo-400 mt-1">
            {students.filter(s => s.status === 'confirmed').length}/{students.length}명 완료
          </div>
          <div className="mt-2 bg-indigo-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${students.length ? Math.round(students.filter(s => s.status === 'confirmed').length / students.length * 100) : 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="px-3 pb-4 border-t border-slate-100 pt-3 space-y-1">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
          <Avatar name={user.name.charAt(0)} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-600 text-slate-800 truncate">
              {user.name}{user.role === 'instructor' ? ' 교수님' : ''}
            </div>
            <div className="text-xs text-slate-400 truncate">
              {user.role === 'instructor'
                ? (user.department || '교수')
                : (user.studentId ? `학번 ${user.studentId}` : (user.department || '학생'))}
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-150"
        >
          <LogOut size={13} />
          로그아웃
        </button>
      </div>
    </aside>
  )
}

// ── Topbar ───────────────────────────────────────────────────────────────────
function Topbar({ section, user }: { section: string; user: AuthUser }) {
  const titles: Record<string, string> = {
    grading: 'AI 채점 관리', stats: '성적 통계', students: '수강생 관리',
    settings: '시스템 설정', report: '나의 성적 리포트', assignments: '과제 목록', ranking: '학급 순위',
  }
  const subs: Record<string, string> = {
    grading: `${MOCK_ASSIGNMENT.course} · 루브릭 설정 → 학생 제출 → AI 채점 → 교수 확정`,
    report: `최신 AI 피드백 리포트`,
    assignments: `과제 제출 · AI 즉시 채점`,
  }

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between">
      <div>
        <h1 className="text-base font-800 text-slate-800 tracking-tight">{titles[section] ?? section}</h1>
        <p className="text-xs text-slate-400 mt-0.5">{subs[section] ?? ''}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="검색..."
            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:bg-white w-40"
          />
        </div>
        <button className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
          <Bell size={16} className="text-slate-500" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <Avatar name={user.name.charAt(0)} />
      </div>
    </header>
  )
}

// ── Dashboard (main) ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [view, setView] = useState<ViewMode>('student')
  const [instructorSection, setInstructorSection] = useState<InstructorSection>('grading')
  const [studentSection, setStudentSection] = useState<StudentSection>('report')
  const [students] = useState<Student[]>(MOCK_STUDENTS)

  // Track active assignment ID (set when instructor selects or publishes)
  const [currentAssignmentId, setCurrentAssignmentId] = useState<string | undefined>(undefined)
  const [courseName, setCourseName] = useState(MOCK_ASSIGNMENT.course)
  const [allAssignments, setAllAssignments] = useState<AssignmentItem[]>([])
  const [instructorGradingView, setInstructorGradingView] = useState<InstructorGradingView>('list')

  useEffect(() => {
    getCurrentUser().then(currentUser => {
      if (!currentUser) { router.replace('/login'); return }
      setUser(currentUser)
      setView(currentUser.role === 'instructor' ? 'instructor' : 'student')
    })
  }, [router])

  const refreshAssignments = () => {
    fetch('/api/assignments')
      .then(r => r.json())
      .then(data => {
        if (data.assignments?.length > 0) {
          setAllAssignments(data.assignments)
          setCourseName(data.assignments[0].course ?? MOCK_ASSIGNMENT.course)
        }
      })
      .catch(() => {})
  }

  useEffect(() => { refreshAssignments() }, [])

  const handleLogout = async () => {
    await logout()
    router.replace('/login')
  }

  const handleAssignmentPublished = (id: string) => {
    setCurrentAssignmentId(id)
    refreshAssignments()
    setInstructorGradingView('detail')
  }

  const handleSetInstructorSection = (s: InstructorSection) => {
    setInstructorSection(s)
    if (s === 'grading') setInstructorGradingView('list')
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center animate-pulse">
            <GraduationCap size={20} className="text-white" />
          </div>
          <p className="text-sm text-slate-400">불러오는 중...</p>
        </div>
      </div>
    )
  }

  const currentSection = view === 'instructor' ? instructorSection : studentSection

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        view={view}
        instructorSection={instructorSection} setInstructorSection={handleSetInstructorSection}
        studentSection={studentSection} setStudentSection={setStudentSection}
        students={students}
        user={user}
        onLogout={handleLogout}
        courseName={courseName}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar section={currentSection} user={user} />
        <DashboardInfoBar view={view} students={students} user={user} courseName={courseName} />
        <main className="flex-1 p-6 overflow-y-auto">

          {/* ── Instructor ── */}
          {view === 'instructor' && instructorSection === 'grading' && instructorGradingView === 'list' && (
            <InstructorAssignmentList
              assignments={allAssignments}
              onSelect={id => {
                setCurrentAssignmentId(id)
                setInstructorGradingView('detail')
              }}
              onCreateNew={() => setInstructorGradingView('create')}
            />
          )}
          {view === 'instructor' && instructorSection === 'grading' && instructorGradingView === 'create' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <button
                onClick={() => setInstructorGradingView('list')}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
              >
                <ChevronLeft size={15} /> 과제 목록으로
              </button>
              <RubricBuilder onPublished={handleAssignmentPublished} />
            </div>
          )}
          {view === 'instructor' && instructorSection === 'grading' && instructorGradingView === 'detail' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <button
                onClick={() => setInstructorGradingView('list')}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
              >
                <ChevronLeft size={15} /> 과제 목록으로
              </button>
              <GradingTable assignmentId={currentAssignmentId} />
              <GradeOptimizer assignmentId={currentAssignmentId} />
            </div>
          )}
          {view === 'instructor' && instructorSection !== 'grading' && (
            <div className="flex items-center justify-center h-64 text-slate-400">
              <div className="text-center">
                <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">이 섹션은 준비 중입니다</p>
              </div>
            </div>
          )}

          {/* ── Student ── */}
          {view === 'student' && studentSection === 'report' && (
            <div className="max-w-5xl mx-auto">
              <GradeReport user={user} />
            </div>
          )}
          {view === 'student' && studentSection === 'assignments' && (
            <AssignmentSubmit user={user} />
          )}
          {view === 'student' && studentSection === 'ranking' && (
            <div className="flex items-center justify-center h-64 text-slate-400">
              <div className="text-center">
                <Trophy size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">이 섹션은 준비 중입니다</p>
              </div>
            </div>
          )}
        </main>
      </div>
      {view === 'student' && <ChatBot user={user} />}
    </div>
  )
}
