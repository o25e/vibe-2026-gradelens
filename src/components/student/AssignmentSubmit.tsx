'use client'
import { useState, useEffect, useCallback } from 'react'
import { Upload, FileCheck, X, Sparkles, Clock, CheckCircle2, AlertCircle, File, RefreshCw, ChevronLeft, BookOpen } from 'lucide-react'
import { Card, CardHeader, Badge, Button } from '@/components/ui'
import type { AuthUser } from '@/lib/auth'

interface RubricItem { id: string; text: string; pts: number; category: string }
interface Assignment {
  id: string; title: string; description: string; course: string; deadline: string
  rubric_items: RubricItem[]
  created_at: string
}

const GRADING_MESSAGES = [
  '문서 분석 중...',
  '채점 기준 매칭 중...',
  '항목별 점수 산출 중...',
  '피드백 리포트 생성 중...',
]

export default function AssignmentSubmit({ user }: { user: AuthUser }) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)
  const [loading, setLoading] = useState(true)

  const [content, setContent] = useState('')
  const [file, setFile] = useState<{ name: string; size: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [gradingMsg, setGradingMsg] = useState(0)
  const [submitted, setSubmitted] = useState(false)   // 제출 완료 → 대기 상태
  const [error, setError] = useState<string | null>(null)

  const fetchAssignments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/assignments', { cache: 'no-store' })
      const data = await res.json()
      setAssignments(data.assignments ?? [])
    } catch {
      setError('과제를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAssignments() }, [fetchAssignments])

  const handleFileDrop = (f: File) => {
    setFile({ name: f.name, size: f.size })
    if (f.type === 'text/plain' || f.name.endsWith('.txt')) {
      const reader = new FileReader()
      reader.onload = e => setContent(e.target?.result as string ?? '')
      reader.readAsText(f)
    }
  }

  const handleSelectAssignment = (a: Assignment) => {
    setSelectedAssignment(a)
    setSubmitted(false)
    setContent('')
    setFile(null)
    setError(null)
  }

  const handleBackToList = () => {
    setSelectedAssignment(null)
    setSubmitted(false)
    setContent('')
    setFile(null)
    setError(null)
  }

  const handleSubmit = async () => {
    if (!selectedAssignment) return
    if (!content.trim()) { setError('제출 내용을 입력하세요.'); return }

    setSubmitting(true)
    setError(null)
    const msgInterval = setInterval(() => {
      setGradingMsg(m => (m + 1) % GRADING_MESSAGES.length)
    }, 900)

    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: selectedAssignment.id,
          content: content.trim(),
          file_name: file?.name ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '제출에 실패했습니다.')
      // 성적은 교수 공지 후 공개 → 대기 화면으로 전환
      setSubmitted(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      clearInterval(msgInterval)
      setSubmitting(false)
    }
  }

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

  // ── 과제 목록 ──────────────────────────────────────────────────────────────
  if (!selectedAssignment) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-700 text-slate-800">과제 목록</h2>
            <p className="text-xs text-slate-400">제출할 과제를 선택하세요</p>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchAssignments}>
            <RefreshCw size={13} /> 새로고침
          </Button>
        </div>

        {assignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
            <BookOpen size={36} className="opacity-30" />
            <p className="text-sm">현재 등록된 과제가 없습니다.</p>
            <p className="text-xs">교수님이 과제를 게시하면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((a, idx) => {
              const deadline = new Date(a.deadline)
              const now = new Date()
              const isPast = now > deadline
              const hoursLeft = Math.max(0, Math.round((deadline.getTime() - now.getTime()) / 3600000))
              const totalPts = a.rubric_items.reduce((s, r) => s + r.pts, 0)
              return (
                <Card key={a.id}>
                  <div
                    className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => !isPast && handleSelectAssignment(a)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-800 text-indigo-600">{idx + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-700 text-slate-800 truncate">{a.title}</span>
                          <Badge variant={isPast ? 'danger' : hoursLeft < 24 ? 'warning' : 'success'}>
                            <Clock size={9} />
                            {isPast ? '마감됨' : hoursLeft < 24 ? `${hoursLeft}시간 남음` : `D-${Math.ceil(hoursLeft / 24)}`}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {a.course} · {totalPts}점 만점 · 루브릭 {a.rubric_items.length}개
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={isPast ? 'ghost' : 'outline'}
                      className="ml-3 flex-shrink-0"
                      disabled={isPast}
                      onClick={e => { e.stopPropagation(); handleSelectAssignment(a) }}
                    >
                      {isPast ? '마감됨' : '제출하기 →'}
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── 제출 폼 ────────────────────────────────────────────────────────────────
  const deadline = new Date(selectedAssignment.deadline)
  const now = new Date()
  const isPast = now > deadline
  const hoursLeft = Math.max(0, Math.round((deadline.getTime() - now.getTime()) / 3600000))
  const totalPts = selectedAssignment.rubric_items.reduce((a, r) => a + r.pts, 0)

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <button
        onClick={handleBackToList}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
      >
        <ChevronLeft size={15} /> 과제 목록으로
      </button>

      {/* 과제 정보 */}
      <Card>
        <CardHeader
          title={selectedAssignment.title}
          subtitle={selectedAssignment.course}
          actions={
            <Badge variant={isPast ? 'danger' : hoursLeft < 24 ? 'warning' : 'success'}>
              <Clock size={10} />
              {isPast ? '마감됨' : hoursLeft < 24 ? `${hoursLeft}시간 남음` : `D-${Math.ceil(hoursLeft / 24)}`}
            </Badge>
          }
        />
        <div className="bg-slate-50 border border-slate-100 rounded-lg px-4 py-3 text-sm text-slate-600 leading-relaxed mb-4">
          {selectedAssignment.description}
        </div>
        <div>
          <div className="text-xs font-700 text-slate-500 mb-2">
            <Sparkles size={11} className="inline mr-1 text-indigo-500" />
            AI 채점 기준 ({totalPts}점 만점)
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {selectedAssignment.rubric_items.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-1.5">
                <span className="text-xs text-indigo-700 font-500 truncate">{r.text}</span>
                <span className="text-xs font-800 text-indigo-600 ml-2 flex-shrink-0">{r.pts}점</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* 제출 완료 → 대기 중 */}
      {submitted && (
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={22} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-700 text-amber-800">제출이 완료되었습니다!</div>
              <div className="text-xs text-amber-600 mt-0.5">교수님이 AI 채점을 검토 후 성적을 공지하면 알림이 전송됩니다.</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-white/70 border border-amber-100 rounded-xl text-xs text-amber-700">
            <RefreshCw size={12} className="animate-spin flex-shrink-0" style={{ animationDuration: '3s' }} />
            성적 공지 전까지 점수가 공개되지 않습니다. 알림을 통해 안내드립니다.
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSubmitted(false)}>재제출하기</Button>
            <Button variant="ghost" size="sm" onClick={handleBackToList}>
              <ChevronLeft size={13} /> 과제 목록으로
            </Button>
          </div>
        </Card>
      )}

      {/* 제출 폼 */}
      {!submitted && (
        <Card>
          <CardHeader
            title="과제 제출"
            subtitle={`${user.name} 님의 제출 · AI가 즉시 채점합니다`}
            actions={
              <span className="inline-flex items-center gap-1 bg-indigo-600 text-white text-xs font-700 px-2.5 py-1 rounded-full">
                <Sparkles size={10} /> AI 자동 채점
              </span>
            }
          />

          {error && (
            <div className="mb-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
              <AlertCircle size={13} />{error}
              <button className="ml-auto" onClick={() => setError(null)}><X size={13} /></button>
            </div>
          )}

          <div className="mb-3">
            <label className="block text-xs font-600 text-slate-500 mb-1.5">
              과제 내용 <span className="text-red-500">*</span>
              <span className="text-slate-400 font-400 ml-1">(직접 입력하거나 붙여넣기)</span>
            </label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={10}
              disabled={submitting}
              placeholder="과제 내용을 여기에 붙여넣으세요. AI가 채점 기준에 따라 자동 평가합니다."
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-slate-700 leading-relaxed resize-none disabled:opacity-60"
            />
            <div className="flex justify-between mt-1 text-xs text-slate-400">
              <span>{content.trim().split(/\s+/).filter(Boolean).length}자 입력됨</span>
              <span>최소 500자 권장</span>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-600 text-slate-500 mb-1.5">
              파일 첨부 <span className="text-slate-400 font-400">(선택 · .txt 파일은 내용 자동 입력)</span>
            </label>
            {file ? (
              <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <File size={14} className="text-indigo-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-600 text-slate-700 truncate">{file.name}</div>
                  <div className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
                {!submitting && (
                  <button onClick={() => setFile(null)} className="text-slate-400 hover:text-red-500 transition-colors">
                    <X size={13} />
                  </button>
                )}
              </div>
            ) : (
              <label
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileDrop(f) }}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                className={`flex items-center gap-3 px-3 py-2.5 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                  dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                }`}
              >
                <input type="file" accept=".pdf,.doc,.docx,.hwp,.txt" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileDrop(f) }} />
                <Upload size={16} className="text-slate-300" />
                <div>
                  <div className="text-xs font-600 text-slate-500">파일 드래그 또는 클릭</div>
                  <div className="text-xs text-slate-400">PDF · DOC · HWP · TXT</div>
                </div>
              </label>
            )}
          </div>

          {submitting ? (
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <div>
                  <div className="text-sm font-700 text-indigo-700">AI 채점 진행 중...</div>
                  <div className="text-xs text-indigo-500">{GRADING_MESSAGES[gradingMsg]}</div>
                </div>
                <span className="inline-flex items-center gap-1 ml-auto bg-indigo-600 text-white text-xs font-700 px-2.5 py-1 rounded-full">
                  <Sparkles size={10} /> AI 분석
                </span>
              </div>
              <div className="h-1.5 bg-indigo-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full animate-pulse" style={{ width: '70%' }} />
              </div>
            </div>
          ) : (
            <Button
              onClick={handleSubmit}
              className="w-full justify-center"
              disabled={!content.trim() || isPast}
            >
              <Sparkles size={14} />
              {isPast ? '마감된 과제입니다' : 'AI 채점 제출하기'}
            </Button>
          )}

          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <FileCheck size={12} />
            제출 후 교수님 검토를 거쳐 성적이 공개됩니다. 공개 시 알림이 전송됩니다.
          </div>
        </Card>
      )}
    </div>
  )
}
