'use client'
import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Bell, Flag, AlertCircle, RefreshCw, Sparkles } from 'lucide-react'
import { Button, Card, CardHeader, Badge, Avatar, Modal, StatCard } from '@/components/ui'

type GradeStatus = 'confirmed' | 'pending' | 'flagged'

interface Submission {
  id: string
  student_name: string
  student_number: string
  department: string
  submitted_at: string
  word_count: number
  ai_score: number | null
  confirmed_score: number | null
  grade_status: GradeStatus
  feedback_short: string | null
  rubric_scores: { rubric_text: string; max_pts: number; score: number; reason: string }[] | null
  grade_id: string | null
}

const statusConfig: Record<GradeStatus, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  confirmed: { label: '확정', variant: 'success' },
  pending:   { label: '검토 대기', variant: 'warning' },
  flagged:   { label: '요주의', variant: 'danger' },
}

interface Props {
  assignmentId?: string
}

export default function GradingTable({ assignmentId }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<Submission | null>(null)
  const [editFeedback, setEditFeedback] = useState('')
  const [editScore, setEditScore] = useState('')
  const [saving, setSaving] = useState(false)
  const [notified, setNotified] = useState(false)

  const fetchSubmissions = useCallback(async () => {
    if (!assignmentId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/submissions?assignment_id=${assignmentId}`)
      const data = await res.json()
      setSubmissions(data.submissions ?? [])
    } finally {
      setLoading(false)
    }
  }, [assignmentId])

  useEffect(() => { fetchSubmissions() }, [fetchSubmissions])

  const openModal = (s: Submission) => {
    setModal(s)
    setEditFeedback(s.feedback_short ?? '')
    setEditScore(String(s.confirmed_score ?? s.ai_score ?? ''))
  }

  const saveModal = async () => {
    if (!modal || !modal.grade_id) return
    setSaving(true)
    try {
      const res = await fetch(`/api/grades/${modal.grade_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed_score: parseInt(editScore) || modal.ai_score,
          feedback_short: editFeedback,
          status: 'confirmed',
        }),
      })
      if (res.ok) {
        setSubmissions(prev => prev.map(s =>
          s.id === modal.id
            ? { ...s, confirmed_score: parseInt(editScore) || s.ai_score, feedback_short: editFeedback, grade_status: 'confirmed' }
            : s
        ))
        setModal(null)
      }
    } finally {
      setSaving(false)
    }
  }

  const bulkApprove = async () => {
    const pending = submissions.filter(s => s.grade_status !== 'flagged' && s.grade_id)
    await Promise.all(pending.map(s =>
      fetch(`/api/grades/${s.grade_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_score: s.ai_score, status: 'confirmed' }),
      })
    ))
    setSubmissions(prev => prev.map(s =>
      s.grade_status !== 'flagged'
        ? { ...s, confirmed_score: s.confirmed_score ?? s.ai_score, grade_status: 'confirmed' }
        : s
    ))
  }

  if (!assignmentId) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-3">
          <Sparkles size={28} className="opacity-30" />
          <p className="text-sm">과제를 게시하면 제출 현황이 여기에 표시됩니다.</p>
        </div>
      </Card>
    )
  }

  const confirmed = submissions.filter(s => s.grade_status === 'confirmed').length
  const pending = submissions.filter(s => s.grade_status === 'pending').length
  const flagged = submissions.filter(s => s.grade_status === 'flagged').length
  const avgAi = submissions.length > 0
    ? Math.round(submissions.filter(s => s.ai_score !== null).reduce((a, s) => a + (s.ai_score ?? 0), 0) / Math.max(1, submissions.filter(s => s.ai_score !== null).length))
    : 0
  const scores = submissions.map(s => s.ai_score ?? 0).filter(Boolean)

  return (
    <>
      <Card>
        <CardHeader
          title="AI 자동 채점 현황 및 교수 검토"
          subtitle={`전체 ${submissions.length}명 제출 · 확정 ${confirmed}명 · 대기 ${pending}명 · 요주의 ${flagged}명`}
          actions={
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={fetchSubmissions} disabled={loading}>
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> 새로고침
              </Button>
              {submissions.length > 0 && (
                <>
                  <Button variant="success" size="sm" onClick={bulkApprove}>
                    <CheckCircle2 size={13} /> 일괄 승인
                  </Button>
                  <Button variant={notified ? 'ghost' : 'outline'} size="sm" onClick={() => { setNotified(true); setTimeout(() => setNotified(false), 3000) }}>
                    <Bell size={13} /> {notified ? '공지 완료!' : '성적 공지'}
                  </Button>
                </>
              )}
            </div>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center h-24 text-slate-400">
            <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-400 gap-2">
            <p className="text-sm">아직 제출된 과제가 없습니다.</p>
          </div>
        ) : (
          <>
            <div className="flex gap-3 mb-4">
              <StatCard label="AI 평균" value={`${avgAi}점`} color="blue" />
              <StatCard label="최고점" value={scores.length ? `${Math.max(...scores)}점` : '—'} color="green" />
              <StatCard label="최저점" value={scores.length ? `${Math.min(...scores)}점` : '—'} color="red" />
              <StatCard label="확정 완료율" value={submissions.length ? `${Math.round(confirmed / submissions.length * 100)}%` : '—'} color="amber" />
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['학생', 'AI 점수', '교수 확정', '상태', 'AI 피드백 요약', '액션'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-700 text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s, idx) => (
                    <tr key={s.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${idx === submissions.length - 1 ? 'border-b-0' : ''}`}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Avatar name={s.student_name} />
                          <div>
                            <div className="text-sm font-600 text-slate-800">{s.student_name}</div>
                            <div className="text-xs text-slate-400">{s.student_number}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {s.ai_score !== null
                          ? <span className="text-sm font-700 text-indigo-600">{s.ai_score}점</span>
                          : <span className="text-slate-300 text-sm">채점 중</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {s.confirmed_score !== null
                          ? <span className="text-sm font-700 text-emerald-600">{s.confirmed_score}점</span>
                          : <span className="text-slate-300 text-sm">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={statusConfig[s.grade_status].variant}>
                          {s.grade_status === 'flagged' && <Flag size={9} />}
                          {statusConfig[s.grade_status].label}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 max-w-[220px]">
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{s.feedback_short ?? '—'}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => openModal(s)}
                          className="text-xs font-600 text-indigo-600 hover:text-indigo-800 px-2.5 py-1 rounded-md hover:bg-indigo-50 transition-colors"
                        >
                          {s.grade_status === 'confirmed' ? '수정' : '검토 →'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={`${modal?.student_name} · 채점 검토`}
        subtitle={`학번 ${modal?.student_number} · 제출 ${modal?.submitted_at ? new Date(modal.submitted_at).toLocaleDateString('ko-KR') : ''} · ${modal?.word_count?.toLocaleString()}자`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setModal(null)}>취소</Button>
            <Button size="sm" onClick={saveModal} disabled={saving}>
              {saving
                ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> 저장 중...</>
                : <><CheckCircle2 size={13} /> 저장 및 확정</>
              }
            </Button>
          </>
        }
      >
        {modal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-600 text-slate-500 mb-1.5">AI 제안 점수</label>
                <input
                  value={modal.ai_score !== null ? `${modal.ai_score}점` : '—'}
                  disabled
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-600 text-slate-500 mb-1.5">교수 확정 점수 *</label>
                <input
                  value={editScore}
                  onChange={e => setEditScore(e.target.value)}
                  type="number"
                  min="0" max="100"
                  className="w-full px-3 py-2 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-800"
                />
              </div>
            </div>

            {modal.rubric_scores && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                <div className="text-xs font-700 text-slate-500 mb-2">루브릭별 점수</div>
                {modal.rubric_scores.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 truncate flex-1">{r.rubric_text}</span>
                    <span className={`font-700 ml-2 flex-shrink-0 ${r.score === r.max_pts ? 'text-emerald-600' : r.score >= r.max_pts * 0.8 ? 'text-indigo-600' : 'text-amber-600'}`}>
                      {r.score}/{r.max_pts}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {parseInt(editScore) - (modal.ai_score ?? 0) !== 0 && editScore && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  AI 점수와 {Math.abs(parseInt(editScore) - (modal.ai_score ?? 0))}점 차이가 납니다. 학생에게 조정 사유가 안내됩니다.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-600 text-slate-500 mb-1.5">AI 피드백 (수정 가능)</label>
              <textarea
                value={editFeedback}
                onChange={e => setEditFeedback(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700 leading-relaxed resize-none"
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
