'use client'
import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import { SlidersHorizontal } from 'lucide-react'
import { Card, CardHeader, Badge } from '@/components/ui'
import type { Student } from '@/lib/mockData'

type Grade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F'

const GRADE_COLORS: Record<Grade, string> = {
  'A+': '#10b981', A: '#34d399', 'B+': '#6366f1', B: '#818cf8',
  'C+': '#f59e0b', C: '#fbbf24', D: '#f87171', F: '#ef4444',
}
const GRADE_BADGE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'gray'> = {
  'A+': 'success', A: 'success', 'B+': 'info', B: 'info',
  'C+': 'warning', C: 'warning', D: 'danger', F: 'danger',
}

function computeGrade(score: number, cuts: Record<string, number>): Grade {
  if (score >= cuts['A+']) return 'A+'
  if (score >= cuts.A)  return 'A'
  if (score >= cuts['B+']) return 'B+'
  if (score >= cuts.B)  return 'B'
  if (score >= cuts['C+']) return 'C+'
  if (score >= cuts.C)  return 'C'
  if (score >= 50)      return 'D'
  return 'F'
}

const BINS = ['40-49','50-59','60-69','70-79','80-89','90-100']
const BIN_MID = [45, 55, 65, 75, 85, 95]

export default function GradeOptimizer({ students }: { students: Student[] }) {
  const [cuts, setCuts] = useState({ 'A+': 93, A: 87, 'B+': 80, B: 73, 'C+': 65, C: 58 })

  const scored = useMemo(() =>
    students.map(s => ({ ...s, grade: computeGrade(s.confirmedScore ?? s.aiScore, cuts) })),
    [students, cuts]
  )

  const gradeCounts = useMemo(() => {
    const counts: Record<Grade, number> = { 'A+': 0, A: 0, 'B+': 0, B: 0, 'C+': 0, C: 0, D: 0, F: 0 }
    scored.forEach(s => counts[s.grade]++)
    return counts
  }, [scored])

  const histData = useMemo(() =>
    BINS.map((range, i) => ({
      range,
      count: students.filter(s => {
        const score = s.confirmedScore ?? s.aiScore
        return score >= BIN_MID[i] - 5 && score < BIN_MID[i] + 5
      }).length,
      grade: computeGrade(BIN_MID[i], cuts),
    })),
    [students, cuts]
  )

  const CUTOFF_CONFIG = [
    { key: 'A+', label: 'A+ 기준', color: '#10b981' },
    { key: 'A',  label: 'A  기준', color: '#6366f1' },
    { key: 'B+', label: 'B+ 기준', color: '#8b5cf6' },
    { key: 'B',  label: 'B  기준', color: '#f59e0b' },
    { key: 'C+', label: 'C+ 기준', color: '#f97316' },
    { key: 'C',  label: 'C  기준', color: '#ef4444' },
  ] as const

  return (
    <Card>
      <CardHeader
        title="성적 분포 시뮬레이터 (Grade Optimizer)"
        subtitle="등급 기준 컷오프를 실시간으로 조절하여 성적 분포를 시뮬레이션합니다"
        actions={
          <div className="flex flex-wrap gap-1.5">
            {(['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'] as Grade[]).map(g =>
              gradeCounts[g] > 0 ? (
                <Badge key={g} variant={GRADE_BADGE[g]}>
                  {g}: {gradeCounts[g]}명
                </Badge>
              ) : null
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Chart + Sliders */}
        <div>
          {/* Histogram */}
          <div className="h-48 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histData} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}
                  formatter={(v: number) => [`${v}명`, '인원']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {histData.map((d, i) => (
                    <Cell key={i} fill={GRADE_COLORS[d.grade]} opacity={d.count === 0 ? 0.2 : 0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Sliders */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 mb-2">
              <SlidersHorizontal size={13} className="text-slate-400" />
              <span className="text-xs font-700 text-slate-500 uppercase tracking-wide">등급 컷오프 조절</span>
            </div>
            {CUTOFF_CONFIG.map(({ key, label, color }) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-600 text-slate-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    {label}
                  </span>
                  <span className="text-xs font-700" style={{ color }}>{cuts[key as keyof typeof cuts]}점 이상</span>
                </div>
                <input
                  type="range" min={50} max={100} step={1}
                  value={cuts[key as keyof typeof cuts]}
                  onChange={e => setCuts(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: color }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Simulation List */}
        <div>
          <div className="text-xs font-700 text-slate-500 uppercase tracking-wide mb-2">실시간 시뮬레이션 결과</div>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="max-h-[360px] overflow-y-auto">
              {scored
                .sort((a, b) => (b.confirmedScore ?? b.aiScore) - (a.confirmedScore ?? a.aiScore))
                .map((s, idx) => (
                  <div key={s.id} className={`flex items-center justify-between px-3.5 py-2.5 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-indigo-50/40 transition-colors`}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-slate-400 w-4 text-right font-500">{idx + 1}</span>
                      <span className="text-sm font-500 text-slate-700">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-slate-400">{s.confirmedScore ?? s.aiScore}점</span>
                      <span
                        className="text-sm font-800 w-8 text-right"
                        style={{ color: GRADE_COLORS[s.grade] }}
                      >
                        {s.grade}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
          {/* Grade distribution summary */}
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {(['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'] as Grade[]).map(g => (
              <div key={g} className="text-center p-2 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-xs font-700" style={{ color: GRADE_COLORS[g] }}>{g}</div>
                <div className="text-sm font-800 text-slate-800">{gradeCounts[g]}</div>
                <div className="text-xs text-slate-400">{Math.round(gradeCounts[g] / students.length * 100)}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
