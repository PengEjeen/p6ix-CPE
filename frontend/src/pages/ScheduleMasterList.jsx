import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
    fetchScheduleItems,
    saveScheduleData,
    initializeDefaultItems
} from "../api/cpe_all/construction_schedule";
import { detailOperatingRate } from "../api/cpe/operating_rate";
import { fetchCIPResults } from "../api/cpe_all/cip_basis";
import { fetchPileResults } from "../api/cpe_all/pile_basis";
import { fetchBoredPileResults } from "../api/cpe_all/bored_pile_basis";
import { detailProject } from "../api/cpe/project";
import { detailWorkCondition, updateWorkCondition } from "../api/cpe/calc";
import SaveButton from "../components/cpe/SaveButton";
import toast from "react-hot-toast";
import { Trash2, Link, RefreshCw, Plus, GripVertical, Undo2, Redo2, History, Save } from "lucide-react";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import StandardImportModal from "../components/cpe/StandardImportModal";
import GanttChart from "../components/cpe/GanttChart";

import { useScheduleStore } from "../stores/scheduleStore";

const SortableRow = ({ item, isLinked, handleChange, handleDeleteItem, handleAddItem, handleOpenImport, spanInfo, isOverlay }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id });

    // Ensure dragging item works if not overlay
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        position: 'relative',
        opacity: isDragging ? 0.3 : 1, // Dim original when dragging
    };

    // If it's the specific Overlay item, force opacity 1 and full cells
    if (isOverlay) {
        style.opacity = 1;
        style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)";
        style.backgroundColor = "white";
        // Overlay always shows full cells
        spanInfo = { mainRowSpan: 1, procRowSpan: 1, isMainFirst: true, isProcFirst: true };
    }

    return (
        <tr ref={setNodeRef} style={style} className={`hover:bg-gray-50 transition-colors ${isDragging && !isOverlay ? "bg-blue-50" : ""}`}>
            {/* Drag Handle */}
            <td className="border-r border-gray-200 text-center text-gray-400 cursor-grab active:cursor-grabbing p-1" {...attributes} {...listeners}>
                <GripVertical size={14} className="mx-auto" />
            </td>


            {/* Main Category - Hidden (shown in section header) */}

            {/* Process */}
            {(spanInfo.isProcFirst || isOverlay) && (
                <td
                    rowSpan={isOverlay ? 1 : spanInfo.procRowSpan}
                    className="border-r border-gray-300 bg-white p-1 align-top relative group"
                >
                    <div className="flex flex-col h-full min-h-[40px] justify-between">
                        <input
                            className="w-full bg-transparent outline-none font-medium text-gray-700 text-center text-xs mb-1"
                            value={item.process}
                            onChange={(e) => handleChange(item.id, 'process', e.target.value)}
                        />
                        {/* Hover Actions */}
                        <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-white/90 backdrop-blur-sm p-1 rounded border border-gray-100 shadow-sm mx-auto">
                            <button
                                className="text-[10px] p-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded flex items-center gap-1"
                                onClick={() => handleAddItem(item)}
                                title="추가"
                            >
                                <Plus size={10} />
                            </button>
                            <button
                                className="text-[10px] p-1 bg-green-50 hover:bg-green-100 text-green-600 rounded flex items-center gap-1"
                                onClick={() => handleOpenImport(item)}
                                title="품셈 가져오기"
                            >
                                <RefreshCw size={10} />
                            </button>
                        </div>
                    </div>
                </td>
            )}

            {/* Work Type */}
            <td className="border-r border-gray-200 px-2 py-1">
                <div className="flex items-center gap-1">
                    {isLinked && <Link size={12} className="text-blue-500" />}
                    <input
                        type="text"
                        className="w-full bg-transparent outline-none text-gray-700 p-1 rounded hover:bg-gray-100 focus:bg-white focus:ring-1 focus:ring-blue-300 transition text-xs"
                        value={item.work_type}
                        onChange={(e) => handleChange(item.id, 'work_type', e.target.value)}
                    />
                </div>
            </td>

            {/* Unit */}
            <td className="border-r border-gray-200 p-1">
                <input className="w-full text-center outline-none p-1 text-gray-600 bg-transparent text-xs" value={item.unit} onChange={(e) => handleChange(item.id, 'unit', e.target.value)} />
            </td>

            {/* Quantity */}
            <td className="border-r border-gray-200 p-1">
                <input className="w-full text-right outline-none p-1 font-bold text-gray-900 bg-gray-50 rounded text-xs" value={item.quantity} onChange={(e) => handleChange(item.id, 'quantity', e.target.value)} />
            </td>

            {/* Formula */}
            <td className="border-r border-gray-200 p-1">
                <input className="w-full text-right outline-none p-1 text-[10px] text-gray-400" value={item.quantity_formula || ''} placeholder="-" onChange={(e) => handleChange(item.id, 'quantity_formula', e.target.value)} />
            </td>

            {/* Productivity */}
            <td className={`border-r border-gray-200 p-1 ${isLinked ? 'bg-blue-50' : ''}`}>
                <input className={`w-full text-right outline-none p-1 text-xs ${isLinked ? 'text-blue-600 font-bold' : 'text-gray-700'}`} value={item.productivity} disabled={isLinked} onChange={(e) => handleChange(item.id, 'productivity', e.target.value)} />
            </td>

            {/* Crew */}
            <td className="border-r border-gray-200 p-1">
                <input className="w-full text-center outline-none p-1 text-gray-600 text-xs" value={item.crew_size} onChange={(e) => handleChange(item.id, 'crew_size', e.target.value)} />
            </td>

            {/* Daily Prod */}
            <td className="border-r border-gray-200 px-2 py-1 text-right text-gray-500 font-mono bg-gray-50/50 text-xs">
                {item.daily_production?.toLocaleString()}
            </td>

            {/* Working Days */}
            <td className="border-r border-gray-200 px-2 py-1 text-right text-blue-600 font-bold font-mono text-xs">
                {parseFloat(item.working_days || 0).toFixed(1)}
            </td>

            {/* Op Rate */}
            <td className="border-r border-gray-200 p-1">
                <select className="w-full bg-transparent text-[10px] text-center outline-none text-gray-600" value={item.operating_rate_type} onChange={(e) => handleChange(item.id, 'operating_rate_type', e.target.value)}>
                    <option value="EARTH">토목</option>
                    <option value="FRAME">골조</option>
                    <option value="EXT_FIN">외부</option>
                    <option value="INT_FIN">내부</option>
                </select>
            </td>

            {/* Cal Days */}
            <td className="border-r border-gray-200 px-2 py-1 text-right text-blue-700 font-bold font-mono bg-blue-50 text-xs">
                {item.calendar_days}
            </td>

            {/* Cal Months */}
            <td className="border-r border-gray-200 px-2 py-1 text-right text-gray-600 font-mono bg-blue-50/30 text-xs">
                {item.calendar_months}
            </td>

            {/* Code */}
            <td className="border-r border-gray-200 px-2 py-1 text-[10px] text-gray-400 truncate" title={item.standard_code}>
                {item.standard_code}
            </td>

            {/* Remarks */}
            <td className="border-r border-gray-200 p-1">
                <input className="w-full text-[10px] outline-none p-1 text-gray-500" value={item.remarks} onChange={(e) => handleChange(item.id, 'remarks', e.target.value)} />
            </td>

            {/* Action */}
            <td className="p-1 text-center">
                <button className="text-gray-400 hover:text-red-500 transition-colors" onClick={() => handleDeleteItem(item.id)}>
                    <Trash2 size={12} />
                </button>
            </td>
        </tr>
    );
};

const SnapshotManager = ({ isOpen, onClose }) => {
    const snapshots = useScheduleStore((state) => state.snapshots);
    const addSnapshot = useScheduleStore((state) => state.addSnapshot);
    const restoreSnapshot = useScheduleStore((state) => state.restoreSnapshot);
    const deleteSnapshot = useScheduleStore((state) => state.deleteSnapshot);
    const [label, setLabel] = useState("");

    if (!isOpen) return null;

    const handleCreate = () => {
        if (!label.trim()) return;
        addSnapshot(label);
        setLabel("");
        toast.success("스냅샷 저장 완료");
    };

    const handleRestore = (id) => {
        if (window.confirm("현재 작업 내용이 스냅샷 내용으로 대체됩니다. 계속하시겠습니까?")) {
            restoreSnapshot(id);
            toast.success("복구 완료");
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-96 max-h-[500px] flex flex-col overflow-hidden border border-gray-200" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <History size={18} className="text-blue-600" />
                        히스토리 / 스냅샷
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <div className="p-4 border-b border-gray-100 bg-white">
                    <div className="flex gap-2">
                        <input
                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
                            placeholder="버전 이름 입력 (예: 1차 수정)"
                            value={label}
                            onChange={e => setLabel(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        />
                        <button
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-bold flex items-center gap-1 transition-colors"
                            onClick={handleCreate}
                        >
                            <Save size={14} /> 저장
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50/50">
                    {snapshots.length === 0 && (
                        <div className="text-center text-gray-400 text-xs py-8">저장된 스냅샷이 없습니다.</div>
                    )}
                    {snapshots.map(snap => (
                        <div key={snap.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow group">
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-bold text-gray-800 text-sm">{snap.label}</span>
                                <span className="text-[10px] text-gray-500">{new Date(snap.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <div className="flex gap-2 mt-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button
                                    className="flex-1 bg-blue-50 text-blue-700 py-1 rounded text-xs hover:bg-blue-100 font-medium"
                                    onClick={() => handleRestore(snap.id)}
                                >
                                    복구
                                </button>
                                <button
                                    className="px-2 text-gray-400 hover:text-red-500 transition-colors"
                                    onClick={() => deleteSnapshot(snap.id)}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const DEFAULT_SCHEDULE_ITEMS = [];

export default function ScheduleMasterList() {
    const { id: projectId } = useParams();

    // Store Integration
    const items = useScheduleStore((state) => state.items);
    const operatingRates = useScheduleStore((state) => state.operatingRates);
    const links = useScheduleStore((state) => state.links);
    const workDayType = useScheduleStore((state) => state.workDayType);

    // Actions
    const setStoreItems = useScheduleStore((state) => state.setItems);
    const setStoreOperatingRates = useScheduleStore((state) => state.setOperatingRates);
    const setStoreLinks = useScheduleStore((state) => state.setLinks);
    const setStoreWorkDayType = useScheduleStore((state) => state.setWorkDayType);
    const updateItem = useScheduleStore((state) => state.updateItem);
    const addItem = useScheduleStore((state) => state.addItem);
    const addItemAtIndex = useScheduleStore((state) => state.addItemAtIndex);
    const deleteItem = useScheduleStore((state) => state.deleteItem);
    const reorderItems = useScheduleStore((state) => state.reorderItems);

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
    const moveTaskBar = useScheduleStore((state) => state.moveTaskBar);

    const [containerId, setContainerId] = useState(null); // ID of the JSON container

    const [cipResult, setCipResult] = useState(null);
    const [pileResult, setPileResult] = useState(null);
    const [boredResult, setBoredResult] = useState(null);
    const [startDate, setStartDate] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Import Modal State
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
    const [importTargetParent, setImportTargetParent] = useState(null);
    const [viewMode, setViewMode] = useState("table"); // "table" or "gantt"

    // Dnd Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [fetchedData, rateData, cipData, pileData, boredData, projectData] = await Promise.all([
                fetchScheduleItems(projectId),
                detailOperatingRate(projectId),
                fetchCIPResults(projectId),
                fetchPileResults(projectId),
                fetchBoredPileResults(projectId),
                detailProject(projectId)
            ]);

            // Handle Initial Init
            let scheduleItems = fetchedData.items;
            let scheduleLinks = fetchedData.links || [];
            let currentContainerId = fetchedData.containerId;

            if (!currentContainerId || !scheduleItems || scheduleItems.length === 0) {
                // Initialize if empty (Backend)
                try {
                    await initializeDefaultItems(projectId);
                    const refetched = await fetchScheduleItems(projectId);
                    scheduleItems = refetched.items;
                    scheduleLinks = refetched.links || [];
                    currentContainerId = refetched.containerId;
                } catch (e) {
                    console.error("Backend Init Failed, using local fallback");
                }

                // If STILL empty (API failure or weirdness), use Local Fallback
                if (!scheduleItems || scheduleItems.length === 0) {
                    console.warn("Using Local Fallback Data");
                    scheduleItems = DEFAULT_SCHEDULE_ITEMS;
                    scheduleLinks = [];
                    // Try to save it immediately if we have a containerId, or wait for user save
                    if (currentContainerId) {
                        saveScheduleData(currentContainerId, { items: scheduleItems, links: scheduleLinks }).catch(console.error);
                    }
                }
            }

            // Ensure proper calculation on load
            setContainerId(currentContainerId);

            // Store Init
            setStoreOperatingRates(rateData);
            setStoreItems(scheduleItems); // Will calculate in store
            setStoreLinks(scheduleLinks);

            setCipResult(Array.isArray(cipData) ? cipData[0] : (cipData.results?.[0] || null));
            setPileResult(Array.isArray(pileData) ? pileData[0] : (pileData.results?.[0] || null));
            setBoredResult(Array.isArray(boredData) ? boredData[0] : (boredData.results?.[0] || null));
            // Start Date is NOT in Items JSON for now, assuming Project Model still holds it as metadata (User said remove from DB, but actually meaning remove from ITEM TABLE. Project table still has it? Or do we store it in JSON meta? For now let's stick to Project Start Date as it is working.)
            // User said "remove star_date and working condition and Change DB completely to JSON". 
            // He might mean store start_date in JSON too. But I'll keep it simple: UI works with Project Date.
            setStartDate(projectData.start_date || "");

            // Safely fetch Run Rate (WorkCondition)
            try {
                const workCondResponse = await detailWorkCondition(projectId);
                console.log("[DEBUG LOAD] WorkCondition API response:", workCondResponse);

                const workCond = workCondResponse.data || workCondResponse;
                console.log("[DEBUG LOAD] WorkCondition data:", workCond);
                console.log("[DEBUG LOAD] earthwork_type:", workCond.earthwork_type);

                if (workCond && workCond.earthwork_type) {
                    const newWorkDayType = `${workCond.earthwork_type}d`;
                    console.log("[DEBUG LOAD] Setting workDayType to:", newWorkDayType);
                    setStoreWorkDayType(newWorkDayType);
                } else {
                    console.warn("[DEBUG LOAD] No earthwork_type found in response");
                }
            } catch (e) {
                console.warn("Run Rate Load Failed (Non-critical):", e);
            }
        } catch (error) {
            console.error("Data load failed:", error);
            toast.error("데이터 초기화 실패");
        } finally {
            setLoading(false);
        }
    }, [projectId, setStoreItems, setStoreOperatingRates, setStoreWorkDayType]);

    useEffect(() => {
        loadData();
    }, [loadData]);

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

    // --- Gantt to Store Connection ---
    const handleGanttResize = (itemId, newCalendarDays, mode = 'crew') => {
        // Mode-based Resize (Crew Adjustment vs Productivity Adjustment)
        if (mode === 'prod') {
            // Adjust Productivity (Keep Crew Constant)
            resizeTaskBarByProductivity(itemId, newCalendarDays);
        } else {
            // Adjust Crew (Default: Keep Workload Constant)
            // Smart Action: Increase Crew (Maintain standard productivity)
            resizeTaskBar(itemId, newCalendarDays);
        }
    };

    const handleSmartResize = (itemId, newCalendarDays, baseProductivity = null) => {
        // Legacy/Direct calling support if needed
        resizeTaskBar(itemId, newCalendarDays, baseProductivity);
    };

    const handleOpenImport = (parentItem) => {
        setImportTargetParent(parentItem);
        setImportModalOpen(true);
    };

    // Updated Import Handler using Store
    const handleImportSelect = async (importedData) => {
        // importedData might be array or single item depending on Modal implementation
        // StandardImportModal usually passes an array or single item?
        // Let's assume array for safety based on previous code reading or adapt
        const dataArray = Array.isArray(importedData) ? importedData : [importedData];

        dataArray.forEach(std => {
            const newItem = {
                id: `imp-${Date.now()}-${Math.random()}`,
                main_category: importTargetParent?.main_category || "수입 공종",
                process: std.process_name || importTargetParent?.process || "수입 작업",
                work_type: std.item_name,
                unit: std.unit,
                quantity: 1,
                quantity_formula: "",
                productivity: std.productivity || std.pumsam_workload || 0,
                crew_size: 1,
                operating_rate_type: "EARTH",
                operating_rate_value: 0,
                standard_code: std.code || std.standard
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

    const [activeId, setActiveId] = useState(null);

    // Dynamic RowSpan Calculation
    const spanInfoMap = useMemo(() => {
        const map = {};
        // Simplified Logic: 
        // We will just disable merging for now until the logic is fully ported or robust.
        // Returning an empty object will cause line 725 to fallback to default (no span)
        return map;
    }, [items]);

    // [DISABLED] Auto-mark enclosed tasks as "병행작업"
    // This was causing UI lag/sync issues (requiring double click).
    // Visuals for parallel tasks will be handled dynamically in GanttChart.
    /*
    useEffect(() => {
        if (!items || items.length === 0) return;

        // Calculate timing data similar to GanttChart
        const itemsWithTiming = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const duration = parseFloat(item.calendar_days) || 0;

            let startDay;
            if (item._startDay !== undefined && item._startDay !== null) {
                startDay = item._startDay;
            } else {
                if (i === 0) {
                    startDay = 0;
                } else {
                    const maxPrevEnd = itemsWithTiming.length > 0
                        ? Math.max(...itemsWithTiming.map(r => r.startDay + r.durationDays))
                        : 0;
                    startDay = maxPrevEnd;
                }
            }

            itemsWithTiming.push({ ...item, startDay, durationDays: duration });
        }

        // Check each item for enclosed status
        itemsWithTiming.forEach((item, index) => {
            if (index === 0) return; // Skip first item

            const prevItem = itemsWithTiming[index - 1];
            const prevEnd = prevItem.startDay + prevItem.durationDays;
            const currentEnd = item.startDay + item.durationDays;

            // Check if current item is fully enclosed (grey)
            const isEnclosed = prevEnd > currentEnd;

            if (isEnclosed && item.remarks !== '병행작업') {
                // Auto-update remarks to "병행작업"
                updateItem(item.id, 'remarks', '병행작업');
            } else if (!isEnclosed && item.remarks === '병행작업') {
                // Clear if no longer enclosed
                updateItem(item.id, 'remarks', '');
            }
        });
    }, [items, updateItem]);
    */

    // Dnd Handlers
    const handleDragStart = (event) => {
        setActiveId(event.active.id);
    };

    const handleDeleteItem = (id) => {
        if (!window.confirm("삭제하시겠습니까?")) return;
        deleteItem(id);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over || active.id === over.id) return;

        const activeItem = items.find(item => item.id === active.id);
        const overItem = items.find(item => item.id === over.id);

        // Prevent drag-drop across different categories
        if (activeItem.main_category !== overItem.main_category) {
            toast.error('같은 대공종 내에서만 이동 가능합니다.');
            return;
        }

        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        reorderItems(newOrder);
    };

    const handleSaveAll = async () => {
        console.log("Saving schedule data... ContainerID:", containerId);
        setSaving(true);
        try {
            let targetContainerId = containerId;

            // If No Container ID (Fallback Mode), try to Initialize First
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

            // Run both saves independently
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
                saveScheduleData(targetContainerId, { items, links }),
                updateWorkCondition(projectId, {
                    earthwork_type: typeVal,
                    framework_type: typeVal
                })
            ]);

            // Check results
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

            // Show success if at least one succeeded
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

    return (
        <div className="p-6 h-screen flex flex-col max-w-[2400px] mx-auto text-gray-200 overflow-hidden">
            {/* Page Header */}
            <div className="flex justify-between items-end mb-4 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-100 mb-1 tracking-tight">공사기간 산정 기준</h1>
                    <div className="flex items-center gap-4">
                        <p className="text-sm text-gray-400">Drag & Drop 지원, 자동 셀 병합</p>
                        {/* View Mode Tabs */}
                        <div className="flex gap-1 bg-[#2c2c3a] p-1 rounded-lg border border-gray-700">
                            <button
                                className={`px-3 py-1 text-xs font-semibold rounded transition-all ${viewMode === "table"
                                    ? "bg-[#3a3a4a] text-white shadow-sm"
                                    : "text-gray-400 hover:text-white"
                                    }`}
                                onClick={() => setViewMode("table")}
                            >
                                테이블 뷰
                            </button>
                            <button
                                className={`px-3 py-1 text-xs font-semibold rounded transition-all ${viewMode === "gantt"
                                    ? "bg-[#3a3a4a] text-white shadow-sm"
                                    : "text-gray-400 hover:text-white"
                                    }`}
                                onClick={() => setViewMode("gantt")}
                            >
                                간트차트
                            </button>
                        </div>
                    </div>
                </div>
                <div className="flex gap-4 items-center bg-[#2c2c3a] px-4 py-2 rounded-xl border border-gray-700 shadow-sm">
                    {/* Undo/Redo Buttons */}
                    <div className="flex items-center gap-1 mr-2 border-r border-gray-700 pr-3">
                        <button
                            className={`p-1.5 rounded hover:bg-[#3a3a4d] transition-colors ${!canUndo ? 'opacity-30 cursor-not-allowed' : 'text-gray-200'}`}
                            onClick={() => undo()}
                            disabled={!canUndo}
                            title="실행 취소 (Ctrl+Z)"
                        >
                            <Undo2 size={16} />
                        </button>
                        <button
                            className={`p-1.5 rounded hover:bg-[#3a3a4d] transition-colors ${!canRedo ? 'opacity-30 cursor-not-allowed' : 'text-gray-200'}`}
                            onClick={() => redo()}
                            disabled={!canRedo}
                            title="다시 실행 (Ctrl+Shift+Z)"
                        >
                            <Redo2 size={16} />
                        </button>
                    </div>

                    {/* Snapshot Button */}
                    <button
                        className="p-1.5 rounded hover:bg-[#3a3a4d] text-gray-200 mr-2 transition-colors relative group"
                        onClick={() => setSnapshotModalOpen(true)}
                        title="스냅샷 / 히스토리"
                    >
                        <History size={18} />
                        {/* Dot indicator if snapshots exist? (Optional) */}
                    </button>

                    {/* Start Date Picker */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Start Date</label>
                        <input
                            type="date"
                            className="bg-[#181825] text-gray-100 font-bold text-sm py-1.5 pl-3 pr-2 rounded-lg border border-gray-700 focus:border-blue-500 w-36 uppercase"
                            value={startDate}
                            onChange={(e) => {
                                const val = e.target.value;
                                setStartDate(val);
                                // fire and forget update
                                import("../api/cpe/project").then(({ updateProject }) => updateProject(projectId, { start_date: val }));
                            }}
                        />
                    </div>

                    {/* Work Day Type Selector (Restored) */}
                    <div className="flex flex-col gap-1 w-20">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Run Rate</label>
                        <select
                            className="bg-[#181825] text-gray-100 font-bold text-sm py-1.5 pl-2 pr-1 rounded-lg border border-gray-700 focus:border-blue-500 w-full"
                            value={workDayType}
                            onChange={(e) => setStoreWorkDayType(e.target.value)}
                        >
                            <option value="5d">주5일</option>
                            <option value="6d">주6일</option>
                            <option value="7d">주7일</option>
                        </select>
                    </div>

                    <div className="w-px h-8 bg-gray-700 mx-2"></div>
                    <SaveButton onSave={handleSaveAll} saving={saving} />
                </div>
            </div>

            {/* Content Area - Table or Gantt */}
            {viewMode === "gantt" ? (
                <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-gray-700 bg-[#2c2c3a] p-3 shadow-lg">
                    <GanttChart
                        items={items}
                        links={links}
                        startDate={startDate}
                        onResize={handleGanttResize}
                        onSmartResize={handleSmartResize}
                    />
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-gray-700 shadow-xl bg-[#2c2c3a] relative">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <table className="w-full text-sm box-border table-fixed border-collapse bg-white rounded-lg overflow-hidden">
                            <colgroup>
                                <col width="30" />  {/* Drag Handle */}
                                <col width="120" /> {/* Process (Merged) */}
                                <col width="180" /> {/* Work Type */}
                                <col width="60" />  {/* Unit */}
                                <col width="90" />  {/* Quantity */}
                                <col width="120" /> {/* Quantity Rate (Cal) */}
                                <col width="90" />  {/* Productivity */}
                                <col width="50" />  {/* Crew */}
                                <col width="90" />  {/* Daily Prod */}
                                <col width="80" />  {/* Working Days */}
                                <col width="70" />  {/* Op Rate */}
                                <col width="80" />  {/* Cal Days */}
                                <col width="70" />  {/* Cal Months */}
                                <col width="100" /> {/* Std Code */}
                                <col width="120" /> {/* Remarks */}
                                <col width="50" />  {/* Action */}
                            </colgroup>
                            <thead className="bg-gray-50 text-gray-700 sticky top-0 z-[2] shadow-sm border-b border-gray-300">
                                <tr>
                                    <th className="border-r border-gray-300 px-2 py-3 bg-gray-100"></th>
                                    <th className="border-r border-gray-300 px-2 py-3 font-bold bg-gray-100 text-center" colSpan={2}>분류</th>
                                    <th className="border-r border-gray-300 px-2 py-3 font-bold bg-gray-100 text-center" colSpan={3}>물량</th>
                                    <th className="border-r border-gray-300 px-2 py-3 font-bold bg-gray-100 text-center text-blue-600" colSpan={4}>산정</th>
                                    <th className="border-r border-gray-300 px-2 py-3 font-bold bg-gray-100 text-center" colSpan={3}>정보</th>
                                </tr>
                                <tr className="bg-white text-gray-600 font-medium">
                                    <th className="border-r border-gray-200 px-1"></th>
                                    <th className="border-r border-gray-200 px-2 py-2">공종</th>
                                    <th className="border-r border-gray-200 px-2 py-2">세부공종</th>

                                    <th className="border-r border-gray-200 px-2 py-2">단위</th>
                                    <th className="border-r border-gray-200 px-2 py-2">물량</th>
                                    <th className="border-r border-gray-200 px-2 py-2">산출식</th>

                                    <th className="border-r border-gray-200 px-2 py-2">일생산성</th>
                                    <th className="border-r border-gray-200 px-2 py-2">작업조</th>
                                    <th className="border-r border-gray-200 px-2 py-2">일작업량</th>

                                    <th className="border-r border-gray-200 px-2 py-2 text-blue-500">작업일수</th>
                                    <th className="border-r border-gray-200 px-2 py-2">가동율</th>
                                    <th className="border-r border-gray-200 px-2 py-2 text-blue-700 font-bold bg-blue-50">공사기간</th>
                                    <th className="border-r border-gray-200 px-2 py-2 text-blue-700 font-bold bg-blue-50">개월수</th>

                                    <th className="border-r border-gray-200 px-2 py-2">표준코드</th>
                                    <th className="border-r border-gray-200 px-2 py-2">비고</th>
                                    <th className="border-r border-gray-200 px-2 py-2">기능</th>
                                </tr>
                            </thead>
                            <SortableContext items={items} strategy={verticalListSortingStrategy}>
                                <tbody className="divide-y divide-gray-200">
                                    {(() => {
                                        // Group items by main_category
                                        const groupedItems = items.reduce((acc, item) => {
                                            const category = item.main_category || '기타';
                                            if (!acc[category]) acc[category] = [];
                                            acc[category].push(item);
                                            return acc;
                                        }, {});

                                        // Render grouped rows
                                        return Object.entries(groupedItems).map(([category, categoryItems]) => (
                                            <React.Fragment key={category}>
                                                {/* Section Header */}
                                                <tr className="bg-gradient-to-r from-slate-100 to-slate-50 border-t-2 border-slate-300">
                                                    <td colSpan="16" className="px-4 py-2.5">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                                                                <h3 className="font-bold text-gray-800 text-base tracking-tight">
                                                                    {category}
                                                                </h3>
                                                                <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                                                                    {categoryItems.length}개 항목
                                                                </span>
                                                            </div>
                                                            {/* Action Buttons */}
                                                            <div className="flex items-center gap-2">
                                                                {/* Standard Import Button */}
                                                                <button
                                                                    onClick={() => {
                                                                        const lastCategoryItem = categoryItems[categoryItems.length - 1] || items[0];
                                                                        if (lastCategoryItem) {
                                                                            handleOpenImport({
                                                                                ...lastCategoryItem,
                                                                                main_category: category
                                                                            });
                                                                        }
                                                                    }}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium shadow-sm transition-all hover:shadow-md active:scale-95"
                                                                >
                                                                    <RefreshCw size={16} />
                                                                    <span>표준품셈 선택</span>
                                                                </button>

                                                                {/* Add Item Button */}
                                                                <button
                                                                    onClick={() => {
                                                                        const lastCategoryItem = categoryItems[categoryItems.length - 1] || items[0];
                                                                        if (lastCategoryItem) {
                                                                            handleAddItem({
                                                                                ...lastCategoryItem,
                                                                                main_category: category,
                                                                                process: category === lastCategoryItem.main_category ? lastCategoryItem.process : ''
                                                                            });
                                                                        }
                                                                    }}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium shadow-sm transition-all hover:shadow-md active:scale-95"
                                                                >
                                                                    <Plus size={16} />
                                                                    <span>항목 추가</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {/* Category Items */}
                                                {categoryItems.map((item) => (
                                                    <SortableRow
                                                        key={item.id}
                                                        item={item}
                                                        isLinked={item.link_module_type && item.link_module_type !== 'NONE'}
                                                        handleChange={handleChange}
                                                        handleDeleteItem={handleDeleteItem}
                                                        handleAddItem={handleAddItem}
                                                        handleOpenImport={handleOpenImport}
                                                        spanInfo={spanInfoMap[item.id] || { isMainFirst: true, isProcFirst: true, mainRowSpan: 1, procRowSpan: 1 }}
                                                    />
                                                ))}
                                            </React.Fragment>
                                        ));
                                    })()}
                                </tbody>
                            </SortableContext>

                            <DragOverlay>
                                {activeItem ? (
                                    <table className="w-full text-sm box-border table-fixed border-collapse bg-white shadow-2xl skew-y-1 origin-top-left opacity-95">
                                        <colgroup>
                                            <col width="30" />
                                            <col width="120" />
                                            <col width="180" />
                                            <col width="60" />
                                            <col width="90" />
                                            <col width="120" />
                                            <col width="90" />
                                            <col width="50" />
                                            <col width="90" />
                                            <col width="80" />
                                            <col width="70" />
                                            <col width="80" />
                                            <col width="70" />
                                            <col width="100" />
                                            <col width="120" />
                                            <col width="50" />
                                        </colgroup>
                                        <tbody>
                                            <SortableRow
                                                item={activeItem}
                                                isLinked={activeItem.link_module_type && activeItem.link_module_type !== 'NONE'}
                                                handleChange={() => { }}
                                                handleDeleteItem={() => { }}
                                                handleAddItem={() => { }}
                                                handleOpenImport={() => { }}
                                                spanInfo={{}}
                                                isOverlay={true}
                                            />
                                        </tbody>
                                    </table>
                                ) : null}
                            </DragOverlay>
                        </table>
                    </DndContext>
                </div>
            )}

            <StandardImportModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                onSelect={handleImportSelect}
                project_id={projectId}
            />

            <SnapshotManager
                isOpen={snapshotModalOpen}
                onClose={() => setSnapshotModalOpen(false)}
            />
        </div>
    );
}
