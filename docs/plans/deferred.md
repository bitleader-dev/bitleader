# Deferred / Follow-up 대장

레포 내 미처리 작업 추적 정본. 완료 시 `## 대기` → `## 종결` 이동(삭제 아님).

## 대기
- [2026-07-19] E2E `카드 제목과 상세 페이지 title 동일` 테스트(detail.spec.ts) pre-existing flaky — `.repo-card:visible .first() h4` textContent timeout. main baseline에서도 동일 실패(help 도입 전부터), 첫 카드 h4 렌더 타이밍/셀렉터 문제 추정. 별도 조사 필요. (출처: help-doc-priority)
- [2026-07-19] 카드 요약(summary)의 help.md 소스 추출 경로가 MOCK/E2E로 미실증 — 모든 mock 저장소가 description 보유라 카드 요약이 description 우선(문서 추출 미도달). 코드 경로는 썸네일(동일 `markdown` 변수)로 실증됨. description 없는 HELP fixture 저장소 1개 추가 시 요약 경로까지 실증 가능. (출처: help-doc-priority, F-7 m1)

## 종결
