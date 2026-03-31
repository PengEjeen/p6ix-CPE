const PROCESS_KEY_DELIMITER = "|||";

const normalizePart = (value) => String(value || "").trim();

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
    if (!Array.isArray(operatingRates) || operatingRates.length === 0) return [];

    const seenKeys = new Set();
    return operatingRates.filter((rate) => {
        const key = normalizePart(rate?.main_category);
        if (!key || seenKeys.has(key) || !isSelectableOperatingRate(rate)) {
            return false;
        }
        seenKeys.add(key);
        return true;
    });
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
