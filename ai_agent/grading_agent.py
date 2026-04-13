"""
GradeLens AI Grading Agent — Core Logic
========================================
이 모듈은 두 가지 핵심 에이전트 컴포넌트를 제공합니다:

  1. RubricExtractor  — 강의평가계획서 텍스트를 분석하여 구조화된 루브릭 JSON으로 변환
  2. GradingEngine    — Chain-of-Thought 방식으로 과제를 채점 (인용 근거 + 확신도 + 검토 플래그 포함)
"""

from __future__ import annotations

import json
import re
from typing import Optional

from openai import OpenAI
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# 데이터 모델 (Pydantic)
# ─────────────────────────────────────────────────────────────────────────────

class GradeLevel(BaseModel):
    """각 평가 항목의 등급별 기준"""
    excellent: str = Field(description="최고 수준 (90%+): 기준 완전 충족")
    good: str      = Field(description="양호 수준 (70%+): 대체로 충족")
    fair: str      = Field(description="보통 수준 (50%+): 부분 충족")
    poor: str      = Field(description="미흡 수준 (50% 미만): 기준 미달")


class RubricCriteria(BaseModel):
    """단일 평가 항목"""
    criteria_id:  int        = Field(description="항목 고유 번호")
    name:         str        = Field(description="항목명 (예: '논리적 근거')")
    description:  str        = Field(description="이 항목이 평가하는 내용")
    max_points:   int        = Field(description="만점")
    grade_levels: GradeLevel = Field(description="등급별 기준 설명")


class Rubric(BaseModel):
    """전체 채점 루브릭"""
    assignment_title: str                = Field(description="과제명 또는 평가명")
    total_points:     int                = Field(description="총 배점")
    criteria:         list[RubricCriteria] = Field(description="평가 항목 목록")


class ItemScore(BaseModel):
    """단일 항목 채점 결과"""
    criteria_id:     int            = Field(description="항목 번호")
    criteria_name:   str            = Field(description="항목명")
    max_points:      int            = Field(description="만점")
    awarded_points:  int            = Field(description="부여 점수")
    confidence:      float          = Field(ge=0.0, le=1.0, description="AI 채점 확신도 (0~1)")
    review_required: bool           = Field(description="사람 검토 필요 여부")
    evidence:        str            = Field(description="제출물에서 직접 인용한 근거 문장")
    reasoning:       str            = Field(description="CoT 채점 사고 과정")
    review_note:     Optional[str]  = Field(None, description="검토가 필요한 이유 (review_required=True일 때)")


class GradingReport(BaseModel):
    """최종 채점 리포트 (UI 렌더링용 구조화 JSON)"""
    student_name:       str           = Field(description="학생 이름")
    assignment_title:   str           = Field(description="과제명")
    total_score:        int           = Field(description="총 획득 점수")
    max_score:          int           = Field(description="총 배점")
    percentage:         float         = Field(description="백분율 점수")
    grade_status:       str           = Field(description="상태: pending | flagged | review_required")
    overall_confidence: float         = Field(description="전체 평균 확신도")
    has_review_items:   bool          = Field(description="검토 필요 항목 존재 여부")
    item_scores:        list[ItemScore] = Field(description="항목별 채점 결과")
    chain_of_thought:   str           = Field(description="AI의 전체 사고 과정 요약")
    strengths:          list[str]     = Field(description="잘한 점 목록")
    improvements:       list[str]     = Field(description="개선점 목록")
    summary:            str           = Field(description="전체 채점 요약 (교수용)")
    feedback_short:     str           = Field(description="학생에게 보여줄 짧은 피드백")
    radar_scores:       dict[str, int] = Field(description="레이더 차트용 점수 (논리력 등 5개 축)")


# ─────────────────────────────────────────────────────────────────────────────
# 1. Rubric Extractor
# ─────────────────────────────────────────────────────────────────────────────

_RUBRIC_SYSTEM = """\
당신은 대학 강의 평가계획서를 분석하여 구조화된 채점 루브릭을 추출하는 전문가입니다.
주어진 텍스트에서 평가 항목, 배점, 등급별 기준을 정확하게 파악하여 JSON으로 변환합니다.
평가 기준이 명시적이지 않은 경우, 학술적 글쓰기의 일반 기준을 합리적으로 적용하세요.\
"""

_RUBRIC_PROMPT = """\
아래 강의 평가계획서를 분석하여 채점 루브릭을 추출해주세요.

## 평가계획서
{syllabus_text}

## 추출 규칙
1. 모든 평가 항목(criteria)을 식별하세요.
2. 각 항목의 배점(max_points)을 찾으세요. 없으면 총점 내에서 균등 배분하세요.
3. 등급별 기준(grade_levels)을 추출하거나, 없으면 합리적으로 작성하세요.
4. 총점(total_points)은 모든 항목 배점의 합과 일치해야 합니다.

## 출력 (JSON만 출력, 마크다운 코드블록 없이)
{{
  "assignment_title": "<과제명 또는 평가명>",
  "total_points": <총점 정수>,
  "criteria": [
    {{
      "criteria_id": 1,
      "name": "<평가 항목명>",
      "description": "<이 항목이 평가하는 내용>",
      "max_points": <만점>,
      "grade_levels": {{
        "excellent": "<90%+ 수준: 구체적 기준>",
        "good":      "<70%+ 수준: 구체적 기준>",
        "fair":      "<50%+ 수준: 구체적 기준>",
        "poor":      "<50% 미만: 구체적 기준>"
      }}
    }}
  ]
}}\
"""


class RubricExtractor:
    """강의평가계획서 텍스트 → 구조화된 Rubric 객체"""

    def __init__(self, client: OpenAI) -> None:
        self.client = client

    def extract(self, syllabus_text: str) -> Rubric:
        """
        평가계획서 텍스트를 Groq Llama로 분석하여 Rubric 객체를 반환합니다.

        Args:
            syllabus_text: 강의평가계획서 원문 (텍스트)
        Returns:
            Rubric: 구조화된 루브릭 객체
        Raises:
            ValueError: JSON 파싱 실패 시
        """
        prompt = _RUBRIC_PROMPT.format(syllabus_text=syllabus_text[:8000])

        response = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=2000,
            messages=[
                {"role": "system", "content": _RUBRIC_SYSTEM},
                {"role": "user", "content": prompt},
            ],
        )

        raw = response.choices[0].message.content.strip()
        json_match = re.search(r"\{[\s\S]*\}", raw)
        if not json_match:
            raise ValueError(f"루브릭 추출 실패: JSON을 찾을 수 없습니다.\n응답: {raw[:300]}")

        try:
            data = json.loads(json_match.group())
        except json.JSONDecodeError as e:
            raise ValueError(f"루브릭 JSON 파싱 오류: {e}")

        # GradeLevel 딕셔너리 → GradeLevel 객체로 변환
        for c in data.get("criteria", []):
            if isinstance(c.get("grade_levels"), dict):
                c["grade_levels"] = GradeLevel(**c["grade_levels"])

        return Rubric(**data)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Grading Engine
# ─────────────────────────────────────────────────────────────────────────────

_GRADING_SYSTEM = """\
당신은 대학교 과제를 채점하는 엄격하고 공정한 AI 채점관입니다.

[채점 원칙]
1. Chain of Thought: 점수를 바로 산출하지 말고, 먼저 루브릭 기준과 제출물을 대조 분석한 후 점수를 결정하세요.
2. 근거 인용: 반드시 제출물 본문에서 해당 점수의 근거가 되는 문장을 직접 인용하세요.
3. 확신도 평가: 채점 판단의 확실성을 0.0~1.0으로 평가하세요.
4. Human-in-the-Loop: 판단이 모호하거나 확신도가 0.7 미만이면 review_required를 true로 표시하고 그 이유를 명시하세요.\
"""

_GRADING_PROMPT = """\
다음 루브릭과 학생 제출물을 바탕으로 Chain-of-Thought 방식으로 채점해주세요.

## 과제 정보
- 과제명: {assignment_title}
- 학생: {student_name}

## 채점 루브릭 (총 {total_points}점)
{rubric_json}

## 학생 제출물
{submission_text}

---

## 채점 절차 (Chain of Thought — 항목별로 반드시 이 순서를 따르세요)

각 평가 항목(criteria)에 대해:
  STEP 1 [기준 이해]   → 이 항목이 무엇을 평가하는지 명확히 진술
  STEP 2 [제출물 분석] → 해당 기준과 관련된 내용을 제출물에서 직접 인용 (없으면 '해당 내용 없음')
  STEP 3 [등급 판단]   → excellent / good / fair / poor 중 어느 수준인지 판단 및 그 이유
  STEP 4 [점수 산출]   → 등급에 따른 점수 계산:
                          excellent → max_points × 0.95 반올림
                          good      → max_points × 0.80 반올림
                          fair      → max_points × 0.65 반올림
                          poor      → max_points × 0.40 반올림
  STEP 5 [확신도 평가] → 0.0~1.0:
                          0.9 이상: 명확한 근거 있음
                          0.7~0.89: 대체로 명확, 소폭 모호
                          0.5~0.69: 판단 어려움 → review_required=true 권장
                          0.5 미만:  판단 불가  → review_required=true 필수

## 출력 (JSON만 출력, 마크다운 코드블록 없이)
{{
  "chain_of_thought": "<전체 CoT 분석 흐름 요약, 4~6문장>",
  "item_scores": [
    {{
      "criteria_id":     <int>,
      "criteria_name":   "<항목명>",
      "max_points":      <만점>,
      "awarded_points":  <부여 점수 정수>,
      "confidence":      <0.0~1.0 소수>,
      "review_required": <true/false>,
      "evidence":        "<제출물에서 직접 인용한 문장 (큰따옴표 제외, 없으면 '해당 내용 없음')>",
      "reasoning":       "<STEP 1~5 채점 사고 과정 서술>",
      "review_note":     "<review_required=true인 경우: 왜 사람 검토가 필요한지, 아니면 null>"
    }}
  ],
  "strengths":    ["<강점 1>", "<강점 2>", "<강점 3>"],
  "improvements": ["<개선점 1>", "<개선점 2>", "<개선점 3>"],
  "summary":      "<전체 채점 결과 요약 (교수용), 2~3문장>",
  "feedback_short": "<학생에게 보여줄 짧은 격려 피드백, 2문장>",
  "radar_scores": {{
    "논리력":    <0~100 정수>,
    "자료활용도": <0~100 정수>,
    "가독성":    <0~100 정수>,
    "창의성":    <0~100 정수>,
    "형식준수":  <0~100 정수>
  }}
}}\
"""


class GradingEngine:
    """루브릭 + 제출물 → Chain-of-Thought 채점 리포트"""

    def __init__(self, client: OpenAI) -> None:
        self.client = client

    def grade(
        self,
        rubric: Rubric,
        submission_text: str,
        student_name: str = "학생",
    ) -> GradingReport:
        """
        학생 제출물을 루브릭 기준에 따라 CoT 방식으로 채점합니다.

        Args:
            rubric:          구조화된 루브릭 객체 (RubricExtractor 결과)
            submission_text: 학생 제출물 전문
            student_name:    학생 이름
        Returns:
            GradingReport: UI 렌더링용 구조화된 채점 리포트
        Raises:
            ValueError: AI 응답 파싱 실패 시
        """
        rubric_json = json.dumps(rubric.model_dump(), ensure_ascii=False, indent=2)

        prompt = _GRADING_PROMPT.format(
            assignment_title=rubric.assignment_title,
            student_name=student_name,
            total_points=rubric.total_points,
            rubric_json=rubric_json,
            submission_text=submission_text[:7000],
        )
        if len(submission_text) > 7000:
            prompt += "\n\n[※ 제출물이 길어 7000자까지만 전달되었습니다.]"

        response = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=3500,
            messages=[
                {"role": "system", "content": _GRADING_SYSTEM},
                {"role": "user", "content": prompt},
            ],
        )

        raw = response.choices[0].message.content.strip()
        json_match = re.search(r"\{[\s\S]*\}", raw)
        if not json_match:
            raise ValueError(f"채점 실패: JSON을 찾을 수 없습니다.\n응답: {raw[:300]}")

        try:
            data = json.loads(json_match.group())
        except json.JSONDecodeError as e:
            raise ValueError(f"채점 JSON 파싱 오류: {e}")

        # ItemScore 리스트 빌드
        item_scores: list[ItemScore] = []
        for item in data.get("item_scores", []):
            item_scores.append(ItemScore(
                criteria_id=int(item["criteria_id"]),
                criteria_name=item["criteria_name"],
                max_points=int(item["max_points"]),
                awarded_points=int(item["awarded_points"]),
                confidence=float(item["confidence"]),
                review_required=bool(item["review_required"]),
                evidence=item.get("evidence", "해당 내용 없음"),
                reasoning=item.get("reasoning", ""),
                review_note=item.get("review_note"),
            ))

        # 집계 계산
        total_score = sum(i.awarded_points for i in item_scores)
        max_score = rubric.total_points
        percentage = round(total_score / max_score * 100, 1) if max_score > 0 else 0.0
        avg_confidence = (
            sum(i.confidence for i in item_scores) / len(item_scores)
            if item_scores else 0.0
        )
        has_review = any(i.review_required for i in item_scores)

        # 상태 결정
        if percentage < 50:
            grade_status = "flagged"
        elif has_review or avg_confidence < 0.7:
            grade_status = "review_required"
        else:
            grade_status = "pending"

        return GradingReport(
            student_name=student_name,
            assignment_title=rubric.assignment_title,
            total_score=total_score,
            max_score=max_score,
            percentage=percentage,
            grade_status=grade_status,
            overall_confidence=round(avg_confidence, 3),
            has_review_items=has_review,
            item_scores=item_scores,
            chain_of_thought=data.get("chain_of_thought", ""),
            strengths=data.get("strengths", []),
            improvements=data.get("improvements", []),
            summary=data.get("summary", ""),
            feedback_short=data.get("feedback_short", ""),
            radar_scores=data.get("radar_scores", {}),
        )
