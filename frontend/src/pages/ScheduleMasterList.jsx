import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
    fetchScheduleItems,
    saveScheduleData,
    initializeDefaultItems
} from "../api/cpe_all/construction_schedule";
import { detailOperatingRate } from "../api/cpe/operating_rate";
import { fetchCIPResults, fetchCIPStandard } from "../api/cpe_all/cip_basis";
import { fetchPileResults, fetchPileStandard } from "../api/cpe_all/pile_basis";
import { fetchBoredPileResults, fetchBoredPileStandard } from "../api/cpe_all/bored_pile_basis";
import { detailProject } from "../api/cpe/project";
import { detailWorkCondition, updateWorkCondition } from "../api/cpe/calc";
import toast from "react-hot-toast";
import { Trash2, Link, RefreshCw, Plus, GripVertical, History, Save } from "lucide-react";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import StandardImportModal from "../components/cpe/StandardImportModal";
import TableToolbarRow from "../components/cpe/schedule/TableToolbarRow";
import ScheduleHeader from "../components/cpe/schedule/ScheduleHeader";
import ScheduleGanttPanel from "../components/cpe/schedule/ScheduleGanttPanel";
import EvidenceResultModal from "../components/cpe/schedule/EvidenceResultModal";

import { useScheduleStore } from "../stores/scheduleStore";
import { calculateItem } from "../utils/solver";
import { useConfirm } from "../contexts/ConfirmContext";
import { summarizeScheduleAiLog } from "../api/cpe/schedule_ai";

const SortableRow = ({ item, isLinked, handleChange, handleDeleteItem, handleAddItem, handleOpenImport, spanInfo, isOverlay, rowClassName = "", operatingRates = [], workDayType = "6d" }) => {
    const [rateOpen, setRateOpen] = useState(false);
    const rateObj = operatingRates.find((rate) => rate.type === item.operating_rate_type);
    let rateValue = item.operating_rate_value ?? 100;
    if (rateObj) {
        if (workDayType === "7d") rateValue = rateObj.pct_7d;
        else if (workDayType === "5d") rateValue = rateObj.pct_5d;
        else rateValue = rateObj.pct_6d;
    }
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
        <tr ref={setNodeRef} style={style} className={`hover:bg-white/5 transition-colors text-base ${rowClassName} ${isDragging && !isOverlay ? "bg-blue-900/20" : ""}`}>
            {/* Drag Handle */}
            <td className="border-r border-gray-700 text-center text-gray-400 cursor-grab active:cursor-grabbing p-1" {...attributes} {...listeners}>
                <GripVertical size={14} className="mx-auto" />
            </td>

            {/* Main Category */}
            <td className="border-r border-gray-700 px-2 py-1 text-center text-gray-200 text-base font-medium">
                {item.main_category}
            </td>

            {/* Process */}
            {(spanInfo.isProcFirst || isOverlay) && (
                <td
                    rowSpan={isOverlay ? 1 : spanInfo.procRowSpan}
                    className="border-r border-gray-700 bg-[#2c2c3a] p-1 align-top relative group"
                >
                    <div className="flex flex-col h-full min-h-[40px] justify-between">
                        <input
                            className="w-full bg-transparent outline-none font-medium text-gray-200 text-center text-base mb-1"
                            value={item.process}
                            onChange={(e) => handleChange(item.id, 'process', e.target.value)}
                        />
                        {/* Hover Actions */}
                        <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-[#1f1f2b]/90 backdrop-blur-sm p-1 rounded border border-gray-700 shadow-sm mx-auto">
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
            <td className="border-r border-gray-700 px-2 py-1">
                <div className="flex items-center gap-1">
                    {isLinked && <Link size={12} className="text-blue-500" />}
                    <input
                        type="text"
                        className="w-full bg-transparent outline-none text-gray-200 p-1 rounded hover:bg-white/10 focus:bg-[#1f1f2b] focus:ring-1 focus:ring-blue-500/50 transition text-base font-medium"
                        value={item.work_type}
                        onChange={(e) => handleChange(item.id, 'work_type', e.target.value)}
                    />
                </div>
            </td>

            {/* Formula */}
            <td className="border-r border-gray-700 p-1">
                <input className="w-full text-right outline-none p-1 text-sm text-gray-400 bg-[#1f1f2b] rounded font-medium" value={item.quantity_formula || ''} placeholder="-" onChange={(e) => handleChange(item.id, 'quantity_formula', e.target.value)} />
            </td>

            {/* Unit */}
            <td className="border-r border-gray-700 p-1">
                <input className="w-full text-center outline-none p-1 text-gray-300 bg-[#1f1f2b] rounded text-base font-medium" value={item.unit} onChange={(e) => handleChange(item.id, 'unit', e.target.value)} />
            </td>

            {/* Quantity */}
            <td className="border-r border-gray-700 p-1">
                <input className="w-full text-right outline-none p-1 font-bold text-gray-100 bg-[#1f1f2b] rounded text-base tracking-tight" value={item.quantity} onChange={(e) => handleChange(item.id, 'quantity', e.target.value)} />
            </td>

            {/* Productivity */}
            <td className={`border-r border-gray-700 p-1 ${isLinked ? 'bg-blue-900/20' : ''}`}>
                <input className={`w-full text-right outline-none p-1 text-base bg-[#1f1f2b] rounded ${isLinked ? 'text-blue-300 font-bold' : 'text-gray-200 font-semibold'}`} value={item.productivity} disabled={isLinked} onChange={(e) => handleChange(item.id, 'productivity', e.target.value)} />
            </td>

            {/* Crew */}
            <td className="border-r border-gray-700 p-1">
                <input className="w-full text-center outline-none p-1 text-gray-200 bg-[#1f1f2b] rounded text-base font-semibold" value={item.crew_size} onChange={(e) => handleChange(item.id, 'crew_size', e.target.value)} />
            </td>

            {/* Daily Prod */}
            <td className="border-r border-gray-700 px-2 py-1 text-right text-gray-200 font-mono bg-[#1f1f2b] text-base font-semibold">
                {item.daily_production?.toLocaleString()}
            </td>

            {/* Apply Rate */}
            <td className="border-r border-gray-700 p-1">
                <div className="w-full text-right text-gray-200 text-base font-semibold bg-[#1f1f2b] rounded px-2 py-1">
                    {rateValue}%
                </div>
            </td>

            {/* Working Days */}
            <td className="border-r border-gray-700 px-2 py-1 text-right text-blue-300 font-bold font-mono text-base">
                {parseFloat(item.working_days || 0).toFixed(1)}
            </td>

            {/* Op Rate */}
            <td className="border-r border-gray-700 p-1">
                {rateOpen ? (
                    <select
                        className="w-full bg-[#1f1f2b] text-base text-center outline-none text-gray-200 rounded font-medium"
                        value={item.operating_rate_type}
                        onChange={(e) => {
                            handleChange(item.id, 'operating_rate_type', e.target.value);
                            setRateOpen(false);
                        }}
                        onBlur={() => setRateOpen(false)}
                        autoFocus
                    >
                        <option value="EARTH">토목</option>
                        <option value="FRAME">골조</option>
                        <option value="EXT_FIN">외부</option>
                        <option value="INT_FIN">내부</option>
                    </select>
                ) : (
                    <button
                        type="button"
                        onClick={() => setRateOpen(true)}
                        className="w-full text-base text-center text-gray-200 bg-[#1f1f2b] rounded font-medium py-1 hover:bg-white/10 transition"
                    >
                        {rateValue}%
                    </button>
                )}
            </td>

            {/* Cal Days */}
            <td className="border-r border-gray-700 px-2 py-1 text-right text-blue-300 font-bold font-mono bg-blue-900/20 text-base">
                {item.calendar_days}
                <span className="ml-1 text-sm text-blue-200 font-semibold">일</span>
            </td>

            {/* Remarks */}
            <td className="border-r border-gray-700 p-1">
                <input className="w-full text-sm outline-none p-1 text-gray-200 bg-[#1f1f2b] rounded font-medium" value={item.remarks} onChange={(e) => handleChange(item.id, 'remarks', e.target.value)} />
            </td>

            {/* Action */}
            <td className="p-1 text-center">
                <button className="text-gray-400 hover:text-red-500 transition-colors" onClick={() => handleDeleteItem(item.id)}>
                    <Trash2 size={16} />
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
    const { confirm } = useConfirm();

    if (!isOpen) return null;

    const handleCreate = () => {
        if (!label.trim()) return;
        addSnapshot(label);
        setLabel("");
        toast.success("스냅샷 저장 완료");
    };

    const handleRestore = async (id) => {
        const ok = await confirm("현재 작업 내용이 스냅샷 내용으로 대체됩니다. 계속하시겠습니까?");
        if (!ok) return;
        restoreSnapshot(id);
        toast.success("복구 완료");
        onClose();
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

    const aiOriginalRef = useRef(null);
    const [aiTargetDays, setAiTargetDays] = useState("");
    const [aiMode, setAiMode] = useState("idle"); // idle | running | success | fail | cancelled
    const [aiLogs, setAiLogs] = useState([]);
    const [aiPreviewItems, setAiPreviewItems] = useState(null);
    const [aiActiveItemId, setAiActiveItemId] = useState(null);
    const [aiSummary, setAiSummary] = useState({ savedDays: 0, remainingDays: 0 });
    const [aiShowCompare, setAiShowCompare] = useState(false);
    const [projectName, setProjectName] = useState("");
    const { confirm } = useConfirm();

    const totalCalendarDays = useMemo(() => {
        let cumulativeCPEnd = 0;
        let maxEnd = 0;
        items.forEach((item, index) => {
            const duration = parseFloat(item.calendar_days) || 0;
            const backParallel = parseFloat(item.back_parallel_days) || 0;
            const startDay = item._startDay !== undefined && item._startDay !== null
                ? item._startDay
                : (index === 0 ? 0 : cumulativeCPEnd);
            const cpEnd = startDay + duration - backParallel;
            cumulativeCPEnd = Math.max(cumulativeCPEnd, cpEnd);
            maxEnd = Math.max(maxEnd, startDay + duration);
        });
        return Math.max(0, Math.ceil(maxEnd));
    }, [items]);

    const totalCalendarMonths = useMemo(() => {
        if (!totalCalendarDays) return 0;
        return Math.round((totalCalendarDays / 30) * 10) / 10;
    }, [totalCalendarDays]);

    const totalDaysForItems = useCallback((list) => {
        let cumulativeCPEnd = 0;
        let maxEnd = 0;
        list.forEach((item, index) => {
            const duration = parseFloat(item.calendar_days) || 0;
            const backParallel = parseFloat(item.back_parallel_days) || 0;
            const startDay = item._startDay !== undefined && item._startDay !== null
                ? item._startDay
                : (index === 0 ? 0 : cumulativeCPEnd);
            const cpEnd = startDay + duration - backParallel;
            cumulativeCPEnd = Math.max(cumulativeCPEnd, cpEnd);
            maxEnd = Math.max(maxEnd, startDay + duration);
        });
        return Math.max(0, Math.ceil(maxEnd));
    }, []);

    const getCriticalIds = useCallback((list) => {
        let cumulativeCPEnd = 0;
        const criticalIds = [];
        list.forEach((item, index) => {
            const duration = parseFloat(item.calendar_days) || 0;
            const backParallel = parseFloat(item.back_parallel_days) || 0;
            const startDay = item._startDay !== undefined && item._startDay !== null
                ? item._startDay
                : (index === 0 ? 0 : cumulativeCPEnd);
            const cpEnd = startDay + duration - backParallel;
            if (cpEnd >= cumulativeCPEnd && item.remarks !== "병행작업") {
                criticalIds.push(item.id);
            }
            cumulativeCPEnd = Math.max(cumulativeCPEnd, cpEnd);
        });
        return criticalIds;
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
    }, [aiTargetDays, appendAiLog, getCriticalIds, items, operatingRates, projectName, totalDaysForItems, workDayType]);

    const handleAiCancel = useCallback(() => {
        setAiMode("cancelled");
        setAiPreviewItems(null);
        setAiActiveItemId(null);
        setAiLogs([]);
        setAiSummary({ savedDays: 0, remainingDays: 0 });
        setAiShowCompare(false);
    }, []);

    const handleAiApply = useCallback(async () => {
        if (!aiPreviewItems || aiPreviewItems.length === 0) return;
        const ok = await confirm("AI 조정안을 적용하시겠습니까?");
        if (!ok) return;
        setStoreItems(aiPreviewItems);
        handleAiCancel();
    }, [aiPreviewItems, confirm, handleAiCancel, setStoreItems]);

    const aiDisplayItems = aiPreviewItems || items;

    const [cipResult, setCipResult] = useState([]);
    const [pileResult, setPileResult] = useState([]);
    const [boredResult, setBoredResult] = useState([]);
    const [cipStandards, setCipStandards] = useState([]);
    const [pileStandards, setPileStandards] = useState([]);
    const [boredStandards, setBoredStandards] = useState([]);
    const [startDate, setStartDate] = useState("");
    const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
    const [evidenceTargetParent, setEvidenceTargetParent] = useState(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Import Modal State
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
    const [importTargetParent, setImportTargetParent] = useState(null);
    const [viewMode, setViewMode] = useState("table"); // "table" or "gantt"
    const [newMainCategory, setNewMainCategory] = useState("");

    // Dnd Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [
                fetchedData,
                rateData,
                cipData,
                pileData,
                boredData,
                projectData,
                cipStdData,
                pileStdData,
                boredStdData
            ] = await Promise.all([
                fetchScheduleItems(projectId),
                detailOperatingRate(projectId),
                fetchCIPResults(projectId),
                fetchPileResults(projectId),
                fetchBoredPileResults(projectId),
                detailProject(projectId),
                fetchCIPStandard(),
                fetchPileStandard(),
                fetchBoredPileStandard()
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

            const cipList = Array.isArray(cipData) ? cipData : (cipData.results || []);
            const pileList = Array.isArray(pileData) ? pileData : (pileData.results || []);
            const boredList = Array.isArray(boredData) ? boredData : (boredData.results || []);
            setCipResult(cipList);
            setPileResult(pileList);
            setBoredResult(boredList);
            setCipStandards(Array.isArray(cipStdData) ? cipStdData : (cipStdData.results || []));
            setPileStandards(Array.isArray(pileStdData) ? pileStdData : (pileStdData.results || []));
            setBoredStandards(Array.isArray(boredStdData) ? boredStdData : (boredStdData.results || []));
            // Start Date is NOT in Items JSON for now, assuming Project Model still holds it as metadata (User said remove from DB, but actually meaning remove from ITEM TABLE. Project table still has it? Or do we store it in JSON meta? For now let's stick to Project Start Date as it is working.)
            // User said "remove star_date and working condition and Change DB completely to JSON". 
            // He might mean store start_date in JSON too. But I'll keep it simple: UI works with Project Date.
            setStartDate(projectData.start_date || "");
            setProjectName(projectData.title || projectData.name || "");

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
                standard_code: std.code || std.standard,
                remarks: std.item_name || ""
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

    const handleDeleteItem = async (id) => {
        const ok = await confirm("삭제하시겠습니까?");
        if (!ok) return;
        deleteItem(id);
    };

    const handleDeleteCategory = async (category, categoryItems) => {
        const ok = await confirm(`${category} 대공종을 삭제하시겠습니까? (항목 ${categoryItems.length}개)`);
        if (!ok) return;
        categoryItems.forEach((item) => deleteItem(item.id));
        toast.success("대공종이 삭제되었습니다.");
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
                    onApply={handleAiApply}
                />
            ) : (
                <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-gray-700 shadow-xl bg-[#2c2c3a] relative">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <table className="w-full text-m box-border table-fixed border-collapse bg-[#2c2c3a] rounded-lg text-gray-200">
                            <colgroup>
                                <col width="30" />  {/* Drag Handle */}
                                <col width="120" /> {/* Main Category */}
                                <col width="140" /> {/* Process (Merged) */}
                                <col width="240" /> {/* Work Type */}
                                <col width="140" /> {/* Quantity Formula */}
                                <col width="60" />  {/* Unit */}
                                <col width="90" />  {/* Quantity */}
                                <col width="90" />  {/* Productivity */}
                                <col width="60" />  {/* Crew */}
                                <col width="100" /> {/* Daily Prod */}
                                <col width="80" />  {/* Apply Rate */}
                                <col width="90" />  {/* Working Days */}
                                <col width="80" />  {/* Op Rate */}
                                <col width="100" /> {/* Cal Days */}
                                <col width="220" /> {/* Remarks */}
                                <col width="45" />  {/* Action */}
                            </colgroup>
                            <thead className="bg-[#3a3a4a] text-gray-200">
                                <tr className="bg-[#2c2c3a] text-gray-300 font-medium sticky top-0 z-[2] shadow-sm border-b border-gray-700">
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
                                    <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">반영율</th>
                                    <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 text-blue-300 z-10">작업기간(W.D)</th>
                                    <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">가동율</th>

                                    <th className="sticky top-0 bg-blue-900/40 border-r border-gray-700 px-2 py-2 text-blue-200 font-bold z-10">Calender Day</th>
                                    <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10">비고</th>
                                    <th className="sticky top-0 bg-[#2c2c3a] border-r border-gray-700 px-2 py-2 z-10"></th>
                                </tr>
                            </thead>
                            <SortableContext items={items} strategy={verticalListSortingStrategy}>
                                <tbody className="divide-y divide-gray-700">
                                    {(() => {
                                        // Group items by main_category
                                        const groupedItems = items.reduce((acc, item) => {
                                            const category = item.main_category || '기타';
                                            if (!acc[category]) acc[category] = [];
                                            acc[category].push(item);
                                            return acc;
                                        }, {});

                                        // Render grouped rows
                                        return [
                                            (
                                                <tr key="add-main-category" className="bg-[#232332]">
                                                    <td colSpan="16" className="px-4 py-3">
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
                                                {/* Section Header */}
                                                <tr className="bg-gradient-to-r from-[#2c2c3a] to-[#242433] border-t border-gray-700">
                                                    <td colSpan="16" className="px-4 py-2.5">
                                                        <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1 h-5 bg-blue-400 rounded-full"></div>
                                                            <h3 className="font-bold text-gray-100 text-base tracking-tight">
                                                                {category}
                                                            </h3>
                                                            <span className="text-xs text-gray-400 bg-[#1f1f2b] px-2 py-0.5 rounded-full border border-gray-700">
                                                                {categoryItems.length}개 항목
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteCategory(category, categoryItems)}
                                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/40 text-red-200 hover:bg-red-500/10"
                                                        >
                                                            대공종 삭제
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                                <TableToolbarRow
                                                    colSpan={16}
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
                                                {/* Category Items */}
                                                {categoryItems.map((item, rowIndex) => (
                                                    <SortableRow
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
                                                    />
                                                ))}
                                            </React.Fragment>
                                            ))
                                        ];
                                    })()}
                                </tbody>
                            </SortableContext>

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
                                            <col width="100" />
                                            <col width="220" />
                                            <col width="45" />
                                        </colgroup>
                                        <tbody>
                                            <SortableRow
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
    );
}
