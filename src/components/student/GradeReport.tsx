'use client'
import { useEffect, useState, useCallback } from 'react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'
import { TrendingUp, BookOpen, CheckCircle2, ArrowRight, Target, RefreshCw, FileText, Clock, ChevronLeft } from 'lucide-react'
import { Card, CardHeader, Badge, ProgressBar, Avatar, Button } from '@/components/ui'
import { ASSIGNMENT_HISTORY } from '@/lib/mockData'
import type { AuthUser } from '@/lib/auth'

interface RubricScore { rubric_text: string; max_pts: number; score: number; reason: string }
interface Section2Item { action: string; impact: string; category: string }
interface RadarScores { 논리력: number; 자료활용도: number; 가독성: number; 창의성: number; 형식준수: number }

interface Submission {
  id: string
  assignment_id: string
  assignment_title: string
  course: string
  submitted_at: string
  word_count: number
  ai_score: number | null
  confirmed_score: number | null
  grade_status: string
  feedback_short: string | null
  rubric_scores: RubricScore[] | null
  radar_scores: RadarScores | null
  section1_summary: string | null
  section2_items: Section2Item[] | null
}

const METRIC_COLORS: Record<string, string> = {
  논리력: '#6366f1', 자료활용도: '#10b981', 가독성: '#f59e0b', 창의성: '#8b5cf6', 형식준수: '#06b6d4',
}
const CATEGORY_LABEL: Record<string, string> = {
  logic: '논리력', reference: '자료활용도', readability: '가독성',
  format: '형식', structure: '구조',
}
const CATEGORY_COLOR: Record<string, string> = {
  logic: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  reference: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  readability: 'bg-amber-50 text-amber-700 border-amber-200',
  format: 'bg-slate-100 text-slate-600 border-slate-200',
  structure: 'bg-violet-50 text-violet-700 border-violet-200',
}

export default function GradeReport({
  user,
  assignmentId,
  onBack,
}: {
  user: AuthUser
  assignmentId?: string
  onBack?: () => void
}) {
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/submissions', { cache: 'no-store' })
      const data = await res.json()
      const list: Submission[] = data.submissions ?? []

      if (assignmentId) {
        // 특정 과제 제출 찾기
        const found = list.find(s => s.assignment_id === assignmentId) ?? null
        setSubmission(found)
      } else {
        // 최신 제출 (기존 동작)
        setSubmission(list.length > 0 ? list[0] : null)
      }
    } catch {
      setError('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [assignmentId])

  useEffect(() => { fetchData() }, [fetchData])

  // 뒤로가기 버튼
  const BackButton = onBack ? (
    <button
      onClick={onBack}
      className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors mb-4"
    >
      <ChevronLeft size={15} /> 과제 목록으로
    </button>
  ) : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">성적 리포트 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
        {BackButton}
        <p className="text-sm text-red-500">{error}</p>
        <Button variant="ghost" size="sm" onClick={fetchData}><RefreshCw size={13} /> 다시 시도</Button>
      </div>
    )
  }

  // 제출했지만 교수가 아직 공지하지 않은 경우
  if (submission && (submission.grade_status === 'waiting' || (submission.ai_score === null && submission.confirmed_score === null))) {
    return (
      <div className="space-y-4">
        {BackButton}
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center">
            <Clock size={28} className="text-amber-400 animate-pulse" />
          </div>
          <div className="text-center">
            <p className="text-sm font-600 text-slate-700">과제 제출 완료 — 교수님 채점 대기 중</p>
            <p className="text-xs mt-1 text-slate-400">채점이 완료되면 알림을 통해 안내드립니다.</p>
            <p className="text-xs mt-1 text-slate-300">제출 과제: {submission.assignment_title}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchData}><RefreshCw size={13} /> 새로고침</Button>
        </div>
      </div>
    )
  }

  // 제출 없음
  if (!submission || submission.ai_score === null) {
    return (
      <div className="space-y-4">
        {BackButton}
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
            <FileText size={28} className="opacity-40" />
          </div>
          <div className="text-center">
            <p className="text-sm font-600 text-slate-600">아직 제출한 과제가 없습니다</p>
            <p className="text-xs mt-1">과제 목록에서 과제를 제출하면 AI 피드백 리포트가 표시됩니다.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchData}><RefreshCw size={13} /> 새로고침</Button>
        </div>

        {/* 히스토리 (성적 미공개 시에도 표시) */}
        <Card>
          <CardHeader
            title="과제 성적 히스토리"
            subtitle="이번 학기 전체 과제 성적"
            actions={<Badge variant="gray"><BookOpen size={10} /> 이번 학기</Badge>}
          />
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['과제명', '제출일', '점수', '등급'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-700 text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ASSIGNMENT_HISTORY.map((a, i) => (
                  <tr key={i} className={`${i < ASSIGNMENT_HISTORY.length - 1 ? 'border-b border-slate-100' : ''} hover:bg-slate-50`}>
                    <td className="px-3 py-2.5 text-sm font-500 text-slate-700">{a.name}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{a.date}</td>
                    <td className="px-3 py-2.5 text-sm font-700 text-indigo-600">{a.score}점</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={a.grade.startsWith('A') ? 'success' : 'info'}>{a.grade}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    )
  }

  // 최종 점수: 교수 확정 점수 우선, 없으면 AI 점수
  const score = submission.confirmed_score ?? submission.ai_score ?? 0
  const isConfirmed = submission.confirmed_score !== null
  const totalPts = submission.rubric_scores?.reduce((a, r) => a + r.max_pts, 0) ?? 100

  const gradeLabel =
    score >= 95 ? 'A+' : score >= 90 ? 'A' : score >= 85 ? 'B+' :
    score >= 80 ? 'B' : score >= 75 ? 'C+' : score >= 70 ? 'C' : 'D'
  const gradeVariant = gradeLabel.startsWith('A') ? 'success' : gradeLabel.startsWith('B') ? 'info' : 'warning'

  const radar = submission.radar_scores
  const radarData = radar
    ? Object.entries(radar).map(([subject, A]) => ({ subject, A, fullMark: 100 }))
    : []
  const radarAvg = radar
    ? Math.round(Object.values(radar).reduce((a, v) => a + v, 0) / Object.values(radar).length)
    : 0

  return (
    <div className="space-y-4">
      {/* 뒤로가기 */}
      {BackButton}

      {/* Hero Score Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-20 w-32 h-32 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={user.name.charAt(0)} size="lg" />
            <div>
              <div className="font-700 text-lg">{user.name}</div>
              <div className="text-indigo-200 text-sm">
                {user.studentId ? `학번 ${user.studentId}` : ''}
                {user.department ? ` · ${user.department}` : ''}
              </div>
              <div className="text-indigo-300 text-xs mt-0.5">{submission.assignment_title}</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={gradeVariant} className="bg-white/10 text-white border-white/20 text-sm px-3 py-1.5">
              {gradeLabel} 등급
            </Badge>
            {submission.grade_status === 'pending' && (
              <span className="text-xs text-indigo-200">교수 검토 중</span>
            )}
          </div>
        </div>
        <div className="relative mt-5 flex items-end justify-between">
          <div>
            <div className="text-indigo-200 text-xs font-600 uppercase tracking-wide mb-1">
              {isConfirmed ? '교수 최종 확정 점수' : 'AI 채점 점수'}
            </div>
            <div className="text-5xl font-900 tracking-tight">
              {score}<span className="text-2xl text-indigo-300 font-500">/{totalPts}</span>
            </div>
            {submission.confirmed_score && submission.ai_score && (
              <div className="text-indigo-200 text-sm mt-1">
                AI 제안: {submission.ai_score}점 → 교수 확정: {submission.confirmed_score}점
              </div>
            )}
          </div>
          <div className="text-right">
            {radarAvg > 0 && (
              <>
                <div className="text-indigo-200 text-xs font-600 mb-1">역량 평균</div>
                <div className="text-3xl font-800">{radarAvg}<span className="text-lg text-indigo-300">/100</span></div>
              </>
            )}
            <div className="text-indigo-200 text-xs mt-1">
              제출: {new Date(submission.submitted_at).toLocaleDateString('ko-KR')}
            </div>
            <button onClick={fetchData} className="text-indigo-300 hover:text-white mt-1 transition-colors">
              <RefreshCw size={12} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Radar Chart */}
        {radarData.length > 0 && (
          <Card>
            <CardHeader title="역량별 평가 분포" subtitle="AI 채점 기준 항목별 점수" />
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius={80} data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <Radar name="점수" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {radar && Object.entries(radar).map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-500">{k}</span>
                    <span className="font-700" style={{ color: METRIC_COLORS[k] }}>{v}</span>
                  </div>
                  <ProgressBar value={v} color={METRIC_COLORS[k]} />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Right column */}
        <div className="space-y-3">
          {/* Section 1 */}
          {submission.rubric_scores && submission.section1_summary && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-800">1</span>
                </div>
                <div>
                  <div className="text-sm font-700 text-slate-800">점수 산출 근거</div>
                  <div className="text-xs text-slate-400">왜 이 점수가 부여되었는가</div>
                </div>
                <span className={`ml-auto inline-flex items-center gap-1 text-xs font-700 px-2 py-0.5 rounded-full ${
                  isConfirmed
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 text-white'
                }`}>
                  <TrendingUp size={9} />
                  {isConfirmed ? '교수 확정' : 'AI 분석'}
                </span>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mb-3 text-xs text-indigo-700 leading-relaxed">
                {submission.section1_summary}
              </div>

              <div className="space-y-2">
                {submission.rubric_scores.map(({ rubric_text, score: s, max_pts, reason }) => (
                  <div key={rubric_text} className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-700 font-600 leading-snug flex-1 pr-2">{rubric_text}</span>
                      <span className={`font-800 flex-shrink-0 ${s === max_pts ? 'text-emerald-600' : s >= max_pts * 0.85 ? 'text-indigo-600' : 'text-amber-600'}`}>
                        {s}<span className="text-slate-400 font-500">/{max_pts}</span>
                      </span>
                    </div>
                    <ProgressBar value={s} max={max_pts} color={s === max_pts ? '#10b981' : s >= max_pts * 0.85 ? '#6366f1' : '#f59e0b'} />
                    <div className="flex items-start gap-1 mt-1.5">
                      {s < max_pts ? <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠</span> : <CheckCircle2 size={11} className="text-emerald-500 mt-0.5 flex-shrink-0" />}
                      <p className="text-xs text-slate-500 leading-snug">{reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Section 2 */}
          {submission.section2_items && submission.section2_items.length > 0 && (
            <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-800">2</span>
                </div>
                <div>
                  <div className="text-sm font-700 text-emerald-800">성적 향상 가이드</div>
                  <div className="text-xs text-emerald-600">다음 과제 실천 액션 아이템</div>
                </div>
                <Badge variant="success" className="ml-auto">맞춤 추천</Badge>
              </div>

              <div className="space-y-2">
                {submission.section2_items.map(({ action, impact, category }, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 bg-white/70 border border-emerald-100 rounded-lg">
                    <div className="w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs font-800">{i + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-emerald-800 font-500 leading-snug">{action}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <ArrowRight size={10} className="text-emerald-500" />
                        <span className="text-xs font-700 text-emerald-600">{impact}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${CATEGORY_COLOR[category] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {CATEGORY_LABEL[category] ?? category}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-emerald-200 flex items-center gap-1.5">
                <Target size={12} className="text-emerald-600" />
                <p className="text-xs text-emerald-700 font-600">
                  위 항목 반영 시 <span className="text-emerald-800 font-800">+10~15점</span> 향상 가능
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Assignment History */}
      <Card>
        <CardHeader
          title="과제 성적 히스토리"
          subtitle="이번 학기 전체 과제 성적"
          actions={<Badge variant="gray"><BookOpen size={10} /> 이번 학기</Badge>}
        />
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['과제명', '제출일', '점수', '등급'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-700 text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ASSIGNMENT_HISTORY.map((a, i) => (
                <tr key={i} className={`${i < ASSIGNMENT_HISTORY.length - 1 ? 'border-b border-slate-100' : ''} hover:bg-slate-50`}>
                  <td className="px-3 py-2.5 text-sm font-500 text-slate-700">{a.name}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-400">{a.date}</td>
                  <td className="px-3 py-2.5 text-sm font-700 text-indigo-600">{a.score}점</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={a.grade.startsWith('A') ? 'success' : 'info'}>{a.grade}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
