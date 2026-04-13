import MiniSearch from "minisearch";
import {
    ACTION_RULES,
    GENERIC_KEYWORDS,
    inferCategoryFromText,
    STANDARD_SYNONYM_RULES,
    UNIT_ALIASES
} from "./standardMatcherDictionary";

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

const dedupeStandards = (standards) => {
    const bySignature = new Map();
    (Array.isArray(standards) ? standards : []).forEach((standard) => {
        const key = [
            normalizeMatchValue(standard?.main_category ?? ""),
            normalizeMatchValue(standard?.category ?? standard?.process_name ?? ""),
            normalizeMatchValue(standard?.sub_category ?? standard?.work_type_name ?? ""),
            normalizeMatchValue(standard?.item_name ?? ""),
            normalizeMatchValue(standard?.standard ?? ""),
            normalizeMatchValue(standard?.unit ?? ""),
            normalizeMatchValue(standard?.crew_composition_text ?? ""),
            normalizeMatchValue(standard?.productivity_type ?? ""),
            String(standard?.pumsam_workload ?? ""),
            String(standard?.molit_workload ?? "")
        ].join("::");

        const prev = bySignature.get(key);
        if (!prev) {
            bySignature.set(key, standard);
            return;
        }

        const prevScore = (Number(prev?.pumsam_workload) || 0) + (Number(prev?.molit_workload) || 0)
            + (String(prev?.crew_composition_text || "").trim() ? 0.1 : 0)
            + (String(prev?.standard || "").trim() ? 0.1 : 0);
        const nextScore = (Number(standard?.pumsam_workload) || 0) + (Number(standard?.molit_workload) || 0)
            + (String(standard?.crew_composition_text || "").trim() ? 0.1 : 0)
            + (String(standard?.standard || "").trim() ? 0.1 : 0);

        if (nextScore > prevScore) {
            bySignature.set(key, standard);
        }
    });

    return Array.from(bySignature.values());
};

const replaceSynonyms = (value) => {
    let normalized = String(value ?? "").toLowerCase();
    STANDARD_SYNONYM_RULES.forEach(([pattern, replacement]) => {
        normalized = normalized.replace(pattern, replacement);
    });
    return normalized;
};

const normalizeUnitToken = (value) => {
    const normalized = String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/\^/g, "")
        .replace(/³/g, "3")
        .replace(/²/g, "2")
        .replace(/㎥/g, "m3")
        .replace(/㎡/g, "m2")
        .replace(/㎜/g, "mm");
    return UNIT_ALIASES.get(normalized) || normalized;
};

const getOverlapRatio = (leftValues = [], rightValues = []) => {
    const leftSet = new Set(leftValues);
    const rightSet = new Set(rightValues);
    if (leftSet.size === 0 || rightSet.size === 0) return 0;

    let intersection = 0;
    leftSet.forEach((value) => {
        if (rightSet.has(value)) intersection += 1;
    });
    return intersection / Math.max(leftSet.size, rightSet.size);
};

const extractMeasureTokens = (value) => {
    const normalized = String(value ?? "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[³]/g, "3")
        .replace(/[²]/g, "2")
        .replace(/㎥/g, "m3")
        .replace(/㎡/g, "m2")
        .replace(/㎜/g, "mm");

    const regex = /(\d+(?:\.\d+)?)(mm|cm|m|km|m2|m3|ton|t|kg|ea|개소|개|식|lot|day|일)/g;
    const result = [];
    let match = regex.exec(normalized);
    while (match) {
        result.push({
            value: Number.parseFloat(match[1]),
            unit: normalizeUnitToken(match[2]),
            raw: match[0]
        });
        match = regex.exec(normalized);
    }
    return result;
};

const extractNumberTokens = (value) => {
    const matches = String(value ?? "").toLowerCase().match(/\d+(?:\.\d+)?/g) || [];
    return matches
        .map((token) => Number.parseFloat(token))
        .filter((token) => Number.isFinite(token));
};

const extractDimensionTokens = (value) => {
    const normalized = String(value ?? "")
        .toLowerCase()
        .replace(/[×x*]/g, "x")
        .replace(/\s+/g, "");
    const matches = normalized.match(/\d+(?:\.\d+)?x\d+(?:\.\d+)?/g) || [];
    return matches.map((token) => token.split("x").map((part) => Number.parseFloat(part).toFixed(2)).join("x"));
};

const extractRangeTokens = (value) => {
    const raw = String(value ?? "").toLowerCase();
    const normalized = raw.replace(/[∼〜]/g, "~").replace(/[–—]/g, "-");
    const ranges = [];

    const rangeRegex = /(\d+(?:\.\d+)?)\s*(~|\-)\s*(\d+(?:\.\d+)?)(?!\s*-\s*\d)/g;
    let match = rangeRegex.exec(normalized);
    while (match) {
        const left = Number.parseFloat(match[1]);
        const right = Number.parseFloat(match[3]);
        if (Number.isFinite(left) && Number.isFinite(right)) {
            const min = Math.min(left, right);
            const max = Math.max(left, right);
            const tail = normalized.slice(match.index + match[0].length, match.index + match[0].length + 8);
            const unitMatch = tail.match(/^(mm|cm|m|km|m2|m3|ton|t|kg|ea|lot|day)/);
            ranges.push({
                min,
                max,
                unit: normalizeUnitToken(unitMatch?.[1] || "")
            });
        }
        match = rangeRegex.exec(normalized);
    }

    return ranges;
};

export const normalizeUnitValue = (value) => {
    const extracted = extractMeasureTokens(value);
    if (extracted.length === 1 && !String(value ?? "").trim().match(/^\d/)) {
        return normalizeUnitToken(value);
    }
    return normalizeUnitToken(value);
};

export const normalizeMatchValue = (value) => {
    let normalized = replaceSynonyms(value);
    if (!normalized.trim()) return "";

    normalized = normalized
        .replace(/\r?\n+/g, " ")
        .replace(/[\[\](){}]/g, " ")
        .replace(/[\\/,&+_.-]/g, " ")
        .replace(/['"`]/g, "")
        .replace(/\b\d+(?:-\d+)+\b/g, " ")
        .replace(/\([^)]*보완[^)]*\)/g, " ")
        .replace(/\([^)]*개정[^)]*\)/g, " ")
        .replace(/\([^)]*기준[^)]*\)/g, " ")
        .replace(/철근\s*콘크리트/g, "철근콘크리트")
        .replace(/콘크리트\s*펌프\s*차/g, "콘크리트펌프차")
        .replace(/펌프\s*차/g, "펌프차")
        .replace(/현장\s*가공/g, "현장가공")
        .replace(/설치\s*및\s*해체/g, "설치해체")
        .replace(/설치\s*\/\s*/g, "설치")
        .replace(/및/g, " ")
        .replace(/기준/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    return normalized;
};

const tokenize = (value, { removeGeneric = false } = {}) => {
    const normalized = normalizeMatchValue(value);
    if (!normalized) return [];
    return normalized
        .split(" ")
        .map((token) => token.trim())
        .filter(Boolean)
        .map((token) => normalizeUnitToken(token))
        .filter((token) => token.length > 1 || /\d/.test(token))
        .filter((token) => (removeGeneric ? !GENERIC_KEYWORDS.has(token) : true));
};

const buildCharNgramCounts = (value, size = 3) => {
    const normalized = normalizeMatchValue(value).replace(/\s+/g, "");
    if (!normalized) return new Map();

    const gramSize = normalized.length < size ? Math.max(1, normalized.length) : size;
    const counts = new Map();
    for (let index = 0; index <= normalized.length - gramSize; index += 1) {
        const token = normalized.slice(index, index + gramSize);
        counts.set(token, (counts.get(token) || 0) + 1);
    }
    if (counts.size === 0) {
        counts.set(normalized, 1);
    }
    return counts;
};

const getCosineSimilarity = (left, right) => {
    const leftCounts = buildCharNgramCounts(left);
    const rightCounts = buildCharNgramCounts(right);
    if (leftCounts.size === 0 || rightCounts.size === 0) return 0;

    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    leftCounts.forEach((count, token) => {
        leftNorm += count * count;
        dot += count * (rightCounts.get(token) || 0);
    });
    rightCounts.forEach((count) => {
        rightNorm += count * count;
    });
    if (leftNorm === 0 || rightNorm === 0) return 0;
    return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};

const buildStandardSearchText = (standard) => [
    standard?.main_category,
    standard?.category,
    standard?.sub_category,
    standard?.item_name
].filter(Boolean).join(" ");

const buildStandardItemText = (standard) => [
    standard?.sub_category,
    standard?.item_name
].filter(Boolean).join(" ");

const buildStandardConditionText = (standard) => [
    standard?.standard,
    standard?.crew_composition_text,
    standard?.productivity_type
].filter(Boolean).join(" ");

const isNormalizedMatch = (left, right) => {
    const normalizedLeft = normalizeMatchValue(left).replace(/\s+/g, "");
    const normalizedRight = normalizeMatchValue(right).replace(/\s+/g, "");
    if (!normalizedLeft || !normalizedRight) return false;
    return normalizedLeft === normalizedRight
        || normalizedLeft.includes(normalizedRight)
        || normalizedRight.includes(normalizedLeft);
};

const normalizeCategoryValue = (value) => normalizeMatchValue(value || "").replace(/\s+/g, "");

const isSameCategoryGroup = (leftStandard, rightStandard, { requireSubMatch = false } = {}) => {
    const leftMain = normalizeCategoryValue(leftStandard?.main_category);
    const rightMain = normalizeCategoryValue(rightStandard?.main_category);
    const leftCategory = normalizeCategoryValue(leftStandard?.category);
    const rightCategory = normalizeCategoryValue(rightStandard?.category);
    const leftSub = normalizeCategoryValue((leftStandard?.sub_category || "").replace(/\n/g, " "));
    const rightSub = normalizeCategoryValue((rightStandard?.sub_category || "").replace(/\n/g, " "));

    if (!leftMain || !rightMain || leftMain !== rightMain) return false;
    if (!leftCategory || !rightCategory || leftCategory !== rightCategory) return false;
    if (!leftSub || !rightSub) return !requireSubMatch;

    return leftSub === rightSub
        || leftSub.includes(rightSub)
        || rightSub.includes(leftSub);
};

const getBestTokenScore = (leftToken, rightTokens = []) => {
    if (!leftToken || rightTokens.length === 0) return { score: 0, token: "", type: "none" };

    let bestScore = 0;
    let bestToken = "";
    let bestType = "none";

    for (let index = 0; index < rightTokens.length; index += 1) {
        const rightToken = rightTokens[index];
        if (!rightToken) continue;

        let score = 0;
        let type = "none";

        if (leftToken === rightToken) {
            score = 1;
            type = "exact";
        } else if (leftToken.includes(rightToken) || rightToken.includes(leftToken)) {
            score = 0.85;
            type = "contained";
        } else {
            const cosine = getCosineSimilarity(leftToken, rightToken);
            if (cosine >= 0.85) {
                score = 0.75;
                type = "semantic";
            } else if (cosine >= 0.7) {
                score = 0.6;
                type = "semantic";
            } else if (cosine >= 0.55) {
                score = 0.45;
                type = "semantic";
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestToken = rightToken;
            bestType = type;
        }

        if (bestScore === 1) break;
    }

    return {
        score: bestScore,
        token: bestToken,
        type: bestType
    };
};

const compareTokenCollections = (leftTokens = [], rightTokens = []) => {
    if (leftTokens.length === 0 && rightTokens.length === 0) {
        return {
            score: 1,
            matched: [],
            partial: []
        };
    }
    if (leftTokens.length === 0 || rightTokens.length === 0) {
        return {
            score: 0,
            matched: [],
            partial: []
        };
    }

    const matched = [];
    const partial = [];
    let total = 0;

    leftTokens.forEach((leftToken) => {
        const best = getBestTokenScore(leftToken, rightTokens);
        total += best.score;
        if (best.type === "exact") {
            matched.push(leftToken);
        } else if (best.score > 0) {
            partial.push(`${leftToken}~${best.token}`);
        }
    });

    const coverage = total / Math.max(leftTokens.length, rightTokens.length);
    return {
        score: clamp01(coverage),
        matched: Array.from(new Set(matched)),
        partial: Array.from(new Set(partial))
    };
};

const extractActionTokens = (value) => {
    const normalized = normalizeMatchValue(value);
    if (!normalized) return [];

    const actions = [];
    ACTION_RULES.forEach((rule) => {
        if (rule.patterns.some((pattern) => pattern.test(normalized))) {
            actions.push(rule.key);
        }
    });
    return actions;
};

const getRangeOverlap = (leftRange, rightRange) => {
    const hasUnitMismatch = leftRange.unit && rightRange.unit && leftRange.unit !== rightRange.unit;
    if (hasUnitMismatch) return 0;

    const interMin = Math.max(leftRange.min, rightRange.min);
    const interMax = Math.min(leftRange.max, rightRange.max);
    if (interMax < interMin) return 0;

    const intersection = interMax - interMin;
    const union = Math.max(leftRange.max, rightRange.max) - Math.min(leftRange.min, rightRange.min);
    if (union <= 0) return 1;
    return clamp01(intersection / union);
};

const compareMeasures = (leftMeasures = [], rightMeasures = []) => {
    if (leftMeasures.length === 0 && rightMeasures.length === 0) {
        return { score: 1, numericOverlap: 1, unitConflict: false };
    }
    if (leftMeasures.length === 0 || rightMeasures.length === 0) {
        return { score: 0, numericOverlap: 0, unitConflict: false };
    }

    const leftUnits = new Set(leftMeasures.map((entry) => entry.unit).filter(Boolean));
    const rightUnits = new Set(rightMeasures.map((entry) => entry.unit).filter(Boolean));
    const sharedUnits = Array.from(leftUnits).filter((unit) => rightUnits.has(unit));
    const unitConflict = leftUnits.size > 0 && rightUnits.size > 0 && sharedUnits.length === 0;

    let total = 0;
    leftMeasures.forEach((leftMeasure) => {
        let best = 0;
        rightMeasures.forEach((rightMeasure) => {
            if (leftMeasure.unit && rightMeasure.unit && leftMeasure.unit !== rightMeasure.unit) return;
            const maxValue = Math.max(leftMeasure.value, rightMeasure.value, 1);
            const diffRatio = Math.abs(leftMeasure.value - rightMeasure.value) / maxValue;
            if (diffRatio === 0) {
                best = Math.max(best, 1);
            } else if (diffRatio <= 0.05) {
                best = Math.max(best, 0.9);
            } else if (diffRatio <= 0.15) {
                best = Math.max(best, 0.75);
            } else if (diffRatio <= 0.3) {
                best = Math.max(best, 0.5);
            } else if (diffRatio <= 0.5) {
                best = Math.max(best, 0.3);
            }
        });
        total += best;
    });

    return {
        score: clamp01(total / Math.max(leftMeasures.length, rightMeasures.length)),
        numericOverlap: getOverlapRatio(
            leftMeasures.map((entry) => `${entry.value.toFixed(2)}${entry.unit}`),
            rightMeasures.map((entry) => `${entry.value.toFixed(2)}${entry.unit}`)
        ),
        unitConflict
    };
};

const compareRanges = (leftRanges = [], rightRanges = []) => {
    if (leftRanges.length === 0 && rightRanges.length === 0) {
        return { score: 1, conflict: false };
    }
    if (leftRanges.length === 0 || rightRanges.length === 0) {
        return { score: 0, conflict: false };
    }

    let total = 0;
    leftRanges.forEach((leftRange) => {
        let best = 0;
        rightRanges.forEach((rightRange) => {
            best = Math.max(best, getRangeOverlap(leftRange, rightRange));
        });
        total += best;
    });

    const score = clamp01(total / Math.max(leftRanges.length, rightRanges.length));
    return {
        score,
        conflict: score === 0
    };
};

const compareConditionText = (left, right) => {
    const leftText = String(left ?? "").trim();
    const rightText = String(right ?? "").trim();
    const leftHas = leftText.length > 0;
    const rightHas = rightText.length > 0;

    if (!leftHas && !rightHas) {
        return {
            similarity: 1,
            numericOverlap: 1,
            conflict: false,
            conflicts: []
        };
    }

    if (!leftHas && rightHas) {
        return {
            similarity: 0.7,
            numericOverlap: 0,
            conflict: false,
            conflicts: []
        };
    }

    if (leftHas && !rightHas) {
        return {
            similarity: 0.2,
            numericOverlap: 0,
            conflict: true,
            conflicts: ["source has condition but target has none"]
        };
    }

    const textScore = getCosineSimilarity(leftText, rightText);
    const numberOverlap = getOverlapRatio(
        extractNumberTokens(leftText).map((num) => num.toFixed(2)),
        extractNumberTokens(rightText).map((num) => num.toFixed(2))
    );
    const dimensionOverlap = getOverlapRatio(extractDimensionTokens(leftText), extractDimensionTokens(rightText));
    const measureCompare = compareMeasures(extractMeasureTokens(leftText), extractMeasureTokens(rightText));
    const rangeCompare = compareRanges(extractRangeTokens(leftText), extractRangeTokens(rightText));

    const numericBlend = Math.max(numberOverlap, dimensionOverlap, measureCompare.numericOverlap, measureCompare.score);
    const numericOverlap = Math.max(numberOverlap, dimensionOverlap, measureCompare.numericOverlap);

    const hasNumberConflict = numberOverlap === 0
        && dimensionOverlap === 0
        && measureCompare.score === 0
        && rangeCompare.score === 0
        && textScore < 0.35
        && extractNumberTokens(leftText).length > 0
        && extractNumberTokens(rightText).length > 0;

    const conflicts = [];
    if (measureCompare.unitConflict) {
        conflicts.push("condition unit conflict");
    }
    if (rangeCompare.conflict) {
        conflicts.push("range does not overlap");
    }
    if (hasNumberConflict) {
        conflicts.push("numeric condition conflict");
    }

    const conflict = measureCompare.unitConflict || rangeCompare.conflict || hasNumberConflict;

    if (conflict) {
        return {
            similarity: 0,
            numericOverlap,
            conflict: true,
            conflicts
        };
    }

    const blended = clamp01(
        (textScore * 0.25)
        + (numericBlend * 0.55)
        + (rangeCompare.score * 0.15)
        + (measureCompare.score * 0.05)
    );

    return {
        similarity: blended,
        numericOverlap,
        conflict: false,
        conflicts
    };
};

const buildRowContext = (row = {}, pastedValuesByField = {}) => {
    const process = pastedValuesByField.process ?? row?.process ?? "";
    const subProcess = pastedValuesByField.sub_process ?? row?.sub_process ?? "";
    const workType = pastedValuesByField.work_type ?? row?.work_type ?? "";
    const standard = pastedValuesByField.quantity_formula ?? row?.quantity_formula ?? "";
    const note = pastedValuesByField.note ?? row?.note ?? "";
    const remarks = pastedValuesByField.remarks ?? row?.remarks ?? "";
    const unit = pastedValuesByField.unit ?? row?.unit ?? "";
    const sourceConditionText = [standard, note, remarks].filter(Boolean).join(" ");

    const identityText = [workType, subProcess, process].filter(Boolean).join(" ");
    const hasCategoryContext = Boolean(process || subProcess);
    const inferredCategory = hasCategoryContext
        ? null
        : inferCategoryFromText(workType || identityText);

    return {
        process,
        subProcess,
        workType,
        standard,
        note,
        remarks,
        sourceConditionText,
        unit,
        identityText,
        searchText: [process, subProcess, workType].filter(Boolean).join(" "),
        itemTokens: tokenize(workType || subProcess || process, { removeGeneric: true }),
        identityTokens: tokenize(identityText, { removeGeneric: true }),
        standardTokens: tokenize(sourceConditionText),
        categoryTokens: tokenize([process, subProcess].filter(Boolean).join(" "), { removeGeneric: true }),
        workActionTokens: extractActionTokens(workType || subProcess || process),
        unitNormalized: normalizeUnitValue(unit),
        inferredCategory
    };
};

const matchesInferredCategory = (candidate, inferred) => {
    if (!inferred) return false;
    const candMain = normalizeMatchValue(candidate?.main_category || "").replace(/\s+/g, "");
    const infMain = normalizeMatchValue(inferred.main_category || "").replace(/\s+/g, "");
    if (candMain !== infMain) return false;
    if (inferred.category) {
        const candCat = normalizeMatchValue(candidate?.category || "").replace(/\s+/g, "");
        const infCat = normalizeMatchValue(inferred.category || "").replace(/\s+/g, "");
        if (!candCat.includes(infCat) && !infCat.includes(candCat)) return false;
    }
    if (inferred.sub_category) {
        const candSub = normalizeMatchValue((candidate?.sub_category || "").replace(/\n/g, " ")).replace(/\s+/g, "");
        const infSub = normalizeMatchValue(inferred.sub_category || "").replace(/\s+/g, "");
        if (!candSub.includes(infSub) && !infSub.includes(candSub)) return false;
    }
    return true;
};

const filterCandidates = (candidates, rowContext) => {
    const unitMatched = rowContext.unitNormalized
        ? candidates.filter((candidate) => normalizeUnitValue(candidate?.unit) === rowContext.unitNormalized)
        : candidates;

    const unitPool = unitMatched.length > 0 ? unitMatched : candidates;

    // process/sub_process 없을 때 카테고리 추론으로 후보군 먼저 좁히기
    if (rowContext.inferredCategory) {
        const categoryFiltered = unitPool.filter((candidate) =>
            matchesInferredCategory(candidate, rowContext.inferredCategory)
        );
        if (categoryFiltered.length > 0) return categoryFiltered;
    }

    const coreKeywords = rowContext.itemTokens.length > 0 ? rowContext.itemTokens : rowContext.identityTokens;

    const keywordMatched = coreKeywords.length > 0
        ? unitPool.filter((candidate) => {
            const candidateTokens = tokenize(buildStandardSearchText(candidate), { removeGeneric: true });
            return coreKeywords.some((token) => candidateTokens.includes(token));
        })
        : unitPool;

    const keywordPool = keywordMatched.length > 0 ? keywordMatched : unitPool;

    const processMatched = rowContext.process || rowContext.subProcess
        ? keywordPool.filter((candidate) => {
            const categoryText = [candidate?.category, candidate?.sub_category].filter(Boolean).join(" ");
            return isNormalizedMatch(rowContext.process, categoryText)
                || isNormalizedMatch(rowContext.subProcess, categoryText)
                || getCosineSimilarity(rowContext.searchText, buildStandardSearchText(candidate)) >= 0.35;
        })
        : keywordPool;

    return processMatched.length > 0 ? processMatched : keywordPool;
};

const buildMiniSearch = (candidates) => {
    const miniSearch = new MiniSearch({
        idField: "matchKey",
        fields: ["item_name", "item_terms", "search_text", "standard_text"],
        storeFields: ["matchKey"],
        searchOptions: {
            boost: {
                item_name: 5,
                item_terms: 3,
                search_text: 2,
                standard_text: 1
            },
            prefix: true,
            fuzzy: 0.15
        },
        tokenize: (value) => tokenize(value),
        processTerm: (term) => {
            const normalized = normalizeUnitToken(term);
            if (!normalized || GENERIC_KEYWORDS.has(normalized)) return null;
            return normalized;
        }
    });

    const documents = candidates.map((candidate, index) => ({
        matchKey: String(index),
        item_name: normalizeMatchValue(candidate?.item_name),
        item_terms: tokenize(buildStandardItemText(candidate), { removeGeneric: true }).join(" "),
        search_text: tokenize(buildStandardSearchText(candidate), { removeGeneric: true }).join(" "),
        standard_text: tokenize(buildStandardConditionText(candidate)).join(" ")
    }));

    miniSearch.addAll(documents);
    return miniSearch;
};

const normalizeMiniSearchScores = (results = []) => {
    const maxScore = Math.max(...results.map((result) => result.score || 0), 0);
    if (maxScore <= 0) {
        return new Map();
    }
    return new Map(
        results.map((result) => [String(result.id), Math.min(1, (result.score || 0) / maxScore)])
    );
};

const mergeMiniSearchScores = (...scoreMaps) => {
    const merged = new Map();
    scoreMaps.forEach((scoreMap, mapIndex) => {
        const weight = mapIndex === 0 ? 0.55 : mapIndex === 1 ? 0.3 : 0.15;
        scoreMap.forEach((score, key) => {
            merged.set(key, (merged.get(key) || 0) + (score * weight));
        });
    });
    return merged;
};

const rankLexicalCandidates = (candidates, rowContext, limit = 8) => {
    if (!candidates.length) return [];

    const miniSearch = buildMiniSearch(candidates);
    const itemQuery = rowContext.itemTokens.join(" ").trim();
    const identityQuery = rowContext.identityTokens.join(" ").trim();
    const standardQuery = rowContext.standardTokens.join(" ").trim();

    const itemScores = itemQuery
        ? normalizeMiniSearchScores(miniSearch.search(itemQuery, { combineWith: "AND" }))
        : new Map();
    const identityScores = identityQuery
        ? normalizeMiniSearchScores(miniSearch.search(identityQuery))
        : new Map();
    const standardScores = standardQuery
        ? normalizeMiniSearchScores(miniSearch.search(standardQuery, { fields: ["standard_text"], prefix: false, fuzzy: 0.1 }))
        : new Map();
    const mergedScores = mergeMiniSearchScores(itemScores, identityScores, standardScores);

    return candidates
        .map((candidate, index) => ({
            candidate,
            lexicalScore: mergedScores.get(String(index)) || 0
        }))
        .filter((entry) => entry.lexicalScore > 0)
        .sort((left, right) => right.lexicalScore - left.lexicalScore)
        .slice(0, limit);
};

const buildFallbackShortlist = (candidates, rowContext, limit = 24) => {
    if (!Array.isArray(candidates) || candidates.length === 0) return [];
    return candidates
        .map((candidate) => ({
            candidate,
            lexicalScore: Math.max(
                getCosineSimilarity(rowContext.identityText, buildStandardSearchText(candidate)),
                getCosineSimilarity(rowContext.workType, candidate?.item_name),
                getCosineSimilarity(rowContext.searchText, [candidate?.category, candidate?.sub_category].filter(Boolean).join(" "))
            )
        }))
        .sort((left, right) => right.lexicalScore - left.lexicalScore)
        .slice(0, limit);
};

const getWorkSimilarity = (rowContext, standardText) => {
    const candidateActions = extractActionTokens(standardText);
    const actionScore = getOverlapRatio(rowContext.workActionTokens, candidateActions);

    const fallbackTextScore = Math.max(
        getCosineSimilarity(rowContext.workType, standardText),
        getCosineSimilarity(rowContext.identityText, standardText)
    );

    if (rowContext.workActionTokens.length === 0 && candidateActions.length === 0) {
        return {
            score: clamp01(Math.max(0.6, fallbackTextScore)),
            partial: []
        };
    }

    const blended = clamp01((actionScore * 0.7) + (fallbackTextScore * 0.3));
    return {
        score: blended,
        partial: rowContext.workActionTokens.length > 0 && candidateActions.length > 0 && actionScore < 1
            ? rowContext.workActionTokens.map((action) => `${action}~작업동작`).slice(0, 2)
            : []
    };
};

const scoreCandidate = (standard, rowContext) => {
    const standardItemText = buildStandardItemText(standard);
    const standardSearchText = buildStandardSearchText(standard);
    const standardCategoryText = [standard?.category, standard?.sub_category].filter(Boolean).join(" ");
    const standardUnit = normalizeUnitValue(standard?.unit);

    const sourceCoreTokens = rowContext.itemTokens.length > 0 ? rowContext.itemTokens : rowContext.identityTokens;
    const targetCoreTokens = tokenize([standard?.item_name, standard?.sub_category].filter(Boolean).join(" "), { removeGeneric: true });
    const tokenCompare = compareTokenCollections(sourceCoreTokens, targetCoreTokens);

    const categoryCompare = compareTokenCollections(
        rowContext.categoryTokens,
        tokenize(standardCategoryText, { removeGeneric: true })
    );

    const workSimilarityMeta = getWorkSimilarity(rowContext, [standardItemText, standardCategoryText].join(" "));

    const conditionMeta = compareConditionText(rowContext.sourceConditionText, buildStandardConditionText(standard));

    const hasUnitSource = Boolean(rowContext.unitNormalized);
    const hasUnitTarget = Boolean(standardUnit);
    const hasUnitMismatch = Boolean(hasUnitSource && hasUnitTarget && rowContext.unitNormalized !== standardUnit);

    let unitSimilarity = 0;
    if (!hasUnitSource && !hasUnitTarget) {
        unitSimilarity = 1;
    } else if (hasUnitSource && hasUnitTarget) {
        unitSimilarity = rowContext.unitNormalized === standardUnit ? 1 : 0;
    } else {
        unitSimilarity = 0.4;
    }

    const weightedScore = clamp01(
        (tokenCompare.score * 0.4)
        + (categoryCompare.score * 0.2)
        + (workSimilarityMeta.score * 0.15)
        + (conditionMeta.similarity * 0.15)
        + (unitSimilarity * 0.1)
    );

    const unitPenalty = hasUnitMismatch ? 0.35 : 0;
    const conditionPenalty = conditionMeta.conflict ? 0.25 : 0;

    const totalScore = clamp01(weightedScore - unitPenalty - conditionPenalty);

    const matchedTokens = Array.from(new Set([
        ...tokenCompare.matched,
        ...categoryCompare.matched
    ])).slice(0, 12);

    const partiallyMatchedTokens = Array.from(new Set([
        ...tokenCompare.partial,
        ...categoryCompare.partial,
        ...workSimilarityMeta.partial
    ])).slice(0, 12);

    const conflictingConditions = [
        ...(hasUnitMismatch ? [`unit mismatch: ${rowContext.unitNormalized} vs ${standardUnit}`] : []),
        ...conditionMeta.conflicts
    ];

    return {
        standard,
        totalScore,
        tokenSimilarity: tokenCompare.score,
        categorySimilarity: categoryCompare.score,
        workSimilarity: workSimilarityMeta.score,
        conditionSimilarity: conditionMeta.similarity,
        unitSimilarity,
        matchedTokens,
        partiallyMatchedTokens,
        conflictingConditions,

        // Backward-compatible debug keys
        itemNameSimilarity: tokenCompare.score,
        specSimilarity: conditionMeta.similarity,
        unitScore: unitSimilarity,
        numberScore: conditionMeta.numericOverlap,
        synonymScore: tokenCompare.score,
        categoryScore: categoryCompare.score,
        lexicalText: standardSearchText,
        hasUnitMismatch,
        hasSpecConflict: conditionMeta.conflict,
        equipmentScore: 0,
        equipmentConflict: false,
        hasCriticalConditionConflict: conditionMeta.conflict
    };
};

export const deriveStandardProductivity = (standard) => {
    if (standard?.molit_workload) {
        return { productivity: standard.molit_workload, remark: "국토부 가이드라인 물량 기준" };
    }
    if (standard?.pumsam_workload) {
        return { productivity: standard.pumsam_workload, remark: "표준품셈 물량 기준" };
    }
    return { productivity: 0, remark: "추천 기준 없음" };
};

export const evaluateStandardMatch = ({ row, standards = [], pastedValuesByField = {} }) => {
    const candidates = dedupeStandards(standards);
    const rowContext = buildRowContext(row, pastedValuesByField);

    if (candidates.length === 0) {
        return {
            standard: null,
            ranked: [],
            debug: {
                inputs: rowContext,
                filteredCandidateCount: 0,
                topCandidate: null,
                secondScore: 0,
                scoreGap: 0,
                decision: {
                    accepted: false,
                    reason: "no_candidates"
                }
            }
        };
    }

    const filteredCandidates = filterCandidates(candidates, rowContext);
    const lexicalShortlisted = rankLexicalCandidates(filteredCandidates, rowContext, 8);
    const shortlisted = lexicalShortlisted.length > 0
        ? lexicalShortlisted
        : buildFallbackShortlist(filteredCandidates, rowContext, 24);
    const ranked = shortlisted
        .map(({ candidate, lexicalScore }) => ({
            lexicalScore,
            ...scoreCandidate(candidate, rowContext)
        }))
        .filter((entry) => entry.totalScore > 0)
        .sort((left, right) => {
            if (right.totalScore !== left.totalScore) {
                return right.totalScore - left.totalScore;
            }
            return right.lexicalScore - left.lexicalScore;
        });

    if (ranked.length === 0) {
        return {
            standard: null,
            ranked: [],
            debug: {
                inputs: rowContext,
                filteredCandidateCount: filteredCandidates.length,
                topCandidate: null,
                secondScore: 0,
                scoreGap: 0,
                decision: {
                    accepted: false,
                    reason: "no_scored_candidates"
                }
            }
        };
    }

    const topCandidate = ranked[0];
    const secondScore = ranked[1]?.totalScore ?? 0;
    const scoreGap = topCandidate.totalScore - secondScore;
    const meetsUserThresholdRule = topCandidate.totalScore > 0.28;
    const hasUnitInput = Boolean(rowContext.unitNormalized);
    const hasHardUnitMismatch = hasUnitInput && topCandidate.hasUnitMismatch;
    const hasConditionConflict = topCandidate.hasCriticalConditionConflict;
    // 카테고리 추론으로 이미 후보군을 좁혔으면 token threshold 완화
    const tokenThreshold = rowContext.inferredCategory ? 0.12 : 0.2;
    const hasStrongInferredCategoryMatch = Boolean(
        rowContext.inferredCategory && matchesInferredCategory(topCandidate.standard, rowContext.inferredCategory)
    );
    const hasInsufficientTokenMatch = topCandidate.tokenSimilarity < tokenThreshold && !hasStrongInferredCategoryMatch;
    // 카테고리 추론 적용 시 같은 서브카테고리 내 조건 차이(간단/보통/복잡)는 모호하지 않은 것으로 처리
    const ambiguityGap = rowContext.inferredCategory ? 0.01 : 0.02;
    const nearTieCandidates = ranked.filter((entry, index) =>
        index > 0 && Math.abs(topCandidate.totalScore - entry.totalScore) < ambiguityGap
    );
    const hasSameCategoryNearTies = nearTieCandidates.length > 0 && nearTieCandidates.every((entry) =>
        isSameCategoryGroup(topCandidate.standard, entry.standard, { requireSubMatch: false })
    );
    const isAmbiguousTopMatch = secondScore > 0
        && scoreGap < ambiguityGap
        && topCandidate.totalScore < 0.55
        && !hasSameCategoryNearTies;
    const accepted = meetsUserThresholdRule
        && !hasHardUnitMismatch
        && !hasConditionConflict
        && !hasInsufficientTokenMatch
        && !isAmbiguousTopMatch;

    return {
        standard: accepted ? topCandidate.standard : null,
        ranked,
        debug: {
            inputs: rowContext,
            filteredCandidateCount: filteredCandidates.length,
            topCandidate,
            secondScore,
            scoreGap,
            decision: {
                accepted,
                reason: accepted
                    ? "accepted_user_threshold"
                    : "threshold_rejected",
                checks: {
                    meetsUserThresholdRule,
                    hasHardUnitMismatch,
                    hasConditionConflict,
                    hasInsufficientTokenMatch,
                    isAmbiguousTopMatch
                }
            }
        }
    };
};
