import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getOptionalEnv } from '@/lib/env'

// ── Types ──────────────────────────────────────────────────────────────────────
export interface AIRubricItem {
  id: number
  criteria: string     // 짧은 항목명
  description: string  // 구체적인 채점 기준 설명
  score: number        // 배점
}

export interface RubricGenerateResponse {
  total_score: number
  rubrics: AIRubricItem[]
}

// ── Prompt Builder ─────────────────────────────────────────────────────────────
function buildPrompt(text: string, totalScore: number, title?: string): string {
  return `당신은 대학교 과제 채점 기준(루브릭)을 설계하는 AI입니다.
교수가 제공한 가이드라인 텍스트를 분석해 실제 채점에 바로 쓸 수 있는 루브릭을 만들어야 합니다.

## 절대 규칙 — 아래를 어기면 처음부터 다시 하세요

### ❌ 절대 금지: 추상적·모호한 기준
- criteria: "코드 완성도", description: "코드가 완성되어 있는지 확인"
- criteria: "기능 구현",  description: "요구한 기능이 구현되어 있는지 확인"
- criteria: "과제 수행",  description: "과제를 올바르게 수행했는지 확인"
→ 이런 기준은 채점자가 판단할 수 없어 무효입니다.

### ✅ 반드시 이 수준으로 구체적으로 작성
- "f-string을 사용하세요" → criteria: "f-string 사용", description: "f'...' 구문만 인정. % 포맷·.format() 사용 시 해당 출력 0점 처리."
- "구구단 3종 출력" → criteria: "구구단 3종 포맷", description: "가로형·세로형·표 형식 각 1종씩 3가지 포맷을 모두 출력해야 만점. 1종 누락 시 n/3점 감점."
- "원의 면적 계산" → criteria: "원 면적 계산", description: "math.pi 또는 3.14159 사용, 반지름을 입력받아 π×r² 계산 후 소수점 2자리 반올림 출력."
- "예외 처리 필수" → criteria: "예외 처리", description: "try-except 블록으로 ValueError(잘못된 입력)를 반드시 처리. 예외 메시지 출력 포함 여부 확인."

### 총점 규칙
- 모든 score의 합계가 반드시 정확히 ${totalScore}점이어야 합니다.
- 텍스트에 배점이 명시되어 있으면 그 숫자를 그대로 사용하세요.
- 명시가 없으면 요구사항의 난이도·비중에 따라 합계 ${totalScore}점으로 분배하세요.

---

## 분석 대상

과제명: ${title ?? '(미입력)'}
총점: ${totalScore}점

가이드라인 텍스트:
${text.slice(0, 8000)}${text.length > 8000 ? '\n[... 이하 생략됨]' : ''}

---

## 작업 절차 (반드시 이 순서로)

**[Step 1] 구체적 요구사항 목록 추출**
가이드라인 텍스트에서 실제로 채점 가능한 구체적 행동/결과물만 번호로 나열하세요.
"잘 작성", "올바르게" 같은 주관적 표현은 제외하고 동사+명사 형태의 측정 가능한 요구만 포함하세요.

**[Step 2] 배점 계획**
Step 1에서 추출한 요구사항별로 배점을 적어 합계가 ${totalScore}점이 되는지 확인하세요.

**[Step 3] JSON 출력**
Step 1·2 결과를 아래 형식의 JSON으로 출력하세요.
반드시 \`\`\`json 코드블록 없이 순수 JSON만 출력하세요.

{
  "total_score": ${totalScore},
  "rubrics": [
    {
      "id": 1,
      "criteria": "<10자 이내 핵심 키워드>",
      "description": "<채점자가 즉시 O/X 판단 가능한 구체적 기준. 감점 조건·예외사항·판단 방법 포함. 2~4문장>",
      "score": <배점 정수>
    }
  ]
}

지금 바로 Step 1부터 시작하세요.`
}

// ── Rule-based Fallback ────────────────────────────────────────────────────────
function buildFallbackRubrics(totalScore: number, assignmentTitle: string, fileName = ''): AIRubricItem[] {
  // 1. 예시 데이터들 - 파일 이름이나 제목으로 매칭
  const SCENARIOS: Record<string, AIRubricItem[]> = {
    "프로그래밍1_과제1": [
      { id: 1, criteria: '자료형 활용', description: '문자열, 리스트, 딕셔너리 등 파이썬 자료형을 적절히 활용했는지 확인.', score: Math.round(totalScore * 0.3)},
      { id: 2, criteria: '문자열 포매팅', description: '%, format(), f-string 을 사용해 구구단을 정확히 출력했는지 확인.', score: Math.round(totalScore * 0.4) },
      { id: 3, criteria: '원의 면적 계산', description: '반지름 입력→원의 면적 계산→소수점 2자리 반올림 출력이 정확히 구현되었는지 확인.', score: totalScore - Math.round(totalScore * 0.4) - Math.round(totalScore * 0.3) },
    ],
    "사용자경험디자인_과제2": [
      { id: 1, criteria: '가설의 적절성', description: '일반적인 사용자가 당연하다고 믿는 사실을 잘 포착했는지 확인.', score: Math.round(totalScore * 0.4) },
      { id: 2, criteria: '주장의 논리성', description: '디자이너로서 타당한 수정안이나 새로운 시각을 제시하였는지 확인.', score: Math.round(totalScore * 0.3) },
      { id: 3, criteria: '아이디어의 참신성', description: '일반적인 사용자 경험을 넘어선 독창적인 대안인지 확인.', score: totalScore - Math.round(totalScore * 0.4) - Math.round(totalScore * 0.3) },
    ]
  };

  // 2. 만약 입력된 제목이나 파일명이 시나리오에 있다면 해당 루브릭 반환
  const normalize = (s: string) => s.replace(/[\s_\-·.]/g, '').toLowerCase()
  const normTitle = normalize(assignmentTitle)
  // 파일명은 확장자 제거 후 정규화
  const normFile = normalize(fileName.replace(/\.[^.]+$/, ''))
  for (const key in SCENARIOS) {
    const normKey = normalize(key)
    const matchTitle = normTitle.length >= 3 && normTitle.includes(normKey)
    const matchFile  = normFile.length  >= 3 && normFile.includes(normKey)
    if (matchTitle || matchFile) {
      return SCENARIOS[key];
    }
  }

  // 3. 매칭되는 게 없을 때만 기존의 일반적인 폴백 실행
  const weights = [0.40, 0.35, 0.25]
  const templates = [
    {
      criteria: '핵심 요구사항',
      description: '가이드라인에 명시된 필수 기능·내용이 모두 포함되어 있는지 확인. 필수 항목 1개 누락 시 해당 배점의 50% 감점, 2개 이상 누락 시 0점.',
    },
    {
      criteria: '구현 정확도',
      description: '요구사항대로 정확히 동작(또는 서술)하는지 확인. 출력 형식 오류·로직 오류·논리적 비약이 있으면 내용에 따라 감점.',
    },
    {
      criteria: '형식 및 완성도',
      description: '제출 형식(파일 형식, 분량, 헤더·주석·제목 등) 준수 여부 확인. 실행 오류·빈 제출 시 0점.',
    },
  ]

  let allocated = 0
  return templates.map((t, i) => {
    const score = i < templates.length - 1
      ? Math.round(totalScore * weights[i])
      : totalScore - allocated
    allocated += score
    return { id: i + 1, ...t, score }
  })
}

// ── Score Correction: 비례 스케일링 ───────────────────────────────────────────
// AI가 100점 기준으로 답해도, totalScore=10 이면 비율 유지하며 정확히 10점으로 맞춤
function ensureScoreSum(rubrics: AIRubricItem[], target: number): AIRubricItem[] {
  const n = rubrics.length
  if (n === 0) return rubrics

  const currentSum = rubrics.reduce((a, r) => a + r.score, 0)
  if (currentSum === target) return rubrics

  // 합이 0이거나 target이 항목 수보다 작으면 균등 분배
  if (currentSum === 0 || target < n) {
    const base = Math.floor(target / n)
    const rem = target - base * n
    return rubrics.map((r, i) => ({ ...r, score: base + (i < rem ? 1 : 0) }))
  }

  // 비례 스케일링 후 마지막 항목에서 반올림 오차 흡수
  let allocated = 0
  const scaled = rubrics.map((r, i) => {
    if (i === n - 1) {
      // 마지막 항목 = target - 지금까지 합계 (정확히 맞춤)
      return { ...r, score: Math.max(1, target - allocated) }
    }
    const s = Math.max(1, Math.round((r.score / currentSum) * target))
    allocated += s
    return { ...r, score: s }
  })

  // 마지막 항목 보정 후에도 음수가 된 경우 재분배
  if (scaled[n - 1].score < 1) {
    const base = Math.floor(target / n)
    const rem = target - base * n
    return rubrics.map((r, i) => ({ ...r, score: base + (i < rem ? 1 : 0) }))
  }

  return scaled
}

// ── API Handler ────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session || session.role !== 'instructor') {
    return NextResponse.json({ error: 'Instructor only' }, { status: 403 })
  }

  let body: { extractedText?: string; totalScore?: number; assignmentTitle?: string; fileName?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const { extractedText, totalScore, assignmentTitle, fileName } = body

  if (!extractedText?.trim()) {
    return NextResponse.json({ error: '분석할 텍스트를 입력해주세요.' }, { status: 400 })
  }
  if (!totalScore || totalScore < 1 || totalScore > 1000 || !Number.isInteger(totalScore)) {
    return NextResponse.json({ error: '총점은 1~1000 사이 정수여야 합니다.' }, { status: 400 })
  }

  const apiKey = getOptionalEnv('GROQ_API_KEY')
  if (!apiKey) {
    console.log('[rubric-generate] GROQ_API_KEY 없음 — 규칙 기반 루브릭 생성')
    const rubrics = buildFallbackRubrics(totalScore, assignmentTitle || '', fileName || '')
    return NextResponse.json({ total_score: totalScore, rubrics } satisfies RubricGenerateResponse)
  }

  try {
    console.log('[rubric-generate] Groq 호출 시작 — totalScore:', totalScore)

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2500,
        temperature: 0.2,
        // response_format 제거: 모델이 Step 1·2에서 CoT 추론 후 Step 3에서 JSON 출력하도록
        messages: [
          {
            role: 'user',
            content: buildPrompt(extractedText, totalScore, assignmentTitle),
          },
        ],
      }),
      signal: AbortSignal.timeout(35_000),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Groq HTTP ${res.status}: ${errText}`)
    }

    const data = await res.json()
    const raw: string = data.choices?.[0]?.message?.content?.trim() ?? ''
    console.log('[rubric-generate] Groq 응답 (앞 400자):', raw.slice(0, 400))

    // Step 1·2 추론 이후 Step 3 JSON 파싱
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('응답에서 JSON을 찾을 수 없습니다.')

    const parsed = JSON.parse(jsonMatch[0]) as { total_score?: number; rubrics?: AIRubricItem[] }

    if (!Array.isArray(parsed.rubrics) || parsed.rubrics.length === 0) {
      throw new Error('rubrics 배열이 비어있습니다.')
    }

    // 타입 정규화
    const normalized = parsed.rubrics.map((r, i) => ({
      id: i + 1,
      criteria: String(r.criteria ?? '').trim(),
      description: String(r.description ?? '').trim(),
      score: Number(r.score) || 0,
    }))

    // 비례 스케일링으로 총점 정합성 보장
    const rubrics = ensureScoreSum(normalized, totalScore)

    const finalSum = rubrics.reduce((a, r) => a + r.score, 0)
    console.log('[rubric-generate] 완료 — 항목 수:', rubrics.length, '총점:', finalSum, '(목표:', totalScore, ')')

    return NextResponse.json({ total_score: totalScore, rubrics } satisfies RubricGenerateResponse)

  } catch (err) {
    console.error('[rubric-generate] 오류, fallback 전환:', err)
    const rubrics = buildFallbackRubrics(totalScore, assignmentTitle || '', fileName || '')
    return NextResponse.json({ total_score: totalScore, rubrics } satisfies RubricGenerateResponse)
  }
}
