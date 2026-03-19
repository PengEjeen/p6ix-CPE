/**
 * FTUE Step 정의 (순수 데이터)
 *
 * 각 step:
 *   id          — 고정 문자열 (변경 시 기존 localStorage 키가 달라져 자동 리셋)
 *   title       — 체크리스트 항목명
 *   desc        — 항목 설명
 *   howTo       — 경로 힌트
 *   actionLabel — CTA 버튼 라벨 (기본)
 *
 * done / action 은 FtueChecklist/FtueInlineCard에서 ftueState와 프로젝트 목록을 바탕으로 주입.
 *
 * markFtueDone 호출 위치:
 *   create_project      → Home.jsx handleCreate
 *   view_operating_rate → OperatingRate.jsx (mount)
 *   edit_schedule       → ScheduleMaster(공정표) page (mount or first save)
 *   adjust_gantt        → Gantt page (mount or first interaction)
 *   export_report       → Header.jsx handleExportReport 성공 시
 *
 *   apartment/view_standards  → 적용기준 탭/페이지 (mount)
 *   apartment/adjust_input    → 공기산정 입력 탭/페이지 (mount or first save)
 *   apartment/view_result     → 프로젝트 확인 탭/페이지 (mount)
 */

export const FTUE_STEPS = {
    TOTAL: [
        {
            id: "create_project",
            title: "전체 공기산정 프로젝트 생성",
            desc: "전체 공기산정 프로젝트를 처음 만들어봅니다.",
            howTo: "홈 > + 새 프로젝트 > 전체 공기산정 선택 > 생성",
            actionLabel: "생성",
        },
        {
            id: "view_operating_rate",
            title: "가동률 수정해보기",
            desc: "가동률 화면에서 근무 조건과 가동률을 확인하고 수정합니다.",
            howTo: "프로젝트 진입 > 상단 탭 > 가동률",
            actionLabel: "이동",
        },
        {
            id: "edit_schedule",
            title: "공정표 수정해보기",
            desc: "공정표 화면에서 세부공종·기간을 입력하거나 수정합니다.",
            howTo: "프로젝트 진입 > 상단 탭 > 공정표",
            actionLabel: "이동",
        },
        {
            id: "adjust_gantt",
            title: "간트차트 조정해보기",
            desc: "간트차트에서 공정 일정을 드래그하거나 조정합니다.",
            howTo: "프로젝트 진입 > 상단 탭 > 간트차트",
            actionLabel: "이동",
        },
        {
            id: "export_report",
            title: "보고서 내보내기",
            desc: "완성된 공기산정 결과를 DOCX 보고서로 내보냅니다.",
            howTo: "프로젝트 진입 > 상단 헤더 > 보고서 내보내기",
            actionLabel: "이동",
        },
    ],
    APARTMENT: [
        {
            id: "create_project",
            title: "공기계산 프로젝트 생성",
            desc: "공기계산 프로젝트를 처음 만들어봅니다.",
            howTo: "홈 > + 새 프로젝트 > 공기 계산 선택 > 생성",
            actionLabel: "생성",
        },
        {
            id: "view_standards",
            title: "적용기준 확인하기",
            desc: "공기산정에 적용되는 기준 값을 확인합니다.",
            howTo: "프로젝트 진입 > 탭 > 적용기준",
            actionLabel: "이동",
        },
        {
            id: "adjust_input",
            title: "공기산정 입력 조정해보기",
            desc: "각 세부공종별 투입 조건과 수치를 입력·조정합니다.",
            howTo: "프로젝트 진입 > 탭 > 공기산정 입력",
            actionLabel: "이동",
        },
        {
            id: "view_result",
            title: "프로젝트 확인하기",
            desc: "입력된 값을 바탕으로 산정된 최종 공기를 확인합니다.",
            howTo: "프로젝트 진입 > 탭 > 프로젝트 확인",
            actionLabel: "이동",
        },
    ],
};

/** 타입별 step id 배열 (완료 판정용) */
export const FTUE_STEP_IDS = {
    TOTAL: FTUE_STEPS.TOTAL.map((s) => s.id),
    APARTMENT: FTUE_STEPS.APARTMENT.map((s) => s.id),
};
