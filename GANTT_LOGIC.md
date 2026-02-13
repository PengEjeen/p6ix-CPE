# Gantt / 병행 로직 정리

이 문서는 현재 코드 기준으로 간트차트의 핵심 흐름과 병행(겹침) 처리 로직을 빠르게 파악하기 위한 요약이다.

## 1) 주요 데이터 필드

- `calendar_days`: 작업 기간(일), 바 길이의 기준
- `_startDay`: 수동 이동된 시작일(없으면 자동 계산)
- `front_parallel_days`, `back_parallel_days`: 병행 처리로 인해 CP(빨강)에서 제외되는 앞/뒤 구간
- `remarks`: `"병행작업"` 문자열 기반 병행 플래그로도 사용됨
- `application_rate`: 반영율(현재 `solver.calculateItem`에서 `calendar_days`에 반영)

## 2) 전체 흐름(요약)

1. 테이블 편집/간트 조작 -> `useScheduleStore` 상태 변경
2. 계산은 `solver.calculateItem`/역산 함수에서 수행
3. 간트 렌더 직전 `calculateGanttItems`가 `startDay`, `durationDays`를 계산
4. `GanttChartArea`가 레이어 단위로 렌더
   - 링크 레이어
   - CP 화살표 레이어
   - 부공종 레이어
   - 바(`SmartGanttBar`)

## 3) 병행(겹침) 로직 핵심

### 3.1 겹침 감지

- 파일: `frontend/src/components/cpe/GanttChart.jsx`
- 함수: `handleBarDrag` (`:509`)
- 드래그 완료 시 이동 대상과 다른 모든 작업의 시간대 겹침을 계산해서 `overlappingTasks` 배열로 수집 (`:528`)

### 3.2 사용자 선택 팝오버

- 파일: `frontend/src/components/cpe/OverlapResolvePopover.jsx`
- 겹침이 있으면 팝오버를 띄우고 2가지 선택 제공
  - 현재 작업을 CP로 유지
  - 기존(겹친) 작업을 CP로 유지

### 3.3 병행일(front/back) 반영

- 파일: `frontend/src/components/cpe/GanttChart.jsx`
- 선택별 업데이트 생성:
  - `onSelectCurrentAsCP` (`:798`)
  - `onSelectOtherAsCP` (`:843`)
- 최종 반영:
  - `useScheduleStore.getState().resolveDragOverlap(...)` (`:837`, `:893`)

### 3.4 원자 업데이트

- 파일: `frontend/src/stores/scheduleStore.js`
- 함수: `resolveDragOverlap` (`:274`)
  - `_startDay` 업데이트
  - `front_parallel_days`, `back_parallel_days` 동시 업데이트

## 4) CP/시각화 로직

### 4.1 일정 계산(자동 시작일)

- 파일: `frontend/src/components/cpe/ganttUtils.js`
- 함수: `calculateGanttItems` (`:99`)
- 핵심 식:
  - `startDay = cumulativeCPEnd - frontParallel` (수동 시작일이 없을 때)
  - `cpEnd = startDay + duration - backParallel`

### 4.2 바 색상 분할

- 파일: `frontend/src/components/cpe/SmartGanttBar.jsx`
- `redStartDay ~ redEndDay`를 CP(빨강)로 렌더
- 나머지/포함 구간은 회색

### 4.3 CP 화살표

- 파일: `frontend/src/components/cpe/gantt/ui/CriticalPathLayer.jsx`
- 병행 작업(문자열/플래그/전구간 병행)은 CP 연결에서 제외
- 각 작업의 logical red end 기준으로 다음 CP 작업을 탐색해 화살표 렌더

## 5) 부공종(Subtask) 제약

- 파일: `frontend/src/components/cpe/GanttChartArea.jsx`, `frontend/src/components/cpe/gantt/ui/SubtaskLayer.jsx`
- 제약:
  - 같은 부모 내 다른 부공종과 겹치면 불가
  - 부모의 CP(red) 구간과 겹치면 불가
- 관련 함수:
  - `hasSubtaskOverlap` (`GanttChartArea.jsx:250`)
  - `overlapsCriticalPath` (`GanttChartArea.jsx:262`)

## 6) 링크 로직

- 생성 규칙: `frontend/src/components/cpe/gantt/controllers/linkController.js`
  - 앵커 조합으로 `FS/SS/FF/SF` 타입 결정
- 렌더: `frontend/src/components/cpe/gantt/ui/LinkLayer.jsx`
  - `lag` 값을 X축 오프셋으로 반영
- 편집: `frontend/src/components/cpe/gantt/ui/LinkEditorPopover.jsx`

## 7) 리사이즈(기간 변경) 로직

- UI: `GanttChart.jsx -> handleBarResize` (`:609`)
- 사용자가 Crew/Prod 선택: `ContextualBrainPopover`
- Store 액션:
  - `resizeTaskBar` (crew 역산)
  - `resizeTaskBarByProductivity` (prod 역산)
- 역산 함수: `frontend/src/utils/solver.js`

## 8) 반영율(application_rate) 관련

- 테이블 입력 위치: `frontend/src/components/cpe/schedule/ScheduleTableRow.jsx:232`
- 계산 반영 위치: `frontend/src/utils/solver.js:14`, `:46`
  - `calendar_days = baseCalendarDays * (application_rate / 100)`

## 9) 현재 주의 포인트

- `GanttChartArea.handleCanvasMouseDown`에서 선택 초기화 후 즉시 `return`이 있어,
  박스 선택 로직이 사실상 동작하지 않는 상태다.
  - 위치: `frontend/src/components/cpe/GanttChartArea.jsx:400`

## 10) 수정 가이드

아래는 "무엇을 바꾸고 싶을 때 어디를 수정해야 하는지"에 대한 빠른 매핑이다.

### A. 병행(겹침) 판정/적용 규칙 변경

- 겹침 감지 기준(시간대 교차):  
  `frontend/src/components/cpe/GanttChart.jsx:536`
- 병행 선택 후 front/back 계산 규칙:  
  `frontend/src/components/cpe/GanttChart.jsx:798`, `frontend/src/components/cpe/GanttChart.jsx:843`
- 실제 상태 반영(원자 업데이트):  
  `frontend/src/stores/scheduleStore.js:274`

### B. 빨강(CP)/회색(병행) 시각 규칙 변경

- 바 내부 분할 색상 규칙:  
  `frontend/src/components/cpe/SmartGanttBar.jsx:196`
- CP 화살표 생성/제외 규칙:  
  `frontend/src/components/cpe/gantt/ui/CriticalPathLayer.jsx:13`
- 병행 마커 문자열/플래그 판정 규칙:  
  `frontend/src/components/cpe/GanttChartArea.jsx:79`, `frontend/src/components/cpe/gantt/ui/CriticalPathLayer.jsx:17`

### C. 시작일 자동 계산 로직 변경

- 자동 `startDay` / `cpEnd` 계산식:  
  `frontend/src/components/cpe/ganttUtils.js:126`, `frontend/src/components/cpe/ganttUtils.js:132`
- 총 공기 계산식(헤더 표시와 AI 기준):  
  `frontend/src/utils/scheduleCalculations.js:11`

### D. 반영율(application_rate) 영향 범위 변경

- `calendar_days` 계산 반영 위치:  
  `frontend/src/utils/solver.js:46`
- 테이블 입력 필드:  
  `frontend/src/components/cpe/schedule/ScheduleTableRow.jsx:232`
- 간트 바에서 반영율 시각화 추가/변경 시 수정 위치:  
  `frontend/src/components/cpe/SmartGanttBar.jsx:196`

### E. 드래그/스냅 동작 변경

- 바 드래그 스냅 규칙:  
  `frontend/src/components/cpe/SmartGanttBar.jsx:68`
- 전체 작업 스냅 후보 생성:  
  `frontend/src/components/cpe/GanttChartArea.jsx:304`
- 부공종 스냅 후보 생성:  
  `frontend/src/components/cpe/GanttChartArea.jsx:274`

### F. 부공종 제약 변경

- 부공종끼리 겹침 금지:  
  `frontend/src/components/cpe/GanttChartArea.jsx:250`
- 부모 CP(red) 구간 침범 금지:  
  `frontend/src/components/cpe/GanttChartArea.jsx:262`
- 제약 실제 적용 지점(드래그/리사이즈):  
  `frontend/src/components/cpe/gantt/ui/SubtaskLayer.jsx:139`, `frontend/src/components/cpe/gantt/ui/SubtaskLayer.jsx:150`, `frontend/src/components/cpe/gantt/ui/SubtaskLayer.jsx:161`

### G. 링크 생성/표시/편집 변경

- 링크 타입 결정(FS/SS/FF/SF):  
  `frontend/src/components/cpe/gantt/controllers/linkController.js:1`
- 링크 경로/스타일/lag 반영:  
  `frontend/src/components/cpe/gantt/ui/LinkLayer.jsx:46`
- 링크 편집 팝오버(UI):  
  `frontend/src/components/cpe/gantt/ui/LinkEditorPopover.jsx:5`

### H. 다중 선택/그룹 이동 변경

- 그룹 이동 프리뷰 기반값 구성:  
  `frontend/src/components/cpe/gantt/controllers/dragPreview.js:1`
- 그룹 이동 업데이트 생성:  
  `frontend/src/components/cpe/gantt/utils/moveUpdates.js:1`
- 그룹 이동 처리 핸들러:  
  `frontend/src/components/cpe/GanttChart.jsx:280`, `frontend/src/components/cpe/GanttChart.jsx:289`

### I. 리사이즈 후 Crew/Prod 역산 규칙 변경

- 리사이즈 팝오버 진입:  
  `frontend/src/components/cpe/GanttChart.jsx:609`
- Crew 역산:  
  `frontend/src/utils/solver.js:70`
- Prod 역산:  
  `frontend/src/utils/solver.js:168`
- Store 반영:  
  `frontend/src/stores/scheduleStore.js:166`, `frontend/src/stores/scheduleStore.js:193`
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

## 11) 2026-02-13 변경 메모

- 원칙:
  - 병행(front/back) 판정 로직은 유지한다.
  - 반영률(`application_rate`)만 병행 구간 길이에 맞춰 계산한다.

- 파일: `frontend/src/components/cpe/GanttChart.jsx`
  - `OverlapResolvePopover` 확정 시 기존 front/back 업데이트는 그대로 사용.
  - 동시에 실제 겹침 interval을 task별로 수집하고 union 길이를 계산.
  - 공식:
    - `application_rate = (duration - parallel_union_days) / duration * 100`
  - 이 방식으로 오른쪽 병행뿐 아니라 중간/복수 병행 구간도 반영률에 반영된다.

- 파일: `frontend/src/stores/scheduleStore.js`
  - `resolveDragOverlap`에서 `application_rate`가 update payload에 있으면 우선 적용.
  - 없으면 기존 front/back 기반 계산(`deriveApplicationRateFromParallel`)을 사용.

- 간트/CP 표시 규칙 정리:
  - `application_rate`는 간트의 빨강/회색 구간을 직접 자르지 않는다.
  - 빨강/회색 구간은 병행 로직(front/back + overlap detour)으로만 결정한다.
  - 적용 파일:
    - `frontend/src/components/cpe/GanttChartArea.jsx`
    - `frontend/src/components/cpe/gantt/ui/CriticalPathLayer.jsx`
    - `frontend/src/components/cpe/gantt/ui/SubtaskLayer.jsx`
    - `frontend/src/components/cpe/SmartGanttBar.jsx`
    - `frontend/src/components/cpe/ganttUtils.js`
    - `frontend/src/utils/scheduleCalculations.js`
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
