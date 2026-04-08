'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ClipboardList, BarChart3, Users, Settings, BookOpen,
  Trophy, GraduationCap, ChevronRight, Bell, Search,
  FileText, MessageCircle, LogOut
} from 'lucide-react'
import { MOCK_STUDENTS, MOCK_ASSIGNMENT } from '@/lib/mockData'
import { getCurrentUser, logout } from '@/lib/auth'
import type { AuthUser } from '@/lib/auth'
import RubricBuilder from '@/components/instructor/RubricBuilder'
import GradingTable from '@/components/instructor/GradingTable'
import GradeOptimizer from '@/components/instructor/GradeOptimizer'
import GradeReport from '@/components/student/GradeReport'
import ChatBot from '@/components/student/ChatBot'
import { Avatar } from '@/components/ui'
import type { Student } from '@/lib/mockData'

type ViewMode = 'instructor' | 'student'
type InstructorSection = 'grading' | 'stats' | 'students' | 'settings'
type StudentSection = 'report' | 'assignments' | 'ranking'

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
  view,
  instructorSection, setInstructorSection,
  studentSection, setStudentSection,
  students, user, onLogout,
}: {
  view: ViewMode
  instructorSection: InstructorSection; setInstructorSection: (s: InstructorSection) => void
  studentSection: StudentSection; setStudentSection: (s: StudentSection) => void
  students: Student[]
  user: AuthUser
  onLogout: () => void
}) {
  const pendingCount = students.filter(s => s.status === 'pending').length

  return (
    <aside className="w-56 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 min-h-screen">
      {/* Logo */}
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

      {/* Role Badge */}
      <div className="px-3 pt-4 pb-2">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
          view === 'instructor'
            ? 'bg-indigo-50 border border-indigo-100'
            : 'bg-violet-50 border border-violet-100'
        }`}>
          <div className={`w-2 h-2 rounded-full ${view === 'instructor' ? 'bg-indigo-500' : 'bg-violet-500'}`} />
          <span className={`text-xs font-700 ${view === 'instructor' ? 'text-indigo-700' : 'text-violet-700'}`}>
            {view === 'instructor' ? '교수 · 강사 모드' : '학생 모드'}
          </span>
        </div>
      </div>

      {/* Navigation */}
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

      {/* Course Info */}
      <div className="px-3 pb-3">
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
          <div className="text-xs font-700 text-indigo-700 mb-1">현재 과제</div>
          <div className="text-xs text-indigo-600 leading-snug font-500">{MOCK_ASSIGNMENT.course}</div>
          <div className="text-xs text-indigo-400 mt-1">
            {students.filter(s => s.status === 'confirmed').length}/{students.length}명 완료
          </div>
          <div className="mt-2 bg-indigo-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.round(students.filter(s => s.status === 'confirmed').length / students.length * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* User */}
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

function Topbar({ section, user }: { section: string; user: AuthUser }) {
  const titles: Record<string, string> = {
    grading: 'AI 채점 관리', stats: '성적 통계', students: '수강생 관리',
    settings: '시스템 설정', report: '나의 성적 리포트', assignments: '과제 목록', ranking: '학급 순위'
  }
  const subs: Record<string, string> = {
    grading: `${MOCK_ASSIGNMENT.course} · 수강생 ${MOCK_STUDENTS.length}명`,
    report: `${MOCK_ASSIGNMENT.course} · 최종 보고서`,
    students: `${MOCK_ASSIGNMENT.course}`,
    stats: `${MOCK_ASSIGNMENT.course}`,
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

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [view, setView] = useState<ViewMode>('student')
  const [instructorSection, setInstructorSection] = useState<InstructorSection>('grading')
  const [studentSection, setStudentSection] = useState<StudentSection>('report')
  const [students, setStudents] = useState<Student[]>(MOCK_STUDENTS)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      router.replace('/login')
      return
    }
    setUser(currentUser)
    setView(currentUser.role === 'instructor' ? 'instructor' : 'student')
  }, [router])

  function handleLogout() {
    logout()
    router.replace('/login')
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
        instructorSection={instructorSection} setInstructorSection={setInstructorSection}
        studentSection={studentSection} setStudentSection={setStudentSection}
        students={students}
        user={user}
        onLogout={handleLogout}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar section={currentSection} user={user} />
        <main className="flex-1 p-6 overflow-y-auto">
          {view === 'instructor' && instructorSection === 'grading' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <RubricBuilder />
              <GradingTable students={students} setStudents={setStudents} />
              <GradeOptimizer students={students} />
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
          {view === 'student' && studentSection === 'report' && (
            <div className="max-w-5xl mx-auto">
              <GradeReport />
            </div>
          )}
          {view === 'student' && studentSection !== 'report' && (
            <div className="flex items-center justify-center h-64 text-slate-400">
              <div className="text-center">
                <MessageCircle size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">이 섹션은 준비 중입니다</p>
              </div>
            </div>
          )}
        </main>
      </div>
      {view === 'student' && <ChatBot />}
    </div>
  )
}
