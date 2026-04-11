
export interface RubricItem {
  text: string
  pts: number
  category: string
}

export interface GradingInput {
  assignmentTitle: string
  assignmentDescription: string
  rubricItems: RubricItem[]
  submissionText: string
  studentName: string
}

export interface RubricScore {
  rubric_text: string
  max_pts: number
  score: number
  reason: string
}

export interface Section2Item {
  action: string
  impact: string
  category: 'logic' | 'reference' | 'readability' | 'format' | 'structure'
}

export interface GradingResult {
  total_score: number
  rubric_scores: RubricScore[]
  section1_summary: string
  section2_items: Section2Item[]
  radar_scores: {
    논리력: number
    자료활용도: number
    가독성: number
    창의성: number
    형식준수: number
  }
  feedback_short: string
}

// ── Rule-based fallback (no API key) ─────────────────────────────────────────
function simulateGrading(input: GradingInput): GradingResult {
  const text = input.submissionText
  const words = text.split(/\s+/).filter(Boolean).length
  const hasIntro = /서론|도입|들어가|배경/.test(text)
  const hasConclusion = /결론|요약|정리|마무리/.test(text)
  const hasReferences = /참고\s*문헌|출처|인용|reference/i.test(text)
  const avgSentenceLen = text.length / Math.max(1, text.split(/[.。!?]+/).length)
  const longWordRatio = text.split(/\s+/).filter(w => w.length >= 4).length / Math.max(1, words)

  const rubricScores: RubricScore[] = input.rubricItems.map(r => {
    let score = Math.round(r.pts * 0.65)
    const cat = r.category

    if (cat === 'structure') {
      if (hasIntro && hasConclusion) score = Math.round(r.pts * 0.92)
      else if (hasIntro || hasConclusion) score = Math.round(r.pts * 0.75)
    } else if (cat === 'logic') {
      const logicKeywords = /따라서|왜냐하면|근거|논거|주장|분석|비판|반론/.test(text)
      score = logicKeywords ? Math.round(r.pts * 0.82) : Math.round(r.pts * 0.64)
    } else if (cat === 'reference') {
      score = hasReferences ? Math.round(r.pts * 0.88) : Math.round(r.pts * 0.45)
    } else if (cat === 'readability') {
      const good = avgSentenceLen >= 15 && avgSentenceLen <= 45
      score = good ? Math.round(r.pts * 0.88) : Math.round(r.pts * 0.7)
    } else if (cat === 'format') {
      score = words >= 1000 ? Math.round(r.pts * 0.9) : Math.round(r.pts * 0.6)
    }
    score = Math.min(r.pts, Math.max(0, score))

    return {
      rubric_text: r.text,
      max_pts: r.pts,
      score,
      reason: score >= r.pts * 0.9
        ? `${r.text} 기준을 잘 충족했습니다.`
        : score >= r.pts * 0.7
        ? `${r.text} 기준을 대체로 충족하나 일부 보완이 필요합니다.`
        : `${r.text} 기준에서 미흡한 부분이 있어 추가 보완이 필요합니다.`,
    }
  })

  const total = rubricScores.reduce((a, r) => a + r.score, 0)
  const logicScore = Math.round(60 + longWordRatio * 30)
  const readScore = Math.round(avgSentenceLen >= 15 && avgSentenceLen <= 45 ? 80 : 65)

  return {
    total_score: total,
    rubric_scores: rubricScores,
    section1_summary: `총점 ${total}점이 부여되었습니다. ${hasIntro && hasConclusion ? '서론-본론-결론 구조가 명확합니다.' : '글의 구조를 더 명확히 구분할 필요가 있습니다.'} ${hasReferences ? '참고 자료 활용이 적절합니다.' : '참고 자료 인용이 부족합니다.'}`,
    section2_items: [
      { action: '각 단락의 시작에 주제문을 명시적으로 작성하세요.', impact: '논리력 +3~5점 예상', category: 'logic' },
      { action: hasReferences ? 'APA 7th 인용 형식을 완전히 적용하세요.' : '학술 논문과 1차 자료를 최소 8개 이상 인용하세요.', impact: '자료활용도 +4점 예상', category: 'reference' },
      { action: '긴 문장을 2개로 나누어 가독성을 높이세요.', impact: '가독성 +2점 예상', category: 'readability' },
    ],
    radar_scores: {
      논리력: Math.min(100, logicScore),
      자료활용도: hasReferences ? Math.round(total * 0.9) : Math.round(total * 0.55),
      가독성: readScore,
      창의성: Math.round(total * 0.85),
      형식준수: words >= 1000 ? 88 : 65,
    },
    feedback_short: `구조 ${hasIntro && hasConclusion ? '✓' : '△'} · 논리 ${total >= 70 ? '✓' : '△'} · 자료 ${hasReferences ? '✓' : '✗'} · 분량 ${words >= 1000 ? '✓' : '△'}. 다음 과제에서 반론-재반박 구조를 추가하면 점수가 향상될 것입니다.`,
  }
}

// ── Python AI Agent 호출 (GRADING_AGENT_URL 환경변수 설정 시) ────────────────
async function gradeViaAgent(input: GradingInput): Promise<GradingResult | null> {
  const agentUrl = process.env.GRADING_AGENT_URL
  if (!agentUrl) return null

  const rubricText = input.rubricItems
    .map((r, i) => `${i + 1}. [${r.category}] ${r.text} (${r.pts}점)`)
    .join('\n')
  const syllabus = `[과제: ${input.assignmentTitle}]\n설명: ${input.assignmentDescription}\n\n평가항목:\n${rubricText}`

  try {
    const res = await fetch(`${agentUrl}/grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        syllabus_text: syllabus,
        submission_text: input.submissionText,
        student_name: input.studentName,
        assignment_title: input.assignmentTitle,
      }),
      signal: AbortSignal.timeout(90_000),
    })
    if (!res.ok) return null

    const data = await res.json()

    // Python Agent 응답 → GradingResult 변환
    const rubricScores: RubricScore[] = (data.item_scores ?? []).map((s: {
      criteria_name: string; max_points: number; awarded_points: number;
      reasoning: string; evidence: string; review_required: boolean; review_note?: string
    }) => ({
      rubric_text: s.criteria_name,
      max_pts: s.max_points,
      score: s.awarded_points,
      reason: `${s.reasoning}\n근거: "${s.evidence}"${s.review_required ? `\n⚠ 검토 필요: ${s.review_note ?? ''}` : ''}`,
    }))

    const section2: Section2Item[] = (data.improvements ?? []).map((imp: string) => ({
      action: imp,
      impact: '점수 향상 예상',
      category: 'logic' as const,
    }))

    return {
      total_score: data.total_score,
      rubric_scores: rubricScores,
      section1_summary: data.summary ?? data.chain_of_thought ?? '',
      section2_items: section2,
      radar_scores: data.radar_scores ?? { 논리력: 70, 자료활용도: 70, 가독성: 70, 창의성: 70, 형식준수: 70 },
      feedback_short: data.feedback_short ?? '',
    }
  } catch {
    return null
  }
}

// ── Gemini AI grading ─────────────────────────────────────────────────────────
export async function gradeSubmission(input: GradingInput): Promise<GradingResult> {
  // 1순위: Python AI Agent (GRADING_AGENT_URL 설정 시)
  const agentResult = await gradeViaAgent(input)
  if (agentResult) return agentResult

  // 2순위: Groq 직접 호출 (GROQ_API_KEY 설정 시)
  const apiKey = process.env.GROQ_API_KEY
  console.log('[grading] GROQ_API_KEY 상태:', apiKey ? `설정됨 (${apiKey.slice(0, 8)}...)` : '없음 — 시뮬레이션 사용')
  if (!apiKey) {
    return simulateGrading(input)
  }

  const totalPts = input.rubricItems.reduce((a, r) => a + r.pts, 0)
  const rubricList = input.rubricItems
    .map((r, i) => `  ${i + 1}. [${r.category}] ${r.text} — ${r.pts}점 만점`)
    .join('\n')

  const prompt = `당신은 대학교 과제를 채점하는 엄격하고 공정한 AI 채점관입니다. 아래 루브릭 기준에 따라 학생 제출물을 채점하고, 반드시 지정된 JSON 형식으로만 응답하세요.

## 과제 정보
- 과제명: ${input.assignmentTitle}
- 설명: ${input.assignmentDescription}
- 학생: ${input.studentName}

## 채점 루브릭 (총 ${totalPts}점)
${rubricList}

## 학생 제출물
${input.submissionText.slice(0, 6000)}
${input.submissionText.length > 6000 ? '\n[... 이하 생략됨]' : ''}

## 응답 형식 (JSON만 출력, 마크다운 코드블록 없이)
{
  "total_score": <0~${totalPts} 사이 정수>,
  "rubric_scores": [
    {
      "rubric_text": "<루브릭 항목 텍스트 그대로>",
      "max_pts": <만점>,
      "score": <부여 점수 정수>,
      "reason": "<한국어로 1~2문장, 왜 이 점수인지 구체적으로>"
    }
  ],
  "section1_summary": "<한국어 2~3문장, 전체적인 점수 산출 근거 요약>",
  "section2_items": [
    {
      "action": "<구체적인 한국어 개선 액션 아이템>",
      "impact": "<예: 논리력 +4점 예상>",
      "category": "<logic|reference|readability|format|structure 중 하나>"
    }
  ],
  "radar_scores": {
    "논리력": <0~100 정수>,
    "자료활용도": <0~100 정수>,
    "가독성": <0~100 정수>,
    "창의성": <0~100 정수>,
    "형식준수": <0~100 정수>
  },
  "feedback_short": "<한국어 2~3문장, 학생에게 보여줄 짧은 피드백 요약>"
}`

  try {
    console.log('[grading] Groq 호출 시작 — 과제:', input.assignmentTitle)
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${await res.text()}`)

    const data = await res.json()
    const raw = data.choices[0].message.content.trim()
    console.log('[grading] Groq 응답 (앞 200자):', raw.slice(0, 200))

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in response')

    const gradeResult: GradingResult = JSON.parse(jsonMatch[0])
    const computedTotal = gradeResult.rubric_scores.reduce((a, r) => a + r.score, 0)
    gradeResult.total_score = computedTotal
    console.log('[grading] Groq 채점 완료 — 총점:', gradeResult.total_score)

    return gradeResult
  } catch (err) {
    console.error('[grading] Groq 호출 실패, 시뮬레이션으로 전환:', err)
    return simulateGrading(input)
  }
}
