import { useState, useCallback, useRef, useMemo } from "react";
import { calculateItem } from "../utils/solver";
import { summarizeScheduleAiLog } from "../api/cpe/schedule_ai";
import toast from "react-hot-toast";
import { calculateTotalCalendarDays, getCriticalIds } from "../utils/scheduleCalculations";

const PROPOSAL_FIELDS = [
    { key: "crew_size", label: "투입 인원", type: "number", digits: 1 },
    { key: "productivity", label: "생산성", type: "number", digits: 2 },
    { key: "parallel_rate", label: "병행률", type: "number", digits: 1 },
    { key: "reflection_rate", label: "반영률", type: "number", digits: 1 },
    { key: "note", label: "비고", type: "text" }
];

const toNumber = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const valuesEqual = (before, after, type) => {
    if (type === "number") {
        const left = toNumber(before);
        const right = toNumber(after);
        if (left === null || right === null) return String(before ?? "") === String(after ?? "");
        return Math.abs(left - right) < 0.0001;
    }
    return String(before ?? "") === String(after ?? "");
};

const formatValue = (value, type, digits = 1) => {
    if (type === "number") {
        const parsed = toNumber(value);
        if (parsed === null) return "-";
        return parsed.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
    }
    return String(value ?? "").trim() || "-";
};

const buildProposalReason = (changes) => {
    const changedFields = changes.map((change) => change.field);
    if (changedFields.includes("crew_size") && changedFields.includes("productivity")) {
        return "크리티컬 공정 단축을 위해 인력과 생산성을 함께 조정한 제안입니다.";
    }
    if (changedFields.includes("crew_size")) {
        return "크리티컬 공정 병목 완화를 위해 투입 인원을 조정한 제안입니다.";
    }
    if (changedFields.includes("productivity")) {
        return "추가 인력 증원보다 생산성 조정이 유효한 구간으로 판단한 제안입니다.";
    }
    return "선택 범위의 일정 단축 가능성을 기준으로 생성한 제안입니다.";
};

const buildProposalCards = (originalItems, previewItems) => {
    if (!Array.isArray(originalItems) || !Array.isArray(previewItems)) return [];

    return previewItems
        .map((preview) => {
            const original = originalItems.find((item) => String(item.id) === String(preview.id));
            if (!original) return null;

            const changes = PROPOSAL_FIELDS
                .map((field) => {
                    const before = original[field.key];
                    const after = preview[field.key];
                    if (valuesEqual(before, after, field.type)) return null;
                    return {
                        field: field.key,
                        label: field.label,
                        before,
                        after,
                        beforeText: formatValue(before, field.type, field.digits),
                        afterText: formatValue(after, field.type, field.digits)
                    };
                })
                .filter(Boolean);

            if (changes.length === 0) return null;

            const beforeDays = toNumber(original.calendar_days) || 0;
            const afterDays = toNumber(preview.calendar_days) || 0;
            const savedDays = beforeDays - afterDays;
            const label = [preview.process, preview.work_type].filter(Boolean).join(" / ") || "공정";

            return {
                id: `proposal-${preview.id}`,
                itemId: preview.id,
                label,
                changes,
                status: "pending",
                reason: buildProposalReason(changes),
                impactSummary:
                    savedDays > 0
                        ? `예상 공기 ${savedDays.toFixed(1)}일 단축`
                        : "필드 조정 제안"
            };
        })
        .filter(Boolean);
};

const extractTargetDays = (requestText, currentTotal) => {
    const text = String(requestText || "").trim();
    if (!text) return null;

    const reduceMatch = text.match(/(\d+(?:\.\d+)?)\s*일\s*(단축|줄이|줄여|감축)/);
    if (reduceMatch) {
        const reducedDays = parseFloat(reduceMatch[1]);
        if (Number.isFinite(reducedDays) && Number.isFinite(currentTotal)) {
            return Math.max(1, Math.round(currentTotal - reducedDays));
        }
    }

    const targetMatch = text.match(/목표\s*공기[^\d]*(\d+(?:\.\d+)?)\s*일/);
    if (targetMatch) {
        const target = parseFloat(targetMatch[1]);
        if (Number.isFinite(target) && target > 0) return Math.round(target);
    }

    const toMatch = text.match(/(\d+(?:\.\d+)?)\s*일\s*로/);
    if (toMatch) {
        const target = parseFloat(toMatch[1]);
        if (Number.isFinite(target) && target > 0) return Math.round(target);
    }

    return null;
};

/**
 * Custom hook for AI-powered schedule optimization
 * @param {Array} items - Current schedule items
 * @param {Array} operatingRates - Operating rates
 * @param {string} workDayType - Work day type (e.g., "6d")
 * @param {string} projectName - Project name for AI summary
 * @param {Function} setStoreItems - Store setter for items
 * @param {Function} applyItemFieldChanges - Partial update helper for item fields
 * @returns {Object} AI optimizer state and handlers
 */
export const useAIScheduleOptimizer = (
    items,
    operatingRates,
    workDayType,
    projectName,
    setStoreItems,
    applyItemFieldChanges
) => {
    const aiOriginalRef = useRef(null);
    const [aiTargetDays, setAiTargetDays] = useState("");
    const [aiMode, setAiMode] = useState("idle"); // idle | running | success | fail
    const [aiLogs, setAiLogs] = useState([]);
    const [aiPreviewItems, setAiPreviewItems] = useState(null);
    const [aiActiveItemId, setAiActiveItemId] = useState(null);
    const [aiSummary, setAiSummary] = useState({ savedDays: 0, remainingDays: 0 });
    const [aiShowCompare, setAiShowCompare] = useState(false);
    const [aiThreadMessages, setAiThreadMessages] = useState([]);
    const [aiProposalCards, setAiProposalCards] = useState([]);

    const pendingProposalCount = useMemo(
        () => aiProposalCards.filter((proposal) => proposal.status === "pending").length,
        [aiProposalCards]
    );

    const totalDaysForItems = useCallback((list) => {
        return calculateTotalCalendarDays(list);
    }, []);

    const appendAiLog = useCallback((message, kind = "step") => {
        setAiLogs((prev) => [
            ...prev,
            { id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, kind, message }
        ]);
    }, []);

    const appendAiThreadMessage = useCallback((role, text) => {
        if (!String(text || "").trim()) return;
        setAiThreadMessages((prev) => [
            ...prev,
            {
                id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                role,
                text
            }
        ]);
    }, []);

    const syncOriginalRowFromPreview = useCallback((itemId, previewRow) => {
        if (!aiOriginalRef.current || !previewRow) return;
        aiOriginalRef.current = aiOriginalRef.current.map((item) =>
            String(item.id) === String(itemId) ? { ...previewRow } : item
        );
    }, []);

    const resetAiSession = useCallback(() => {
        setAiMode("idle");
        setAiPreviewItems(null);
        setAiActiveItemId(null);
        setAiLogs([]);
        setAiSummary({ savedDays: 0, remainingDays: 0 });
        setAiShowCompare(false);
        setAiThreadMessages([]);
        setAiProposalCards([]);
        aiOriginalRef.current = null;
    }, []);

    const runAiAdjustment = useCallback(async (requestText = "") => {
        const currentTotalDays = totalDaysForItems(items);
        const manualTarget = parseFloat(aiTargetDays);
        const derivedTarget = extractTargetDays(requestText, currentTotalDays);
        const target = Number.isFinite(manualTarget) && manualTarget > 0
            ? manualTarget
            : derivedTarget;

        if (!Number.isFinite(target) || target <= 0) {
            toast.error("목표 공기(일)를 입력하거나 요청 문장에 포함해주세요.");
            return;
        }

        if ((!Number.isFinite(manualTarget) || manualTarget <= 0) && derivedTarget) {
            setAiTargetDays(String(derivedTarget));
        }

        const requestMessage = String(requestText || "").trim()
            || `목표 공기 ${target}일 기준으로 조정안을 제안해줘.`;
        appendAiThreadMessage("user", requestMessage);
        appendAiThreadMessage("assistant", `선택된 공정을 검토해 목표 공기 ${target}일 기준의 수정 제안을 계산합니다.`);

        const aiItems = items.map((item) => ({
            ...item,
            base_productivity: parseFloat(item.base_productivity) || parseFloat(item.productivity) || 0
        }));
        aiOriginalRef.current = items.map((item) => ({ ...item }));
        setAiPreviewItems(aiItems);
        setAiActiveItemId(null);
        setAiLogs([]);
        setAiProposalCards([]);
        setAiShowCompare(false);
        setAiMode("running");
        appendAiLog("목표 공기 달성을 위한 조정안을 계산 중입니다…", "status");

        const MAX_CREW_INCREASE = 3;
        const PROD_STEP = 5;
        const MAX_PROD = 15;
        const ALPHA = 0.05;
        const MIN_EFF = 0.6;
        const efficiency = (crew, baseCrew) => {
            if (crew <= baseCrew) return 1;
            return Math.max(MIN_EFF, 1 - ALPHA * (crew - baseCrew));
        };

        let currentTotal = totalDaysForItems(aiItems);
        const initialTotal = currentTotal;
        let stepCount = 0;
        const stepSummaries = [];
        let lowSavedStreak = 0;
        const mode = "balanced";
        const weightPresets = {
            balanced: { saved: 1.0, crew: 0.4, prod: 0.2, congestion: 0.8 },
            min: { saved: 0.7, crew: 0.8, prod: 0.5, congestion: 1.0 },
            max: { saved: 1.4, crew: 0.2, prod: 0.1, congestion: 0.6 }
        };
        const weights = weightPresets[mode] || weightPresets.balanced;
        const optionMinSavedBase = Math.max(0.05, initialTotal * 0.002);
        const stopSavedBase = Math.max(0.02, initialTotal * 0.001);
        const optionMinSaved = Math.max(optionMinSavedBase, stopSavedBase * 1.5);
        const stopSaved = stopSavedBase;

        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        while (currentTotal > target && stepCount < 40) {
            const criticalIds = getCriticalIds(aiItems);
            let best = null;
            const failedItems = [];
            let anyOptionTested = false;

            for (const id of criticalIds) {
                const idx = aiItems.findIndex((i) => i.id === id);
                const originalItem = aiItems[idx];
                if (!originalItem) continue;

                const baseCrew = parseFloat(originalItem.crew_size) || 1;
                const baseProd = parseFloat(originalItem.base_productivity) || parseFloat(originalItem.productivity) || 0;
                if (!baseProd) continue;

                const testedRanges = { crew: [], prod: [] };
                let maxSaved = 0;
                let maxSavedInCp = false;
                let congestionLimited = true;
                let productivityCap = true;
                let constraintBlocked = false;

                const scoreOption = (saved, crewDelta, prodDelta, congestionHit) => {
                    return saved * weights.saved
                        - crewDelta * weights.crew
                        - prodDelta * weights.prod
                        - (congestionHit ? weights.congestion : 0);
                };

                const tryCrew = (delta) => {
                    if (delta > MAX_CREW_INCREASE) {
                        constraintBlocked = true;
                        return;
                    }
                    const newCrew = baseCrew + delta;
                    const eff = efficiency(newCrew, baseCrew);
                    if (eff <= MIN_EFF + 0.0001) {
                        return;
                    }
                    congestionLimited = false;
                    const newProd = baseProd * eff;
                    const candidate = calculateItem(
                        { ...originalItem, crew_size: newCrew, productivity: newProd, base_productivity: baseProd },
                        operatingRates,
                        workDayType
                    );
                    const testItems = aiItems.map((item, i) => (i === idx ? candidate : item));
                    const total = totalDaysForItems(testItems);
                    const saved = currentTotal - total;
                    maxSaved = Math.max(maxSaved, saved);
                    maxSavedInCp = maxSavedInCp || saved > 0;
                    anyOptionTested = true;
                    if (saved >= optionMinSaved) {
                        const score = scoreOption(saved, delta, 0, eff <= MIN_EFF + 0.0001);
                        if (!best || score > best.score || (Math.abs(score - best.score) < 0.0001 && saved > best.saved)) {
                            best = { type: "crew", delta, saved, total, item: candidate, itemIndex: idx, score };
                        }
                    }
                };

                const tryProd = (delta) => {
                    if (delta > MAX_PROD) {
                        constraintBlocked = true;
                        return;
                    }
                    productivityCap = false;
                    const newProd = baseProd * (1 + delta / 100);
                    const candidate = calculateItem(
                        { ...originalItem, productivity: newProd, base_productivity: baseProd },
                        operatingRates,
                        workDayType
                    );
                    const testItems = aiItems.map((item, i) => (i === idx ? candidate : item));
                    const total = totalDaysForItems(testItems);
                    const saved = currentTotal - total;
                    maxSaved = Math.max(maxSaved, saved);
                    maxSavedInCp = maxSavedInCp || saved > 0;
                    anyOptionTested = true;
                    if (saved >= optionMinSaved) {
                        const score = scoreOption(saved, 0, delta, false);
                        if (!best || score > best.score || (Math.abs(score - best.score) < 0.0001 && saved > best.saved)) {
                            best = { type: "prod", delta, saved, total, item: candidate, itemIndex: idx, score };
                        }
                    }
                };

                const crewSteps = [1];
                const prodSteps = [PROD_STEP];
                crewSteps.forEach((delta) => {
                    testedRanges.crew.push(delta);
                    tryCrew(delta);
                });
                prodSteps.forEach((delta) => {
                    testedRanges.prod.push(delta);
                    tryProd(delta);
                });

                if (!best || best.itemIndex !== idx) {
                    [2, 3].forEach((delta) => {
                        if (delta <= MAX_CREW_INCREASE) {
                            testedRanges.crew.push(delta);
                            tryCrew(delta);
                        }
                    });
                    [10, 15].forEach((delta) => {
                        if (delta <= MAX_PROD) {
                            testedRanges.prod.push(delta);
                            tryProd(delta);
                        }
                    });
                }

                if (!best || best.itemIndex !== idx) {
                    const reasons = [];
                    if (!maxSavedInCp) reasons.push("NOT_CRITICAL_AFTER_RECALC");
                    if (maxSaved < optionMinSaved) reasons.push("MICRO_SAVING");
                    if (congestionLimited) reasons.push("CONGESTION_LIMIT");
                    if (productivityCap) reasons.push("PRODUCTIVITY_CAP");
                    if (constraintBlocked) reasons.push("CONSTRAINT_BLOCKED");
                    if (reasons.length === 0) reasons.push("MICRO_SAVING");

                    appendAiLog(
                        `${originalItem.process || "공정"}: 유효 옵션 없음 (${reasons.join(", ")})`,
                        "status"
                    );
                    appendAiLog(
                        `테스트 범위: 인력 +${testedRanges.crew.join("/") || "없음"}, 생산성 +${testedRanges.prod.join("/") || "없음"}%. 최대 saved ${maxSaved.toFixed(2)}일, CP 반영 ${maxSavedInCp ? "있음" : "없음"}.`,
                        "reason"
                    );
                    failedItems.push(originalItem.id);
                }
            }

            if (!best || best.saved < optionMinSaved) {
                if (!anyOptionTested || failedItems.length === criticalIds.length) {
                    appendAiLog("크리티컬 공정에서 유효한 단축 옵션이 더 이상 없습니다.", "status");
                    break;
                }
                appendAiLog("현재 크리티컬 공정 중 일부는 유효 옵션이 없어 다음 공정으로 이동합니다.", "status");
                lowSavedStreak += 1;
                if (lowSavedStreak >= 3) {
                    appendAiLog(`최근 ${lowSavedStreak}회 연속 단축 효과가 미미합니다.`, "status");
                    break;
                }
                await wait(200);
                continue;
            }

            aiItems[best.itemIndex] = best.item;
            currentTotal = best.total;
            stepCount += 1;
            lowSavedStreak = best.saved < stopSaved ? lowSavedStreak + 1 : 0;
            setAiPreviewItems([...aiItems]);
            setAiActiveItemId(best.item.id);
            setAiSummary({ savedDays: initialTotal - currentTotal, remainingDays: Math.max(0, currentTotal - target) });

            const label = best.type === "crew"
                ? `인력 +${best.delta}`
                : `생산성 +${best.delta}%`;
            appendAiLog(`${best.item.process || "공정"} ${label} → -${best.saved.toFixed(1)}일`, "step");
            stepSummaries.push(`${best.item.process || "공정"} ${label} → -${best.saved.toFixed(1)}일`);
            if (best.type === "crew") {
                appendAiLog(
                    `근거: 크리티컬 공정의 병목을 해소하기 위해 인력 증원을 우선 적용했습니다. 인원 증가에 따른 효율계수(최소 ${MIN_EFF.toFixed(2)})를 고려해 단축 효과가 유효한 구간에서만 조정합니다.`,
                    "reason"
                );
            } else {
                appendAiLog(
                    `근거: 추가 인력 투입의 한계효용이 낮아지는 구간으로 판단되어 생산성 증가로 전환했습니다.`,
                    "reason"
                );
            }
            appendAiLog(
                `누적 단축: -${(initialTotal - currentTotal).toFixed(1)}일, 남은 목표: ${Math.max(0, currentTotal - target).toFixed(1)}일`,
                "summary"
            );
            await wait(350);
        }

        if (currentTotal <= target) {
            setAiMode("success");
            appendAiLog(`목표 공기 ${target}일 달성`, "result");
            appendAiLog(
                `요약: 조정 공정 ${aiItems.filter((item, idx) => item.calendar_days !== items[idx]?.calendar_days).length}개, 총 단축 -${(initialTotal - currentTotal).toFixed(1)}일`,
                "summary"
            );
        } else {
            setAiMode("fail");
            appendAiLog(`자원 조정만으로는 ${initialTotal - currentTotal}일 단축까지 가능합니다.`, "result");
            appendAiLog(
                `실패 원인: 자원 조정 한계 및 한계효용 임계치(${MIN_EFF.toFixed(2)})에 도달했습니다.`,
                "reason"
            );
        }

        const proposals = buildProposalCards(aiOriginalRef.current, aiItems);
        setAiProposalCards(proposals);
        if (proposals.length > 0) {
            appendAiThreadMessage("assistant", `${proposals.length}개의 수정 제안을 준비했습니다. 카드별로 사용 여부를 결정해주세요.`);
        } else {
            appendAiThreadMessage("assistant", "적용 가능한 수정 제안을 찾지 못했습니다. 목표 공기 또는 요청 조건을 조정해 다시 시도해주세요.");
        }

        try {
            const response = await summarizeScheduleAiLog({
                project_name: projectName || "프로젝트",
                target_days: target,
                current_days: Number.isFinite(currentTotal) ? currentTotal.toFixed(1) : "",
                saved_days: Number.isFinite(initialTotal - currentTotal)
                    ? (initialTotal - currentTotal).toFixed(1)
                    : "",
                remaining_days: Math.max(0, currentTotal - target).toFixed(1),
                status: currentTotal <= target ? "success" : "fail",
                critical_steps: stepSummaries.join(" / "),
                constraints:
                    currentTotal <= target
                        ? `효율계수 최소 ${MIN_EFF.toFixed(2)} 기준`
                        : `효율계수 최소 ${MIN_EFF.toFixed(2)} 기준 및 추가 단축 한계`,
                cp_notes: "크리티컬 패스 기반 조정 결과입니다."
            });
            const summaryText = response?.data?.summary;
            if (summaryText) {
                appendAiLog(summaryText, "summary");
                appendAiThreadMessage("assistant", summaryText);
            }
        } catch (error) {
            console.error("AI 요약 생성 실패:", error);
        }
    }, [aiTargetDays, appendAiLog, appendAiThreadMessage, items, operatingRates, projectName, totalDaysForItems, workDayType]);

    const handleAiCancel = useCallback(() => {
        resetAiSession();
    }, [resetAiSession]);

    const handleAiApply = useCallback(async (confirm) => {
        if (!aiPreviewItems || aiPreviewItems.length === 0 || pendingProposalCount === 0) return;
        const ok = await confirm(`대기 중인 ${pendingProposalCount}개 제안을 모두 적용하시겠습니까?`);
        if (!ok) return;

        setStoreItems(aiPreviewItems);
        aiOriginalRef.current = aiPreviewItems.map((item) => ({ ...item }));
        setAiProposalCards((prev) => prev.map((proposal) => (
            proposal.status === "pending" ? { ...proposal, status: "applied" } : proposal
        )));
        appendAiThreadMessage("assistant", `대기 중인 ${pendingProposalCount}개 제안을 모두 반영했습니다.`);
    }, [aiPreviewItems, appendAiThreadMessage, pendingProposalCount, setStoreItems]);

    const handleProposalApply = useCallback(async (proposal, confirm) => {
        if (!proposal || proposal.status !== "pending") return;
        const ok = await confirm(`${proposal.label} 제안을 적용하시겠습니까?`);
        if (!ok) return;

        const fieldChanges = proposal.changes.map((change) => ({
            id: proposal.itemId,
            field: change.field,
            value: change.after
        }));
        applyItemFieldChanges(fieldChanges);

        const previewRow = aiPreviewItems?.find((item) => String(item.id) === String(proposal.itemId));
        if (previewRow) {
            syncOriginalRowFromPreview(proposal.itemId, previewRow);
            setAiPreviewItems((prev) => prev?.map((item) =>
                String(item.id) === String(proposal.itemId) ? { ...previewRow } : item
            ) || prev);
        }

        setAiProposalCards((prev) => prev.map((item) =>
            item.id === proposal.id ? { ...item, status: "applied" } : item
        ));
        appendAiThreadMessage("assistant", `${proposal.label} 제안을 반영했습니다.`);
        setAiActiveItemId(null);
    }, [aiPreviewItems, appendAiThreadMessage, applyItemFieldChanges, syncOriginalRowFromPreview]);

    const handleProposalReject = useCallback((proposal) => {
        if (!proposal || proposal.status !== "pending") return;

        const originalRow = aiOriginalRef.current?.find((item) => String(item.id) === String(proposal.itemId));
        if (originalRow) {
            setAiPreviewItems((prev) => prev?.map((item) =>
                String(item.id) === String(proposal.itemId) ? { ...originalRow } : item
            ) || prev);
        }

        setAiProposalCards((prev) => prev.map((item) =>
            item.id === proposal.id ? { ...item, status: "rejected" } : item
        ));
        appendAiThreadMessage("assistant", `${proposal.label} 제안을 거절했습니다.`);
        setAiActiveItemId(null);
    }, [appendAiThreadMessage]);

    const aiDisplayItems = aiPreviewItems || items;

    return {
        aiOriginalRef,
        aiTargetDays,
        setAiTargetDays,
        aiMode,
        aiLogs,
        aiPreviewItems,
        aiActiveItemId,
        aiSummary,
        aiShowCompare,
        setAiShowCompare,
        aiDisplayItems,
        aiThreadMessages,
        aiProposalCards,
        pendingProposalCount,
        runAiAdjustment,
        handleAiCancel,
        handleAiApply,
        handleProposalApply,
        handleProposalReject,
        resetAiSession
    };
};
