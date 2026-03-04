/**
 * FTUE (First Time User Experience) Utility
 *
 * 저장 키 포맷: p6ix:ftue:v1:{userId}:{calcType}
 * calcType: "TOTAL" | "APARTMENT"
 *
 * 저장 객체 구조:
 * {
 *   version: 1,
 *   hidden: boolean,
 *   completedAt: number | null,
 *   steps: { [stepId]: boolean }
 * }
 */

export const FTUE_CHANGED_EVENT = "p6ix:ftue-changed";
export const REPORT_EXPORT_AT_KEY = "p6ix_last_report_export_at";

// Re-export step IDs for convenience (callers can import everything from this file)
export { FTUE_STEP_IDS } from "../config/ftueSteps";

// ─── 내부 헬퍼 ────────────────────────────────────────────────────────────────

function getUserId() {
    try {
        const user = JSON.parse(window.localStorage.getItem("user") || "{}");
        return user?.id ? String(user.id) : "anon";
    } catch {
        return "anon";
    }
}

function getFtueStorageKey(calcType) {
    return `p6ix:ftue:v1:${getUserId()}:${calcType}`;
}

function makeDefaultState() {
    return {
        version: 1,
        hidden: false,
        completedAt: null,
        steps: {},
    };
}

function checkCompletion(state, expectedStepIds) {
    if (state.completedAt !== null) return state; // 이미 완료 기록된 경우 유지
    const allDone = expectedStepIds.every((id) => state.steps[id] === true);
    if (allDone) {
        return { ...state, completedAt: Date.now() };
    }
    return state;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * calcType의 FTUE 상태를 로컬스토리지에서 읽어옴.
 * 파싱 실패 시 기본값 반환.
 */
export function loadFtue(calcType) {
    try {
        const raw = window.localStorage.getItem(getFtueStorageKey(calcType));
        if (!raw) return makeDefaultState();
        const parsed = JSON.parse(raw);
        return { ...makeDefaultState(), ...parsed };
    } catch {
        return makeDefaultState();
    }
}

/**
 * calcType의 FTUE 상태를 저장하고 변경 이벤트를 dispatch.
 */
export function saveFtue(calcType, state) {
    try {
        window.localStorage.setItem(
            getFtueStorageKey(calcType),
            JSON.stringify(state)
        );
    } catch {
        // ignore
    }
    window.dispatchEvent(
        new CustomEvent(FTUE_CHANGED_EVENT, { detail: { calcType } })
    );
}

/**
 * 특정 step을 완료 처리.
 * - 이미 true인 step은 no-op (한 번 true면 절대 false로 되돌리지 않음)
 * - 모든 step이 완료되면 completedAt 기록 (단, completedAt이 null일 때만)
 *
 * @param {string} calcType - "TOTAL" | "APARTMENT"
 * @param {string} stepId - step 식별자
 * @param {string[]} allStepIds - 해당 타입의 모든 step id 배열 (완료 판정용)
 */
export function markFtueDone(calcType, stepId, allStepIds) {
    const state = loadFtue(calcType);
    // 이미 완료된 step은 no-op
    if (state.steps[stepId] === true) return;
    const next = {
        ...state,
        steps: { ...state.steps, [stepId]: true },
    };
    const checked = allStepIds ? checkCompletion(next, allStepIds) : next;
    saveFtue(calcType, checked);
}

/**
 * 위젯 숨김/보임 설정.
 */
export function setFtueHidden(calcType, hidden) {
    const state = loadFtue(calcType);
    saveFtue(calcType, { ...state, hidden: Boolean(hidden) });
}

/**
 * 초기 보정 (사용자가 이미 해당 프로젝트를 보유하거나 보고서를 내보낸 경우).
 * - 이미 true인 step은 건드리지 않음 (절대 false로 되돌리지 않음)
 * - "보정" 이후 completedAt도 자동으로 체크.
 *
 * @param {string} calcType - "TOTAL" | "APARTMENT"
 * @param {object[]} projects - 현재 프로젝트 목록
 * @param {string[]} allStepIds - 해당 타입의 모든 step id 배열
 */
export function initFtue(calcType, projects, allStepIds) {
    const state = loadFtue(calcType);
    const patchedSteps = { ...state.steps };
    let changed = false;

    const hasType = Array.isArray(projects) &&
        projects.some((p) => p?.calc_type === calcType);

    if (hasType && !patchedSteps["create_project"]) {
        patchedSteps["create_project"] = true;
        changed = true;
    }

    if (calcType === "TOTAL") {
        const exported = Boolean(
            window.localStorage.getItem(REPORT_EXPORT_AT_KEY)
        );
        if (exported && !patchedSteps["export_report"]) {
            patchedSteps["export_report"] = true;
            changed = true;
        }
    }

    if (!changed) return;

    let next = { ...state, steps: patchedSteps };
    if (allStepIds) {
        next = checkCompletion(next, allStepIds);
    }
    saveFtue(calcType, next);
}

/**
 * 완료율 계산 (0~100).
 */
export function getFtueProgress(ftueState, allStepIds) {
    if (!allStepIds || allStepIds.length === 0) return 0;
    const done = allStepIds.filter((id) => ftueState?.steps?.[id] === true).length;
    return Math.round((done / allStepIds.length) * 100);
}

/**
 * FTUE 상태를 완전히 초기화 (다시하기).
 * hidden, completedAt, steps 모두 리셋.
 */
export function resetFtue(calcType) {
    saveFtue(calcType, makeDefaultState());
}
