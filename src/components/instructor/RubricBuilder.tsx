'use client'
import { useState } from 'react'
import { Plus, Sparkles, CheckCircle2, BookOpen, AlignLeft, Quote, Eye, FileText, X } from 'lucide-react'
import { Button, Card, CardHeader } from '@/components/ui'
import { AI_SUGGESTIONS, INITIAL_RUBRICS, MOCK_ASSIGNMENT } from '@/lib/mockData'
import type { RubricItem } from '@/lib/mockData'

const categoryIcons: Record<string, React.ReactNode> = {
  structure: <AlignLeft size={13} />,
  logic:     <CheckCircle2 size={13} />,
  reference: <Quote size={13} />,
  readability: <Eye size={13} />,
  format:    <FileText size={13} />,
}
const categoryColors: Record<string, string> = {
  structure: 'bg-indigo-50 text-indigo-600',
  logic:     'bg-emerald-50 text-emerald-600',
  reference: 'bg-violet-50 text-violet-600',
  readability: 'bg-amber-50 text-amber-600',
  format:    'bg-slate-100 text-slate-600',
}

export default function RubricBuilder() {
  const [rubrics, setRubrics] = useState<RubricItem[]>(INITIAL_RUBRICS)
  const [title, setTitle] = useState(MOCK_ASSIGNMENT.title)
  const [description, setDescription] = useState(MOCK_ASSIGNMENT.description)
  const [newText, setNewText] = useState('')
  const [newPts, setNewPts] = useState('')
  const [saved, setSaved] = useState(false)
  const [suggestionsUsed, setSuggestionsUsed] = useState<number[]>([])

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

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
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
            <Button onClick={handleSave} variant={saved ? 'success' : 'primary'} size="sm">
              {saved ? <><CheckCircle2 size={13} /> 저장됨</> : '저장 및 게시'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-5">
        {/* Left: Assignment Editor */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-600 text-slate-500 mb-1.5">과제 제목</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white text-slate-800"
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
              rows={4}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white text-slate-700 resize-none leading-relaxed"
            />
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
          <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
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
