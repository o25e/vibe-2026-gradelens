'use client'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'
import { Lightbulb, TrendingUp, Star, BookOpen } from 'lucide-react'
import { Card, CardHeader, Badge, ProgressBar, Avatar } from '@/components/ui'
import { MOCK_STUDENTS, SCORE_BREAKDOWN, ASSIGNMENT_HISTORY } from '@/lib/mockData'

const student = MOCK_STUDENTS[0]

const METRIC_COLORS: Record<string, string> = {
  논리력: '#6366f1', 자료활용도: '#10b981', 가독성: '#f59e0b', 창의성: '#8b5cf6', 형식준수: '#06b6d4',
}

export default function GradeReport() {
  const radarData = Object.entries(student.radarData).map(([subject, A]) => ({
    subject, A, fullMark: 100,
  }))

  const avg = Math.round(Object.values(student.radarData).reduce((a, v) => a + v, 0) / 5)

  return (
    <div className="space-y-4">
      {/* Hero Score Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-20 w-32 h-32 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={student.name} size="lg" />
            <div>
              <div className="font-700 text-lg">{student.name}</div>
              <div className="text-indigo-200 text-sm">{student.studentId} · 컴퓨터공학과 3학년</div>
            </div>
          </div>
          <Badge variant="success" className="bg-emerald-400/20 text-emerald-200 border-emerald-300/30 text-sm px-3 py-1.5">
            <Star size={11} /> A 등급
          </Badge>
        </div>
        <div className="relative mt-5 flex items-end justify-between">
          <div>
            <div className="text-indigo-200 text-xs font-600 uppercase tracking-wide mb-1">최종 확정 점수</div>
            <div className="text-5xl font-900 tracking-tight">{student.confirmedScore}<span className="text-2xl text-indigo-300 font-500">/100</span></div>
            <div className="text-indigo-200 text-sm mt-1">AI 제안: {student.aiScore}점 → 교수 확정: {student.confirmedScore}점</div>
          </div>
          <div className="text-right">
            <div className="text-indigo-200 text-xs font-600 mb-1">역량 평균</div>
            <div className="text-3xl font-800">{avg}<span className="text-lg text-indigo-300">/100</span></div>
            <div className="text-indigo-200 text-xs">제출: {student.submittedAt}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Radar Chart */}
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
            {Object.entries(student.radarData).map(([k, v]) => (
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

        {/* Score Breakdown & Feedback */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="점수 항목별 상세 내역" subtitle="왜 이 점수인가?" />
            <div className="space-y-2">
              {SCORE_BREAKDOWN.map(({ item, score, max, note }) => (
                <div key={item} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-700 font-500">{item}</span>
                      <span className={`font-700 ${score === max ? 'text-emerald-600' : score >= max * 0.8 ? 'text-indigo-600' : 'text-amber-600'}`}>
                        {score}/{max}
                      </span>
                    </div>
                    <ProgressBar
                      value={score} max={max}
                      color={score === max ? '#10b981' : score >= max * 0.8 ? '#6366f1' : '#f59e0b'}
                    />
                    <div className="text-xs text-slate-400 mt-0.5">{note}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* AI Feedback Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="inline-flex items-center gap-1 bg-indigo-600 text-white text-xs font-700 px-2 py-0.5 rounded-full">
                <TrendingUp size={9} /> AI 상세 피드백
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{student.feedback}</p>
          </div>
        </div>
      </div>

      {/* Next Assignment Guide */}
      <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Lightbulb size={18} className="text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-sm font-700 text-emerald-800">다음 과제를 위한 AI 가이드</h4>
              <Badge variant="success">맞춤 추천</Badge>
            </div>
            <ul className="space-y-1.5 text-xs text-emerald-700">
              {[
                '① 반론을 제시하고 재반박하는 구조를 명시적으로 포함하세요. (논리력 +4점 예상)',
                '② 1차 자료(학술 논문, 정부 보고서)의 비중을 현재 65%에서 70% 이상으로 높이세요.',
                '③ 각 장의 말미에 소결론 문단을 추가하면 가독성과 논리력이 동시에 향상됩니다.',
                '④ APA 7th 형식을 완전히 적용하면 참고 자료 항목에서 만점 가능합니다.',
              ].map((g, i) => (
                <li key={i} className="leading-relaxed">{g}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

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
                <tr key={i} className={`${i === ASSIGNMENT_HISTORY.length - 1 ? '' : 'border-b border-slate-100'} hover:bg-slate-50`}>
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
