'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { SlidersHorizontal, Save, CheckCircle2, AlertCircle, RefreshCw, TrendingUp } from 'lucide-react'
import { Card, CardHeader, Badge, Button } from '@/components/ui'

// ── Types ────────────────────────────────────────────────────────────────────
type Grade = 'A' | 'B' | 'C' | 'D' | 'F'
type Cuts = { A: number; B: number; C: number; D: number }

interface LiveStudent {
  id: string
  name: string
  aiScore: number | null
  confirmedScore: number | null
  status: 'confirmed' | 'pending' | 'flagged'
}

// ── Constants ────────────────────────────────────────────────────────────────
function defaultCuts(maxPts: number): Cuts {
  return {
    A: Math.round(maxPts * 0.9),
    B: Math.round(maxPts * 0.8),
    C: Math.round(maxPts * 0.7),
    D: Math.round(maxPts * 0.6),
  }
}

const GRADE_COLORS: Record<Grade, string> = {
  A: '#10b981', B: '#6366f1', C: '#f59e0b', D: '#f87171', F: '#ef4444',
}
const GRADE_BADGE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'gray'> = {
  A: 'success', B: 'info', C: 'warning', D: 'danger', F: 'danger',
}
const CUTOFF_CONFIG = [
  { key: 'A' as const, label: 'A 기준', color: '#10b981' },
  { key: 'B' as const, label: 'B 기준', color: '#6366f1' },
  { key: 'C' as const, label: 'C 기준', color: '#f59e0b' },
  { key: 'D' as const, label: 'D 기준', color: '#f87171' },
]
const BINS = [
  { range: '0-49',   min: 0,  max: 49  },
  { range: '50-59',  min: 50, max: 59  },
  { range: '60-69',  min: 60, max: 69  },
  { range: '70-79',  min: 70, max: 79  },
  { range: '80-89',  min: 80, max: 89  },
  { range: '90-100', min: 90, max: 100 },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function computeGrade(score: number, cuts: Cuts): Grade {
  if (score >= cuts.A) return 'A'
  if (score >= cuts.B) return 'B'
  if (score >= cuts.C) return 'C'
  if (score >= cuts.D) return 'D'
  return 'F'
}

function effectiveScore(s: LiveStudent): number {
  return s.confirmedScore ?? s.aiScore ?? 0
}

/** 각 컷오프 키에 대한 슬라이더 min/max 반환 (인접 등급 교차 방지) */
function sliderBounds(key: keyof Cuts, cuts: Cuts, maxPts: number): { min: number; max: number } {
  switch (key) {
    case 'A': return { min: cuts.B + 1, max: maxPts }
    case 'B': return { min: cuts.C + 1, max: cuts.A - 1 }
    case 'C': return { min: cuts.D + 1, max: cuts.B - 1 }
    case 'D': return { min: 1,          max: cuts.C - 1 }
  }
}

// ── Sub-components ───────────────────────────────────────────────────────────
function SaveFeedback({ state }: { state: 'idle' | 'saving' | 'ok' | 'error' }) {
  if (state === 'idle') return null
  if (state === 'saving') return (
    <span className="text-xs text-slate-400 flex items-center gap-1">
      <div className="w-3 h-3 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
      저장 중...
    </span>
  )
  if (state === 'ok') return (
    <span className="text-xs text-emerald-600 flex items-center gap-1 font-600">
      <CheckCircle2 size={13} /> 설정이 성공적으로 반영되었습니다
    </span>
  )
  return (
    <span className="text-xs text-red-500 flex items-center gap-1">
      <AlertCircle size={13} /> 저장 실패. 다시 시도해 주세요.
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  assignmentId?: string
  maxPts?: number
}

export default function GradeOptimizer({ assignmentId, maxPts = 100 }: Props) {
  const [students, setStudents] = useState<LiveStudent[]>([])
  const [loading, setLoading] = useState(false)
  const [cuts, setCuts] = useState<Cuts>(() => defaultCuts(maxPts))
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [savedAt, setSavedAt] = useState<string | null>(null)

  // maxPts 변경 시 cuts를 비율 기반으로 재설정
  useEffect(() => {
    setCuts(defaultCuts(maxPts))
  }, [maxPts])

  // ── Fetch live submissions ────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!assignmentId) return
    setLoading(true)
    try {
      const [subRes, settingsRes] = await Promise.all([
        fetch(`/api/submissions?assignment_id=${assignmentId}`),
        fetch(`/api/grade-settings?assignment_id=${assignmentId}`),
      ])

      if (subRes.ok) {
        const { submissions } = await subRes.json()
        setStudents(
          (submissions ?? []).map((s: Record<string, unknown>) => ({
            id:             s.id as string,
            name:           s.student_name as string,
            aiScore:        s.ai_score as number | null,
            confirmedScore: s.confirmed_score as number | null,
            status:         s.grade_status as 'confirmed' | 'pending' | 'flagged',
          }))
        )
      }

      if (settingsRes.ok) {
        const { cuts: saved, updated_at } = await settingsRes.json()
        if (saved) {
          setCuts(saved)
          setSavedAt(updated_at ?? null)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [assignmentId])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Derived data (all re-computed whenever students or cuts change) ────────
  const scoredStudents = useMemo(() =>
    students
      .filter(s => s.aiScore !== null || s.confirmedScore !== null)
      .map(s => ({ ...s, score: effectiveScore(s), grade: computeGrade(effectiveScore(s), cuts) }))
      .sort((a, b) => b.score - a.score),
    [students, cuts]
  )

  const gradeCounts = useMemo(() =>
    (['A', 'B', 'C', 'D', 'F'] as Grade[]).reduce(
      (acc, g) => ({ ...acc, [g]: scoredStudents.filter(s => s.grade === g).length }),
      {} as Record<Grade, number>
    ),
    [scoredStudents]
  )

  const histData = useMemo(() =>
    BINS.map(({ range, min, max }) => {
      const inBin = scoredStudents.filter(s => s.score >= min && s.score <= max)
      const midScore = Math.round((min + max) / 2)
      return {
        range,
        count: inBin.length,
        grade: computeGrade(midScore, cuts),
        pct: scoredStudents.length > 0 ? Math.round(inBin.length / scoredStudents.length * 100) : 0,
      }
    }),
    [scoredStudents, cuts]
  )

  const stats = useMemo(() => {
    if (scoredStudents.length === 0) return null
    const scores = scoredStudents.map(s => s.score)
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    const sorted = [...scores].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const sd = Math.round(Math.sqrt(scores.reduce((a, b) => a + (b - avg) ** 2, 0) / scores.length))
    return { avg, median, sd, max: Math.max(...scores), min: Math.min(...scores) }
  }, [scoredStudents])

  // ── Save handler ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!assignmentId) return
    setSaveState('saving')
    try {
      const res = await fetch('/api/grade-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId, cuts }),
      })
      if (!res.ok) throw new Error('save failed')
      const { updated_at } = await res.json()
      setSavedAt(updated_at)
      setSaveState('ok')
      setTimeout(() => setSaveState('idle'), 3000)
    } catch {
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 4000)
    }
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!assignmentId) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
          <TrendingUp size={28} className="opacity-30" />
          <p className="text-sm">과제를 선택하면 성적 분포가 표시됩니다.</p>
        </div>
      </Card>
    )
  }

  const total = scoredStudents.length

  return (
    <Card>
      <CardHeader
        title="성적 분포 시뮬레이터"
        subtitle="등급 컷오프를 조절하면 분포도와 학생별 등급이 즉시 재계산됩니다"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> 새로고침
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saveState === 'saving' || !assignmentId}>
              <Save size={13} /> 등급 설정 저장
            </Button>
          </div>
        }
      />

      {/* Save feedback + stats strip */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-wrap gap-1.5">
          {(['A', 'B', 'C', 'D', 'F'] as Grade[]).map(g =>
            gradeCounts[g] > 0 ? (
              <Badge key={g} variant={GRADE_BADGE[g]}>
                {g}: {gradeCounts[g]}명 ({total > 0 ? Math.round(gradeCounts[g] / total * 100) : 0}%)
              </Badge>
            ) : null
          )}
        </div>
        <div className="flex items-center gap-3">
          <SaveFeedback state={saveState} />
          {savedAt && saveState === 'idle' && (
            <span className="text-xs text-slate-300">
              마지막 저장 {new Date(savedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400">
          <div className="w-7 h-7 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
          <TrendingUp size={28} className="opacity-30" />
          <p className="text-sm">아직 채점된 데이터가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {/* ── Left: Chart + Sliders ── */}
          <div>
            {/* Stats row */}
            {stats && (
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {[
                  { label: '평균',   value: `${stats.avg}점`,    color: 'text-indigo-600' },
                  { label: '중앙값', value: `${stats.median}점`, color: 'text-emerald-600' },
                  { label: '표준편차',value: `${stats.sd}점`,    color: 'text-amber-600' },
                  { label: '최고/최저', value: `${stats.max}/${stats.min}`, color: 'text-slate-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="text-xs text-slate-400">{label}</div>
                    <div className={`text-xs font-800 ${color}`}>{value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Histogram + reference lines */}
            <div className="h-44 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={histData} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}
                    formatter={(v: number, name: string) =>
                      name === 'count' ? [`${v}명 (${histData.find(d => d.count === v)?.pct ?? 0}%)`, '인원'] : [v, name]
                    }
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {histData.map((d, i) => (
                      <Cell key={i} fill={GRADE_COLORS[d.grade]} opacity={d.count === 0 ? 0.15 : 0.85} />
                    ))}
                  </Bar>
                  {/* Average reference line */}
                  {stats && (
                    <ReferenceLine
                      x={BINS.findIndex(b => stats.avg >= b.min && stats.avg <= b.max) !== -1
                        ? BINS[BINS.findIndex(b => stats.avg >= b.min && stats.avg <= b.max)].range
                        : undefined}
                      stroke="#6366f1" strokeDasharray="4 2"
                      label={{ value: `평균 ${stats.avg}점`, position: 'top', fontSize: 10, fill: '#6366f1' }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Sliders */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <SlidersHorizontal size={13} className="text-slate-400" />
                <span className="text-xs font-700 text-slate-500 uppercase tracking-wide">등급 컷오프 조절</span>
                <span className="text-xs text-slate-300 ml-auto">만점 {maxPts}점 기준</span>
              </div>
              {CUTOFF_CONFIG.map(({ key, label, color }) => {
                const count = gradeCounts[key] ?? 0
                const pct = total > 0 ? Math.round(count / total * 100) : 0
                const { min: sMin, max: sMax } = sliderBounds(key, cuts, maxPts)
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-600 text-slate-600 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        {label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">{count}명 ({pct}%)</span>
                        <input
                          type="number"
                          min={sMin} max={sMax}
                          value={cuts[key]}
                          onChange={e => {
                            const v = Math.min(sMax, Math.max(sMin, parseInt(e.target.value) || sMin))
                            setCuts(prev => ({ ...prev, [key]: v }))
                            setSaveState('idle')
                          }}
                          className="w-14 text-xs font-700 text-right px-1.5 py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-300"
                          style={{ color }}
                        />
                        <span className="text-xs text-slate-400">점 이상</span>
                      </div>
                    </div>
                    <input
                      type="range" min={sMin} max={sMax} step={1}
                      value={cuts[key]}
                      onChange={e => {
                        setCuts(prev => ({ ...prev, [key]: parseInt(e.target.value) }))
                        setSaveState('idle')
                      }}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{ accentColor: color }}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Right: Ranked student list ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-700 text-slate-500 uppercase tracking-wide">실시간 시뮬레이션 결과</span>
              <span className="text-xs text-slate-400">{total}명 채점 완료</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="max-h-[380px] overflow-y-auto">
                {scoredStudents.map((s, idx) => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between px-3.5 py-2.5 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                    } hover:bg-indigo-50/40 transition-colors`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-slate-300 w-5 text-right font-500">{idx + 1}</span>
                      <span className="text-sm font-500 text-slate-700">{s.name}</span>
                      {s.status === 'confirmed' && (
                        <span className="text-xs text-emerald-500 font-600">확정</span>
                      )}
                      {s.status === 'pending' && (
                        <span className="text-xs text-amber-400 font-600">AI</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-slate-400">{s.score}점</span>
                      <span className="text-sm font-800 w-8 text-right" style={{ color: GRADE_COLORS[s.grade] }}>
                        {s.grade}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Grade distribution summary grid */}
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {(['A', 'B', 'C', 'D', 'F'] as Grade[]).map(g => (
                <div key={g} className="text-center p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="text-xs font-700" style={{ color: GRADE_COLORS[g] }}>{g}</div>
                  <div className="text-sm font-800 text-slate-800">{gradeCounts[g]}</div>
                  <div className="text-xs text-slate-400">
                    {total > 0 ? `${Math.round(gradeCounts[g] / total * 100)}%` : '0%'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
