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
import SaveButton from "../components/cpe/SaveButton";
import toast from "react-hot-toast";
import { Trash2, Link, RefreshCw, Plus, GripVertical } from "lucide-react";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import StandardImportModal from "../components/cpe/StandardImportModal";

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

            {/* Main Category */}
            {(spanInfo.isMainFirst || isOverlay) && (
                <td
                    rowSpan={isOverlay ? 1 : spanInfo.mainRowSpan}
                    className="border-r border-gray-300 bg-gray-100/50 p-1 align-top relative group font-bold text-gray-800 text-center"
                >
                    <input
                        className="w-full bg-transparent outline-none text-center"
                        value={item.main_category}
                        onChange={(e) => handleChange(item.id, 'main_category', e.target.value)}
                    />
                </td>
            )}

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

const DEFAULT_SCHEDULE_ITEMS = [
    { id: "init-1", main_category: "1. 공사준비", process: "공사준비", work_type: "일반사항", operating_rate_type: "EARTH", order: 0, quantity: 0, productivity: 0, crew_size: 1, unit: "식", working_days: 0, calendar_days: 0 },
    { id: "init-2", main_category: "1. 공사준비", process: "공동가설", work_type: "가설설비", operating_rate_type: "EARTH", order: 1, quantity: 0, productivity: 0, crew_size: 1, unit: "식", working_days: 0, calendar_days: 0 },
    { id: "init-3", main_category: "2. 토공사", process: "토공", work_type: "토공사", operating_rate_type: "EARTH", order: 2, quantity: 0, productivity: 0, crew_size: 1, unit: "식", working_days: 0, calendar_days: 0 },
    { id: "init-4", main_category: "3. 골조공사", process: "RC공사", work_type: "골조공사", operating_rate_type: "FRAME", order: 3, quantity: 0, productivity: 0, crew_size: 1, unit: "식", working_days: 0, calendar_days: 0 },
    { id: "init-5", main_category: "4. 마감공사", process: "외부마감", work_type: "마감공사", operating_rate_type: "EXT_FIN", order: 4, quantity: 0, productivity: 0, crew_size: 1, unit: "식", working_days: 0, calendar_days: 0 },
    { id: "init-6", main_category: "4. 마감공사", process: "내부마감", work_type: "마감공사", operating_rate_type: "INT_FIN", order: 5, quantity: 0, productivity: 0, crew_size: 1, unit: "식", working_days: 0, calendar_days: 0 },
    { id: "init-7", main_category: "5. 기계, 전기, MEP", process: "MEP", work_type: "설비공사", operating_rate_type: "INT_FIN", order: 6, quantity: 0, productivity: 0, crew_size: 1, unit: "식", working_days: 0, calendar_days: 0 },
    { id: "init-8", main_category: "6. 부대토목 및 조경", process: "부대토목", work_type: "부대토목", operating_rate_type: "EARTH", order: 7, quantity: 0, productivity: 0, crew_size: 1, unit: "식", working_days: 0, calendar_days: 0 },
    { id: "init-9", main_category: "7. 정리기간", process: "준공준비", work_type: "준공준비", operating_rate_type: "INT_FIN", order: 8, quantity: 0, productivity: 0, crew_size: 1, unit: "식", working_days: 0, calendar_days: 0 },
];

export default function ScheduleMasterList() {
    const { id: projectId } = useParams();
    const [items, setItems] = useState([]);
    const [containerId, setContainerId] = useState(null); // ID of the JSON container

    // Auxiliary Data
    const [operatingRates, setOperatingRates] = useState([]);
    const [cipResult, setCipResult] = useState(null);
    const [pileResult, setPileResult] = useState(null);
    const [boredResult, setBoredResult] = useState(null);
    const [workDayType, setWorkDayType] = useState("6d");
    const [startDate, setStartDate] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Import Modal State
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importTargetParent, setImportTargetParent] = useState(null);

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
            let currentContainerId = fetchedData.containerId;

            if (!currentContainerId || !scheduleItems || scheduleItems.length === 0) {
                // Initialize if empty (Backend)
                try {
                    await initializeDefaultItems(projectId);
                    const refetched = await fetchScheduleItems(projectId);
                    scheduleItems = refetched.items;
                    currentContainerId = refetched.containerId;
                } catch (e) {
                    console.error("Backend Init Failed, using local fallback");
                }

                // If STILL empty (API failure or weirdness), use Local Fallback
                if (!scheduleItems || scheduleItems.length === 0) {
                    console.warn("Using Local Fallback Data");
                    scheduleItems = DEFAULT_SCHEDULE_ITEMS;
                    // Try to save it immediately if we have a containerId, or wait for user save
                    if (currentContainerId) {
                        saveScheduleData(currentContainerId, scheduleItems).catch(console.error);
                    }
                }
            }

            // Ensure proper calculation on load
            setContainerId(currentContainerId);
            setItems(scheduleItems); // Will calculate in effect

            setOperatingRates(rateData);
            setCipResult(Array.isArray(cipData) ? cipData[0] : (cipData.results?.[0] || null));
            setPileResult(Array.isArray(pileData) ? pileData[0] : (pileData.results?.[0] || null));
            setBoredResult(Array.isArray(boredData) ? boredData[0] : (boredData.results?.[0] || null));
            // Start Date is NOT in Items JSON for now, assuming Project Model still holds it as metadata (User said remove from DB, but actually meaning remove from ITEM TABLE. Project table still has it? Or do we store it in JSON meta? For now let's stick to Project Start Date as it is working.)
            // User said "remove star_date and working condition and Change DB completely to JSON". 
            // He might mean store start_date in JSON too. But I'll keep it simple: UI works with Project Date.
            setStartDate(projectData.start_date || "");
        } catch (error) {
            console.error("Data load failed:", error);
            toast.error("데이터 초기화 실패");
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const calculateItem = useCallback((item, currentWorkDayType = workDayType) => {
        const quantity = parseFloat(item.quantity) || 0;
        const base_productivity = parseFloat(item.productivity) || 0;
        const crew_size = parseFloat(item.crew_size) || 1;

        let productivity = base_productivity;

        // Apply Linked Productivity if exists
        if (item.link_module_type === 'CIP' && cipResult) {
            productivity = cipResult.daily_production_count || 0;
        } else if (item.link_module_type === 'PILE' && pileResult) {
            productivity = pileResult.daily_production_count || 0;
        } else if (item.link_module_type === 'BORED_PILE' && boredResult) {
            productivity = boredResult.daily_production_count || 0;
        }

        const daily_production = productivity * crew_size;
        const working_days = daily_production > 0 ? quantity / daily_production : 0;

        const rateObj = operatingRates.find(r => r.type === item.operating_rate_type);
        let rateValue = 100;
        if (rateObj) {
            if (currentWorkDayType === "7d") rateValue = parseFloat(rateObj.pct_7d);
            else if (currentWorkDayType === "5d") rateValue = parseFloat(rateObj.pct_5d);
            else rateValue = parseFloat(rateObj.pct_6d);
        }

        const calendar_days = rateValue > 0 ? working_days / (rateValue / 100) : 0;
        const calendar_months = calendar_days / 30;

        return {
            ...item,
            productivity: parseFloat(productivity.toFixed(3)),
            daily_production: parseFloat(daily_production.toFixed(3)),
            working_days: parseFloat(working_days.toFixed(2)),
            operating_rate_value: rateValue,
            calendar_days: parseFloat(calendar_days.toFixed(1)),
            calendar_months: parseFloat(calendar_months.toFixed(1))
        };
    }, [cipResult, pileResult, boredResult, operatingRates, workDayType]);

    // Recalculate all items when dependencies change
    useEffect(() => {
        setItems(prev => prev.map(item => calculateItem(item, workDayType)));
    }, [workDayType, operatingRates, cipResult, pileResult, boredResult, calculateItem]);

    const handleChange = (id, field, value) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                return calculateItem(updated);
            }
            return item;
        }));
    };

    const handleAddItem = (parentItem = null) => {
        const newItem = {
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            main_category: parentItem ? parentItem.main_category : "새 분류",
            process: parentItem ? parentItem.process : "새 공정",
            work_type: "새 항목",
            unit: "식",
            crew_size: 1,
            operating_rate_type: "EARTH",
            link_module_type: "NONE",
            productivity: 0,
            quantity: 0
        };
        const calculated = calculateItem(newItem);

        // Insert after parent, or at end
        if (parentItem) {
            setItems(prev => {
                const idx = prev.findIndex(i => i.id === parentItem.id);
                const next = [...prev];
                next.splice(idx + 1, 0, calculated);
                return next;
            });
        } else {
            setItems(prev => [...prev, calculated]);
        }
    };

    const handleOpenImport = (parentItem) => {
        setImportTargetParent(parentItem);
        setImportModalOpen(true);
    };

    const handleImportSelect = async (standardItem) => {
        if (!importTargetParent) return;
        const newItem = {
            id: `item-${Date.now()}`,
            main_category: importTargetParent.main_category,
            process: importTargetParent.process,
            work_type: standardItem.item_name,
            unit: standardItem.unit,
            productivity: standardItem.pumsam_workload || 0,
            standard_code: standardItem.standard,
            crew_size: 1,
            quantity: 0,
            operating_rate_type: "EARTH",
            quantity_formula: "",
            link_module_type: "NONE",
        };
        const calculated = calculateItem(newItem);

        setItems(prev => {
            const idx = prev.findIndex(i => i.id === importTargetParent.id);
            const next = [...prev];
            next.splice(idx + 1, 0, calculated);
            return next;
        });
        toast.success("표준품셈 항목 추가");
        setImportModalOpen(false);
    };

    const [activeId, setActiveId] = useState(null);

    // Dynamic RowSpan Calculation
    const spanInfoMap = useMemo(() => {
        const map = {};
        let lastMain = null;
        let lastMainId = null;
        let mainSpanCount = 0;

        let lastProc = null;
        let lastProcId = null;
        let procSpanCount = 0;

        // First pass: identify spans
        // We need to group by consecutive items.
        // We will store "isMainFirst" and increment counters.
        // But since we need the TOTAL span at the first item, we might need a reverse pass or object tracking.
        // Simpler: arrays of ranges.

        // Pass 1: Build groups
        const mainGroups = [];
        let currentGroup = [];
        items.forEach((item, idx) => {
            // Main Category
            if (idx === 0 || item.main_category !== items[idx - 1].main_category) {
                if (currentGroup.length > 0) mainGroups.push(currentGroup);
                currentGroup = [item.id];
            } else {
                currentGroup.push(item.id);
            }
        });
        if (currentGroup.length > 0) mainGroups.push(currentGroup);

        // Populate Map for Main
        mainGroups.forEach(group => {
            group.forEach((id, index) => {
                if (!map[id]) map[id] = {};
                map[id].isMainFirst = (index === 0);
                map[id].mainRowSpan = (index === 0) ? group.length : 0;
            });
        });

        // Pass 2: Build Process groups (within Main Category groups technically? Or global?)
        // Usually Process is sub-category of Main. So it resets if Main changes OR Process changes.
        // Let's assume strict hierarchy.

        const procGroups = [];
        currentGroup = [];
        items.forEach((item, idx) => {
            const prev = items[idx - 1];
            const isMainChanged = idx > 0 && item.main_category !== prev.main_category;
            const isProcChanged = idx > 0 && item.process !== prev.process;

            if (idx === 0 || isMainChanged || isProcChanged) {
                if (currentGroup.length > 0) procGroups.push(currentGroup);
                currentGroup = [item.id];
            } else {
                currentGroup.push(item.id);
            }
        });
        if (currentGroup.length > 0) procGroups.push(currentGroup);

        // Populate Map for Process
        procGroups.forEach(group => {
            group.forEach((id, index) => {
                if (!map[id]) map[id] = {}; // Should depend on prev
                map[id].isProcFirst = (index === 0);
                map[id].procRowSpan = (index === 0) ? group.length : 0;
            });
        });

        return map;
    }, [items]);

    // Dnd Handlers
    const handleDragStart = (event) => {
        setActiveId(event.active.id);
    };

    const handleDeleteItem = (id) => {
        if (!window.confirm("삭제하시겠습니까?")) return;
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveId(null);
        if (active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
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
            await saveScheduleData(targetContainerId, items);
            console.log("Save success!");
            toast.success("저장 완료");
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
        <div className="p-6 h-screen flex flex-col max-w-[2400px] mx-auto bg-gray-50/50 overflow-hidden">
            {/* Page Header */}
            <div className="flex justify-between items-end mb-4 border-b border-gray-200 pb-2 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-1 tracking-tight">공사기간 산정 기준 (Dynamic Layout)</h1>
                    <p className="text-sm text-gray-500">Drag & Drop 지원, 자동 셀 병합</p>
                </div>
                <div className="flex gap-4 items-center bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
                    {/* Start Date Picker */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Start Date</label>
                        <input
                            type="date"
                            className="bg-gray-50 text-gray-900 font-bold text-sm py-1.5 pl-3 pr-2 rounded-lg border border-gray-300 focus:border-blue-500 w-36 uppercase"
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
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Run Rate</label>
                        <select
                            className="bg-gray-50 text-gray-900 font-bold text-sm py-1.5 pl-2 pr-1 rounded-lg border border-gray-300 focus:border-blue-500 w-full"
                            value={workDayType}
                            onChange={(e) => setWorkDayType(e.target.value)}
                        >
                            <option value="5d">주5일</option>
                            <option value="6d">주6일</option>
                            <option value="7d">주7일</option>
                        </select>
                    </div>

                    <div className="w-px h-8 bg-gray-300 mx-2"></div>
                    <SaveButton onSave={handleSaveAll} saving={saving} />
                </div>
            </div>

            {/* Table Area with DndKit */}
            <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-gray-200 shadow-xl bg-white relative">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <table className="w-full text-sm box-border table-fixed border-collapse">
                        <colgroup>
                            <col width="30" />  {/* Drag Handle */}
                            <col width="100" /> {/* Main Category (Merged) */}
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
                        <thead className="bg-gray-50 text-gray-700 sticky top-0 z-20 shadow-sm border-b border-gray-300">
                            <tr>
                                <th className="border-r border-gray-300 px-2 py-3 bg-gray-100"></th>
                                <th className="border-r border-gray-300 px-2 py-3 font-bold bg-gray-100 text-center" colSpan={3}>Classification</th>
                                <th className="border-r border-gray-300 px-2 py-3 font-bold bg-gray-100 text-center" colSpan={3}>Quantity</th>
                                <th className="border-r border-gray-300 px-2 py-3 font-bold bg-gray-100 text-center text-blue-600" colSpan={4}>Calculation</th>
                                <th className="border-r border-gray-300 px-2 py-3 font-bold bg-gray-100 text-center" colSpan={3}>Info</th>
                            </tr>
                            <tr className="bg-white text-gray-600 font-medium">
                                <th className="border-r border-gray-200 px-1"></th>
                                <th className="border-r border-gray-200 px-2 py-2">대공종</th>
                                <th className="border-r border-gray-200 px-2 py-2">공종</th>
                                <th className="border-r border-gray-200 px-2 py-2">세부공종</th>

                                <th className="border-r border-gray-200 px-2 py-2">단위</th>
                                <th className="border-r border-gray-200 px-2 py-2">물량</th>
                                <th className="border-r border-gray-200 px-2 py-2">산출식</th>

                                <th className="border-r border-gray-200 px-2 py-2">일생산성</th>
                                <th className="border-r border-gray-200 px-2 py-2">Crew</th>
                                <th className="border-r border-gray-200 px-2 py-2">일작업량</th>

                                <th className="border-r border-gray-200 px-2 py-2 text-blue-500">작업일수</th>
                                <th className="border-r border-gray-200 px-2 py-2">가동율</th>
                                <th className="border-r border-gray-200 px-2 py-2 text-blue-700 font-bold bg-blue-50">공사기간</th>
                                <th className="border-r border-gray-200 px-2 py-2 text-blue-700 font-bold bg-blue-50">개월수</th>

                                <th className="border-r border-gray-200 px-2 py-2">Code</th>
                                <th className="border-r border-gray-200 px-2 py-2">비고</th>
                                <th className="border-r border-gray-200 px-2 py-2">기능</th>
                            </tr>
                        </thead>
                        <SortableContext items={items} strategy={verticalListSortingStrategy}>
                            <tbody className="divide-y divide-gray-200">
                                {items.map((item) => (
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
                            </tbody>
                        </SortableContext>

                        <DragOverlay>
                            {activeItem ? (
                                <table className="w-full text-sm box-border table-fixed border-collapse bg-white shadow-2xl skew-y-1 origin-top-left opacity-95">
                                    <colgroup>
                                        <col width="30" />
                                        <col width="100" />
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

            <StandardImportModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                onSelect={handleImportSelect}
                project_id={projectId}
            />
        </div>
    );
}
