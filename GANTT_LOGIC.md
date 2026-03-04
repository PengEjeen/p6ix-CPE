# Gantt / 병행 로직 정리 (현재 코드 기준)

이 문서는 `frontend/src/components/cpe` 간트 구현의 **현재 동작**을 정리한다.
핵심 변경점은 `parallel_segments` 도입으로, 병행 위치 정보를 저장하면서도 테이블 반영률 입력을 유지하는 것이다.

## 1) 핵심 원칙

- 화살표(링크/CP 연결) 판정 로직은 기존 구조를 유지한다.
- 병행의 진짜 소스는 `parallel_segments`(위치 구간)이다.
- `front_parallel_days`, `back_parallel_days`, `application_rate`는 `parallel_segments`에서 파생되는 값이다.
- 테이블에서 `application_rate`를 바꾸면 위치 정보는 **오른쪽 병행(right-aligned)** 으로 생성된다.
- 간트에서 병행을 만들면 위치 정보(`parallel_segments`)까지 함께 저장된다.

## 2) 주요 데이터 필드

- `calendar_days`: 바 길이(전체 작업 기간)
- `_startDay`: 수동 이동 시작일
- `parallel_segments`: 병행 구간 배열(작업 시작 기준 상대좌표)
  - 예: `[{ start: 0, end: 2.5 }, { start: 6, end: 8 }]`
- `front_parallel_days`: 작업 앞쪽 연속 병행 길이(파생값)
- `back_parallel_days`: 작업 뒤쪽 연속 병행 길이(파생값)
- `application_rate`: `(criticalDays / duration) * 100` 파생값

## 3) 공통 유틸 (병행 계산의 단일 기준)

- 파일: `frontend/src/utils/parallelSegments.js`
- 주요 함수:
  - `normalizeParallelSegments`: 구간 정규화/병합
  - `getParallelSegmentsFromItem`: 아이템에서 병행 구간 추출(`parallel_segments` 우선, 없으면 front/back fallback)
  - `deriveParallelMeta`: 구간 -> `parallelDays`, `criticalDays`, `applicationRate`, `front/back` 파생
  - `buildRightAlignedParallelSegments`: 반영률 입력값을 오른쪽 병행 구간으로 변환
  - `buildParallelStateFromSegments`: 저장 상태(`parallel_segments`, `front/back`, `application_rate`) 생성
  - `buildCriticalSegmentsFromParallel`: 병행 구간을 제외한 CP 구간 리스트 생성

## 4) 편집 흐름

### 4.1 테이블에서 반영률 수정

- 입력 위치: `frontend/src/components/cpe/schedule/ScheduleTableRow.jsx`
- 처리: `frontend/src/stores/scheduleStore.js` -> `updateItem`
- 동작:
  1. 일반 계산(`calculateItem`) 수행
  2. `application_rate` 수정인 경우 `buildRightAlignedParallelSegments(duration, rate)` 적용
  3. 결과를 `parallel_segments`, `front_parallel_days`, `back_parallel_days`, `application_rate`로 동기화

즉, 테이블 반영률은 “오른쪽 병행” 의미를 가진다.

### 4.2 간트에서 병행 확정

- 파일: `frontend/src/components/cpe/GanttChart.jsx`
- 위치: `OverlapResolvePopover`의
  - `onSelectCurrentAsCP`
  - `onSelectOtherAsCP`
- 동작:
  1. 기존 front/back 판정 로직으로 update 후보 생성
  2. 겹친 구간 interval 수집
  3. `applyRatesToUpdates`에서 `buildParallelStateFromSegments`로
     - `application_rate`
     - `parallel_segments`
     를 업데이트 payload에 함께 주입
  4. `resolveDragOverlap` 원자 업데이트

## 5) Store 반영 규칙

- 파일: `frontend/src/stores/scheduleStore.js`
- `resolveDragOverlap` 우선순위:
  1. `update.parallel_segments`가 있으면 이를 최우선으로 저장/파생
  2. 없고 `front/back`만 있으면 암시 구간으로 `parallel_segments` 재구성
  3. `update.application_rate` 명시 시 그 값 우선
  4. 그 외에는 front/back 기반 fallback 계산

- `updateParallelPeriods`도 `parallel_segments`를 함께 동기화한다.

## 6) 렌더/CP 계산 규칙

### 6.1 간트 배치/자동 시작일

- 파일: `frontend/src/components/cpe/ganttUtils.js`
- `getParallelSegmentsFromItem` + `deriveParallelMeta` 사용
- 자동 시작일: `startDay = cumulativeCPEnd - frontParallel`
- CP 끝: `cpEnd = clamp(taskEnd - backParallel)`

### 6.2 바 색상 분할

- 파일: `frontend/src/components/cpe/SmartGanttBar.jsx`
- 입력:
  - 빨강 경계: `redStartDay`, `redEndDay`
  - 회색 구간: `greySegments`
- `application_rate`로 직접 빨강 끝을 자르지 않고,
  실제 병행 구간(`greySegments`)을 기준으로 분할 표시한다.

### 6.3 화면용 유효 구간 계산

- 파일: `frontend/src/components/cpe/GanttChartArea.jsx`
- `getEffectiveRedRange`가 반환:
  - `parallelSegments`(절대좌표)
  - `criticalSegments`(병행 제외 CP 조각)
  - `redStart`, `redEnd`
- 스냅/충돌도 `criticalSegments` 기준으로 판단한다.

### 6.4 CP 화살표 레이어

- 파일: `frontend/src/components/cpe/gantt/ui/CriticalPathLayer.jsx`
- 병행 전체 작업은 CP 연결에서 제외
- CP 후보 판정은 `parallel_segments` 기반 파생값으로 계산
- 다음 CP 탐색 및 detour 렌더 구조는 기존 방식 유지

## 7) 부공종(Subtask) 제약

- 파일:
  - `frontend/src/components/cpe/GanttChartArea.jsx`
  - `frontend/src/components/cpe/gantt/ui/SubtaskLayer.jsx`
- 규칙:
  - 같은 부모 내 부공종 겹침 금지
  - 부모의 CP 구간(`criticalSegments`)과 겹침 금지

## 8) 총공기/요약 계산

- 파일: `frontend/src/utils/scheduleCalculations.js`
- `parallel_segments` 기반 파생값(`front/back`)을 사용해
  총 기간/critical id 계산을 수행한다.

## 9) 링크(화살표) 로직 범위

- 링크 타입/생성/렌더/편집 자체는 기존 유지
- 관련 파일:
  - `frontend/src/components/cpe/gantt/controllers/linkController.js`
  - `frontend/src/components/cpe/gantt/ui/LinkLayer.jsx`
  - `frontend/src/components/cpe/gantt/ui/LinkEditorPopover.jsx`

## 10) 유지보수 가이드

- 병행 규칙 변경 시 1순위 수정 파일:
  - `frontend/src/utils/parallelSegments.js`
- 간트 확정 payload 변경 시:
  - `frontend/src/components/cpe/GanttChart.jsx`
  - `frontend/src/stores/scheduleStore.js`
- 화면 표현 변경 시:
  - `frontend/src/components/cpe/GanttChartArea.jsx`
  - `frontend/src/components/cpe/SmartGanttBar.jsx`
  - `frontend/src/components/cpe/gantt/ui/CriticalPathLayer.jsx`

## 11) 주의사항

- `solver.calculateItem`은 여전히 `application_rate`를 일정 계산 입력으로 사용한다.
- 따라서 병행 변경은 `parallel_segments`와 `application_rate`를 함께 동기화해야 정합성이 유지된다.
- 현재 구현은 이 동기화를 Store 레이어에서 보장한다.
