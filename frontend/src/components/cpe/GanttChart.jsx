import React, { useMemo, useState, useCallback } from "react";
import { Activity, Calendar, Sparkles, Users, Zap } from "lucide-react";
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
    const [selectedItemId, setSelectedItemId] = useState(null);
    const pixelsPerUnit = 40;

    // Refs for scrolling
    const sidebarRef = React.useRef(null);
    const chartRef = React.useRef(null);

    // Popover State
    const [popover, setPopover] = useState(null); // { visible, item, oldDuration, newDuration, x, y }

    // Simulation Tooltip State
    const [simulation, setSimulation] = useState(null);

    // Tree View State
    const [expandedCategories, setExpandedCategories] = useState({});
    // eslint-disable-next-line no-unused-vars
    const [expandedProcesses, setExpandedProcesses] = useState({});

    // Calculate Grid Data FIRST (needed for handlers)
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

    const handleItemClick = useCallback((itemId, source) => {
        setSelectedItemId(itemId);

        // Scroll Logic: Manual calculation to avoid layout breaking with scrollIntoView
        setTimeout(() => {
            if (source === 'sidebar') {
                // Scroll Chart to Bar
                const container = chartRef.current;
                const targetRow = document.getElementById(`chart-item-${itemId}`);
                const item = itemsWithTiming.find(i => i.id === itemId);

                if (container && targetRow && item) {
                    const containerRect = container.getBoundingClientRect();
                    const targetRowRect = targetRow.getBoundingClientRect();

                    // Vertical Alignment (Center Row)
                    // Note: targetRowRect is relative to viewport, containerRect is relative to viewport.
                    // scrollTop is container's current scroll.
                    const relativeTop = targetRowRect.top - containerRect.top;
                    const scrollTopTarget = container.scrollTop + relativeTop - container.clientHeight / 2 + targetRow.clientHeight / 2;

                    // Horizontal Alignment (Center Bar)
                    const barLeftPx = (item.startDay / dateScale) * pixelsPerUnit;
                    const barWidthPx = (item.durationDays / dateScale) * pixelsPerUnit;
                    const scrollLeftTarget = barLeftPx + (barWidthPx / 2) - (container.clientWidth / 2);

                    container.scrollTo({
                        top: scrollTopTarget,
                        left: scrollLeftTarget,
                        behavior: 'smooth'
                    });
                }
            } else if (source === 'chart') {
                // Scroll Sidebar to Item
                const container = sidebarRef.current;
                const target = document.getElementById(`sidebar-item-${itemId}`);
                if (container && target) {
                    const containerRect = container.getBoundingClientRect();
                    const targetRect = target.getBoundingClientRect();

                    const relativeTop = targetRect.top - containerRect.top;

                    container.scrollTo({
                        top: container.scrollTop + relativeTop - container.clientHeight / 2 + target.clientHeight / 2,
                        behavior: 'smooth'
                    });
                }
            }
        }, 50);
    }, [itemsWithTiming, dateScale]);

    const handleBarResizing = useCallback((itemId, duration, x, y) => {
        if (!itemId) {
            setSimulation(null);
            return;
        }
        const originalItem = items.find(i => i.id === itemId);
        if (!originalItem) return;

        // Safe Parsing
        const workload = parseFloat(originalItem.total_workload) || parseFloat(originalItem.quantity) || 0;
        const prod = parseFloat(originalItem.productivity) || 0.1; // Prevent zero division
        const crew = parseFloat(originalItem.crew_size) || 1;

        // Calculate impacts
        const newCrewSize = duration > 0 && prod > 0 ? (workload / (duration * prod)).toFixed(1) : "0.0";
        const newProd = duration > 0 && crew > 0 ? (workload / (duration * crew)).toFixed(1) : "0.0";

        setSimulation({
            original: originalItem,
            newDuration: duration,
            impact: {
                start: originalItem.startDay,
                end: originalItem.startDay + duration,
                crew: newCrewSize,
                prod: newProd
            },
            x,
            y
        });
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
    const handleBarDrag = useCallback((itemId, newStartDay) => {
        const newItems = items.map(item => item.id === itemId ? { ...item, _startDay: newStartDay } : item);
        onReorder(newItems);
    }, [items, onReorder]);

    const handleBarResize = useCallback((itemId, newDuration, x, y) => {
        // Trigger Popover for Logic Choice
        const item = items.find(i => i.id === itemId);
        if (!item) return;

        // Use passed coords or fallback
        const finalX = x || window.innerWidth / 2;
        const finalY = y || window.innerHeight / 2;

        // Safe Parsing
        const workload = parseFloat(item.total_workload) || parseFloat(item.quantity) || 0;
        const prod = parseFloat(item.productivity) || 0.1;
        const crew = parseFloat(item.crew_size) || 1;

        // Calculate potential impacts for Popover display
        const newCrewSize = newDuration > 0 && prod > 0 ? (workload / (newDuration * prod)).toFixed(1) : "0.0";
        const newProdResult = newDuration > 0 && crew > 0 ? (workload / (newDuration * crew)).toFixed(1) : "0.0";

        setSimulation(null); // Clear live tooltip first

        // Defer Popover trigger to ensure state flush
        setTimeout(() => {
            setPopover({
                visible: true,
                item,
                oldDuration: item.calendar_days,
                newDuration: newDuration,
                impact: {
                    crew: newCrewSize,
                    prod: newProdResult
                },
                x: finalX,
                y: finalY
            });
        }, 10);
    }, [items]);

    return (
        <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden font-sans">

            {/* --- Toolbar --- */}
            <div className={`px-6 py-4 flex items-center justify-between bg-white border-b border-gray-100 z-[2]`}>
                <div className="flex items-center gap-4">
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
                    containerRef={sidebarRef}
                    groupedItems={groupedItems}
                    expandedCategories={expandedCategories}
                    setExpandedCategories={setExpandedCategories}
                    selectedItemId={selectedItemId}
                    onItemClick={handleItemClick}
                />

                {/* Right Timeline */}
                <div ref={chartRef} className="flex-1 overflow-auto bg-white relative">
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
                            selectedItemId={selectedItemId}
                            onItemClick={handleItemClick}
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
                            className="fixed z-[100] bg-white/90 backdrop-blur-xl border border-violet-100 shadow-xl rounded-xl p-3 w-64 pointer-events-none ring-1 ring-black/5"
                            style={{ left: simulation.x + 20, top: simulation.y }}
                        >
                            <div className="flex justify-between items-center mb-2 border-b border-gray-100 pb-2">
                                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">New Duration</div>
                                <div className="text-xl font-black text-slate-800">
                                    {simulation.newDuration.toFixed(1)}<span className="text-sm font-medium text-gray-400 ml-0.5">d</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-violet-50 rounded-lg p-2">
                                    <div className="text-[9px] text-violet-600 mb-0.5">If Crew Adjust</div>
                                    <div className="flex items-center gap-1 font-bold text-violet-900">
                                        <Users size={12} />
                                        <span>{simulation.impact.crew}</span>
                                    </div>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-2">
                                    <div className="text-[9px] text-blue-600 mb-0.5">If Prod Adjust</div>
                                    <div className="flex items-center gap-1 font-bold text-blue-900">
                                        <Zap size={12} />
                                        <span>{simulation.impact.prod}</span>
                                    </div>
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
                        if (onResize) onResize(id, dur, 'crew');
                        setPopover(null);
                        setSimulation(null);
                    }}
                    onApplyProdAdjustment={(id, dur) => {
                        if (onResize) onResize(id, dur, 'prod');
                        setPopover(null);
                        setSimulation(null);
                    }}
                />
            </div >
        </div>
    );
}