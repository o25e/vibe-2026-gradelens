"""
GradeLens AI Grading Agent — 통합 테스트 스크립트
==================================================

이 스크립트는 아래 3가지 테스트를 순차적으로 실행합니다:

  Test 1: RubricExtractor — 예시 강의평가계획서에서 루브릭 추출
  Test 2: GradingEngine   — 추출된 루브릭으로 예시 과제 채점
  Test 3: /grade API      — 실행 중인 FastAPI 서버 엔드포인트 호출 (서버 가동 시)

실행 방법:
  # 환경변수 설정 (Windows PowerShell)
  $env:ANTHROPIC_API_KEY = "sk-ant-..."

  # 패키지 설치 후 실행
  pip install -r requirements.txt
  python test_grading.py

  # 서버 API 테스트도 포함하려면 (다른 터미널에서 먼저 서버 가동)
  uvicorn main:app --port 8000
  python test_grading.py --api
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import textwrap
from typing import Any

import anthropic

# ─────────────────────────────────────────────────────────────────────────────
# 예시 데이터
# ─────────────────────────────────────────────────────────────────────────────

SAMPLE_SYLLABUS = """
[2026년 1학기 글로벌경영학과 비즈니스 글쓰기 강의계획서]

과목명: 비즈니스 글쓰기 (Business Writing)
담당 교수: 김교수
학점: 3학점

■ 중간고사 과제: ESG 경영 전략 보고서 작성 (100점 만점)

【평가 항목 및 배점】

1. 논리적 구성 및 주장의 타당성 (30점)
   - 우수(27~30점): 서론-본론-결론이 유기적으로 연결되고, 주장을 뒷받침하는 논거가 3개 이상 체계적으로 제시됨.
   - 양호(21~26점): 전체 구조는 갖추었으나 일부 논거가 약하거나 연결이 자연스럽지 않음.
   - 보통(15~20점): 기본 구조는 있으나 주장과 논거 간 연결이 불명확함.
   - 미흡(0~14점): 구조가 없거나 논리적 흐름이 거의 없음.

2. 자료 조사 및 인용 (25점)
   - 우수(23~25점): 신뢰할 수 있는 학술 자료나 통계를 5개 이상 올바른 형식으로 인용함.
   - 양호(18~22점): 자료 3~4개를 인용했으나 형식이 불완전하거나 출처가 일부 불명확함.
   - 보통(13~17점): 자료 1~2개만 인용하거나 출처 표기가 미흡함.
   - 미흡(0~12점): 자료 인용이 없거나 인용 형식이 매우 부적절함.

3. 분석의 깊이 및 창의성 (25점)
   - 우수(23~25점): 단순 요약을 넘어 독창적인 관점과 심층 분석이 돋보임. 실제 기업 사례와 연계하여 구체적인 전략을 제안함.
   - 양호(18~22점): 분석이 있으나 피상적이거나 일반적인 수준에 머무름.
   - 보통(13~17점): 주로 요약 수준이며 독자적 분석이 부족함.
   - 미흡(0~12점): 분석이 없고 자료의 단순 나열에 그침.

4. 글쓰기 형식 및 가독성 (20점)
   - 우수(18~20점): APA 7th edition 형식 준수, 문장이 간결하고 명확하며 분량(3,000자 이상) 충족.
   - 양호(14~17점): 형식 대부분 준수하나 소폭 오류가 있거나 분량이 2,500~2,999자임.
   - 보통(10~13점): 형식 오류가 여러 곳이고 분량이 2,000~2,499자임.
   - 미흡(0~9점): 형식 준수 없음, 분량 2,000자 미만.
"""

SAMPLE_SUBMISSION = """
ESG 경영 전략이 기업 지속가능성에 미치는 영향 분석

서론

현대 기업 환경에서 ESG(Environmental, Social, Governance) 경영은 선택이 아닌 필수 전략으로 자리잡고 있다.
2015년 파리 협정 이후 기후 위기에 대한 국제적 인식이 높아지면서, 투자자와 소비자 모두 기업의 ESG 성과를
중요한 의사결정 기준으로 삼기 시작했다. 본 보고서는 ESG 경영 전략이 기업의 장기 지속가능성 및 재무 성과에
미치는 영향을 분석하고, 국내 기업이 취해야 할 실질적인 전략 방향을 제시한다.

본론

1. ESG와 재무 성과의 연관성

Friede et al.(2015)의 메타 분석 연구(2,200개 이상의 논문 검토)에 따르면, ESG 성과와 기업의 재무 성과 간에는
약 90%의 사례에서 비부정적(non-negative) 관계가 확인되었다. 이는 ESG 투자가 단기 비용이 아닌 장기 가치
창출 전략임을 시사한다. 또한 MSCI(2022) 보고서는 ESG 등급이 높은 기업의 5년 누적 주가 수익률이 하위
기업 대비 평균 2.1% 높다고 분석했다(MSCI ESG Research, 2022).

2. 국내 ESG 선도 기업 사례: SK하이닉스

SK하이닉스는 2021년부터 '넷제로(Net Zero) 2050' 로드맵을 수립하고 반도체 생산 공정의 탄소 집약도를
2030년까지 2020년 대비 50% 감축하는 목표를 설정했다. 구체적으로는 폐수 재활용률 95% 달성, 재생에너지
전력 사용 비율 100% 전환을 추진 중이다. 이 같은 환경 투자는 단기적으로 CAPEX 부담을 증가시키지만,
글로벌 공급망에서의 지속적인 파트너십 유지와 ESG 연계 채권 발행을 통한 저금리 자금 조달 기회를 제공한다.

3. ESG 공시 의무화와 기업 전략 방향

2024년부터 EU의 CSRD(Corporate Sustainability Reporting Directive)가 단계적으로 시행되면서, 유럽 시장에
진출한 국내 기업들은 ESG 공시를 의무적으로 이행해야 한다. PwC(2023) 조사에 따르면 글로벌 CEO의 70%가
ESG 규제 강화를 향후 3년 내 가장 큰 사업 리스크 요인 중 하나로 꼽았다. 이에 대응하기 위한 핵심 전략으로는
(1) 탄소 회계 시스템 내재화, (2) 공급망 ESG 실사 체계 구축, (3) 이해관계자 참여(Stakeholder Engagement)
강화가 제시된다(Porter & Kramer, 2011).

결론

ESG 경영은 단기 비용이 아닌 장기 경쟁력의 원천이다. 본 보고서에서 살펴본 바와 같이, ESG 성과와 재무 성과
간에는 유의미한 양의 관계가 존재하며, SK하이닉스 사례는 구체적인 실행 경로를 보여준다. 국내 기업들은
규제 대응 차원을 넘어, ESG를 핵심 경영 철학으로 내재화하고 이를 혁신과 성장의 드라이버로 활용해야 한다.
특히 탄소 중립 전환 과정에서 발생하는 'Transition Risk'를 관리하면서도 새로운 친환경 시장 기회를 선점하는
이중 전략이 필요하다.

참고문헌
- Friede, G., Busch, T., & Bassen, A. (2015). ESG and financial performance. Journal of Sustainable Finance, 5(4).
- MSCI ESG Research. (2022). Foundations of ESG Investing.
- PwC. (2023). Global CEO Survey.
- Porter, M. E., & Kramer, M. R. (2011). Creating Shared Value. Harvard Business Review.
"""


# ─────────────────────────────────────────────────────────────────────────────
# 출력 헬퍼
# ─────────────────────────────────────────────────────────────────────────────

def _section(title: str) -> None:
    width = 70
    print(f"\n{'=' * width}")
    print(f"  {title}")
    print(f"{'=' * width}")


def _ok(msg: str) -> None:
    print(f"  [OK] {msg}")


def _fail(msg: str) -> None:
    print(f"  [FAIL] {msg}", file=sys.stderr)


def _print_rubric(rubric: Any) -> None:
    print(f"\n  과제명: {rubric.assignment_title}")
    print(f"  총점:   {rubric.total_points}점")
    print(f"  항목 수: {len(rubric.criteria)}개\n")
    for c in rubric.criteria:
        print(f"  [{c.criteria_id}] {c.name} ({c.max_points}점)")
        print(f"      → {c.description}")
        print(f"      우수: {c.grade_levels.excellent[:60]}...")


def _print_report(report: Any) -> None:
    review_mark = " [검토 필요]" if report.has_review_items else ""
    print(f"\n  학생: {report.student_name}")
    print(f"  점수: {report.total_score}/{report.max_score}점 ({report.percentage}%)")
    print(f"  상태: {report.grade_status}{review_mark}")
    print(f"  전체 확신도: {report.overall_confidence:.1%}\n")

    print("  ── 항목별 채점 ─────────────────────────────")
    for item in report.item_scores:
        flag = " ⚠ 검토 필요" if item.review_required else ""
        print(f"  [{item.criteria_name}]")
        print(f"    점수: {item.awarded_points}/{item.max_points}  확신도: {item.confidence:.1%}{flag}")
        print(f"    근거: \"{item.evidence[:80]}...\"" if len(item.evidence) > 80
              else f"    근거: \"{item.evidence}\"")
        if item.review_required and item.review_note:
            print(f"    검토사유: {item.review_note}")
        print()

    print("  ── CoT 요약 ─────────────────────────────────")
    print(textwrap.fill(report.chain_of_thought, width=68, initial_indent="  ", subsequent_indent="  "))

    print("\n  ── 강점 ─────────────────────────────────────")
    for s in report.strengths:
        print(f"  + {s}")

    print("\n  ── 개선점 ───────────────────────────────────")
    for i in report.improvements:
        print(f"  - {i}")

    print("\n  ── 학생 피드백 ──────────────────────────────")
    print(textwrap.fill(report.feedback_short, width=68, initial_indent="  ", subsequent_indent="  "))

    print("\n  ── 레이더 점수 ──────────────────────────────")
    for key, val in report.radar_scores.items():
        bar = "█" * (val // 10) + "░" * (10 - val // 10)
        print(f"  {key:8s} {bar} {val}")


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: RubricExtractor
# ─────────────────────────────────────────────────────────────────────────────

def test_rubric_extractor(client: anthropic.Anthropic):
    from grading_agent import RubricExtractor

    _section("Test 1: RubricExtractor — 강의평가계획서 → 루브릭 추출")

    extractor = RubricExtractor(client)
    print("  Claude Sonnet으로 루브릭 추출 중...")

    rubric = extractor.extract(SAMPLE_SYLLABUS)

    # 검증
    assert rubric.assignment_title, "과제명이 비어 있음"
    assert rubric.total_points > 0, "총점이 0임"
    assert len(rubric.criteria) > 0, "평가 항목이 없음"
    total_from_items = sum(c.max_points for c in rubric.criteria)
    assert total_from_items == rubric.total_points, (
        f"항목 배점 합({total_from_items})이 총점({rubric.total_points})과 불일치"
    )

    _ok(f"루브릭 추출 성공 — 항목 {len(rubric.criteria)}개, 총점 {rubric.total_points}점")
    _print_rubric(rubric)
    return rubric


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: GradingEngine
# ─────────────────────────────────────────────────────────────────────────────

def test_grading_engine(client: anthropic.Anthropic, rubric):
    from grading_agent import GradingEngine

    _section("Test 2: GradingEngine — Chain-of-Thought 채점")

    engine = GradingEngine(client)
    print("  Claude Sonnet으로 CoT 채점 중...")

    report = engine.grade(
        rubric=rubric,
        submission_text=SAMPLE_SUBMISSION,
        student_name="홍길동",
    )

    # 검증
    assert report.student_name == "홍길동", "학생 이름 불일치"
    assert report.total_score >= 0, "총점이 음수"
    assert report.total_score <= report.max_score, "총점이 만점 초과"
    assert len(report.item_scores) == len(rubric.criteria), "항목 수 불일치"
    assert all(0.0 <= i.confidence <= 1.0 for i in report.item_scores), "확신도 범위 오류"
    assert report.chain_of_thought, "CoT 요약이 비어 있음"

    _ok(f"채점 성공 — {report.total_score}/{report.max_score}점 ({report.percentage}%)")
    _print_report(report)
    return report


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: FastAPI /grade 엔드포인트 (서버가 실행 중일 때만)
# ─────────────────────────────────────────────────────────────────────────────

def test_api_endpoint(base_url: str = "http://localhost:8000"):
    try:
        import requests
    except ImportError:
        print("  [SKIP] `requests` 패키지가 없어 API 테스트를 건너뜁니다.")
        print("         pip install requests")
        return

    _section("Test 3: FastAPI /grade 엔드포인트 호출")

    # Health check
    try:
        r = requests.get(f"{base_url}/health", timeout=3)
        r.raise_for_status()
        _ok(f"서버 응답: {r.json()}")
    except Exception as e:
        print(f"  [SKIP] 서버에 연결할 수 없습니다 ({base_url}): {e}")
        print("         uvicorn main:app --port 8000 으로 서버를 먼저 실행해주세요.")
        return

    # /grade 호출 (syllabus_text 자동 추출 방식)
    print("  /grade 엔드포인트 호출 중...")
    payload = {
        "syllabus_text": SAMPLE_SYLLABUS,
        "submission_text": SAMPLE_SUBMISSION,
        "student_name": "API 테스트 학생",
    }
    r = requests.post(f"{base_url}/grade", json=payload, timeout=60)

    if r.status_code != 200:
        _fail(f"HTTP {r.status_code}: {r.text[:300]}")
        return

    data = r.json()
    assert "total_score" in data, "total_score 없음"
    assert "item_scores" in data, "item_scores 없음"
    assert "chain_of_thought" in data, "chain_of_thought 없음"

    _ok(f"/grade 성공 — {data['total_score']}/{data['max_score']}점")
    print(f"  상태: {data['grade_status']}")
    print(f"  전체 확신도: {data['overall_confidence']:.1%}")
    print(f"  검토 필요: {'있음' if data['has_review_items'] else '없음'}")
    print("\n  응답 JSON (일부):")
    print(json.dumps({
        "total_score": data["total_score"],
        "max_score": data["max_score"],
        "percentage": data["percentage"],
        "grade_status": data["grade_status"],
        "overall_confidence": data["overall_confidence"],
        "has_review_items": data["has_review_items"],
        "feedback_short": data["feedback_short"],
        "radar_scores": data["radar_scores"],
    }, ensure_ascii=False, indent=4))


# ─────────────────────────────────────────────────────────────────────────────
# 진입점
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="GradeLens AI Grading Agent 테스트")
    parser.add_argument(
        "--api",
        action="store_true",
        help="FastAPI /grade 엔드포인트 테스트도 실행 (서버 가동 필요)",
    )
    parser.add_argument(
        "--api-url",
        default="http://localhost:8000",
        help="FastAPI 서버 URL (기본: http://localhost:8000)",
    )
    args = parser.parse_args()

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("[ERROR] ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.", file=sys.stderr)
        print("  PowerShell: $env:ANTHROPIC_API_KEY = 'sk-ant-...'")
        print("  bash:       export ANTHROPIC_API_KEY='sk-ant-...'")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    errors: list[str] = []

    print("\n  GradeLens AI Grading Agent — 통합 테스트")
    print(f"  모델: claude-sonnet-4-6\n")

    try:
        rubric = test_rubric_extractor(client)
    except Exception as e:
        _fail(f"Test 1 실패: {e}")
        errors.append(f"Test 1: {e}")
        rubric = None

    if rubric:
        try:
            test_grading_engine(client, rubric)
        except Exception as e:
            _fail(f"Test 2 실패: {e}")
            errors.append(f"Test 2: {e}")

    if args.api:
        try:
            test_api_endpoint(args.api_url)
        except Exception as e:
            _fail(f"Test 3 실패: {e}")
            errors.append(f"Test 3: {e}")

    _section("테스트 결과")
    if errors:
        for err in errors:
            _fail(err)
        sys.exit(1)
    else:
        _ok("모든 테스트 통과!")
        if not args.api:
            print("  (API 테스트는 --api 플래그로 실행 가능)")


if __name__ == "__main__":
    main()
