import { describe, expect, it } from "vitest";
import { evaluateStandardMatch, normalizeUnitValue } from "./standardMatcher";
import { mapClipboardRowToFields } from "./scheduleTableEditing";

// 건축내역서 → 품셈 매칭 테스트용 대표 품셈 데이터
// (CSV에서 발췌, 서브카테고리별 대표 1개)
const NAEYEOK_STANDARDS = [
    // RC공사 > 거푸집
    { id: 206, main_category: "RC공사", category: "거푸집", sub_category: "합판거푸집", item_name: "6-3-1 합판거푸집 설치 및 해체", standard: "간단", unit: "㎡", pumsam_workload: 50 },
    { id: 207, main_category: "RC공사", category: "거푸집", sub_category: "합판거푸집", item_name: "6-3-1 합판거푸집 설치 및 해체", standard: "보통", unit: "㎡", pumsam_workload: 45 },
    { id: 208, main_category: "RC공사", category: "거푸집", sub_category: "합판거푸집", item_name: "6-3-1 합판거푸집 설치 및 해체", standard: "복잡", unit: "㎡", pumsam_workload: 30 },
    { id: 214, main_category: "RC공사", category: "거푸집", sub_category: "유로폼\n수직고 7m 이하", item_name: "6-3-3 유로폼 설치 및 해체", standard: "간단", unit: "㎡", pumsam_workload: 40 },
    { id: 215, main_category: "RC공사", category: "거푸집", sub_category: "유로폼\n수직고 7m 이하", item_name: "6-3-3 유로폼 설치 및 해체", standard: "보통", unit: "㎡", pumsam_workload: 35 },
    { id: 219, main_category: "RC공사", category: "거푸집", sub_category: "알루미늄폼", item_name: "6-3-7 알루미늄폼 설치 및 해체", standard: "마감층", unit: "㎡", pumsam_workload: 40 },
    { id: 221, main_category: "RC공사", category: "거푸집", sub_category: "갱폼", item_name: "6-3-8 갱폼 설치 및 해체", standard: "셋팅층", unit: "㎡", pumsam_workload: 40 },
    // RC공사 > 철근 현장
    { id: 202, main_category: "RC공사", category: "철근 현장", sub_category: "가공", item_name: "6-2-2 현장가공", standard: "Type-Ⅱ 기준", unit: "ton", pumsam_workload: 4 },
    { id: 204, main_category: "RC공사", category: "철근 현장", sub_category: "조립(건축)", item_name: "", standard: "건축 TYPE-Ⅰ 기준", unit: "ton", pumsam_workload: 3.4 },
    { id: 205, main_category: "RC공사", category: "철근 현장", sub_category: "조립(건축)", item_name: "", standard: "건축 TYPE-Ⅱ 기준", unit: "ton", pumsam_workload: 3 },
    // RC공사 > 타설
    { id: 225, main_category: "RC공사", category: "타설", sub_category: "콘크리트 펌프카", item_name: "6-1-4 콘크리트 펌프차 타설", standard: "TYPE-Ⅱ 무근구조물", unit: "㎥", pumsam_workload: 189 },
    { id: 227, main_category: "RC공사", category: "타설", sub_category: "콘크리트 펌프카", item_name: "6-1-4 콘크리트 펌프차 타설", standard: "TYPE-Ⅱ 철근구조물", unit: "㎥", pumsam_workload: 130 },
    // 가설공사 > 비계
    { id: 34, main_category: "가설공사", category: "비계", sub_category: "강관비계", item_name: "2-7-1 강관비계 설치 및 해체", standard: "10m 이하 (쌍줄비계)", unit: "㎡", pumsam_workload: 55 },
    { id: 41, main_category: "가설공사", category: "비계", sub_category: "시스템비계", item_name: "2-7-2 시스템비계 설치 및 해체(인력)", standard: "설치: 10m 초과~20m 이하", unit: "㎡", pumsam_workload: 130 },
    // 가설공사 > 동바리
    { id: 48, main_category: "가설공사", category: "동바리", sub_category: "건축,기계설비", item_name: "2-6-2 강관 동바리 설치 및 해체", standard: "3.5m이하", unit: "㎡", pumsam_workload: 65 },
    { id: 50, main_category: "가설공사", category: "동바리", sub_category: "시스템 동바리", item_name: "2-6-3 시스템 동바리 설치 및 해체", standard: "설치: 5m 이하", unit: "공㎡", pumsam_workload: 130 },
    // 공통가설 > 가설건축물
    { id: 3, main_category: "공통가설", category: "가설건축물", sub_category: "철제조립식", item_name: "2-3-1 철제조립식 가설건축물 설치 및 해체", standard: "3m 이하", unit: "㎡", pumsam_workload: 30 },
    // 철골공사 > D.P
    { id: 230, main_category: "철골공사", category: "D.P", sub_category: "", item_name: "1-3-3 데크플레이트 설치", standard: "", unit: "㎡", pumsam_workload: 100 },
    // 방수공사
    { id: 101, main_category: "방수공사", category: "도막방수", sub_category: "", item_name: "6-2-1 도막바름", standard: "", unit: "㎡", pumsam_workload: 80 },
];

const STANDARD_ROWS = [
    {
        id: 1,
        main_category: "토공사",
        category: "터파기",
        sub_category: "굴삭기터파기",
        item_name: "굴삭기 터파기",
        standard: "24ton 100mm 30m3",
        unit: "M3",
        pumsam_workload: 120
    },
    {
        id: 2,
        main_category: "토공사",
        category: "터파기",
        sub_category: "굴삭기터파기",
        item_name: "굴삭기 터파기",
        standard: "24ton 100mm 40m3",
        unit: "M3",
        pumsam_workload: 90
    },
    {
        id: 3,
        main_category: "콘크리트공사",
        category: "콘크리트",
        sub_category: "콘크리트타설",
        item_name: "콘크리트 펌프차 타설",
        standard: "25-240-15",
        unit: "㎡",
        pumsam_workload: 75
    },
    {
        id: 4,
        main_category: "토공사",
        category: "터파기",
        sub_category: "굴삭기터파기",
        item_name: "굴삭기 터파기",
        standard: "",
        crew_composition_text: "24ton 100mm 30m3",
        unit: "M3",
        pumsam_workload: 110
    },
    {
        id: 5,
        main_category: "토공사",
        category: "터파기",
        sub_category: "굴삭기터파기",
        item_name: "굴삭기 터파기",
        standard: "",
        crew_composition_text: "24ton 100mm 40m3",
        unit: "M3",
        pumsam_workload: 90
    }
];

describe("mapClipboardRowToFields", () => {
    it("maps pasted values using the actual paste start field", () => {
        const mapped = mapClipboardRowToFields(
            ["굴착기 터파기", "24ton 100mm 30m3", "M3"],
            2,
            ["process", "sub_process", "work_type", "quantity_formula", "unit"]
        );

        expect(mapped).toEqual({
            work_type: "굴착기 터파기",
            quantity_formula: "24ton 100mm 30m3",
            unit: "M3"
        });
    });
});

describe("standardMatcher", () => {
    it("normalizes common unit expressions", () => {
        expect(normalizeUnitValue("M3")).toBe("m3");
        expect(normalizeUnitValue("M2")).toBe("m2");
        expect(normalizeUnitValue("㎥")).toBe("m3");
        expect(normalizeUnitValue("㎡")).toBe("m2");
    });

    describe("건축내역서 → 품셈 카테고리 추론 매칭", () => {
        const match = (workType, unit) => evaluateStandardMatch({
            row: { work_type: workType, unit },
            standards: NAEYEOK_STANDARDS,
            pastedValuesByField: { work_type: workType, unit }
        });

        it("유로폼 → RC공사>거푸집>유로폼 매칭", () => {
            const result = match("유로폼 설치 및 해체", "M2");
            expect(result.standard).not.toBeNull();
            expect(result.standard?.sub_category).toMatch(/유로폼/);
            expect(result.debug.decision.accepted).toBe(true);
        });

        it("합판거푸집 → RC공사>거푸집>합판거푸집 매칭 (유로폼과 혼동 없음)", () => {
            const result = match("합판거푸집 설치 및 해체", "M2");
            expect(result.standard).not.toBeNull();
            expect(result.standard?.sub_category).toMatch(/합판거푸집/);
            expect(result.debug.decision.accepted).toBe(true);
        });

        it("갱폼 → 합판거푸집과 혼동 없이 갱폼 매칭", () => {
            const result = match("갱폼 설치 및 해체", "M2");
            expect(result.standard).not.toBeNull();
            expect(result.standard?.sub_category).toMatch(/갱폼/);
        });

        it("철근 현장가공 및 조립 → RC공사>철근 현장 매칭", () => {
            const result = match("철근 현장가공 및 조립", "TON");
            expect(result.standard).not.toBeNull();
            expect(result.standard?.main_category).toBe("RC공사");
            expect(result.standard?.category).toMatch(/철근/);
            expect(result.debug.decision.accepted).toBe(true);
        });

        it("콘크리트 펌프차 타설 → RC공사>타설 매칭", () => {
            const result = match("콘크리트 펌프차 타설(철근)", "M3");
            expect(result.standard).not.toBeNull();
            expect(result.standard?.category).toBe("타설");
            expect(result.debug.decision.accepted).toBe(true);
        });

        it("펌프카 표기 → 펌프차와 동일하게 타설 매칭", () => {
            const result = match("콘크리트 펌프카 타설", "M3");
            expect(result.standard).not.toBeNull();
            expect(result.standard?.category).toBe("타설");
        });

        it("강관비계 → 가설공사>비계>강관비계 매칭", () => {
            const result = match("강관비계 설치 및 해체", "M2");
            expect(result.standard).not.toBeNull();
            expect(result.standard?.sub_category).toMatch(/강관비계/);
        });

        it("가설사무소(개소 단위) → 단위 불일치로 자동 반영 거부", () => {
            const result = match("콘테이너형 가설사무소 설치 및 해체", "개소");
            expect(result.standard).toBeNull();
            expect(result.debug.decision.accepted).toBe(false);
        });

        it("데크플레이트 → 철골공사>D.P 매칭", () => {
            const result = match("데크플레이트 설치", "M2");
            expect(result.standard).not.toBeNull();
            expect(result.standard?.main_category).toBe("철골공사");
        });

        it("방수와 거푸집 혼동 없음 — 단위 없이도 카테고리로 분리", () => {
            const euroForm = match("유로폼 설치 및 해체", "M2");
            const waterproof = match("도막방수 시공", "M2");
            expect(euroForm.standard?.main_category).toBe("RC공사");
            expect(waterproof.standard?.main_category).toBe("방수공사");
        });
    });

    it("matches the closest standard using synonym, unit, and spec information", () => {
        const result = evaluateStandardMatch({
            row: {
                process: "터파기",
                sub_process: "토공",
                work_type: "굴착기 터파기",
                quantity_formula: "24ton 100mm 30m3",
                unit: "M3"
            },
            standards: STANDARD_ROWS,
            pastedValuesByField: {
                work_type: "굴착기 터파기",
                quantity_formula: "24ton 100mm 30m3",
                unit: "M3"
            }
        });

        expect(result.standard?.id).toBe(1);
        expect(result.debug.decision.accepted).toBe(true);
        expect(result.ranked[0].totalScore).toBeGreaterThanOrEqual(result.ranked[1].totalScore);
    });

    it("rejects auto-apply when only a mismatched unit candidate exists", () => {
        const result = evaluateStandardMatch({
            row: {
                process: "콘크리트",
                sub_process: "타설",
                work_type: "콘크리트 펌프카 타설",
                quantity_formula: "25-240-15",
                unit: "M3"
            },
            standards: [STANDARD_ROWS[2]],
            pastedValuesByField: {
                work_type: "콘크리트 펌프카 타설",
                quantity_formula: "25-240-15",
                unit: "M3"
            }
        });

        expect(result.standard).toBeNull();
        expect(result.debug.decision.accepted).toBe(false);
        expect(result.ranked[0].conflictingConditions.some((condition) => condition.includes("unit mismatch"))).toBe(true);
    });

    it("compares quantity formula against crew composition basis when standard text is empty", () => {
        const result = evaluateStandardMatch({
            row: {
                process: "터파기",
                work_type: "굴삭기 터파기",
                quantity_formula: "24ton 100mm 30m3",
                unit: "M3"
            },
            standards: [STANDARD_ROWS[3], STANDARD_ROWS[4]],
            pastedValuesByField: {
                work_type: "굴삭기 터파기",
                quantity_formula: "24ton 100mm 30m3",
                unit: "M3"
            }
        });

        expect(result.standard?.id).toBe(4);
        expect(result.debug.decision.accepted).toBe(true);
    });
});
