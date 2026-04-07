'use client'
import { useState } from 'react'
import { CheckCircle2, Bell, ChevronDown, Flag, AlertCircle } from 'lucide-react'
import { Button, Card, CardHeader, Badge, Avatar, Modal, StatCard } from '@/components/ui'
import type { Student, GradeStatus } from '@/lib/mockData'

const statusConfig: Record<GradeStatus, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  confirmed: { label: '확정', variant: 'success' },
  pending:   { label: '검토 대기', variant: 'warning' },
  flagged:   { label: '요주의', variant: 'danger' },
}

function ScoreCell({ score, type }: { score: number | null; type: 'ai' | 'confirmed' }) {
  if (score === null) return <span className="text-slate-300 text-sm">—</span>
  const colorClass = type === 'ai' ? 'text-indigo-600' : 'text-emerald-600'
  return <span className={`text-sm font-700 ${colorClass}`}>{score}점</span>
}

export default function GradingTable({
  students, setStudents,
}: {
  students: Student[]
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>
}) {
  const [modal, setModal] = useState<Student | null>(null)
  const [editFeedback, setEditFeedback] = useState('')
  const [editScore, setEditScore] = useState('')
  const [notified, setNotified] = useState(false)

  const confirmed = students.filter(s => s.status === 'confirmed').length
  const pending = students.filter(s => s.status === 'pending').length
  const flagged = students.filter(s => s.status === 'flagged').length
  const avgAi = Math.round(students.reduce((a, s) => a + s.aiScore, 0) / students.length)
  const avgConfirmed = Math.round(
    students.filter(s => s.confirmedScore !== null).reduce((a, s) => a + s.confirmedScore!, 0) /
    (students.filter(s => s.confirmedScore !== null).length || 1)
  )

  const openModal = (s: Student) => {
    setModal(s); setEditFeedback(s.feedback); setEditScore(String(s.confirmedScore ?? s.aiScore))
  }

  const saveModal = () => {
    if (!modal) return
    setStudents(prev => prev.map(s =>
      s.id === modal.id
        ? { ...s, feedback: editFeedback, confirmedScore: parseInt(editScore) || s.aiScore, status: 'confirmed' }
        : s
    ))
    setModal(null)
  }

  const bulkApprove = () => {
    setStudents(prev => prev.map(s => ({
      ...s,
      confirmedScore: s.confirmedScore ?? s.aiScore,
      status: s.status === 'flagged' ? 'flagged' : 'confirmed',
    })))
  }

  const notifyGrades = () => {
    setNotified(true)
    setTimeout(() => setNotified(false), 3000)
  }

  return (
    <>
      <Card>
        <CardHeader
          title="AI 자동 채점 현황 및 교수 검토"
          subtitle={`전체 ${students.length}명 · 확정 ${confirmed}명 · 대기 ${pending}명 · 요주의 ${flagged}명`}
          actions={
            <div className="flex gap-2">
              <Button variant="success" size="sm" onClick={bulkApprove}>
                <CheckCircle2 size={13} /> 일괄 승인
              </Button>
              <Button variant={notified ? 'ghost' : 'outline'} size="sm" onClick={notifyGrades}>
                <Bell size={13} /> {notified ? '공지 완료!' : '성적 공지'}
              </Button>
            </div>
          }
        />

        {/* Stats Row */}
        <div className="flex gap-3 mb-4">
          <StatCard label="AI 평균" value={`${avgAi}점`} color="blue" />
          <StatCard label="확정 평균" value={avgConfirmed ? `${avgConfirmed}점` : '—'} color="green" />
          <StatCard label="최고점" value={`${Math.max(...students.map(s => s.aiScore))}점`} color="green" />
          <StatCard label="최저점" value={`${Math.min(...students.map(s => s.aiScore))}점`} color="red" />
          <StatCard label="검토 완료율" value={`${Math.round(confirmed / students.length * 100)}%`} color="amber" />
        </div>

        {/* Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['학생', 'AI 점수', '교수 확정 점수', '상태', 'AI 피드백 요약', '액션'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-700 text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s, idx) => (
                <tr key={s.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${idx === students.length - 1 ? 'border-b-0' : ''}`}>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar name={s.name} />
                      <div>
                        <div className="text-sm font-600 text-slate-800">{s.name}</div>
                        <div className="text-xs text-slate-400">{s.studentId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5"><ScoreCell score={s.aiScore} type="ai" /></td>
                  <td className="px-3 py-2.5"><ScoreCell score={s.confirmedScore} type="confirmed" /></td>
                  <td className="px-3 py-2.5">
                    <Badge variant={statusConfig[s.status].variant}>
                      {s.status === 'flagged' && <Flag size={9} />}
                      {statusConfig[s.status].label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 max-w-[220px]">
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{s.feedback}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => openModal(s)}
                      className="text-xs font-600 text-indigo-600 hover:text-indigo-800 px-2.5 py-1 rounded-md hover:bg-indigo-50 transition-colors"
                    >
                      {s.status === 'confirmed' ? '수정' : '검토 →'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit Modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={`${modal?.name} · 채점 검토`}
        subtitle={`학번 ${modal?.studentId} · 제출 ${modal?.submittedAt} · ${modal?.wordCount.toLocaleString()}자`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setModal(null)}>취소</Button>
            <Button size="sm" onClick={saveModal}><CheckCircle2 size={13} /> 저장 및 확정</Button>
          </>
        }
      >
        {modal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-600 text-slate-500 mb-1.5">AI 제안 점수</label>
                <input
                  value={`${modal.aiScore}점`}
                  disabled
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-600 text-slate-500 mb-1.5">교수 확정 점수 *</label>
                <input
                  value={editScore}
                  onChange={e => setEditScore(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                AI 점수와 확정 점수의 차이가 5점 이상이면 학생에게 조정 사유가 자동 안내됩니다.
              </p>
            </div>

            <div>
              <label className="block text-xs font-600 text-slate-500 mb-1.5">AI 피드백 (수정 가능)</label>
              <textarea
                value={editFeedback}
                onChange={e => setEditFeedback(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700 leading-relaxed resize-none"
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
