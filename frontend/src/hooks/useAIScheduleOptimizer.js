import { useState, useCallback, useRef } from "react";
import { calculateItem } from "../utils/solver";
import { summarizeScheduleAiLog } from "../api/cpe/schedule_ai";
import toast from "react-hot-toast";
import { calculateTotalCalendarDays, getCriticalIds } from "../utils/scheduleCalculations";

/**
 * Custom hook for AI-powered schedule optimization
 * @param {Array} items - Current schedule items
 * @param {Array} operatingRates - Operating rates
 * @param {string} workDayType - Work day type (e.g., "6d")
 * @param {string} projectName - Project name for AI summary
 * @param {Function} setStoreItems - Store setter for items
 * @returns {Object} AI optimizer state and handlers
 */
export const useAIScheduleOptimizer = (items, operatingRates, workDayType, projectName, setStoreItems) => {
    const aiOriginalRef = useRef(null);
    const [aiTargetDays, setAiTargetDays] = useState("");
    const [aiMode, setAiMode] = useState("idle"); // idle | running | success | fail | cancelled
    const [aiLogs, setAiLogs] = useState([]);
    const [aiPreviewItems, setAiPreviewItems] = useState(null);
    const [aiActiveItemId, setAiActiveItemId] = useState(null);
    const [aiSummary, setAiSummary] = useState({ savedDays: 0, remainingDays: 0 });
    const [aiShowCompare, setAiShowCompare] = useState(false);

    // Helper to calculate total days for items (duplicated from main for encapsulation)
    const totalDaysForItems = useCallback((list) => {
        return calculateTotalCalendarDays(list);
    }, []);

    const appendAiLog = useCallback((message, kind = "step") => {
        setAiLogs((prev) => [
            ...prev,
            { id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, kind, message }
        ]);
    }, []);

    const runAiAdjustment = useCallback(async () => {
        const target = parseFloat(aiTargetDays);
        if (!Number.isFinite(target) || target <= 0) {
            toast.error("목표 공기(일)를 입력해주세요.");
            return;
        }

        const aiItems = items.map((item) => ({
            ...item,
            base_productivity: parseFloat(item.base_productivity) || parseFloat(item.productivity) || 0
        }));
        aiOriginalRef.current = items.map((item) => ({ ...item }));
        setAiPreviewItems(aiItems);
        setAiActiveItemId(null);
        setAiLogs([]);
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
            }
        } catch (error) {
            console.error("AI 요약 생성 실패:", error);
        }
    }, [aiTargetDays, appendAiLog, items, operatingRates, projectName, totalDaysForItems, workDayType]);

    const handleAiCancel = useCallback(() => {
        setAiMode("cancelled");
        setAiPreviewItems(null);
        setAiActiveItemId(null);
        setAiLogs([]);
        setAiSummary({ savedDays: 0, remainingDays: 0 });
        setAiShowCompare(false);
    }, []);

    const handleAiApply = useCallback(async (confirm) => {
        if (!aiPreviewItems || aiPreviewItems.length === 0) return;
        const ok = await confirm("AI 조정안을 적용하시겠습니까?");
        if (!ok) return;
        setStoreItems(aiPreviewItems);
        handleAiCancel();
    }, [aiPreviewItems, handleAiCancel, setStoreItems]);

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
        runAiAdjustment,
        handleAiCancel,
        handleAiApply
    };
};
