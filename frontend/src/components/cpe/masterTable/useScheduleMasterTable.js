import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useDragHandlers } from "../../../hooks/useDragHandlers";
import {
    isBatchEditableField,
    mapClipboardRowToFields,
    normalizeClipboardMatrix,
    parseScheduleCellValue,
    SCHEDULE_CELL_NAV_FIELDS
} from "../../../utils/scheduleTableEditing";
import {
    SCHEDULE_MASTER_DEFAULT_VISIBLE_COLUMN_KEYS
} from "./scheduleMasterTableColumns";

const HORIZONTAL_HINT_STORAGE_KEY = "scheduleMaster.horizontalHintSeen";
const COLUMN_VISIBILITY_STORAGE_KEY = "scheduleMaster.visibleColumns";

export default function useScheduleMasterTable({
    items,
    viewMode,
    reorderItems,
    updateItem,
    updateItemsField,
    applyItemFieldChanges,
    applyPasteStandardRecommendations,
    buildPasteItems,
    insertItemsAtIndex
}) {
    const [selectedItemIds, setSelectedItemIds] = useState([]);
    const [activeEditingItemId, setActiveEditingItemId] = useState(null);
    const [activeCell, setActiveCell] = useState(null);
    const [cellSelectionRange, setCellSelectionRange] = useState(null);
    const [categoryRenameTarget, setCategoryRenameTarget] = useState(null);
    const [categoryRenameValue, setCategoryRenameValue] = useState("");
    const [isSelectionDragging, setIsSelectionDragging] = useState(false);
    const [openCategoryMenu, setOpenCategoryMenu] = useState(null);
    const [searchKeyword, setSearchKeyword] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [isTablePointerInside, setIsTablePointerInside] = useState(false);
    const [isTableFocusInside, setIsTableFocusInside] = useState(false);
    const [invalidCellKeys, setInvalidCellKeys] = useState(() => new Set());
    const [autoAppliedCellKeys, setAutoAppliedCellKeys] = useState(() => new Set());
    const [tableHeaderHeight, setTableHeaderHeight] = useState(44);
    const [tableToolbarHeight, setTableToolbarHeight] = useState(72);
    const [visibleColumnKeys, setVisibleColumnKeys] = useState(() => {
        if (typeof window === "undefined") {
            return SCHEDULE_MASTER_DEFAULT_VISIBLE_COLUMN_KEYS;
        }
        try {
            const raw = window.localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            if (!Array.isArray(parsed)) {
                return SCHEDULE_MASTER_DEFAULT_VISIBLE_COLUMN_KEYS;
            }
            const allowed = new Set(SCHEDULE_MASTER_DEFAULT_VISIBLE_COLUMN_KEYS);
            const normalized = parsed.filter((key) => allowed.has(key));
            return normalized.length > 0 ? normalized : SCHEDULE_MASTER_DEFAULT_VISIBLE_COLUMN_KEYS;
        } catch {
            return SCHEDULE_MASTER_DEFAULT_VISIBLE_COLUMN_KEYS;
        }
    });
    const [categoryMenuPosition, setCategoryMenuPosition] = useState(null);
    const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [showHorizontalHint, setShowHorizontalHint] = useState(false);
    const [isScrolling, setIsScrolling] = useState(false);

    const selectAllRef = useRef(null);
    const tableHeaderRef = useRef(null);
    const tableToolbarRef = useRef(null);
    const tableScrollRef = useRef(null);
    const tableInteractionRef = useRef(null);
    const categoryMenuRef = useRef(null);
    const categoryMenuDropdownRef = useRef(null);
    const selectionDragModeRef = useRef(null);
    const selectionDragVisitedRef = useRef(new Set());
    const isCellSelectionDraggingRef = useRef(false);
    const cellSelectionPointerRef = useRef({ x: 0, y: 0 });
    const cellSelectionAutoScrollFrameRef = useRef(null);
    const invalidCellTimeoutRef = useRef(null);
    const autoAppliedCellTimeoutRef = useRef(null);

    const selectedIdSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
    const visibleColumnKeySet = useMemo(() => new Set(visibleColumnKeys), [visibleColumnKeys]);
    const visibleCellNavFields = useMemo(
        () => SCHEDULE_CELL_NAV_FIELDS.filter((field) => visibleColumnKeySet.has(field)),
        [visibleColumnKeySet]
    );
    const normalizedSearchKeyword = useMemo(() => searchKeyword.trim().toLowerCase(), [searchKeyword]);
    const hasSearchKeyword = normalizedSearchKeyword.length > 0;
    const isFilterActive = categoryFilter !== "ALL" || normalizedSearchKeyword.length > 0;

    const categoryOptions = useMemo(() => {
        const seen = new Set();
        const result = [];
        items.forEach((item) => {
            const category = String(item.main_category || "기타");
            if (seen.has(category)) return;
            seen.add(category);
            result.push(category);
        });
        return result;
    }, [items]);

    const categoryItemsMap = useMemo(() => {
        const map = new Map();
        items.forEach((item) => {
            const category = String(item.main_category || "기타");
            if (!map.has(category)) {
                map.set(category, []);
            }
            map.get(category).push(item);
        });
        return map;
    }, [items]);

    const visibleItems = useMemo(() => {
        return items.filter((item) => {
            const category = String(item.main_category || "기타");
            if (categoryFilter !== "ALL" && category !== categoryFilter) return false;
            if (!normalizedSearchKeyword) return true;
            const fields = [
                category,
                item.process,
                item.sub_process,
                item.work_type,
                item.unit,
                item.note,
                item.remarks,
                item.quantity_formula
            ];
            const haystack = fields
                .filter((field) => field !== null && field !== undefined)
                .map((field) => String(field).toLowerCase())
                .join(" ");
            return haystack.includes(normalizedSearchKeyword);
        });
    }, [categoryFilter, items, normalizedSearchKeyword]);

    const visibleItemIds = useMemo(() => visibleItems.map((item) => item.id), [visibleItems]);
    const visibleItemIdSet = useMemo(() => new Set(visibleItemIds), [visibleItemIds]);
    const visibleItemIndexMap = useMemo(
        () => new Map(visibleItems.map((item, index) => [String(item.id), index])),
        [visibleItems]
    );
    const selectedVisibleCount = useMemo(
        () => selectedItemIds.reduce((count, id) => count + (visibleItemIdSet.has(id) ? 1 : 0), 0),
        [selectedItemIds, visibleItemIdSet]
    );
    const visibleSelectedItemIds = useMemo(
        () => visibleItems
            .filter((item) => selectedIdSet.has(item.id))
            .map((item) => item.id),
        [selectedIdSet, visibleItems]
    );
    const selectedCount = isFilterActive ? selectedVisibleCount : selectedItemIds.length;
    const allSelected = visibleItemIds.length > 0 && visibleItemIds.every((id) => selectedIdSet.has(id));

    const groupedVisibleItems = useMemo(() => {
        return visibleItems.reduce((acc, item) => {
            const category = String(item.main_category || "기타");
            if (!acc[category]) acc[category] = [];
            acc[category].push(item);
            return acc;
        }, {});
    }, [visibleItems]);

    const activeEditingItem = useMemo(
        () => items.find((item) => item.id === activeEditingItemId) || null,
        [items, activeEditingItemId]
    );

    const {
        activeId,
        overId,
        handleDragStart,
        handleDragOver,
        handleDragCancel,
        handleDragEnd
    } = useDragHandlers(items, reorderItems, selectedItemIds);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    const activeDragItem = useMemo(
        () => (activeId ? items.find((item) => item.id === activeId) : null),
        [activeId, items]
    );

    const dragMovingItemIds = useMemo(() => {
        if (!activeId) return [];
        const activeItemForDrag = items.find((item) => item.id === activeId);
        if (!activeItemForDrag) return [];
        const activeSelected = selectedIdSet.has(activeId);
        if (activeSelected && selectedIdSet.size > 1) {
            return items
                .filter((item) => selectedIdSet.has(item.id) && item.main_category === activeItemForDrag.main_category)
                .map((item) => item.id);
        }
        return [activeId];
    }, [activeId, items, selectedIdSet]);

    const dragMovingItemSet = useMemo(() => new Set(dragMovingItemIds), [dragMovingItemIds]);

    const dropTargetId = useMemo(() => {
        if (!activeId || !overId || activeId === overId) return null;
        if (dragMovingItemSet.has(overId)) return null;
        return overId;
    }, [activeId, dragMovingItemSet, overId]);

    const dropPosition = useMemo(() => {
        if (!dropTargetId || !activeId) return null;
        const activeIndex = items.findIndex((item) => item.id === activeId);
        const overIndex = items.findIndex((item) => item.id === dropTargetId);
        if (activeIndex === -1 || overIndex === -1) return null;
        return activeIndex < overIndex ? "after" : "before";
    }, [activeId, dropTargetId, items]);

    const dropTargetItem = useMemo(
        () => (dropTargetId ? items.find((item) => item.id === dropTargetId) : null),
        [dropTargetId, items]
    );

    const isDropInvalid = Boolean(
        activeDragItem && dropTargetItem && activeDragItem.main_category !== dropTargetItem.main_category
    );

    const toggleSelectItem = useCallback((id) => {
        setSelectedItemIds((prev) => (
            prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
        ));
    }, []);

    const startSelectionDrag = useCallback((id) => {
        if (!id) return;
        const shouldSelect = !selectedItemIds.includes(id);
        selectionDragModeRef.current = shouldSelect;
        selectionDragVisitedRef.current = new Set([id]);
        setIsSelectionDragging(true);
        setSelectedItemIds((prev) => {
            if (shouldSelect) {
                return prev.includes(id) ? prev : [...prev, id];
            }
            return prev.filter((itemId) => itemId !== id);
        });
    }, [selectedItemIds]);

    const dragSelectItem = useCallback((id) => {
        if (!isSelectionDragging || !id) return;
        if (selectionDragVisitedRef.current.has(id)) return;
        selectionDragVisitedRef.current.add(id);
        const shouldSelect = selectionDragModeRef.current !== false;
        setSelectedItemIds((prev) => {
            if (shouldSelect) {
                return prev.includes(id) ? prev : [...prev, id];
            }
            return prev.filter((itemId) => itemId !== id);
        });
    }, [isSelectionDragging]);

    const updateCategoryMenuPosition = useCallback(() => {
        if (!categoryMenuRef.current || typeof window === "undefined") return;
        const rect = categoryMenuRef.current.getBoundingClientRect();
        const menuWidth = 188;
        const menuHeightEstimate = 220;
        const left = Math.min(
            window.innerWidth - menuWidth - 8,
            Math.max(8, rect.right - menuWidth)
        );
        const spaceBelow = window.innerHeight - rect.bottom;
        const top = spaceBelow < menuHeightEstimate
            ? Math.max(8, rect.top - menuHeightEstimate - 6)
            : rect.bottom + 6;
        setCategoryMenuPosition({ top, left });
    }, []);

    const toggleSelectAllItems = useCallback((checked) => {
        setSelectedItemIds((prev) => {
            if (!checked) {
                return prev.filter((id) => !visibleItemIdSet.has(id));
            }
            const next = new Set(prev);
            visibleItemIds.forEach((id) => next.add(id));
            return Array.from(next);
        });
    }, [visibleItemIdSet, visibleItemIds]);

    const updateHorizontalScrollState = useCallback(() => {
        const el = tableScrollRef.current;
        if (!el) return;
        const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);
        const hasOverflow = maxLeft > 1;
        setHasHorizontalOverflow(hasOverflow);
        setCanScrollLeft(hasOverflow && el.scrollLeft > 2);
        setCanScrollRight(hasOverflow && el.scrollLeft < maxLeft - 2);
    }, []);

    const dismissHorizontalHint = useCallback(() => {
        setShowHorizontalHint(false);
        try {
            window.localStorage.setItem(HORIZONTAL_HINT_STORAGE_KEY, "1");
        } catch {
            // ignore storage errors
        }
    }, []);

    const handleScroll = useCallback(() => {
        setIsScrolling(true);
        clearTimeout(window.scrollTimeout);
        window.scrollTimeout = setTimeout(() => {
            setIsScrolling(false);
        }, 1000);
        updateHorizontalScrollState();
    }, [updateHorizontalScrollState]);

    const handleChange = useCallback((id, field, value) => {
        updateItem(id, field, value);
    }, [updateItem]);

    const handleActivateItem = useCallback((item) => {
        if (!item?.id) return;
        setActiveEditingItemId(item.id);
    }, []);

    const handleStartCategoryRename = useCallback((category) => {
        setCategoryRenameTarget(category);
        setCategoryRenameValue(category);
        setOpenCategoryMenu(null);
    }, []);

    const handleCancelCategoryRename = useCallback(() => {
        setCategoryRenameTarget(null);
        setCategoryRenameValue("");
    }, []);

    const focusCellElement = useCallback((rowId, field) => {
        if (typeof document === "undefined") return;
        const selector = `[data-schedule-cell="true"][data-schedule-row-id="${String(rowId).replace(/"/g, '\\"')}"][data-schedule-field="${field}"]`;
        const element = document.querySelector(selector);
        if (!element) return;
        element.focus();
        if (element.tagName !== "TEXTAREA" && typeof element.select === "function" && element.type !== "checkbox") {
            element.select();
        }
    }, []);

    const getVisibleCellFieldIndex = useCallback(
        (field) => visibleCellNavFields.indexOf(field),
        [visibleCellNavFields]
    );

    const getAdjacentCellTarget = useCallback((rowId, field, rowDelta, fieldDelta) => {
        const currentRowIndex = visibleItems.findIndex((item) => item.id === rowId);
        const currentFieldIndex = getVisibleCellFieldIndex(field);
        if (visibleCellNavFields.length === 0) return null;
        if (currentRowIndex === -1 || currentFieldIndex === -1) return null;

        let nextRowIndex = currentRowIndex + rowDelta;
        let nextFieldIndex = currentFieldIndex + fieldDelta;

        if (fieldDelta !== 0) {
            while (nextFieldIndex < 0) {
                nextRowIndex -= 1;
                nextFieldIndex += visibleCellNavFields.length;
            }
            while (nextFieldIndex >= visibleCellNavFields.length) {
                nextRowIndex += 1;
                nextFieldIndex -= visibleCellNavFields.length;
            }
        }

        const nextItem = visibleItems[nextRowIndex];
        const nextField = visibleCellNavFields[nextFieldIndex];
        if (!nextItem || !nextField) return null;

        return {
            itemId: nextItem.id,
            field: nextField
        };
    }, [getVisibleCellFieldIndex, visibleCellNavFields, visibleItems]);

    const focusAdjacentCell = useCallback((rowId, field, rowDelta, fieldDelta) => {
        const nextTarget = getAdjacentCellTarget(rowId, field, rowDelta, fieldDelta);
        if (!nextTarget) return false;

        window.requestAnimationFrame(() => focusCellElement(nextTarget.itemId, nextTarget.field));
        return true;
    }, [focusCellElement, getAdjacentCellTarget]);

    const getCellSelectionBounds = useCallback((range = cellSelectionRange) => {
        if (!range?.anchor || !range?.focus) return null;

        const anchorRowIndex = visibleItemIndexMap.get(String(range.anchor.itemId));
        const focusRowIndex = visibleItemIndexMap.get(String(range.focus.itemId));
        const anchorFieldIndex = getVisibleCellFieldIndex(range.anchor.field);
        const focusFieldIndex = getVisibleCellFieldIndex(range.focus.field);

        if (
            anchorRowIndex === undefined
            || focusRowIndex === undefined
            || anchorFieldIndex === -1
            || focusFieldIndex === -1
        ) {
            return null;
        }

        return {
            minRow: Math.min(anchorRowIndex, focusRowIndex),
            maxRow: Math.max(anchorRowIndex, focusRowIndex),
            minField: Math.min(anchorFieldIndex, focusFieldIndex),
            maxField: Math.max(anchorFieldIndex, focusFieldIndex)
        };
    }, [cellSelectionRange, getVisibleCellFieldIndex, visibleItemIndexMap]);

    const getCellClipboardValue = useCallback((item, field) => {
        const value = item?.[field];
        if (field === "cp_checked") {
            return value !== false ? "TRUE" : "FALSE";
        }
        if (value === null || value === undefined) return "";
        return String(value);
    }, []);

    const buildClipboardTextFromSelection = useCallback(() => {
        const bounds = getCellSelectionBounds();
        if (!bounds) return "";

        const rows = [];
        for (let rowIndex = bounds.minRow; rowIndex <= bounds.maxRow; rowIndex += 1) {
            const item = visibleItems[rowIndex];
            if (!item) continue;
            const columns = [];
            for (let fieldIndex = bounds.minField; fieldIndex <= bounds.maxField; fieldIndex += 1) {
                const field = visibleCellNavFields[fieldIndex];
                columns.push(getCellClipboardValue(item, field));
            }
            rows.push(columns.join("\t"));
        }
        return rows.join("\n");
    }, [getCellClipboardValue, getCellSelectionBounds, visibleCellNavFields, visibleItems]);

    const highlightInvalidCells = useCallback((keys) => {
        if (!Array.isArray(keys) || keys.length === 0) return;
        setInvalidCellKeys(new Set(keys));
        if (invalidCellTimeoutRef.current) {
            window.clearTimeout(invalidCellTimeoutRef.current);
        }
        invalidCellTimeoutRef.current = window.setTimeout(() => {
            setInvalidCellKeys(new Set());
            invalidCellTimeoutRef.current = null;
        }, 2600);
    }, []);

    const highlightAutoAppliedCells = useCallback((keys) => {
        if (!Array.isArray(keys) || keys.length === 0) return;
        setAutoAppliedCellKeys(new Set(keys));
        if (autoAppliedCellTimeoutRef.current) {
            window.clearTimeout(autoAppliedCellTimeoutRef.current);
        }
        autoAppliedCellTimeoutRef.current = window.setTimeout(() => {
            setAutoAppliedCellKeys(new Set());
            autoAppliedCellTimeoutRef.current = null;
        }, 4200);
    }, []);

    const applyValidatedFieldChanges = useCallback((rawChanges, successMessage) => {
        if (!Array.isArray(rawChanges) || rawChanges.length === 0) return false;

        const validatedChanges = [];
        const invalidKeys = [];
        let skippedCount = 0;
        let firstErrorMessage = "";

        rawChanges.forEach((change) => {
            if (!change?.id || !isBatchEditableField(change.field)) {
                skippedCount += 1;
                if (change?.id && change?.field) {
                    invalidKeys.push(`${change.id}::${change.field}`);
                }
                return;
            }
            const parsed = parseScheduleCellValue(change.field, change.value);
            if (!parsed.ok) {
                skippedCount += 1;
                invalidKeys.push(`${change.id}::${change.field}`);
                if (!firstErrorMessage) {
                    firstErrorMessage = parsed.reason;
                }
                return;
            }
            validatedChanges.push({
                id: change.id,
                field: change.field,
                value: parsed.value
            });
        });

        if (validatedChanges.length === 0) {
            highlightInvalidCells(invalidKeys);
            toast.error(firstErrorMessage || "적용 가능한 편집 값이 없습니다.");
            return false;
        }

        applyItemFieldChanges(validatedChanges);
        if (invalidKeys.length > 0) {
            highlightInvalidCells(invalidKeys);
        } else if (invalidCellTimeoutRef.current) {
            window.clearTimeout(invalidCellTimeoutRef.current);
            invalidCellTimeoutRef.current = null;
            setInvalidCellKeys(new Set());
        }

        if (successMessage) {
            toast.success(skippedCount > 0 ? `${successMessage} (${skippedCount}개 건너뜀)` : successMessage);
        } else if (skippedCount > 0) {
            toast.success(`${validatedChanges.length}개 셀 적용, ${skippedCount}개 건너뜀`);
        }

        return true;
    }, [applyItemFieldChanges, highlightInvalidCells]);

    const handleActivateCell = useCallback((itemId, field) => {
        if (!itemId || !field) return;
        setActiveEditingItemId(itemId);
        setActiveCell({ itemId, field });
        setCellSelectionRange({
            anchor: { itemId, field },
            focus: { itemId, field }
        });
    }, []);

    const handleCellSelectionStart = useCallback((itemId, field) => {
        if (!itemId || !field) return;
        setActiveEditingItemId(itemId);
        setActiveCell({ itemId, field });
        setCellSelectionRange({
            anchor: { itemId, field },
            focus: { itemId, field }
        });
        isCellSelectionDraggingRef.current = true;
    }, []);

    const handleCellSelectionEnter = useCallback((itemId, field) => {
        if (!isCellSelectionDraggingRef.current || !itemId || !field) return;
        setCellSelectionRange((prev) => {
            if (!prev?.anchor) {
                return {
                    anchor: { itemId, field },
                    focus: { itemId, field }
                };
            }
            if (prev.focus?.itemId === itemId && prev.focus?.field === field) {
                return prev;
            }
            return {
                anchor: prev.anchor,
                focus: { itemId, field }
            };
        });
        setActiveCell({ itemId, field });
    }, []);

    const clearCellSelectionRange = useCallback(() => {
        if (activeCell?.itemId && activeCell?.field) {
            setCellSelectionRange({
                anchor: { itemId: activeCell.itemId, field: activeCell.field },
                focus: { itemId: activeCell.itemId, field: activeCell.field }
            });
            window.requestAnimationFrame(() => focusCellElement(activeCell.itemId, activeCell.field));
            return true;
        }
        setCellSelectionRange(null);
        return false;
    }, [activeCell, focusCellElement]);

    const isCellSelected = useCallback((itemId, field, options = {}) => {
        if (!itemId || !field) {
            return false;
        }
        const bounds = getCellSelectionBounds();
        if (!bounds) return false;
        const targetRowIndex = visibleItemIndexMap.get(String(itemId));
        const targetFieldIndex = getVisibleCellFieldIndex(field);
        const rowSpan = Math.max(1, Number(options?.rowSpan) || 1);

        if (targetRowIndex === undefined || targetFieldIndex === -1) {
            return false;
        }

        return (
            targetRowIndex <= bounds.maxRow
            && targetRowIndex + rowSpan - 1 >= bounds.minRow
            && targetFieldIndex >= bounds.minField
            && targetFieldIndex <= bounds.maxField
        );
    }, [getCellSelectionBounds, getVisibleCellFieldIndex, visibleItemIndexMap]);

    const getCellSelectionClassName = useCallback((itemId, field, options = {}) => {
        if (!itemId || !field) return "";

        const bounds = getCellSelectionBounds();
        const targetRowIndex = visibleItemIndexMap.get(String(itemId));
        const targetFieldIndex = getVisibleCellFieldIndex(field);
        const rowSpan = Math.max(1, Number(options?.rowSpan) || 1);
        const targetEndRowIndex = targetRowIndex === undefined ? undefined : targetRowIndex + rowSpan - 1;
        const classNames = [];

        const activeRowIndex = activeCell?.itemId ? visibleItemIndexMap.get(String(activeCell.itemId)) : undefined;
        const isActiveCell = (
            activeCell?.field === field
            && activeRowIndex !== undefined
            && targetRowIndex !== undefined
            && activeRowIndex >= targetRowIndex
            && activeRowIndex <= targetEndRowIndex
        );
        if (isActiveCell) {
            classNames.push("schedule-cell-active");
        }
        const hasInvalidInSpan = targetRowIndex !== undefined && Array.from({ length: rowSpan }).some((_, offset) => {
            const targetItem = visibleItems[targetRowIndex + offset];
            return targetItem ? invalidCellKeys.has(`${targetItem.id}::${field}`) : false;
        });
        if (hasInvalidInSpan) {
            classNames.push("schedule-cell-invalid");
        }
        const hasAutoAppliedInSpan = targetRowIndex !== undefined && Array.from({ length: rowSpan }).some((_, offset) => {
            const targetItem = visibleItems[targetRowIndex + offset];
            return targetItem ? autoAppliedCellKeys.has(`${targetItem.id}::${field}`) : false;
        });
        if (hasAutoAppliedInSpan) {
            classNames.push("schedule-cell-auto-applied");
        }

        if (
            !bounds
            || targetRowIndex === undefined
            || targetFieldIndex === -1
            || targetRowIndex > bounds.maxRow
            || targetEndRowIndex < bounds.minRow
            || targetFieldIndex < bounds.minField
            || targetFieldIndex > bounds.maxField
        ) {
            return classNames.join(" ");
        }

        classNames.push("schedule-cell-selected");

        return classNames.join(" ");
    }, [activeCell, autoAppliedCellKeys, getCellSelectionBounds, getVisibleCellFieldIndex, invalidCellKeys, visibleItemIndexMap, visibleItems]);

    const selectAllCells = useCallback(() => {
        if (visibleItems.length === 0) return false;
        const firstItem = visibleItems[0];
        const lastItem = visibleItems[visibleItems.length - 1];
        const firstField = visibleCellNavFields[0];
        const lastField = visibleCellNavFields[visibleCellNavFields.length - 1];
        if (!firstItem || !lastItem || !firstField || !lastField) return false;

        setActiveEditingItemId(firstItem.id);
        setActiveCell({ itemId: firstItem.id, field: firstField });
        setCellSelectionRange({
            anchor: { itemId: firstItem.id, field: firstField },
            focus: { itemId: lastItem.id, field: lastField }
        });
        window.requestAnimationFrame(() => focusCellElement(firstItem.id, firstField));
        return true;
    }, [focusCellElement, visibleCellNavFields, visibleItems]);

    const clearSelectedCells = useCallback(() => {
        const bounds = getCellSelectionBounds();
        if (!bounds) return false;

        const changes = [];
        for (let rowIndex = bounds.minRow; rowIndex <= bounds.maxRow; rowIndex += 1) {
            const item = visibleItems[rowIndex];
            if (!item) continue;

            for (let fieldIndex = bounds.minField; fieldIndex <= bounds.maxField; fieldIndex += 1) {
                const field = visibleCellNavFields[fieldIndex];
                if (!field || !isBatchEditableField(field)) continue;
                changes.push({
                    id: item.id,
                    field,
                    value: field === "cp_checked" ? false : ""
                });
            }
        }

        const applied = applyValidatedFieldChanges(
            changes,
            `${changes.length}개 셀을 비웠습니다.`
        );

        if (applied && activeCell?.itemId && activeCell?.field) {
            window.requestAnimationFrame(() => focusCellElement(activeCell.itemId, activeCell.field));
        }

        return applied;
    }, [activeCell, applyValidatedFieldChanges, focusCellElement, getCellSelectionBounds, visibleCellNavFields, visibleItems]);

    const extendCellSelection = useCallback((rowId, field, rowDelta, fieldDelta) => {
        const currentFocus = cellSelectionRange?.focus?.itemId && cellSelectionRange?.focus?.field
            ? cellSelectionRange.focus
            : { itemId: rowId, field };
        const anchor = cellSelectionRange?.anchor?.itemId && cellSelectionRange?.anchor?.field
            ? cellSelectionRange.anchor
            : { itemId: rowId, field };
        const nextTarget = getAdjacentCellTarget(currentFocus.itemId, currentFocus.field, rowDelta, fieldDelta);
        if (!nextTarget) return false;

        setActiveEditingItemId(nextTarget.itemId);
        setActiveCell(nextTarget);
        setCellSelectionRange({
            anchor,
            focus: nextTarget
        });
        window.requestAnimationFrame(() => focusCellElement(nextTarget.itemId, nextTarget.field));
        return true;
    }, [cellSelectionRange, focusCellElement, getAdjacentCellTarget]);

    const handleApplyFieldToSelected = useCallback((rowId, field, value) => {
        if (!rowId || !field) return false;
        const targetIds = visibleSelectedItemIds.includes(rowId) ? visibleSelectedItemIds : [];
        if (targetIds.length <= 1) return false;

        const applied = applyValidatedFieldChanges(
            targetIds.map((id) => ({ id, field, value })),
            `${targetIds.length}개 행에 동일 값을 적용했습니다.`
        );

        if (applied) {
            window.requestAnimationFrame(() => focusCellElement(rowId, field));
        }
        return applied;
    }, [applyValidatedFieldChanges, focusCellElement, visibleSelectedItemIds]);

    const applyClipboardMatrix = useCallback(({ rowId, field, text }) => {
        if (!rowId || !field || !isBatchEditableField(field)) return false;

        const matrix = normalizeClipboardMatrix(text);
        if (matrix.length === 0) return false;

        const activeSelectedIds = visibleSelectedItemIds.includes(rowId) ? visibleSelectedItemIds : [];
        const selectionBounds = getCellSelectionBounds();
        const hasSelectionRange = Boolean(
            selectionBounds
            && isCellSelected(rowId, field)
        );

        if (matrix.length === 1 && matrix[0].length === 1 && activeSelectedIds.length > 1) {
            const applied = applyValidatedFieldChanges(
                activeSelectedIds.map((id) => ({ id, field, value: matrix[0][0] })),
                `${activeSelectedIds.length}개 행에 붙여넣기 값을 적용했습니다.`
            );
            if (applied) {
                window.requestAnimationFrame(() => focusCellElement(rowId, field));
            }
            return applied;
        }

        if (matrix.length === 1 && matrix[0].length === 1) {
            if (!hasSelectionRange) {
                return false;
            }
            const singleValue = matrix[0][0];
            const fillChanges = [];
            for (let rowIndex = selectionBounds.minRow; rowIndex <= selectionBounds.maxRow; rowIndex += 1) {
                const item = visibleItems[rowIndex];
                if (!item) continue;
                for (let fieldIndex = selectionBounds.minField; fieldIndex <= selectionBounds.maxField; fieldIndex += 1) {
                const nextField = visibleCellNavFields[fieldIndex];
                fillChanges.push({
                    id: item.id,
                    field: nextField,
                        value: singleValue
                    });
                }
            }
            const applied = applyValidatedFieldChanges(
                fillChanges,
                `${fillChanges.length}개 셀에 붙여넣기했습니다.`
            );
            if (applied) {
                window.requestAnimationFrame(() => focusCellElement(rowId, field));
            }
            return applied;
        }

        const startRowIndex = hasSelectionRange
            ? selectionBounds.minRow
            : visibleItems.findIndex((item) => item.id === rowId);
        const startFieldIndex = hasSelectionRange
            ? selectionBounds.minField
            : getVisibleCellFieldIndex(field);
        if (startRowIndex === -1 || startFieldIndex === -1) return false;

        let targetVisibleItems = visibleItems;
        let insertedRowCount = 0;
        const missingRowCount = Math.max(0, startRowIndex + matrix.length - targetVisibleItems.length);

        if (missingRowCount > 0 && typeof buildPasteItems === "function" && typeof insertItemsAtIndex === "function") {
            const sourceItem = targetVisibleItems[Math.min(startRowIndex, targetVisibleItems.length - 1)];
            const nextItems = buildPasteItems(sourceItem, missingRowCount);
            if (nextItems.length > 0) {
                const lastVisibleItem = targetVisibleItems[targetVisibleItems.length - 1];
                const insertIndex = lastVisibleItem
                    ? items.findIndex((item) => item.id === lastVisibleItem.id) + 1
                    : items.length;
                insertItemsAtIndex(nextItems, insertIndex);
                targetVisibleItems = [...targetVisibleItems, ...nextItems];
                insertedRowCount = nextItems.length;
            }
        }

        const changes = [];
        const pastedRowsById = new Map();
        matrix.forEach((rowValues, rowOffset) => {
            const targetItem = targetVisibleItems[startRowIndex + rowOffset];
            if (!targetItem) return;
            rowValues.forEach((cellValue, fieldOffset) => {
                const targetField = visibleCellNavFields[startFieldIndex + fieldOffset];
                if (!targetField || !isBatchEditableField(targetField)) return;
                if (!pastedRowsById.has(targetItem.id)) {
                    pastedRowsById.set(targetItem.id, {
                        id: targetItem.id,
                        row: { ...targetItem },
                        changedFields: new Set(),
                        rawValues: [...rowValues],
                        pastedValuesByField: mapClipboardRowToFields(rowValues, startFieldIndex, visibleCellNavFields)
                    });
                }
                const pastedRow = pastedRowsById.get(targetItem.id);
                pastedRow.row[targetField] = cellValue;
                pastedRow.pastedValuesByField[targetField] = cellValue;
                pastedRow.changedFields.add(targetField);
                changes.push({
                    id: targetItem.id,
                    field: targetField,
                    value: cellValue
                });
            });
        });

        const applied = applyValidatedFieldChanges(
            changes,
            insertedRowCount > 0
                ? `${changes.length}개 셀에 붙여넣기했습니다. (${insertedRowCount}개 행 추가)`
                : `${changes.length}개 셀에 붙여넣기했습니다.`
        );

        if (applied) {
            if (typeof applyPasteStandardRecommendations === "function" && pastedRowsById.size > 0) {
                const autoAppliedKeys = applyPasteStandardRecommendations(
                    Array.from(pastedRowsById.values()).map((entry) => ({
                        ...entry,
                        changedFields: Array.from(entry.changedFields)
                    }))
                );
                highlightAutoAppliedCells(autoAppliedKeys);
            }

            const endRowIndex = Math.min(startRowIndex + matrix.length - 1, targetVisibleItems.length - 1);
            const endFieldIndex = Math.min(
                startFieldIndex + Math.max(...matrix.map((row) => row.length), 1) - 1,
                visibleCellNavFields.length - 1
            );
            const lastTargetItem = targetVisibleItems[endRowIndex];
            const lastTargetField = visibleCellNavFields[endFieldIndex];
            if (lastTargetItem && lastTargetField) {
                setCellSelectionRange({
                    anchor: {
                        itemId: targetVisibleItems[startRowIndex].id,
                        field: visibleCellNavFields[startFieldIndex]
                    },
                    focus: {
                        itemId: lastTargetItem.id,
                        field: lastTargetField
                    }
                });
                window.requestAnimationFrame(() => focusCellElement(lastTargetItem.id, lastTargetField));
            }
        }
        return applied;
    }, [
        applyValidatedFieldChanges,
        applyPasteStandardRecommendations,
        focusCellElement,
        getCellSelectionBounds,
        isCellSelected,
        getVisibleCellFieldIndex,
        highlightAutoAppliedCells,
        buildPasteItems,
        insertItemsAtIndex,
        items,
        visibleCellNavFields,
        visibleItems,
        visibleSelectedItemIds
    ]);

    const toggleColumnVisibility = useCallback((key) => {
        if (!SCHEDULE_MASTER_DEFAULT_VISIBLE_COLUMN_KEYS.includes(key)) return;

        setVisibleColumnKeys((prev) => {
            const isVisible = prev.includes(key);
            const next = isVisible ? prev.filter((item) => item !== key) : [...prev, key];
            if (next.length === 0) {
                toast.error("최소 1개 컬럼은 표시되어야 합니다.");
                return prev;
            }

            const remainingNavFields = SCHEDULE_CELL_NAV_FIELDS.filter((field) => next.includes(field));
            if (remainingNavFields.length === 0) {
                toast.error("편집 가능한 컬럼은 최소 1개 이상 표시해야 합니다.");
                return prev;
            }

            return next;
        });
    }, []);

    const showAllColumns = useCallback(() => {
        setVisibleColumnKeys(SCHEDULE_MASTER_DEFAULT_VISIBLE_COLUMN_KEYS);
    }, []);

    const handleCellPaste = useCallback((payload) => applyClipboardMatrix(payload), [applyClipboardMatrix]);

    const handleCellKeyDown = useCallback(({ event, rowId, field, value }) => {
        if (!event || !rowId || !field) return;

        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            const applied = handleApplyFieldToSelected(rowId, field, value);
            if (applied) {
                event.preventDefault();
            }
            return;
        }

        const isTextarea = event.target?.tagName === "TEXTAREA";
        const isCheckbox = event.target?.type === "checkbox";

        if (event.shiftKey && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
            let moved = false;
            if (event.key === "ArrowLeft" && !isCheckbox) {
                moved = extendCellSelection(rowId, field, 0, -1);
            } else if (event.key === "ArrowRight" && !isCheckbox) {
                moved = extendCellSelection(rowId, field, 0, 1);
            } else if (event.key === "ArrowUp") {
                moved = extendCellSelection(rowId, field, -1, 0);
            } else if (event.key === "ArrowDown") {
                moved = extendCellSelection(rowId, field, 1, 0);
            }
            if (moved) event.preventDefault();
            return;
        }

        if (event.key === "Tab") {
            const moved = focusAdjacentCell(rowId, field, 0, event.shiftKey ? -1 : 1);
            if (moved) event.preventDefault();
            return;
        }

        if (event.key === "Enter") {
            if (isTextarea && event.altKey) return;
            const moved = focusAdjacentCell(rowId, field, event.shiftKey ? -1 : 1, 0);
            if (moved) event.preventDefault();
            return;
        }

        if (event.key === "ArrowLeft" && !isCheckbox) {
            const moved = focusAdjacentCell(rowId, field, 0, -1);
            if (moved) event.preventDefault();
            return;
        }

        if (event.key === "ArrowRight" && !isCheckbox) {
            const moved = focusAdjacentCell(rowId, field, 0, 1);
            if (moved) event.preventDefault();
            return;
        }

        if (event.key === "ArrowUp") {
            const moved = focusAdjacentCell(rowId, field, -1, 0);
            if (moved) event.preventDefault();
            return;
        }

        if (event.key === "ArrowDown") {
            const moved = focusAdjacentCell(rowId, field, 1, 0);
            if (moved) event.preventDefault();
        }
    }, [extendCellSelection, focusAdjacentCell, handleApplyFieldToSelected]);

    const handleTableBlurCapture = useCallback(() => {
        window.setTimeout(() => {
            if (!tableInteractionRef.current) return;
            const nextActiveElement = document.activeElement;
            if (!tableInteractionRef.current.contains(nextActiveElement)) {
                setIsTableFocusInside(false);
                setActiveCell(null);
                setCellSelectionRange(null);
                isCellSelectionDraggingRef.current = false;
            }
        }, 0);
    }, []);

    useEffect(() => {
        if (!isSelectionDragging) return;
        const handleMouseUp = () => {
            setIsSelectionDragging(false);
            selectionDragModeRef.current = null;
            selectionDragVisitedRef.current.clear();
        };
        window.addEventListener("mouseup", handleMouseUp);
        return () => window.removeEventListener("mouseup", handleMouseUp);
    }, [isSelectionDragging]);

    useEffect(() => {
        const handleMouseUp = () => {
            isCellSelectionDraggingRef.current = false;
            if (cellSelectionAutoScrollFrameRef.current) {
                window.cancelAnimationFrame(cellSelectionAutoScrollFrameRef.current);
                cellSelectionAutoScrollFrameRef.current = null;
            }
        };
        window.addEventListener("mouseup", handleMouseUp);
        return () => window.removeEventListener("mouseup", handleMouseUp);
    }, []);

    useEffect(() => () => {
        if (invalidCellTimeoutRef.current) {
            window.clearTimeout(invalidCellTimeoutRef.current);
            invalidCellTimeoutRef.current = null;
        }
        if (autoAppliedCellTimeoutRef.current) {
            window.clearTimeout(autoAppliedCellTimeoutRef.current);
            autoAppliedCellTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!isCellSelectionDraggingRef.current) return undefined;

        const AUTO_SCROLL_THRESHOLD = 36;
        const AUTO_SCROLL_STEP = 18;

        const tickAutoScroll = () => {
            if (!isCellSelectionDraggingRef.current) {
                cellSelectionAutoScrollFrameRef.current = null;
                return;
            }

            const scrollElement = tableScrollRef.current;
            if (!scrollElement) {
                cellSelectionAutoScrollFrameRef.current = window.requestAnimationFrame(tickAutoScroll);
                return;
            }

            const rect = scrollElement.getBoundingClientRect();
            const { x, y } = cellSelectionPointerRef.current;
            let deltaX = 0;
            let deltaY = 0;

            if (x >= rect.left && x <= rect.right) {
                if (x < rect.left + AUTO_SCROLL_THRESHOLD) deltaX = -AUTO_SCROLL_STEP;
                else if (x > rect.right - AUTO_SCROLL_THRESHOLD) deltaX = AUTO_SCROLL_STEP;
            }
            if (y >= rect.top && y <= rect.bottom) {
                if (y < rect.top + AUTO_SCROLL_THRESHOLD) deltaY = -AUTO_SCROLL_STEP;
                else if (y > rect.bottom - AUTO_SCROLL_THRESHOLD) deltaY = AUTO_SCROLL_STEP;
            }

            if (deltaX !== 0 || deltaY !== 0) {
                scrollElement.scrollBy({ left: deltaX, top: deltaY });
                const hoveredElement = document.elementFromPoint(x, y);
                const cellElement = hoveredElement?.closest?.('[data-schedule-cell="true"]');
                const nextRowId = cellElement?.getAttribute?.("data-schedule-row-id");
                const nextField = cellElement?.getAttribute?.("data-schedule-field");
                if (nextRowId && nextField) {
                    handleCellSelectionEnter(nextRowId, nextField);
                }
            }

            cellSelectionAutoScrollFrameRef.current = window.requestAnimationFrame(tickAutoScroll);
        };

        const handleMouseMove = (event) => {
            cellSelectionPointerRef.current = {
                x: event.clientX,
                y: event.clientY
            };

            if (!cellSelectionAutoScrollFrameRef.current) {
                cellSelectionAutoScrollFrameRef.current = window.requestAnimationFrame(tickAutoScroll);
            }
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            if (cellSelectionAutoScrollFrameRef.current) {
                window.cancelAnimationFrame(cellSelectionAutoScrollFrameRef.current);
                cellSelectionAutoScrollFrameRef.current = null;
            }
        };
    }, [handleCellSelectionEnter]);

    useEffect(() => {
        const handleCopy = (event) => {
            if (viewMode !== "table") return;
            const isTableContextActive = isTablePointerInside || isTableFocusInside || Boolean(activeCell);
            if (!isTableContextActive) return;

            const activeElement = document.activeElement;
            if (
                (activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA")
                && typeof activeElement.selectionStart === "number"
                && activeElement.selectionStart !== activeElement.selectionEnd
            ) {
                return;
            }

            const text = buildClipboardTextFromSelection();
            if (!text) return;
            event.clipboardData?.setData("text/plain", text);
            event.preventDefault();
        };

        window.addEventListener("copy", handleCopy);
        return () => window.removeEventListener("copy", handleCopy);
    }, [activeCell, buildClipboardTextFromSelection, isTableFocusInside, isTablePointerInside, viewMode]);

    useEffect(() => {
        const handleCut = (event) => {
            if (viewMode !== "table") return;
            const isTableContextActive = isTablePointerInside || isTableFocusInside || Boolean(activeCell);
            if (!isTableContextActive) return;

            const activeElement = document.activeElement;
            if (
                (activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA")
                && typeof activeElement.selectionStart === "number"
                && activeElement.selectionStart !== activeElement.selectionEnd
            ) {
                return;
            }

            const text = buildClipboardTextFromSelection();
            if (!text) return;
            event.clipboardData?.setData("text/plain", text);
            event.preventDefault();
            clearSelectedCells();
        };

        window.addEventListener("cut", handleCut);
        return () => window.removeEventListener("cut", handleCut);
    }, [activeCell, buildClipboardTextFromSelection, clearSelectedCells, isTableFocusInside, isTablePointerInside, viewMode]);

    useEffect(() => {
        const handlePaste = (event) => {
            if (viewMode !== "table" || !activeCell?.itemId || !activeCell?.field) return;
            const isTableContextActive = isTablePointerInside || isTableFocusInside || Boolean(activeCell);
            if (!isTableContextActive) return;

            const target = event.target;
            const isTypingTarget = (() => {
                if (!target) return false;
                if (target?.isContentEditable) return true;
                if (target?.tagName === "TEXTAREA") return true;
                if (target?.tagName !== "INPUT") return false;
                const inputType = String(target?.type || "").toLowerCase();
                return !["checkbox", "radio", "button", "submit", "reset"].includes(inputType);
            })();
            if (isTypingTarget) return;

            const pastedText = event.clipboardData?.getData("text/plain");
            const applied = applyClipboardMatrix({
                rowId: activeCell.itemId,
                field: activeCell.field,
                text: pastedText
            });
            if (applied) {
                event.preventDefault();
            }
        };

        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, [activeCell, applyClipboardMatrix, isTableFocusInside, isTablePointerInside, viewMode]);

    useEffect(() => {
        if (!isFilterActive) return;
        setSelectedItemIds((prev) => prev.filter((id) => visibleItemIdSet.has(id)));
    }, [isFilterActive, visibleItemIdSet]);

    useEffect(() => {
        if (!activeCell?.itemId) return;
        if (visibleItemIdSet.has(activeCell.itemId)) return;
        setActiveCell(null);
        setCellSelectionRange(null);
    }, [activeCell, visibleItemIdSet]);

    useEffect(() => {
        if (!activeCell?.field) return;
        if (visibleColumnKeySet.has(activeCell.field)) return;
        setActiveCell(null);
        setCellSelectionRange(null);
    }, [activeCell, visibleColumnKeySet]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(visibleColumnKeys));
        } catch {
            // ignore storage errors
        }
    }, [visibleColumnKeys]);

    useEffect(() => {
        if (viewMode !== "table") return;
        const raf = window.requestAnimationFrame(() => {
            updateHorizontalScrollState();
        });
        const handleResize = () => updateHorizontalScrollState();
        window.addEventListener("resize", handleResize);
        return () => {
            window.cancelAnimationFrame(raf);
            window.removeEventListener("resize", handleResize);
        };
    }, [items, updateHorizontalScrollState, viewMode]);

    useEffect(() => {
        if (viewMode !== "table" || !hasHorizontalOverflow) return;
        let seen = false;
        try {
            seen = window.localStorage.getItem(HORIZONTAL_HINT_STORAGE_KEY) === "1";
        } catch {
            // ignore storage errors
        }
        if (!seen) setShowHorizontalHint(true);
    }, [hasHorizontalOverflow, viewMode]);

    useEffect(() => {
        if (showHorizontalHint && canScrollLeft) {
            dismissHorizontalHint();
        }
    }, [canScrollLeft, dismissHorizontalHint, showHorizontalHint]);

    useEffect(() => {
        if (!openCategoryMenu) return;
        const handleClickOutside = (event) => {
            const target = event.target;
            const clickedTrigger = categoryMenuRef.current?.contains(target);
            const clickedDropdown = categoryMenuDropdownRef.current?.contains(target);
            if (!clickedTrigger && !clickedDropdown) {
                setOpenCategoryMenu(null);
            }
        };
        const handleEscape = (event) => {
            if (event.key === "Escape") setOpenCategoryMenu(null);
        };
        window.addEventListener("mousedown", handleClickOutside);
        window.addEventListener("keydown", handleEscape);
        return () => {
            window.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("keydown", handleEscape);
        };
    }, [openCategoryMenu]);

    useEffect(() => {
        if (!openCategoryMenu) {
            setCategoryMenuPosition(null);
            return;
        }
        const rafId = window.requestAnimationFrame(updateCategoryMenuPosition);
        window.addEventListener("resize", updateCategoryMenuPosition);
        window.addEventListener("scroll", updateCategoryMenuPosition, true);
        return () => {
            window.cancelAnimationFrame(rafId);
            window.removeEventListener("resize", updateCategoryMenuPosition);
            window.removeEventListener("scroll", updateCategoryMenuPosition, true);
        };
    }, [openCategoryMenu, updateCategoryMenuPosition]);

    useEffect(() => {
        const itemIdSet = new Set(items.map((item) => item.id));
        setSelectedItemIds((prev) => prev.filter((id) => itemIdSet.has(id)));
    }, [items]);

    useEffect(() => {
        if (!activeEditingItemId) return;
        const exists = items.some((item) => item.id === activeEditingItemId);
        if (!exists) {
            setActiveEditingItemId(null);
        }
    }, [items, activeEditingItemId]);

    useEffect(() => {
        if (!selectAllRef.current) return;
        selectAllRef.current.indeterminate = selectedCount > 0 && !allSelected;
    }, [allSelected, selectedCount]);

    useEffect(() => {
        const headerEl = tableHeaderRef.current;
        if (!headerEl) return;

        const updateHeaderHeight = () => {
            const headHeight = headerEl.getBoundingClientRect().height || 0;
            const thHeights = Array.from(headerEl.querySelectorAll("th")).map(
                (th) => th.getBoundingClientRect().height || 0
            );
            const maxThHeight = thHeights.length > 0 ? Math.max(...thHeights) : 0;
            const measured = Math.ceil(Math.max(headHeight, maxThHeight, 44));
            setTableHeaderHeight((prev) => (prev === measured ? prev : measured));
        };

        updateHeaderHeight();
        let resizeObserver = null;
        if (typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(updateHeaderHeight);
            resizeObserver.observe(headerEl);
        }
        window.addEventListener("resize", updateHeaderHeight);

        return () => {
            if (resizeObserver) resizeObserver.disconnect();
            window.removeEventListener("resize", updateHeaderHeight);
        };
    }, [viewMode]);

    useEffect(() => {
        const toolbarEl = tableToolbarRef.current;
        if (!toolbarEl) return;

        const updateToolbarHeight = () => {
            const measured = Math.ceil(toolbarEl.getBoundingClientRect().height || 72);
            setTableToolbarHeight((prev) => (prev === measured ? prev : measured));
        };

        updateToolbarHeight();
        let resizeObserver = null;
        if (typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(updateToolbarHeight);
            resizeObserver.observe(toolbarEl);
        }
        window.addEventListener("resize", updateToolbarHeight);

        return () => {
            if (resizeObserver) resizeObserver.disconnect();
            window.removeEventListener("resize", updateToolbarHeight);
        };
    }, [viewMode, visibleItems.length, selectedCount, searchKeyword, categoryFilter]);

    return {
        activeCell,
        cellSelectionRange,
        activeDragItem,
        activeEditingItem,
        activeEditingItemId,
        activeId,
        allSelected,
        canScrollLeft,
        canScrollRight,
        categoryFilter,
        categoryItemsMap,
        categoryMenuDropdownRef,
        categoryMenuPosition,
        categoryMenuRef,
        categoryOptions,
        categoryRenameTarget,
        categoryRenameValue,
        dismissHorizontalHint,
        dragMovingItemSet,
        dragSelectItem,
        dropPosition,
        dropTargetId,
        groupedVisibleItems,
        handleActivateCell,
        handleCellSelectionEnter,
        handleCellSelectionStart,
        clearSelectedCells,
        clearCellSelectionRange,
        handleActivateItem,
        handleCancelCategoryRename,
        handleCellKeyDown,
        handleCellPaste,
        handleChange,
        handleDragCancel,
        handleDragEnd,
        handleDragOver,
        handleDragStart,
        handleScroll,
        handleStartCategoryRename,
        handleTableBlurCapture,
        hasHorizontalOverflow,
        hasSearchKeyword,
        getCellSelectionClassName,
        getCellSelectionBounds,
        isCellSelected,
        isDropInvalid,
        isFilterActive,
        isScrolling,
        isTableFocusInside,
        isTablePointerInside,
        openCategoryMenu,
        selectAllRef,
        searchKeyword,
        selectedCount,
        selectedItemIds,
        sensors,
        selectAllCells,
        setActiveEditingItemId,
        setCategoryFilter,
        setCategoryRenameValue,
        setIsTableFocusInside,
        setIsTablePointerInside,
        setOpenCategoryMenu,
        setSearchKeyword,
        setSelectedItemIds,
        showHorizontalHint,
        showAllColumns,
        startSelectionDrag,
        tableHeaderHeight,
        tableHeaderRef,
        tableToolbarHeight,
        tableToolbarRef,
        tableInteractionRef,
        tableScrollRef,
        toggleSelectAllItems,
        toggleColumnVisibility,
        toggleSelectItem,
        visibleColumnKeys,
        visibleColumnKeySet,
        visibleItemIdSet,
        visibleItemIds,
        visibleItems
    };
}
