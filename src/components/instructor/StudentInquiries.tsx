'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquare, Send, User, GraduationCap, RefreshCw, Inbox } from 'lucide-react'

interface Message {
  id: string
  sender: 'student' | 'professor'
  body: string
  created_at: string
}

interface StudentThread {
  studentUserId: string
  studentName: string
  studentNo: string
  unreadCount: number
  lastAt: string
  messages: Message[]
}

function formatTime(iso: string) {
  const d = new Date(iso.replace(' ', 'T') + (iso.includes('T') ? '' : 'Z'))
  return d.toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── 개별 메시지 버블 ───────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isProf = msg.sender === 'professor'
  return (
    <div className={`flex ${isProf ? 'justify-end' : 'justify-start'} gap-2`}>
      {!isProf && (
        <div className="w-7 h-7 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <User size={13} className="text-orange-500" />
        </div>
      )}
      <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
        isProf
          ? 'bg-indigo-600 text-white rounded-tr-sm'
          : 'bg-slate-100 text-slate-700 rounded-tl-sm'
      }`}>
        <p style={{ whiteSpace: 'pre-line' }}>{msg.body}</p>
        <p className={`text-xs mt-1 ${isProf ? 'text-indigo-200' : 'text-slate-400'}`}>
          {isProf ? '교수님' : '학생'} · {formatTime(msg.created_at)}
        </p>
      </div>
      {isProf && (
        <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <GraduationCap size={13} className="text-indigo-600" />
        </div>
      )}
    </div>
  )
}

// ── 학생 목록 아이템 ──────────────────────────────────────────────────────────
function StudentItem({
  thread, active, onClick,
}: {
  thread: StudentThread
  active: boolean
  onClick: () => void
}) {
  const lastMsg = thread.messages[thread.messages.length - 1]
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-slate-100 transition-all ${
        active
          ? 'bg-indigo-50 border-l-2 border-l-indigo-500'
          : 'hover:bg-slate-50 border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
          thread.unreadCount > 0 ? 'bg-red-100' : 'bg-slate-100'
        }`}>
          <User size={16} className={thread.unreadCount > 0 ? 'text-red-500' : 'text-slate-400'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm font-700 truncate ${active ? 'text-indigo-700' : 'text-slate-800'}`}>
              {thread.studentName}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {thread.unreadCount > 0 && (
                <span className="w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-700">
                  {thread.unreadCount}
                </span>
              )}
              <span className="text-xs text-slate-300">{formatTime(thread.lastAt)}</span>
            </div>
          </div>
          {thread.studentNo && (
            <p className="text-xs text-slate-400">{thread.studentNo}</p>
          )}
          {lastMsg && (
            <p className="text-xs text-slate-400 truncate mt-0.5">
              {lastMsg.sender === 'professor' ? '나: ' : ''}{lastMsg.body}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function StudentInquiries({
  initialStudentId,
  onThreadSelected,
}: {
  initialStudentId?: string | null
  onThreadSelected?: () => void
}) {
  const [threads, setThreads] = useState<StudentThread[]>([])
  const [selected, setSelected] = useState<StudentThread | null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/inquiries', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      const fetched: StudentThread[] = data.threads ?? []
      setThreads(fetched)
      // 선택된 스레드 동기화
      if (selected) {
        const updated = fetched.find(t => t.studentUserId === selected.studentUserId)
        if (updated) setSelected(updated)
      }
    } finally {
      setLoading(false)
    }
  }, [selected])

  // 알림 클릭으로 특정 학생 지정 시 자동 선택
  useEffect(() => {
    if (!initialStudentId || threads.length === 0) return
    const target = threads.find(t => t.studentUserId === initialStudentId)
    if (target) {
      setSelected(target)
      setReply('')
      onThreadSelected?.()
    }
  }, [initialStudentId, threads, onThreadSelected])

  useEffect(() => {
    fetchThreads()
    const id = setInterval(fetchThreads, 10000)
    return () => clearInterval(id)
  }, [fetchThreads])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selected?.messages.length])

  const handleSelectThread = (thread: StudentThread) => {
    setSelected(thread)
    setReply('')
  }

  const handleSend = async () => {
    if (!reply.trim() || !selected || sending) return
    setSending(true)
    const inquiryIds = selected.messages
      .filter(m => m.sender === 'student')
      .map(m => m.id)
    try {
      const res = await fetch('/api/chat/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentUserId: selected.studentUserId,
          message: reply.trim(),
          inquiryIds,
        }),
      })
      if (res.ok) {
        setReply('')
        await fetchThreads()
      }
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <RefreshCw size={20} className="animate-spin mr-2" />
        <span className="text-sm">불러오는 중...</span>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-700 text-slate-800">학생 긴급 문의</h2>
          <p className="text-xs text-slate-400">
            학생이 챗봇에서 전송한 긴급 문의 목록입니다. 클릭하여 답변을 보내세요.
          </p>
        </div>
        <button
          onClick={fetchThreads}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={12} /> 새로고침
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex" style={{ height: 580 }}>

        {/* ── 왼쪽: 학생 목록 ── */}
        <div className="w-72 border-r border-slate-100 flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-slate-400" />
              <span className="text-xs font-700 text-slate-600">문의 학생</span>
              {threads.some(t => t.unreadCount > 0) && (
                <span className="ml-auto text-xs font-700 bg-red-500 text-white px-2 py-0.5 rounded-full">
                  미확인 {threads.reduce((s, t) => s + t.unreadCount, 0)}
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
                <Inbox size={32} />
                <p className="text-xs">아직 문의가 없습니다</p>
              </div>
            ) : (
              threads.map(t => (
                <StudentItem
                  key={t.studentUserId}
                  thread={t}
                  active={selected?.studentUserId === t.studentUserId}
                  onClick={() => handleSelectThread(t)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── 오른쪽: 대화창 ── */}
        {selected ? (
          <div className="flex-1 flex flex-col min-w-0">
            {/* 헤더 */}
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <User size={15} className="text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-700 text-slate-800">{selected.studentName} 학생</p>
                {selected.studentNo && (
                  <p className="text-xs text-slate-400">학번 {selected.studentNo}</p>
                )}
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                {selected.unreadCount > 0 && (
                  <span className="text-xs bg-red-100 text-red-600 font-700 px-2.5 py-1 rounded-full">
                    미확인 {selected.unreadCount}건
                  </span>
                )}
              </div>
            </div>

            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {selected.messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              <div ref={bottomRef} />
            </div>

            {/* 답변 입력 */}
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
              <div className="flex gap-3 items-end">
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
                  }}
                  placeholder="답변을 입력하세요... (Enter로 전송, Shift+Enter 줄바꿈)"
                  rows={3}
                  className="flex-1 text-sm px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none bg-white"
                />
                <button
                  onClick={handleSend}
                  disabled={!reply.trim() || sending}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-700 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {sending ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  전송
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                답변이 전송되면 학생의 챗봇에 교수님 메시지로 표시됩니다.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-3">
            <MessageSquare size={40} />
            <p className="text-sm">왼쪽에서 학생을 선택하면 문의 내용과 답변 창이 열립니다</p>
          </div>
        )}
      </div>
    </div>
  )
}
