export const SCHEDULE_BATCH_EDITABLE_FIELDS = [
    "process",
    "sub_process",
    "work_type",
    "quantity_formula",
    "unit",
    "quantity",
    "productivity",
    "crew_size",
    "cp_checked",
    "parallel_rate",
    "reflection_rate",
    "note"
];

export const SCHEDULE_CELL_NAV_FIELDS = [
    "process",
    "sub_process",
    "work_type",
    "quantity_formula",
    "unit",
    "quantity",
    "productivity",
    "crew_size",
    "cp_checked",
    "parallel_rate",
    "reflection_rate",
    "note"
];

const NUMERIC_FIELDS = new Set([
    "quantity",
    "productivity",
    "crew_size",
    "parallel_rate",
    "reflection_rate"
]);

const INTEGER_FIELDS = new Set(["crew_size"]);
const BOOLEAN_FIELDS = new Set(["cp_checked"]);

const TRUE_TOKENS = new Set(["true", "1", "y", "yes", "o", "on", "예", "사용"]);
const FALSE_TOKENS = new Set(["false", "0", "n", "no", "x", "off", "아니오", "미사용"]);

export const isBatchEditableField = (field) => SCHEDULE_BATCH_EDITABLE_FIELDS.includes(field);

export const getCellFieldIndex = (field) => SCHEDULE_CELL_NAV_FIELDS.indexOf(field);

export const normalizeClipboardMatrix = (rawText) => {
    const normalizedText = String(rawText || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const rows = normalizedText.split("\n");
    while (rows.length > 0 && rows[rows.length - 1] === "") {
        rows.pop();
    }
    return rows.map((row) => row.split("\t"));
};

export const parseScheduleCellValue = (field, rawValue) => {
    if (BOOLEAN_FIELDS.has(field)) {
        const token = String(rawValue ?? "").trim().toLowerCase();
        if (!token) {
            return { ok: true, value: false };
        }
        if (TRUE_TOKENS.has(token)) {
            return { ok: true, value: true };
        }
        if (FALSE_TOKENS.has(token)) {
            return { ok: true, value: false };
        }
        return { ok: false, reason: "체크박스 값은 true/false 또는 1/0 형식만 지원합니다." };
    }

    if (NUMERIC_FIELDS.has(field)) {
        const normalized = String(rawValue ?? "").trim();
        if (!normalized) {
            return { ok: true, value: "" };
        }
        const parsed = Number(normalized.replace(/,/g, ""));
        if (!Number.isFinite(parsed)) {
            return { ok: false, reason: "숫자 형식만 입력할 수 있습니다." };
        }
        if ((field === "parallel_rate" || field === "reflection_rate") && (parsed < 0 || parsed > 100)) {
            return { ok: false, reason: "퍼센트 값은 0~100 범위여야 합니다." };
        }
        if (INTEGER_FIELDS.has(field) && !Number.isInteger(parsed)) {
            return { ok: false, reason: "정수 값만 입력할 수 있습니다." };
        }
        return { ok: true, value: normalized };
    }

    return { ok: true, value: String(rawValue ?? "") };
};
