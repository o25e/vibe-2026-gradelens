'use client'
import { useState, useCallback, useRef } from 'react'
import {
  Sparkles, Upload, File, X, Plus, Trash2,
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, RefreshCw,
  FileText, Loader2,
} from 'lucide-react'
import { Button, Card, CardHeader, Badge } from '@/components/ui'
import type { AIRubricItem } from '@/app/api/rubric-generate/route'

export type { AIRubricItem }

interface Props {
  assignmentTitle?: string
  onApply: (rubrics: AIRubricItem[], totalScore: number) => void
}

// ── Skeleton Row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-slate-100">
      <td className="px-3 py-3"><div className="w-5 h-4 bg-slate-200 rounded" /></td>
      <td className="px-3 py-3"><div className="h-4 bg-slate-200 rounded w-3/4" /></td>
      <td className="px-3 py-3"><div className="h-4 bg-slate-200 rounded w-full" /></td>
      <td className="px-3 py-3"><div className="w-10 h-4 bg-slate-200 rounded mx-auto" /></td>
      <td className="px-3 py-3"><div className="w-6 h-6 bg-slate-200 rounded mx-auto" /></td>
    </tr>
  )
}

// ── Score Indicator ───────────────────────────────────────────────────────────
function ScoreIndicator({ current, total }: { current: number; total: number }) {
  const diff = current - total
  const isExact = diff === 0
  const isOver = diff > 0
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-600 transition-colors ${
      isExact ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : isOver ? 'bg-red-50 border-red-200 text-red-700'
      : 'bg-amber-50 border-amber-200 text-amber-700'
    }`}>
      {isExact ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
      <span>현재 합계 <strong>{current}점</strong> / 목표 <strong>{total}점</strong></span>
      {!isExact && (
        <span className="ml-1 opacity-70">
          ({isOver ? `+${diff}점 초과` : `${Math.abs(diff)}점 부족`})
        </span>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function SmartRubricGenerator({ assignmentTitle, onApply }: Props) {
  // Input
  const [extractedText, setExtractedText] = useState('')  // 파일에서 추출된 텍스트
  const [directInput, setDirectInput] = useState('')      // 교수 직접 입력
  const [totalScore, setTotalScore] = useState<number>(10)
  const [textareaExpanded, setTextareaExpanded] = useState(false)

  // AI에 실제로 전달되는 텍스트 = 파일 추출본 + 직접 입력 합산
  const combinedText = [extractedText.trim(), directInput.trim()].filter(Boolean).join('\n\n')

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [parseLoading, setParseLoading] = useState(false)  // 파일 → 텍스트 추출 중
  const [parseError, setParseError] = useState<string | null>(null)

  // AI generation state
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [hasResult, setHasResult] = useState(false)

  // Editable rubrics
  const [editRubrics, setEditRubrics] = useState<AIRubricItem[]>([])
  const nextId = useRef(100)

  const currentSum = editRubrics.reduce((a, r) => a + r.score, 0)

  // ── File → Server 텍스트 추출 ──────────────────────────────────────────────
  const handleFile = useCallback(async (f: File) => {
    setUploadedFile({ name: f.name, size: f.size })
    setParseError(null)
    setParseLoading(true)
    setExtractedText('')

    try {
      const formData = new FormData()
      formData.append('file', f)

      const res = await fetch('/api/parse-file', {
        method: 'POST',
        body: formData,   // Content-Type은 FormData가 자동으로 multipart/form-data로 설정
      })

      const data = await res.json()

      if (!res.ok) {
        setParseError(data.error ?? '파일 파싱에 실패했습니다.')
        return
      }

      setExtractedText(data.text as string)
      setTextareaExpanded(true)   // 추출된 텍스트 자동으로 펼쳐서 보여줌
    } catch {
      setParseError('파일 전송 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setParseLoading(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const removeFile = () => {
    setUploadedFile(null)
    setExtractedText('')
    setParseError(null)
    setHasResult(false)
  }

  // ── AI 루브릭 생성 ─────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!combinedText) {
      setAiError('과제 가이드라인을 파일로 업로드하거나 아래 입력란에 직접 작성해주세요.')
      return
    }
    if (!totalScore || totalScore < 1) {
      setAiError('총점을 입력해주세요.')
      return
    }

    setAiLoading(true)
    setAiError(null)
    setHasResult(false)

    try {
      const res = await fetch('/api/rubric-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extractedText: combinedText,
          totalScore,
          assignmentTitle: assignmentTitle ?? '',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI 분석에 실패했습니다.')

      const rubrics = data.rubrics as AIRubricItem[]
      setEditRubrics(rubrics)
      nextId.current = Math.max(...rubrics.map(r => r.id)) + 1
      setHasResult(true)
    } catch (e) {
      setAiError((e as Error).message)
    } finally {
      setAiLoading(false)
    }
  }

  // ── Rubric editing ─────────────────────────────────────────────────────────
  const updateRubric = (id: number, field: keyof AIRubricItem, value: string | number) => {
    setEditRubrics(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }
  const deleteRubric = (id: number) => setEditRubrics(prev => prev.filter(r => r.id !== id))
  const addRubric = () => {
    const newId = nextId.current++
    setEditRubrics(prev => [...prev, { id: newId, criteria: '', description: '', score: 0 }])
  }
  const handleApply = () => onApply(editRubrics, totalScore)

  // ── 파일 확장자 아이콘 색 ──────────────────────────────────────────────────
  const extColor: Record<string, string> = {
    pdf: 'text-red-500', docx: 'text-blue-500', doc: 'text-blue-500',
    txt: 'text-slate-500', hwp: 'text-teal-600',
  }
  const fileExt = uploadedFile?.name.split('.').pop()?.toLowerCase() ?? ''

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader
        title="AI 스마트 채점 기준(Rubric) 생성"
        subtitle="강의계획서·과제 가이드라인을 분석해 구체적인 채점 항목을 자동 설계합니다"
        actions={
          <span className="inline-flex items-center gap-1 bg-indigo-600 text-white text-xs font-700 px-2.5 py-1 rounded-full">
            <Sparkles size={10} /> AI 생성
          </span>
        }
      />

      {/* ── 총점 + 생성 버튼 ── */}
      <div className="flex gap-3 items-end mb-4">
        <div>
          <label className="block text-xs font-600 text-slate-500 mb-1.5">
            총점 설정
            <span className="ml-1 font-400 text-slate-400">— AI가 이 점수에 맞게 배점 합계를 자동으로 맞춥니다</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number" min={1} max={1000} value={totalScore}
              onChange={e => setTotalScore(parseInt(e.target.value) || 0)}
              className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 text-center font-600"
            />
            <span className="text-sm text-slate-500">점</span>
          </div>
        </div>
        <Button
          variant="primary"
          onClick={handleGenerate}
          disabled={aiLoading || parseLoading || !combinedText}
        >
          {aiLoading
            ? <><Loader2 size={13} className="animate-spin" /> AI 분석 중...</>
            : <><Sparkles size={13} /> 루브릭 자동 생성</>
          }
        </Button>
      </div>

      {/* ── 파일 업로드 ── */}
      <div className="mb-3">
        <label className="block text-xs font-600 text-slate-500 mb-1.5">
          <Upload size={11} className="inline mr-1 text-slate-400" />
          파일 업로드&nbsp;
          <span className="font-400 text-slate-400">PDF · DOCX · TXT · HWP</span>
        </label>

        {/* 파일 없음 — 드롭존 */}
        {!uploadedFile && (
          <label
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            className={`flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-150 ${
              dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
            }`}
          >
            <input
              type="file" accept=".pdf,.doc,.docx,.txt,.hwp" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <File size={20} className={dragOver ? 'text-indigo-400' : 'text-slate-300'} />
            <div>
              <div className="text-xs font-600 text-slate-600">파일을 드래그하거나 클릭하여 업로드</div>
              <div className="text-xs text-slate-400 mt-0.5">서버에서 텍스트를 자동 추출합니다 · 최대 10 MB</div>
            </div>
          </label>
        )}

        {/* 파일 선택됨 — 상태 표시 */}
        {uploadedFile && (
          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
            parseLoading ? 'bg-indigo-50 border-indigo-200'
            : parseError ? 'bg-red-50 border-red-200'
            : 'bg-emerald-50 border-emerald-200'
          }`}>
            {/* 파일 아이콘 */}
            <FileText size={16} className={`flex-shrink-0 ${extColor[fileExt] ?? 'text-slate-400'}`} />

            {/* 파일 정보 */}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-600 text-slate-700 truncate">{uploadedFile.name}</div>
              <div className="text-xs mt-0.5">
                {parseLoading && (
                  <span className="text-indigo-600 flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" />
                    텍스트 추출 중...
                  </span>
                )}
                {!parseLoading && parseError && (
                  <span className="text-red-600">{parseError}</span>
                )}
                {!parseLoading && !parseError && extractedText && (
                  <span className="text-emerald-600">
                    텍스트 추출 완료 · {extractedText.length.toLocaleString()}자
                  </span>
                )}
              </div>
            </div>

            {/* 삭제 버튼 */}
            {!parseLoading && (
              <button onClick={removeFile} className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── 추출된 텍스트 확인 / 직접 입력 ── */}
      <div className="mb-4">
        <button
          onClick={() => setTextareaExpanded(v => !v)}
          className="flex items-center gap-1.5 text-xs font-600 text-slate-500 mb-1.5 hover:text-indigo-600 transition-colors"
        >
          {textareaExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {extractedText
            ? `추출된 텍스트 확인·수정 ${textareaExpanded ? '접기' : '펼치기'}`
            : `추출된 가이드라인 텍스트 ${textareaExpanded ? '접기' : '펼치기'}`
          }
          {extractedText && !textareaExpanded && (
            <Badge variant="info" className="ml-1">{extractedText.length.toLocaleString()}자</Badge>
          )}
        </button>

        {textareaExpanded && (
          <textarea
            value={extractedText}
            onChange={e => setExtractedText(e.target.value)}
            rows={7}
            placeholder={`파일에서 추출된 텍스트가 여기 표시됩니다.\n검토 후 필요하면 수정하거나, 내용을 추가로 입력할 수도 있습니다.`}
            className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-slate-700 resize-none leading-relaxed font-mono"
          />
        )}

      </div>

      {/* ── 과제 가이드라인 직접 입력 (항상 표시) ── */}
      <div className="mb-4">
        <label className="block text-xs font-600 text-slate-500 mb-1.5">
          과제 가이드라인 직접 작성
          <span className="ml-1 font-400 text-slate-400">— 파일 없이 내용을 직접 입력해도 루브릭을 생성합니다</span>
        </label>
        <textarea
          value={directInput}
          onChange={e => setDirectInput(e.target.value)}
          rows={5}
          placeholder={`여기에 과제 가이드라인 내용을 직접 입력하세요.\n\n예시:\n• 파이썬 자료형(리스트, 딕셔너리) 활용 — 3점\n• f-string을 이용한 구구단 포매팅 3종 출력 — 3점\n• math 모듈로 원의 면적 계산, 소수점 2자리 반올림 — 4점`}
          className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-slate-700 resize-none leading-relaxed"
        />
        {directInput.trim() && (
          <div className="mt-1 text-right text-xs text-slate-400">
            {directInput.trim().length.toLocaleString()}자 입력됨
          </div>
        )}
      </div>

      {/* ── AI 오류 ── */}
      {aiError && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
          <AlertCircle size={13} className="flex-shrink-0" />
          {aiError}
        </div>
      )}

      {/* ── Loading Skeleton ── */}
      {aiLoading && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3 text-xs text-indigo-600 font-600">
            <Loader2 size={13} className="animate-spin" />
            AI가 텍스트를 분석하여 채점 기준을 설계하고 있습니다...
          </div>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 text-left font-600 text-slate-500 w-8">#</th>
                  <th className="px-3 py-2.5 text-left font-600 text-slate-500 w-28">항목명</th>
                  <th className="px-3 py-2.5 text-left font-600 text-slate-500">상세 채점 기준</th>
                  <th className="px-3 py-2.5 text-center font-600 text-slate-500 w-16">배점</th>
                  <th className="px-3 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody>{[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}</tbody>
            </table>
          </div>
          <div className="mt-2 h-8 animate-pulse bg-slate-100 rounded-lg" />
        </div>
      )}

      {/* ── Editable Rubric Table ── */}
      {!aiLoading && hasResult && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-600 text-slate-600">
              AI 생성 결과 — 항목을 자유롭게 수정·삭제·추가하세요
            </span>
            <button
              onClick={handleGenerate}
              className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-600 transition-colors"
            >
              <RefreshCw size={11} /> 재생성
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden mb-3">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 text-left font-600 text-slate-500 w-8">#</th>
                  <th className="px-3 py-2.5 text-left font-600 text-slate-500 w-28">항목명</th>
                  <th className="px-3 py-2.5 text-left font-600 text-slate-500">상세 채점 기준</th>
                  <th className="px-3 py-2.5 text-center font-600 text-slate-500 w-16">배점(점)</th>
                  <th className="px-3 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody>
                {editRubrics.map((rubric, idx) => (
                  <tr key={rubric.id} className="border-b border-slate-100 last:border-0 hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-3 py-2 text-slate-400 font-600">{idx + 1}</td>
                    <td className="px-2 py-2">
                      <input
                        value={rubric.criteria}
                        onChange={e => updateRubric(rubric.id, 'criteria', e.target.value)}
                        placeholder="항목명"
                        className="w-full px-2 py-1.5 text-xs border border-transparent rounded-md bg-transparent hover:border-slate-200 focus:border-indigo-400 focus:outline-none focus:bg-white transition-colors text-slate-800 font-600"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <textarea
                        value={rubric.description}
                        onChange={e => updateRubric(rubric.id, 'description', e.target.value)}
                        placeholder="구체적인 채점 기준을 입력하세요"
                        rows={2}
                        className="w-full px-2 py-1.5 text-xs border border-transparent rounded-md bg-transparent hover:border-slate-200 focus:border-indigo-400 focus:outline-none focus:bg-white transition-colors text-slate-600 resize-none leading-relaxed"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number" min={0} value={rubric.score}
                        onChange={e => updateRubric(rubric.id, 'score', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 text-xs border border-transparent rounded-md bg-transparent hover:border-slate-200 focus:border-indigo-400 focus:outline-none focus:bg-white transition-colors text-center font-700 text-indigo-700"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => deleteRubric(rubric.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 p-0.5 rounded"
                        title="항목 삭제"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 항목 추가 */}
          <button
            onClick={addRubric}
            className="w-full py-2 flex items-center justify-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 border border-dashed border-indigo-200 rounded-lg transition-colors mb-3 font-600"
          >
            <Plus size={12} /> 항목 추가
          </button>

          {/* 총점 인디케이터 + 적용 버튼 */}
          <div className="flex items-center justify-between gap-3">
            <ScoreIndicator current={currentSum} total={totalScore} />
            <Button
              variant="success"
              onClick={handleApply}
              disabled={editRubrics.length === 0 || currentSum !== totalScore}
            >
              <CheckCircle2 size={13} />
              루브릭 적용
              {currentSum !== totalScore && (
                <span className="ml-1 opacity-70 text-xs">(배점 불일치)</span>
              )}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
