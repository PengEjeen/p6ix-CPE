# ScheduleMasterList Frontend QA Report

- 작성일: `2026-03-20`
- 대상: `frontend/src/pages/ScheduleMasterList.jsx` 및 연관 훅/스토어
- 수행 방식: PM 분배 기반 병렬 검토(`planner`, `reviewer`, `documentation`) + 메인 세션 실행 검증
- 판정: `CONDITIONAL FAIL`

## 1. 범위

### In Scope
- ScheduleMasterList 테이블/간트 전환, 편집, 선택, 삭제, 저장
- 카테고리(Run Rate/이름변경/이동/삭제) 동작
- Start Date 변경, AI 조정 패널 진입 흐름
- 데이터 로드/초기화/fallback 로직

### Out of Scope
- 백엔드 로직 정확성 자체 검증
- 실브라우저 수동 E2E(네트워크 실패 주입 포함) 실행
- 성능 부하/모바일 디바이스 실측

## 2. 실행 결과

| 항목 | 명령 | 결과 | 비고 |
|---|---|---|---|
| 자동 테스트 | `cd frontend && npm test` | `FAIL` | `No test files found` |
| 빌드 검증 | `cd frontend && npm run build` | `PASS` | 번들 크기 경고(`~1.1MB chunk`) |

## 3. 핵심 Findings (심각도 순)

### F-01. 부분 저장 실패가 성공으로 표시됨
- 심각도: `High`
- 근거:
  - `Promise.allSettled`로 일정/작업조건 저장을 병렬 처리함.
  - 둘 중 하나만 성공해도 성공 토스트 출력.
  - 참고: `frontend/src/pages/ScheduleMasterList.jsx:1153`, `frontend/src/pages/ScheduleMasterList.jsx:1179`
- 사용자 영향:
  - 실제로 일부 데이터가 저장 실패해도 사용자는 전체 저장 성공으로 오인할 수 있음.

### F-02. 카테고리 Run Rate 변경이 즉시 계산 반영에 불일치 가능
- 심각도: `High`
- 근거:
  - 핸들러는 `work_week_days`만 낙관 업데이트 후 API 성공 응답을 store 전체에 반영하지 않음.
  - 계산은 `operating_rate` 우선값을 사용함.
  - 참고: `frontend/src/pages/ScheduleMasterList.jsx:633`, `frontend/src/stores/scheduleStore.js:55`, `frontend/src/utils/solver.js:33`
- 사용자 영향:
  - 드롭다운 값은 바뀌는데 `Cal Day`/총 공기가 기대대로 즉시 반영되지 않을 위험.

### F-03. 대공종명 변경 시 rate rename 실패 rollback 없음
- 심각도: `High`
- 근거:
  - UI와 로컬 rate 키를 먼저 바꾸고 성공 토스트 출력 후, rate rename API 실패 시 원복 없음.
  - 참고: `frontend/src/pages/ScheduleMasterList.jsx:888`, `frontend/src/pages/ScheduleMasterList.jsx:901`, `frontend/src/pages/ScheduleMasterList.jsx:907`
- 사용자 영향:
  - 일정 데이터와 운영률 키 불일치가 누적될 수 있음.

### F-04. Start Date 저장이 fire-and-forget
- 심각도: `Medium`
- 근거:
  - 날짜 변경 시 `setStartDate` 후 `updateProject`를 `await/catch` 없이 호출.
  - 참고: `frontend/src/pages/ScheduleMasterList.jsx:1625`, `frontend/src/pages/ScheduleMasterList.jsx:1628`
- 사용자 영향:
  - 실패해도 화면상 변경이 유지되어 서버 상태와 불일치할 수 있음.

### F-05. 일정 조회 실패가 빈 데이터로 삼켜짐
- 심각도: `Medium`
- 근거:
  - 조회 API 예외 시 throw 대신 `{ items: [] }` 반환.
  - 로더는 이를 “빈 일정”으로 해석해 초기화/로컬 fallback 분기로 이동.
  - 참고: `frontend/src/api/cpe_all/construction_schedule.js:6`, `frontend/src/api/cpe_all/construction_schedule.js:30`, `frontend/src/hooks/useScheduleData.js:72`
- 사용자 영향:
  - 네트워크 실패와 실제 빈 상태를 구분하기 어려움.

## 4. 우선순위 테스트 시나리오 (Planner 정리본 반영)

1. 초기 진입/재진입/초기화 fallback 검증(P1)
2. 행 편집 후 계산 즉시 반영 및 Esc 원복(P1)
3. 저장 성공/부분실패/재로딩 일관성(P1)
4. 다중 선택/삭제/단축키 충돌(P1)
5. 카테고리 이름 변경/Run Rate 변경/이동/삭제(P2)
6. DnD 재정렬 및 Undo/Redo 무결성(P2)
7. 테이블-간트 동기화 및 sub task 정합성(P2)
8. 표준품셈/근거데이터/층별생성 보조 플로우(P3)
9. AI 조정 실행/비교/적용/취소(P3)

## 5. 테스트 공백

- 프론트 자동 테스트 케이스 부재(`vitest` 실행 불가 상태).
- 특히 아래 회귀 시나리오에 대한 보호장치 없음:
  - 저장 부분 실패 처리
  - Run Rate 변경 즉시 재계산
  - 대공종 rename 실패 rollback
  - Start Date 저장 실패 처리

## 6. 권장 조치

1. 저장 결과를 `전체 성공 / 부분 성공 / 전체 실패`로 분리 표기.
2. Run Rate 변경 성공 응답을 store에 재반영하거나 계산 입력값 일관성 정리.
3. 대공종 rename 실패 시 items/rates 동시 rollback.
4. Start Date 저장을 `await/catch` 처리하고 실패 시 사용자 피드백 + 원복.
5. 최소 smoke 테스트(저장/Run Rate/rename/Start Date)부터 `vitest` 또는 E2E로 추가.

## 7. 최종 결론

- 현재 상태는 `빌드 가능`이나, 사용자 데이터 신뢰성에 직접 영향을 주는 `High` 이슈가 있어 `CONDITIONAL FAIL`.
- 운영 반영 전 최소한 F-01 ~ F-03 재검증 권장.
