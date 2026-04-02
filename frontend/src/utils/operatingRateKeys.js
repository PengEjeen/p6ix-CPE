import { calculateTotalCalendarDays } from "./scheduleCalculations";

const PROCESS_KEY_DELIMITER = "|||";
const DEFAULT_SELECTABLE_OPERATING_RATE_KEYS = [
    "내부마감(건식)",
    "내부마감(습식)",
];
const DEFAULT_INTERNAL_FINISH_PROCESSES = ["내부마감(건식)", "내부마감(습식)"];
const INTERNAL_FINISH_PROCESS_ALIASES = new Set([
    "내부마감",
    "내부마감(건식)",
    "내부마감(습식)",
    "내부마감건식",
    "내부마감습식",
]);

const normalizePart = (value) => String(value || "").trim();
const normalizeCategoryLabel = (value) => String(value || "").replace(/\s+/g, "").toLowerCase();

export const normalizeOperatingRateKey = (value) => normalizePart(value);

export const makeMainOperatingRateKey = (mainCategory) => normalizePart(mainCategory);

export const makeProcessOperatingRateKey = (mainCategory, process) => {
    const main = normalizePart(mainCategory);
    const proc = normalizePart(process);
    if (!main) return "";
    if (!proc) return main;
    return `${main}${PROCESS_KEY_DELIMITER}${proc}`;
};

export const parseOperatingRateKey = (rawKey) => {
    const key = normalizePart(rawKey);
    if (!key) {
        return { rawKey: "", mainCategory: "", process: "", isProcessKey: false };
    }

    const delimiterIndex = key.indexOf(PROCESS_KEY_DELIMITER);
    if (delimiterIndex === -1) {
        return { rawKey: key, mainCategory: key, process: "", isProcessKey: false };
    }

    const mainCategory = normalizePart(key.slice(0, delimiterIndex));
    const process = normalizePart(key.slice(delimiterIndex + PROCESS_KEY_DELIMITER.length));
    return {
        rawKey: key,
        mainCategory,
        process,
        isProcessKey: Boolean(process),
    };
};

export const isSelectableOperatingRate = (rate = {}) => {
    const parsed = parseOperatingRateKey(rate?.main_category);
    if (!parsed.rawKey) return false;
    if (!parsed.isProcessKey) return true;
    return normalizePart(rate?.type).toUpperCase() !== "INHERIT";
};

export const getSelectableOperatingRates = (operatingRates = []) => {
    const sourceRates = Array.isArray(operatingRates) ? operatingRates : [];

    const seenKeys = new Set();
    const selectableRates = sourceRates.filter((rate) => {
        const key = normalizePart(rate?.main_category);
        if (!key || seenKeys.has(key) || !isSelectableOperatingRate(rate)) {
            return false;
        }
        seenKeys.add(key);
        return true;
    });

    DEFAULT_SELECTABLE_OPERATING_RATE_KEYS.forEach((mainCategory) => {
        const key = normalizePart(mainCategory);
        if (!key || seenKeys.has(key)) return;
        selectableRates.push({ main_category: mainCategory });
        seenKeys.add(key);
    });

    return selectableRates;
};

export const getVisibleOperatingRateOptions = (operatingRates = [], scheduleItems = []) => {
    const sourceRates = Array.isArray(operatingRates) ? operatingRates : [];
    const items = Array.isArray(scheduleItems) ? scheduleItems : [];
    const existingMap = new Map();

    sourceRates.forEach((rate) => {
        const key = normalizePart(rate?.main_category);
        if (key) existingMap.set(key, rate);
    });

    const scheduleItemsByMain = new Map();
    items.forEach((item) => {
        const main = normalizePart(item?.main_category) || "기타";
        if (!scheduleItemsByMain.has(main)) {
            scheduleItemsByMain.set(main, []);
        }
        scheduleItemsByMain.get(main).push(item);
    });

    const visibleMainCategories = new Set();
    scheduleItemsByMain.forEach((categoryItems, mainCategory) => {
        if (calculateTotalCalendarDays(categoryItems) > 0) {
            visibleMainCategories.add(mainCategory);
        }
    });

    const mainOrder = [];
    const processByMain = new Map();
    const internalFinishMainSet = new Set();

    const addMain = (mainCategory) => {
        const main = normalizePart(mainCategory) || "기타";
        if (!visibleMainCategories.has(main)) return null;
        if (!mainOrder.includes(main)) {
            mainOrder.push(main);
            processByMain.set(main, []);
        }
        return main;
    };

    const addProcess = (mainCategory, processName) => {
        const main = addMain(mainCategory);
        if (!main) return;
        const process = normalizePart(processName);
        if (!process) return;
        const current = processByMain.get(main) || [];
        if (!current.includes(process)) {
            current.push(process);
            processByMain.set(main, current);
        }
    };

    items.forEach((item) => {
        const main = addMain(item?.main_category);
        if (!main) return;
        const process = normalizePart(item?.process);
        addProcess(main, process);
        if (INTERNAL_FINISH_PROCESS_ALIASES.has(normalizeCategoryLabel(process))) {
            internalFinishMainSet.add(main);
        }
    });

    sourceRates.forEach((rate) => {
        const parsed = parseOperatingRateKey(rate?.main_category);
        const main = addMain(parsed.mainCategory || rate?.main_category);
        if (!main) return;
        if (parsed.isProcessKey && parsed.process) {
            addProcess(main, parsed.process);
            if (INTERNAL_FINISH_PROCESS_ALIASES.has(normalizeCategoryLabel(parsed.process))) {
                internalFinishMainSet.add(main);
            }
        }
    });

    mainOrder.forEach((mainCategory) => {
        if (!internalFinishMainSet.has(mainCategory)) return;
        DEFAULT_INTERNAL_FINISH_PROCESSES.forEach((processName) => {
            addProcess(mainCategory, processName);
        });
    });

    const orderedOptions = [];
    mainOrder.forEach((mainCategory) => {
        orderedOptions.push(existingMap.get(mainCategory) || { main_category: mainCategory });
        const processes = processByMain.get(mainCategory) || [];
        processes.forEach((processName) => {
            const key = makeProcessOperatingRateKey(mainCategory, processName);
            orderedOptions.push(existingMap.get(key) || { main_category: key });
        });
    });

    return orderedOptions;
};

export const getOperatingRateOptionLabel = (rate = {}) => {
    const parsed = parseOperatingRateKey(rate?.main_category);
    const label = parsed.isProcessKey
        ? `${parsed.mainCategory} / ${parsed.process}`
        : parsed.mainCategory;
    const percent = rate?.operating_rate ?? null;
    if (percent === null || percent === undefined || percent === "") {
        return label || "가동률";
    }
    return `${label} (${percent}%)`;
};

export const findOperatingRateForItem = (operatingRates = [], item = {}) => {
    if (!Array.isArray(operatingRates) || operatingRates.length === 0) return null;

    const explicitKey = normalizePart(item.operating_rate_key);
    if (explicitKey) {
        const byExplicitKey = operatingRates.find(
            (rate) => normalizePart(rate?.main_category) === explicitKey
        );
        if (byExplicitKey) return byExplicitKey;
    }

    const mainCategory = normalizePart(item.main_category);
    const process = normalizePart(item.process);

    const processKey = makeProcessOperatingRateKey(mainCategory, process);
    if (processKey && processKey !== mainCategory) {
        const byProcess = operatingRates.find(
            (rate) => normalizePart(rate?.main_category) === processKey
        );
        if (byProcess) return byProcess;
    }

    if (!mainCategory) return null;
    return (
        operatingRates.find((rate) => normalizePart(rate?.main_category) === mainCategory) || null
    );
};
