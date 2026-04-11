"""
GradeLens AI Grading Agent — FastAPI 서버
==========================================

엔드포인트:
  GET  /health          — 서버 상태 확인
  POST /extract-rubric  — 강의평가계획서 텍스트 → 구조화된 루브릭 JSON
  POST /grade           — 학생 과제 채점 (루브릭 직접 제공 또는 자동 추출)

사용 예시 (Next.js에서 호출):
  const res = await fetch('http://localhost:8000/grade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ syllabus_text, submission_text, student_name })
  })
  const report = await res.json()

실행:
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import os
from typing import Optional

from openai import OpenAI
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from grading_agent import (
    GradingEngine,
    GradingReport,
    Rubric,
    RubricExtractor,
)


# ─────────────────────────────────────────────────────────────────────────────
# 앱 초기화
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="GradeLens AI Grading Agent",
    description=(
        "Chain-of-Thought 기반 AI 채점 에이전트. "
        "강의평가계획서에서 루브릭을 추출하고, 학생 과제를 항목별로 채점합니다."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — Next.js 개발 서버(3000)와 프로덕션 도메인 허용
_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    os.getenv("FRONTEND_ORIGIN", ""),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in _ALLOWED_ORIGINS if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# 공통 의존성
# ─────────────────────────────────────────────────────────────────────────────

def _get_client() -> OpenAI:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="서버에 GROQ_API_KEY가 설정되지 않았습니다.",
        )
    return OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")


# ─────────────────────────────────────────────────────────────────────────────
# 요청 / 응답 스키마
# ─────────────────────────────────────────────────────────────────────────────

class ExtractRubricRequest(BaseModel):
    syllabus_text: str = Field(
        description="강의평가계획서 원문 텍스트 (PDF에서 추출한 텍스트 포함)",
        min_length=20,
    )


class GradeRequest(BaseModel):
    # 루브릭 입력 방식 A: 사전에 추출된 루브릭 객체 직접 제공
    rubric: Optional[Rubric] = Field(
        None,
        description="/extract-rubric으로 얻은 루브릭 객체 (rubric 또는 syllabus_text 중 하나 필수)",
    )
    # 루브릭 입력 방식 B: 강의평가계획서 원문 → 서버에서 자동 추출
    syllabus_text: Optional[str] = Field(
        None,
        description="강의평가계획서 원문 (rubric이 없을 때 자동 추출에 사용)",
    )
    submission_text: str = Field(
        description="학생 과제 제출물 전문",
        min_length=10,
    )
    student_name: str = Field(
        default="학생",
        description="학생 이름 (채점 리포트에 표시됨)",
    )
    assignment_title: Optional[str] = Field(
        None,
        description="과제명 재정의 (syllabus_text 사용 시 선택 사항)",
    )


class HealthResponse(BaseModel):
    status: str
    service: str
    model: str


# ─────────────────────────────────────────────────────────────────────────────
# 엔드포인트
# ─────────────────────────────────────────────────────────────────────────────

@app.get(
    "/health",
    response_model=HealthResponse,
    summary="서버 상태 확인",
)
def health() -> HealthResponse:
    """서버가 정상 동작 중인지 확인합니다."""
    return HealthResponse(
        status="ok",
        service="GradeLens AI Grading Agent",
        model="claude-sonnet-4-6",
    )


@app.post(
    "/extract-rubric",
    response_model=Rubric,
    status_code=status.HTTP_200_OK,
    summary="강의평가계획서 → 루브릭 추출",
    description=(
        "강의평가계획서 텍스트를 Claude Sonnet으로 분석하여 "
        "항목(Criteria), 배점(Points), 등급별 기준(Description)을 포함한 "
        "구조화된 루브릭 JSON을 반환합니다."
    ),
)
def extract_rubric(req: ExtractRubricRequest) -> Rubric:
    client = _get_client()
    extractor = RubricExtractor(client)
    try:
        return extractor.extract(req.syllabus_text)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Groq API 오류: {e}",
        )


@app.post(
    "/grade",
    response_model=GradingReport,
    status_code=status.HTTP_200_OK,
    summary="학생 과제 AI 채점",
    description=(
        "루브릭과 학생 제출물을 받아 Chain-of-Thought 방식으로 채점합니다. "
        "항목별 점수, 근거 인용, 확신도(Confidence), 검토 필요 플래그(Review Required)를 "
        "포함한 구조화된 채점 리포트를 반환합니다.\n\n"
        "**루브릭 입력 방식:**\n"
        "- `rubric` 필드: `/extract-rubric`으로 사전 추출한 객체 직접 제공\n"
        "- `syllabus_text` 필드: 평가계획서 원문 제공 시 서버에서 자동 추출"
    ),
)
def grade_submission(req: GradeRequest) -> GradingReport:
    if req.rubric is None and not req.syllabus_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="`rubric` 또는 `syllabus_text` 중 하나는 반드시 제공해야 합니다.",
        )

    client = _get_client()

    # Step 1: 루브릭이 없으면 자동 추출
    rubric = req.rubric
    if rubric is None:
        extractor = RubricExtractor(client)
        try:
            rubric = extractor.extract(req.syllabus_text)  # type: ignore[arg-type]
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"루브릭 추출 실패: {e}",
            )
        except anthropic.APIError as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Claude API 오류 (루브릭 추출): {e}",
            )
        # 선택적 과제명 재정의
        if req.assignment_title:
            rubric = rubric.model_copy(update={"assignment_title": req.assignment_title})

    # Step 2: CoT 채점
    engine = GradingEngine(client)
    try:
        return engine.grade(
            rubric=rubric,
            submission_text=req.submission_text,
            student_name=req.student_name,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"채점 결과 파싱 실패: {e}",
        )
    except anthropic.APIError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Claude API 오류 (채점): {e}",
        )


# ─────────────────────────────────────────────────────────────────────────────
# 직접 실행 (개발용)
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
