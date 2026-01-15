import React, { useMemo, useState } from "react";
import { Activity, Calendar, Sparkles, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { solveForCrewSize } from "../../utils/solver";
import { generateTimeline } from "./ganttUtils";
import GanttSidebar from "./GanttSidebar";
import GanttTimelineHeader from "./GanttTimelineHeader";
import GanttChartArea from "./GanttChartArea";
import ContextualBrainPopover from "./ContextualBrainPopover";

export default function GanttChart({ items, startDate, onReorder, onResize, onSmartResize }) {
    // eslint-disable-next-line no-unused-vars
    const [draggedItem, setDraggedItem] = useState(null);
    const [dateScale, setDateScale] = useState(1);
    const pixelsPerUnit = 40;

    // Popover State
    const [popover, setPopover] = useState(null); // { visible, item, oldDuration, newDuration, x, y }

    // Simulation Tooltip State
    const [simulation, setSimulation] = useState(null);

    // Tree View State
    const [expandedCategories, setExpandedCategories] = useState({});
    // eslint-disable-next-line no-unused-vars
    const [expandedProcesses, setExpandedProcesses] = useState({});

    const handleBarResizing = (itemId, duration, x, y) => {
        if (!itemId) {
            setSimulation(null);
            return;
        }
        const originalItem = items.find(i => i.id === itemId);
        if (!originalItem) return;

        const simulated = solveForCrewSize(originalItem, duration);
        setSimulation({ original: originalItem, calculated: simulated, x, y });
    };

    // Calculate Grid Data
    const { itemsWithTiming, totalDays, dailyLoads } = useMemo(() => {
        if (!items || items.length === 0) return { itemsWithTiming: [], totalDays: 0, parallelGroups: new Map(), dailyLoads: new Map() };

        const result = [];
        const groups = new Map();
        const loads = new Map();

        for (let i = 0; i < items.length; i++) {
            const originalItem = items[i];
            // Clone first to allow mutation
            const item = { ...originalItem };

            const duration = parseFloat(item.calendar_days) || 0;
            const crew = parseFloat(item.crew_size) || 0;
            let startDay;

            if (item._startDay !== undefined && item._startDay !== null) {
                startDay = item._startDay;

            } else {
                if (i === 0) startDay = 0;
                else {
                    // Safe access to result array
                    const maxPrevEnd = result.length > 0
                        ? Math.max(...result.map(r => r.startDay + r.durationDays))
                        : 0;
                    startDay = maxPrevEnd;
                }
            }

            const endDay = Math.ceil(startDay + duration);
            for (let d = Math.floor(startDay); d < endDay; d++) {
                loads.set(d, (loads.get(d) || 0) + crew);
            }

            // Push the MODIFIED clone
            result.push({ ...item, startDay, durationDays: duration });

            if (item._parallelGroup) {
                if (!groups.has(item._parallelGroup)) groups.set(item._parallelGroup, []);
                groups.get(item._parallelGroup).push(i);
            }
        }
        const maxEndDay = result.reduce((max, item) => Math.max(max, item.startDay + item.durationDays), 0);
        return { itemsWithTiming: result, totalDays: maxEndDay, parallelGroups: groups, dailyLoads: loads };
    }, [items]);

    const timeline = useMemo(() => generateTimeline(startDate, totalDays, dateScale), [startDate, totalDays, dateScale]);

    // Calculate category completion milestones
    const categoryMilestones = useMemo(() => {
        if (!itemsWithTiming || itemsWithTiming.length === 0) return [];

        const milestones = [];
        let currentCategory = null;
        let categoryEndDay = 0;
        let categoryEndIndex = 0;

        itemsWithTiming.forEach((item, index) => {
            const itemEndDay = item.startDay + item.durationDays;

            // Check if category changed or last item
            if (currentCategory && (item.main_category !== currentCategory || index === itemsWithTiming.length - 1)) {
                // Add milestone for previous category
                milestones.push({
                    category: currentCategory,
                    endDay: categoryEndDay,
                    rowIndex: categoryEndIndex
                });
            }

            // Update tracking
            if (item.main_category !== currentCategory) {
                currentCategory = item.main_category;
                categoryEndDay = itemEndDay;
                categoryEndIndex = index;
            } else {
                // Same category, update end day if this item ends later
                if (itemEndDay > categoryEndDay) {
                    categoryEndDay = itemEndDay;
                    categoryEndIndex = index;
                }
            }
        });

        // Add last category milestone
        if (currentCategory) {
            milestones.push({
                category: currentCategory,
                endDay: categoryEndDay,
                rowIndex: categoryEndIndex
            });
        }

        return milestones;
    }, [itemsWithTiming]);

    // Group items for hierarchical table with rowspan
    const groupedItems = useMemo(() => {
        if (!itemsWithTiming || itemsWithTiming.length === 0) return [];

        const groups = [];
        let currentMainCategory = null;
        let currentProcess = null;
        let mainCategoryGroup = null;
        let processGroup = null;

        itemsWithTiming.forEach((item, index) => {
            const itemStart = item.startDay;
            const itemEnd = item.startDay + item.durationDays;

            // New main category
            if (item.main_category !== currentMainCategory) {
                if (mainCategoryGroup) groups.push(mainCategoryGroup);

                currentMainCategory = item.main_category;
                currentProcess = null;
                mainCategoryGroup = {
                    mainCategory: item.main_category,
                    processes: [],
                    startIndex: index,
                    minStart: itemStart, // Init with current item
                    maxEnd: itemEnd      // Init with current item
                };
                processGroup = null;
            } else {
                // Update min/max for existing group
                if (itemStart < mainCategoryGroup.minStart) mainCategoryGroup.minStart = itemStart;
                if (itemEnd > mainCategoryGroup.maxEnd) mainCategoryGroup.maxEnd = itemEnd;
            }

            // New process within same category
            if (item.process !== currentProcess) {
                currentProcess = item.process;
                processGroup = {
                    process: item.process,
                    items: [],
                    startIndex: index
                };
                mainCategoryGroup.processes.push(processGroup);
            }

            // Add item to current process group
            processGroup.items.push({ ...item, rowIndex: index });
        });

        // Push last group
        if (mainCategoryGroup) groups.push(mainCategoryGroup);

        return groups;
    }, [itemsWithTiming]);


    // Handlers
    const handleBarDrag = (itemId, newStartDay) => {
        const newItems = items.map(item => item.id === itemId ? { ...item, _startDay: newStartDay } : item);
        onReorder(newItems);
    };

    const handleBarResize = (itemId, newDuration) => {
        if (onResize) onResize(itemId, newDuration);
    };

    return (
        <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden font-sans">

            {/* --- Toolbar --- */}
            <div className={`px-6 py-4 flex items-center justify-between bg-white border-b border-gray-100 z-20`}>
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200">
                        <Activity className="text-white" size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 tracking-tight">공사 일정 (Construction Schedule)</h2>
                        <div className="text-xs text-slate-500 font-medium flex gap-3">
                            <span className="flex items-center gap-1"><Calendar size={10} /> 시작일: {startDate || '미정'}</span>
                            <span className="w-px h-3 bg-gray-300"></span>
                            <span>전체 기간: {Math.ceil(totalDays)}일</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-gray-50 p-1 rounded-lg border border-gray-100">
                    {[1, 5, 10, 30].map(scale => (
                        <button
                            key={scale}
                            onClick={() => setDateScale(scale)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${dateScale === scale
                                ? "bg-white text-blue-600 shadow-sm ring-1 ring-gray-100"
                                : "text-gray-500 hover:text-gray-900"
                                }`}
                        >
                            {scale === 1 ? '일별' : scale === 30 ? '월별' : `${scale}일 단위`}
                        </button>
                    ))}
                </div>
            </div>

            {/* --- Main Content --- */}
            <div className="flex flex-1 min-h-0 relative">

                {/* Left Sidebar - Tree View */}
                <GanttSidebar
                    groupedItems={groupedItems}
                    expandedCategories={expandedCategories}
                    setExpandedCategories={setExpandedCategories}
                />

                {/* Right Timeline */}
                <div className="flex-1 overflow-auto bg-white relative">
                    <div style={{ minWidth: `${Math.ceil(totalDays / dateScale) * pixelsPerUnit}px` }}>

                        {/* Timeline Header */}
                        <GanttTimelineHeader
                            timeline={timeline}
                            pixelsPerUnit={pixelsPerUnit}
                        />

                        {/* Chart Area */}
                        <GanttChartArea
                            timeline={timeline}
                            dailyLoads={dailyLoads}
                            pixelsPerUnit={pixelsPerUnit}
                            dateScale={dateScale}
                            itemsWithTiming={itemsWithTiming}
                            categoryMilestones={categoryMilestones}
                            onBarDragStart={handleBarDrag}
                            onBarResize={handleBarResize}
                            onBarResizing={handleBarResizing}
                            setPopoverState={setPopover}
                        />

                    </div>
                </div>

                {/* Floating Simulation Tooltip */}
                <AnimatePresence>
                    {simulation && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="fixed z-[100] bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl rounded-2xl p-4 w-72 pointer-events-none ring-1 ring-black/5"
                            style={{ left: simulation.x + 20, top: simulation.y }}
                        >
                            <div className="flex items-center gap-2 mb-3 text-violet-600">
                                <Sparkles size={14} className="fill-violet-200 animate-pulse" />
                                <span className="text-xs font-bold uppercase tracking-widest">AI 예측 (Prediction)</span>
                            </div>

                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <div className="text-[10px] text-gray-500 uppercase font-semibold">공사기간</div>
                                    <div className="text-2xl font-black text-slate-800 tracking-tight">
                                        {simulation.calculated.calendar_days.toFixed(1)}<span className="text-sm text-gray-400 font-normal ml-1">일</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-400 line-through mb-1">{parseFloat(simulation.original.calendar_days).toFixed(1)} 일</div>
                                    <div className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">
                                        {simulation.calculated.calendar_days > simulation.original.calendar_days ? '+ 연장됨' : '- 단축됨'}
                                    </div>
                                </div>
                            </div>

                            <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent my-3"></div>

                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg ${simulation.calculated.crew_size > simulation.original.crew_size ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                                        <Users size={12} />
                                    </div>
                                    <span className="text-xs font-semibold text-gray-600">필요 인원</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-sm font-bold text-slate-900">{simulation.calculated.crew_size}</span>
                                    <span className="text-[10px] text-gray-400">명</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Contextual Brain Interaction */}
                <ContextualBrainPopover
                    data={popover}
                    onClose={() => {
                        setPopover(null);
                        setSimulation(null);
                    }}
                    onApplyCrewAdjustment={(id, dur) => {
                        const baseProd = popover?.baseProductivity || null;
                        if (onSmartResize) onSmartResize(id, dur, baseProd);
                        setPopover(null);
                        setSimulation(null);
                    }}
                />
            </div >
        </div>
    );
}