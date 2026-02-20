import React, { useMemo, useState, useCallback } from "react";
import { Users, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useScheduleStore } from "../../stores/scheduleStore";
import { generateTimeline, calculateGanttItems } from "./ganttUtils";
import GanttSidebar from "./GanttSidebar";
import GanttTimelineHeader from "./GanttTimelineHeader";
import GanttChartArea from "./GanttChartArea";
import ContextualBrainPopover from "./ContextualBrainPopover";
import OverlapResolvePopover from "./OverlapResolvePopover";
import { buildDragPreviewState, buildItemDragUpdates, buildSubtaskDragUpdates } from "./gantt/controllers/dragPreview";
import { buildLink, isDuplicateLink } from "./gantt/controllers/linkController";
import { buildMoveUpdatesByDelta } from "./gantt/utils/moveUpdates";
import { useAutoScale } from "./gantt/hooks/useAutoScale";
import GanttToolbar from "./gantt/ui/GanttToolbar";
import LinkEditorPopover from "./gantt/ui/LinkEditorPopover";
import { buildParallelStateFromSegments, deriveParallelMeta, getParallelSegmentsFromItem, isParallelByApplicationRate } from "../../utils/parallelSegments";
import toast from "react-hot-toast";
import { useTutorial } from "../../hooks/useTutorial";
import { ganttChartSteps } from "../../config/tutorialSteps";

const GANTT_VIEW_MODE = {
    CATEGORY: "category",
    PROCESS: "process",
    WORK_TYPE: "work_type"
};

const toViewId = (prefix, value) => `${prefix}-${encodeURIComponent(String(value || "-"))}`;

const getCriticalMeta = (item) => {
    const taskStart = parseFloat(item?.startDay) || 0;
    const durationDays = parseFloat(item?.durationDays) || 0;
    const taskEnd = taskStart + durationDays;
    const relativeParallelSegments = getParallelSegmentsFromItem(item, durationDays);
    const parallelMeta = deriveParallelMeta(durationDays, relativeParallelSegments);
    const rawRedStart = taskStart + parallelMeta.frontParallelDays;
    const rawRedEnd = taskEnd - parallelMeta.backParallelDays;
    const redStart = Math.max(taskStart, Math.min(taskEnd, rawRedStart));
    const redEnd = Math.max(redStart, Math.min(taskEnd, rawRedEnd));
    const remarksText = String(item?.remarks || "").trim();
    const hasParallelMarker = (
        isParallelByApplicationRate(item)
        ||
        remarksText === "병행작업"
        || Boolean(item?._parallelGroup)
        || Boolean(item?.parallelGroup)
        || Boolean(item?.parallel_group)
        || Boolean(item?.is_parallelism)
    );
    const isFullyParallel = parallelMeta.parallelDays >= durationDays;
    const isParallel = hasParallelMarker || isFullyParallel;
    const hasCriticalSegment = parallelMeta.criticalDays > 0 && redEnd > redStart;

    return { redStart, redEnd, isParallel, hasCriticalSegment };
};

const buildAggregatedViewData = (itemsWithTiming, mode) => {
    if (!Array.isArray(itemsWithTiming) || itemsWithTiming.length === 0) {
        return { items: [], itemToViewId: new Map() };
    }
    if (mode === GANTT_VIEW_MODE.WORK_TYPE) {
        const itemToViewId = new Map(itemsWithTiming.map((item) => [item.id, item.id]));
        return { items: itemsWithTiming, itemToViewId };
    }

    const grouped = new Map();
    const itemToViewId = new Map();
    itemsWithTiming.forEach((item, index) => {
        const start = parseFloat(item.startDay) || 0;
        const end = start + (parseFloat(item.durationDays) || 0);
        const main = String(item.main_category || "기타");
        const section = String(item.process || "미분류 구분");
        const process = String(item.sub_process || "미분류 공정");

        const isSectionMode = mode === GANTT_VIEW_MODE.CATEGORY;
        const groupKey = isSectionMode
            ? `${main}|||${section}`
            : `${main}|||${section}|||${process}`;
        const displayProcess = section;
        const displayWorkType = isSectionMode ? section : process;

        if (!grouped.has(groupKey)) {
            grouped.set(groupKey, {
                id: toViewId(isSectionMode ? "view-section" : "view-process", groupKey),
                main_category: main,
                process: displayProcess,
                sub_process: isSectionMode ? "" : process,
                work_type: displayWorkType,
                startDay: start,
                endDay: end,
                order: index,
                members: []
            });
        } else {
            const bucket = grouped.get(groupKey);
            if (start < bucket.startDay) bucket.startDay = start;
            if (end > bucket.endDay) bucket.endDay = end;
        }
        const bucket = grouped.get(groupKey);
        bucket.members.push(item);
        itemToViewId.set(item.id, bucket.id);
    });

    const items = Array.from(grouped.values())
        .sort((a, b) => a.order - b.order)
        .map(({ order, members, ...row }) => {
            const durationDays = Math.max(0, row.endDay - row.startDay);
            let cpRedStart = Infinity;
            let cpRedEnd = -Infinity;
            let hasCriticalSegment = false;
            let hasNonParallel = false;

            members.forEach((member) => {
                const memberMeta = getCriticalMeta(member);
                if (!memberMeta.isParallel) hasNonParallel = true;
                if (!memberMeta.isParallel && memberMeta.hasCriticalSegment) {
                    hasCriticalSegment = true;
                    cpRedStart = Math.min(cpRedStart, memberMeta.redStart);
                    cpRedEnd = Math.max(cpRedEnd, memberMeta.redEnd);
                }
            });

            const normalizedCpRedStart = Number.isFinite(cpRedStart) ? cpRedStart : row.startDay;
            const normalizedCpRedEnd = Number.isFinite(cpRedEnd) ? cpRedEnd : row.startDay;
            return {
                ...row,
                durationDays,
                calendar_days: durationDays,
                cp_red_start: normalizedCpRedStart,
                cp_red_end: normalizedCpRedEnd,
                _hasCriticalSegment: hasCriticalSegment,
                is_parallelism: !hasNonParallel
            };
        });

    return { items, itemToViewId };
};

const buildAggregatedLinks = (links, itemToViewId) => {
    if (!Array.isArray(links) || links.length === 0) return [];
    if (!(itemToViewId instanceof Map) || itemToViewId.size === 0) return [];

    const dedup = new Map();
    links.forEach((link) => {
        const from = itemToViewId.get(link.from);
        const to = itemToViewId.get(link.to);
        if (!from || !to || from === to) return;
        const type = link.type || "FS";
        const lag = parseFloat(link.lag) || 0;
        const key = `${from}|${to}|${type}|${lag}`;
        if (dedup.has(key)) return;
        dedup.set(key, {
            id: `view-link-${encodeURIComponent(key)}`,
            from,
            to,
            type,
            lag
        });
    });

    return Array.from(dedup.values());
};

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
    onDeleteSubtask,
    readOnly = false
}) {
    const pixelsPerUnit = 40;
    const setGanttDateScale = useScheduleStore((state) => state.setGanttDateScale);

    // Refs
    const sidebarRef = React.useRef(null);
    const chartRef = React.useRef(null);
    const [popover, setPopover] = useState(null); // { visible, item, oldDuration, newDuration, x, y }
    const [overlapPopover, setOverlapPopover] = useState(null);  // For drag overlap
    const lastOverlapRef = React.useRef(new Map()); // draggedId -> overlappingId
    const dragPreviewRef = React.useRef(null);
    const groupPreviewRef = React.useRef(null);

    // Selection / interaction state
    const [selectedItemIds, setSelectedItemIds] = useState([]);
    const [selectedLinkId, setSelectedLinkId] = useState(null);
    const [selectedSubtaskIds, setSelectedSubtaskIds] = useState([]);
    const [linkDraft, setLinkDraft] = useState(null); // { fromId, fromAnchor }
    const [linkEditor, setLinkEditor] = useState(null); // { id, x, y }

    // UI state
    // eslint-disable-next-line no-unused-vars
    const [draggedItem, setDraggedItem] = useState(null);
    const [dateScale, setDateScale] = useState(1);
    const [ganttViewMode, setGanttViewMode] = useState(GANTT_VIEW_MODE.WORK_TYPE);
    const [hasUserScaled, setHasUserScaled] = useState(false);
    const [linkMode, setLinkMode] = useState(false);
    const [subtaskMode, setSubtaskMode] = useState(false);
    const [isScrolling, setIsScrolling] = useState(false);
    const canEdit = !readOnly && ganttViewMode === GANTT_VIEW_MODE.WORK_TYPE;

    // Tutorial
    useTutorial('ganttChart', ganttChartSteps);

    // Simulation Tooltip State
    const [simulation, setSimulation] = useState(null);
    React.useEffect(() => {
        if (setGanttDateScale) setGanttDateScale(dateScale);
    }, [dateScale, setGanttDateScale]);

    // Tree View State
    const [expandedCategories, setExpandedCategories] = useState({});
    // eslint-disable-next-line no-unused-vars
    // eslint-disable-next-line no-unused-vars
    const [expandedProcesses, setExpandedProcesses] = useState({});
    const [copiedSubtask, setCopiedSubtask] = useState(null);

    const addParallelSegment = (map, id, start, end) => {
        if (!id) return;
        const s = Number(start);
        const e = Number(end);
        if (!Number.isFinite(s) || !Number.isFinite(e)) return;
        if (e <= s) return;
        if (!map.has(id)) map.set(id, []);
        map.get(id).push([s, e]);
    };

    const applyRatesToUpdates = (updates, segmentMap, taskWindowMap) => {
        segmentMap.forEach((segments, id) => {
            const window = taskWindowMap.get(id);
            if (!window) return;
            const duration = Math.max(0.1, window.end - window.start);
            const relativeSegments = (Array.isArray(segments) ? segments : []).map(([start, end]) => ({
                start: start - window.start,
                end: end - window.start
            }));
            const parallelState = buildParallelStateFromSegments(duration, relativeSegments);

            let target = null;
            for (let i = updates.length - 1; i >= 0; i -= 1) {
                if (updates[i]?.id === id) {
                    target = updates[i];
                    break;
                }
            }
            if (target) {
                target.application_rate = parallelState.application_rate;
                target.parallel_segments = parallelState.parallel_segments;
            } else {
                updates.push({
                    id,
                    application_rate: parallelState.application_rate,
                    parallel_segments: parallelState.parallel_segments
                });
            }
        });
    };

    const handleScroll = useCallback(() => {
        setIsScrolling(true);
        clearTimeout(window.ganttChartScrollTimeout);
        window.ganttChartScrollTimeout = setTimeout(() => {
            setIsScrolling(false);
        }, 1000);
    }, []);

    // Subtask Copy/Paste (Object Level)
    React.useEffect(() => {
        if (!canEdit) return;
        const handleKeyDown = async (e) => {
            // Ignore if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
                return;
            }

            // Copy: Ctrl+C
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                if (selectedSubtaskIds.length > 0) {
                    const subtask = subTasks.find(s => s.id === selectedSubtaskIds[0]);
                    if (subtask) {
                        setCopiedSubtask({
                            durationDays: subtask.durationDays,
                            label: subtask.label,
                            startDay: subtask.startDay
                        });
                        toast.success("부공종 복사됨");
                    }
                }
            }

            // Paste: Ctrl+V
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                if (copiedSubtask) {
                    // Determine targets: Selected Rows OR Parent of Selected Subtasks
                    const targetItemIds = new Set();

                    // 1. Add explicitly selected rows
                    selectedItemIds.forEach(id => targetItemIds.add(id));

                    // 2. Add parents of selected subtasks
                    selectedSubtaskIds.forEach(id => {
                        const sub = subTasks.find(s => s.id === id);
                        if (sub) targetItemIds.add(sub.itemId);
                    });

                    if (targetItemIds.size > 0 && onCreateSubtask) {
                        targetItemIds.forEach(itemId => {
                            onCreateSubtask(
                                itemId,
                                copiedSubtask.startDay,
                                copiedSubtask.durationDays,
                                { label: copiedSubtask.label }
                            );
                        });
                        toast.success(`부공종 붙여넣기 완료 (${targetItemIds.size}개)`);
                    } else {
                        // Optional: If nothing selected, maybe warn? Or just silent.
                        // toast("붙여넣을 공종(행)을 선택해주세요", { icon: "ℹ️" });
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canEdit, selectedSubtaskIds, selectedItemIds, subTasks, copiedSubtask, onCreateSubtask]);

    // Calculate base data on work-type rows first, then build display view.
    const { itemsWithTiming: baseItemsWithTiming, totalDays, dailyLoads } = useMemo(() => {
        return calculateGanttItems(items);
    }, [items]);

    const { items: itemsWithTiming, itemToViewId } = useMemo(() => {
        return buildAggregatedViewData(baseItemsWithTiming, ganttViewMode);
    }, [baseItemsWithTiming, ganttViewMode]);

    const visibleLinks = useMemo(() => {
        if (ganttViewMode === GANTT_VIEW_MODE.WORK_TYPE) return links;
        return buildAggregatedLinks(links, itemToViewId);
    }, [ganttViewMode, links, itemToViewId]);

    const handleItemClick = useCallback((itemId, source, event) => {
        const isMulti = event?.shiftKey || event?.metaKey || event?.ctrlKey;
        setSelectedItemIds((prev) => {
            if (!isMulti) return [itemId];
            if (prev.includes(itemId)) {
                return prev.filter((id) => id !== itemId);
            }
            return [...prev, itemId];
        });

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
    }, [itemsWithTiming, dateScale, pixelsPerUnit]);

    const handleBoxSelection = useCallback((ids) => {
        setSelectedItemIds(ids);
    }, []);

    const handleSubtaskSelect = useCallback((subtaskId, event) => {
        const isMulti = event?.shiftKey || event?.metaKey || event?.ctrlKey;
        setSelectedSubtaskIds((prev) => {
            if (!isMulti) return subtaskId ? [subtaskId] : [];
            if (!subtaskId) return [];
            if (prev.includes(subtaskId)) {
                return prev.filter((id) => id !== subtaskId);
            }
            return [...prev, subtaskId];
        });
    }, []);

    const handleBarResizing = useCallback((itemId, duration, x, y) => {
        if (!canEdit) return;
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
    }, [canEdit, items]);

    const timeline = useMemo(() => generateTimeline(startDate, totalDays, dateScale), [startDate, totalDays, dateScale]);

    const handleSetScale = useCallback((scale) => {
        setHasUserScaled(true);
        setDateScale(scale);
    }, []);

    useAutoScale({
        hasUserScaled,
        totalDays,
        pixelsPerUnit,
        dateScale,
        chartRef,
        setDateScale
    });

    const addLink = useScheduleStore((state) => state.addLink);
    const updateLink = useScheduleStore((state) => state.updateLink);
    const deleteLink = useScheduleStore((state) => state.deleteLink);
    const moveTaskBars = useScheduleStore((state) => state.moveTaskBars);
    const moveSubTasks = useScheduleStore((state) => state.moveSubTasks);
    const shiftSubTasksForItem = useScheduleStore((state) => state.shiftSubTasksForItem);

    const handleGroupDrag = useCallback((deltaDays) => {
        if (!canEdit) return;
        if (!deltaDays || !Array.isArray(selectedItemIds) || selectedItemIds.length < 1) return;
        const updates = buildMoveUpdatesByDelta(selectedItemIds, itemsWithTiming, deltaDays);
        moveTaskBars(updates);
        selectedItemIds.forEach((id) => {
            shiftSubTasksForItem(id, deltaDays);
        });
    }, [canEdit, itemsWithTiming, moveTaskBars, selectedItemIds, shiftSubTasksForItem]);

    const handleGroupDragPreview = useCallback((deltaDays) => {
        if (!canEdit) return;
        if (!deltaDays || !Array.isArray(selectedItemIds) || selectedItemIds.length < 1) return;

        if (!groupPreviewRef.current) {
            groupPreviewRef.current = buildDragPreviewState(selectedItemIds, itemsWithTiming, subTasks);
        }

        const updates = buildItemDragUpdates(selectedItemIds, groupPreviewRef.current.base, deltaDays);
        moveTaskBars(updates);

        const subtaskUpdates = buildSubtaskDragUpdates(groupPreviewRef.current.subtaskBase, deltaDays);
        if (subtaskUpdates.length > 0) {
            moveSubTasks(subtaskUpdates);
        }
    }, [canEdit, itemsWithTiming, moveSubTasks, moveTaskBars, selectedItemIds, subTasks]);

    const handleGroupDragEnd = useCallback(() => {
        groupPreviewRef.current = null;
    }, []);

    const handleBarDragPreview = useCallback((draggedId, newStartDay) => {
        if (!canEdit) return;
        if (Array.isArray(selectedItemIds) && selectedItemIds.length > 1) return;
        if (draggedId && newStartDay !== null && newStartDay !== undefined) {
            moveTaskBars([{ id: draggedId, newStartDay }]);
        }
        const isSelected = Array.isArray(selectedItemIds) && selectedItemIds.includes(draggedId);
        const targetIds = (isSelected && selectedItemIds.length > 1) ? selectedItemIds : null;
        if (!targetIds) return;

        if (!dragPreviewRef.current) {
            dragPreviewRef.current = {
                draggedId,
                targetIds,
                ...buildDragPreviewState(targetIds, itemsWithTiming, subTasks)
            };
        }

        const baseStart = dragPreviewRef.current.base.get(draggedId);
        const delta = newStartDay - (baseStart ?? newStartDay);
        if (!delta) return;

        const updates = buildItemDragUpdates(targetIds, dragPreviewRef.current.base, delta);
        moveTaskBars(updates);
        const subtaskUpdates = buildSubtaskDragUpdates(dragPreviewRef.current.subtaskBase, delta);
        if (subtaskUpdates.length > 0) {
            moveSubTasks(subtaskUpdates);
        }
    }, [canEdit, itemsWithTiming, moveSubTasks, moveTaskBars, selectedItemIds, subTasks]);

    const handleBarDragEnd = useCallback((draggedId) => {
        if (!dragPreviewRef.current) return;
        dragPreviewRef.current = null;
    }, []);

    const handleLinkAnchorClick = useCallback((itemId, anchor) => {
        if (!canEdit) return;
        if (!linkMode) return;
        if (!linkDraft) {
            setLinkDraft({ fromId: itemId, fromAnchor: anchor });
            return;
        }
        if (linkDraft.fromId === itemId && linkDraft.fromAnchor === anchor) {
            setLinkDraft(null);
            return;
        }

        const newLink = buildLink({ fromId: linkDraft.fromId, fromAnchor: linkDraft.fromAnchor, toId: itemId, toAnchor: anchor });
        if (!isDuplicateLink(links, newLink)) {
            addLink(newLink);
        }
        setLinkDraft(null);
    }, [addLink, canEdit, linkDraft, linkMode, links]);

    const handleCreateLink = useCallback((fromId, fromAnchor, toId, toAnchor) => {
        if (!canEdit) return;
        if (!fromId || !toId) return;
        if (fromId === toId && fromAnchor === toAnchor) return;
        const newLink = buildLink({ fromId, fromAnchor, toId, toAnchor });
        if (!isDuplicateLink(links, newLink)) {
            addLink(newLink);
        }
    }, [addLink, canEdit, links]);

    const handleLinkClick = useCallback((linkId, x, y) => {
        if (!canEdit) return;
        setSelectedLinkId(linkId);
        setLinkEditor({ id: linkId, x, y });
    }, [canEdit]);

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
        if (canEdit) return;
        setLinkMode(false);
        setSubtaskMode(false);
        setLinkDraft(null);
        setLinkEditor(null);
        setSelectedLinkId(null);
        setSelectedSubtaskIds([]);
    }, [canEdit]);

    React.useEffect(() => {
        const visibleIds = new Set(itemsWithTiming.map((item) => item.id));
        setSelectedItemIds((prev) => prev.filter((id) => visibleIds.has(id)));
    }, [itemsWithTiming]);

    React.useEffect(() => {
        if (!aiActiveItemId) return;
        if (!itemsWithTiming.some((item) => item.id === aiActiveItemId)) return;
        handleItemClick(aiActiveItemId, 'sidebar');
    }, [aiActiveItemId, handleItemClick, itemsWithTiming]);

    const handleCreateSubtask = useCallback((itemId, startDay, durationDays) => {
        if (!canEdit) return;
        if (onCreateSubtask) onCreateSubtask(itemId, startDay, durationDays);
    }, [canEdit, onCreateSubtask]);

    const handleUpdateSubtask = useCallback((id, updates) => {
        if (!canEdit) return;
        if (onUpdateSubtask) onUpdateSubtask(id, updates);
    }, [canEdit, onUpdateSubtask]);

    const handleDeleteSubtask = useCallback((id) => {
        if (!canEdit) return;
        if (onDeleteSubtask) onDeleteSubtask(id);
        setSelectedSubtaskIds((prev) => prev.filter((subtaskId) => subtaskId !== id));
    }, [canEdit, onDeleteSubtask]);

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
        if (!canEdit) return;
        const item = items.find(i => i.id === itemId);
        if (!item) return;
        const isSelected = selectedItemIds.includes(itemId);
        const activeSelection = (isSelected && selectedItemIds.length > 0) ? selectedItemIds : [itemId];
        if (!isSelected) {
            setSelectedItemIds([itemId]);
        }
        const timingItem = itemsWithTiming.find(i => i.id === itemId);
        const currentStartDay = timingItem ? timingItem.startDay : (item._startDay ?? 0);
        const dragDelta = newStartDay - currentStartDay;

        if (activeSelection.length > 1) {
            return;
        }

        const duration = parseFloat(item.calendar_days) || 0;
        const newEnd = newStartDay + duration;

        // Check for overlaps with ALL other tasks - COLLECT ALL OVERLAPS
        const overlappingTasks = [];
        itemsWithTiming.forEach((otherItem) => {
            if (otherItem.id === itemId) return; // Skip self

            const otherStart = otherItem.startDay;
            const otherEnd = otherItem.startDay + otherItem.durationDays;

            // Check if there's time overlap
            if (newStartDay < otherEnd && newEnd > otherStart) {
                const overlapStart = Math.max(newStartDay, otherStart);
                const overlapEnd = Math.min(newEnd, otherEnd);
                const overlapDays = overlapEnd - overlapStart;

                // Collect ALL overlaps, not just the first
                overlappingTasks.push({
                    id: otherItem.id,
                    name: `${otherItem.process} - ${otherItem.work_type}`,
                    start: otherStart,
                    end: otherEnd,
                    overlapDays: overlapDays,
                    // CRITICAL: Pass existing parallel days to prevent overwriting
                    front_parallel_days: otherItem.front_parallel_days || 0,
                    back_parallel_days: otherItem.back_parallel_days || 0
                });
            }
        });

        if (overlappingTasks.length > 0) {
            // Create multi-overlap data structure
            const overlapInfo = {
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
                overlappingTasks: overlappingTasks, // Array of all overlaps
                totalOverlaps: overlappingTasks.length,
                draggedItemId: itemId,
                newStartDay: newStartDay,
                dragDelta: dragDelta
            };

            setOverlapPopover(overlapInfo);
            // Store all overlapping task IDs for cleanup later
            overlappingTasks.forEach(ot => {
                lastOverlapRef.current.set(`${itemId}-${ot.id}`, ot.id);
            });
        } else {
            // No overlaps - clear parallel days ONLY for this dragged task and its previous overlaps

            // Atomic update for Undo/Redo consistency
            const updates = [{ id: itemId, front: 0, back: 0 }];

            // Clear ONLY the tasks that were previously overlapping with THIS specific task
            const keysToDelete = [];
            lastOverlapRef.current.forEach((value, key) => {
                if (key.startsWith(`${itemId}-`)) {
                    // Only clear if this task is no longer overlapping with anyone
                    // Don't touch other tasks' overlap states
                    updates.push({ id: value, front: 0, back: 0 });
                    keysToDelete.push(key);
                }
            });
            keysToDelete.forEach(key => lastOverlapRef.current.delete(key));

            // IMPORTANT: Only call resolveDragOverlap if we actually have updates to apply
            if (updates.length > 0) {
                useScheduleStore.getState().resolveDragOverlap(itemId, newStartDay, updates);
            }
            if (dragDelta) {
                shiftSubTasksForItem(itemId, dragDelta);
            }
        }
    }, [canEdit, items, itemsWithTiming, moveTaskBars, selectedItemIds, shiftSubTasksForItem]);

    const handleBarResize = useCallback((itemId, newDuration, x, y) => {
        if (!canEdit) return;
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
    }, [canEdit, items]);

    return (
        <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden font-sans">

            {/* --- Toolbar --- */}
            <div data-tutorial="gantt-toolbar">
                <GanttToolbar
                    dateScale={dateScale}
                    onSetScale={handleSetScale}
                    viewMode={ganttViewMode}
                    onChangeViewMode={setGanttViewMode}
                    linkMode={linkMode}
                    setLinkMode={setLinkMode}
                    linkDraft={linkDraft}
                    subtaskMode={subtaskMode}
                    setSubtaskMode={setSubtaskMode}
                    canEdit={canEdit}
                />
            </div>

            {/* --- Main Content --- */}
            <div className="flex flex-1 min-h-0 relative">

                {/* Left Sidebar - Tree View */}
                <div data-tutorial="gantt-sidebar" className="h-full flex-shrink-0">
                    <GanttSidebar
                        containerRef={sidebarRef}
                        groupedItems={groupedItems}
                        expandedCategories={expandedCategories}
                        setExpandedCategories={setExpandedCategories}
                        selectedItemIds={selectedItemIds}
                        onItemClick={handleItemClick}
                        aiPreviewItems={aiPreviewItems}
                        aiOriginalItems={aiOriginalItems}
                        aiActiveItemId={aiActiveItemId}
                    />
                </div>

                {/* Right Timeline */}
                <div
                    data-tutorial="gantt-chart"
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
                            links={visibleLinks}
                            categoryMilestones={categoryMilestones}
                            onBarDragStart={handleBarDrag}
                            onBarDragPreview={handleBarDragPreview}
                            onBarDragEnd={handleBarDragEnd}
                            onBarResize={handleBarResize}
                            onBarResizing={handleBarResizing}
                            setPopoverState={setPopover}
                            selectedItemIds={selectedItemIds}
                            onItemClick={handleItemClick}
                            onSelectionChange={handleBoxSelection}
                            onGroupDrag={handleGroupDrag}
                            onGroupDragPreview={handleGroupDragPreview}
                            onGroupDragEnd={handleGroupDragEnd}
                            onMoveSubtasks={moveSubTasks}
                            linkMode={canEdit ? linkMode : false}
                            onLinkAnchorClick={handleLinkAnchorClick}
                            onLinkClick={canEdit ? handleLinkClick : undefined}
                            selectedLinkId={canEdit ? selectedLinkId : null}
                            aiPreviewItems={aiPreviewItems}
                            aiOriginalItems={aiOriginalItems}
                            aiActiveItemId={aiActiveItemId}
                            onCreateLink={handleCreateLink}
                            subtaskMode={canEdit ? subtaskMode : false}
                            subTasks={subTasks}
                            selectedSubtaskIds={selectedSubtaskIds}
                            onSelectSubtask={handleSubtaskSelect}
                            onCreateSubtask={handleCreateSubtask}
                            onUpdateSubtask={handleUpdateSubtask}
                            onDeleteSubtask={handleDeleteSubtask}
                            readOnly={!canEdit}
                        />

                    </div>
                </div>

                {/* Floating Simulation Tooltip */}
                <AnimatePresence>
                    {canEdit && simulation && (
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
                    data={canEdit ? popover : null}
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
                    data={canEdit ? overlapPopover : null}
                    onClose={() => setOverlapPopover(null)}
                    onSelectCurrentAsCP={() => {
                        if (!overlapPopover) return;

                        const { currentTask, draggedItemId, newStartDay } = overlapPopover;

                        // Support both old (overlappingTask) and new (overlappingTasks array) formats
                        const overlappingTasks = overlapPopover.overlappingTasks ||
                            (overlapPopover.overlappingTask ? [overlapPopover.overlappingTask] : []);

                        const updates = [];
                        const currentStart = newStartDay;
                        const currentEnd = currentTask.end;
                        const parallelSegments = new Map();
                        const taskWindowById = new Map();
                        taskWindowById.set(currentTask.id, { start: currentStart, end: currentEnd });

                        // Clear current task's parallel days (it becomes full CP)
                        updates.push({ id: currentTask.id, front: 0, back: 0 });

                        // Process each overlapping task
                        overlappingTasks.forEach((overlappingTask) => {
                            const overlappingStart = overlappingTask.start;
                            const overlappingEnd = overlappingTask.end;
                            const overlapDays = overlappingTask.overlapDays;
                            const overlapStart = Math.max(currentStart, overlappingStart);
                            const overlapEnd = Math.min(currentEnd, overlappingEnd);
                            taskWindowById.set(overlappingTask.id, { start: overlappingStart, end: overlappingEnd });

                            const currentContainsOther = currentStart < overlappingStart && currentEnd > overlappingEnd;
                            const otherContainsCurrent = overlappingStart < currentStart && overlappingEnd > currentEnd;

                            if (otherContainsCurrent) {
                                // Current is inner CP -> clear both (detour scenario)
                                updates.push({ id: overlappingTask.id, front: 0, back: 0 });
                            } else if (currentStart < overlappingStart) {
                                // Current starts before overlapping
                                // Overlapping task becomes parallel -> Set its front
                                updates.push({ id: overlappingTask.id, front: overlapDays, back: 0 });
                            } else {
                                // Current starts after overlapping
                                // Overlapping task becomes parallel -> Set its back
                                updates.push({ id: overlappingTask.id, back: overlapDays, front: 0 });
                            }

                            addParallelSegment(parallelSegments, overlappingTask.id, overlapStart, overlapEnd);
                        });

                        applyRatesToUpdates(updates, parallelSegments, taskWindowById);

                        useScheduleStore.getState().resolveDragOverlap(draggedItemId, newStartDay, updates);
                        if (overlapPopover.dragDelta) {
                            shiftSubTasksForItem(draggedItemId, overlapPopover.dragDelta);
                        }
                        setOverlapPopover(null);
                    }}
                    onSelectOtherAsCP={() => {
                        if (!overlapPopover) return;

                        const { currentTask, draggedItemId, newStartDay } = overlapPopover;

                        // Support both old (overlappingTask) and new (overlappingTasks array) formats
                        const overlappingTasks = overlapPopover.overlappingTasks ||
                            (overlapPopover.overlappingTask ? [overlapPopover.overlappingTask] : []);

                        const updates = [];
                        const currentStart = newStartDay;
                        const currentEnd = currentTask.end;
                        const parallelSegments = new Map();
                        const taskWindowById = new Map();
                        taskWindowById.set(currentTask.id, { start: currentStart, end: currentEnd });

                        // Track max parallel days for current task
                        let maxFrontParallel = 0;
                        let maxBackParallel = 0;

                        // Process each overlapping task
                        overlappingTasks.forEach((overlappingTask) => {
                            const overlappingStart = overlappingTask.start;
                            const overlappingEnd = overlappingTask.end;
                            const overlapDays = overlappingTask.overlapDays;
                            const overlapStart = Math.max(currentStart, overlappingStart);
                            const overlapEnd = Math.min(currentEnd, overlappingEnd);
                            taskWindowById.set(overlappingTask.id, { start: overlappingStart, end: overlappingEnd });

                            const currentContainsOther = currentStart < overlappingStart && currentEnd > overlappingEnd;
                            const otherContainsCurrent = overlappingStart < currentStart && overlappingEnd > currentEnd;

                            if (currentContainsOther) {
                                // Overlapping task is inner CP -> clear both (detour scenario)
                                updates.push({ id: currentTask.id, front: 0, back: 0 });
                                updates.push({ id: overlappingTask.id, front: 0, back: 0 });
                            } else if (currentStart < overlappingStart) {
                                // Current starts before overlapping
                                // Current task becomes parallel -> Accumulate back
                                updates.push({ id: overlappingTask.id, front: 0, back: 0 }); // Clear overlapping (it's CP)
                                maxBackParallel = Math.max(maxBackParallel, overlapDays);
                            } else {
                                // Current starts after overlapping
                                // Current task becomes parallel -> Accumulate front
                                updates.push({ id: overlappingTask.id, back: 0, front: 0 }); // Clear overlapping (it's CP)
                                maxFrontParallel = Math.max(maxFrontParallel, overlapDays);
                            }

                            addParallelSegment(parallelSegments, currentTask.id, overlapStart, overlapEnd);
                        });

                        // Apply accumulated parallel days to current task ONCE
                        updates.push({
                            id: currentTask.id,
                            front: maxFrontParallel,
                            back: maxBackParallel
                        });

                        applyRatesToUpdates(updates, parallelSegments, taskWindowById);

                        useScheduleStore.getState().resolveDragOverlap(draggedItemId, newStartDay, updates);
                        if (overlapPopover.dragDelta) {
                            shiftSubTasksForItem(draggedItemId, overlapPopover.dragDelta);
                        }
                        setOverlapPopover(null);
                    }}
                />

                <LinkEditorPopover
                    linkEditor={canEdit ? linkEditor : null}
                    links={links}
                    updateLink={updateLink}
                    deleteLink={deleteLink}
                    onClose={handleLinkEditorClose}
                />
            </div >
        </div >
    );
}
