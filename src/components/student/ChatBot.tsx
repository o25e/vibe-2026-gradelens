'use client'
import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Bot, Sparkles } from 'lucide-react'
import { BOT_RESPONSES } from '@/lib/mockData'
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

function getBotResponse(input: string): string {
  const lower = input.toLowerCase()
  if (lower.includes('자료') || lower.includes('인용')) return BOT_RESPONSES.자료
  if (lower.includes('창의') || lower.includes('독창')) return BOT_RESPONSES.창의
  if (lower.includes('형식') || lower.includes('분량')) return BOT_RESPONSES.형식
  if (lower.includes('피드백') || lower.includes('요약')) return BOT_RESPONSES.피드백
  return BOT_RESPONSES.default
}

export default function ChatBot({ user }: { user: { name: string } }) {
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
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const send = (text: string = input) => {
    if (!text.trim()) return
    const userMsg: ChatMessage = { role: 'user', text: text.trim(), timestamp: now() }
    setMessages(m => [...m, userMsg])
    setInput('')
    setTyping(true)
    setTimeout(() => {
      const botReply: ChatMessage = { role: 'bot', text: getBotResponse(text), timestamp: now() }
      setMessages(m => [...m, botReply])
      setTyping(false)
    }, 900 + Math.random() * 600)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Window */}
      {open && (
        <div className="absolute bottom-16 right-0 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ height: 480 }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="text-white text-sm font-700">AI 성적 문의 봇</div>
              <div className="text-indigo-200 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block" />
                {user.name} 님 · 채점 기준 기반 1:1 상담
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'bot' && (
                  <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center mr-1.5 flex-shrink-0 mt-1">
                    <Sparkles size={11} className="text-indigo-600" />
                  </div>
                )}
                <div className={`max-w-[80%] ${m.role === 'bot'
                  ? 'bg-slate-100 text-slate-700 rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl'
                  : 'bg-indigo-600 text-white rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl'
                } px-3 py-2 text-xs leading-relaxed`}>
                  <p style={{ whiteSpace: 'pre-line' }}>{m.text}</p>
                  <div className={`text-xs mt-1 ${m.role === 'bot' ? 'text-slate-400' : 'text-indigo-200'}`}>
                    {m.timestamp}
                  </div>
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center mr-1.5 flex-shrink-0">
                  <Sparkles size={11} className="text-indigo-600" />
                </div>
                <div className="bg-slate-100 rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-3 py-2">
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick Questions */}
          <div className="px-3 pb-2">
            <div className="flex flex-wrap gap-1">
              {QUICK_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => send(q)}
                  className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full px-2.5 py-1 hover:bg-indigo-100 transition-colors font-500"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="px-3 pb-3 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="질문을 입력하세요..."
              className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim()}
              className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Send size={13} className="text-white" />
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-13 h-13 bg-indigo-600 rounded-full shadow-xl flex items-center justify-center hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95"
        style={{ width: 52, height: 52 }}
      >
        {open
          ? <X size={22} className="text-white" />
          : <MessageCircle size={22} className="text-white" />
        }
      </button>

      {!open && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-700">3</span>
        </div>
      )}
    </div>
  )
}
