import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { saveScheduleData, initializeDefaultItems, fetchScheduleItems, exportScheduleExcel } from "../api/cpe_all/construction_schedule";
import { updateWorkCondition } from "../api/cpe/calc";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
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
import { fetchProductivities } from "../api/cpe_all/productivity";
import { scheduleMasterListSteps } from "../config/tutorialSteps";

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
    const deleteItem = useScheduleStore((state) => state.deleteItem);
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

    const { activeId, handleDragStart, handleDragEnd } = useDragHandlers(items, reorderItems);

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

    // Scroll handler for custom scrollbar
    const handleScroll = useCallback((e) => {
        setIsScrolling(true);
        clearTimeout(window.scrollTimeout);
        window.scrollTimeout = setTimeout(() => {
            setIsScrolling(false);
        }, 1000);
    }, []);

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
    }, [projectId, projectName, ganttDateScale]);

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
            const newItem = {
                id: `imp-${Date.now()}-${Math.random()}`,
                main_category: importTargetParent?.main_category || "수입 공종",
                process: std.process_name || importTargetParent?.process || "수입 작업",
                work_type: std.category || std.item_name,
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
                remarks: std.remark ? `${std.item_name} (${std.remark})` : std.item_name || ""
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
        updateItem(item.id, 'process', std.process_name || std.category || std.item_name || item.process || '');
        updateItem(item.id, 'work_type', std.category || std.item_name || item.work_type || '');
        updateItem(item.id, 'unit', std.unit || item.unit || '');
        updateItem(item.id, 'productivity', productivity || 0);
        updateItem(item.id, 'standard_code', std.code || std.standard || item.standard_code || '');
        updateItem(item.id, 'remarks', std.item_name ? `${std.item_name} (${remark})` : (item.remarks || remark));
    }, [deriveStandardProductivity, updateItem]);

    const spanInfoMap = useMemo(() => {
        const map = {};
        return map;
    }, [items]);

    const handleDeleteItem = async (id) => {
        const ok = await confirm("삭제하시겠습니까?");
        if (!ok) return;
        deleteItem(id);
    };

    const handleDeleteCategory = async (category, categoryItems) => {
        const ok = await confirm(`${category} 대공종을 삭제하시겠습니까? (항목 ${categoryItems.length}개)`);
        if (!ok) return;
        const remainingItems = items.filter((item) => item.main_category !== category);
        const remainingIds = new Set(remainingItems.map((item) => item.id));
        const remainingLinks = links.filter(
            (link) => remainingIds.has(link.from) && remainingIds.has(link.to)
        );
        const remainingSubTasks = subTasks.filter((subtask) => remainingIds.has(subtask.itemId));
        categoryItems.forEach((item) => deleteItem(item.id));
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

    const activeItem = activeId ? items.find(i => i.id === activeId) : null;
    const renderTableView = ({ forPrint = false } = {}) => (
        <div
            data-tutorial="schedule-table"
            className={`scroll-container w-full overflow-auto rounded-xl border border-gray-700 shadow-xl bg-[#2c2c3a] relative ${isScrolling ? 'scrolling' : ''} ${forPrint ? 'print-table' : ''}`}
            style={{ maxHeight: 'calc(100vh - 50px)' }}
            onScroll={forPrint ? undefined : handleScroll}
        >
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <table className="w-full text-m box-border table-fixed border-collapse bg-[#2c2c3a] rounded-lg text-gray-200">
                    <colgroup>
                        <col width="30" />
                        <col width="140" />
                        <col width="300" />
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
                        <col width="600" />
                        <col width="60" />

                    </colgroup>
                    <thead className="bg-[#3a3a4a] text-gray-200">
                        <tr className="bg-[#2c2c3a] text-gray-300 font-medium sticky top-0 z-[2] shadow-sm border-b border-gray-700">
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-1 z-10"></th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">구분</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">공종</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">수량산출(개산)</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">단위</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">내역수량</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">단위 작업량</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">투입조</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">생산량/일</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">반영율</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">작업기간 W/D</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">가동률</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">비고</th>
                            <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">병행여부</th>
                            <th className="sticky top-0 bg-blue-900/40 border-r border-gray-700 px-2 py-2 text-blue-200 font-bold z-10" data-tutorial="calendar-day">Calender Day</th>
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
                                            <td colSpan="17" className="px-4 py-3">
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
                                                </div>
                                            </td>
                                        </tr>
                                    ),
                                    ...Object.entries(groupedItems).map(([category, categoryItems]) => (
                                        <React.Fragment key={category}>
                                            <tr className="bg-gradient-to-r from-[#2c2c3a] to-[#242433] border-t border-gray-700">
                                                <td colSpan="17" className="px-4 py-2.5">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1 h-5 bg-blue-400 rounded-full"></div>
                                                            <h3 className="font-bold text-gray-100 text-base tracking-tight">
                                                                {category}
                                                            </h3>
                                                            <span className="text-xs text-gray-400 bg-[#1f1f2b] px-2 py-0.5 rounded-full border border-gray-700">
                                                                {categoryItems.length}개 항목
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
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteCategory(category, categoryItems)}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/40 text-red-200 hover:bg-red-500/10 ${forPrint ? "no-print" : ""}`}
                                                        >
                                                            대공종 삭제
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            <TableToolbarRow
                                                colSpan={17}
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
                                                            process: category === lastCategoryItem.main_category ? lastCategoryItem.process : ''
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
                                                    rowClassName={rowIndex % 2 === 0 ? "bg-[#232332]" : "bg-[#2c2c3a]"}
                                                    operatingRates={operatingRates}
                                                    workDayType={workDayType}
                                                    isLinked={item.link_module_type && item.link_module_type !== 'NONE'}
                                                    handleChange={handleChange}
                                                    handleDeleteItem={handleDeleteItem}
                                                    handleAddItem={handleAddItem}
                                                    handleOpenImport={handleOpenImport}
                                                    spanInfo={spanInfoMap[item.id] || { isMainFirst: true, isProcFirst: true, mainRowSpan: 1, procRowSpan: 1 }}
                                                    standardItems={standardItems}
                                                    onApplyStandard={handleApplyStandardToRow}
                                                />
                                            ))}
                                        </React.Fragment>
                                    ))
                                ];
                            })()}
                        </tbody>
                    </SortableContext>

                    {!forPrint && (
                        <DragOverlay>
                            {activeItem ? (
                                <table className="w-full text-sm box-border table-fixed border-collapse bg-[#2c2c3a] shadow-2xl skew-y-1 origin-top-left opacity-95">
                                    <colgroup>
                                        <col width="30" />
                                        <col width="120" />
                                        <col width="140" />
                                        <col width="240" />
                                        <col width="140" />
                                        <col width="60" />
                                        <col width="90" />
                                        <col width="90" />
                                        <col width="60" />
                                        <col width="100" />
                                        <col width="80" />
                                        <col width="90" />
                                        <col width="80" />
                                        <col width="800" />
                                        <col width="60" />

                                    </colgroup>
                                    <tbody>
                                        <ScheduleTableRow
                                            item={activeItem}
                                            isLinked={activeItem.link_module_type && activeItem.link_module_type !== 'NONE'}
                                            operatingRates={operatingRates}
                                            workDayType={workDayType}
                                            handleChange={() => { }}
                                            handleDeleteItem={() => { }}
                                            handleAddItem={() => { }}
                                            handleOpenImport={() => { }}
                                            spanInfo={{}}
                                            isOverlay={true}
                                            standardItems={[]}
                                            onApplyStandard={() => { }}
                                        />
                                    </tbody>
                                </table>
                            ) : null}
                        </DragOverlay>
                    )}
                </table>
            </DndContext>
        </div>
    );

    return (
        <>
            <div
                className="p-6 flex flex-col max-w-[2400px] mx-auto text-gray-200"
                style={{ zoom: viewMode === "table" ? 0.85 : 1 }}
            >
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

                {/* Content Area - Table or Gantt */}
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

                <StandardImportModal
                    isOpen={importModalOpen}
                    onClose={() => setImportModalOpen(false)}
                    onSelect={handleImportSelect}
                    project_id={projectId}
                />

                <EvidenceResultModal
                    isOpen={evidenceModalOpen}
                    onClose={() => setEvidenceModalOpen(false)}
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
                    onAddItem={handleAddEvidenceItem}
                />

                <SnapshotManager
                    isOpen={snapshotModalOpen}
                    onClose={() => setSnapshotModalOpen(false)}
                />
            </div>

        </>
    );
}
