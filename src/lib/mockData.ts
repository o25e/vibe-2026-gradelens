import dummyData from '../../data/dummy.json'

export type GradeStatus = 'confirmed' | 'pending' | 'flagged'

export interface RadarMetrics {
  논리력: number
  자료활용도: number
  가독성: number
  창의성: number
  형식준수: number
}

export interface Student {
  id: number
  name: string
  studentId: string
  aiScore: number
  confirmedScore: number | null
  status: GradeStatus
  feedback: string
  radarData: RadarMetrics
  submittedAt: string
  wordCount: number
}

export interface RubricItem {
  id: number
  text: string
  pts: number
  category: 'structure' | 'logic' | 'reference' | 'readability' | 'format'
}

export interface Assignment {
  id: number
  title: string
  description: string
  deadline: string
  totalSubmissions: number
  gradedCount: number
  course: string
}

export interface ChatMessage {
  role: 'bot' | 'user' | 'professor'
  text: string
  timestamp: string   // 표시용 포맷 문자열
  createdAt?: string  // 정렬·저장용 ISO 문자열
  notifId?: string
}

export const MOCK_STUDENTS: Student[] = [
  {
    id: 1, name: '김민준', studentId: '20210342', aiScore: 88, confirmedScore: 88,
    status: 'confirmed', submittedAt: '2024-12-15 14:23', wordCount: 4820,
    feedback: '서론-본론-결론의 구조가 명확하며 논거의 일관성이 높습니다. 참고 문헌 활용이 우수하고 1차 자료 비중이 65%로 탁월합니다. 결론부에서 새로운 주장 도입은 지양하세요.',
    radarData: { 논리력: 85, 자료활용도: 90, 가독성: 88, 창의성: 75, 형식준수: 95 }
  },
  {
    id: 2, name: '이서연', studentId: '20210589', aiScore: 74, confirmedScore: null,
    status: 'pending', submittedAt: '2024-12-15 16:41', wordCount: 4210,
    feedback: '본론의 논거가 다소 약합니다. 1차 자료 활용을 늘리고 주장과 근거의 연결성을 강화하세요. 가독성은 전반적으로 양호합니다.',
    radarData: { 논리력: 70, 자료활용도: 72, 가독성: 80, 창의성: 85, 형식준수: 68 }
  },
  {
    id: 3, name: '박지호', studentId: '20200118', aiScore: 93, confirmedScore: 94,
    status: 'confirmed', submittedAt: '2024-12-14 20:05', wordCount: 5630,
    feedback: '탁월한 논리 전개와 다양한 1차 자료 인용이 돋보입니다. 창의적 관점이 인상적이며 형식 요건을 완벽히 충족합니다. 특히 반론-재반박 구조가 설득력 있습니다.',
    radarData: { 논리력: 95, 자료활용도: 91, 가독성: 90, 창의성: 94, 형식준수: 92 }
  },
  {
    id: 4, name: '최수아', studentId: '20211067', aiScore: 61, confirmedScore: null,
    status: 'flagged', submittedAt: '2024-12-15 23:58', wordCount: 3190,
    feedback: '주제에서 다소 벗어난 서술이 있습니다. 참고 문헌이 6개로 기준 미달이며 결론의 설득력이 낮습니다. 전체적인 재검토가 필요합니다.',
    radarData: { 논리력: 60, 자료활용도: 52, 가독성: 70, 창의성: 65, 형식준수: 58 }
  },
  {
    id: 5, name: '정태양', studentId: '20210731', aiScore: 79, confirmedScore: 80,
    status: 'confirmed', submittedAt: '2024-12-15 11:30', wordCount: 4990,
    feedback: '구조는 체계적이나 논거의 깊이가 다소 부족합니다. 자료 출처 표기가 불분명한 부분이 있으니 수정하세요. 전반적으로 안정적인 글쓰기입니다.',
    radarData: { 논리력: 78, 자료활용도: 75, 가독성: 82, 창의성: 70, 형식준수: 88 }
  },
  {
    id: 6, name: '한소율', studentId: '20220234', aiScore: 55, confirmedScore: null,
    status: 'pending', submittedAt: '2024-12-15 22:17', wordCount: 3050,
    feedback: '서론이 지나치게 짧고 핵심 주장이 불명확합니다. 본론 전개 시 각 단락의 주제문을 명확히 설정하세요. 분량도 기준에 미달합니다.',
    radarData: { 논리력: 52, 자료활용도: 58, 가독성: 60, 창의성: 55, 형식준수: 50 }
  },
  {
    id: 7, name: '오다은', studentId: '20210456', aiScore: 83, confirmedScore: 83,
    status: 'confirmed', submittedAt: '2024-12-13 18:44', wordCount: 5120,
    feedback: '논리 구조가 견고하며 다양한 관점을 균형 있게 제시합니다. 가독성이 매우 높고 형식 요건을 잘 준수했습니다. 창의적 주제 해석이 돋보입니다.',
    radarData: { 논리력: 82, 자료활용도: 80, 가독성: 90, 창의성: 80, 형식준수: 88 }
  },
  {
    id: 8, name: '윤재원', studentId: '20211203', aiScore: 68, confirmedScore: null,
    status: 'pending', submittedAt: '2024-12-15 19:02', wordCount: 4440,
    feedback: '개념 이해는 정확하나 자료 인용의 다양성이 부족합니다. 2차 자료 위주에서 1차 자료를 추가하면 설득력이 높아집니다. 문단 구성은 양호합니다.',
    radarData: { 논리력: 65, 자료활용도: 60, 가독성: 72, 창의성: 68, 형식준수: 75 }
  },
  {
    id: 9, name: '신채원', studentId: '20220089', aiScore: 71, confirmedScore: 72,
    status: 'confirmed', submittedAt: '2024-12-15 09:15', wordCount: 4680,
    feedback: '전반적으로 무난한 구성이나 독창적 시각이 부족합니다. 기존 연구를 단순 나열하는 수준에서 벗어나 비판적 분석을 더 강화하세요.',
    radarData: { 논리력: 72, 자료활용도: 70, 가독성: 75, 창의성: 60, 형식준수: 80 }
  },
  {
    id: 10, name: '황도윤', studentId: '20200765', aiScore: 86, confirmedScore: 86,
    status: 'confirmed', submittedAt: '2024-12-14 15:38', wordCount: 5280,
    feedback: '심도 있는 분석과 풍부한 1차 자료 활용이 인상적입니다. 가독성과 논리적 흐름이 모두 우수합니다. 소결론을 각 장에 추가하면 완성도가 더 높아질 것입니다.',
    radarData: { 논리력: 88, 자료활용도: 86, 가독성: 84, 창의성: 80, 형식준수: 90 }
  },
]

export const INITIAL_RUBRICS: RubricItem[] = dummyData.initialRubrics as RubricItem[]

export const MOCK_ASSIGNMENT: Assignment = {
  id: 1,
  title: '2024-2 AI 윤리학 최종 보고서',
  description: 'AI 기술 발전에 따른 사회적·윤리적 쟁점을 분석하고, 학습자 본인의 비판적 관점을 논리적으로 서술하시오. A4 5매 이상, 참고 문헌 10개 이상 필수.',
  deadline: '2024-12-15 23:59',
  totalSubmissions: 10,
  gradedCount: 6,
  course: 'AI 윤리학 (CS4892)'
}

export const AI_SUGGESTIONS = [
  { text: '반론 제시 및 재반박 구조', pts: 10 },
  { text: '참고 문헌 다양성 (1차 자료 비중)', pts: 10 },
  { text: '맞춤법·문법 정확도', pts: 5 },
  { text: '단락 전환의 자연스러움', pts: 10 },
  { text: '비판적 사고 표현', pts: 15 },
  { text: '소결론 및 요약 정확성', pts: 10 },
]

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    role: 'bot',
    text: '안녕하세요 김민준 님! 저는 AI 채점 어시스턴트입니다 🎓\n\n점수나 피드백에 대해 궁금한 점이 있으시면 편하게 질문해 주세요. 채점 기준에 근거하여 자세히 설명드리겠습니다.',
    timestamp: '오전 09:00'
  },
  {
    role: 'user',
    text: '논리력 점수가 왜 85점인가요?',
    timestamp: '오전 09:01'
  },
  {
    role: 'bot',
    text: '논리력 항목(30점 만점)에서 분석한 결과를 알려드릴게요:\n\n✅ 주장-근거 연결성: 28/30 (매우 우수)\n✅ 단락 구성 체계성: 27/30\n⚠️ 반론 처리: 23/30 (개선 여지 있음)\n\n3번째 단락에서 반론을 제시하셨으나 재반박이 다소 짧아 -4점이 적용되었습니다. 다음 과제에서는 반론→재반박→소결론 구조를 명시적으로 포함하시면 만점에 가까운 점수를 받으실 수 있어요!',
    timestamp: '오전 09:01'
  },
]

export const SCORE_BREAKDOWN = [
  { item: '서론-본론-결론 형식', score: 20, max: 20, note: '완벽한 구조 준수' },
  { item: '논리적 근거 타당성', score: 25, max: 30, note: '반론 처리 보완 필요' },
  { item: '참고 자료 인용', score: 22, max: 25, note: '1차 자료 비중 우수' },
  { item: '가독성 및 문장 구성', score: 13, max: 15, note: '전반적으로 양호' },
  { item: '분량 및 형식 요건', score: 8, max: 10, note: '기준 충족' },
]

export const ASSIGNMENT_HISTORY = [
  { name: '중간 보고서: AI 기초 이론', date: '10/14', score: 82, grade: 'B+', status: 'confirmed' },
  { name: '과제 2: 머신러닝 윤리 사례', date: '11/01', score: 79, grade: 'B', status: 'confirmed' },
  { name: '과제 3: 딥러닝 편향성 분석', date: '11/22', score: 85, grade: 'A-', status: 'confirmed' },
  { name: '최종 보고서: AI 윤리학', date: '12/15', score: 88, grade: 'A', status: 'confirmed' },
]

export interface FeedbackReport {
  section1: {
    summary: string
    items: { rubric: string; score: number; max: number; reason: string }[]
  }
  section2: {
    items: { action: string; impact: string; category: 'logic' | 'reference' | 'readability' | 'format' | 'structure' }[]
  }
}

export const FEEDBACK_REPORT: FeedbackReport = {
  section1: {
    summary:
      '서론-본론-결론 구조가 명확하고 논리적 일관성이 높습니다. 참고 자료 활용이 우수하나, 반론 처리 부분에서 재반박이 짧아 감점이 적용되었습니다.',
    items: [
      {
        rubric: '서론-본론-결론 형식 준수',
        score: 20, max: 20,
        reason: '3단 구조가 완벽하게 유지되었으며, 각 장의 전환이 자연스럽습니다. 서론에서 논지를 명확히 제시하고 결론에서 재확인하는 흐름이 우수합니다.',
      },
      {
        rubric: '논리적 근거 및 주장 타당성',
        score: 25, max: 30,
        reason: '주요 주장의 근거가 대체로 명확하나, 3단락 반론-재반박 구간에서 재반박 논거가 1문장으로 마무리되어 설득력이 부족합니다. 이로 인해 -5점 감점이 적용되었습니다.',
      },
      {
        rubric: '참고 자료 인용 및 출처 표기',
        score: 22, max: 25,
        reason: '총 12개 문헌 인용, 1차 자료 비중 65%(기준 50% 이상으로 우수). APA 7th 형식 적용이 2건 불완전하여 -3점이 적용되었습니다.',
      },
      {
        rubric: '가독성 및 문장 구성',
        score: 13, max: 15,
        reason: '문장이 간결하고 단락 흐름이 자연스럽습니다. 일부 수동태 남용이 감지되었으며(-2점), 용어 일관성은 양호합니다.',
      },
      {
        rubric: '분량 및 형식 요건',
        score: 8, max: 10,
        reason: 'A4 약 5.2매(기준 5매 이상 충족), 글자 크기·여백 규정 준수. 제목 페이지 형식이 미흡하여 -2점이 적용되었습니다.',
      },
    ],
  },
  section2: {
    items: [
      {
        action: '반론-재반박-소결론 구조를 각 본론 단락에 명시적으로 작성하세요.',
        impact: '논리력 +4~5점 예상',
        category: 'logic',
      },
      {
        action: '1차 자료(학술 논문·정부 보고서) 비중을 65% → 70% 이상으로 높이세요.',
        impact: '자료활용도 +3점 예상',
        category: 'reference',
      },
      {
        action: 'APA 7th 인용 형식을 완전히 적용하세요 (저자·연도·페이지 번호 모두 포함).',
        impact: '자료활용도 +3점 가능',
        category: 'reference',
      },
      {
        action: '각 장 말미에 소결론(1~2문장)을 추가하여 논지를 정리하세요.',
        impact: '가독성 +2점 예상',
        category: 'readability',
      },
      {
        action: '수동태 문장을 능동태로 전환하세요. (예: "~이 분석되었다" → "본 논문은 ~을 분석했다")',
        impact: '가독성 +2점 예상',
        category: 'readability',
      },
    ],
  },
}

export const BOT_RESPONSES: Record<string, string> = {
  default: '채점 기준에 따라 해당 항목을 분석했습니다. 더 구체적인 내용이 궁금하시면 항목 이름을 포함해서 질문해 주세요!',
  자료: '자료활용도 항목(25점 만점)에서는 참고 문헌의 수(10개 이상), 1차 자료 비중(50% 이상 권장), APA 형식 준수 여부를 종합 평가합니다. 현재 1차 자료 비중이 65%로 우수하나 일부 출처 표기가 불완전하여 감점이 있었습니다.',
  창의: '창의성 항목은 기존 연구를 단순 요약하는 것이 아니라, 학습자만의 독자적 관점과 새로운 연결고리를 제시하는지를 평가합니다. 이번 보고서에서는 AI 감시 기술과 프라이버시 권리를 연결한 분석이 특히 높은 평가를 받았습니다.',
  형식: '형식 요건은 A4 5매 이상(현재 4,820자 약 5.2매 해당), 참고 문헌 10개 이상(현재 12개), 글자 크기·여백 등 제출 가이드라인 준수 여부를 채점합니다. 모든 형식 요건을 충족하셨습니다!',
  피드백: '피드백을 요약하자면: ① 구조가 명확해 읽기 편했습니다. ② 논거가 대체로 설득력 있으나 반론 처리를 강화하세요. ③ 참고 자료를 다양하게 잘 활용했습니다. 다음 과제에서 반론-재반박 구조를 추가하면 90점 이상을 노릴 수 있습니다!',
}
