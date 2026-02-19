import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { saveScheduleData, initializeDefaultItems, fetchScheduleItems, exportScheduleExcel } from "../api/cpe_all/construction_schedule";
import { updateWorkCondition } from "../api/cpe/calc";
import toast from "react-hot-toast";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import StandardImportModal from "../components/cpe/StandardImportModal";
import TableToolbarRow from "../components/cpe/schedule/TableToolbarRow";
import ScheduleHeader from "../components/cpe/schedule/ScheduleHeader";
import ScheduleGanttPanel from "../components/cpe/schedule/ScheduleGanttPanel";
import EvidenceResultModal from "../components/cpe/schedule/EvidenceResultModal";
import ScheduleTableRow from "../components/cpe/schedule/ScheduleTableRow";
import SnapshotManager from "../components/cpe/schedule/SnapshotManager";

import { useScheduleStore } from "../stores/scheduleStore";
import { useConfirm } from "../contexts/ConfirmContext";
import { useAIScheduleOptimizer } from "../hooks/useAIScheduleOptimizer";
import { useScheduleData } from "../hooks/useScheduleData";
import { useDragHandlers } from "../hooks/useDragHandlers";
import { useTutorial } from "../hooks/useTutorial";
import { calculateTotalCalendarDays, calculateTotalCalendarMonths } from "../utils/scheduleCalculations";
import { calculateGanttItems } from "../components/cpe/ganttUtils";
import { fetchProductivities } from "../api/cpe_all/productivity";
import { scheduleMasterListSteps } from "../config/tutorialSteps";

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
    const addItem = useScheduleStore((state) => state.addItem);
    const addItemAtIndex = useScheduleStore((state) => state.addItemAtIndex);
    const deleteItems = useScheduleStore((state) => state.deleteItems);
    const reorderItems = useScheduleStore((state) => state.reorderItems);
    const addSubTask = useScheduleStore((state) => state.addSubTask);
    const updateSubTask = useScheduleStore((state) => state.updateSubTask);
    const deleteSubTask = useScheduleStore((state) => state.deleteSubTask);

    // Temporal (Undo/Redo) - Safe Access
    const temporalStore = useScheduleStore.temporal;
    const { undo, redo, pastStates, futureStates } = temporalStore
        ? temporalStore.getState()
        : { undo: () => { }, redo: () => { }, pastStates: [], futureStates: [] };

    const canUndo = pastStates.length > 0;
    const canRedo = futureStates.length > 0;

    // Keyboard Shortcuts
    useEffect(() => {
        if (!temporalStore) return;

        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                if (e.shiftKey) {
                    if (canRedo) redo();
                } else {
                    if (canUndo) undo();
                }
                e.preventDefault();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                if (canRedo) redo();
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, canUndo, canRedo, temporalStore]);

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

    // Tutorial Hook - driver.js handles everything automatically
    useTutorial('scheduleMasterList', scheduleMasterListSteps);

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
    const [isSelectionDragging, setIsSelectionDragging] = useState(false);
    const [floorBatchModal, setFloorBatchModal] = useState(null);
    const [floorBatchRange, setFloorBatchRange] = useState({ min: "", max: "" });
    const selectAllRef = useRef(null);
    const tableHeaderRef = useRef(null);
    const tableScrollRef = useRef(null);
    const [tableHeaderHeight, setTableHeaderHeight] = useState(44);
    const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [showHorizontalHint, setShowHorizontalHint] = useState(false);
    const selectionDragModeRef = useRef(null);
    const selectionDragVisitedRef = useRef(new Set());

    const allItemIds = useMemo(() => items.map((item) => item.id), [items]);
    const selectedCount = selectedItemIds.length;
    const allSelected = allItemIds.length > 0 && selectedCount === allItemIds.length;
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

    const toggleSelectAllItems = useCallback((checked) => {
        setSelectedItemIds(checked ? allItemIds : []);
    }, [allItemIds]);

    const clearSelection = useCallback(() => {
        setSelectedItemIds([]);
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
            operating_rate_value: parent.operating_rate_value || 0
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

    const handleAddItem = (parentItem = null) => {
        const newItem = {
            id: `new-${Date.now()}`,
            main_category: parentItem ? parentItem.main_category : "새 공종",
            process: parentItem ? parentItem.process : "새 작업",
            sub_process: parentItem ? (parentItem.sub_process || "") : "새 세부공정",
            work_type: "새 세부작업",
            unit: "",
            quantity: 0,
            quantity_formula: "",
            productivity: 0,
            crew_size: 1,
            remarks: "",
            operating_rate_type: parentItem ? parentItem.operating_rate_type : "EARTH",
            operating_rate_value: 0
        };

        if (parentItem) {
            const index = items.findIndex(i => i.id === parentItem.id);
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
            label: "부공종",
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
            operating_rate_value: 0
        };
        addItem(newItem);
        setNewMainCategory("");
        toast.success("대공종이 추가되었습니다.");
    };

    const handleCategoryRunRateChange = async (category, newRunRate) => {
        try {
            // Update store first (optimistic update)
            updateOperatingRate(category, parseInt(newRunRate));

            // Save to backend
            const rateToUpdate = operatingRates.find(r => r.main_category === category);
            if (rateToUpdate) {
                const { updateOperatingRate: updateOperatingRateAPI } = await import("../api/cpe/operating_rate");
                await updateOperatingRateAPI(projectId, {
                    weights: [{
                        id: rateToUpdate.id,
                        main_category: category,
                        work_week_days: parseInt(newRunRate)
                    }]
                });
                toast.success(`${category} Run Rate 업데이트 완료`);
            }
        } catch (error) {
            console.error("Run Rate 업데이트 실패:", error);
            toast.error("Run Rate 업데이트 실패");
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
            const workTypeName = std.item_name || std.work_type_name || std.sub_category || std.category || "수입 공종";
            const remarkLabel = std.item_name || std.sub_category || std.category || "";
            const newItem = {
                id: `imp-${Date.now()}-${Math.random()}`,
                main_category: importTargetParent?.main_category || "수입 공종",
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
                // Use the remark from selection: "항목명 (선택 기준)"
                remarks: std.remark ? `${remarkLabel} (${std.remark})` : remarkLabel
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
        const workTypeName = std.item_name || std.work_type_name || std.sub_category || std.category || item.work_type || '';
        const remarkLabel = std.item_name || std.sub_category || std.category || '';
        updateItem(item.id, 'process', processName);
        updateItem(item.id, 'sub_process', subProcessName);
        updateItem(item.id, 'work_type', workTypeName);
        updateItem(item.id, 'unit', std.unit || item.unit || '');
        updateItem(item.id, 'productivity', productivity || 0);
        updateItem(item.id, 'standard_code', std.code || std.standard || item.standard_code || '');
        updateItem(item.id, 'remarks', remarkLabel ? `${remarkLabel} (${remark})` : (item.remarks || remark));
    }, [deriveStandardProductivity, updateItem]);

    const spanInfoMap = useMemo(() => {
        const map = {};
        const groupedItems = items.reduce((acc, item) => {
            const category = item.main_category || '기타';
            if (!acc[category]) acc[category] = [];
            acc[category].push(item);
            return acc;
        }, {});

        Object.values(groupedItems).forEach((categoryItems) => {
            // Merge same `process` values in "구분" column.
            let i = 0;
            while (i < categoryItems.length) {
                const processValue = String(categoryItems[i]?.process || "");
                let j = i + 1;
                while (j < categoryItems.length && String(categoryItems[j]?.process || "") === processValue) {
                    j += 1;
                }
                const span = j - i;
                for (let k = i; k < j; k += 1) {
                    const row = categoryItems[k];
                    if (!map[row.id]) map[row.id] = {};
                    map[row.id].isProcessFirst = k === i;
                    map[row.id].processRowSpan = span;
                }
                i = j;
            }

            // Merge same `sub_process` values in "공정" column.
            i = 0;
            while (i < categoryItems.length) {
                const processValue = String(categoryItems[i]?.process || "");
                const subProcessValue = String(categoryItems[i]?.sub_process || "");
                let j = i + 1;
                while (
                    j < categoryItems.length &&
                    String(categoryItems[j]?.process || "") === processValue &&
                    String(categoryItems[j]?.sub_process || "") === subProcessValue
                ) {
                    j += 1;
                }
                const span = j - i;
                for (let k = i; k < j; k += 1) {
                    const row = categoryItems[k];
                    if (!map[row.id]) map[row.id] = {};
                    map[row.id].isSubProcessFirst = k === i;
                    map[row.id].subProcessRowSpan = span;
                }
                i = j;
            }
        });

        return map;
    }, [items]);

    const handleDeleteItem = async (id) => {
        const ok = await confirm("삭제하시겠습니까?");
        if (!ok) return;
        deleteItems([id]);
        setSelectedItemIds((prev) => prev.filter((itemId) => itemId !== id));
    };

    const handleDeleteSelectedItems = useCallback(async () => {
        if (selectedItemIds.length === 0) return;
        const ok = await confirm(`선택된 ${selectedItemIds.length}개 항목을 삭제하시겠습니까?`);
        if (!ok) return;
        deleteItems(selectedItemIds);
        clearSelection();
        toast.success(`${selectedItemIds.length}개 항목이 삭제되었습니다.`);
    }, [clearSelection, confirm, deleteItems, selectedItemIds]);

    const handleDeleteCategory = async (category, categoryItems) => {
        const ok = await confirm(`${category} 대공종을 삭제하시겠습니까? (항목 ${categoryItems.length}개)`);
        if (!ok) return;
        const remainingItems = items.filter((item) => item.main_category !== category);
        const remainingIds = new Set(remainingItems.map((item) => item.id));
        const remainingLinks = links.filter(
            (link) => remainingIds.has(link.from) && remainingIds.has(link.to)
        );
        const remainingSubTasks = subTasks.filter((subtask) => remainingIds.has(subtask.itemId));
        deleteItems(categoryItems.map((item) => item.id));
        setSelectedItemIds((prev) => {
            const removedIdSet = new Set(categoryItems.map((item) => item.id));
            return prev.filter((id) => !removedIdSet.has(id));
        });
        if (containerId) {
            try {
                await saveScheduleData(containerId, { items: remainingItems, links: remainingLinks, sub_tasks: remainingSubTasks });
            } catch (error) {
                console.error("Failed to save after category delete:", error);
                toast.error("대공종 삭제 저장 실패");
            }
        }
        toast.success("대공종이 삭제되었습니다.");
    };

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
            toast.error("복제할 기준 공종 묶음을 찾을 수 없습니다.");
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
                    application_rate: sourceRow.application_rate ?? 100,
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
            toast.success(`${createdFloorCount}개 층 / ${createdRowCount}개 공종 생성, ${skippedRowCount}개 중복 건너뜀`);
        } else {
            toast.success(`${createdFloorCount}개 층 / ${createdRowCount}개 공종 생성`);
        }
        handleCloseFloorBatchModal();
    }, [addItemAtIndex, floorBatchModal, floorBatchRange.max, floorBatchRange.min, handleCloseFloorBatchModal, items]);

    useEffect(() => {
        const handleTableHotkeys = (e) => {
            if (viewMode !== "table") return;
            const target = e.target;
            if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                setSelectedItemIds(allItemIds);
                return;
            }

            if (selectedItemIds.length === 0) return;
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                handleDeleteSelectedItems();
            }
        };

        window.addEventListener('keydown', handleTableHotkeys);
        return () => window.removeEventListener('keydown', handleTableHotkeys);
    }, [allItemIds, handleDeleteSelectedItems, selectedItemIds.length, viewMode]);

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

            if (scheduleResult.status === "fulfilled" || runRateResult.status === "fulfilled") {
                toast.success("저장 완료");
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

    if (loading) return <div className="p-8 flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
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
        <div className="relative h-full w-full">
            <div
                data-tutorial="schedule-table"
                className={`scroll-container w-full overflow-auto rounded-xl border border-gray-700 shadow-xl bg-[#2c2c3a] relative ${isScrolling ? 'scrolling' : ''} ${forPrint ? 'print-table' : ''}`}
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
                    <table className="w-full text-m box-border table-fixed border-collapse bg-[#2c2c3a] rounded-lg text-gray-200">
                    <colgroup>
                        <col width="34" />
                        <col width="30" />
                        <col width="140" />
                        <col width="180" />
                        <col width="280" />
                        <col width="140" />
                        <col width="60" />
                        <col width="90" />
                        <col width="100" />
                        <col width="70" />
                        <col width="100" />
                        <col width="80" />
                        <col width="100" />
                        <col width="90" />
                        <col width="200" />
                        <col width="500" />
                        <col width="180" />
                        <col width="60" />

                    </colgroup>
                    <thead ref={tableHeaderRef} className="bg-[#3a3a4a] text-gray-200">
                        <tr className="bg-[#2c2c3a] text-gray-300 font-medium sticky top-0 z-[2] shadow-sm border-b border-gray-700">
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-1 z-10">
                                <input
                                    ref={selectAllRef}
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={(e) => toggleSelectAllItems(e.target.checked)}
                                    className="h-3.5 w-3.5 accent-blue-500 cursor-pointer"
                                    aria-label="전체 선택"
                                />
                            </th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-1 z-10"></th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">구분</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">공정</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">공종</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">수량산출(개산)</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">단위</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">내역수량</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">단위 작업량</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">투입조</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">생산량/일</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">반영률(%)</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">작업기간 W/D</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">가동률</th>
                            <th className="sticky top-0 bg-blue-900/40 border-r border-gray-700 px-2 py-2 text-blue-200 font-bold z-10" data-tutorial="calendar-day">Cal Day</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">비고</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">병행여부</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10"></th>
                        </tr>
                    </thead>
                    <SortableContext items={items} strategy={verticalListSortingStrategy}>
                        <tbody className="divide-y divide-gray-700">
                            {(() => {
                                const groupedItems = items.reduce((acc, item) => {
                                    const category = item.main_category || '기타';
                                    if (!acc[category]) acc[category] = [];
                                    acc[category].push(item);
                                    return acc;
                                }, {});

                                return [
                                    (
                                        <tr key="add-main-category" className={`bg-[#232332] ${forPrint ? "no-print" : ""}`}>
                                            <td
                                                colSpan="18"
                                                className={`px-4 py-3 ${forPrint ? "" : "sticky z-[9] bg-[#232332] border-b border-gray-700"}`}
                                                style={forPrint ? undefined : { top: `${tableHeaderHeight + 12}px` }}
                                            >
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <div className="text-sm font-semibold text-gray-200">대공종 추가</div>
                                                    <input
                                                        type="text"
                                                        value={newMainCategory}
                                                        onChange={(e) => setNewMainCategory(e.target.value)}
                                                        placeholder="대공종명 입력"
                                                        className="min-w-[220px] bg-[#1f1f2b] border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleAddMainCategory}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500"
                                                    >
                                                        추가
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleDeleteSelectedItems}
                                                        disabled={selectedCount === 0}
                                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${selectedCount > 0
                                                            ? "border-red-500/50 text-red-200 hover:bg-red-500/10"
                                                            : "border-gray-700 text-gray-500 cursor-not-allowed"
                                                            }`}
                                                    >
                                                        <Trash2 size={14} />
                                                        선택 삭제 {selectedCount > 0 ? `(${selectedCount})` : ""}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ),
                                    ...Object.entries(groupedItems).map(([category, categoryItems], categoryIndex, categoryEntries) => (
                                        <React.Fragment key={category}>
                                            {(() => {
                                                const categoryCalDays = calculateTotalCalendarDays(categoryItems);
                                                const categoryCalMonths = calculateTotalCalendarMonths(categoryCalDays);
                                                return (
                                            <tr className="bg-gradient-to-r from-[#2c2c3a] to-[#242433] border-t border-gray-700">
                                                <td colSpan="18" className="px-4 py-2.5">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1 h-5 bg-blue-400 rounded-full"></div>
                                                            <h3 className="font-bold text-gray-100 text-base tracking-tight">
                                                                {category}
                                                            </h3>
                                                            <span className="text-xs text-gray-400 bg-[#1f1f2b] px-2 py-0.5 rounded-full border border-gray-700">
                                                                {categoryItems.length}개 항목
                                                            </span>
                                                            <span className="text-xs text-blue-200 bg-blue-900/20 px-2 py-0.5 rounded-full border border-blue-500/40 font-semibold">
                                                                {categoryCalDays}일 ({categoryCalMonths}개월)
                                                            </span>
                                                            {/* Category-specific Run Rate */}
                                                            {(() => {
                                                                const categoryRate = operatingRates.find(r => r.main_category === category);
                                                                const currentRunRate = categoryRate?.work_week_days || 6;
                                                                return (
                                                                    <div className="flex items-center gap-2 ml-4">
                                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Run Rate</label>
                                                                        <select
                                                                            className="bg-[#181825] text-gray-100 font-bold text-sm py-1 px-2 rounded-lg border border-gray-700 focus:border-blue-500"
                                                                            value={currentRunRate}
                                                                            onChange={(e) => handleCategoryRunRateChange(category, e.target.value)}
                                                                            disabled={forPrint}
                                                                        >
                                                                            <option value="5">주5일</option>
                                                                            <option value="6">주6일</option>
                                                                            <option value="7">주7일</option>
                                                                        </select>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                        <div
                                                            className={`flex items-center gap-2 ${forPrint
                                                                ? "no-print"
                                                                : "sticky right-0 z-[1] ml-auto pl-3 pr-1 py-1 border-l border-gray-700 bg-[#242433]/95 backdrop-blur-sm"
                                                                }`}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMoveCategory(category, "up")}
                                                                disabled={categoryIndex === 0}
                                                                className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition ${categoryIndex === 0
                                                                    ? "border-gray-700 text-gray-500 cursor-not-allowed"
                                                                    : "border-gray-600 text-gray-200 hover:bg-[#3a3a4a]"
                                                                    }`}
                                                                title="대공종 위로 이동"
                                                            >
                                                                <ArrowUp size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMoveCategory(category, "down")}
                                                                disabled={categoryIndex === categoryEntries.length - 1}
                                                                className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition ${categoryIndex === categoryEntries.length - 1
                                                                    ? "border-gray-700 text-gray-500 cursor-not-allowed"
                                                                    : "border-gray-600 text-gray-200 hover:bg-[#3a3a4a]"
                                                                    }`}
                                                                title="대공종 아래로 이동"
                                                            >
                                                                <ArrowDown size={14} />
                                                            </button>
                                                            {String(category).includes("골조") && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenFloorBatchModal(category, categoryItems)}
                                                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-500/40 text-blue-200 hover:bg-blue-500/10"
                                                                >
                                                                    층별 공정 생성
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteCategory(category, categoryItems)}
                                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/40 text-red-200 hover:bg-red-500/10"
                                                            >
                                                                대공종 삭제
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                                );
                                            })()}
                                            <TableToolbarRow
                                                colSpan={18}
                                                className={forPrint ? "no-print" : ""}
                                                onImport={() => {
                                                    const lastCategoryItem = categoryItems[categoryItems.length - 1] || items[0];
                                                    if (lastCategoryItem) {
                                                        handleOpenImport({
                                                            ...lastCategoryItem,
                                                            main_category: category
                                                        });
                                                    }
                                                }}
                                                onAdd={() => {
                                                    const lastCategoryItem = categoryItems[categoryItems.length - 1] || items[0];
                                                    if (lastCategoryItem) {
                                                        handleAddItem({
                                                            ...lastCategoryItem,
                                                            main_category: category,
                                                            process: category === lastCategoryItem.main_category ? lastCategoryItem.process : '',
                                                            sub_process: category === lastCategoryItem.main_category ? (lastCategoryItem.sub_process || '') : ''
                                                        });
                                                    }
                                                }}
                                                onEvidence={() => {
                                                    const lastCategoryItem = categoryItems[categoryItems.length - 1] || items[0];
                                                    setEvidenceTargetParent(lastCategoryItem || null);
                                                    setEvidenceModalOpen(true);
                                                }}
                                            />
                                            {categoryItems.map((item, rowIndex) => (
                                                <ScheduleTableRow
                                                    key={item.id}
                                                    item={item}
                                                    isSelected={selectedItemIds.includes(item.id)}
                                                    onToggleSelect={toggleSelectItem}
                                                    onStartSelectionDrag={startSelectionDrag}
                                                    onDragSelectionEnter={dragSelectItem}
                                                    rowClassName={rowIndex % 2 === 0 ? "bg-[#232332]" : "bg-[#2c2c3a]"}
                                                    operatingRates={operatingRates}
                                                    workDayType={workDayType}
                                                    isLinked={item.link_module_type && item.link_module_type !== 'NONE'}
                                                    handleChange={handleChange}
                                                    handleDeleteItem={handleDeleteItem}
                                                    handleAddItem={handleAddItem}
                                                    handleOpenImport={handleOpenImport}
                                                    spanInfo={spanInfoMap[item.id] || { isProcessFirst: true, isSubProcessFirst: true, processRowSpan: 1, subProcessRowSpan: 1 }}
                                                    standardItems={standardItems}
                                                    onApplyStandard={handleApplyStandardToRow}
                                                    isDragActive={Boolean(activeId)}
                                                    isPartOfDraggingGroup={Boolean(activeId) && dragMovingItemSet.has(item.id)}
                                                    isDropTarget={dropTargetId === item.id}
                                                    dropPosition={dropTargetId === item.id ? dropPosition : null}
                                                    isDropInvalid={isDropInvalid && dropTargetId === item.id}
                                                />
                                            ))}
                                        </React.Fragment>
                                    ))
                                ];
                            })()}
                        </tbody>
                    </SortableContext>

                    </table>
                </DndContext>
            </div>
            {!forPrint && hasHorizontalOverflow && canScrollLeft && (
                <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center">
                    <div className="h-full w-12 bg-gradient-to-r from-[#1f1f2b] to-transparent" />
                    <div className="absolute left-2 rounded-full border border-gray-600 bg-[#1f1f2b]/90 p-1 text-gray-200">
                        <ChevronLeft size={14} />
                    </div>
                </div>
            )}
            {!forPrint && hasHorizontalOverflow && canScrollRight && (
                <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center justify-end">
                    <div className="h-full w-12 bg-gradient-to-l from-[#1f1f2b] to-transparent" />
                    <div className="absolute right-2 rounded-full border border-gray-600 bg-[#1f1f2b]/90 p-1 text-gray-200">
                        <ChevronRight size={14} />
                    </div>
                </div>
            )}
            {!forPrint && showHorizontalHint && hasHorizontalOverflow && (
                <div className="absolute right-3 top-3 z-30 flex items-center gap-2 rounded-lg border border-blue-500/40 bg-[#1b2338]/95 px-3 py-2 text-xs text-blue-100 shadow-lg">
                    <span>좌우 이동: Shift + 휠 또는 하단 스크롤바 사용</span>
                    <button
                        type="button"
                        className="rounded p-0.5 text-blue-200 hover:bg-blue-500/20"
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
        <div className="h-screen w-full flex flex-col bg-[#1f1f2b] overflow-hidden text-gray-200">
            {/* Header Section (Fixed) */}
            <div className="flex-none w-full max-w-[2400px] mx-auto p-6 pb-2">
                <ScheduleHeader
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={undo}
                    onRedo={redo}
                    onSnapshotOpen={() => setSnapshotModalOpen(true)}
                    startDate={startDate}
                    onStartDateChange={(val) => {
                        setStartDate(val);
                        import("../api/cpe/project").then(({ updateProject }) =>
                            updateProject(projectId, { start_date: val })
                        );
                    }}
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
                style={{ zoom: viewMode === "table" ? 0.85 : 1 }}
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

            {floorBatchModal && (
                <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-[460px] rounded-xl border border-gray-700 bg-[#2c2c3a] p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-gray-100">층별 공정 일괄생성</h3>
                        <p className="mt-1 text-sm text-gray-400">
                            대공종: <span className="font-semibold text-blue-200">{floorBatchModal.category}</span>
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-gray-300">최하층</span>
                                <input
                                    type="number"
                                    value={floorBatchRange.min}
                                    onChange={(e) => setFloorBatchRange((prev) => ({ ...prev, min: e.target.value }))}
                                    placeholder="예: -3"
                                    className="rounded-lg border border-gray-600 bg-[#1f1f2b] px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-gray-300">최상층</span>
                                <input
                                    type="number"
                                    value={floorBatchRange.max}
                                    onChange={(e) => setFloorBatchRange((prev) => ({ ...prev, max: e.target.value }))}
                                    placeholder="예: 30"
                                    className="rounded-lg border border-gray-600 bg-[#1f1f2b] px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
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
                                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
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
