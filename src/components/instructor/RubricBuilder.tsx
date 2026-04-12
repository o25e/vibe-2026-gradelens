'use client'
import { useState } from 'react'
import { Plus, Sparkles, CheckCircle2, BookOpen, AlignLeft, Quote, Eye, FileText, X, Upload, FileCheck, File, Send } from 'lucide-react'
import { Button, Card, CardHeader, Badge } from '@/components/ui'
import { AI_SUGGESTIONS, INITIAL_RUBRICS } from '@/lib/mockData'
import type { RubricItem } from '@/lib/mockData'

const categoryIcons: Record<string, React.ReactNode> = {
  structure:   <AlignLeft size={13} />,
  logic:       <CheckCircle2 size={13} />,
  reference:   <Quote size={13} />,
  readability: <Eye size={13} />,
  format:      <FileText size={13} />,
}
const categoryColors: Record<string, string> = {
  structure:   'bg-indigo-50 text-indigo-600',
  logic:       'bg-emerald-50 text-emerald-600',
  reference:   'bg-violet-50 text-violet-600',
  readability: 'bg-amber-50 text-amber-600',
  format:      'bg-slate-100 text-slate-600',
}

interface Props {
  onPublished?: (assignmentId: string) => void
  defaultCourse?: string
}

export default function RubricBuilder({ onPublished, defaultCourse }: Props) {
  const [rubrics, setRubrics] = useState<RubricItem[]>(INITIAL_RUBRICS)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [course, setCourse] = useState(defaultCourse ?? '')
  const [deadline, setDeadline] = useState('2026-06-30T23:59')
  const [newText, setNewText] = useState('')
  const [newPts, setNewPts] = useState('')
  const [suggestionsUsed, setSuggestionsUsed] = useState<number[]>([])

  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const [saving, setSaving] = useState(false)
  const [publishedId, setPublishedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totalPts = rubrics.reduce((a, r) => a + r.pts, 0)

  const addRubric = () => {
    if (!newText.trim()) return
    setRubrics(r => [...r, { id: Date.now(), text: newText.trim(), pts: parseInt(newPts) || 10, category: 'logic' }])
    setNewText(''); setNewPts('')
  }

  const removeRubric = (id: number) => setRubrics(r => r.filter(x => x.id !== id))

  const addSuggestion = (idx: number, s: typeof AI_SUGGESTIONS[0]) => {
    setSuggestionsUsed(u => [...u, idx])
    setRubrics(r => [...r, { id: Date.now(), text: s.text, pts: s.pts, category: 'logic' }])
  }

  const handleFileUpload = async (f: File) => {
    setUploadedFile({ name: f.name, size: f.size })
    setAnalyzing(true)
    await new Promise(r => setTimeout(r, 1800))
    setAnalyzing(false)
  }

  const handlePublish = async () => {
    if (!title.trim() || !course.trim() || !deadline) {
      setError('과제 제목, 과목명, 마감 기한을 모두 입력하세요.')
      return
    }
    if (rubrics.length === 0) {
      setError('채점 기준을 최소 1개 이상 추가하세요.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          course,
          deadline: new Date(deadline).toISOString(),
          rubric_items: rubrics.map(r => ({ text: r.text, pts: r.pts, category: r.category })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장에 실패했습니다.')

      setPublishedId(data.assignment.id)
      onPublished?.(data.assignment.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="과제 생성 및 채점 기준(루브릭) 설정"
        subtitle="AI가 이 기준으로 자동 채점합니다 · 현재 총점 계획"
        actions={
          <div className="flex items-center gap-2">
            <span className={`text-sm font-700 ${totalPts === 100 ? 'text-emerald-600' : totalPts > 100 ? 'text-red-500' : 'text-amber-600'}`}>
              {totalPts} / 100점
            </span>
            {publishedId ? (
              <Badge variant="success">
                <CheckCircle2 size={11} /> 게시 완료
              </Badge>
            ) : (
              <Button onClick={handlePublish} variant="primary" size="sm" disabled={saving}>
                {saving
                  ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> 저장 중...</>
                  : <><Send size={13} /> 저장 및 게시</>
                }
              </Button>
            )}
          </div>
        }
      />

      {error && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
          {error}
        </div>
      )}

      {publishedId && (
        <div className="mb-4 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
          <CheckCircle2 size={13} />
          과제가 게시되었습니다. 학생들이 이제 제출할 수 있습니다.
          <button
            className="ml-auto text-emerald-500 hover:text-emerald-700 underline"
            onClick={() => { setPublishedId(null) }}
          >
            수정하기
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        {/* Left: Assignment Editor */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-600 text-slate-500 mb-1.5">과목명</label>
              <input
                value={course}
                onChange={e => setCourse(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-slate-500 mb-1.5">마감 기한</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-600 text-slate-500 mb-1.5">과제 제목</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-600 text-slate-500 mb-1.5">
              <BookOpen size={11} className="inline mr-1 text-slate-400" />
              과제 설명 및 요구사항
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-slate-700 resize-none leading-relaxed"
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-xs font-600 text-slate-500 mb-1.5">
              <Upload size={11} className="inline mr-1 text-slate-400" />
              강의계획서 / 과제 가이드라인 업로드
            </label>
            {uploadedFile ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <FileCheck size={14} className="text-emerald-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-600 text-emerald-700 truncate">{uploadedFile.name}</div>
                    <div className="text-xs text-emerald-500">
                      {(uploadedFile.size / 1024).toFixed(1)} KB
                      {analyzing ? ' · AI 분석 중...' : ' · AI 분석 완료'}
                    </div>
                  </div>
                  {!analyzing && (
                    <button onClick={() => setUploadedFile(null)} className="text-emerald-400 hover:text-red-500 transition-colors">
                      <X size={13} />
                    </button>
                  )}
                  {analyzing && <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
                </div>
              </div>
            ) : (
              <label
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f) }}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                className={`flex items-center gap-3 px-3 py-2.5 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-150 ${
                  dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                }`}
              >
                <input type="file" accept=".pdf,.doc,.docx,.hwp" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }} />
                <File size={16} className={dragOver ? 'text-indigo-400' : 'text-slate-300'} />
                <div>
                  <div className="text-xs font-600 text-slate-500">파일을 드래그하거나 클릭하여 업로드</div>
                  <div className="text-xs text-slate-400">PDF · DOC · DOCX · HWP</div>
                </div>
              </label>
            )}
          </div>

          {/* Add rubric */}
          <div>
            <label className="block text-xs font-600 text-slate-500 mb-1.5">새 채점 기준 직접 추가</label>
            <div className="flex gap-2">
              <input
                value={newText}
                onChange={e => setNewText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRubric()}
                placeholder="채점 기준 입력..."
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
              />
              <input
                value={newPts}
                onChange={e => setNewPts(e.target.value)}
                placeholder="점수"
                className="w-16 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 text-center"
              />
              <Button onClick={addRubric} size="sm" disabled={!newText.trim()}>
                <Plus size={13} /> 추가
              </Button>
            </div>
          </div>

          {/* AI Suggestions */}
          <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl p-3.5">
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="inline-flex items-center gap-1 bg-indigo-600 text-white text-xs font-700 px-2.5 py-1 rounded-full">
                <Sparkles size={10} /> AI 스마트 추천
              </span>
              <span className="text-xs text-indigo-500">과제 내용을 분석한 추가 채점 기준</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {AI_SUGGESTIONS.map((s, i) => {
                const used = suggestionsUsed.includes(i)
                return (
                  <button
                    key={i}
                    onClick={() => !used && addSuggestion(i, s)}
                    disabled={used}
                    className={`inline-flex items-center gap-1 text-xs font-500 px-2.5 py-1.5 rounded-full border transition-all duration-150 ${
                      used
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600 cursor-default'
                        : 'bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-600 hover:text-white hover:border-transparent cursor-pointer'
                    }`}
                  >
                    {used ? <CheckCircle2 size={10} /> : <Plus size={10} />}
                    {s.text} ({s.pts}점)
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right: Rubric List */}
        <div>
          <label className="block text-xs font-600 text-slate-500 mb-1.5">현재 채점 기준 목록</label>
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {rubrics.map(r => (
              <div key={r.id} className="flex items-center gap-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors group">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${categoryColors[r.category]}`}>
                  {categoryIcons[r.category]}
                </div>
                <span className="flex-1 text-sm text-slate-700 leading-snug">{r.text}</span>
                <span className="text-sm font-700 text-indigo-600 flex-shrink-0">{r.pts}점</span>
                <button
                  onClick={() => removeRubric(r.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          {rubrics.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs text-slate-400">{rubrics.length}개 기준</span>
              <span className={`text-xs font-700 ${totalPts === 100 ? 'text-emerald-600' : totalPts > 100 ? 'text-red-500' : 'text-amber-600'}`}>
                합계: {totalPts}점 {totalPts === 100 ? '✓' : totalPts > 100 ? '(초과)' : '(미달)'}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
