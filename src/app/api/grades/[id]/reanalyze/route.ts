import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getSession } from '@/lib/session'
import { getOptionalEnv } from '@/lib/env'

interface RubricScore {
  rubric_text: string
  max_pts: number
  score: number
  reason: string
}

// Groq를 활용해 교수 피드백을 반영한 루브릭별 점수 재조정
async function reanalyzeWithGroq(
  instructorFeedback: string,
  currentRubrics: RubricScore[],
  submissionText: string,
): Promise<{ rubric_scores: RubricScore[]; feedback_short: string; isRateLimit?: boolean } | null> {
  const apiKey = getOptionalEnv('GROQ_API_KEY')
  if (!apiKey) return null

  // 현재 루브릭 점수 현황 텍스트
  const currentSummary = currentRubrics
    .map(r => `  - ${r.rubric_text}: ${r.score}/${r.max_pts}점 — ${r.reason}`)
    .join('\n')

  // AI 응답 템플릿 (rubric_text, max_pts는 고정)
  const rubricTemplate = currentRubrics
    .map(r => `    { "rubric_text": "${r.rubric_text.replace(/"/g, "'")}", "max_pts": ${r.max_pts}, "score": <0~${r.max_pts} 정수>, "reason": "<한국어 1~2문장>" }`)
    .join(',\n')

  const prompt = `당신은 대학 과제 채점을 보조하는 AI입니다.
교수님이 기존 AI 채점 결과를 검토하고 피드백/지시사항을 남겼습니다.
교수님의 피드백을 최대한 반영하여 루브릭별 점수와 평가 근거를 재조정해 주세요.

## 교수님의 피드백 및 지시사항
${instructorFeedback}

## 현재 루브릭별 AI 점수 (참고)
${currentSummary}

## 학생 제출물 (일부)
${submissionText.slice(0, 2000)}${submissionText.length > 2000 ? '\n[... 이하 생략]' : ''}

위 교수님의 피드백을 최우선으로 반영하여 각 루브릭 항목의 점수와 평가 이유를 조정하세요.
점수는 반드시 0 이상 만점(max_pts) 이하 정수여야 합니다.
JSON 형식으로만 응답하세요 (마크다운 코드블록 없이):
{
  "rubric_scores": [
${rubricTemplate}
  ],
  "feedback_short": "<교수 피드백을 반영한 최종 피드백 요약 2~3문장>"
}`

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // model: 'llama-3.3-70b-versatile',
        model: 'llama-3.1-8b-instant', // 모델 하향 조정 (토큰 효율 및 속도 개선)
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      if (res.status === 429) return { rubric_scores: [], feedback_short: '', isRateLimit: true }
      console.error('[reanalyze] Groq 오류:', res.status)
      return null
    }

    const data = await res.json()
    const raw: string = data.choices[0].message.content.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    return JSON.parse(jsonMatch[0]) as { rubric_scores: RubricScore[]; feedback_short: string }
  } catch (err) {
    console.error('[reanalyze] Groq 호출 실패:', err)
    return null
  }
}

// POST /api/grades/[id]/reanalyze
// 교수 피드백을 바탕으로 AI가 루브릭별 점수를 재조정해 반환 (DB 저장 없음, 미리보기용)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession(req)
  if (!session || session.role !== 'instructor') {
    return NextResponse.json({ error: 'Instructor only' }, { status: 403 })
  }

  const body = await req.json()
  const { instructor_feedback } = body as { instructor_feedback?: string }

  if (!instructor_feedback?.trim()) {
    return NextResponse.json({ error: '피드백 내용을 입력하세요.' }, { status: 400 })
  }

  // 성적 및 제출물 조회
  const grade = db.prepare(`
    SELECT g.id, g.rubric_scores, s.content AS submission_content
    FROM grades g
    JOIN submissions s ON s.id = g.submission_id
    WHERE g.id = ?
  `).get(params.id) as {
    id: string
    rubric_scores: string | null
    submission_content: string | null
  } | undefined

  if (!grade) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const currentRubrics: RubricScore[] = grade.rubric_scores
    ? JSON.parse(grade.rubric_scores)
    : []

  if (currentRubrics.length === 0) {
    return NextResponse.json({ error: '루브릭 점수 데이터가 없습니다.' }, { status: 400 })
  }

  // AI 재분석 시도
  const aiResult = await reanalyzeWithGroq(
    instructor_feedback,
    currentRubrics,
    grade.submission_content ?? '',
  )

  // Rate Limit 발생 시 429 상태 코드로 응답 (에러 핸들링 보완)
  if (aiResult?.isRateLimit) {
    return NextResponse.json({ error: 'AI 분석 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' }, { status: 429 })
  }
  if (!aiResult) {
    return NextResponse.json({ error: 'AI 재분석에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 503 })
  }

  // max_pts 및 rubric_text 원본 값으로 보정 (AI가 잘못된 값 반환 방지)
  const corrected: RubricScore[] = (aiResult.rubric_scores ?? currentRubrics).map((r, i) => ({
    rubric_text: currentRubrics[i]?.rubric_text ?? r.rubric_text,
    max_pts: currentRubrics[i]?.max_pts ?? r.max_pts,
    score: Math.min(
      currentRubrics[i]?.max_pts ?? r.max_pts,
      Math.max(0, Math.round(r.score)),
    ),
    reason: r.reason ?? '',
  }))

  return NextResponse.json({
    rubric_scores: corrected,
    feedback_short: aiResult.feedback_short ?? instructor_feedback,
  })
}
