import React, { useMemo, useState, useEffect } from "react";
import { GripVertical, AlertCircle, Users, Calendar, Activity, Sparkles, Zap, ArrowRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { solveForCrewSize } from "../../utils/solver";

// --- Design Tokens ---
const TOKENS = {
    colors: {
        primary: "bg-blue-600",
        aiAccent: "bg-violet-500", // The "Magic" Color
        aiGradient: "bg-gradient-to-r from-violet-500 to-fuchsia-500",
        glass: "bg-white/80 backdrop-blur-md border border-white/20",
        slate: "bg-slate-900",
        textMain: "text-slate-800"
    }
};

// Helper: Generate week/month grid labels based on date scale
const generateTimeline = (startDate, totalDays, dateScale = 1) => {
    if (!startDate || totalDays <= 0) return { months: [], weeks: [], days: [] };

    const start = new Date(startDate);
    const months = [];
    const days = [];

    const totalUnits = Math.ceil(totalDays / dateScale);

    let currentDate = new Date(start);
    let currentMonth = null;

    // Generate units based on scale
    for (let unit = 0; unit < totalUnits; unit++) {
        const dayNumber = unit * dateScale;
        const unitDate = new Date(start);
        unitDate.setDate(unitDate.getDate() + dayNumber);

        const monthKey = `${unitDate.getFullYear()}-${unitDate.getMonth()}`;

        // Track months
        if (monthKey !== currentMonth) {
            months.push({
                key: monthKey,
                label: `${unitDate.getFullYear()}.${String(unitDate.getMonth() + 1).padStart(2, '0')}`,
                startUnit: unit,
                count: 1
            });
            currentMonth = monthKey;
        } else if (months.length > 0) {
            months[months.length - 1].count++;
        }

        // Generate day/week labels based on scale
        let label;
        if (dateScale === 1) {
            label = unitDate.getDate().toString();
        } else if (dateScale === 5) {
            label = `${Math.floor(unit / (7 / dateScale)) + 1}주`;
        } else if (dateScale === 10) {
            const dekad = Math.floor((unitDate.getDate() - 1) / 10);
            label = ['상순', '중순', '하순'][dekad] || `${unit * 10 + 1}일~`;
        } else if (dateScale === 30) {
            label = `${unitDate.getMonth() + 1}월`;
        } else {
            label = `${dayNumber + 1}일`;
        }

        days.push({
            date: unitDate,
            dayOfMonth: label,
            actualDay: dayNumber
        });
    }

    return { months, weeks: [], days };
};

// Color mapping by category (Updated for Professional Vibe)
const getCategoryColor = (mainCategory) => {
    const lower = mainCategory ? mainCategory.toLowerCase() : "";
    if (lower.includes('토공') || lower.includes('준비')) return 'bg-slate-500';
    if (lower.includes('골조')) return 'bg-blue-600';
    if (lower.includes('마감')) return 'bg-emerald-500';
    if (lower.includes('mep')) return 'bg-violet-500';
    if (lower.includes('조경')) return 'bg-amber-500';
    return 'bg-blue-400';
};

// --- Sub-Component: Smart Gantt Bar ---
const SmartGanttBar = ({ item, startDay, durationDays, pixelsPerUnit, dateScale, onBarDragStart, onBarResize, onResizing, setPopoverState, redStartDay, redEndDay }) => {
    const [isResizing, setIsResizing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Temp states for live preview
    const [tempDuration, setTempDuration] = useState(null);
    const [tempStartDay, setTempStartDay] = useState(null);

    const effectiveStartDay = tempStartDay !== null ? tempStartDay : startDay;
    const effectiveDuration = tempDuration !== null ? tempDuration : durationDays;

    const leftPx = (effectiveStartDay / dateScale) * pixelsPerUnit;
    const widthPx = Math.max((effectiveDuration / dateScale) * pixelsPerUnit, 20);
    const originalLeftPx = (startDay / dateScale) * pixelsPerUnit; // For Ghost Bar

    const color = getCategoryColor(item.main_category);
    // Mock progress for visual if not present
    const progress = item.progress || Math.min(100, Math.random() * 100);

    // --- Drag Logic ---
    const handleBarDrag = (e) => {
        if (e.target.classList.contains('resize-handle')) return;

        setIsDragging(true);
        const startX = e.clientX;
        const startLeftPx = leftPx;

        const handleMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const newLeftPx = Math.max(0, startLeftPx + deltaX);
            const newStartDay = Math.round((newLeftPx / pixelsPerUnit) * dateScale);
            setTempStartDay(newStartDay);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            if (tempStartDay !== null) {
                onBarDragStart(item.id, tempStartDay);
                setTempStartDay(null);
            }
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // --- Resize Logic ---
    const handleResizeStart = (e) => {
        e.stopPropagation();
        setIsResizing(true);
        const startX = e.clientX;
        const startWidth = widthPx;

        const handleMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const newWidthPx = Math.max(20, startWidth + deltaX);
            const newDuration = Math.max(1, Math.round((newWidthPx / pixelsPerUnit) * dateScale));
            setTempDuration(newDuration);
            if (onResizing) {
                onResizing(item.id, newDuration, moveEvent.clientX, moveEvent.clientY);
            }
        };

        const handleMouseUp = (moveEvent) => {
            setIsResizing(false);
            if (tempDuration !== null) {
                const isShortened = tempDuration < durationDays;
                onBarResize(item.id, tempDuration);

                // Trigger "Contextual Brain" Popover if shortened
                if (isShortened) {
                    setPopoverState({
                        visible: true,
                        item: item,
                        oldDuration: durationDays,
                        newDuration: tempDuration,
                        baseProductivity: item.productivity,
                        x: moveEvent.clientX,
                        y: moveEvent.clientY
                    });
                } else {
                    setPopoverState(null);
                }

                setTempDuration(null);
                if (onResizing) onResizing(null);
            }
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div className="relative h-11 border-b border-gray-50/50 group/row hover:bg-slate-50 transition-colors">

            {/* Task Label (Floating Above) */}
            <div
                className="absolute top-0 text-[10px] font-bold text-slate-800 truncate px-1 whitespace-nowrap pointer-events-none z-10"
                style={{
                    left: `${leftPx}px`,
                    width: 'max-content'
                }}
            >
                {item.process} - {item.work_type}
            </div>

            {/* Ghost Bar (Reference) */}
            {isDragging && (
                <div
                    className={`absolute top-2.5 h-6 rounded bg-gray-200 border border-dashed border-gray-400 opacity-50 pointer-events-none`}
                    style={{ left: `${originalLeftPx}px`, width: `${widthPx}px` }}
                />
            )}

            {/* Smart Active Bar (Node Style) */}
            <div
                className={`absolute top-2 h-7 flex items-center cursor-grab z-10`}
                style={{
                    left: `${leftPx}px`,
                    width: `${widthPx}px`,
                }}
                onMouseDown={handleBarDrag}
            >
                {/* 1. Multi-segment Line (Grey-Red-Grey) */}
                {(() => {
                    const taskEnd = startDay + durationDays;
                    const relRedStart = Math.min(durationDays, Math.max(0, redStartDay - startDay));
                    const relRedEnd = Math.min(durationDays, Math.max(relRedStart, redEndDay - startDay));
                    const s1 = (relRedStart / durationDays) * 100;
                    const s2 = ((relRedEnd - relRedStart) / durationDays) * 100;
                    const s3 = 100 - (s1 + s2);

                    return (
                        <div className={`absolute top-1/2 left-0 right-0 h-1.5 -translate-y-1/2 rounded-full overflow-hidden flex shadow-sm ring-1 ring-black/5
                            ${isDragging || isResizing ? 'ring-2 ring-violet-500' : ''}`}>
                            {s1 > 0 && <div className="h-full bg-slate-400" style={{ width: `${s1}%` }} />}
                            {s2 > 0 && <div className="h-full bg-red-600" style={{ width: `${s2}%` }} />}
                            {s3 > 0 && <div className="h-full bg-slate-400" style={{ width: `${s3}%` }} />}
                            {s1 <= 0 && s2 <= 0 && s3 <= 0 && <div className="h-full w-full bg-slate-400" />}
                        </div>
                    );
                })()}

                {/* 2. Start Node (Circle) */}
                <div className={`absolute left-0 w-3.5 h-3.5 bg-white border-2 border-slate-500 rounded-full shadow-sm -translate-x-1/2 z-20`}></div>

                {/* 3. End Node (Circle & Resize Handle) */}
                <motion.div
                    className="absolute right-0 w-3.5 h-3.5 bg-white border-2 border-slate-500 rounded-full shadow-sm translate-x-1/2 cursor-ew-resize hover:scale-125 hover:border-violet-600 transition-all z-20 resize-handle"
                    onMouseDown={handleResizeStart}
                >
                    {/* Inner Dot for visual grip */}
                    <div className="absolute inset-0.5 bg-slate-200 rounded-full pointer-events-none"></div>
                </motion.div>
            </div>

        </div>
    );
};

// --- Sub-Component: Contextual Brain Popover (AI Suggestions) ---
const ContextualBrainPopover = ({ data, onClose, onApplyCrewAdjustment }) => {
    if (!data || !data.visible) return null;

    const savedDays = data.oldDuration - data.newDuration;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed z-[200] w-80 bg-white/90 backdrop-blur-xl border border-violet-100 rounded-2xl shadow-2xl overflow-hidden font-sans"
                style={{ left: data.x - 300 > 0 ? data.x - 300 : data.x + 20, top: data.y - 10 }} // Simple smart positioning
            >
                {/* Sleek Header */}
                <div className="bg-gradient-to-r from-violet-50 to-indigo-50 px-4 py-3 border-b border-violet-100 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-violet-700">
                        <Sparkles size={16} className="text-violet-500 fill-violet-200" />
                        <span className="font-bold text-xs tracking-wider uppercase">AI 분석</span>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={14} />
                    </button>
                </div>

                <div className="p-4">
                    <div className="text-sm text-gray-700 mb-3">
                        공사기간이 <strong className="text-gray-900">{savedDays.toFixed(1)}일</strong> 단축되었습니다.
                        <br />작업량을 어떻게 조정하시겠습니까?
                    </div>

                    <div className="space-y-2">
                        {/* Primary Option: Increase Crew */}
                        <button
                            className="w-full group relative flex items-center justify-between p-3 rounded-xl border border-violet-200 bg-violet-50 hover:bg-violet-100 transition-all text-left"
                            onClick={() => onApplyCrewAdjustment(data.item.id, data.newDuration)}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-violet-200 rounded-lg text-violet-700 group-hover:scale-110 transition-transform">
                                    <Users size={16} />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-violet-900">인원(Crew) 충원</div>
                                    <div className="text-[10px] text-violet-600">목표 기간에 맞춰 필요 인원 자동 계산</div>
                                </div>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <ArrowRight size={14} className="text-violet-500" />
                            </div>
                        </button>

                        {/* Secondary Option: Overtime (Mock) */}
                        <button className="w-full group flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-all text-left">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 rounded-lg text-gray-500">
                                    <Zap size={16} />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-gray-700">생산성 조정</div>
                                    <div className="text-[10px] text-gray-500">작업 효율 증가 가정 (야근/특근)</div>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};


export default function GanttChart({ items, startDate, onReorder, onResize, onSmartResize }) {
    const [draggedItem, setDraggedItem] = useState(null);
    const [dateScale, setDateScale] = useState(1);
    const pixelsPerUnit = 40;

    // Popover State
    const [popover, setPopover] = useState(null); // { visible, item, oldDuration, newDuration, x, y }

    // Simulation Tooltip State
    const [simulation, setSimulation] = useState(null);

    // Tree View State
    const [expandedCategories, setExpandedCategories] = useState({});
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
    const { itemsWithTiming, totalDays, parallelGroups, dailyLoads } = useMemo(() => {
        if (!items || items.length === 0) return { itemsWithTiming: [], totalDays: 0, parallelGroups: new Map(), dailyLoads: new Map() };

        let currentDay = 0;
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


        console.log('📍 Milestones:', milestones, 'Items:', itemsWithTiming.map(i => ({ cat: i.main_category, end: i.startDay + i.durationDays })));
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
            // New main category
            if (item.main_category !== currentMainCategory) {
                if (mainCategoryGroup) groups.push(mainCategoryGroup);

                currentMainCategory = item.main_category;
                currentProcess = null;
                mainCategoryGroup = {
                    mainCategory: item.main_category,
                    processes: [],
                    startIndex: index
                };
                processGroup = null;
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
                <div className="w-80 border-r border-gray-200 bg-white flex-shrink-0 overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-3 py-2 z-10">
                        <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">작업 목록</span>
                    </div>

                    {/* Content */}
                    {groupedItems.map((categoryGroup, catIdx) => {
                        const isCategoryExpanded = expandedCategories[catIdx] !== false;


                        return (
                            <div key={catIdx}>
                                <div
                                    className="flex items-center px-3 py-2 bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-300 cursor-pointer"
                                    onClick={() => setExpandedCategories(prev => ({ ...prev, [catIdx]: !isCategoryExpanded }))}
                                >
                                    <span className="mr-2 text-gray-400 text-xs">{isCategoryExpanded ? '▼' : '▶'}</span>
                                    <div className="w-1 h-5 bg-blue-500 rounded-full mr-2"></div>
                                    <h3 className="font-bold text-gray-800 text-sm flex-1">{categoryGroup.mainCategory}</h3>
                                </div>
                                {isCategoryExpanded && categoryGroup.processes.map((processGroup, procIdx) => (
                                    <div key={procIdx}>
                                        {processGroup.items.map((item) => {
                                            const calendarDays = item.calendar_days || item.durationDays || 0;
                                            const months = (calendarDays / 30).toFixed(1);
                                            return (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center px-3 py-2 hover:bg-blue-50/50 border-b border-gray-100 transition-colors"
                                                    style={{ height: '44px' }}
                                                >
                                                    <div className="flex-1 min-w-0 pr-2">
                                                        <div className="text-[11px] font-medium text-gray-800 truncate">{item.work_type}</div>
                                                        <div className="text-[10px] text-gray-500 truncate">{item.process}</div>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <div className="text-[10px] font-medium text-gray-700 whitespace-nowrap">{calendarDays.toFixed(1)}일</div>
                                                        <div className="text-[9px] text-gray-400 whitespace-nowrap">{months}개월</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>

                {/* Right Timeline */}
                <div className="flex-1 overflow-auto bg-white relative">
                    <div style={{ minWidth: `${Math.ceil(totalDays / dateScale) * pixelsPerUnit}px` }}>

                        {/* Timeline Header */}
                        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur shadow-sm border-b border-gray-100">
                            {/* Months */}
                            <div className="flex border-b border-gray-100">
                                {timeline.months.map(m => (
                                    <div key={m.key} style={{ width: m.count * pixelsPerUnit }} className="py-2 text-xs font-bold text-slate-500 text-center border-r border-gray-50">
                                        {m.label}
                                    </div>
                                ))}
                            </div>
                            {/* Days */}
                            <div className="flex relative">
                                {timeline.days.map((d, i) => (
                                    <div key={i} style={{ width: pixelsPerUnit }} className="py-1 text-[10px] text-gray-400 text-center border-r border-gray-50">
                                        {d.dayOfMonth.replace('일', '')}
                                    </div>
                                ))}

                            </div>
                        </div>

                        {/* Chart Area */}
                        <div className="relative">
                            {/* Grid Lines & Heatmap Background */}
                            <div className="absolute inset-0 flex pointer-events-none h-full">
                                {timeline.days.map((d, i) => {
                                    const load = dailyLoads.get(d.actualDay) || 0;
                                    // Heatmap logic
                                    let bg = "";
                                    if (load > 40) bg = "bg-red-50/50";
                                    else if (load > 20) bg = "bg-amber-50/30";

                                    return (
                                        <div key={i} style={{ width: pixelsPerUnit }} className={`border-r border-gray-50 h-full ${bg}`}></div>
                                    );
                                })}
                            </div>

                            {/* Critical Path Lines (CP) */}
                            <svg className="absolute inset-0 pointer-events-none z-30" style={{ width: '100%', height: itemsWithTiming.length * 44 }}>
                                <defs>
                                    <marker id="arrowhead-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                                        <path d="M0,0 L0,6 L6,3 z" fill="#ef4444" />
                                    </marker>
                                    <marker id="arrowhead-grey" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                                        <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
                                    </marker>
                                </defs>
                                {itemsWithTiming.map((item, i) => {
                                    if (i === itemsWithTiming.length - 1) return null;

                                    const pxFactor = pixelsPerUnit / dateScale;
                                    const rowH = 44;
                                    const rowCenter = 22;

                                    const taskEnd = item.startDay + item.durationDays;
                                    const taskStart = item.startDay;

                                    // Check if THIS task is enclosed (don't draw arrow FROM grey tasks)
                                    const prevItem = i > 0 ? itemsWithTiming[i - 1] : null;
                                    const prevEnd = prevItem ? prevItem.startDay + prevItem.durationDays : 0;
                                    const isCurrentEnclosed = prevEnd > taskEnd;

                                    // Don't draw arrow from grey (enclosed) tasks
                                    if (isCurrentEnclosed) return null;

                                    // Find the next non-enclosed task to connect to
                                    let targetIndex = i + 1;
                                    let targetItem = itemsWithTiming[targetIndex];

                                    // Skip over any enclosed tasks
                                    while (targetItem && taskEnd > (targetItem.startDay + targetItem.durationDays)) {
                                        targetIndex++;
                                        targetItem = itemsWithTiming[targetIndex];
                                    }

                                    // If no valid target found, don't draw arrow
                                    if (!targetItem) return null;

                                    const targetStart = targetItem.startDay;

                                    // Arrow connects from current red end to target red start
                                    const redE = Math.min(taskEnd, targetStart);
                                    const targetRedStart = targetStart;

                                    const startX = redE * pxFactor;
                                    const startY = (i * rowH) + rowCenter;

                                    const endX = targetRedStart * pxFactor;
                                    const endY = (targetIndex * rowH) + rowCenter;

                                    return (
                                        <g key={`cp-${i}`}>
                                            <path
                                                d={`M ${startX} ${startY} L ${endX} ${endY}`}
                                                fill="none"
                                                stroke="#ef4444"
                                                strokeWidth="2.5"
                                                strokeDasharray="4 3"
                                                markerEnd="url(#arrowhead-red)"
                                                className="opacity-100 mix-blend-multiply transition-all duration-300"
                                            />
                                        </g>
                                    );
                                })}

                                {/* Category Completion Milestones */}
                                {categoryMilestones.map((milestone, idx) => {
                                    const pxFactor = pixelsPerUnit / dateScale;
                                    const rowH = 44;
                                    const milestoneX = milestone.endDay * pxFactor;
                                    const milestoneY = (milestone.rowIndex * rowH) + 22;

                                    console.log(`🔶 Rendering milestone ${idx}:`, milestone.category, `X=${milestoneX}, Y=${milestoneY}, endDay=${milestone.endDay}`);

                                    return (
                                        <g key={`milestone-${idx}`}>


                                        </g>
                                    );
                                })}
                            </svg>

                            {/* Sticky Milestone Labels */}
                            <div className="absolute top-0 left-0 pointer-events-none z-40 sticky" style={{ top: 0 }}>
                                {categoryMilestones.map((milestone, idx) => {
                                    const pxFactor = pixelsPerUnit / dateScale;
                                    const milestoneX = milestone.endDay * pxFactor;

                                    return (
                                        <div
                                            key={`label-${idx}`}
                                            className="absolute"
                                            style={{
                                                left: `${milestoneX}px`,
                                                top: '5px',
                                                transform: 'translateX(-50%)'
                                            }}
                                        >
                                            {/* Triangle Marker */}
                                            <div
                                                className="mx-auto mb-1"
                                                style={{
                                                    width: 0,
                                                    height: 0,
                                                    borderLeft: '6px solid transparent',
                                                    borderRight: '6px solid transparent',
                                                    borderTop: '10px solid #10b981'
                                                }}
                                            ></div>
                                            <span className="text-xs font-bold text-green-700 px-2 py-1 whitespace-nowrap bg-white/95 rounded shadow-sm border border-green-200 inline-block">
                                                {milestone.category} 완료
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Gantt Rows */}
                            <div className="relative py-1">
                                {itemsWithTiming.map((item, index) => {
                                    const prevItem = index > 0 ? itemsWithTiming[index - 1] : null;
                                    const nextItem = index < itemsWithTiming.length - 1 ? itemsWithTiming[index + 1] : null;

                                    const taskStart = item.startDay;
                                    const taskEnd = item.startDay + item.durationDays;

                                    // Rule: If successor task finishes before predecessor, successor should be grey
                                    const prevEnd = prevItem ? prevItem.startDay + prevItem.durationDays : 0;
                                    const isEnclosed = prevEnd > taskEnd; // This task ends before previous task

                                    // Check if next task is enclosed within this task
                                    const nextEnd = nextItem ? nextItem.startDay + nextItem.durationDays : Infinity;
                                    const nextIsEnclosed = taskEnd > nextEnd;

                                    let redS, redE;
                                    if (isEnclosed) {
                                        // Enclosed task: entire task is grey (no red segment)
                                        redS = taskStart;
                                        redE = taskStart;
                                    } else {
                                        // Normal rule: red starts at taskStart, grey at overlap with next
                                        redS = taskStart;
                                        // If next task is enclosed, don't grey out at overlap - stay red
                                        if (nextIsEnclosed) {
                                            redE = taskEnd;
                                        } else {
                                            redE = nextItem ? Math.min(taskEnd, nextItem.startDay) : taskEnd;
                                        }
                                    }

                                    return (
                                        <SmartGanttBar
                                            key={item.id}
                                            item={item}
                                            startDay={item.startDay}
                                            durationDays={item.durationDays}
                                            pixelsPerUnit={pixelsPerUnit}
                                            dateScale={dateScale}
                                            onBarDragStart={handleBarDrag}
                                            onBarResize={handleBarResize}
                                            onResizing={handleBarResizing}
                                            setPopoverState={setPopover}
                                            redStartDay={redS}
                                            redEndDay={redE}
                                        />
                                    );
                                })}
                            </div>
                        </div>

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