import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { saveScheduleData, initializeDefaultItems, fetchScheduleItems, exportScheduleExcel } from "../api/cpe_all/construction_schedule";
import { updateWorkCondition } from "../api/cpe/calc";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { markFtueDone } from "../utils/ftue";
import { FTUE_STEP_IDS } from "../config/ftueSteps";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import StandardImportModal from "../components/cpe/StandardImportModal";
import ScheduleHeader from "../components/cpe/schedule/ScheduleHeader";
import ScheduleGanttPanel from "../components/cpe/schedule/ScheduleGanttPanel";
import EvidenceResultModal from "../components/cpe/schedule/EvidenceResultModal";
import SnapshotManager from "../components/cpe/schedule/SnapshotManager";
import ScheduleMasterTableToolbarRow from "../components/cpe/schedule/ScheduleMasterTableToolbarRow";
import ScheduleCategorySection from "../components/cpe/schedule/ScheduleCategorySection";

import { useScheduleStore } from "../stores/scheduleStore";
import { useConfirm } from "../contexts/ConfirmContext";
import { useAIScheduleOptimizer } from "../hooks/useAIScheduleOptimizer";
import { useScheduleData } from "../hooks/useScheduleData";
import { useDragHandlers } from "../hooks/useDragHandlers";
import { calculateTotalCalendarDays, calculateTotalCalendarMonths } from "../utils/scheduleCalculations";
import { calculateGanttItems } from "../components/cpe/ganttUtils";
import { fetchProductivities } from "../api/cpe_all/productivity";

const HORIZONTAL_HINT_STORAGE_KEY = "scheduleMaster.horizontalHintSeen";

export default function ScheduleMasterList() {
    const { id: projectId } = useParams();

    // Store Integration
    const items = useScheduleStore((state) => state.items);
    const operatingRates = useScheduleStore((state) => state.operatingRates);
    const links = useScheduleStore((state) => state.links);
    const subTasks = useScheduleStore((state) => state.subTasks);
    const workDayType = useScheduleStore((state) => state.workDayType);
    const ganttDateScale = useScheduleStore((state) => state.ganttDateScale);

    // Actions
    const setStoreItems = useScheduleStore((state) => state.setItems);
    const setStoreOperatingRates = useScheduleStore((state) => state.setOperatingRates);
    const updateOperatingRate = useScheduleStore((state) => state.updateOperatingRate);
    const setStoreLinks = useScheduleStore((state) => state.setLinks);
    const setStoreWorkDayType = useScheduleStore((state) => state.setWorkDayType);
    const setStoreSubTasks = useScheduleStore((state) => state.setSubTasks);
    const updateItem = useScheduleStore((state) => state.updateItem);
    const updateItemsField = useScheduleStore((state) => state.updateItemsField);
    const addItem = useScheduleStore((state) => state.addItem);
    const addItemAtIndex = useScheduleStore((state) => state.addItemAtIndex);
    const deleteItems = useScheduleStore((state) => state.deleteItems);
    const reorderItems = useScheduleStore((state) => state.reorderItems);
    const addSubTask = useScheduleStore((state) => state.addSubTask);
    const updateSubTask = useScheduleStore((state) => state.updateSubTask);
    const deleteSubTask = useScheduleStore((state) => state.deleteSubTask);

    // Temporal (Undo/Redo) - Safe Access
    const temporalStore = useScheduleStore.temporal;
    const [, forceTemporalVersion] = useState(0);
    const temporalState = temporalStore ? temporalStore.getState() : null;
    const pastStates = temporalState?.pastStates || [];
    const futureStates = temporalState?.futureStates || [];

    const canUndo = pastStates.length > 0;
    const canRedo = futureStates.length > 0;

    useEffect(() => {
        if (!temporalStore) return undefined;
        const unsubscribe = temporalStore.subscribe(() => {
            forceTemporalVersion((version) => version + 1);
        });
        return unsubscribe;
    }, [temporalStore]);

    const runUndo = useCallback(() => {
        if (!temporalStore) return;
        const temporal = temporalStore.getState();
        const lastPastState = temporal?.pastStates?.[temporal.pastStates.length - 1];
        if (!lastPastState) return;

        // Corrupted temporal entry guard: prevent hard crash on malformed states.
        if (!Array.isArray(lastPastState.items)) {
            console.error("[Temporal] Invalid undo state:", lastPastState);
            temporal.clear?.();
            toast.error("히스토리 상태가 꼬여 실행 취소 기록을 초기화했습니다.");
            return;
        }

        try {
            temporal.undo();
        } catch (error) {
            console.error("[Temporal] undo failed:", error);
            toast.error("실행 취소 중 오류가 발생했습니다.");
        }
    }, [temporalStore]);

    const runRedo = useCallback(() => {
        if (!temporalStore) return;
        const temporal = temporalStore.getState();
        const lastFutureState = temporal?.futureStates?.[temporal.futureStates.length - 1];
        if (!lastFutureState) return;

        if (!Array.isArray(lastFutureState.items)) {
            console.error("[Temporal] Invalid redo state:", lastFutureState);
            temporal.clear?.();
            toast.error("히스토리 상태가 꼬여 다시 실행 기록을 초기화했습니다.");
            return;
        }

        try {
            temporal.redo();
        } catch (error) {
            console.error("[Temporal] redo failed:", error);
            toast.error("다시 실행 중 오류가 발생했습니다.");
        }
    }, [temporalStore]);

    // Keyboard Shortcuts
    useEffect(() => {
        if (!temporalStore) return;

        const handleKeyDown = (e) => {
            const target = e.target;
            const isEditableTarget = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
            if (isEditableTarget) return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                if (e.shiftKey) {
                    if (canRedo) runRedo();
                } else {
                    if (canUndo) runUndo();
                }
                e.preventDefault();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                if (canRedo) runRedo();
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canUndo, canRedo, runRedo, runUndo, temporalStore]);

    // Smart Actions
    const resizeTaskBar = useScheduleStore((state) => state.resizeTaskBar);
    const resizeTaskBarByProductivity = useScheduleStore((state) => state.resizeTaskBarByProductivity);

    const { confirm } = useConfirm();

    // Custom Hooks
    const {
        loading,
        loadData,
        cipResult,
        pileResult,
        boredResult,
        cipStandards,
        pileStandards,
        boredStandards,
        startDate,
        setStartDate,
        projectName,
        containerId,
        setContainerId
    } = useScheduleData(projectId, setStoreItems, setStoreOperatingRates, setStoreLinks, setStoreWorkDayType, setStoreSubTasks);

    const {
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
        aiOriginalRef,
        runAiAdjustment,
        handleAiCancel,
        handleAiApply
    } = useAIScheduleOptimizer(items, operatingRates, workDayType, projectName, setStoreItems);

    // Calculated Values
    const totalCalendarDays = useMemo(() => calculateTotalCalendarDays(items), [items]);
    const totalCalendarMonths = useMemo(() => calculateTotalCalendarMonths(totalCalendarDays), [totalCalendarDays]);

    // Local State
    const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
    const [evidenceTargetParent, setEvidenceTargetParent] = useState(null);
    const [saving, setSaving] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
    const [importTargetParent, setImportTargetParent] = useState(null);
    const [viewMode, setViewMode] = useState("table"); // "table" or "gantt"
    const [newMainCategory, setNewMainCategory] = useState("");
    const [isScrolling, setIsScrolling] = useState(false);
    const [standardItems, setStandardItems] = useState([]);
    const [selectedItemIds, setSelectedItemIds] = useState([]);
    const [activeEditingItemId, setActiveEditingItemId] = useState(null);
    const [categoryRenameTarget, setCategoryRenameTarget] = useState(null);
    const [categoryRenameValue, setCategoryRenameValue] = useState("");
    const [isSelectionDragging, setIsSelectionDragging] = useState(false);
    const [rowClassEditModal, setRowClassEditModal] = useState({
        open: false,
        itemId: null,
        process: "",
        sub_process: ""
    });
    const [floorBatchModal, setFloorBatchModal] = useState(null);
    const [floorBatchRange, setFloorBatchRange] = useState({ min: "", max: "" });
    const [openCategoryMenu, setOpenCategoryMenu] = useState(null);
    const [searchKeyword, setSearchKeyword] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [isTablePointerInside, setIsTablePointerInside] = useState(false);
    const [isTableFocusInside, setIsTableFocusInside] = useState(false);
    const selectAllRef = useRef(null);
    const tableHeaderRef = useRef(null);
    const tableScrollRef = useRef(null);
    const tableInteractionRef = useRef(null);
    const categoryMenuRef = useRef(null);
    const categoryMenuDropdownRef = useRef(null);
    const [tableHeaderHeight, setTableHeaderHeight] = useState(44);
    const [categoryMenuPosition, setCategoryMenuPosition] = useState(null);
    const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [showHorizontalHint, setShowHorizontalHint] = useState(false);
    const selectionDragModeRef = useRef(null);
    const selectionDragVisitedRef = useRef(new Set());
    const startDateRequestRef = useRef(0);

    const selectedIdSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
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
    const selectedVisibleCount = useMemo(
        () => selectedItemIds.reduce((count, id) => count + (visibleItemIdSet.has(id) ? 1 : 0), 0),
        [selectedItemIds, visibleItemIdSet]
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
        if (!isFilterActive) return;
        setSelectedItemIds((prev) => prev.filter((id) => visibleItemIdSet.has(id)));
    }, [isFilterActive, visibleItemIdSet]);

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

    // Scroll handler for custom scrollbar
    const handleScroll = useCallback((e) => {
        setIsScrolling(true);
        clearTimeout(window.scrollTimeout);
        window.scrollTimeout = setTimeout(() => {
            setIsScrolling(false);
        }, 1000);
        updateHorizontalScrollState();
    }, [updateHorizontalScrollState]);

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

    const handleExportExcel = useCallback(async () => {
        try {
            const response = await exportScheduleExcel(projectId, { dateScale: ganttDateScale });
            const blob = new Blob([response.data], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            const safeProject = (projectName || "프로젝트").replace(/[\\/:*?"<>|]/g, "_");
            link.download = `공사기간_산정_기준_${safeProject}.xlsx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("엑셀 내보내기 실패:", error);
            toast.error("엑셀 내보내기 실패");
        }
    }, [projectId, projectName, ganttDateScale, aiDisplayItems, items]);

    // Dnd Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    useEffect(() => {
        loadData();
    }, [loadData]);

    // FTUE: 공정표 진입 → edit_schedule 완료
    useEffect(() => {
        markFtueDone("TOTAL", "edit_schedule", FTUE_STEP_IDS.TOTAL);
    }, []);

    // FTUE: 간트뷰 전환 → adjust_gantt 완료
    useEffect(() => {
        if (viewMode === "gantt") {
            markFtueDone("TOTAL", "adjust_gantt", FTUE_STEP_IDS.TOTAL);
        }
    }, [viewMode]);

    useEffect(() => {
        let isMounted = true;
        const loadStandards = async () => {
            try {
                const data = await fetchProductivities(projectId);
                const list = Array.isArray(data) ? data : (data.results || []);
                if (isMounted) setStandardItems(list);
            } catch (error) {
                console.error("Failed to load standard productivities:", error);
            }
        };
        if (projectId) loadStandards();
        return () => {
            isMounted = false;
        };
    }, [projectId]);

    useEffect(() => {
        if (!subTasks || subTasks.length === 0) return;
        const itemIdSet = new Set(items.map((item) => item.id));
        const filtered = subTasks.filter((subtask) => itemIdSet.has(subtask.itemId));
        if (filtered.length !== subTasks.length) {
            setStoreSubTasks(filtered);
        }
    }, [items, subTasks, setStoreSubTasks]);

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

    const handleAddEvidenceItem = useCallback((type, row) => {
        const parent = evidenceTargetParent || items[0];
        if (!parent) {
            toast.error("추가할 위치를 찾을 수 없습니다.");
            return;
        }
        const label = row.label || (type === "cip" ? "CIP" : type === "pile" ? "Pile" : "Bored");
        const newItem = {
            id: `evidence-${type}-${row.id}-${Date.now()}`,
            main_category: parent.main_category || "근거 데이터",
            process: parent.process || `${label} 결과`,
            sub_process: parent.sub_process || "",
            work_type: label,
            unit: parent.unit || "",
            quantity: row.total_depth ?? 0,
            quantity_formula: row.calculation_formula || "",
            productivity: row.daily_production_count ?? 0,
            crew_size: parent.crew_size || 1,
            remarks: row.description || row.remark || "",
            operating_rate_type: parent.operating_rate_type || "EARTH",
            operating_rate_value: parent.operating_rate_value || 0,
            cp_checked: true,
            parallel_rate: 0,
            application_rate: 100,
            reflection_rate: 100
        };
        const index = items.findIndex((item) => item.id === parent.id);
        if (index >= 0) {
            addItemAtIndex(newItem, index + 1);
        } else {
            addItem(newItem);
        }
        toast.success("근거 결과 항목이 추가되었습니다.");
    }, [addItem, addItemAtIndex, evidenceTargetParent, items]);

    // --- Store Actions Wrapper ---
    const handleChange = (id, field, value) => {
        updateItem(id, field, value);
    };

    const handleGroupFieldChange = useCallback((id, field, value, targetIds = []) => {
        const ids = Array.isArray(targetIds) ? targetIds.filter(Boolean) : [];
        if (ids.length > 1) {
            updateItemsField(ids, field, value);
            return;
        }
        updateItem(id, field, value);
    }, [updateItem, updateItemsField]);

    const handleOpenRowClassEdit = useCallback((item) => {
        if (!item?.id) return;
        setRowClassEditModal({
            open: true,
            itemId: item.id,
            process: item.process || "",
            sub_process: item.sub_process || ""
        });
    }, []);

    const handleCloseRowClassEdit = useCallback(() => {
        setRowClassEditModal({
            open: false,
            itemId: null,
            process: "",
            sub_process: ""
        });
    }, []);

    const handleSaveRowClassEdit = useCallback(() => {
        if (!rowClassEditModal.itemId) return;
        updateItem(rowClassEditModal.itemId, "process", rowClassEditModal.process);
        updateItem(rowClassEditModal.itemId, "sub_process", rowClassEditModal.sub_process);
        handleCloseRowClassEdit();
    }, [handleCloseRowClassEdit, rowClassEditModal.itemId, rowClassEditModal.process, rowClassEditModal.sub_process, updateItem]);

    const handleActivateItem = useCallback((item) => {
        if (!item?.id) return;
        setActiveEditingItemId(item.id);
    }, []);

    const handleAddItem = (parentItem = null) => {
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
            const index = items.findIndex(i => i.id === targetItem.id);
            addItemAtIndex(newItem, index + 1);
        } else {
            addItem(newItem);
        }
    };

    const handleCreateSubtask = useCallback((itemId, startDay, durationDays, extraProps = {}) => {
        addSubTask({
            id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            itemId,
            startDay,
            durationDays,
            label: "부세부공종",
            ...extraProps
        });
    }, [addSubTask]);

    const handleUpdateSubtask = useCallback((id, updates) => {
        updateSubTask(id, updates);
    }, [updateSubTask]);

    const handleDeleteSubtask = useCallback((id) => {
        deleteSubTask(id);
    }, [deleteSubTask]);

    const handleAddMainCategory = () => {
        const name = newMainCategory.trim();
        if (!name) {
            toast.error("대공종명을 입력해주세요.");
            return;
        }
        const newItem = {
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
        };
        addItem(newItem);
        setNewMainCategory("");
        toast.success("대공종이 추가되었습니다.");
    };

    const handleCategoryRunRateChange = async (category, newRunRate) => {
        const parsedRunRate = parseInt(newRunRate, 10);
        if (!Number.isFinite(parsedRunRate) || parsedRunRate < 1) {
            toast.error("유효한 Run Rate 값을 선택해주세요.");
            return;
        }

        const prevRates = Array.isArray(operatingRates)
            ? operatingRates.map((rate) => ({ ...rate }))
            : [];

        try {
            // Optimistic update for instant UI feedback
            updateOperatingRate(category, parsedRunRate);

            const rateToUpdate = prevRates.find((r) => r.main_category === category);
            const payload = {
                weights: [{
                    ...(rateToUpdate?.id ? { id: rateToUpdate.id } : {}),
                    main_category: category,
                    work_week_days: parsedRunRate
                }]
            };
            const { updateOperatingRate: updateOperatingRateAPI } = await import("../api/cpe/operating_rate");
            const savedRatesResponse = await updateOperatingRateAPI(projectId, payload);
            const normalizedSavedRates = Array.isArray(savedRatesResponse)
                ? savedRatesResponse
                : Array.isArray(savedRatesResponse?.results)
                    ? savedRatesResponse.results
                    : Array.isArray(savedRatesResponse?.data)
                        ? savedRatesResponse.data
                        : null;
            if (normalizedSavedRates) {
                setStoreOperatingRates(normalizedSavedRates);
            }
            toast.success(`${category} Run Rate 업데이트 완료`);
        } catch (error) {
            console.error("Run Rate 업데이트 실패:", error);
            setStoreOperatingRates(prevRates);
            toast.error("Run Rate 업데이트 실패 - 변경값을 되돌렸습니다.");
        }
    };

    // --- Gantt to Store Connection ---
    const handleGanttResize = (itemId, newCalendarDays, mode = 'crew') => {
        if (mode === 'prod') {
            resizeTaskBarByProductivity(itemId, newCalendarDays);
        } else {
            resizeTaskBar(itemId, newCalendarDays);
        }
    };

    const handleSmartResize = (itemId, newCalendarDays, baseProductivity = null) => {
        resizeTaskBar(itemId, newCalendarDays, baseProductivity);
    };

    const handleOpenImport = (parentItem) => {
        setImportTargetParent(parentItem);
        setImportModalOpen(true);
    };

    const handleImportSelect = async (importedData) => {
        const dataArray = Array.isArray(importedData) ? importedData : [importedData];

        dataArray.forEach(std => {
            const processName = std.category || std.process_name || importTargetParent?.process || "수입 작업";
            const subProcessName = std.sub_category || std.work_type_name || importTargetParent?.sub_process || "";
            const workTypeName = std.sub_category || std.work_type_name || std.category || "수입 세부공종";
            const tocLabel = std.item_name || "";
            const noteText = tocLabel ? (std.remark ? `${tocLabel} (${std.remark})` : tocLabel) : (std.remark || "");
            const newItem = {
                id: `imp-${Date.now()}-${Math.random()}`,
                main_category: importTargetParent?.main_category || "수입 세부공종",
                process: processName,
                sub_process: subProcessName,
                work_type: workTypeName,
                unit: std.unit,
                quantity: 1,
                quantity_formula: "",
                // Use the selected productivity value (from modal selection)
                productivity: std.productivity || std.pumsam_workload || 0,
                crew_size: 1,
                operating_rate_type: "EARTH",
                operating_rate_value: 0,
                standard_code: std.code || std.standard,
                // 표준품셈 목차(item_name)는 비고(note)로 반영
                note: noteText,
                remarks: noteText,
                cp_checked: true,
                parallel_rate: 0,
                application_rate: 100,
                reflection_rate: 100
            };

            if (importTargetParent) {
                const idx = items.findIndex(i => i.id === importTargetParent.id);
                addItemAtIndex(newItem, idx + 1);
            } else {
                addItem(newItem);
            }
        });

        toast.success("표준품셈 항목 추가");
        setImportModalOpen(false);
    };

    const deriveStandardProductivity = useCallback((std) => {
        if (std?.molit_workload) {
            return { productivity: std.molit_workload, remark: '국토부 가이드라인 물량 기준' };
        }
        if (std?.pumsam_workload) {
            return { productivity: std.pumsam_workload, remark: '표준품셈 물량 기준' };
        }
        return { productivity: 0, remark: '추천 기준 없음' };
    }, []);

    const handleApplyStandardToRow = useCallback((item, std) => {
        if (!item || !std) return;
        const { productivity, remark } = deriveStandardProductivity(std);
        const processName = std.category || std.process_name || item.process || '';
        const subProcessName = std.sub_category || std.work_type_name || item.sub_process || '';
        const workTypeName = std.sub_category || std.work_type_name || std.category || item.work_type || '';
        const tocLabel = std.item_name || '';
        const noteText = tocLabel ? `${tocLabel} (${remark})` : (item.note || remark);
        updateItem(item.id, 'process', processName);
        updateItem(item.id, 'sub_process', subProcessName);
        updateItem(item.id, 'work_type', workTypeName);
        updateItem(item.id, 'unit', std.unit || item.unit || '');
        updateItem(item.id, 'productivity', productivity || 0);
        updateItem(item.id, 'standard_code', std.code || std.standard || item.standard_code || '');
        updateItem(item.id, 'note', noteText);
        updateItem(item.id, 'remarks', noteText);
    }, [deriveStandardProductivity, updateItem]);

    const spanInfoMap = useMemo(() => {
        const map = {};
        const splitRowIdSet = new Set(selectedItemIds);
        if (activeEditingItemId) {
            splitRowIdSet.add(activeEditingItemId);
        }
        const groupedItems = visibleItems.reduce((acc, item) => {
            const category = item.main_category || '기타';
            if (!acc[category]) acc[category] = [];
            acc[category].push(item);
            return acc;
        }, {});

        Object.values(groupedItems).forEach((categoryItems) => {
            // Merge same `process` values in "중공종" column.
            let i = 0;
            while (i < categoryItems.length) {
                const processValue = String(categoryItems[i]?.process || "");
                const startRow = categoryItems[i];
                const startRowSelected = splitRowIdSet.has(startRow.id);
                let j = i + 1;
                while (
                    !startRowSelected &&
                    j < categoryItems.length &&
                    String(categoryItems[j]?.process || "") === processValue &&
                    !splitRowIdSet.has(categoryItems[j].id)
                ) {
                    j += 1;
                }
                const span = startRowSelected ? 1 : (j - i);
                const groupIds = categoryItems.slice(i, j).map((row) => row.id);
                for (let k = i; k < j; k += 1) {
                    const row = categoryItems[k];
                    if (!map[row.id]) map[row.id] = {};
                    map[row.id].isProcessFirst = k === i;
                    map[row.id].processRowSpan = span;
                    map[row.id].processGroupIds = groupIds;
                }
                i = j;
            }

            // Merge same `sub_process` values in "공정" column.
            i = 0;
            while (i < categoryItems.length) {
                const processValue = String(categoryItems[i]?.process || "");
                const subProcessValue = String(categoryItems[i]?.sub_process || "");
                const startRow = categoryItems[i];
                const startRowSelected = splitRowIdSet.has(startRow.id);
                let j = i + 1;
                while (
                    !startRowSelected &&
                    j < categoryItems.length &&
                    String(categoryItems[j]?.process || "") === processValue &&
                    String(categoryItems[j]?.sub_process || "") === subProcessValue &&
                    !splitRowIdSet.has(categoryItems[j].id)
                ) {
                    j += 1;
                }
                const span = startRowSelected ? 1 : (j - i);
                const groupIds = categoryItems.slice(i, j).map((row) => row.id);
                for (let k = i; k < j; k += 1) {
                    const row = categoryItems[k];
                    if (!map[row.id]) map[row.id] = {};
                    map[row.id].isSubProcessFirst = k === i;
                    map[row.id].subProcessRowSpan = span;
                    map[row.id].subProcessGroupIds = groupIds;
                }
                i = j;
            }
        });

        return map;
    }, [visibleItems, selectedItemIds, activeEditingItemId]);

    const handleDeleteItem = async (id) => {
        const ok = await confirm("삭제하시겠습니까?");
        if (!ok) return;
        deleteItems([id]);
        setSelectedItemIds((prev) => prev.filter((itemId) => itemId !== id));
    };

    const handleDeleteSelectedItems = useCallback(async () => {
        const targetIds = isFilterActive
            ? selectedItemIds.filter((id) => visibleItemIdSet.has(id))
            : selectedItemIds;
        if (targetIds.length === 0) return;
        const ok = await confirm(`선택된 ${targetIds.length}개 항목을 삭제하시겠습니까?`);
        if (!ok) return;
        deleteItems(targetIds);
        const removedIdSet = new Set(targetIds);
        setSelectedItemIds((prev) => prev.filter((id) => !removedIdSet.has(id)));
        toast.success(`${targetIds.length}개 항목이 삭제되었습니다.`);
    }, [confirm, deleteItems, isFilterActive, selectedItemIds, visibleItemIdSet]);

    const handleDeleteCategory = async (category, categoryItems) => {
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
    };

    const handleStartCategoryRename = useCallback((category) => {
        setCategoryRenameTarget(category);
        setCategoryRenameValue(category);
        setOpenCategoryMenu(null);
    }, []);

    const handleCancelCategoryRename = useCallback(() => {
        setCategoryRenameTarget(null);
        setCategoryRenameValue("");
    }, []);

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

        // Keep table calculation stable by syncing category/rate keys together immediately.
        setStoreOperatingRates(nextRates);
        updateItemsField(targetIds, "main_category", nextCategory);
        if (rateIdsToRename.length > 0) {
            try {
                const { updateOperatingRate: updateOperatingRateAPI } = await import("../api/cpe/operating_rate");
                const savedRates = await updateOperatingRateAPI(projectId, {
                    weights: rateIdsToRename.map((id) => ({
                        id,
                        main_category: nextCategory
                    }))
                });
                setStoreOperatingRates(savedRates);
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

    const handleOpenFloorBatchModal = useCallback((category, categoryItems) => {
        setFloorBatchModal({ category, categoryItems });
        setFloorBatchRange({ min: "", max: "" });
    }, []);

    const handleCloseFloorBatchModal = useCallback(() => {
        setFloorBatchModal(null);
        setFloorBatchRange({ min: "", max: "" });
    }, []);

    const handleGenerateFloorBatch = useCallback(() => {
        if (!floorBatchModal) return;

        const minFloor = parseInt(floorBatchRange.min, 10);
        const maxFloor = parseInt(floorBatchRange.max, 10);
        if (!Number.isInteger(minFloor) || !Number.isInteger(maxFloor)) {
            toast.error("최하층/최상층을 정수로 입력해주세요.");
            return;
        }
        if (minFloor === 0 || maxFloor === 0) {
            toast.error("0층은 사용할 수 없습니다. 지하는 음수로 입력해주세요.");
            return;
        }
        if (minFloor > maxFloor) {
            toast.error("최하층은 최상층보다 작거나 같아야 합니다.");
            return;
        }

        const floors = [];
        for (let floor = minFloor; floor <= maxFloor; floor += 1) {
            if (floor !== 0) floors.push(floor);
        }
        if (floors.length === 0) {
            toast.error("생성할 층 범위를 확인해주세요.");
            return;
        }
        if (floors.length > 200) {
            toast.error("한 번에 200개 층까지만 생성할 수 있습니다.");
            return;
        }

        const { category, categoryItems } = floorBatchModal;
        const lastCategoryItem = categoryItems[categoryItems.length - 1];
        const template = lastCategoryItem || items.find((item) => item.main_category === category);
        if (!template) {
            toast.error("기준이 될 기존 공정을 찾을 수 없습니다.");
            return;
        }

        const toFloorLabel = (floor) => (floor < 0 ? `지하${Math.abs(floor)}층` : `지상${floor}층`);
        const isFloorLikeName = (value) => {
            const raw = String(value || "").trim();
            if (!raw) return false;
            return /^(지하|지상)\s*\d+\s*층$/i.test(raw) || /^B\d+F$/i.test(raw) || /^\d+F$/i.test(raw);
        };

        // Use one contiguous block as template.
        // Priority: existing floor block -> current(last) block.
        const getBlockByStartIndex = (startIdx) => {
            if (startIdx < 0 || startIdx >= categoryItems.length) return [];
            const baseProcess = String(categoryItems[startIdx]?.process || "");
            const baseSubProcess = String(categoryItems[startIdx]?.sub_process || "");
            const block = [];
            for (let idx = startIdx; idx < categoryItems.length; idx += 1) {
                const row = categoryItems[idx];
                if (
                    String(row?.process || "") !== baseProcess ||
                    String(row?.sub_process || "") !== baseSubProcess
                ) {
                    break;
                }
                block.push(row);
            }
            return block;
        };

        const firstFloorLikeIndex = categoryItems.findIndex((row) => isFloorLikeName(row?.sub_process));
        const floorTemplateBlock = firstFloorLikeIndex >= 0 ? getBlockByStartIndex(firstFloorLikeIndex) : [];
        const fallbackStartIndex = Math.max(0, categoryItems.findIndex((row) => row.id === template.id));
        const fallbackTemplateBlock = getBlockByStartIndex(fallbackStartIndex);
        const templateBlock = (floorTemplateBlock.length > 0 ? floorTemplateBlock : fallbackTemplateBlock)
            .filter((row) => String(row?.work_type || "").trim().length > 0);

        // Floor batch for framework category must always be created as RC 5-step set.
        const RC_FLOOR_WORK_TYPES = [
            "철근 현장가공 및 조립",
            "유로폼, 합판, 경사 등",
            "데크플레이트",
            "콘크리트 펌프차 타설(철근)",
            "양생"
        ];
        const RC_FLOOR_PRESET = {
            BASEMENT: {
                "철근 현장가공 및 조립": { unit: "TON", quantity: 75.866, productivity: 4, crew_size: 5 },
                "유로폼, 합판, 경사 등": { unit: "M2", quantity: 2846, productivity: 35, crew_size: 10 },
                "데크플레이트": { unit: "M2", quantity: 1083, productivity: 20, crew_size: 6 },
                "콘크리트 펌프차 타설(철근)": { unit: "M3", quantity: 884, productivity: 156, crew_size: 2 },
                "양생": { unit: "", quantity: 1, productivity: 1, crew_size: 1 }
            },
            GROUND: {
                "철근 현장가공 및 조립": { unit: "TON", quantity: 44.631, productivity: 4, crew_size: 5 },
                "유로폼, 합판, 경사 등": { unit: "M2", quantity: 1861, productivity: 35, crew_size: 8 },
                "데크플레이트": { unit: "M2", quantity: 912, productivity: 20, crew_size: 6 },
                "콘크리트 펌프차 타설(철근)": { unit: "M3", quantity: 522, productivity: 156, crew_size: 2 },
                "양생": { unit: "", quantity: 1, productivity: 1, crew_size: 1 }
            }
        };
        const normalizeText = (value) => String(value || "").replace(/\s+/g, "").toUpperCase();
        const referenceRows = categoryItems.filter((row) => String(row?.work_type || "").trim().length > 0);
        const fallbackRow = referenceRows[0] || templateBlock[0] || template;

        const findMatchingRcRow = (targetWorkType) => {
            const target = normalizeText(targetWorkType);
            const exact = referenceRows.find((row) => normalizeText(row?.work_type) === target);
            if (exact) return exact;

            if (target.includes("유로폼")) {
                return referenceRows.find((row) => normalizeText(row?.work_type).includes("유로폼"));
            }
            if (target.includes("철근")) {
                return referenceRows.find((row) => normalizeText(row?.work_type).includes("철근"));
            }
            if (target.includes("데크")) {
                return referenceRows.find((row) => normalizeText(row?.work_type).includes("데크"));
            }
            if (target.includes("타설")) {
                return referenceRows.find(
                    (row) => normalizeText(row?.work_type).includes("콘크리트") && normalizeText(row?.work_type).includes("타설")
                );
            }
            if (target.includes("양생")) {
                return referenceRows.find((row) => normalizeText(row?.work_type).includes("양생"));
            }
            return null;
        };

        if (!fallbackRow) {
            toast.error("복제할 기준 세부공종 묶음을 찾을 수 없습니다.");
            return;
        }

        const existingPairSet = new Set(
            items
                .filter((item) => item.main_category === category)
                .map((item) => `${String(item.sub_process || "").trim()}|${String(item.work_type || "").trim()}`.toUpperCase())
        );

        const lastCategoryIndex = lastCategoryItem
            ? items.findIndex((item) => item.id === lastCategoryItem.id)
            : -1;
        const baseInsertIndex = lastCategoryIndex >= 0 ? lastCategoryIndex + 1 : items.length;

        let insertIndex = baseInsertIndex;
        let createdRowCount = 0;
        let skippedRowCount = 0;
        let createdFloorCount = 0;
        const ts = Date.now();

        floors.forEach((floor, floorIdx) => {
            const floorLabel = toFloorLabel(floor);
            let floorCreated = 0;
            const floorTypeKey = floor < 0 ? "BASEMENT" : "GROUND";
            const floorPreset = RC_FLOOR_PRESET[floorTypeKey];
            const floorTemplate = RC_FLOOR_WORK_TYPES.map((workType) => {
                const matchedRow = findMatchingRcRow(workType);
                const sourceRow = matchedRow || fallbackRow;
                const preset = floorPreset?.[workType] || {};
                return {
                    ...sourceRow,
                    process: "RC공사",
                    work_type: workType,
                    unit: preset.unit ?? sourceRow.unit ?? "",
                    quantity: preset.quantity ?? sourceRow.quantity ?? 0,
                    productivity: preset.productivity ?? sourceRow.productivity ?? 0,
                    crew_size: preset.crew_size ?? sourceRow.crew_size ?? 1
                };
            });

            floorTemplate.forEach((sourceRow, rowIdx) => {
                const pairKey = `${floorLabel}|${String(sourceRow.work_type || "").trim()}`.toUpperCase();
                if (existingPairSet.has(pairKey)) {
                    skippedRowCount += 1;
                    return;
                }

                const newItem = {
                    id: `floor-${ts}-${floorIdx}-${rowIdx}-${Math.random().toString(36).slice(2, 6)}`,
                    main_category: category,
                    process: sourceRow.process || template.process || "",
                    sub_process: floorLabel,
                    work_type: sourceRow.work_type || "",
                    unit: sourceRow.unit || "",
                    quantity: sourceRow.quantity ?? 0,
                    quantity_formula: sourceRow.quantity_formula || "",
                    productivity: sourceRow.productivity ?? 0,
                    crew_size: sourceRow.crew_size ?? 1,
                    note: sourceRow.note || "",
                    remarks: sourceRow.remarks || "",
                    operating_rate_type: sourceRow.operating_rate_type || "FRAME",
                    operating_rate_value: sourceRow.operating_rate_value ?? 0,
                    standard_code: sourceRow.standard_code || "",
                    cp_checked: sourceRow.cp_checked !== false,
                    parallel_rate: sourceRow.cp_checked === false
                        ? 100
                        : (sourceRow.parallel_rate ?? (100 - (sourceRow.application_rate ?? 100))),
                    application_rate: sourceRow.application_rate ?? sourceRow.parallel_rate ?? 100,
                    reflection_rate: sourceRow.reflection_rate ?? 100,
                    front_parallel_days: sourceRow.front_parallel_days ?? 0,
                    back_parallel_days: sourceRow.back_parallel_days ?? 0,
                    parallel_segments: Array.isArray(sourceRow.parallel_segments) ? sourceRow.parallel_segments : []
                };

                addItemAtIndex(newItem, insertIndex);
                insertIndex += 1;
                existingPairSet.add(pairKey);
                createdRowCount += 1;
                floorCreated += 1;
            });

            if (floorCreated > 0) {
                createdFloorCount += 1;
            }
        });

        if (createdRowCount === 0) {
            toast.error("생성 가능한 신규 층 공정이 없습니다.");
            return;
        }

        if (skippedRowCount > 0) {
            toast.success(`${createdFloorCount}개 층 / ${createdRowCount}개 세부공종 생성, ${skippedRowCount}개 중복 건너뜀`);
        } else {
            toast.success(`${createdFloorCount}개 층 / ${createdRowCount}개 세부공종 생성`);
        }
        handleCloseFloorBatchModal();
    }, [addItemAtIndex, floorBatchModal, floorBatchRange.max, floorBatchRange.min, handleCloseFloorBatchModal, items]);

    useEffect(() => {
        const handleTableHotkeys = (e) => {
            if (viewMode !== "table") return;
            const isTableContextActive = isTablePointerInside || isTableFocusInside || Boolean(activeEditingItemId);
            if (!isTableContextActive) return;
            const target = e.target;

            const isTypingTarget = (() => {
                if (!target) return false;
                if (target?.isContentEditable) return true;
                if (target?.tagName === "TEXTAREA") return true;
                if (target?.tagName !== "INPUT") return false;
                const inputType = String(target?.type || "").toLowerCase();
                return !["checkbox", "radio", "button", "submit", "reset"].includes(inputType);
            })();
            if (isTypingTarget) return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                setSelectedItemIds((prev) => {
                    const next = new Set(prev);
                    visibleItemIds.forEach((id) => next.add(id));
                    return Array.from(next);
                });
                return;
            }

            if (selectedCount === 0) return;
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                handleDeleteSelectedItems();
            }
        };

        window.addEventListener('keydown', handleTableHotkeys);
        return () => window.removeEventListener('keydown', handleTableHotkeys);
    }, [activeEditingItemId, handleDeleteSelectedItems, isTableFocusInside, isTablePointerInside, selectedCount, viewMode, visibleItemIds]);

    const handleTableBlurCapture = useCallback(() => {
        window.setTimeout(() => {
            if (!tableInteractionRef.current) return;
            const nextActiveElement = document.activeElement;
            if (!tableInteractionRef.current.contains(nextActiveElement)) {
                setIsTableFocusInside(false);
            }
        }, 0);
    }, []);

    const handleSaveAll = async () => {
        console.log("Saving schedule data... ContainerID:", containerId);
        setSaving(true);
        try {
            let targetContainerId = containerId;

            if (!targetContainerId) {
                console.log("No Container ID. Initializing default items...");
                await initializeDefaultItems(projectId);
                const refetched = await fetchScheduleItems(projectId);
                console.log("Refetched Container ID:", refetched.containerId);
                if (refetched.containerId) {
                    targetContainerId = refetched.containerId;
                    setContainerId(refetched.containerId);
                } else {
                    throw new Error("Failed to create container");
                }
            }

            console.log("Calling saveScheduleData API with ID:", targetContainerId);

            const typeVal = workDayType.replace("d", "");
            console.log("[DEBUG] About to save Run Rate:", {
                projectId,
                typeVal,
                workDayType,
                payload: {
                    earthwork_type: typeVal,
                    framework_type: typeVal
                }
            });

            const results = await Promise.allSettled([
                saveScheduleData(targetContainerId, { items, links, sub_tasks: subTasks }),
                updateWorkCondition(projectId, {
                    earthwork_type: typeVal,
                    framework_type: typeVal
                })
            ]);

            const scheduleResult = results[0];
            const runRateResult = results[1];

            console.log("[DEBUG] Run Rate Result:", runRateResult);

            if (scheduleResult.status === "fulfilled") {
                console.log("Schedule data saved successfully");
            } else {
                console.error("Schedule save failed:", scheduleResult.reason);
            }

            if (runRateResult.status === "fulfilled") {
                console.log("Run Rate saved successfully:", typeVal);
                console.log("Run Rate response:", runRateResult.value);
            } else {
                console.error("Run Rate save failed:", runRateResult.reason);
            }

            if (scheduleResult.status === "fulfilled" && runRateResult.status === "fulfilled") {
                toast.success("저장 완료");
            } else if (scheduleResult.status === "fulfilled" || runRateResult.status === "fulfilled") {
                const failedParts = [];
                if (scheduleResult.status !== "fulfilled") failedParts.push("공정표");
                if (runRateResult.status !== "fulfilled") failedParts.push("Run Rate");
                toast.error(`부분 저장 실패: ${failedParts.join(", ")} 저장에 실패했습니다.`);
            } else {
                throw new Error("Both saves failed");
            }
        } catch (error) {
            console.error("Save failed:", error);
            toast.error("저장 실패");
        } finally {
            setSaving(false);
        }
    };

    const handleStartDateChange = useCallback(async (val) => {
        const previousDate = startDate;
        setStartDate(val);
        const requestId = startDateRequestRef.current + 1;
        startDateRequestRef.current = requestId;

        try {
            const { updateProject } = await import("../api/cpe/project");
            await updateProject(projectId, { start_date: val });
        } catch (error) {
            if (startDateRequestRef.current !== requestId) return;
            console.error("Start Date 저장 실패:", error);
            setStartDate(previousDate);
            toast.error("시작일 저장 실패 - 이전 값으로 되돌렸습니다.");
        }
    }, [projectId, setStartDate, startDate]);

    if (loading) return <div className="p-8 flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--navy-accent)]"></div>
    </div>;

    const activeItem = activeId ? items.find((i) => i.id === activeId) : null;
    const dragMovingItemIds = (() => {
        if (!activeId) return [];
        const selectedSet = new Set(selectedItemIds);
        const activeSelected = selectedSet.has(activeId);
        if (activeSelected && selectedSet.size > 1) {
            return items.filter((item) => selectedSet.has(item.id)).map((item) => item.id);
        }
        return [activeId];
    })();
    const dragMovingItemSet = new Set(dragMovingItemIds);
    const dropTargetId = (() => {
        if (!activeId || !overId || activeId === overId) return null;
        if (dragMovingItemSet.has(overId)) return null;
        return overId;
    })();
    const dropPosition = (() => {
        if (!dropTargetId || !activeId) return null;
        const activeIndex = items.findIndex((item) => item.id === activeId);
        const overIndex = items.findIndex((item) => item.id === dropTargetId);
        if (activeIndex === -1 || overIndex === -1) return null;
        return activeIndex < overIndex ? "after" : "before";
    })();
    const dropTargetItem = dropTargetId ? items.find((item) => item.id === dropTargetId) : null;
    const isDropInvalid = Boolean(
        activeItem && dropTargetItem && activeItem.main_category !== dropTargetItem.main_category
    );
    const renderTableView = ({ forPrint = false } = {}) => (
        <div
            className="relative h-full w-full"
            ref={forPrint ? undefined : tableInteractionRef}
            onMouseEnter={forPrint ? undefined : () => setIsTablePointerInside(true)}
            onMouseLeave={forPrint ? undefined : () => setIsTablePointerInside(false)}
            onFocusCapture={forPrint ? undefined : () => setIsTableFocusInside(true)}
            onBlurCapture={forPrint ? undefined : handleTableBlurCapture}
        >
            <div
                className={`scroll-container w-full overflow-auto rounded-xl border border-[var(--navy-border-soft)] shadow-xl bg-[var(--navy-surface)] relative ${isScrolling ? 'scrolling' : ''} ${forPrint ? 'print-table' : ''}`}
                style={{ height: '100%' }}
                ref={forPrint ? undefined : tableScrollRef}
                onScroll={forPrint ? undefined : handleScroll}
            >
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragCancel={handleDragCancel}
                    onDragEnd={handleDragEnd}
                >
                    <table className="w-full text-m box-border table-fixed border-collapse bg-[var(--navy-surface)] rounded-lg text-[var(--navy-text)]">
                        <colgroup>
                            <col width="40" />
                            <col width="36" />
                            <col width="180" />
                            <col width="180" />
                            <col width="260" />
                            <col width="130" />
                            <col width="70" />
                            <col width="90" />
                            <col width="90" />
                            <col width="72" />
                            <col width="90" />
                            <col width="72" />
                            <col width="86" />
                            <col width="86" />
                            <col width="90" />
                            <col width="80" />
                            <col width="150" />
                            <col width="280" />
                            <col width="64" />

                        </colgroup>
                        <thead ref={tableHeaderRef} className="bg-[var(--navy-surface-3)] text-[var(--navy-text)]">
                            <tr className="bg-[var(--navy-surface)] text-[var(--navy-text-muted)] font-medium sticky top-0 z-[2] shadow-sm border-b border-[var(--navy-border-soft)]">
                                <th className="sticky top-0 left-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-1 z-30">
                                    <input
                                        ref={selectAllRef}
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={(e) => toggleSelectAllItems(e.target.checked)}
                                        className="h-3.5 w-3.5 accent-[var(--navy-accent)] cursor-pointer"
                                        aria-label="전체 선택"
                                    />
                                </th>
                                <th className="sticky top-0 left-[40px] bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-1 z-30"></th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">중공종</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">공정</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">세부공종</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">수량산출(개산)</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">단위</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">내역수량</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">단위 작업량</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">투입조</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">생산량/일</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">CP 체크</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">병행률(%)</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">반영률(%)</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">작업기간 W/D</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">가동률</th>
                                <th className="sticky top-0 bg-[var(--navy-surface-3)] border-r border-[var(--navy-border-soft)] px-2 py-2 text-[var(--navy-text)] font-bold z-10">Cal Day</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">비고</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10"></th>
                            </tr>
                        </thead>
                        <SortableContext items={visibleItemIds} strategy={verticalListSortingStrategy}>
                            <tbody className="divide-y divide-gray-700">
                                {(() => {
                                    const groupedItems = groupedVisibleItems;

                                    return [
                                        (
                                            <ScheduleMasterTableToolbarRow
                                                key="add-main-category"
                                                forPrint={forPrint}
                                                tableHeaderHeight={tableHeaderHeight}
                                                newMainCategory={newMainCategory}
                                                onNewMainCategoryChange={setNewMainCategory}
                                                onAddMainCategory={handleAddMainCategory}
                                                searchKeyword={searchKeyword}
                                                onSearchKeywordChange={setSearchKeyword}
                                                onClearSearch={() => setSearchKeyword("")}
                                                categoryFilter={categoryFilter}
                                                onCategoryFilterChange={setCategoryFilter}
                                                categoryOptions={categoryOptions}
                                                isFilterActive={isFilterActive}
                                                hasSearchKeyword={hasSearchKeyword}
                                                visibleItemCount={visibleItems.length}
                                                totalItemCount={items.length}
                                                selectedCount={selectedCount}
                                                onDeleteSelectedItems={handleDeleteSelectedItems}
                                            />
                                        ),
                                        ...Object.entries(groupedItems).map(([category, categoryItems], categoryIndex, categoryEntries) => (
                                            <ScheduleCategorySection
                                                key={category}
                                                forPrint={forPrint}
                                                category={category}
                                                categoryItems={categoryItems}
                                                allCategoryItems={categoryItemsMap.get(category) || categoryItems}
                                                categoryIndex={categoryIndex}
                                                categoryEntriesLength={categoryEntries.length}
                                                categoryRenameTarget={categoryRenameTarget}
                                                categoryRenameValue={categoryRenameValue}
                                                setCategoryRenameValue={setCategoryRenameValue}
                                                handleCommitCategoryRename={handleCommitCategoryRename}
                                                handleCancelCategoryRename={handleCancelCategoryRename}
                                                handleStartCategoryRename={handleStartCategoryRename}
                                                isFilterActive={isFilterActive}
                                                hasSearchKeyword={hasSearchKeyword}
                                                operatingRates={operatingRates}
                                                handleCategoryRunRateChange={handleCategoryRunRateChange}
                                                openCategoryMenu={openCategoryMenu}
                                                setOpenCategoryMenu={setOpenCategoryMenu}
                                                categoryMenuRef={categoryMenuRef}
                                                categoryMenuPosition={categoryMenuPosition}
                                                categoryMenuDropdownRef={categoryMenuDropdownRef}
                                                handleMoveCategory={handleMoveCategory}
                                                activeEditingItem={activeEditingItem}
                                                fallbackItem={items[0]}
                                                handleAddItem={handleAddItem}
                                                handleOpenImport={handleOpenImport}
                                                handleOpenEvidence={(targetItem) => {
                                                    setEvidenceTargetParent(targetItem || null);
                                                    setEvidenceModalOpen(true);
                                                }}
                                                handleOpenFloorBatchModal={handleOpenFloorBatchModal}
                                                handleDeleteCategory={handleDeleteCategory}
                                                selectedItemIds={selectedItemIds}
                                                toggleSelectItem={toggleSelectItem}
                                                startSelectionDrag={startSelectionDrag}
                                                dragSelectItem={dragSelectItem}
                                                workDayType={workDayType}
                                                handleChange={handleChange}
                                                handleGroupFieldChange={handleGroupFieldChange}
                                                handleDeleteItem={handleDeleteItem}
                                                handleOpenRowClassEdit={handleOpenRowClassEdit}
                                                handleActivateItem={handleActivateItem}
                                                spanInfoMap={spanInfoMap}
                                                standardItems={standardItems}
                                                handleApplyStandardToRow={handleApplyStandardToRow}
                                                activeId={activeId}
                                                dragMovingItemSet={dragMovingItemSet}
                                                dropTargetId={dropTargetId}
                                                dropPosition={dropPosition}
                                                isDropInvalid={isDropInvalid}
                                                activeEditingItemId={activeEditingItemId}
                                            />
                                        )),
                                        ...(Object.keys(groupedItems).length === 0
                                            ? [(
                                                <tr key="empty-filter-result">
                                                    <td colSpan="19" className="px-4 py-8 text-center text-sm text-[var(--navy-text-muted)]">
                                                        검색/필터 조건에 맞는 항목이 없습니다.
                                                    </td>
                                                </tr>
                                            )]
                                            : [])
                                    ];
                                })()}
                            </tbody>
                        </SortableContext>

                    </table>
                </DndContext>
            </div>
            {!forPrint && hasHorizontalOverflow && canScrollLeft && (
                <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center">
                    <div className="h-full w-12 bg-gradient-to-r from-[var(--navy-bg)] to-transparent" />
                    <div className="absolute left-2 rounded-full border border-[var(--navy-border)] bg-[rgb(30_30_47/0.9)] p-1 text-[var(--navy-text)]">
                        <ChevronLeft size={14} />
                    </div>
                </div>
            )}
            {!forPrint && hasHorizontalOverflow && canScrollRight && (
                <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center justify-end">
                    <div className="h-full w-12 bg-gradient-to-l from-[var(--navy-bg)] to-transparent" />
                    <div className="absolute right-2 rounded-full border border-[var(--navy-border)] bg-[rgb(30_30_47/0.9)] p-1 text-[var(--navy-text)]">
                        <ChevronRight size={14} />
                    </div>
                </div>
            )}
            {!forPrint && showHorizontalHint && hasHorizontalOverflow && (
                <div className="ui-hint absolute right-3 top-3 z-30 flex items-center gap-2">
                    <span>좌우 이동: Shift + 휠 또는 하단 스크롤바 사용, 좌측 2열은 고정됩니다.</span>
                    <button
                        type="button"
                        className="rounded p-0.5 text-[var(--navy-text)] hover:bg-[rgb(75_85_99/0.25)]"
                        onClick={dismissHorizontalHint}
                        aria-label="가로 스크롤 힌트 닫기"
                    >
                        <X size={12} />
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <div className="h-screen w-full flex flex-col bg-[var(--navy-bg)] overflow-hidden text-[var(--navy-text)]">
            {/* Header Section (Fixed) */}
            <div className="flex-none w-full max-w-[2400px] mx-auto p-6 pb-2">
                <ScheduleHeader
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={runUndo}
                    onRedo={runRedo}
                    onSnapshotOpen={() => setSnapshotModalOpen(true)}
                    startDate={startDate}
                    onStartDateChange={handleStartDateChange}
                    workDayType={workDayType}
                    onWorkDayTypeChange={setStoreWorkDayType}
                    onSave={handleSaveAll}
                    saving={saving}
                    totalCalendarDays={totalCalendarDays}
                    totalCalendarMonths={totalCalendarMonths}
                    aiTargetDays={aiTargetDays}
                    onAiTargetDaysChange={setAiTargetDays}
                    onAiRun={runAiAdjustment}
                    aiMode={aiMode}
                    onAiCancel={handleAiCancel}
                    onExportExcel={handleExportExcel}
                />
            </div>

            {/* Content Section (Fills remaining height) */}
            <div
                className="flex-1 min-h-0 w-full max-w-[2400px] mx-auto p-6 pt-2 overflow-hidden flex flex-col"
            >
                {viewMode === "gantt" ? (
                    <ScheduleGanttPanel
                        items={aiDisplayItems}
                        links={links}
                        startDate={startDate}
                        onResize={handleGanttResize}
                        onSmartResize={handleSmartResize}
                        aiPreviewItems={aiPreviewItems}
                        aiOriginalItems={aiOriginalRef.current}
                        aiActiveItemId={aiActiveItemId}
                        aiMode={aiMode}
                        aiLogs={aiLogs}
                        aiSummary={aiSummary}
                        aiShowCompare={aiShowCompare}
                        onToggleCompare={() => setAiShowCompare((prev) => !prev)}
                        onApply={() => handleAiApply(confirm)}
                        subTasks={subTasks}
                        onCreateSubtask={handleCreateSubtask}
                        onUpdateSubtask={handleUpdateSubtask}
                        onDeleteSubtask={handleDeleteSubtask}
                    />
                ) : (
                    renderTableView()
                )}
            </div>

            {/* --- Modals --- */}
            {importModalOpen && (
                <StandardImportModal
                    isOpen={importModalOpen}
                    onClose={() => setImportModalOpen(false)}
                    onSelect={handleImportSelect}
                    project_id={projectId}
                />
            )}

            {evidenceModalOpen && (
                <EvidenceResultModal
                    isOpen={evidenceModalOpen}
                    onClose={() => {
                        setEvidenceModalOpen(false);
                        setEvidenceTargetParent(null);
                    }}
                    onAdd={handleAddEvidenceItem}
                    targetItem={evidenceTargetParent}
                    cipResults={cipResult.map((row) => ({
                        ...row,
                        key: `cip-${row.id}`,
                        label: row.diameter_selection ? `D${row.diameter_selection}` : "CIP"
                    }))}
                    pileResults={pileResult.map((row) => ({
                        ...row,
                        key: `pile-${row.id}`,
                        label: row.diameter_selection ? `D${row.diameter_selection}` : "Pile"
                    }))}
                    boredResults={boredResult.map((row) => ({
                        ...row,
                        key: `bored-${row.id}`,
                        label: row.diameter_selection ? `D${row.diameter_selection}` : "Bored"
                    }))}
                    cipStandards={cipStandards}
                    pileStandards={pileStandards}
                    boredStandards={boredStandards}
                />
            )}

            {snapshotModalOpen && (
                <SnapshotManager
                    projectId={projectId}
                    currentItems={items}
                    isOpen={snapshotModalOpen}
                    onClose={() => setSnapshotModalOpen(false)}
                    onLoadSnapshot={(snapItems) => {
                        setStoreItems(snapItems);
                        toast.success("스냅샷 로드 완료");
                        setSnapshotModalOpen(false);
                    }}
                />
            )}

            {rowClassEditModal.open && (
                <div className="fixed inset-0 z-[510] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-[420px] rounded-xl border border-[var(--navy-border-soft)] bg-[var(--navy-surface)] p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-[var(--navy-text)]">개별 중공종/공정 수정</h3>
                        <p className="mt-1 text-xs text-[var(--navy-text-muted)]">
                            병합 그룹과 별개로 현재 행만 수정합니다.
                        </p>

                        <div className="mt-4 space-y-3">
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-[var(--navy-text-muted)]">중공종</span>
                                <input
                                    type="text"
                                    value={rowClassEditModal.process}
                                    onChange={(e) => setRowClassEditModal((prev) => ({ ...prev, process: e.target.value }))}
                                    className="ui-input px-3 py-2"
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-[var(--navy-text-muted)]">공정</span>
                                <input
                                    type="text"
                                    value={rowClassEditModal.sub_process}
                                    onChange={(e) => setRowClassEditModal((prev) => ({ ...prev, sub_process: e.target.value }))}
                                    className="ui-input px-3 py-2"
                                />
                            </label>
                        </div>

                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={handleCloseRowClassEdit}
                                className="rounded-lg border border-[var(--navy-border)] px-3 py-2 text-sm text-[var(--navy-text-muted)] hover:bg-[var(--navy-surface-3)]"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveRowClassEdit}
                                className="ui-btn-primary px-3 py-2 text-sm"
                            >
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {floorBatchModal && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-[460px] rounded-xl border border-[var(--navy-border-soft)] bg-[var(--navy-surface)] p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-gray-100">층별 공정 일괄생성</h3>
                        <p className="mt-1 text-sm text-gray-400">
                            대공종: <span className="font-semibold ui-accent-text">{floorBatchModal.category}</span>
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-gray-300">최하층</span>
                                <input
                                    type="number"
                                    value={floorBatchRange.min}
                                    onChange={(e) => setFloorBatchRange((prev) => ({ ...prev, min: e.target.value }))}
                                    placeholder="예: -3"
                                    className="ui-input px-3 py-2"
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-gray-300">최상층</span>
                                <input
                                    type="number"
                                    value={floorBatchRange.max}
                                    onChange={(e) => setFloorBatchRange((prev) => ({ ...prev, max: e.target.value }))}
                                    placeholder="예: 30"
                                    className="ui-input px-3 py-2"
                                />
                            </label>
                        </div>

                        <p className="mt-3 text-xs text-gray-400">
                            지하는 음수로 입력됩니다. 예: `-3 ~ 30` 입력 시 `지하3층 ~ 지하1층, 지상1층 ~ 지상30층` 생성
                        </p>

                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={handleCloseFloorBatchModal}
                                className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-300 hover:bg-[#3b3b4f]"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleGenerateFloorBatch}
                                className="ui-btn-primary px-3 py-2 text-sm"
                            >
                                공정 생성
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
