import React, { useMemo, useRef, useState, useCallback, useEffect, useLayoutEffect } from "react";
import SmartGanttBar from "./SmartGanttBar";
import SubtaskNameModal from "./schedule/SubtaskNameModal";

const GanttChartArea = ({
    timeline,
    dailyLoads,
    pixelsPerUnit,
    dateScale,
    itemsWithTiming,
    links,
    categoryMilestones,
    onBarDragStart,
    onBarResize,
    onBarResizing,
    setPopoverState,
    selectedItemId,
    onItemClick,
    linkMode,
    onLinkAnchorClick,
    onLinkClick,
    selectedLinkId,
    onCreateLink,
    aiPreviewItems,
    aiOriginalItems,
    aiActiveItemId,
    subtaskMode,
    subTasks,
    selectedSubtaskId,
    onSelectSubtask,
    onCreateSubtask,
    onUpdateSubtask,
    onDeleteSubtask
}) => {
    const aiPreviewMap = useMemo(() => {
        if (!aiPreviewItems || !aiOriginalItems) return new Map();
        const originalMap = new Map(aiOriginalItems.map(item => [item.id, item]));
        const map = new Map();
        aiPreviewItems.forEach(item => {
            const original = originalMap.get(item.id);
            if (!original) return;
            const crewDiff = (parseFloat(item.crew_size) || 0) - (parseFloat(original.crew_size) || 0);
            const prodDiff = (parseFloat(item.productivity) || 0) - (parseFloat(original.productivity) || 0);
            const daysDiff = (parseFloat(item.calendar_days) || 0) - (parseFloat(original.calendar_days) || 0);
            if (Math.abs(crewDiff) > 0.01 || Math.abs(prodDiff) > 0.01 || Math.abs(daysDiff) > 0.01) {
                map.set(item.id, { crewDiff, prodDiff, daysDiff });
            }
        });
        return map;
    }, [aiPreviewItems, aiOriginalItems]);
    const [rowH, setRowH] = useState(44);
    const [rowCenter, setRowCenter] = useState(22);
    const pxFactor = pixelsPerUnit / dateScale;
    const itemIndexById = new Map(itemsWithTiming.map((item, index) => [item.id, { item, index }]));
    const subtaskIndexById = new Map((subTasks || []).map((subtask) => {
        const parent = itemIndexById.get(subtask.itemId);
        if (!parent) return null;
        return [subtask.id, { subtask, index: parent.index }];
    }).filter(Boolean));
    const [subtaskDraft, setSubtaskDraft] = useState(null);
    const subtaskDraftRef = useRef(null);
    const chartAreaRef = useRef(null);
    const [linkDrag, setLinkDrag] = useState(null); // { fromId, fromAnchor, fromX, fromY, x, y }
    const [renameModal, setRenameModal] = useState({ open: false, id: null, value: "" });

    const cpMeta = useMemo(() => {
        const map = new Map();
        itemsWithTiming.forEach((item) => {
            const frontParallel = parseFloat(item.front_parallel_days) || 0;
            const backParallel = parseFloat(item.back_parallel_days) || 0;
            const redStart = item.startDay + frontParallel;
            const redEnd = (item.startDay + item.durationDays) - backParallel;
            const hasCriticalSegment = redEnd > redStart;
            const isCp = item.remarks !== '병행작업' && hasCriticalSegment;
            map.set(item.id, { redStart, redEnd, isCp });
        });
        return map;
    }, [itemsWithTiming]);

    const containedCpMap = useMemo(() => {
        const map = new Map();
        itemsWithTiming.forEach((outer) => {
            const outerMeta = cpMeta.get(outer.id);
            if (!outerMeta || !outerMeta.isCp) return;
            const list = [];
            itemsWithTiming.forEach((inner) => {
                if (inner.id === outer.id) return;
                const innerMeta = cpMeta.get(inner.id);
                if (!innerMeta || !innerMeta.isCp) return;
                if (innerMeta.redStart >= outerMeta.redStart && innerMeta.redEnd <= outerMeta.redEnd) {
                    list.push({ item: inner, meta: innerMeta });
                }
            });
            if (list.length > 0) {
                list.sort((a, b) => a.meta.redStart - b.meta.redStart);
                map.set(outer.id, list);
            }
        });
        return map;
    }, [itemsWithTiming, cpMeta]);

    useLayoutEffect(() => {
        if (!chartAreaRef.current || itemsWithTiming.length === 0) return;
        const measure = () => {
            const firstRow = chartAreaRef.current.querySelector('[data-chart-row="true"]');
            if (firstRow) {
                const height = firstRow.getBoundingClientRect().height;
                if (height && Math.abs(height - rowH) > 0.5) {
                    setRowH(height);
                    setRowCenter(height / 2);
                }
            }
        };
        const raf = requestAnimationFrame(measure);
        return () => cancelAnimationFrame(raf);
    }, [itemsWithTiming.length, rowH]);
    const getAnchorX = (itemData, anchor) => {
        const startX = itemData.startDay * pxFactor;
        const endX = (itemData.startDay + itemData.durationDays) * pxFactor;
        return anchor === "start" ? startX : endX;
    };
    const getSubtaskAnchorX = (subtaskData, anchor) => {
        const startX = subtaskData.startDay * pxFactor;
        const endX = (subtaskData.startDay + subtaskData.durationDays) * pxFactor;
        return anchor === "start" ? startX : endX;
    };
    const getAnchorY = (index) => (index * rowH) + rowCenter;
    const deriveAnchorForType = (type) => {
        switch (type) {
            case "SS":
                return { from: "start", to: "start" };
            case "FF":
                return { from: "end", to: "end" };
            case "SF":
                return { from: "start", to: "end" };
            case "FS":
            default:
                return { from: "end", to: "start" };
        }
    };
    const buildLinkPath = (fromX, fromY, toX, toY, fromAnchor, offset) => {
        const offsetFromY = fromY + offset;
        const offsetToY = toY + offset;
        // 앵커 기준 판단:
        // - start에서 시작: 그래프 시작 지점 → Y축 먼저 (세로→가로)
        // - end에서 시작: 그래프 끝 지점 → X축 먼저 (가로→세로)
        if (fromAnchor === "start") {
            // 그래프 시작에서 출발: Y축 먼저
            return `M ${fromX} ${offsetFromY} L ${fromX} ${offsetToY} L ${toX} ${offsetToY}`;
        }
        // 그래프 끝(end)에서 출발: X축 먼저
        return `M ${fromX} ${offsetFromY} L ${toX} ${offsetFromY} L ${toX} ${offsetToY}`;
    };

    const getLinkAnchorPosition = useCallback((id, anchor) => {
        const taskData = itemIndexById.get(id);
        if (taskData) {
            return {
                x: getAnchorX(taskData.item, anchor),
                y: getAnchorY(taskData.index)
            };
        }
        const subData = subtaskIndexById.get(id);
        if (subData) {
            return {
                x: getSubtaskAnchorX(subData.subtask, anchor),
                y: getAnchorY(subData.index)
            };
        }
        return null;
    }, [itemIndexById, subtaskIndexById, getAnchorX, getSubtaskAnchorX]);

    const handleLinkDragStart = useCallback((e, fromId, fromAnchor) => {
        e.preventDefault();
        e.stopPropagation();
        const origin = getLinkAnchorPosition(fromId, fromAnchor);
        if (!origin) return;
        const rect = chartAreaRef.current?.getBoundingClientRect();
        if (!rect) return;
        const startX = e.clientX - rect.left;
        const startY = e.clientY - rect.top;
        setLinkDrag({
            fromId,
            fromAnchor,
            fromX: origin.x,
            fromY: origin.y,
            x: startX,
            y: startY
        });
    }, [getLinkAnchorPosition]);

    const handleLinkAnchorClick = useCallback((e, toId, toAnchor) => {
        if (!linkDrag) return;
        e.preventDefault();
        e.stopPropagation();
        if (onCreateLink) {
            onCreateLink(linkDrag.fromId, linkDrag.fromAnchor, toId, toAnchor);
        }
        setLinkDrag(null);
    }, [linkDrag, onCreateLink]);

    useEffect(() => {
        if (!linkDrag) return;
        const rect = chartAreaRef.current?.getBoundingClientRect();
        if (!rect) return;

        const handleMouseMove = (moveEvent) => {
            const nextX = moveEvent.clientX - rect.left;
            const nextY = moveEvent.clientY - rect.top;
            setLinkDrag((prev) => (prev ? { ...prev, x: nextX, y: nextY } : prev));
        };

        const handleMouseDown = (e) => {
            if (e.target?.dataset?.linkId) return;
            setLinkDrag(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mousedown', handleMouseDown);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mousedown', handleMouseDown);
        };
    }, [linkDrag]);

    const hasSubtaskOverlap = useCallback((itemId, startDay, durationDays, excludeId = null) => {
        if (!subTasks || subTasks.length === 0) return false;
        const endDay = startDay + durationDays;
        return subTasks.some((subtask) => {
            if (subtask.itemId !== itemId) return false;
            if (excludeId && subtask.id === excludeId) return false;
            const otherStart = subtask.startDay;
            const otherEnd = subtask.startDay + subtask.durationDays;
            return startDay < otherEnd && endDay > otherStart;
        });
    }, [subTasks]);

    const overlapsCriticalPath = useCallback((itemId, startDay, durationDays) => {
        const parent = itemsWithTiming.find((item) => item.id === itemId);
        if (!parent) return false;
        const frontParallel = parseFloat(parent.front_parallel_days) || 0;
        const backParallel = parseFloat(parent.back_parallel_days) || 0;
        const redStart = parent.startDay + frontParallel;
        const redEnd = (parent.startDay + parent.durationDays) - backParallel;
        if (redEnd <= redStart) return false;
        const endDay = startDay + durationDays;
        return startDay < redEnd && endDay > redStart;
    }, [itemsWithTiming]);

    const getSnapCandidate = useCallback((itemId, day, excludeSubtaskId = null) => {
        const snapThresholdPx = 14;
        const thresholdDays = snapThresholdPx / pxFactor;
        const candidates = [];
        const parent = itemsWithTiming.find((item) => item.id === itemId);
        if (parent) {
            const frontParallel = parseFloat(parent.front_parallel_days) || 0;
            const backParallel = parseFloat(parent.back_parallel_days) || 0;
            const redStart = parent.startDay + frontParallel;
            const redEnd = (parent.startDay + parent.durationDays) - backParallel;
            candidates.push(redStart, redEnd);
        }
        (subTasks || []).forEach((subtask) => {
            if (subtask.itemId !== itemId) return;
            if (excludeSubtaskId && subtask.id === excludeSubtaskId) return;
            candidates.push(subtask.startDay, subtask.startDay + subtask.durationDays);
        });
        let best = day;
        let bestDiff = thresholdDays + 1;
        candidates.forEach((candidate) => {
            const diff = Math.abs(candidate - day);
            if (diff <= thresholdDays && diff < bestDiff) {
                best = candidate;
                bestDiff = diff;
            }
        });
        return { snapped: best, diff: bestDiff, within: bestDiff <= thresholdDays };
    }, [itemsWithTiming, subTasks, pxFactor]);

    const handleSubtaskDrawStart = useCallback((e) => {
        if (!subtaskMode) return;
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        const rect = e.currentTarget.getBoundingClientRect();
        const rowIndex = Math.floor((e.clientY - rect.top) / rowH);
        if (rowIndex < 0 || rowIndex >= itemsWithTiming.length) return;

        const item = itemsWithTiming[rowIndex];
        if (!item) return;

        const startDay = Math.max(0, (e.clientX - rect.left) / pxFactor);
        const draft = { itemId: item.id, startDay, endDay: startDay };
        setSubtaskDraft(draft);
        subtaskDraftRef.current = draft;

        const handleMouseMove = (moveEvent) => {
            const current = Math.max(0, (moveEvent.clientX - rect.left) / pxFactor);
            const snapped = getSnapCandidate(item.id, current).snapped;
            const nextDraft = { ...subtaskDraftRef.current, endDay: snapped };
            subtaskDraftRef.current = nextDraft;
            setSubtaskDraft(nextDraft);
        };

        const handleMouseUp = () => {
            const finalDraft = subtaskDraftRef.current;
            if (finalDraft && onCreateSubtask) {
                const rawStart = Math.min(finalDraft.startDay, finalDraft.endDay);
                const rawEnd = Math.max(finalDraft.startDay, finalDraft.endDay);
                const startSnap = getSnapCandidate(finalDraft.itemId, rawStart);
                const endSnap = getSnapCandidate(finalDraft.itemId, rawEnd);
                const start = startSnap.within ? startSnap.snapped : rawStart;
                const end = endSnap.within ? endSnap.snapped : rawEnd;
                const duration = Math.max(0.1, Math.abs(end - start));
                if (!hasSubtaskOverlap(finalDraft.itemId, start, duration) && !overlapsCriticalPath(finalDraft.itemId, start, duration)) {
                    onCreateSubtask(finalDraft.itemId, start, duration);
                }
            }
            setSubtaskDraft(null);
            subtaskDraftRef.current = null;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [subtaskMode, rowH, itemsWithTiming, pxFactor, onCreateSubtask, hasSubtaskOverlap, getSnapCandidate]);

    const handleCanvasClick = useCallback(() => {
        if (onSelectSubtask) onSelectSubtask(null);
    }, [onSelectSubtask]);

    const renderSubtask = (subtask) => {
        const itemData = itemIndexById.get(subtask.itemId);
        if (!itemData) return null;

        const index = itemData.index;
        const height = 6;
        const top = (index * rowH) + rowCenter - (height / 2);
        const labelTop = (index * rowH);
        const leftPx = subtask.startDay * pxFactor;
        const widthPx = Math.max(subtask.durationDays * pxFactor, 6);
        const isSelected = selectedSubtaskId === subtask.id;

        const handleDragStart = (e, mode) => {
            e.preventDefault();
            e.stopPropagation();
            if (onSelectSubtask) onSelectSubtask(subtask.id);

            const startX = e.clientX;
            const startY = e.clientY;
            const startDay = subtask.startDay;
            const durationDays = subtask.durationDays;
            const endDay = startDay + durationDays;
            const startLeftPx = startDay * pxFactor;
            const startWidthPx = durationDays * pxFactor;
            const containerRect = chartAreaRef.current?.getBoundingClientRect();

            const handleMouseMove = (moveEvent) => {
                const deltaX = moveEvent.clientX - startX;

                if (mode === 'move') {
                    let nextItemId = subtask.itemId;
                    if (containerRect) {
                        const deltaY = moveEvent.clientY - startY;
                        const nextRowIndex = Math.max(0, Math.min(itemsWithTiming.length - 1, Math.floor((startY + deltaY - containerRect.top) / rowH)));
                        const rowItem = itemsWithTiming[nextRowIndex];
                        if (rowItem && rowItem.id) {
                            nextItemId = rowItem.id;
                        }
                    }
                    const rawStart = Math.max(0, (startLeftPx + deltaX) / pxFactor);
                    const startSnap = getSnapCandidate(nextItemId, rawStart, subtask.id);
                    const endSnap = getSnapCandidate(nextItemId, rawStart + durationDays, subtask.id);
                    let newStart = rawStart;
                    if (endSnap.within && (!startSnap.within || endSnap.diff < startSnap.diff)) {
                        newStart = endSnap.snapped - durationDays;
                    } else if (startSnap.within) {
                        newStart = startSnap.snapped;
                    }
                    if (hasSubtaskOverlap(nextItemId, newStart, durationDays, subtask.id)) return;
                    if (overlapsCriticalPath(nextItemId, newStart, durationDays)) return;
                    if (onUpdateSubtask) onUpdateSubtask(subtask.id, { startDay: newStart, itemId: nextItemId });
                    return;
                }

                if (mode === 'resize-start') {
                    const rawStart = Math.max(0, (startLeftPx + deltaX) / pxFactor);
                    const startSnap = getSnapCandidate(subtask.itemId, rawStart, subtask.id);
                    const newStart = startSnap.within ? startSnap.snapped : rawStart;
                    const nextDuration = Math.max(0.1, endDay - newStart);
                    if (hasSubtaskOverlap(subtask.itemId, newStart, nextDuration, subtask.id)) return;
                    if (overlapsCriticalPath(subtask.itemId, newStart, nextDuration)) return;
                    if (onUpdateSubtask) onUpdateSubtask(subtask.id, { startDay: newStart, durationDays: nextDuration });
                    return;
                }

                if (mode === 'resize-end') {
                    const rawEnd = Math.max(0, (startWidthPx + deltaX) / pxFactor) + startDay;
                    const endSnap = getSnapCandidate(subtask.itemId, rawEnd, subtask.id);
                    const snappedEnd = endSnap.within ? endSnap.snapped : rawEnd;
                    const nextDuration = Math.max(0.1, snappedEnd - startDay);
                    if (hasSubtaskOverlap(subtask.itemId, startDay, nextDuration, subtask.id)) return;
                    if (overlapsCriticalPath(subtask.itemId, startDay, nextDuration)) return;
                    if (onUpdateSubtask) onUpdateSubtask(subtask.id, { durationDays: nextDuration });
                }
            };

            const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        };

        return (
            <div key={subtask.id}>
                <div
                    className={`absolute text-[10px] font-bold truncate px-1 whitespace-nowrap pointer-events-none
                        ${isSelected ? 'text-slate-800' : 'text-slate-600'}
                    `}
                    style={{ left: `${leftPx}px`, top: `${labelTop}px`, width: 'max-content' }}
                >
                    {subtask.label || "부공종"}
                </div>
                <div
                    className={`absolute rounded-full cursor-grab select-none pointer-events-auto group/row
                        ${isSelected ? 'bg-slate-600/90 text-white ring-2 ring-slate-300' : 'bg-slate-300/90 text-slate-900'}
                    `}
                    style={{ left: `${leftPx}px`, top: `${top}px`, height: `${height}px`, width: `${widthPx}px` }}
                    onMouseDown={(e) => handleDragStart(e, 'move')}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        setRenameModal({ open: true, id: subtask.id, value: subtask.label || "부공종" });
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectSubtask) onSelectSubtask(subtask.id);
                    }}
                >
                <div
                    className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-slate-500 cursor-ew-resize pointer-events-auto"
                    onMouseDown={(e) => handleDragStart(e, 'resize-start')}
                />
                <div
                    className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-slate-500 cursor-ew-resize pointer-events-auto"
                    onMouseDown={(e) => handleDragStart(e, 'resize-end')}
                />
                {linkMode && (
                    <>
                        <button
                            type="button"
                            className="absolute -top-4 left-0 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-white shadow-[0_0_6px_rgba(251,191,36,0.45)] z-30 opacity-0 group-hover/row:opacity-100 transition-opacity"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onLinkAnchorClick) onLinkAnchorClick(subtask.id, "start");
                            }}
                            onClickCapture={(e) => handleLinkAnchorClick(e, subtask.id, "start")}
                            onClick={(e) => {
                                if (linkDrag) return;
                                handleLinkDragStart(e, subtask.id, "start");
                            }}
                            data-link-id={subtask.id}
                            data-link-anchor="start"
                            aria-label="Link start"
                        />
                        <button
                            type="button"
                            className="absolute -top-4 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-white shadow-[0_0_6px_rgba(251,191,36,0.45)] z-30 opacity-0 group-hover/row:opacity-100 transition-opacity"
                            style={{ left: "100%" }}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onLinkAnchorClick) onLinkAnchorClick(subtask.id, "end");
                            }}
                            onClickCapture={(e) => handleLinkAnchorClick(e, subtask.id, "end")}
                            onClick={(e) => {
                                if (linkDrag) return;
                                handleLinkDragStart(e, subtask.id, "end");
                            }}
                            data-link-id={subtask.id}
                            data-link-anchor="end"
                            aria-label="Link end"
                        />
                    </>
                )}
                {isSelected && (
                    <button
                        type="button"
                        className="absolute -right-3 -top-4 w-4 h-4 rounded-full bg-white text-slate-700 border border-slate-300 text-[10px] leading-[14px] shadow-sm pointer-events-auto z-50"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onDeleteSubtask) onDeleteSubtask(subtask.id);
                        }}
                        aria-label="부공종 삭제"
                    >
                        ×
                    </button>
                )}
                </div>
            </div>
        );
    };
    return (
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
                        <div key={i} style={{ width: pixelsPerUnit }} className={`border-r border-gray-200 h-full ${bg}`}></div>
                    );
                })}
            </div>

            {/* Dependency Links */}
            <svg
                className="absolute inset-0 z-20 pointer-events-none"
                style={{ width: '100%', height: itemsWithTiming.length * rowH }}
            >
                <defs>
                    <marker id="arrowhead-link" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
                    </marker>
                </defs>
                <style>{`
                    .gantt-link-path {
                        stroke-dasharray: 6 4;
                        animation: gantt-link-dash 2.2s linear infinite;
                    }
                    @keyframes gantt-link-dash {
                        to { stroke-dashoffset: -20; }
                    }
                `}</style>
                {Array.isArray(links) && links.map((link) => {
                    const fromTask = itemIndexById.get(link.from);
                    const toTask = itemIndexById.get(link.to);
                    const fromSub = subtaskIndexById.get(link.from);
                    const toSub = subtaskIndexById.get(link.to);
                    if (!fromTask && !fromSub) return null;
                    if (!toTask && !toSub) return null;

                    const anchors = deriveAnchorForType(link.type);
                    const lagValue = parseFloat(link.lag) || 0;

                    const fromX = fromTask
                        ? getAnchorX(fromTask.item, anchors.from)
                        : getSubtaskAnchorX(fromSub.subtask, anchors.from);
                    const toXBase = toTask
                        ? getAnchorX(toTask.item, anchors.to)
                        : getSubtaskAnchorX(toSub.subtask, anchors.to);
                    const toX = toXBase + (lagValue * pxFactor);

                    const fromY = getAnchorY((fromTask || fromSub).index);
                    const toY = getAnchorY((toTask || toSub).index);
                    const linkOffset = anchors.from === "start" ? -10 : 10;
                    const path = buildLinkPath(fromX, fromY, toX, toY, anchors.from, linkOffset);
                    const isSelected = link.id === selectedLinkId;
                    return (
                        <g key={link.id}>
                            <path
                                d={path}
                                fill="none"
                                stroke={isSelected ? "#f59e0b" : "#94a3b8"}
                                strokeWidth={isSelected ? 2.6 : 2}
                                markerEnd="url(#arrowhead-link)"
                                className="opacity-90 gantt-link-path"
                                pointerEvents="none"
                            />
                            <path
                                d={path}
                                fill="none"
                                stroke="transparent"
                                strokeWidth="10"
                                pointerEvents="stroke"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onLinkClick) onLinkClick(link.id, e.clientX, e.clientY);
                                }}
                            />
                        </g>
                    );
                })}
                {linkDrag && (
                    <path
                        d={buildLinkPath(
                            linkDrag.fromX,
                            linkDrag.fromY,
                            linkDrag.x,
                            linkDrag.y,
                            linkDrag.fromAnchor,
                            linkDrag.fromAnchor === "start" ? -10 : 10
                        )}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2.5"
                        strokeDasharray="6 4"
                        className="opacity-90"
                        pointerEvents="none"
                    />
                )}
            </svg>

            {/* Critical Path Lines (CP) */}
            <svg className="absolute inset-0 pointer-events-none z-30" style={{ width: '100%', height: itemsWithTiming.length * rowH }}>
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

                    // Calculate RED end (excluding grey periods)
                    const frontParallel = parseFloat(item.front_parallel_days) || 0;
                    const backParallel = parseFloat(item.back_parallel_days) || 0;
                    const taskStart = item.startDay;
                    const taskEnd = item.startDay + item.durationDays;
                    const redStart = taskStart + frontParallel;
                    const redEnd = taskEnd - backParallel;

                    const hasCriticalSegment = redEnd > redStart;
                    // Check if THIS task is marked as parallel task (병행작업)
                    // NOTE: We check 'remarks' field, not parallel days, because:
                    // - CP tasks can also have parallel days (when overlapping with other tasks)
                    // - Only tasks explicitly marked as '병행작업' should skip arrow drawing
                    // If there is no red segment at all, treat as parallel for CP arrows.
                    const isParallelTask = item.remarks === '병행작업' || !hasCriticalSegment;

                    // DEBUG: Log remarks value for debugging
                    if (item.process === '기초공사' && item.work_type?.includes('거푸집')) {
                        console.log('[ARROW DEBUG] 거푸집 task:', {
                            id: item.id,
                            process: item.process,
                            work_type: item.work_type,
                            remarks: item.remarks,
                            remarks_type: typeof item.remarks,
                            remarks_exact: JSON.stringify(item.remarks),
                            isParallelTask,
                            shouldSkipArrow: isParallelTask
                        });
                    }

                    // Don't draw arrow from parallel (병행) tasks
                    if (isParallelTask) return null;

                    // Also check if task is enclosed
                    const prevItem = i > 0 ? itemsWithTiming[i - 1] : null;
                    const prevEnd = prevItem ? prevItem.startDay + prevItem.durationDays : 0;
                    const isCurrentEnclosed = prevEnd > taskEnd;

                    // Don't draw arrow from enclosed tasks
                    if (isCurrentEnclosed) return null;

                    // Find the next CP task to connect to (skip enclosed and parallel tasks)
                    let targetIndex = i + 1;
                    let targetItem = itemsWithTiming[targetIndex];

                    // Skip over:
                    // 1. Enclosed tasks (completely within current task's timeline)
                    // 2. Parallel tasks (marked as '병행작업') - but only if they're NOT the immediate next task
                    while (targetItem) {
                        const targetFrontParallel = parseFloat(targetItem.front_parallel_days) || 0;
                        const targetBackParallel = parseFloat(targetItem.back_parallel_days) || 0;
                        const targetRedStartLoop = targetItem.startDay + targetFrontParallel;
                        const targetRedEndLoop = (targetItem.startDay + targetItem.durationDays) - targetBackParallel;
                        const targetHasCriticalLoop = targetRedEndLoop > targetRedStartLoop;

                        if (
                            redEnd <= (targetItem.startDay + targetItem.durationDays) &&
                            targetItem.remarks !== '병행작업' &&
                            targetHasCriticalLoop
                        ) {
                            break;
                        }

                        targetIndex++;
                        targetItem = itemsWithTiming[targetIndex];
                    }

                    // If no valid target found, don't draw arrow
                    if (!targetItem) return null;

                    // Calculate target's RED start
                    const targetFrontParallel = parseFloat(targetItem.front_parallel_days) || 0;
                    const targetRedStart = targetItem.startDay + targetFrontParallel;

                    // Arrow connects from current RED end to target RED start
                    const startX = redEnd * pxFactor;
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
                            {(() => {
                                const contained = containedCpMap.get(item.id) || [];
                                if (contained.length === 0) return null;
                                return contained.map((entry) => {
                                    const innerIndex = itemIndexById.get(entry.item.id)?.index;
                                    if (innerIndex === undefined) return null;
                                    const downX = entry.meta.redStart * pxFactor;
                                    const upX = entry.meta.redEnd * pxFactor;
                                    const outerY = (i * rowH) + rowCenter;
                                    const innerY = (innerIndex * rowH) + rowCenter;
                                    return (
                                        <g key={`cp-detour-${item.id}-${entry.item.id}`}>
                                            <path
                                                d={`M ${downX} ${outerY} L ${downX} ${innerY}`}
                                                fill="none"
                                                stroke="#ef4444"
                                                strokeWidth="2.5"
                                                strokeDasharray="4 3"
                                                markerEnd="url(#arrowhead-red)"
                                            />
                                            <path
                                                d={`M ${upX} ${innerY} L ${upX} ${outerY}`}
                                                fill="none"
                                                stroke="#ef4444"
                                                strokeWidth="2.5"
                                                strokeDasharray="4 3"
                                                markerEnd="url(#arrowhead-red)"
                                            />
                                        </g>
                                    );
                                });
                            })()}
                        </g>
                    );
                })}

                {/* Category Completion Milestones */}
                {categoryMilestones.map((milestone, idx) => {
                    const pxFactor = pixelsPerUnit / dateScale;
                    const rowH = 44;
                    const milestoneX = milestone.endDay * pxFactor;
                    const milestoneY = (milestone.rowIndex * rowH) + 22;

                    // console.log(`🔶 Rendering milestone ${idx}:`, milestone.category, `X=${milestoneX}, Y=${milestoneY}, endDay=${milestone.endDay}`);

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
            <div ref={chartAreaRef} className="relative" onMouseDown={handleCanvasClick}>
                {/* Subtask Layer */}
                <div
                    className="absolute inset-0 z-40 pointer-events-none"
                    style={{ height: `${itemsWithTiming.length * rowH}px` }}
                >
                    {(subTasks || []).map((subtask) => renderSubtask(subtask))}
                    {subtaskDraft && (() => {
                        const itemData = itemIndexById.get(subtaskDraft.itemId);
                        if (!itemData) return null;
                        const start = Math.min(subtaskDraft.startDay, subtaskDraft.endDay);
                        const duration = Math.max(1, Math.abs(subtaskDraft.endDay - subtaskDraft.startDay));
                        const height = 6;
                        const top = (itemData.index * rowH) + rowCenter - (height / 2);
                        return (
                            <div
                                className="absolute rounded-full bg-slate-400/60"
                                style={{
                                    left: `${start * pxFactor}px`,
                                    top: `${top}px`,
                                    height: `${height}px`,
                                    width: `${Math.max(duration * pxFactor, 6)}px`
                                }}
                            />
                        );
                    })()}
                </div>

                {/* Subtask Draw Overlay */}
                <div
                    className={`absolute inset-0 z-30 ${subtaskMode ? 'cursor-crosshair' : 'pointer-events-none'}`}
                    style={{ height: `${itemsWithTiming.length * rowH}px` }}
                    onMouseDown={handleSubtaskDrawStart}
                />

                {itemsWithTiming.map((item, index) => {
                    const taskStart = item.startDay;
                    const taskEnd = item.startDay + item.durationDays;

                    // Use stored parallel periods (default to 0)
                    const frontParallel = parseFloat(item.front_parallel_days) || 0;
                    const backParallel = parseFloat(item.back_parallel_days) || 0;

                    // Calculate red (critical path) segment
                    const redS = taskStart + frontParallel;
                    const redE = taskEnd - backParallel;

                    // Debug logging - ALWAYS log for earth-1
                    if (item.id === 'earth-1') {
                        console.log(`[Grey Segments DEBUG] earth-1:`, {
                            taskStart,
                            taskEnd,
                            frontParallel,
                            backParallel,
                            redStart: redS,
                            redEnd: redE,
                            totalDuration: item.durationDays,
                            item_data: {
                                front_parallel_days: item.front_parallel_days,
                                back_parallel_days: item.back_parallel_days
                            }
                        });
                    }

                    return (
                        <SmartGanttBar
                            key={item.id}
                            item={item}
                            startDay={item.startDay}
                            durationDays={item.durationDays}
                            pixelsPerUnit={pixelsPerUnit}
                            dateScale={dateScale}
                            onBarDragStart={onBarDragStart}
                            onBarResize={onBarResize}
                            onBarResizing={onBarResizing}
                            setPopoverState={setPopoverState}
                            redStartDay={redS}
                            redEndDay={redE}
                            selectedItemId={selectedItemId}
                            onItemClick={onItemClick}
                            linkMode={linkMode}
                            onLinkAnchorClick={onLinkAnchorClick}
                            onLinkDragStart={handleLinkDragStart}
                            onLinkAnchorComplete={handleLinkAnchorClick}
                            linkDragActive={!!linkDrag}
                            aiPreview={aiPreviewMap.get(item.id)}
                            aiActive={aiActiveItemId === item.id}
                            greySegments={(containedCpMap.get(item.id) || []).map((entry) => ({
                                start: entry.meta.redStart,
                                end: entry.meta.redEnd
                            }))}
                            dataChartRow
                        />
                    );
                })}
            </div>
            <SubtaskNameModal
                isOpen={renameModal.open}
                value={renameModal.value}
                onChange={(value) => setRenameModal((prev) => ({ ...prev, value }))}
                onClose={() => setRenameModal({ open: false, id: null, value: "" })}
                onSubmit={() => {
                    if (renameModal.id && onUpdateSubtask) {
                        const label = renameModal.value.trim() || "부공종";
                        onUpdateSubtask(renameModal.id, { label });
                    }
                    setRenameModal({ open: false, id: null, value: "" });
                }}
            />
        </div>
    );
};

export default GanttChartArea;
