import Anthropic from '@anthropic-ai/sdk'

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
  const paragraphs = text.split(/\n\n+/).filter(Boolean).length
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

// ── Claude AI grading ─────────────────────────────────────────────────────────
export async function gradeSubmission(input: GradingInput): Promise<GradingResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return simulateGrading(input)
  }

  const client = new Anthropic({ apiKey })
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

## 응답 형식 (JSON만 출력, 다른 텍스트 금지)
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
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()
    // Extract JSON even if wrapped in markdown code block
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in response')

    const result: GradingResult = JSON.parse(jsonMatch[0])

    // Validate total_score matches sum of rubric_scores
    const computedTotal = result.rubric_scores.reduce((a, r) => a + r.score, 0)
    result.total_score = computedTotal

    return result
  } catch (err) {
    console.error('[grading] AI call failed, using simulation:', err)
    return simulateGrading(input)
  }
}
