'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ClipboardList, BarChart3, Users, Settings, BookOpen,
  GraduationCap, ChevronRight, ChevronLeft, Bell, Search,
  FileText, LogOut, CheckCircle2, Calendar, Plus, Clock, Trash2,
  RefreshCw, MessageSquare,
} from 'lucide-react'
import { MOCK_STUDENTS, MOCK_ASSIGNMENT } from '@/lib/mockData'
import { getCurrentUser, logout } from '@/lib/auth'
import type { AuthUser } from '@/lib/auth'
import RubricBuilder from '@/components/instructor/RubricBuilder'
import GradingTable from '@/components/instructor/GradingTable'
import GradeOptimizer from '@/components/instructor/GradeOptimizer'
import StudentInquiries from '@/components/instructor/StudentInquiries'
import GradeReport from '@/components/student/GradeReport'
import AssignmentSubmit from '@/components/student/AssignmentSubmit'
import ChatBot from '@/components/student/ChatBot'
import { Avatar, Badge, Button, Card } from '@/components/ui'
import type { Student } from '@/lib/mockData'

type ViewMode = 'instructor' | 'student'
type InstructorSection = 'grading' | 'inquiries' | 'stats' | 'students' | 'settings'
type StudentSection = 'assignments'
// 학생 서브뷰: 목록 / 제출 폼 / 성적 리포트
type StudentView = 'list' | 'submit' | 'report'
type InstructorGradingView = 'list' | 'detail' | 'create'

interface AssignmentItem {
  id: string
  title: string
  course: string
  deadline: string
  created_at: string
  is_active: number
  // 교수 모드 전용: API가 반환하는 제출 현황 카운트
  sub_total?: number
  sub_published?: number
}

interface Notification {
  id: string
  type: string
  title: string
  body: string
  assignment_id: string | null
  is_read: number
  created_at: string
}

// 학생 제출 요약 (목록용)
interface SubmissionSummary {
  id: string
  assignment_id: string
  grade_status: string
  ai_score: number | null
  confirmed_score: number | null
}

const INSTRUCTOR_NAV: { id: InstructorSection; label: string; icon: React.ReactNode; sub?: string }[] = [
  { id: 'grading', label: 'AI 채점 관리', icon: <ClipboardList size={16} />, sub: '과제 · 루브릭 · 검토' },
  { id: 'inquiries', label: '학생 긴급 문의', icon: <MessageSquare size={16} /> },
  { id: 'stats', label: '성적 통계', icon: <BarChart3 size={16} /> },
  { id: 'students', label: '수강생 관리', icon: <Users size={16} /> },
  { id: 'settings', label: '시스템 설정', icon: <Settings size={16} /> },
]
const STUDENT_NAV: { id: StudentSection; label: string; icon: React.ReactNode }[] = [
  { id: 'assignments', label: '과제 목록', icon: <BookOpen size={16} /> },
]

// ── Notification Bell ────────────────────────────────────────────────────────
function NotificationBell({
  onNavigateAssignment,
  onNavigateInquiry,
  onOpenChatBot,
}: {
  onNavigateAssignment?: (assignmentId: string) => void
  onNavigateInquiry?: (studentUserId: string) => void
  onOpenChatBot?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setUnread(data.unreadCount ?? 0)
    } catch {}
  }, [])

  useEffect(() => {
    fetchNotifs()
    const id = setInterval(fetchNotifs, 15000)
    return () => clearInterval(id)
  }, [fetchNotifs])

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH' })
    setUnread(0)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })))
  }

  const handleOpen = () => {
    setOpen(o => !o)
    if (!open && unread > 0) markAllRead()
  }

  const handleNotifClick = (n: Notification) => {
    if (n.type === 'student_inquiry') {
      // 교수: 문의한 학생의 답변 창으로 이동 (assignment_id = student user_id)
      if (n.assignment_id && onNavigateInquiry) {
        onNavigateInquiry(n.assignment_id)
        setOpen(false)
      }
    } else if (n.type === 'professor_reply') {
      // 학생: 챗봇 열기
      if (onOpenChatBot) {
        onOpenChatBot()
        setOpen(false)
      }
    } else if (n.assignment_id && onNavigateAssignment) {
      // 학생: 성적 리포트로 이동
      onNavigateAssignment(n.assignment_id)
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
      >
        <Bell size={16} className="text-slate-500" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-800 flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-700 text-slate-800">알림</span>
            {notifications.length > 0 && (
              <button onClick={markAllRead} className="text-xs text-indigo-500 hover:underline">모두 읽음</button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-slate-400 gap-1">
                <Bell size={18} className="opacity-30" />
                <p className="text-xs">알림이 없습니다</p>
              </div>
            ) : notifications.map(n => {
              const isInquiry = n.type === 'student_inquiry'
              const isProfReply = n.type === 'professor_reply'
              const isClickable = isInquiry
                ? !!onNavigateInquiry
                : isProfReply
                ? !!onOpenChatBot
                : !!(n.assignment_id && onNavigateAssignment)
              return (
                <div
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={`px-4 py-3 border-b transition-colors ${
                    isInquiry
                      ? `border-red-100 ${n.is_read ? 'bg-red-50/30' : 'bg-red-50'} hover:bg-red-100/60 cursor-pointer`
                      : isProfReply
                      ? `border-amber-100 ${n.is_read ? 'bg-amber-50/30' : 'bg-amber-50'} hover:bg-amber-100/60 cursor-pointer`
                      : `border-slate-50 ${isClickable ? 'cursor-pointer hover:bg-indigo-50' : 'hover:bg-slate-50'}`
                  } ${n.is_read && !isInquiry && !isProfReply ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {isInquiry ? (
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${n.is_read ? 'bg-red-100' : 'bg-red-500'}`}>
                        <span className="text-[9px]">{n.is_read ? '📩' : '🔴'}</span>
                      </div>
                    ) : isProfReply ? (
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${n.is_read ? 'bg-amber-100' : 'bg-amber-400'}`}>
                        <span className="text-[9px]">👨‍🏫</span>
                      </div>
                    ) : (
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${n.is_read ? 'bg-slate-300' : 'bg-indigo-500'}`} />
                    )}
                    <div className="flex-1 min-w-0">
                      {isInquiry && !n.is_read && (
                        <span className="inline-block text-[9px] font-800 bg-red-500 text-white px-1.5 py-0.5 rounded-full mb-1">긴급 문의</span>
                      )}
                      {isProfReply && !n.is_read && (
                        <span className="inline-block text-[9px] font-800 bg-amber-500 text-white px-1.5 py-0.5 rounded-full mb-1">교수님 답변</span>
                      )}
                      <p className={`text-xs font-700 ${isInquiry ? 'text-red-700' : isProfReply ? 'text-amber-700' : 'text-slate-800'}`}>{n.title}</p>
                      {/* 교수 측 긴급 문의: 학생 메시지 + 안내 문구 분리 표시 */}
                      {isInquiry ? (
                        <div className="mt-0.5 space-y-1">
                          <p className="text-xs text-slate-700 bg-white border border-red-100 rounded-lg px-2 py-1 leading-relaxed">
                            &ldquo;{n.body}&rdquo;
                          </p>
                          <p className="text-xs text-slate-400">학생이 직접 문의를 요청했습니다. 채점 현황을 확인하고 답변해 주세요.</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-slate-300">{new Date(n.created_at.replace(' ', 'T') + 'Z').toLocaleString('ko-KR')}</p>
                        {isClickable && (
                          <span className={`text-xs font-600 ${isInquiry ? 'text-red-500' : isProfReply ? 'text-amber-500' : 'text-indigo-500'}`}>
                            {isInquiry ? '답변하기 →' : isProfReply ? '챗봇 열기 →' : '성적 확인 →'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Instructor Assignment List ────────────────────────────────────────────────
// 완료 조건: 제출이 1개 이상 존재하고 전체가 공지(is_published=1) 처리된 과제
function isCompleted(a: AssignmentItem): boolean {
  return (a.sub_total ?? 0) > 0 && a.sub_total === a.sub_published
}

function AssignmentCard({
  a, idx, onSelect, onDeleted, completed,
}: {
  a: AssignmentItem; idx: number
  onSelect: (a: AssignmentItem) => void
  onDeleted: () => void
  completed: boolean
}) {
  const deadline = new Date(a.deadline)
  const now = new Date()
  const isPast = now > deadline
  const hoursLeft = Math.max(0, Math.round((deadline.getTime() - now.getTime()) / 3600000))
  const subTotal = a.sub_total ?? 0
  const subPublished = a.sub_published ?? 0
  const subPending = subTotal - subPublished

  return (
    <div
      onClick={() => onSelect(a)}
      className={`bg-white border rounded-xl px-5 py-4 flex items-center justify-between cursor-pointer hover:shadow-sm transition-all ${
        completed
          ? 'border-emerald-200 hover:border-emerald-300 opacity-75'
          : 'border-slate-200 hover:border-indigo-300'
      }`}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${completed ? 'bg-emerald-50' : 'bg-indigo-50'}`}>
          <span className={`text-sm font-800 ${completed ? 'text-emerald-600' : 'text-indigo-600'}`}>{idx + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-700 text-slate-800 truncate">{a.title}</span>
            {completed ? (
              <span className="text-xs font-600 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                성적 공지 완료
              </span>
            ) : subTotal === 0 ? (
              <span className="text-xs font-600 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                제출 없음
              </span>
            ) : (
              <span className="text-xs font-600 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                검토 대기 {subPending}명
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
            <span>{a.course}</span>
            <span>·</span>
            <Clock size={10} className="inline" />
            <span>
              {isPast
                ? `마감 ${deadline.toLocaleDateString('ko-KR')}`
                : hoursLeft < 24 ? `${hoursLeft}시간 남음` : `D-${Math.ceil(hoursLeft / 24)}`}
            </span>
            {subTotal > 0 && (
              <>
                <span>·</span>
                <span>제출 {subTotal}명</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-4" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => {
            if (confirm(`"${a.title}" 과제를 삭제할까요?\n모든 제출물과 성적도 함께 삭제됩니다.`)) {
              fetch(`/api/assignments/${a.id}`, { method: 'DELETE' })
                .then(r => r.ok && onDeleted())
            }
          }}
          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="과제 삭제"
        >
          <Trash2 size={13} />
        </button>
        <span className={`text-xs font-600 ${completed ? 'text-emerald-600' : 'text-indigo-600'}`}>
          {completed ? '결과 확인 →' : '채점 관리 →'}
        </span>
        <ChevronRight size={14} className="text-slate-300" />
      </div>
    </div>
  )
}

function InstructorAssignmentList({
  assignments,
  onSelect,
  onCreateNew,
  onDeleted,
}: {
  assignments: AssignmentItem[]
  onSelect: (assignment: AssignmentItem) => void
  onCreateNew: () => void
  onDeleted: () => void
}) {
  // 검토 대기: 미완료 과제 (제출 없음 포함)
  const pending = assignments.filter(a => !isCompleted(a))
  // 완료: 전체 공지 처리된 과제
  const completed = assignments.filter(a => isCompleted(a))

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
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
          <button onClick={onCreateNew} className="text-sm text-indigo-600 hover:underline">
            첫 번째 과제 만들기 →
          </button>
        </div>
      ) : (
        <>
          {/* ── 검토 대기 목록 ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-sm font-700 text-slate-700">검토 대기</span>
              <span className="text-xs text-slate-400">— AI 1차 피드백 이후 최종 검토가 필요한 과제</span>
              {pending.length > 0 && (
                <span className="ml-auto text-xs font-700 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  {pending.length}건
                </span>
              )}
            </div>
            {pending.length === 0 ? (
              <div className="flex items-center justify-center h-20 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
                검토 대기 중인 과제가 없습니다
              </div>
            ) : (
              <div className="space-y-2.5">
                {pending.map((a, idx) => (
                  <AssignmentCard
                    key={a.id} a={a} idx={idx}
                    onSelect={onSelect} onDeleted={onDeleted} completed={false}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── 구분선 + 완료 목록 ── */}
          {completed.length > 0 && (
            <section>
              <div className="h-px bg-slate-200 mb-6" />
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-sm font-700 text-slate-700">완료</span>
                <span className="text-xs text-slate-400">— 최종 승인 및 성적 공지 완료</span>
                <span className="ml-auto text-xs font-700 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                  {completed.length}건
                </span>
              </div>
              <div className="space-y-2.5">
                {completed.map((a, idx) => (
                  <AssignmentCard
                    key={a.id} a={a} idx={idx}
                    onSelect={onSelect} onDeleted={onDeleted} completed
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

// 학생 과제 제출 상태 타입
type SubmissionStatus = 'none' | 'waiting' | 'published'

// ── Student Assignment List (제출 현황 포함) ────────────────────────────────
function StudentAssignmentList({
  onSelect,
}: {
  onSelect: (assignment: AssignmentItem, status: SubmissionStatus) => void
}) {
  const [assignments, setAssignments] = useState<AssignmentItem[]>([])
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [aRes, sRes] = await Promise.all([
        fetch('/api/assignments', { cache: 'no-store' }),
        fetch('/api/submissions', { cache: 'no-store' }),
      ])
      const aData = await aRes.json()
      const sData = await sRes.json()
      setAssignments(aData.assignments ?? [])
      setSubmissions(sData.submissions ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">과제 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
        <BookOpen size={36} className="opacity-30" />
        <p className="text-sm">현재 등록된 과제가 없습니다.</p>
        <p className="text-xs">교수님이 과제를 게시하면 여기에 표시됩니다.</p>
      </div>
    )
  }

  // assignment_id → 제출 정보 맵
  const subMap = new Map(submissions.map(s => [s.assignment_id, s]))

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-700 text-slate-800">과제 목록</h2>
          <p className="text-xs text-slate-400">과제를 클릭하면 제출 또는 성적 리포트로 이동합니다</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData}>
          <RefreshCw size={13} /> 새로고침
        </Button>
      </div>

      <div className="space-y-3">
        {assignments.map((a, idx) => {
          const sub = subMap.get(a.id)
          const deadline = new Date(a.deadline)
          const now = new Date()
          const isPast = now > deadline
          const hoursLeft = Math.max(0, Math.round((deadline.getTime() - now.getTime()) / 3600000))

          // 제출 상태 결정
          let submissionStatus: SubmissionStatus
          if (!sub) {
            submissionStatus = 'none'
          } else if (sub.grade_status === 'waiting' || (sub.ai_score === null && sub.confirmed_score === null)) {
            submissionStatus = 'waiting'
          } else {
            submissionStatus = 'published'
          }

          // 상태 배지 결정 ('채점 대기 중' 대신 '제출됨'으로 즉시 반영)
          let statusBadge: React.ReactNode
          let actionLabel: string
          if (submissionStatus === 'none') {
            statusBadge = <Badge variant={isPast ? 'danger' : 'warning'}>미제출</Badge>
            actionLabel = isPast ? '마감됨' : '제출하기 →'
          } else if (submissionStatus === 'waiting') {
            statusBadge = <Badge variant="info">제출됨</Badge>
            actionLabel = '제출 확인 →'
          } else {
            statusBadge = <Badge variant="success">성적 공개됨</Badge>
            actionLabel = '성적 확인 →'
          }

          const clickable = submissionStatus !== 'none' || !isPast

          return (
            <Card key={a.id}>
              <div
                className={`flex items-center justify-between ${clickable ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'opacity-60'}`}
                onClick={() => clickable && onSelect(a, submissionStatus)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-800 text-indigo-600">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-700 text-slate-800 truncate">{a.title}</span>
                      {statusBadge}
                      <Badge variant={isPast ? 'danger' : hoursLeft < 24 ? 'warning' : 'info'}>
                        <Clock size={9} />
                        {isPast ? '마감됨' : hoursLeft < 24 ? `${hoursLeft}시간 남음` : `D-${Math.ceil(hoursLeft / 24)}`}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{a.course}</div>
                  </div>
                </div>
                {clickable && (
                  <span className={`text-xs font-600 ml-3 flex-shrink-0 ${
                    submissionStatus === 'published'
                      ? 'text-emerald-600'
                      : submissionStatus === 'waiting'
                      ? 'text-indigo-600'
                      : 'text-indigo-600'
                  }`}>
                    {actionLabel}
                  </span>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ── Info Bar ─────────────────────────────────────────────────────────────────
function DashboardInfoBar({
  students, courseName, selectedAssignment, view,
}: {
  students: Student[]; courseName: string
  selectedAssignment?: AssignmentItem | null
  view: ViewMode
}) {
  // 교수 모드 전용 통계
  const confirmed = students.filter(s => s.status === 'confirmed')
  const completionPct = students.length ? Math.round(confirmed.length / students.length * 100) : 0
  const avgScore = confirmed.length > 0
    ? Math.round(confirmed.reduce((a, s) => a + (s.confirmedScore ?? s.aiScore), 0) / confirmed.length)
    : 0

  // 학생 모드 전용 통계: 미제출 과제 수, 미읽은 알림 수
  const [studentStats, setStudentStats] = useState({ remaining: 0, unreadNotifs: 0 })

  const fetchStudentStats = useCallback(async () => {
    if (view !== 'student') return
    try {
      const [aRes, sRes, nRes] = await Promise.all([
        fetch('/api/assignments', { cache: 'no-store' }),
        fetch('/api/submissions', { cache: 'no-store' }),
        fetch('/api/notifications', { cache: 'no-store' }),
      ])
      const aData = await aRes.json()
      const sData = await sRes.json()
      const nData = await nRes.json()
      const assignments: AssignmentItem[] = aData.assignments ?? []
      const submissions: SubmissionSummary[] = sData.submissions ?? []
      const submittedIds = new Set(submissions.map(s => s.assignment_id))
      const now = new Date()
      // 마감 전이고 아직 제출하지 않은 과제 수
      const remaining = assignments.filter(
        a => !submittedIds.has(a.id) && new Date(a.deadline) > now
      ).length
      setStudentStats({ remaining, unreadNotifs: nData.unreadCount ?? 0 })
    } catch {}
  }, [view])

  useEffect(() => {
    fetchStudentStats()
    const id = setInterval(fetchStudentStats, 15000)
    return () => clearInterval(id)
  }, [fetchStudentStats])

  // 마감일 포맷 (선택된 과제용)
  const deadlineLabel = selectedAssignment
    ? new Date(selectedAssignment.deadline).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
    : null
  const isDeadlinePast = selectedAssignment ? new Date() > new Date(selectedAssignment.deadline) : false

  // 오른쪽 과제 정보 블록 (교수·학생 공통)
  const AssignmentInfoRight = selectedAssignment ? (
    <>
      <div className="flex items-center gap-1.5">
        <FileText size={13} className="text-indigo-500" />
        <div>
          <div className="text-xs text-slate-400 leading-none mb-0.5">선택된 과제</div>
          <div className="text-sm font-700 text-indigo-700 leading-none max-w-[200px] truncate">
            {selectedAssignment.title}
          </div>
        </div>
      </div>
      <div className="w-px h-7 bg-slate-100" />
      <div className="flex items-center gap-1.5">
        <Calendar size={13} className={isDeadlinePast ? 'text-red-400' : 'text-slate-400'} />
        <div>
          <div className="text-xs text-slate-400 leading-none mb-0.5">마감일</div>
          <div className={`text-sm font-700 leading-none ${isDeadlinePast ? 'text-red-500' : 'text-slate-700'}`}>
            {deadlineLabel}{isDeadlinePast ? ' (마감)' : ''}
          </div>
        </div>
      </div>
      <div className="w-px h-7 bg-slate-100" />
      <div>
        <div className="text-xs text-slate-400 leading-none mb-0.5">과목명</div>
        <div className="text-sm font-700 text-indigo-700 leading-none">{selectedAssignment.course}</div>
      </div>
    </>
  ) : (
    <>
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
    </>
  )

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-2.5">
      <div className="flex items-center justify-between">

        {/* 왼쪽: 교수 모드는 수강생 통계, 학생 모드는 학기·과목 정보 */}
        {view === 'instructor' ? (
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
            </div>
        ) : (
          /* 학생 모드: 남은 과제 수 + 새 알림 수 */
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <ClipboardList size={13} className="text-amber-500" />
              <div>
                <div className="text-xs text-slate-400 leading-none mb-0.5">남은 과제</div>
                <div className={`text-sm font-700 leading-none ${studentStats.remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {studentStats.remaining}개
                </div>
              </div>
            </div>
            <div className="w-px h-7 bg-slate-100" />
            <div className="flex items-center gap-1.5">
              <Bell size={13} className={studentStats.unreadNotifs > 0 ? 'text-red-400' : 'text-slate-400'} />
              <div>
                <div className="text-xs text-slate-400 leading-none mb-0.5">새 공지</div>
                <div className={`text-sm font-700 leading-none ${studentStats.unreadNotifs > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                  {studentStats.unreadNotifs > 0 ? `${studentStats.unreadNotifs}개` : '없음'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 오른쪽: 과제 선택 시 해당 과제 정보, 미선택 시 학기·과목명 (교수·학생 공통) */}
        <div className="flex items-center gap-4">
          {AssignmentInfoRight}
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
  students, user, onLogout, courseName, inquiryUnread,
}: {
  view: ViewMode
  instructorSection: InstructorSection; setInstructorSection: (s: InstructorSection) => void
  studentSection: StudentSection; setStudentSection: (s: StudentSection) => void
  students: Student[]; user: AuthUser; onLogout: () => void; courseName: string
  inquiryUnread: number
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
                badge={
                  item.id === 'grading' && pendingCount > 0 ? String(pendingCount)
                  : item.id === 'inquiries' && inquiryUnread > 0 ? String(inquiryUnread)
                  : undefined
                }
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
function Topbar({
  section, studentView, user,
  onNavigateAssignment, onNavigateInquiry, onOpenChatBot,
}: {
  section: string; studentView?: StudentView; user: AuthUser
  onNavigateAssignment?: (assignmentId: string) => void
  onNavigateInquiry?: (studentUserId: string) => void
  onOpenChatBot?: () => void
}) {
  const titles: Record<string, string> = {
    grading: 'AI 채점 관리', stats: '성적 통계', students: '수강생 관리',
    settings: '시스템 설정', assignments: '과제 목록',
  }
  const subByView: Record<StudentView, string> = {
    list: '과제를 클릭하면 제출하거나 성적 리포트를 확인할 수 있습니다',
    submit: '과제 내용을 입력하고 AI 자동 채점을 받아보세요',
    report: '교수님이 공지한 성적 리포트입니다',
  }
  const subs: Record<string, string> = {
    grading: `${MOCK_ASSIGNMENT.course} · 루브릭 설정 → 학생 제출 → AI 채점 → 교수 확정 후 공지`,
    assignments: studentView ? subByView[studentView] : subByView.list,
  }

  const titleOverride = section === 'assignments' && studentView === 'report'
    ? '성적 리포트'
    : section === 'assignments' && studentView === 'submit'
    ? '과제 제출'
    : undefined

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between">
      <div>
        <h1 className="text-base font-800 text-slate-800 tracking-tight">
          {titleOverride ?? titles[section] ?? section}
        </h1>
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
        <NotificationBell
          onNavigateAssignment={onNavigateAssignment}
          onNavigateInquiry={onNavigateInquiry}
          onOpenChatBot={onOpenChatBot}
        />
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
  const [studentSection, setStudentSection] = useState<StudentSection>('assignments')
  const [students] = useState<Student[]>(MOCK_STUDENTS)

  // 학생 서브뷰 상태
  const [studentView, setStudentView] = useState<StudentView>('list')
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null)
  // 배너 동기화용: 현재 선택된 과제 전체 정보
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentItem | null>(null)
  // 학생이 이미 제출한 과제 재진입 시 제출 완료 상태로 초기화
  const [studentInitialSubmitted, setStudentInitialSubmitted] = useState(false)

  const [currentAssignmentId, setCurrentAssignmentId] = useState<string | undefined>(undefined)
  const [courseName, setCourseName] = useState(MOCK_ASSIGNMENT.course)
  const [allAssignments, setAllAssignments] = useState<AssignmentItem[]>([])
  const [instructorGradingView, setInstructorGradingView] = useState<InstructorGradingView>('list')
  const [inquiryUnread, setInquiryUnread] = useState(0)
  const [inquiryTargetStudent, setInquiryTargetStudent] = useState<string | null>(null)
  const [chatBotOpen, setChatBotOpen] = useState(false)

  useEffect(() => {
    getCurrentUser().then(currentUser => {
      if (!currentUser) { router.replace('/login'); return }
      setUser(currentUser)
      setView(currentUser.role === 'instructor' ? 'instructor' : 'student')
    })
  }, [router])

  const refreshAssignments = useCallback(() => {
    fetch('/api/assignments', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (data.assignments) {
          setAllAssignments(data.assignments)
          if (data.assignments.length > 0) {
            setCourseName(data.assignments[0].course ?? MOCK_ASSIGNMENT.course)
          }
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => { refreshAssignments() }, [refreshAssignments])

  // 교수: 긴급 문의 미확인 수 폴링 (10초)
  useEffect(() => {
    if (view !== 'instructor') return
    const poll = async () => {
      try {
        const res = await fetch('/api/chat/inquiries', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setInquiryUnread(data.totalUnread ?? 0)
        }
      } catch {}
    }
    poll()
    const id = setInterval(poll, 10000)
    return () => clearInterval(id)
  }, [view])

  // 로그아웃: 하드 리다이렉트로 모든 상태 완전 초기화
  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  // 교수 — 새 과제 발행 후 currentAssignmentId가 바뀌면 배너 동기화
  useEffect(() => {
    if (currentAssignmentId && allAssignments.length > 0) {
      const found = allAssignments.find(a => a.id === currentAssignmentId)
      if (found) setSelectedAssignment(found)
    }
  }, [currentAssignmentId, allAssignments])

  const handleAssignmentPublished = (id: string) => {
    setCurrentAssignmentId(id)
    refreshAssignments()
    setInstructorGradingView('detail')
  }

  const handleSetInstructorSection = (s: InstructorSection) => {
    setInstructorSection(s)
    if (s === 'grading') {
      setInstructorGradingView('list')
      setSelectedAssignment(null)
    }
  }

  // 학생 — 과제 목록에서 항목 클릭: 전체 과제 정보로 배너 동기화
  // · waiting → 제출 폼(이미 제출됨 상태로 초기화)으로 이동
  // · published → 성적 리포트로 이동
  // · none → 제출 폼으로 이동
  const handleStudentAssignmentSelect = (assignment: AssignmentItem, status: SubmissionStatus) => {
    setSelectedAssignmentId(assignment.id)
    setSelectedAssignment(assignment)
    if (status === 'published') {
      setStudentInitialSubmitted(false)
      setStudentView('report')
    } else if (status === 'waiting') {
      setStudentInitialSubmitted(true)
      setStudentView('submit')
    } else {
      setStudentInitialSubmitted(false)
      setStudentView('submit')
    }
  }

  // 학생 — 목록으로 돌아가기: 배너 및 제출 상태 초기화
  const handleStudentBackToList = () => {
    setStudentView('list')
    setSelectedAssignmentId(null)
    setSelectedAssignment(null)
    setStudentInitialSubmitted(false)
  }

  // 학생 — 알림 클릭 시 해당 과제 성적 리포트로 이동
  const handleNotificationNavigate = (assignmentId: string) => {
    setStudentSection('assignments')
    setSelectedAssignmentId(assignmentId)
    setStudentInitialSubmitted(false)
    setStudentView('report')
    const found = allAssignments.find(a => a.id === assignmentId)
    if (found) setSelectedAssignment(found)
  }

  // 교수 — 긴급 문의 알림 클릭 시 문의 섹션 + 해당 학생 스레드로 이동
  const handleInquiryNavigate = (studentUserId: string) => {
    handleSetInstructorSection('inquiries')
    setInquiryTargetStudent(studentUserId)
  }

  // 학생 — 사이드바 섹션 전환 시 서브뷰·배너·제출 상태 초기화
  const handleSetStudentSection = (s: StudentSection) => {
    setStudentSection(s)
    setStudentView('list')
    setSelectedAssignmentId(null)
    setSelectedAssignment(null)
    setStudentInitialSubmitted(false)
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
        studentSection={studentSection} setStudentSection={handleSetStudentSection}
        students={students}
        user={user}
        onLogout={handleLogout}
        courseName={courseName}
        inquiryUnread={inquiryUnread}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          section={currentSection}
          studentView={view === 'student' ? studentView : undefined}
          user={user}
          onNavigateAssignment={view === 'student' ? handleNotificationNavigate : undefined}
          onNavigateInquiry={view === 'instructor' ? handleInquiryNavigate : undefined}
          onOpenChatBot={view === 'student' ? () => setChatBotOpen(true) : undefined}
        />
        <DashboardInfoBar students={students} courseName={courseName} selectedAssignment={selectedAssignment} view={view} />
        <main className="flex-1 p-6 overflow-y-auto">

          {/* ── 교수 ── */}
          {view === 'instructor' && instructorSection === 'grading' && instructorGradingView === 'list' && (
            <InstructorAssignmentList
              assignments={allAssignments}
              onSelect={a => {
                setCurrentAssignmentId(a.id)
                setSelectedAssignment(a)
                setInstructorGradingView('detail')
              }}
              onCreateNew={() => {
                setSelectedAssignment(null)
                setInstructorGradingView('create')
              }}
              onDeleted={refreshAssignments}
            />
          )}
          {view === 'instructor' && instructorSection === 'grading' && instructorGradingView === 'create' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <button
                onClick={() => { setSelectedAssignment(null); setInstructorGradingView('list') }}
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
                onClick={() => { setSelectedAssignment(null); setInstructorGradingView('list') }}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
              >
                <ChevronLeft size={15} /> 과제 목록으로
              </button>
              <GradingTable assignmentId={currentAssignmentId} />
              <GradeOptimizer assignmentId={currentAssignmentId} />
            </div>
          )}
          {view === 'instructor' && instructorSection === 'inquiries' && (
            <StudentInquiries
              initialStudentId={inquiryTargetStudent}
              onThreadSelected={() => setInquiryTargetStudent(null)}
            />
          )}
          {view === 'instructor' && instructorSection !== 'grading' && instructorSection !== 'inquiries' && (
            <div className="flex items-center justify-center h-64 text-slate-400">
              <div className="text-center">
                <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">이 섹션은 준비 중입니다</p>
              </div>
            </div>
          )}

          {/* ── 학생 — 과제 목록 (list) ── */}
          {view === 'student' && studentSection === 'assignments' && studentView === 'list' && (
            <StudentAssignmentList onSelect={handleStudentAssignmentSelect} />
          )}

          {/* ── 학생 — 과제 제출 (submit) ── */}
          {view === 'student' && studentSection === 'assignments' && studentView === 'submit' && (
            <AssignmentSubmit
              user={user}
              initialAssignmentId={selectedAssignmentId ?? undefined}
              initialSubmitted={studentInitialSubmitted}
              onBack={handleStudentBackToList}
            />
          )}

          {/* ── 학생 — 성적 리포트 (report) ── */}
          {view === 'student' && studentSection === 'assignments' && studentView === 'report' && (
            <div className="max-w-5xl mx-auto">
              <GradeReport
                user={user}
                assignmentId={selectedAssignmentId ?? undefined}
                onBack={handleStudentBackToList}
              />
            </div>
          )}
        </main>
      </div>
      {view === 'student' && (
        <ChatBot
          user={user}
          forceOpen={chatBotOpen}
          onForceOpenHandled={() => setChatBotOpen(false)}
        />
      )}
    </div>
  )
}
