import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { saveScheduleData } from "../../../api/cpe_all/construction_schedule";
import useScheduleMasterTable from "./useScheduleMasterTable";
import { getCategoryManualTotalDays } from "../../../utils/scheduleCalculations";
import { getSelectableOperatingRates } from "../../../utils/operatingRateKeys";
import { deriveStandardProductivity, evaluateStandardMatch } from "../../../utils/standardMatcher";

const createPastedScheduleItem = (sourceItem = {}, index = 0) => {
    const cpChecked = sourceItem?.cp_checked !== false;

    return {
        id: `paste-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        main_category: sourceItem?.main_category || "기타",
        process: sourceItem?.process || "",
        sub_process: sourceItem?.sub_process || "",
        work_type: sourceItem?.work_type || "",
        unit: sourceItem?.unit || "",
        quantity: sourceItem?.quantity ?? "",
        quantity_formula: sourceItem?.quantity_formula || "",
        productivity: sourceItem?.productivity ?? "",
        crew_size: sourceItem?.crew_size ?? 1,
        note: sourceItem?.note || "",
        remarks: sourceItem?.remarks || "",
        standard_code: sourceItem?.standard_code || "",
        operating_rate_type: sourceItem?.operating_rate_type || "EARTH",
        operating_rate_value: sourceItem?.operating_rate_value ?? 0,
        operating_rate_key: sourceItem?.operating_rate_key || "",
        cp_checked: cpChecked,
        parallel_rate: sourceItem?.parallel_rate ?? (cpChecked ? 0 : 100),
        application_rate: sourceItem?.application_rate ?? sourceItem?.parallel_rate ?? 100,
        reflection_rate: sourceItem?.reflection_rate ?? 100,
        category_total_days: sourceItem?.category_total_days ?? null
    };
};

const buildStandardNoteText = (standard, fallbackNote = "") => {
    if (!standard) return String(fallbackNote || "");

    const remark = standard?.molit_workload
        ? "국토부 가이드라인 물량 기준"
        : standard?.pumsam_workload
            ? "표준품셈 물량 기준"
            : "추천 기준 없음";
    const tocLabel = standard?.item_name || "";

    return tocLabel ? `${tocLabel} (${remark})` : (String(fallbackNote || "") || remark);
};

export default function useScheduleMasterTableFeature({
    items,
    operatingRates,
    links,
    subTasks,
    projectId,
    containerId,
    viewMode,
    confirm,
    addItem,
    addItemAtIndex,
    insertItemsAtIndex,
    deleteItems,
    reorderItems,
    updateItem,
    updateItemsField,
    applyItemFieldChanges,
    updateOperatingRate,
    setStoreOperatingRates,
    canRedo,
    canUndo,
    onOpenImport,
    onOpenEvidence,
    onOpenFloorBatchModal,
    onOpenRowClassEdit,
    onRedo,
    onUndo,
    standardItems = []
}) {
    const [newMainCategory, setNewMainCategory] = useState("");
    const buildPasteItems = useCallback((sourceItem, count) => {
        const safeCount = Math.max(0, Number(count) || 0);
        return Array.from({ length: safeCount }, (_, index) => createPastedScheduleItem(sourceItem, index));
    }, []);

    const evaluateStandardForPastedRow = useCallback((row, pastedValuesByField = {}) => {
        return evaluateStandardMatch({
            row,
            standards: standardItems,
            pastedValuesByField
        });
    }, [standardItems]);

    const applyPasteStandardRecommendations = useCallback((pastedRows = []) => {
        if (!Array.isArray(pastedRows) || pastedRows.length === 0) return;

        const recommendationChanges = [];
        const highlightedCellKeys = [];
        let appliedRowCount = 0;

        pastedRows.forEach(({ id, row, changedFields, rawValues, pastedValuesByField }) => {
            const changedFieldSet = new Set(Array.isArray(changedFields) ? changedFields : []);
            const changedIdentity = ["process", "sub_process", "work_type", "quantity_formula", "unit"].some(
                (field) => changedFieldSet.has(field)
            );
            const pastedProductivityRaw = String(pastedValuesByField?.productivity ?? "").trim();
            const pastedCrewSizeRaw = String(pastedValuesByField?.crew_size ?? "").trim();
            const pastedNoteRaw = String(pastedValuesByField?.note ?? "").trim();
            const pastedRemarksRaw = String(pastedValuesByField?.remarks ?? "").trim();
            const normalizedPastedProductivity = pastedProductivityRaw.replace(/,/g, "");
            const pastedProductivityNumber = Number(normalizedPastedProductivity);
            const hasNumericPastedProductivity = normalizedPastedProductivity !== ""
                && Number.isFinite(pastedProductivityNumber);
            const isNumericLike = (value) => {
                const normalized = String(value || "").replace(/,/g, "").trim();
                return normalized !== "" && /^-?\d+(\.\d+)?$/.test(normalized);
            };
            const looksLikeShiftedCostColumns = changedIdentity
                && changedFieldSet.has("productivity")
                && changedFieldSet.has("crew_size")
                && (isNumericLike(pastedNoteRaw) || isNumericLike(pastedRemarksRaw))
                && (isNumericLike(pastedCrewSizeRaw) || pastedCrewSizeRaw === "");
            // 외부 내역서 행 전체 붙여넣기 시 원가 단가/금액이 productivity 칸으로 들어오는 경우가 많다.
            // 0 또는 비정상적으로 큰 값(원가성 값)은 "명시 입력"으로 보지 않고 품셈 추천값을 우선 반영한다.
            const hasMeaningfulProductivityInput = hasNumericPastedProductivity
                ? pastedProductivityNumber > 0 && pastedProductivityNumber < 1000
                : pastedProductivityRaw !== "" && pastedProductivityRaw !== "-";
            const hasExplicitProductivityInput = changedFieldSet.has("productivity")
                && hasMeaningfulProductivityInput
                && !looksLikeShiftedCostColumns;
            const shouldAutoFillProductivity = !hasExplicitProductivityInput;

            if (!id || !changedIdentity) return;

            const evaluation = evaluateStandardForPastedRow(row, pastedValuesByField);
            const matchedStandard = evaluation.standard;

            console.groupCollapsed(
                `[paste-standard-match] row=${id} accepted=${evaluation.debug.decision.accepted}`
            );
            console.debug("rawValues", rawValues);
            console.debug("row", row);
            console.debug("inputs", evaluation.debug.inputs);
            console.debug("pastedValuesByField", pastedValuesByField);
            console.debug("decision", evaluation.debug.decision);
            console.table(
                evaluation.ranked.slice(0, 5).map((entry, index) => ({
                    rank: index + 1,
                    totalScore: Number(entry.totalScore.toFixed(4)),
                    lexicalScore: Number((entry.lexicalScore || 0).toFixed(4)),
                    itemNameSimilarity: Number(entry.itemNameSimilarity.toFixed(4)),
                    categoryScore: Number((entry.categoryScore || 0).toFixed(4)),
                    specSimilarity: Number(entry.specSimilarity.toFixed(4)),
                    unitScore: Number(entry.unitScore.toFixed(4)),
                    numberScore: Number(entry.numberScore.toFixed(4)),
                    synonymScore: Number(entry.synonymScore.toFixed(4)),
                    equipmentScore: Number((entry.equipmentScore || 0).toFixed(4)),
                    hasUnitMismatch: entry.hasUnitMismatch,
                    hasSpecConflict: entry.hasSpecConflict,
                    main_category: entry.standard?.main_category || "",
                    category: entry.standard?.category || entry.standard?.process_name || "",
                    sub_category: entry.standard?.sub_category || entry.standard?.work_type_name || "",
                    item_name: entry.standard?.item_name || "",
                    standard: entry.standard?.standard || "",
                    unit: entry.standard?.unit || ""
                }))
            );
            console.groupEnd();

            if (!matchedStandard) return;

            const { productivity } = deriveStandardProductivity(matchedStandard);
            if (shouldAutoFillProductivity && productivity !== "" && productivity !== null && productivity !== undefined) {
                recommendationChanges.push({
                    id,
                    field: "productivity",
                    value: productivity
                });
                highlightedCellKeys.push(`${id}::productivity`);
            }

            if (!changedFieldSet.has("note")) {
                const noteText = buildStandardNoteText(matchedStandard, row?.note || "");
                recommendationChanges.push({
                    id,
                    field: "note",
                    value: noteText
                });
                highlightedCellKeys.push(`${id}::note`);
                recommendationChanges.push({
                    id,
                    field: "remarks",
                    value: noteText
                });
            }

            if (shouldAutoFillProductivity || !changedFieldSet.has("note")) {
                appliedRowCount += 1;
            }
        });

        if (recommendationChanges.length === 0 || appliedRowCount === 0) return [];

        applyItemFieldChanges(recommendationChanges);
        toast.success(`${appliedRowCount}개 행에 품셈 단위 작업량과 비고를 반영했습니다.`);
        return highlightedCellKeys;
    }, [applyItemFieldChanges, evaluateStandardForPastedRow]);

    const controller = useScheduleMasterTable({
        items,
        viewMode,
        reorderItems,
        updateItem,
        updateItemsField,
        applyItemFieldChanges,
        applyPasteStandardRecommendations,
        buildPasteItems,
        insertItemsAtIndex
    });

    const {
        activeEditingItem,
        activeEditingItemId,
        isFilterActive,
        isTableFocusInside,
        isTablePointerInside,
        selectedCount,
        selectedItemIds,
        setSelectedItemIds,
        visibleItemIdSet,
        visibleItemIds,
        categoryRenameValue,
        handleCancelCategoryRename
    } = controller;

    const handleAddItem = useCallback((parentItem = null) => {
        const targetItem = parentItem || activeEditingItem;
        const newItem = {
            id: `new-${Date.now()}`,
            main_category: targetItem ? targetItem.main_category : "새 세부공종",
            process: targetItem ? targetItem.process : "새 작업",
            sub_process: targetItem ? (targetItem.sub_process || "") : "새 세부공정",
            work_type: "새 세부작업",
            unit: "",
            quantity: 0,
            quantity_formula: "",
            productivity: 0,
            crew_size: 1,
            remarks: "",
            operating_rate_type: targetItem ? targetItem.operating_rate_type : "EARTH",
            operating_rate_value: 0,
            cp_checked: true,
            parallel_rate: targetItem?.parallel_rate ?? (targetItem?.cp_checked === false ? 100 : 0),
            application_rate: targetItem?.application_rate ?? targetItem?.parallel_rate ?? 100,
            reflection_rate: targetItem?.reflection_rate ?? 100
        };

        if (targetItem) {
            const index = items.findIndex((item) => item.id === targetItem.id);
            addItemAtIndex(newItem, index + 1);
            return;
        }

        addItem(newItem);
    }, [activeEditingItem, addItem, addItemAtIndex, items]);

    const handleAddMainCategory = useCallback(() => {
        const name = newMainCategory.trim();
        if (!name) {
            toast.error("대공종명을 입력해주세요.");
            return;
        }

        addItem({
            id: `main-${Date.now()}`,
            main_category: name,
            process: "새 공정",
            sub_process: "새 세부공정",
            work_type: "새 세부작업",
            unit: "",
            quantity: 0,
            quantity_formula: "",
            productivity: 0,
            crew_size: 1,
            remarks: "",
            operating_rate_type: "EARTH",
            operating_rate_value: 0,
            cp_checked: true,
            parallel_rate: 0,
            application_rate: 100,
            reflection_rate: 100
        });
        setNewMainCategory("");
        toast.success("대공종이 추가되었습니다.");
    }, [addItem, newMainCategory]);

    const handleCategoryRunRateChange = useCallback(async (category, newRunRate) => {
        const parsedRunRate = parseInt(newRunRate, 10);
        if (!Number.isFinite(parsedRunRate) || parsedRunRate < 1) {
            toast.error("유효한 Run Rate 값을 선택해주세요.");
            return;
        }

        const prevRates = Array.isArray(operatingRates)
            ? operatingRates.map((rate) => ({ ...rate }))
            : [];

        try {
            updateOperatingRate(category, parsedRunRate);

            const rateToUpdate = prevRates.find((rate) => rate.main_category === category);
            const payload = {
                weights: [{
                    ...(rateToUpdate?.id ? { id: rateToUpdate.id } : {}),
                    main_category: category,
                    work_week_days: parsedRunRate
                }]
            };
            const { updateOperatingRate: updateOperatingRateAPI } = await import("../../../api/cpe/operating_rate");
            const savedRatesResponse = await updateOperatingRateAPI(projectId, payload);
            const normalizedSavedRates = Array.isArray(savedRatesResponse)
                ? savedRatesResponse
                : Array.isArray(savedRatesResponse?.results)
                    ? savedRatesResponse.results
                        : Array.isArray(savedRatesResponse?.data)
                            ? savedRatesResponse.data
                            : null;
            if (normalizedSavedRates) {
                setStoreOperatingRates(getSelectableOperatingRates(normalizedSavedRates));
            }
            toast.success(`${category} Run Rate 업데이트 완료`);
        } catch (error) {
            console.error("Run Rate 업데이트 실패:", error);
            setStoreOperatingRates(prevRates);
            toast.error("Run Rate 업데이트 실패 - 변경값을 되돌렸습니다.");
        }
    }, [operatingRates, projectId, setStoreOperatingRates, updateOperatingRate]);

    const handleCategoryTotalDaysChange = useCallback((category, nextValue) => {
        const targetCategory = String(category || "기타");
        const categoryRows = items.filter((item) => String(item?.main_category || "기타") === targetCategory);
        if (categoryRows.length === 0) return;

        const nextParsed = parseFloat(nextValue);
        const normalizedNext = Number.isFinite(nextParsed) && nextParsed >= 0
            ? parseFloat(nextParsed.toFixed(1))
            : null;
        const currentManualDays = getCategoryManualTotalDays(categoryRows);

        if (currentManualDays === normalizedNext) return;

        updateItemsField(
            categoryRows.map((item) => item.id),
            "category_total_days",
            normalizedNext
        );
    }, [items, updateItemsField]);

    const handleApplyStandardToRow = useCallback((item, std, sourceField = "process") => {
        if (!item || !std) return;
        const { productivity, remark } = deriveStandardProductivity(std);
        const processName = std.main_category || item.process || "";
        const subProcessName = std.category || std.process_name || item.sub_process || "";
        const workTypeName = std.sub_category || std.work_type_name || item.work_type || "";
        const noteText = buildStandardNoteText(std, item.note || remark);

        if (sourceField === "process") {
            updateItem(item.id, "process", processName);
            updateItem(item.id, "sub_process", subProcessName);
            updateItem(item.id, "work_type", workTypeName);
        } else if (sourceField === "sub_process") {
            updateItem(item.id, "sub_process", subProcessName);
            updateItem(item.id, "work_type", workTypeName);
        } else if (sourceField === "work_type") {
            updateItem(item.id, "work_type", workTypeName);
        }

        updateItem(item.id, "unit", std.unit || item.unit || "");
        updateItem(item.id, "productivity", productivity || 0);
        updateItem(item.id, "standard_code", std.code || std.standard || item.standard_code || "");
        updateItem(item.id, "note", noteText);
        updateItem(item.id, "remarks", noteText);
    }, [updateItem]);

    const handleDeleteItem = useCallback(async (id) => {
        const ok = await confirm("삭제하시겠습니까?");
        if (!ok) return;
        deleteItems([id]);
        setSelectedItemIds((prev) => prev.filter((itemId) => itemId !== id));
    }, [confirm, deleteItems, setSelectedItemIds]);

    const handleDeleteSelectedItems = useCallback(async () => {
        const targetIds = isFilterActive
            ? selectedItemIds.filter((id) => visibleItemIdSet.has(id))
            : selectedItemIds;
        if (targetIds.length === 0) return;

        const targetCount = targetIds.length;
        const scopeText = isFilterActive ? "현재 필터/검색 결과에서 " : "";
        const ok = await confirm({
            title: "선택 항목 삭제",
            message: `${scopeText}선택된 ${targetCount}개 항목을 삭제하시겠습니까?`,
            confirmText: "삭제",
            cancelText: "취소"
        });
        if (!ok) return;

        if (targetCount >= 20) {
            const bulkOk = await confirm({
                title: "대량 삭제 확인",
                message: `${targetCount}개 항목이 한 번에 삭제됩니다.\n정말 계속하시겠습니까?`,
                confirmText: "대량 삭제 진행",
                cancelText: "취소"
            });
            if (!bulkOk) return;
        }

        deleteItems(targetIds);
        const removedIdSet = new Set(targetIds);
        setSelectedItemIds((prev) => prev.filter((id) => !removedIdSet.has(id)));
        toast.success(`${targetIds.length}개 항목이 삭제되었습니다.`);
    }, [confirm, deleteItems, isFilterActive, selectedItemIds, setSelectedItemIds, visibleItemIdSet]);

    const handleDeleteCategory = useCallback(async (category, categoryItems) => {
        const ok = await confirm(`${category} 대공종을 삭제하시겠습니까? (항목 ${categoryItems.length}개)`);
        if (!ok) return;
        const remainingItems = items.filter((item) => item.main_category !== category);
        const remainingIds = new Set(remainingItems.map((item) => item.id));
        const remainingLinks = links.filter(
            (link) => remainingIds.has(link.from) && remainingIds.has(link.to)
        );
        const remainingSubTasks = subTasks.filter((subtask) => remainingIds.has(subtask.itemId));

        if (containerId) {
            try {
                await saveScheduleData(containerId, { items: remainingItems, links: remainingLinks, sub_tasks: remainingSubTasks });
            } catch (error) {
                console.error("Failed to save after category delete:", error);
                toast.error("대공종 삭제 저장 실패");
                return;
            }
        }

        deleteItems(categoryItems.map((item) => item.id));
        setSelectedItemIds((prev) => {
            const removedIdSet = new Set(categoryItems.map((item) => item.id));
            return prev.filter((id) => !removedIdSet.has(id));
        });
        toast.success("대공종이 삭제되었습니다.");
    }, [confirm, containerId, deleteItems, items, links, setSelectedItemIds, subTasks]);

    const handleCommitCategoryRename = useCallback(async (oldCategory) => {
        const sourceCategory = String(oldCategory || "").trim();
        const nextCategory = String(categoryRenameValue || "").trim();
        if (!sourceCategory) return;

        if (!nextCategory) {
            toast.error("대공종명을 입력해주세요.");
            return;
        }

        if (sourceCategory === nextCategory) {
            handleCancelCategoryRename();
            return;
        }

        const hasDuplicateCategory = items.some((item) => {
            const current = String(item?.main_category || "기타");
            return current === nextCategory && current !== sourceCategory;
        });
        if (hasDuplicateCategory) {
            toast.error("이미 존재하는 대공종명입니다.");
            return;
        }

        const targetIds = items
            .filter((item) => String(item?.main_category || "기타") === sourceCategory)
            .map((item) => item.id);

        if (targetIds.length === 0) {
            handleCancelCategoryRename();
            return;
        }

        const rateIdsToRename = operatingRates
            .filter((rate) => String(rate?.main_category || "기타") === sourceCategory)
            .map((rate) => rate.id)
            .filter(Boolean);

        const nextRates = operatingRates.map((rate) => {
            if (String(rate?.main_category || "기타") !== sourceCategory) return rate;
            return {
                ...rate,
                main_category: nextCategory
            };
        });

        setStoreOperatingRates(nextRates);
        updateItemsField(targetIds, "main_category", nextCategory);

        if (rateIdsToRename.length > 0) {
            try {
                const { updateOperatingRate: updateOperatingRateAPI } = await import("../../../api/cpe/operating_rate");
                const savedRates = await updateOperatingRateAPI(projectId, {
                    weights: rateIdsToRename.map((id) => ({
                        id,
                        main_category: nextCategory
                    }))
                });
                setStoreOperatingRates(getSelectableOperatingRates(savedRates));
            } catch (error) {
                console.error("대공종명 변경 후 가동률 저장 실패:", error);
                setStoreOperatingRates(operatingRates);
                updateItemsField(targetIds, "main_category", sourceCategory);
                toast.error("가동률 대공종명 저장 실패 - 변경을 되돌렸습니다.");
                return;
            }
        }

        handleCancelCategoryRename();
        toast.success("대공종명이 변경되었습니다.");
    }, [categoryRenameValue, handleCancelCategoryRename, items, operatingRates, projectId, setStoreOperatingRates, updateItemsField]);

    const handleMoveCategory = useCallback((category, direction) => {
        const categoryOrder = [];
        const groupedByCategory = new Map();

        items.forEach((item) => {
            const key = item.main_category || "기타";
            if (!groupedByCategory.has(key)) {
                groupedByCategory.set(key, []);
                categoryOrder.push(key);
            }
            groupedByCategory.get(key).push(item);
        });

        const currentIndex = categoryOrder.indexOf(category);
        if (currentIndex < 0) return;

        const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= categoryOrder.length) return;

        [categoryOrder[currentIndex], categoryOrder[targetIndex]] = [categoryOrder[targetIndex], categoryOrder[currentIndex]];
        const reorderedItems = categoryOrder.flatMap((key) => groupedByCategory.get(key) || []);
        reorderItems(reorderedItems);
    }, [items, reorderItems]);

    useEffect(() => {
        const handleTableHotkeys = (e) => {
            if (viewMode !== "table") return;
            const isTableContextActive = isTablePointerInside || isTableFocusInside || Boolean(activeEditingItemId);
            if (!isTableContextActive) return;
            const target = e.target;
            const isScheduleCellTarget = Boolean(target?.closest?.('[data-schedule-cell="true"]'));

            const isTypingTarget = (() => {
                if (!target) return false;
                if (target?.isContentEditable) return true;
                if (target?.tagName === "TEXTAREA") return true;
                if (target?.tagName !== "INPUT") return false;
                const inputType = String(target?.type || "").toLowerCase();
                return !["checkbox", "radio", "button", "submit", "reset"].includes(inputType);
            })();

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
                if (e.shiftKey) {
                    if (canRedo) onRedo?.();
                } else if (canUndo) {
                    onUndo?.();
                }
                e.preventDefault();
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
                if (canRedo) onRedo?.();
                e.preventDefault();
                return;
            }

            if (e.key === "Escape" && controller.cellSelectionRange) {
                e.preventDefault();
                controller.clearCellSelectionRange();
                return;
            }

            if (e.key === "Delete" && controller.cellSelectionRange) {
                const activeElement = document.activeElement;
                const hasTextSelection = Boolean(
                    activeElement
                    && typeof activeElement.selectionStart === "number"
                    && activeElement.selectionStart !== activeElement.selectionEnd
                );
                const bounds = controller.getCellSelectionBounds(controller.cellSelectionRange);
                const selectedCellCount = bounds
                    ? ((bounds.maxRow - bounds.minRow + 1) * (bounds.maxField - bounds.minField + 1))
                    : 0;
                if (!isTypingTarget || isScheduleCellTarget || selectedCellCount > 1) {
                    if (!hasTextSelection) {
                        e.preventDefault();
                        controller.clearSelectedCells();
                        return;
                    }
                }
            }

            if (isTypingTarget) return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
                e.preventDefault();
                controller.selectAllCells();
                return;
            }

            if (selectedCount === 0) return;
            if (e.key === "Delete") {
                e.preventDefault();
                handleDeleteSelectedItems();
            }
        };

        window.addEventListener("keydown", handleTableHotkeys);
        return () => window.removeEventListener("keydown", handleTableHotkeys);
    }, [
        activeEditingItemId,
        canRedo,
        canUndo,
        controller,
        handleDeleteSelectedItems,
        isTableFocusInside,
        isTablePointerInside,
        onRedo,
        onUndo,
        selectedCount,
        setSelectedItemIds,
        viewMode,
        visibleItemIds
    ]);

    return {
        ...controller,
        handleAddItem,
        handleAddMainCategory,
        handleApplyStandardToRow,
        handleCategoryRunRateChange,
        handleCategoryTotalDaysChange,
        handleCommitCategoryRename,
        handleDeleteCategory,
        handleDeleteItem,
        handleDeleteSelectedItems,
        handleMoveCategory,
        newMainCategory,
        onOpenEvidence,
        onOpenFloorBatchModal,
        onOpenImport,
        onOpenRowClassEdit,
        setNewMainCategory
    };
}
