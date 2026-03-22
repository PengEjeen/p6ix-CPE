# MasterTable 편집 UX QA (저장/오류 이슈 제외)

- 작성일: `2026-03-20`
- 대상: `ScheduleMasterList` 편집 화면
- 범위: 사용자가 **실제 편집할 때 체감하는 UI/UX 불편 요소**만 정리
- 제외: 저장 실패, API 에러, 동기화 실패 같은 신뢰성 이슈

## 1) 한 줄 결론
현재 마스터테이블은 기능은 많지만, 편집 동선이 길고 조작 규칙이 숨겨져 있어 초중급 사용자가 “어디서 무엇을 어떻게 바꾸는지”를 계속 추론해야 하는 구조다.

## 2) 편집 UX 불편 요소 전수 목록

| ID | 우선순위 | 불편 요소 | 사용자 체감 | 근거(코드) |
|---|---|---|---|---|
| UX-01 | High | 테이블 고정폭이 과도하게 넓음 | 한 화면에서 행 맥락을 잃고 좌우 이동 피로 증가 | `frontend/src/pages/ScheduleMasterList.jsx:1367-1385` |
| UX-02 | High | 테이블 모드 강제 축소(`zoom: 0.85`) | 글자/입력칸이 작아져 편집 정확도 저하 | `frontend/src/pages/ScheduleMasterList.jsx:1819` |
| UX-03 | High | 가로 스크롤 사용법을 힌트로 학습해야 함 | “Shift+휠”을 모르면 데이터 탐색 난감 | `frontend/src/pages/ScheduleMasterList.jsx:1771-1773` |
| UX-04 | High | 핵심 식별 컬럼(중공종/공정/세부공종)이 본문에서 고정되지 않음 | 오른쪽 수치 편집 중 현재 행 맥락 상실 | `frontend/src/pages/ScheduleMasterList.jsx:1389-1415` |
| UX-05 | High | 체크박스 + 드래그 선택이 혼합된 모델 | 선택 로직을 이해하기 전 오조작 발생 | `frontend/src/components/cpe/schedule/ScheduleTableRow.jsx:206-217` |
| UX-06 | High | 다중 선택 드래그 이동 규칙(같은 대공종만)이 사후 토스트로만 안내 | 드롭 후 “왜 안 됐지?” 경험 반복 | `frontend/src/hooks/useDragHandlers.js:42-45`, `frontend/src/hooks/useDragHandlers.js:56-58` |
| UX-07 | High | 병합셀 편집 시 그룹 전체 동시 수정 | “한 줄만 수정” 기대와 실제 동작 불일치 | `frontend/src/components/cpe/schedule/ScheduleTableRow.jsx:263-266`, `frontend/src/components/cpe/schedule/ScheduleTableRow.jsx:302-305` |
| UX-08 | High | 카테고리 헤더 액션이 과밀(이동/추가/삭제/더보기) | 기능 발견성은 낮고 실수 클릭 위험은 높음 | `frontend/src/pages/ScheduleMasterList.jsx:1531-1655` |
| UX-09 | Medium | “더보기” 내부에 고급 기능(표준품셈/근거반영/층생성) 숨김 | 신규 사용자가 핵심 생산성 기능을 놓침 | `frontend/src/pages/ScheduleMasterList.jsx:1654-1697` |
| UX-10 | Medium | 층별 공정 생성이 `"골조"` 문자열 조건에 종속 | 왜 어떤 카테고리엔 메뉴가 안 뜨는지 불명확 | `frontend/src/pages/ScheduleMasterList.jsx:1687-1697` |
| UX-11 | Medium | 자동완성 결과 상한 40개 고정 | 대규모 데이터에서 원하는 항목 탐색 어려움 | `frontend/src/components/cpe/schedule/ScheduleTableRow.jsx:144` |
| UX-12 | Medium | 자동완성 blur 닫힘 150ms | 마우스 선택 순간 닫힘/미선택 체감 가능 | `frontend/src/components/cpe/schedule/ScheduleTableRow.jsx:166-168` |
| UX-13 | Medium | 수치 편집 필드가 매우 밀집(수량/단위작업량/투입조/반영률) | 시선 이동량이 커서 입력 실수 증가 | `frontend/src/pages/ScheduleMasterList.jsx:1404-1414`, `frontend/src/components/cpe/schedule/ScheduleTableRow.jsx:360-462` |
| UX-14 | Medium | 행 삭제가 아이콘 단추 1개에 집중 | 라벨 부족으로 파괴적 동작 인지성 낮음 | `frontend/src/components/cpe/schedule/ScheduleTableRow.jsx:481` |
| UX-15 | Medium | 상단 툴바 기능 밀집(Undo/Redo/스냅샷/StartDate/AI/엑셀/저장) | 주 작업(셀 편집) 대비 의사결정 부담 증가 | `frontend/src/components/cpe/schedule/ScheduleHeader.jsx:57-120` |
| UX-16 | Medium | 용어 혼용(한글 UI + 영문 라벨) | 인지 흐름 끊김 (`Run Rate`, `Start Date`, `Drag & Drop`) | `frontend/src/components/cpe/schedule/ScheduleHeader.jsx:33`, `frontend/src/components/cpe/schedule/ScheduleHeader.jsx:87`, `frontend/src/pages/ScheduleMasterList.jsx:1553` |
| UX-17 | Medium | 카테고리 헤더 우측 액션 바가 sticky | 스크롤 중 데이터 셀을 가리는 느낌/시각적 부담 | `frontend/src/pages/ScheduleMasterList.jsx:1568-1572` |
| UX-18 | Medium | 선택 삭제 버튼이 상단 입력/범례와 같은 줄에 공존 | “추가/편집 구역”과 “파괴 액션” 구역이 시각적으로 혼재 | `frontend/src/pages/ScheduleMasterList.jsx:1436-1475` |
| UX-19 | Medium | 편집 중 행 강조/활성 포커스 피드백이 약함 | 현재 수정 대상 추적이 어렵고 실수 편집 가능 | `frontend/src/components/cpe/schedule/ScheduleTableRow.jsx:195-203` |
| UX-20 | Low | 테이블 상단이 sticky 2단 구조(헤더 + 대공종추가줄) | 세로 작업영역이 줄어든 느낌 | `frontend/src/pages/ScheduleMasterList.jsx:1389`, `frontend/src/pages/ScheduleMasterList.jsx:1433-1434` |
| UX-21 | Low | 카테고리 이름 수정이 인라인 모드 전환 방식 | 진입/적용/취소 규칙을 모르면 흐름 중단 | `frontend/src/pages/ScheduleMasterList.jsx:1491-1523`, `frontend/src/pages/ScheduleMasterList.jsx:1531-1537` |
| UX-22 | Low | 드래그 핸들, 삭제, 더보기 아이콘 크기 작음 | 터치패드/고해상도 환경에서 클릭 정밀도 요구 | `frontend/src/pages/ScheduleMasterList.jsx:1531-1655`, `frontend/src/components/cpe/schedule/ScheduleTableRow.jsx:237-247` |
| UX-23 | Low | 행 선택 배경색/드롭 타깃 배경색 차이가 미묘함 | 선택/이동 상태 구분이 빠르게 안 됨 | `frontend/src/components/cpe/schedule/ScheduleTableRow.jsx:195` |
| UX-24 | Low | 힌트/범례 정보가 많지만 “작업 우선순위” 안내 없음 | 처음 사용자에게 무엇부터 해야 하는지 불분명 | `frontend/src/pages/ScheduleMasterList.jsx:1452-1463`, `frontend/src/pages/ScheduleMasterList.jsx:1771-1775` |
| UX-25 | High | 수치 핵심 입력(`quantity`, `productivity`, `crew_size`)이 숫자 타입 강제가 아님 | 숫자 필드에 문자/형식오입력 가능성이 커짐 | `frontend/src/components/cpe/schedule/ScheduleTableRow.jsx:388-391`, `frontend/src/components/cpe/schedule/ScheduleTableRow.jsx:400-406`, `frontend/src/components/cpe/schedule/ScheduleTableRow.jsx:415-418` |
| UX-26 | High | `application_rate`는 number지만 최소/최대 제한이 없음 | 0 미만/100 초과값 입력 시 사용자 기대와 계산 결과 괴리 가능 | `frontend/src/components/cpe/schedule/ScheduleTableRow.jsx:435-437` |
| UX-27 | Medium | 링크된 항목 생산량 입력이 비활성화되지만 “왜 잠겼는지” 설명 없음 | 사용자가 수정 불가 원인을 추론해야 함 | `frontend/src/components/cpe/schedule/ScheduleTableRow.jsx:399-406` |
| UX-28 | Medium | 링크 상태 표시가 작은 아이콘(12px)만 존재 | 연결 상태 인지가 약해 편집 우선순위 판단 어려움 | `frontend/src/components/cpe/schedule/ScheduleTableRow.jsx:332` |
| UX-29 | Medium | 표 상단에 검색/필터/열 표시 제어가 없음 | 대량 데이터에서 원하는 행을 찾는 시간이 길어짐 | `frontend/src/pages/ScheduleMasterList.jsx:1388-1417`, `frontend/src/pages/ScheduleMasterList.jsx:1436-1475` |
| UX-30 | Medium | 삭제 단축키(`Delete/Backspace`)가 테이블 전역에서 동작 | 입력 외 컨텍스트에서 실수 삭제 위험 체감 | `frontend/src/pages/ScheduleMasterList.jsx:1204-1225` |
| UX-31 | Medium | “Drag & Drop 지원, 자동 셀 병합”만 노출되고 실제 제약 조건(같은 대공종 등)은 사전 안내 없음 | 기능은 보이지만 규칙은 숨겨져 초기 시행착오 큼 | `frontend/src/components/cpe/schedule/ScheduleHeader.jsx:33`, `frontend/src/hooks/useDragHandlers.js:42-45` |
| UX-32 | Medium | 데스크톱 고정 레이아웃 성향(`h-screen`, `max-w-[2400px]`) | 노트북/소형 화면에서 편집 영역 체감이 좁음 | `frontend/src/pages/ScheduleMasterList.jsx:1788`, `frontend/src/pages/ScheduleMasterList.jsx:1790`, `frontend/src/pages/ScheduleMasterList.jsx:1818` |
| UX-33 | Low | 헤더 툴바의 기능 그룹 구분이 약함(편집/분석/출력 혼재) | 편집 집중 흐름이 자주 끊김 | `frontend/src/components/cpe/schedule/ScheduleHeader.jsx:57-110` |
| UX-34 | Low | 선택 상태/활성 상태/드롭 상태의 시각 신호가 배경색 위주 | 색 대비가 낮은 환경에서 상태 구분 난이도 증가 | `frontend/src/components/cpe/schedule/ScheduleTableRow.jsx:195` |

## 3) 사용자 테스트에서 바로 확인할 항목(편집 UX 전용)

1. 20개 이상 열이 보이는 상태에서 한 행의 오른쪽 끝(`비고`)까지 편집 후, 다시 왼쪽 식별 컬럼으로 돌아오는 데 걸리는 시간.
2. 신규 사용자가 “행 여러 개 선택해서 이동”을 처음 시도할 때, 규칙 이해까지 걸리는 시도 횟수.
3. `process/sub_process` 병합 구간에서 단일 행 수정 의도와 실제 반영 범위가 일치하는지.
4. 더보기 메뉴 안 기능(표준품셈/근거반영/층별생성)을 도움 없이 찾는 데 걸리는 시간.
5. 자동완성 리스트에서 원하는 항목 선택 성공률(마우스/키보드 각각).
6. 상단 툴바에서 저장/AI/스냅샷/엑셀의 의미를 첫 화면에서 정확히 구분하는지.
7. 수치 필드에 비정상 입력(문자, 음수, 과도한 값)을 넣었을 때 사용자가 즉시 오류를 이해하는지.
8. 소형 해상도(예: 1366x768)에서 식별 컬럼과 편집 컬럼을 왕복할 때 피로도가 급증하는지.

## 4) 즉시 개선 우선순위(코드 수정 제안 아님, UX 우선순위)

1. `가로 스크롤 의존도 축소`  
핵심 식별 컬럼 고정 + 보조 컬럼 접기/툴팁화.
2. `선택/이동 규칙 명시`  
드래그 전 단계에서 제한 조건을 UI로 사전 노출.
3. `병합셀 편집 범위 시각화`  
수정 전 “영향받는 행 수/범위” 표시.
4. `카테고리 액션 단순화`  
자주 쓰는 2~3개만 기본 노출, 나머지는 명확한 그룹화.
5. `편집 포커스 강화`  
현재 편집 셀/행, 선택 상태, 드래그 상태의 대비 강화.

## 5) Gantt 기능 의도 대비 로직 불일치 QA

- 작성일: `2026-03-20`
- 대상: `GanttChart` 편집 인터랙션
- 범위: 기능 의도 대비 실제 동작이 어긋나는 로직 이슈

| ID | 우선순위 | 의도(기대 동작) | 실제 불일치 | 사용자 체감 | 근거(코드) |
|---|---|---|---|---|---|
| G-01 | High | 빈 캔버스 드래그로 박스 선택(다중 선택) | `handleCanvasMouseDown`에서 선택 해제 직후 `return`되어 박스선택 로직이 실행되지 않음 | 드래그 선택이 “있는 줄 알았는데 안 되는” 상태 | `frontend/src/components/cpe/GanttChartArea.jsx:426-437`, `frontend/src/components/cpe/gantt/controllers/selectionBox.js:1-18` |
| G-02 | High | 다중 선택한 작업막대를 한 번에 이동 | 미리보기 단계는 `selectedItemIds.length > 1`이면 즉시 반환, 확정 단계도 다중선택이면 즉시 반환 | 다중 선택 후 바를 끌어도 이동이 안 되거나 불규칙하게 느껴짐 | `frontend/src/components/cpe/GanttChart.jsx:504-512`, `frontend/src/components/cpe/GanttChart.jsx:742-744` |
| G-03 | High | 리사이즈 중 실시간 시뮬레이션 툴팁 갱신 | 상위에서 `onBarResizing` 전달하지만 바 컴포넌트는 `onResizing`만 사용(프로퍼티명 불일치) | 드래그 중 영향값 미리보기가 안 보여 의사결정이 늦어짐 | `frontend/src/components/cpe/GanttChart.jsx:418-448`, `frontend/src/components/cpe/GanttChartArea.jsx:654`, `frontend/src/components/cpe/SmartGanttBar.jsx:15`, `frontend/src/components/cpe/SmartGanttBar.jsx:141-143` |
| G-04 | High | 겹침 팝오버에서 선택/취소에 따라 상태가 일관되게 정리 | 드래그 미리보기에서 이미 위치를 store에 반영하고, 팝오버 `onClose`는 단순 닫기만 수행(롤백 없음) | 겹침 판단을 취소해도 바 위치가 바뀐 채 남아 혼란 | `frontend/src/components/cpe/GanttChart.jsx:504-509`, `frontend/src/components/cpe/GanttChart.jsx:1024-1027` |
| G-05 | High | 드래그 정리 시 기존 병행 설정 보존 | 겹침이 해소되면 과거 겹쳤던 상대 작업의 `front/back`을 일괄 0으로 초기화 | 사용자가 수동으로 맞춘 병행값이 의도치 않게 사라질 수 있음 | `frontend/src/components/cpe/GanttChart.jsx:806-815` |
| G-06 | Medium | 월 단위 스케일에서 월 헤더/라벨이 같은 기준으로 계산 | 월 그룹은 `+30일` 기준(`unitDate`), 라벨은 `+N개월` 기준(`targetMonthDate`)으로 계산 | 월 헤더 경계와 누적일 라벨이 어긋나 가독성 저하 | `frontend/src/components/cpe/ganttUtils.js:35-38`, `frontend/src/components/cpe/ganttUtils.js:55-61` |
| G-07 | Medium | 부세부공종 그리기 미리보기와 실제 생성 길이가 일치 | 미리보기 최소 길이 1일, 실제 생성 최소 길이 0.1일 | “보인 길이”와 “저장된 길이”가 달라 조작 신뢰도 저하 | `frontend/src/components/cpe/gantt/ui/SubtaskLayer.jsx:311`, `frontend/src/components/cpe/GanttChartArea.jsx:411-414` |
| G-08 | Low | `onSmartResize` 경로가 실제 스마트 리사이즈 동작으로 연결 | 페이지→패널→차트로 전달되지만 차트 내부에서 사용되지 않음 | 기능 기대와 코드 구조가 불일치해 유지보수/확장 시 혼선 | `frontend/src/pages/ScheduleMasterList.jsx:1772-1773`, `frontend/src/components/cpe/schedule/ScheduleGanttPanel.jsx:9-10`, `frontend/src/components/cpe/schedule/ScheduleGanttPanel.jsx:33-34`, `frontend/src/components/cpe/GanttChart.jsx:164-165` |
| G-09 | High | 바 드래그 후 마우스업에서 이동/클릭이 정확히 구분되어야 함 | 드래그 중 갱신한 `hasMoved`, `tempStartDay`를 state로 저장하지만 마우스업 핸들러는 클로저 state를 즉시 참조 | 드래그했는데 클릭처럼 처리되거나 확정 로직이 누락될 가능성 큼 | `frontend/src/components/cpe/SmartGanttBar.jsx:61-69`, `frontend/src/components/cpe/SmartGanttBar.jsx:93-103` |
| G-10 | High | 좌측 목록과 우측 타임라인의 세로 위치가 항상 동기화되어야 함 | 좌/우가 각각 독립 스크롤 컨테이너이고, 동기화는 클릭 시 보정만 수행 | 휠 스크롤 후 좌우 행이 어긋나 현재 선택 행 파악이 어려움 | `frontend/src/components/cpe/GanttChart.jsx:892-914`, `frontend/src/components/cpe/GanttChart.jsx:344-400` |
| G-11 | Medium | 목록 행 높이와 차트 행 높이는 동일 기준이어야 함 | 사이드바 행은 `60px`, 차트 행은 `h-11(44px)`로 다름 | 동일 행 대응이 직관적이지 않고 스크롤 어긋남 체감이 커짐 | `frontend/src/components/cpe/GanttSidebar.jsx:127`, `frontend/src/components/cpe/SmartGanttBar.jsx:168` |
| G-12 | Medium | 데이터 길이가 크게 바뀌면 자동 스케일이 다시 계산되어야 함 | 사용자 한 번 수동 스케일 변경 시 `hasUserScaled=true` 고정, 이후 자동스케일 재계산이 영구 비활성화 | AI 적용/항목 증감 후에도 화면 밀도 최적화가 자동으로 복구되지 않음 | `frontend/src/components/cpe/GanttChart.jsx:199`, `frontend/src/components/cpe/GanttChart.jsx:453`, `frontend/src/components/cpe/gantt/hooks/useAutoScale.js:14-26` |
| G-13 | Low | 그룹 드래그 확정 경로가 명확히 살아 있어야 함 | `onGroupDragPreview`가 있으면 `onGroupDrag` 확정 경로가 실행되지 않는 구조 | 미리보기와 확정 책임이 분리되지 않아 유지보수 시 회귀 위험 증가 | `frontend/src/components/cpe/gantt/ui/SubtaskLayer.jsx:174-179`, `frontend/src/components/cpe/GanttChartArea.jsx:611-613` |

## 6) 빠른 재현 체크리스트 (Gantt)

1. 빈 영역 드래그로 여러 바를 선택해본다. (`G-01`)
2. 여러 행 선택 후 바를 드래그해 그룹 이동이 되는지 확인한다. (`G-02`)
3. 바 리사이즈 중 툴팁이 실시간으로 따라오는지 확인한다. (`G-03`)
4. 겹침 팝오버를 띄운 뒤 닫기만 했을 때 상태가 원복되는지 본다. (`G-04`)
5. 병행값이 있는 작업을 겹쳤다가 빼서 병행값이 보존되는지 확인한다. (`G-05`)
6. 스케일 `월별(30)`에서 월 헤더와 누적 라벨이 일치하는지 본다. (`G-06`)
7. 부세부공종을 아주 짧게 그렸을 때 미리보기 길이와 저장 길이가 같은지 본다. (`G-07`)
8. 작업막대를 실제로 드래그한 뒤 클릭으로 오인되지 않는지 반복 확인한다. (`G-09`)
9. 우측 차트만 휠 스크롤했을 때 좌측 목록 행 대응이 유지되는지 본다. (`G-10`, `G-11`)
10. 스케일을 수동 변경한 뒤 데이터 길이를 크게 바꿔 자동 스케일이 재동작하는지 본다. (`G-12`)
11. 그룹 이동(행 선택 후 부세부공종 드래그)에서 확정 동작이 일관적인지 본다. (`G-13`)

## 7) 테이블-간트 연동 관점 QA (같은 데이터로 함께 쓰는 시나리오)

- 작성일: `2026-03-20`
- 대상: `ScheduleMasterList`의 `table ↔ gantt` 데이터 연동
- 범위: 두 화면이 “같은 데이터를 본다”는 사용자 기대 기준에서의 불일치

| ID | 우선순위 | 의도(기대 동작) | 실제 불일치 | 사용자 체감 | 근거(코드) |
|---|---|---|---|---|---|
| TG-01 | High | 테이블과 간트가 동일 데이터셋을 바라봐야 함 | 테이블은 `items(store)` 기반, 간트는 `aiDisplayItems(aiPreview 또는 items)` 기반으로 분기 | 같은 프로젝트인데 화면마다 값이 다르게 보여 신뢰도 하락 | `frontend/src/pages/ScheduleMasterList.jsx:36`, `frontend/src/pages/ScheduleMasterList.jsx:262-283`, `frontend/src/pages/ScheduleMasterList.jsx:1767-1770`, `frontend/src/hooks/useAIScheduleOptimizer.js:323` |
| TG-02 | High | 사용자가 간트에서 보는 값이 저장 대상과 일치해야 함 | 저장 API는 `items/links/subTasks(store)`만 전송, `aiDisplayItems`는 저장 경로에 직접 반영되지 않음 | “보이는 값 저장” 기대와 실제 저장값 괴리 가능 | `frontend/src/pages/ScheduleMasterList.jsx:1399-1433`, `frontend/src/hooks/useAIScheduleOptimizer.js:315-323` |
| TG-03 | High | AI 프리뷰 상태에서는 편집 대상도 프리뷰와 동일해야 함(또는 편집 잠금) | AI 프리뷰는 `items` 복제본(`aiItems`)으로 렌더링되는데, 간트 편집 액션은 store(`moveTaskBars` 등)에 쓰기 | 드래그/편집 후 화면/실데이터가 엇갈리는 느낌 발생 가능 | `frontend/src/hooks/useAIScheduleOptimizer.js:45-50`, `frontend/src/components/cpe/GanttChart.jsx:160-163`, `frontend/src/components/cpe/GanttChart.jsx:469-471`, `frontend/src/components/cpe/GanttChart.jsx:504-509`, `frontend/src/pages/ScheduleMasterList.jsx:1769` |
| TG-04 | Medium | 상단 전체기간/목표 placeholder는 현재 보고 있는 화면 데이터와 맞아야 함 | 전체기간은 항상 `items(store)` 기준 계산/표시, 간트는 `aiDisplayItems`를 표시할 수 있음 | AI 프리뷰 중 상단 수치와 간트 막대 길이 인식이 어긋남 | `frontend/src/pages/ScheduleMasterList.jsx:188-189`, `frontend/src/pages/ScheduleMasterList.jsx:1752-1753`, `frontend/src/pages/ScheduleMasterList.jsx:1769`, `frontend/src/components/cpe/schedule/ScheduleHeader.jsx:102`, `frontend/src/components/cpe/schedule/ScheduleHeader.jsx:138-139` |
| TG-05 | Medium | 테이블에서 잡은 선택 맥락이 간트에서도 이어져야 함(연속 작업 흐름) | 페이지 레벨 `selectedItemIds`(테이블)와 간트 내부 `selectedItemIds`가 별도 상태 | 뷰 전환 시 작업 맥락 단절, 다시 찾기/다시 선택 필요 | `frontend/src/pages/ScheduleMasterList.jsx:202`, `frontend/src/components/cpe/GanttChart.jsx:188` |
| TG-06 | Low | 검색/필터로 좁힌 작업 집합이 간트에서도 동일 맥락으로 보여야 함 | 검색/필터는 `visibleItems`(테이블 전용)만 적용, 간트는 전체 `aiDisplayItems` 표시 | 테이블에서 찾은 범위와 간트 범위가 달라 비교 작업 비효율 | `frontend/src/pages/ScheduleMasterList.jsx:216-217`, `frontend/src/pages/ScheduleMasterList.jsx:262-299`, `frontend/src/pages/ScheduleMasterList.jsx:1767-1770` |

## 8) 연동 시나리오 재현 체크리스트

1. AI 조정 실행 후, 같은 항목을 테이블/간트에서 번갈아 보고 값이 즉시 일치하는지 확인한다. (`TG-01`)
2. AI 프리뷰가 보이는 상태에서 저장했을 때, 저장 후 재조회 값이 “보이던 간트”와 같은지 확인한다. (`TG-02`)
3. AI 프리뷰 상태에서 간트 드래그/리사이즈 후 테이블 값과의 즉시 동기 여부를 확인한다. (`TG-03`)
4. AI 프리뷰 중 상단 `전체 기간` 숫자와 간트의 실제 총 길이가 같은지 확인한다. (`TG-04`)
5. 테이블에서 선택한 행을 유지한 채 간트로 전환했을 때 동일 항목이 선택되어 있는지 확인한다. (`TG-05`)
6. 테이블 검색/카테고리 필터 적용 후 간트로 전환했을 때 범위가 같은지 확인한다. (`TG-06`)
