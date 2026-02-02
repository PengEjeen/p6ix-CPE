import React, { useMemo, useState, useCallback } from "react";
import { Activity, Calendar, Sparkles, Users, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { solveForCrewSize } from "../../utils/solver";
import { useScheduleStore } from "../../stores/scheduleStore";
import { generateTimeline } from "./ganttUtils";
import GanttSidebar from "./GanttSidebar";
import GanttTimelineHeader from "./GanttTimelineHeader";
import GanttChartArea from "./GanttChartArea";
import ContextualBrainPopover from "./ContextualBrainPopover";
import OverlapResolvePopover from "./OverlapResolvePopover";

export default function GanttChart({
    items,
    links,
    startDate,
    onResize,
    onSmartResize,
    aiPreviewItems,
    aiOriginalItems,
    aiActiveItemId,
    subTasks,
    onCreateSubtask,
    onUpdateSubtask,
    onDeleteSubtask
}) {
    // DEBUG: Log when items change
    React.useEffect(() => {
        console.log('[GanttChart] Items prop changed! Count:', items.length);
        const earth1 = items.find(i => i.id === 'earth-1');
        if (earth1) {
            console.log('[GanttChart] earth-1 parallel periods:', {
                front: earth1.front_parallel_days,
                back: earth1.back_parallel_days
            });
        }
    }, [items]);

    // eslint-disable-next-line no-unused-vars
    const [draggedItem, setDraggedItem] = useState(null);
    const [dateScale, setDateScale] = useState(1);
    const [hasUserScaled, setHasUserScaled] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [selectedLinkId, setSelectedLinkId] = useState(null);
    const [linkMode, setLinkMode] = useState(false);
    const [linkDraft, setLinkDraft] = useState(null); // { fromId, fromAnchor }
    const [linkEditor, setLinkEditor] = useState(null); // { id, x, y }
    const [subtaskMode, setSubtaskMode] = useState(false);
    const [selectedSubtaskId, setSelectedSubtaskId] = useState(null);
    const pixelsPerUnit = 40;

    // Refs for scrolling
    const sidebarRef = React.useRef(null);
    const chartRef = React.useRef(null);

    // Popover State
    const [popover, setPopover] = useState(null); // { visible, item, oldDuration, newDuration, x, y }
    const [overlapPopover, setOverlapPopover] = useState(null);  // For drag overlap

    // Simulation Tooltip State
    const [simulation, setSimulation] = useState(null);

    // Tree View State
    const [expandedCategories, setExpandedCategories] = useState({});
    // eslint-disable-next-line no-unused-vars
    // eslint-disable-next-line no-unused-vars
    const [expandedProcesses, setExpandedProcesses] = useState({});

    const [isScrolling, setIsScrolling] = useState(false);
    const handleScroll = useCallback(() => {
        setIsScrolling(true);
        clearTimeout(window.ganttChartScrollTimeout);
        window.ganttChartScrollTimeout = setTimeout(() => {
            setIsScrolling(false);
        }, 1000);
    }, []);

    // Calculate Grid Data FIRST (needed for handlers)
    const { itemsWithTiming, totalDays, dailyLoads } = useMemo(() => {
        if (!items || items.length === 0) return { itemsWithTiming: [], totalDays: 0, parallelGroups: new Map(), dailyLoads: new Map() };

        const result = [];
        const groups = new Map();
        const loads = new Map();

        // Track the cumulative CRITICAL PATH end across all tasks
        let cumulativeCPEnd = 0;

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
                if (i === 0) {
                    startDay = 0;
                } else {
                    // CRITICAL FIX: Use the cumulative CP end from ALL previous tasks
                    // This ensures tasks align with CP only, not with parallel task ends
                    startDay = cumulativeCPEnd;
                }
            }

            // Calculate this task's CP end (accounting for front/back parallel)
            // CP Start = startDay + front_parallel_days
            // CP End = startDay + duration - back_parallel_days
            const frontParallel = parseFloat(item.front_parallel_days) || 0;
            const backParallel = parseFloat(item.back_parallel_days) || 0;
            const cpEnd = startDay + duration - backParallel;

            // Update cumulative CP end tracker
            // Only advance if this task's CP extends beyond the current cumulative CP
            cumulativeCPEnd = Math.max(cumulativeCPEnd, cpEnd);

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

    const handleSetScale = useCallback((scale) => {
        setHasUserScaled(true);
        setDateScale(scale);
    }, []);

    React.useEffect(() => {
        if (hasUserScaled) return;
        if (!chartRef.current || totalDays <= 0) return;

        const containerWidth = chartRef.current.clientWidth;
        if (!containerWidth) return;

        const requiredScale = (totalDays * pixelsPerUnit) / containerWidth;
        const scaleOptions = [1, 5, 10, 30];
        const nextScale = scaleOptions.find((s) => s >= requiredScale) || scaleOptions[scaleOptions.length - 1];

        if (nextScale !== dateScale) {
            setDateScale(nextScale);
        }
    }, [hasUserScaled, totalDays, pixelsPerUnit, dateScale]);

    const addLink = useScheduleStore((state) => state.addLink);
    const updateLink = useScheduleStore((state) => state.updateLink);
    const deleteLink = useScheduleStore((state) => state.deleteLink);

    const deriveLinkType = (fromAnchor, toAnchor) => {
        if (fromAnchor === "start" && toAnchor === "start") return "SS";
        if (fromAnchor === "end" && toAnchor === "end") return "FF";
        if (fromAnchor === "start" && toAnchor === "end") return "SF";
        return "FS";
    };

    const handleLinkAnchorClick = useCallback((itemId, anchor) => {
        if (!linkMode) return;
        if (!linkDraft) {
            setLinkDraft({ fromId: itemId, fromAnchor: anchor });
            return;
        }
        if (linkDraft.fromId === itemId && linkDraft.fromAnchor === anchor) {
            setLinkDraft(null);
            return;
        }

        const linkType = deriveLinkType(linkDraft.fromAnchor, anchor);
        const newLink = {
            id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            from: linkDraft.fromId,
            to: itemId,
            type: linkType,
            lag: 0
        };

        const alreadyExists = Array.isArray(links) && links.some(
            (link) =>
                link.from === newLink.from &&
                link.to === newLink.to &&
                link.type === newLink.type &&
                (parseFloat(link.lag) || 0) === 0
        );
        if (!alreadyExists) {
            addLink(newLink);
        }
        setLinkDraft(null);
    }, [addLink, linkDraft, linkMode, links]);

    const handleCreateLink = useCallback((fromId, fromAnchor, toId, toAnchor) => {
        if (!fromId || !toId) return;
        if (fromId === toId && fromAnchor === toAnchor) return;
        const linkType = deriveLinkType(fromAnchor, toAnchor);
        const newLink = {
            id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            from: fromId,
            to: toId,
            type: linkType,
            lag: 0
        };
        const alreadyExists = Array.isArray(links) && links.some(
            (link) =>
                link.from === newLink.from &&
                link.to === newLink.to &&
                link.type === newLink.type &&
                (parseFloat(link.lag) || 0) === 0
        );
        if (!alreadyExists) {
            addLink(newLink);
        }
    }, [addLink, links]);

    const handleLinkClick = useCallback((linkId, x, y) => {
        setSelectedLinkId(linkId);
        setLinkEditor({ id: linkId, x, y });
    }, []);

    const handleLinkEditorClose = useCallback(() => {
        setLinkEditor(null);
        setSelectedLinkId(null);
    }, []);

    React.useEffect(() => {
        if (!linkMode) {
            setLinkDraft(null);
        }
    }, [linkMode]);

    React.useEffect(() => {
        if (!aiActiveItemId) return;
        handleItemClick(aiActiveItemId, 'sidebar');
    }, [aiActiveItemId, handleItemClick]);

    const handleCreateSubtask = useCallback((itemId, startDay, durationDays) => {
        if (onCreateSubtask) onCreateSubtask(itemId, startDay, durationDays);
    }, [onCreateSubtask]);

    const handleUpdateSubtask = useCallback((id, updates) => {
        if (onUpdateSubtask) onUpdateSubtask(id, updates);
    }, [onUpdateSubtask]);

    const handleDeleteSubtask = useCallback((id) => {
        if (onDeleteSubtask) onDeleteSubtask(id);
        setSelectedSubtaskId((prev) => (prev === id ? null : prev));
    }, [onDeleteSubtask]);

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
        console.log('=== [DRAG START] ===');
        console.log('[DRAG] Item ID:', itemId, 'New Start:', newStartDay);

        const item = items.find(i => i.id === itemId);
        if (!item) return;

        const duration = parseFloat(item.calendar_days) || 0;
        const newEnd = newStartDay + duration;

        console.log('[DRAG] Item:', item.process, '-', item.work_type);
        console.log('[DRAG] Duration:', duration, 'New End:', newEnd);
        console.log('[DRAG] Current parallel periods:', {
            front: item.front_parallel_days,
            back: item.back_parallel_days
        });

        // Check for overlaps with ALL other tasks
        let overlapInfo = null;

        console.log('[DRAG] Checking overlaps with all tasks...');
        itemsWithTiming.forEach((otherItem) => {
            if (otherItem.id === itemId) return; // Skip self

            const otherStart = otherItem.startDay;
            const otherEnd = otherItem.startDay + otherItem.durationDays;

            console.log(`[DRAG] Checking ${otherItem.process}-${otherItem.work_type}:`, {
                otherStart,
                otherEnd,
                overlap: newStartDay < otherEnd && newEnd > otherStart,
                otherParallel: {
                    front: otherItem.front_parallel_days,
                    back: otherItem.back_parallel_days
                }
            });

            // Check if there's time overlap
            if (newStartDay < otherEnd && newEnd > otherStart) {
                const overlapStart = Math.max(newStartDay, otherStart);
                const overlapEnd = Math.min(newEnd, otherEnd);
                const overlapDays = overlapEnd - overlapStart;

                console.log(`[DRAG] OVERLAP FOUND with ${otherItem.process}-${otherItem.work_type}! Days:`, overlapDays);

                // Store first overlap found
                if (!overlapInfo) {
                    overlapInfo = {
                        visible: true,
                        currentTask: {
                            id: item.id,
                            name: `${item.process} - ${item.work_type}`,
                            start: newStartDay,
                            end: newEnd,
                            // CRITICAL: Pass existing parallel days to prevent overwriting
                            front_parallel_days: item.front_parallel_days || 0,
                            back_parallel_days: item.back_parallel_days || 0
                        },
                        overlappingTask: {
                            id: otherItem.id,
                            name: `${otherItem.process} - ${otherItem.work_type}`,
                            start: otherStart,
                            end: otherEnd,
                            // CRITICAL: Pass existing parallel days to prevent overwriting
                            front_parallel_days: otherItem.front_parallel_days || 0,
                            back_parallel_days: otherItem.back_parallel_days || 0
                        },
                        overlapDays: overlapDays,
                        draggedItemId: itemId,
                        newStartDay: newStartDay
                    };
                }
            }
        });

        if (overlapInfo) {
            console.log('[DRAG] Result: OVERLAP → Showing popup');
            setOverlapPopover(overlapInfo);
        } else {
            console.log('[DRAG] Result: NO OVERLAP → Should clear grey');
            console.log('[DRAG] What should we clear?');

            // TODO: Figure out which tasks to clear

            // Atomic update for Undo/Redo consistency
            useScheduleStore.getState().resolveDragOverlap(itemId, newStartDay, [
                { id: itemId, front: 0, back: 0 }
            ]);
        }
        console.log('=== [DRAG END] ===');
    }, [items, itemsWithTiming]);

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
                            <div className="flex items-center gap-3">
                                {/* Date Scale Controls */}
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                                    <Calendar size={14} className="text-gray-500" />
                                    <span className="text-xs font-medium text-gray-600">Scale:</span>
                                    {[1, 5, 10, 30].map(scale => (
                                        <button
                                            key={scale}
                                            onClick={() => handleSetScale(scale)}
                                            className={`px-2 py-0.5 text-xs rounded transition-all ${dateScale === scale
                                                ? 'bg-violet-500 text-white font-bold'
                                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                                }`}
                                        >
                                            {scale}d
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => setLinkMode((prev) => !prev)}
                                        className={`px-3 py-1 text-xs rounded-full transition-all font-semibold border ${linkMode
                                            ? 'bg-slate-900 text-amber-300 border-amber-400/60 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
                                            }`}
                                    >
                                        링크 편집
                                    </button>
                                    {linkDraft && (
                                        <span className="text-[10px] text-amber-600 font-semibold tracking-wide">대상 선택</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => setSubtaskMode((prev) => !prev)}
                                        className={`px-3 py-1 text-xs rounded-full transition-all font-semibold border ${subtaskMode
                                            ? 'bg-slate-900 text-emerald-300 border-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
                                            }`}
                                    >
                                        부공종 추가
                                    </button>
                                    {subtaskMode && (
                                        <span className="text-[10px] text-emerald-600 font-semibold tracking-wide">드래그해서 그리기</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-gray-50 p-1 rounded-lg border border-gray-100">
                    {[1, 5, 10, 30].map(scale => (
                        <button
                            key={scale}
                            onClick={() => handleSetScale(scale)}
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
                    aiPreviewItems={aiPreviewItems}
                    aiOriginalItems={aiOriginalItems}
                    aiActiveItemId={aiActiveItemId}
                />

                {/* Right Timeline */}
                <div
                    ref={chartRef}
                    className={`scroll-container flex-1 overflow-auto bg-white relative ${isScrolling ? 'scrolling' : ''}`}
                    onScroll={handleScroll}
                >
                    <div style={{ minWidth: `${Math.ceil(totalDays / dateScale) * pixelsPerUnit}px` }}>

                        {/* Timeline Header */}
                        <GanttTimelineHeader
                            timeline={timeline}
                            pixelsPerUnit={pixelsPerUnit}
                            dateScale={dateScale}
                        />

                        {/* Chart Area */}
                        <GanttChartArea
                            timeline={timeline}
                            dailyLoads={dailyLoads}
                            pixelsPerUnit={pixelsPerUnit}
                            dateScale={dateScale}
                            itemsWithTiming={itemsWithTiming}
                            links={links}
                            categoryMilestones={categoryMilestones}
                            onBarDragStart={handleBarDrag}
                            onBarResize={handleBarResize}
                            onBarResizing={handleBarResizing}
                            setPopoverState={setPopover}
                            selectedItemId={selectedItemId}
                            onItemClick={handleItemClick}
                            linkMode={linkMode}
                            onLinkAnchorClick={handleLinkAnchorClick}
                            onLinkClick={handleLinkClick}
                            selectedLinkId={selectedLinkId}
                            aiPreviewItems={aiPreviewItems}
                            aiOriginalItems={aiOriginalItems}
                            aiActiveItemId={aiActiveItemId}
                            onCreateLink={handleCreateLink}
                            subtaskMode={subtaskMode}
                            subTasks={subTasks}
                            selectedSubtaskId={selectedSubtaskId}
                            onSelectSubtask={setSelectedSubtaskId}
                            onCreateSubtask={handleCreateSubtask}
                            onUpdateSubtask={handleUpdateSubtask}
                            onDeleteSubtask={handleDeleteSubtask}
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
                            className="fixed z-[100] bg-white/90 backdrop-blur-xl border border-violet-100 shadow-xl rounded-2xl p-5 w-96 pointer-events-none ring-1 ring-black/5"
                            style={{ left: simulation.x + 20, top: simulation.y }}
                        >
                            <div className="flex justify-between items-center mb-2 border-b border-gray-100 pb-2">
                                <div className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">New Duration</div>
                                <div className="text-3xl font-black text-slate-800">
                                    {simulation.newDuration.toFixed(1)}<span className="text-lg font-medium text-gray-400 ml-0.5">d</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-violet-50 rounded-2xl p-4">
                                    <div className="text-[11px] text-violet-600 mb-1">If Crew Adjust</div>
                                    <div className="flex items-center gap-2 font-bold text-violet-900">
                                        <Users size={16} />
                                        <span>{simulation.impact.crew}</span>
                                    </div>
                                </div>
                                <div className="bg-blue-50 rounded-2xl p-4">
                                    <div className="text-[11px] text-blue-600 mb-1">If Prod Adjust</div>
                                    <div className="flex items-center gap-2 font-bold text-blue-900">
                                        <Zap size={16} />
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

                {/* Overlap Resolution Popup (Drag Only) */}
                <OverlapResolvePopover
                    data={overlapPopover}
                    onClose={() => setOverlapPopover(null)}
                    onSelectCurrentAsCP={() => {
                        if (!overlapPopover) return;

                        const { currentTask, overlappingTask, overlapDays, draggedItemId, newStartDay } = overlapPopover;
                        const currentStart = newStartDay;
                        const overlappingStart = overlappingTask.start;

                        const updates = [];
                        if (currentStart < overlappingStart) {
                            // A starts before B
                            // A is CP (Current) → Clear A's back
                            // B becomes parallel (Overlapping) → Set B's front
                            updates.push({ id: currentTask.id, back: 0 }); // CLEAR A's back
                            updates.push({ id: overlappingTask.id, front: overlapDays }); // SET B's front
                        } else {
                            // A starts after B (B -> A)
                            // A is CP (Current) → Clear A's front
                            // B becomes parallel (Overlapping) → Set B's back
                            updates.push({ id: currentTask.id, front: 0 }); // CLEAR A's front
                            updates.push({ id: overlappingTask.id, back: overlapDays }); // SET B's back
                        }

                        useScheduleStore.getState().resolveDragOverlap(draggedItemId, newStartDay, updates);
                        setOverlapPopover(null);
                    }}
                    onSelectOtherAsCP={() => {
                        if (!overlapPopover) return;

                        const { currentTask, overlappingTask, overlapDays, draggedItemId, newStartDay } = overlapPopover;
                        const currentStart = newStartDay;
                        const overlappingStart = overlappingTask.start;

                        const updates = [];
                        if (currentStart < overlappingStart) {
                            // A starts before B
                            // B is CP (Overlapping) → Clear B's front
                            // A becomes parallel (Current) → Set A's back
                            updates.push({ id: overlappingTask.id, front: 0 }); // CLEAR B's front
                            updates.push({ id: currentTask.id, back: overlapDays }); // SET A's back
                        } else {
                            // A starts after B (B -> A)
                            // B is CP (Overlapping) → Clear B's back
                            // A becomes parallel (Current) → Set A's front
                            updates.push({ id: overlappingTask.id, back: 0 }); // CLEAR B's back
                            updates.push({ id: currentTask.id, front: overlapDays }); // SET A's front
                        }

                        useScheduleStore.getState().resolveDragOverlap(draggedItemId, newStartDay, updates);
                        setOverlapPopover(null);
                    }}
                />

                {linkEditor && (
                    <div
                        className="fixed z-[120] rounded-2xl p-6 w-80 backdrop-blur-xl border border-amber-300/40 shadow-[0_20px_60px_rgba(15,23,42,0.35)] bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-slate-800/95"
                        style={{ left: linkEditor.x + 12, top: linkEditor.y + 12 }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-[12px] uppercase tracking-[0.2em] text-amber-300/80 font-semibold">Link Editor</div>
                            <div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]"></div>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[12px] text-slate-300 mb-1">유형</label>
                                <div className="grid grid-cols-4 gap-1 bg-slate-900/60 rounded-full p-1 border border-slate-700/60">
                                    {["FS", "SS", "FF", "SF"].map((type) => {
                                        const isActive = (links || []).find(l => l.id === linkEditor.id)?.type === type;
                                        return (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => updateLink(linkEditor.id, { type })}
                                                className={`text-[12px] py-1.5 rounded-full transition-all ${isActive
                                                    ? "bg-amber-400 text-slate-900 font-bold shadow-[0_0_10px_rgba(251,191,36,0.45)]"
                                                    : "text-slate-300 hover:text-white"
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[12px] text-slate-300 mb-1">Lag(일)</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        className="w-full bg-slate-900/70 border border-slate-700/60 rounded-lg px-3 py-2.5 text-base text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                                        type="number"
                                        value={(links || []).find(l => l.id === linkEditor.id)?.lag ?? 0}
                                        onChange={(e) => updateLink(linkEditor.id, { lag: parseFloat(e.target.value) || 0 })}
                                    />
                                    <span className="text-[12px] text-slate-400">d</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-between mt-4">
                            <button
                                type="button"
                                className="text-[13px] text-rose-300 hover:text-rose-200 font-semibold"
                                onClick={() => {
                                    deleteLink(linkEditor.id);
                                    handleLinkEditorClose();
                                }}
                            >
                                삭제
                            </button>
                            <button
                                type="button"
                                className="text-[13px] text-slate-300 hover:text-white font-semibold"
                                onClick={handleLinkEditorClose}
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                )}
            </div >
        </div >
    );
}
