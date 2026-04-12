import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

const SYSTEM_PROMPT = `당신은 GradeLens의 AI 성적 문의 어시스턴트입니다.
대학교 과제 채점, 루브릭 기준, 피드백, 성적 향상 방법에 대해 친절하고 전문적으로 안내합니다.
학생의 질문에 구체적이고 실용적인 답변을 제공하되, 다음 원칙을 따르세요:
1. 채점 기준(논리력, 자료활용도, 가독성, 창의성, 형식준수)에 근거하여 설명
2. 개선 방법을 구체적으로 제안
3. 따뜻하고 격려적인 톤 유지
4. 한국어로만 답변
5. 답변은 간결하게 (2~4문장 내외)
6. 필요 시 번호 목록이나 체크박스(✅ ⚠️)를 활용해 가독성 높이기`

function getRuleBasedResponse(input: string): string {
  const lower = input.toLowerCase()
  if (lower.includes('자료') || lower.includes('인용')) {
    return '자료활용도 항목에서는 참고 문헌의 수(10개 이상), 1차 자료 비중(50% 이상 권장), APA 형식 준수 여부를 종합 평가합니다.\n\n1차 자료(학술 논문, 정부 보고서)를 늘리면 점수가 향상됩니다!'
  }
  if (lower.includes('창의') || lower.includes('독창')) {
    return '창의성 항목은 기존 연구를 단순 요약하는 것이 아니라, 학습자만의 독자적 관점과 새로운 연결고리를 제시하는지를 평가합니다.\n\n비판적 분석과 독창적 관점을 강화해 보세요!'
  }
  if (lower.includes('형식') || lower.includes('분량')) {
    return '형식 요건은 A4 5매 이상, 참고 문헌 10개 이상, 글자 크기·여백 등 제출 가이드라인 준수 여부를 채점합니다.\n\n제목 페이지와 APA 형식을 완벽히 갖추면 만점이 가능합니다!'
  }
  if (lower.includes('피드백') || lower.includes('요약')) {
    return '피드백 핵심 요약:\n① 구조가 명확한지 확인\n② 반론-재반박 구조를 추가하면 논리력 점수 향상\n③ 참고 자료를 다양하게 활용하면 자료활용도 상승\n\n다음 과제에서도 화이팅입니다!'
  }
  if (lower.includes('논리') || lower.includes('주장') || lower.includes('근거')) {
    return '논리력 점수를 높이려면 각 본론 단락에 **주제문 → 근거 → 반론 → 재반박 → 소결론** 구조를 명시적으로 작성하세요.\n\n주장과 근거의 연결성이 핵심입니다!'
  }
  if (lower.includes('가독성') || lower.includes('문장') || lower.includes('문체')) {
    return '가독성을 높이려면 긴 문장을 2개로 나누고, 단락마다 명확한 주제문을 배치하세요.\n\n수동태(~이 분석되었다) 대신 능동태(본 논문은 ~을 분석했다)를 사용하면 +2점 가능합니다!'
  }
  return '채점 기준에 따라 해당 항목을 분석했습니다. 더 구체적인 내용이 궁금하시면 항목 이름(논리력, 자료활용도, 가독성, 창의성, 형식준수)을 포함해서 질문해 주세요!'
}

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { message, history = [] } = body as {
    message: string
    history: { role: 'bot' | 'user'; text: string }[]
  }

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ reply: getRuleBasedResponse(message) })
  }

  // 최근 6개 메시지만 컨텍스트로 사용
  const contextMessages = history.slice(-6).map(m => ({
    role: m.role === 'bot' ? 'assistant' : 'user',
    content: m.text,
  }))

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...contextMessages,
    { role: 'user', content: message },
  ]

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 500,
        temperature: 0.7,
        messages,
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      console.error('[chat] Groq error:', await res.text())
      return NextResponse.json({ reply: getRuleBasedResponse(message) })
    }

    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content?.trim() ?? getRuleBasedResponse(message)
    return NextResponse.json({ reply })
  } catch (e) {
    console.error('[chat] fetch error:', e)
    return NextResponse.json({ reply: getRuleBasedResponse(message) })
  }
}
