'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Bot, Sparkles, PhoneCall, AlertCircle, CheckCircle2, GraduationCap } from 'lucide-react'
import type { ChatMessage } from '@/lib/mockData'

const QUICK_QUESTIONS = [
  '논리력 점수 이유가 궁금해요',
  '자료활용도를 높이려면?',
  '전체 피드백 요약해줘',
  '형식 점수 기준은?',
]

function now() {
  return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

// ── 긴급 문의 확인 패널 ──────────────────────────────────────────────────────
function InquiryPanel({
  onConfirm, onCancel, loading,
}: {
  onConfirm: (msg: string) => void
  onCancel: () => void
  loading: boolean
}) {
  const [msg, setMsg] = useState('')
  return (
    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center px-5 gap-4">
      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
        <PhoneCall size={22} className="text-red-500" />
      </div>
      <div className="text-center">
        <p className="text-sm font-700 text-slate-800">교수님께 직접 문의</p>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          교수님의 알림창에 문의 메시지가 전송됩니다.
        </p>
      </div>
      <textarea
        value={msg}
        onChange={e => setMsg(e.target.value)}
        placeholder="문의 내용을 간단히 입력하세요. (선택사항)"
        rows={3}
        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
      />
      <div className="flex gap-2 w-full">
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex-1 py-2 text-xs rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40"
        >
          취소
        </button>
        <button
          onClick={() => onConfirm(msg)}
          disabled={loading}
          className="flex-1 py-2 text-xs rounded-xl bg-red-500 text-white font-600 hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
        >
          {loading ? (
            <>
              <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              전송 중...
            </>
          ) : (
            <>
              <PhoneCall size={12} />
              문의 전송
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ── 메시지 버블 ───────────────────────────────────────────────────────────────
function MessageBubble({ m }: { m: ChatMessage }) {
  if (m.role === 'professor') {
    return (
      <div className="flex justify-start gap-1.5">
        <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
          <GraduationCap size={11} className="text-amber-600" />
        </div>
        <div className="max-w-[80%]">
          <div className="text-[10px] text-amber-600 font-700 mb-0.5 px-1">교수님 답변</div>
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-3 py-2 text-xs leading-relaxed">
            <p style={{ whiteSpace: 'pre-line' }}>{m.text}</p>
            <div className="text-amber-400 text-xs mt-1">{m.timestamp}</div>
          </div>
        </div>
      </div>
    )
  }

  if (m.role === 'bot') {
    return (
      <div className="flex justify-start">
        <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center mr-1.5 flex-shrink-0 mt-1">
          <Sparkles size={11} className="text-indigo-600" />
        </div>
        <div className="max-w-[80%] bg-slate-100 text-slate-700 rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-3 py-2 text-xs leading-relaxed">
          <p style={{ whiteSpace: 'pre-line' }}>{m.text}</p>
          <div className="text-slate-400 text-xs mt-1">{m.timestamp}</div>
        </div>
      </div>
    )
  }

  // user
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] bg-indigo-600 text-white rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl px-3 py-2 text-xs leading-relaxed">
        <p style={{ whiteSpace: 'pre-line' }}>{m.text}</p>
        <div className="text-indigo-200 text-xs mt-1">{m.timestamp}</div>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function ChatBot({
  user,
  forceOpen,
  onForceOpenHandled,
}: {
  user: { name: string }
  forceOpen?: boolean
  onForceOpenHandled?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      role: 'bot',
      text: `안녕하세요 ${user.name} 님! 저는 AI 채점 어시스턴트입니다.\n\n점수나 피드백에 대해 궁금한 점이 있으시면 편하게 질문해 주세요. 채점 기준에 근거하여 자세히 설명드리겠습니다.`,
      timestamp: now(),
    },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [showInquiry, setShowInquiry] = useState(false)
  const [inquiryLoading, setInquiryLoading] = useState(false)
  const [inquirySent, setInquirySent] = useState(false)
  // 교수 답변 알림 미확인 수 (FAB 배지)
  const [profUnread, setProfUnread] = useState(0)
  // 이미 챗봇에 삽입한 알림 id 집합 (중복 방지)
  const shownNotifIds = useRef<Set<string>>(new Set())
  const bottomRef = useRef<HTMLDivElement>(null)

  // 외부(알림 클릭)에서 챗봇 열기 요청 시 처리
  useEffect(() => {
    if (forceOpen) {
      setOpen(true)
      setProfUnread(0)
      onForceOpenHandled?.()
    }
  }, [forceOpen, onForceOpenHandled])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing, showInquiry])

  // ── 교수 답변 폴링 ────────────────────────────────────────────────────────
  const pollProfReplies = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      const notifs: {
        id: string; type: string; title: string; body: string; is_read: number; created_at: string
      }[] = data.notifications ?? []

      const replies = notifs.filter(n => n.type === 'professor_reply')
      const newReplies = replies.filter(n => !shownNotifIds.current.has(n.id))

      if (newReplies.length > 0) {
        const profMsgs: ChatMessage[] = newReplies.map(n => ({
          role: 'professor' as const,
          text: n.body,
          timestamp: new Date(n.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          notifId: n.id,
        }))
        setMessages(prev => [...prev, ...profMsgs])
        newReplies.forEach(n => shownNotifIds.current.add(n.id))
        // 챗봇이 닫혀 있으면 배지 카운트 증가
        setProfUnread(prev => prev + newReplies.length)
      }
    } catch {}
  }, [])

  useEffect(() => {
    pollProfReplies()
    const id = setInterval(pollProfReplies, 10000)
    return () => clearInterval(id)
  }, [pollProfReplies])

  // 챗봇 열릴 때 배지 초기화
  const handleOpen = () => {
    setOpen(o => !o)
    setProfUnread(0)
  }

  // ── AI 채팅 전송 ──────────────────────────────────────────────────────────
  const send = async (text: string = input) => {
    if (!text.trim() || typing) return
    const userMsg: ChatMessage = { role: 'user', text: text.trim(), timestamp: now() }
    const currentHistory = [...messages]
    setMessages(m => [...m, userMsg])
    setInput('')
    setTyping(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), history: currentHistory }),
      })
      const data = await res.json()
      setMessages(m => [...m, {
        role: 'bot',
        text: data.reply ?? '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 질문해 주세요.',
        timestamp: now(),
      }])
    } catch {
      setMessages(m => [...m, {
        role: 'bot',
        text: '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
        timestamp: now(),
      }])
    } finally {
      setTyping(false)
    }
  }

  // ── 교수 긴급 문의 전송 ───────────────────────────────────────────────────
  const handleInquiry = async (msg: string) => {
    setInquiryLoading(true)
    try {
      await fetch('/api/chat/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg || '성적 관련 긴급 문의가 있습니다. 확인 부탁드립니다.' }),
      })
      setInquirySent(true)
      setShowInquiry(false)
      setMessages(m => [...m, {
        role: 'bot',
        text: '✅ 교수님께 문의 알림이 전송되었습니다.\n\n교수님의 알림창에 문의 내용이 표시됩니다. 답변이 도착하면 이 채팅창에 표시됩니다!',
        timestamp: now(),
      }])
    } catch {
      setShowInquiry(false)
      setMessages(m => [...m, {
        role: 'bot',
        text: '문의 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
        timestamp: now(),
      }])
    } finally {
      setInquiryLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Window */}
      {open && (
        <div
          className="absolute bottom-16 right-0 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ height: 520 }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="text-white text-sm font-700">AI 성적 문의 봇</div>
              <div className="text-indigo-200 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block" />
                {user.name} 님 · AI 기반 1:1 상담
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 relative">
            {messages.map((m, i) => (
              <MessageBubble key={m.notifId ?? i} m={m} />
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center mr-1.5 flex-shrink-0">
                  <Sparkles size={11} className="text-indigo-600" />
                </div>
                <div className="bg-slate-100 rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-3 py-2">
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />

            {showInquiry && (
              <InquiryPanel
                onConfirm={handleInquiry}
                onCancel={() => setShowInquiry(false)}
                loading={inquiryLoading}
              />
            )}
          </div>

          {/* Quick Questions */}
          <div className="px-3 pb-2 flex-shrink-0">
            <div className="flex flex-wrap gap-1 mb-2">
              {QUICK_QUESTIONS.map((q, i) => (
                <button key={i} onClick={() => send(q)} disabled={typing}
                  className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full px-2.5 py-1 hover:bg-indigo-100 transition-colors font-500 disabled:opacity-40">
                  {q}
                </button>
              ))}
            </div>

            {/* 교수님께 바로 연락하기 */}
            <button
              onClick={() => setShowInquiry(true)}
              disabled={inquirySent || showInquiry}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-700 transition-all ${
                inquirySent
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default'
                  : 'bg-red-500 text-white hover:bg-red-600 active:scale-95 shadow-md shadow-red-200'
              }`}
            >
              {inquirySent ? (
                <><CheckCircle2 size={13} />문의가 전송되었습니다</>
              ) : (
                <><AlertCircle size={13} />교수님께 바로 연락하기</>
              )}
            </button>
          </div>

          {/* Input */}
          <div className="px-3 pb-3 flex gap-2 flex-shrink-0">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="질문을 입력하세요..."
              disabled={typing}
              className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 disabled:opacity-60"
            />
            <button onClick={() => send()} disabled={!input.trim() || typing}
              className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
              <Send size={13} className="text-white" />
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={handleOpen}
        className="w-13 h-13 bg-indigo-600 rounded-full shadow-xl flex items-center justify-center hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95"
        style={{ width: 52, height: 52 }}
      >
        {open ? <X size={22} className="text-white" /> : <MessageCircle size={22} className="text-white" />}
      </button>

      {/* 배지: 교수 답변 미확인 or AI 표시 */}
      {!open && (
        <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${
          profUnread > 0 ? 'bg-amber-500' : 'bg-red-500'
        }`}>
          <span className="text-white text-xs font-700">
            {profUnread > 0 ? profUnread : 'AI'}
          </span>
        </div>
      )}
    </div>
  )
}
