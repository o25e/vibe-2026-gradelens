# AI 루브릭 생성기 (AI Rubric Generator)

2026 KIT Vibe 코딩 경진대회 출품작입니다.  
교육 현장의 채점 부담과 기준 불일치 문제를 해결하기 위해, 과제 가이드라인 기반 AI 루브릭 생성 및 AI 보조 채점 워크플로를 제공합니다.

## Live Demo

- Vercel URL: `https://<your-vercel-domain>.vercel.app`

## How to Test (심사위원 테스트 시나리오)

아래 순서대로 진행하면 핵심 기능을 빠르게 확인할 수 있습니다.

1. **샘플 파일 다운로드**
   - 교수자 화면에서 과제 가이드라인 샘플(PDF/DOCX/TXT/HWP)을 준비합니다.
2. **샘플 파일 업로드**
   - `AI 스마트 채점 기준(Rubric) 생성` 패널에서 파일을 업로드합니다.
   - 서버가 텍스트를 자동 추출합니다.
3. **AI 루브릭 자동 생성**
   - `루브릭 자동 생성` 버튼을 눌러 AI가 평가 항목/배점을 생성하는지 확인합니다.
4. **루브릭 검토 및 적용**
   - 생성된 항목을 수정/삭제/추가하고 총점 정합성을 확인한 뒤 적용합니다.
5. **학생 제출 및 AI 채점 확인**
   - 학생 계정으로 과제 제출 후 교수자 화면에서 AI 1차 채점 결과(루브릭별 근거)를 확인합니다.

## Key Features

- **AI 기반 스마트 채점 기준 수립**
  - 과제 가이드라인 텍스트를 분석해 실제 채점 가능한 루브릭(항목/설명/배점)을 자동 생성합니다.
- **교육 페인 포인트 해결**
  - 수작업 루브릭 설계 시간 단축
  - 대량 채점 시 평가 일관성 강화
  - 학생에게 점수 근거와 개선 포인트 제공
- **교수 검토 중심 워크플로**
  - AI 1차 채점 후 교수 확정/공지 단계 분리로 신뢰성과 통제력을 확보합니다.
- **서버리스 배포 안정성**
  - 환경변수 기반 설정, 타임아웃 대응 UI, 파일 BLOB 저장 방식으로 Vercel 환경에 최적화했습니다.

## Tech Stack

- **Frontend**
  - Next.js 14 (App Router), React 18, TypeScript
  - Tailwind CSS, Lucide Icons
- **Backend**
  - Next.js API Routes (Serverless Functions on Vercel)
  - Vercel Postgres (Neon 기반), JWT Session 인증
  - 파일 파싱: `pdf-parse-fork`, `mammoth`
- **AI**
  - Groq OpenAI-compatible API
  - `llama-3.3-70b-versatile` (루브릭 생성/채점/상담)
  - `llama-3.1-8b-instant` (재분석 응답 최적화)

## Notes

- 배포 시 필수 환경변수: `JWT_SECRET`, `POSTGRES_URL`
- 선택 환경변수: `GROQ_API_KEY`, `GRADING_AGENT_URL`
