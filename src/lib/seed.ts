/**
 * 서버 시작 시 데모 계정이 없으면 자동으로 생성합니다.
 * API route 또는 db.ts에서 import해서 사용하세요.
 */
import db from './db'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const DEMO_USERS = [
  {
    id: 'demo_instructor',
    name: '이채점',
    email: 'prof@gradelens.kr',
    password: 'demo1234',
    role: 'instructor' as const,
    department: '컴퓨터공학과',
    student_id: null,
  },
  {
    id: 'demo_student',
    name: '김민준',
    email: 'student@gradelens.kr',
    password: 'demo1234',
    role: 'student' as const,
    department: '컴퓨터공학과',
    student_id: '20210342',
  },
]

const DEMO_ASSIGNMENTS = [
  {
    id: 'demo_asgn_1',
    title: '소프트웨어 요구사항 명세서 작성',
    description: '제공된 요구사항을 바탕으로 SRS 문서를 작성하세요. IEEE 830 표준을 참고하여 기능 요구사항과 비기능 요구사항을 구분하여 서술하고 유스케이스 다이어그램을 포함하세요.',
    course: '소프트웨어 공학 (CS3421)',
    deadline: '2026-05-10T23:59:00',
    instructor_id: 'demo_instructor',
  },
  {
    id: 'demo_asgn_2',
    title: '설계 패턴 분석 보고서',
    description: 'GoF 디자인 패턴 중 3가지를 선택하여 각 패턴의 구조, 장단점, 실제 활용 사례를 분석하는 보고서를 작성하세요.',
    course: '소프트웨어 공학 (CS3421)',
    deadline: '2026-05-25T23:59:00',
    instructor_id: 'demo_instructor',
  },
  {
    id: 'demo_asgn_3',
    title: 'SQL 쿼리 최적화 실습',
    description: '주어진 데이터베이스 스키마에서 비효율적인 쿼리를 분석하고 인덱스 설계, 쿼리 재작성 등의 방법으로 최적화하세요. EXPLAIN 결과를 첨부하여 성능 개선 전후를 비교하세요.',
    course: '데이터베이스 (CS3312)',
    deadline: '2026-04-28T23:59:00',
    instructor_id: 'demo_instructor',
  },
  {
    id: 'demo_asgn_4',
    title: 'AI 윤리 사례 분석 보고서',
    description: '최근 AI 기술 적용 사례 중 윤리적 문제가 발생한 사례를 2가지 이상 선정하여 분석하고, 각 사례에서 발생한 윤리적 문제점과 해결 방안을 제시하세요. A4 5매 이상, 참고 문헌 10개 이상 필수.',
    course: 'AI 윤리학 (CS4892)',
    deadline: '2026-05-05T23:59:00',
    instructor_id: 'demo_instructor',
  },
  {
    id: 'demo_asgn_5',
    title: 'AI 편향성 분석 및 개선 방안',
    description: '머신러닝 모델에서 발생할 수 있는 데이터 편향 유형(성별, 인종, 연령 등)을 조사하고, 각 편향 유형별 실제 사례와 기술적·제도적 개선 방안을 서술하세요.',
    course: 'AI 윤리학 (CS4892)',
    deadline: '2026-06-01T23:59:00',
    instructor_id: 'demo_instructor',
  },
]

const DEMO_RUBRICS: { assignment_id: string; text: string; pts: number; category: string; sort_order: number }[] = [
  // 소프트웨어 공학 과제 1
  { assignment_id: 'demo_asgn_1', text: '요구사항 구조화 및 분류 (기능/비기능)', pts: 30, category: 'structure', sort_order: 0 },
  { assignment_id: 'demo_asgn_1', text: '유스케이스 다이어그램 정확성', pts: 25, category: 'logic', sort_order: 1 },
  { assignment_id: 'demo_asgn_1', text: '문서 형식 및 가독성 (IEEE 830 준수)', pts: 25, category: 'format', sort_order: 2 },
  { assignment_id: 'demo_asgn_1', text: '참고 자료 및 표준 활용', pts: 20, category: 'reference', sort_order: 3 },
  // 소프트웨어 공학 과제 2
  { assignment_id: 'demo_asgn_2', text: '패턴 구조 이해도 및 설명 정확성', pts: 35, category: 'logic', sort_order: 0 },
  { assignment_id: 'demo_asgn_2', text: '실제 사례 적용 타당성', pts: 35, category: 'logic', sort_order: 1 },
  { assignment_id: 'demo_asgn_2', text: '보고서 구성 및 가독성', pts: 30, category: 'readability', sort_order: 2 },
  // 데이터베이스 과제
  { assignment_id: 'demo_asgn_3', text: '쿼리 최적화 정확성 및 효율성', pts: 40, category: 'logic', sort_order: 0 },
  { assignment_id: 'demo_asgn_3', text: 'EXPLAIN 결과 분석 및 성능 비교', pts: 35, category: 'logic', sort_order: 1 },
  { assignment_id: 'demo_asgn_3', text: '결과 설명 명확성 및 문서화', pts: 25, category: 'readability', sort_order: 2 },
  // AI 윤리학 과제 1
  { assignment_id: 'demo_asgn_4', text: '사례 선정 적절성 및 분석 깊이', pts: 35, category: 'logic', sort_order: 0 },
  { assignment_id: 'demo_asgn_4', text: '윤리적 관점 이해 및 논리성', pts: 35, category: 'logic', sort_order: 1 },
  { assignment_id: 'demo_asgn_4', text: '참고 자료 인용 (10개 이상)', pts: 20, category: 'reference', sort_order: 2 },
  { assignment_id: 'demo_asgn_4', text: '분량 및 형식 요건 (A4 5매 이상)', pts: 10, category: 'format', sort_order: 3 },
  // AI 윤리학 과제 2
  { assignment_id: 'demo_asgn_5', text: '편향 유형 분류 정확성', pts: 30, category: 'structure', sort_order: 0 },
  { assignment_id: 'demo_asgn_5', text: '사례 조사 충실도', pts: 30, category: 'reference', sort_order: 1 },
  { assignment_id: 'demo_asgn_5', text: '개선 방안 창의성 및 실현 가능성', pts: 25, category: 'logic', sort_order: 2 },
  { assignment_id: 'demo_asgn_5', text: '논리적 서술 및 가독성', pts: 15, category: 'readability', sort_order: 3 },
]

let seeded = false

export async function seedDemoUsers() {
  if (seeded) return
  seeded = true

  for (const u of DEMO_USERS) {
    const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(u.id)
    if (!exists) {
      const hashed = await bcrypt.hash(u.password, 10)
      db.prepare(`
        INSERT INTO users (id, name, email, password, role, department, student_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(u.id, u.name, u.email, hashed, u.role, u.department, u.student_id)
      console.log(`[seed] 데모 계정 생성: ${u.email}`)
    }
  }

  // 데모 과제 시드 (instructor 생성 후)
  for (const a of DEMO_ASSIGNMENTS) {
    const exists = db.prepare('SELECT id FROM assignments WHERE id = ?').get(a.id)
    if (!exists) {
      db.prepare(`
        INSERT INTO assignments (id, title, description, course, deadline, instructor_id, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(a.id, a.title, a.description, a.course, a.deadline, a.instructor_id)

      const rubrics = DEMO_RUBRICS.filter(r => r.assignment_id === a.id)
      for (const r of rubrics) {
        db.prepare(`
          INSERT INTO rubric_items (id, assignment_id, text, pts, category, sort_order)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(randomUUID(), r.assignment_id, r.text, r.pts, r.category, r.sort_order)
      }
      console.log(`[seed] 데모 과제 생성: ${a.title}`)
    }
  }
}
