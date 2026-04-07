'use client'
import { useState } from 'react'
import {
  ClipboardList, BarChart3, Users, Settings, BookOpen,
  Trophy, GraduationCap, ChevronRight, Bell, Search,
  LayoutDashboard, FileText, MessageCircle
} from 'lucide-react'
import { MOCK_STUDENTS, MOCK_ASSIGNMENT } from '@/lib/mockData'
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
  view, setView, instructorSection, setInstructorSection, studentSection, setStudentSection, students,
}: {
  view: ViewMode; setView: (v: ViewMode) => void
  instructorSection: InstructorSection; setInstructorSection: (s: InstructorSection) => void
  studentSection: StudentSection; setStudentSection: (s: StudentSection) => void
  students: Student[]
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
            <div className="text-sm font-800 text-slate-800 tracking-tight">GradeAI</div>
            <div className="text-xs text-slate-400 font-500">Auto Grading System</div>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="px-3 pt-4 pb-2">
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          {[
            { id: 'instructor' as ViewMode, label: '교수', icon: <LayoutDashboard size={12} /> },
            { id: 'student' as ViewMode, label: '학생', icon: <BookOpen size={12} /> },
          ].map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-700 transition-all duration-200 ${
                view === id
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {icon}{label}
            </button>
          ))}
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
      <div className="px-3 pb-4 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
          <Avatar name={view === 'instructor' ? '이' : '김'} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-600 text-slate-800 truncate">
              {view === 'instructor' ? '이채점 교수님' : '김민준'}
            </div>
            <div className="text-xs text-slate-400 truncate">
              {view === 'instructor' ? '컴퓨터공학과' : '학번 20210342'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

function Topbar({ view, section }: { view: ViewMode; section: string }) {
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
        <Avatar name={view === 'instructor' ? '이' : '김'} />
      </div>
    </header>
  )
}

export default function Dashboard() {
  const [view, setView] = useState<ViewMode>('instructor')
  const [instructorSection, setInstructorSection] = useState<InstructorSection>('grading')
  const [studentSection, setStudentSection] = useState<StudentSection>('report')
  const [students, setStudents] = useState<Student[]>(MOCK_STUDENTS)

  const currentSection = view === 'instructor' ? instructorSection : studentSection

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        view={view} setView={setView}
        instructorSection={instructorSection} setInstructorSection={setInstructorSection}
        studentSection={studentSection} setStudentSection={setStudentSection}
        students={students}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar view={view} section={currentSection} />
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
