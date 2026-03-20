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
