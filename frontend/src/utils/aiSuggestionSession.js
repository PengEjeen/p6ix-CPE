const REQUEST_PATTERNS = {
    avoidCrew: [
        /무리한\s*인력\s*증원/,
        /인력\s*증원은?\s*피/,
        /인력은?\s*최소/,
        /증원은?\s*지양/
    ],
    crewOnly: [
        /인력만/,
        /투입\s*인원만/,
        /인원만/
    ],
    productivityOnly: [
        /생산성만/,
        /생산량만/
    ],
    conservative: [
        /보수적/,
        /안전하게/,
        /무리하지\s*않/
    ],
    aggressive: [
        /공격적/,
        /최대한/,
        /강하게/,
        /크게\s*줄/
    ]
};

const matchesAny = (text, patterns) => patterns.some((pattern) => pattern.test(text));

export const extractRequestPreferences = (requestText = "") => {
    const text = String(requestText || "").trim();
    if (!text) {
        return {
            avoidCrewIncrease: false,
            crewOnly: false,
            productivityOnly: false,
            conservative: false,
            aggressive: false
        };
    }

    const preferences = {
        avoidCrewIncrease: matchesAny(text, REQUEST_PATTERNS.avoidCrew),
        crewOnly: matchesAny(text, REQUEST_PATTERNS.crewOnly),
        productivityOnly: matchesAny(text, REQUEST_PATTERNS.productivityOnly),
        conservative: matchesAny(text, REQUEST_PATTERNS.conservative),
        aggressive: matchesAny(text, REQUEST_PATTERNS.aggressive)
    };

    if (preferences.crewOnly) {
        preferences.productivityOnly = false;
        preferences.avoidCrewIncrease = false;
    }

    if (preferences.productivityOnly) {
        preferences.crewOnly = false;
    }

    return preferences;
};

const uniqueIds = (values = []) => Array.from(new Set(values.filter(Boolean).map((value) => String(value))));

export const resolveAiSuggestionScope = (items = [], selectionState = {}) => {
    const allIds = uniqueIds(items.map((item) => item?.id));
    const selectedIds = uniqueIds(selectionState.selectedItemIds);
    const visibleIds = uniqueIds(selectionState.visibleItemIds);
    const activeItemId = selectionState.activeEditingItemId ? String(selectionState.activeEditingItemId) : null;

    if (selectedIds.length > 0) {
        return {
            mode: "selected",
            label: `선택 행 ${selectedIds.length}건`,
            itemIds: selectedIds
        };
    }

    if (activeItemId && allIds.includes(activeItemId)) {
        const activeItem = items.find((item) => String(item?.id) === activeItemId);
        const itemLabel = [activeItem?.process, activeItem?.work_type].filter(Boolean).join(" / ") || "현재 행";
        return {
            mode: "active",
            label: itemLabel,
            itemIds: [activeItemId]
        };
    }

    if (visibleIds.length > 0 && visibleIds.length < allIds.length) {
        return {
            mode: "visible",
            label: `현재 화면 ${visibleIds.length}건`,
            itemIds: visibleIds
        };
    }

    return {
        mode: "all",
        label: `전체 공정 ${allIds.length}건`,
        itemIds: allIds
    };
};

export const getScopeItemLabel = (items = [], itemId) => {
    const target = items.find((item) => String(item?.id) === String(itemId));
    return [target?.process, target?.work_type].filter(Boolean).join(" / ") || "공정";
};
