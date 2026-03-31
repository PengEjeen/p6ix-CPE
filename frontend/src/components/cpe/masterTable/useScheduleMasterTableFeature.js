import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { saveScheduleData } from "../../../api/cpe_all/construction_schedule";
import useScheduleMasterTable from "./useScheduleMasterTable";
import { getCategoryManualTotalDays } from "../../../utils/scheduleCalculations";
import { getSelectableOperatingRates } from "../../../utils/operatingRateKeys";

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
    onUndo
}) {
    const [newMainCategory, setNewMainCategory] = useState("");

    const controller = useScheduleMasterTable({
        items,
        viewMode,
        reorderItems,
        updateItem,
        updateItemsField,
        applyItemFieldChanges
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

    const deriveStandardProductivity = useCallback((std) => {
        if (std?.molit_workload) {
            return { productivity: std.molit_workload, remark: "국토부 가이드라인 물량 기준" };
        }
        if (std?.pumsam_workload) {
            return { productivity: std.pumsam_workload, remark: "표준품셈 물량 기준" };
        }
        return { productivity: 0, remark: "추천 기준 없음" };
    }, []);

    const handleApplyStandardToRow = useCallback((item, std) => {
        if (!item || !std) return;
        const { productivity, remark } = deriveStandardProductivity(std);
        const processName = std.main_category || item.process || "";
        const subProcessName = std.category || std.process_name || item.sub_process || "";
        const workTypeName = std.sub_category || std.work_type_name || item.work_type || "";
        const tocLabel = std.item_name || "";
        const noteText = tocLabel ? `${tocLabel} (${remark})` : (item.note || remark);
        updateItem(item.id, "process", processName);
        updateItem(item.id, "sub_process", subProcessName);
        updateItem(item.id, "work_type", workTypeName);
        updateItem(item.id, "unit", std.unit || item.unit || "");
        updateItem(item.id, "productivity", productivity || 0);
        updateItem(item.id, "standard_code", std.code || std.standard || item.standard_code || "");
        updateItem(item.id, "note", noteText);
        updateItem(item.id, "remarks", noteText);
    }, [deriveStandardProductivity, updateItem]);

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
