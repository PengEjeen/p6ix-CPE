import React, { useMemo, useRef, useState, useCallback, useEffect, useLayoutEffect } from "react";
import SmartGanttBar from "./SmartGanttBar";
import SubtaskNameModal from "./schedule/SubtaskNameModal";
import { getSelectionBoxIds } from "./gantt/controllers/selectionBox";
import LinkLayer from "./gantt/ui/LinkLayer.jsx";
import CriticalPathLayer from "./gantt/ui/CriticalPathLayer.jsx";
import SubtaskLayer from "./gantt/ui/SubtaskLayer.jsx";
import {
    buildCriticalSegmentsFromParallel,
    deriveParallelMeta,
    getParallelSegmentsFromItem,
    toAbsoluteParallelSegments
} from "../../utils/parallelSegments";

const GanttChartArea = ({
    timeline,
    dailyLoads,
    pixelsPerUnit,
    dateScale,
    itemsWithTiming,
    links,
    categoryMilestones,
    onBarDragStart,
    onBarDragPreview,
    onBarDragEnd,
    onBarResize,
    onBarResizing,
    setPopoverState,
    selectedItemIds,
    onItemClick,
    onSelectionChange,
    onGroupDrag,
    onGroupDragPreview,
    onGroupDragEnd,
    onMoveSubtasks,
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
    selectedSubtaskIds,
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
    const [subtaskDraft, setSubtaskDraft] = useState(null);
    const [selectionBox, setSelectionBox] = useState(null);
    const [linkDrag, setLinkDrag] = useState(null); // { fromId, fromAnchor, fromX, fromY, x, y }
    const [renameModal, setRenameModal] = useState({ open: false, id: null, value: "" });
    const pxFactor = pixelsPerUnit / dateScale;
    const itemIndexById = new Map(itemsWithTiming.map((item, index) => [item.id, { item, index }]));
    const subtaskIndexById = new Map((subTasks || []).map((subtask) => {
        const parent = itemIndexById.get(subtask.itemId);
        if (!parent) return null;
        return [subtask.id, { subtask, index: parent.index }];
    }).filter(Boolean));
    const subtaskDraftRef = useRef(null);
    const chartAreaRef = useRef(null);
    const selectionRef = useRef(null);

    const isParallelItem = useCallback((item) => {
        const remarksText = (item?.remarks || "").trim();
        return (
            remarksText === "병행작업"
            || Boolean(item?._parallelGroup)
            || Boolean(item?.parallelGroup)
            || Boolean(item?.parallel_group)
            || Boolean(item?.is_parallelism)
        );
    }, []);

    const getEffectiveRedRange = useCallback((item) => {
        const taskStart = parseFloat(item?.startDay) || 0;
        const durationDays = parseFloat(item?.durationDays) || 0;
        const taskEnd = taskStart + durationDays;
        const relativeParallelSegments = getParallelSegmentsFromItem(item, durationDays);
        const parallelMeta = deriveParallelMeta(durationDays, relativeParallelSegments);
        const rawRedStart = taskStart + parallelMeta.frontParallelDays;
        const rawRedEnd = taskEnd - parallelMeta.backParallelDays;
        const redStart = Math.max(taskStart, Math.min(taskEnd, rawRedStart));
        const redEnd = Math.max(redStart, Math.min(taskEnd, rawRedEnd));
        const parallelSegments = toAbsoluteParallelSegments(relativeParallelSegments, taskStart);
        const criticalSegments = buildCriticalSegmentsFromParallel(taskStart, durationDays, relativeParallelSegments);
        const hasCriticalSegment = criticalSegments.some((segment) => segment.end > segment.start);

        return { taskStart, taskEnd, redStart, redEnd, parallelSegments, criticalSegments, hasCriticalSegment };
    }, []);

    const cpMeta = useMemo(() => {
        const map = new Map();
        itemsWithTiming.forEach((item) => {
            const { redStart, redEnd, hasCriticalSegment } = getEffectiveRedRange(item);
            const isCp = !isParallelItem(item) && hasCriticalSegment;
            map.set(item.id, { redStart, redEnd, isCp });
        });
        return map;
    }, [itemsWithTiming, isParallelItem, getEffectiveRedRange]);

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
        const endDay = startDay + durationDays;
        const { criticalSegments } = getEffectiveRedRange(parent);
        return criticalSegments.some((segment) => startDay < segment.end && endDay > segment.start);
    }, [itemsWithTiming, getEffectiveRedRange]);

    const getSnapCandidate = useCallback((itemId, day, excludeSubtaskId = null) => {
        const snapThresholdPx = 14;
        const thresholdDays = snapThresholdPx / pxFactor;
        const candidates = [];
        const parent = itemsWithTiming.find((item) => item.id === itemId);
        if (parent) {
            const { criticalSegments } = getEffectiveRedRange(parent);
            criticalSegments.forEach((segment) => {
                candidates.push(segment.start, segment.end);
            });
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
    }, [itemsWithTiming, subTasks, pxFactor, getEffectiveRedRange]);

    // Snap to all task bar start/end positions for vertical alignment
    const getBarSnapCandidate = useCallback((day, excludeItemId = null) => {
        const snapThresholdPx = 14; // 14px threshold for snapping
        const thresholdDays = snapThresholdPx / pxFactor;
        const candidates = [];

        // Collect all task bar start and end positions
        itemsWithTiming.forEach((item) => {
            if (excludeItemId && item.id === excludeItemId) return;
            candidates.push(item.startDay);
            candidates.push(item.startDay + item.durationDays);

            // Also include red segments for more precise alignment
            const { criticalSegments } = getEffectiveRedRange(item);
            criticalSegments.forEach((segment) => {
                candidates.push(segment.start, segment.end);
            });
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
    }, [itemsWithTiming, pxFactor, getEffectiveRedRange]);

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

    const handleCanvasMouseDown = useCallback((e) => {
        if (subtaskMode) return;
        if (e.button !== 0) return;
        const targetEl = e.target?.nodeType === 1 ? e.target : e.target?.parentElement;
        if (!targetEl) return;
        if (targetEl.closest('[data-gantt-bar="true"]')) return;
        if (targetEl.closest('[data-link-id]')) return;
        if (targetEl.closest('[data-subtask-item="true"]')) return;

        if (onSelectSubtask) onSelectSubtask(null, e);
        if (onSelectionChange) onSelectionChange([]);
        return;

        const rect = chartAreaRef.current?.getBoundingClientRect();
        if (!rect) return;
        const startX = e.clientX - rect.left;
        const startY = e.clientY - rect.top;
        selectionRef.current = { startX, startY, moved: false, box: null };
        setSelectionBox({ x: startX, y: startY, width: 0, height: 0 });

        const handleMouseMove = (moveEvent) => {
            const currentX = moveEvent.clientX - rect.left;
            const currentY = moveEvent.clientY - rect.top;
            const width = currentX - startX;
            const height = currentY - startY;
            if (Math.abs(width) > 2 || Math.abs(height) > 2) {
                selectionRef.current.moved = true;
            }
            const nextBox = {
                x: width < 0 ? currentX : startX,
                y: height < 0 ? currentY : startY,
                width: Math.abs(width),
                height: Math.abs(height)
            };
            selectionRef.current.box = nextBox;
            setSelectionBox(nextBox);
        };

        const handleMouseUp = () => {
            const { moved } = selectionRef.current || {};
            if (!moved) {
                if (onSelectionChange) onSelectionChange([]);
                setSelectionBox(null);
                selectionRef.current = null;
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                return;
            }

            const box = selectionRef.current?.box || { x: startX, y: startY, width: 0, height: 0 };
            const nextSelected = getSelectionBoxIds({ itemsWithTiming, pxFactor, rowH, box });
            if (onSelectionChange) onSelectionChange(nextSelected);
            setSelectionBox(null);
            selectionRef.current = null;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [subtaskMode, onSelectSubtask, onSelectionChange, itemsWithTiming, pxFactor, rowH]);

    return (
        <div className="relative">
            {/* Grid Lines & Heatmap Background */}
            <div className="absolute inset-0 flex pointer-events-none h-full">
                {timeline.days.map((d, i) => {
                    const load = dailyLoads.get(d.actualDay) || 0;
                    // Heatmap logic
                    let bg = "";

                    // Season Logic
                    // d.date is expected to be a Date object
                    if (d.date) {
                        const month = d.date.getMonth() + 1; // 1-12
                        const isSummer = [6, 7, 8].includes(month);
                        const isWinter = [12, 1, 2].includes(month);

                        if (isSummer || isWinter) {
                            bg = "bg-yellow-100/20"; // Very pale yellow
                        }
                    }

                    // Overwrite with Heatmap if high load (optional priority)
                    if (load > 40) bg = "bg-red-50/50";
                    else if (load > 20) bg = "bg-amber-50/30";

                    return (
                        <div key={i} style={{ width: pixelsPerUnit }} className={`border-r border-gray-200 h-full ${bg}`}></div>
                    );
                })}
            </div>

            {/* Dependency Links */}
            <LinkLayer
                links={links}
                selectedLinkId={selectedLinkId}
                itemIndexById={itemIndexById}
                subtaskIndexById={subtaskIndexById}
                getAnchorX={getAnchorX}
                getSubtaskAnchorX={getSubtaskAnchorX}
                getAnchorY={getAnchorY}
                buildLinkPath={buildLinkPath}
                deriveAnchorForType={deriveAnchorForType}
                pxFactor={pxFactor}
                rowH={rowH}
                itemCount={itemsWithTiming.length}
                onLinkClick={onLinkClick}
                linkDrag={linkDrag}
            />

            {/* Critical Path Lines (CP) */}
            <CriticalPathLayer
                itemsWithTiming={itemsWithTiming}
                pixelsPerUnit={pixelsPerUnit}
                dateScale={dateScale}
                rowH={rowH}
                rowCenter={rowCenter}
                containedCpMap={containedCpMap}
                itemIndexById={itemIndexById}
                categoryMilestones={categoryMilestones}
            />

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
            <div ref={chartAreaRef} className="relative" onMouseDown={handleCanvasMouseDown}>
                {selectionBox && (
                    <div
                        className="absolute z-50 border-2 border-blue-400 bg-blue-200/20 pointer-events-none"
                        style={{
                            left: `${selectionBox.x}px`,
                            top: `${selectionBox.y}px`,
                            width: `${selectionBox.width}px`,
                            height: `${selectionBox.height}px`
                        }}
                    />
                )}
                {/* Subtask Layer */}
                <SubtaskLayer
                    subTasks={subTasks}
                    subtaskDraft={subtaskDraft}
                    selectedSubtaskIds={selectedSubtaskIds}
                    onSelectSubtask={onSelectSubtask}
                    onUpdateSubtask={onUpdateSubtask}
                    onDeleteSubtask={onDeleteSubtask}
                    onLinkAnchorClick={onLinkAnchorClick}
                    onLinkDragStart={handleLinkDragStart}
                    onLinkAnchorComplete={handleLinkAnchorClick}
                    linkMode={linkMode}
                    linkDrag={linkDrag}
                    selectedItemIds={selectedItemIds}
                    onGroupDrag={onGroupDrag}
                    onGroupDragPreview={onGroupDragPreview}
                    onGroupDragEnd={onGroupDragEnd}
                    onMoveSubtasks={onMoveSubtasks}
                    itemsWithTiming={itemsWithTiming}
                    itemIndexById={itemIndexById}
                    pxFactor={pxFactor}
                    rowH={rowH}
                    rowCenter={rowCenter}
                    chartAreaRef={chartAreaRef}
                    getSnapCandidate={getSnapCandidate}
                    hasSubtaskOverlap={hasSubtaskOverlap}
                    overlapsCriticalPath={overlapsCriticalPath}
                    setRenameModal={setRenameModal}
                />

                {/* Subtask Draw Overlay */}
                <div
                    className={`absolute inset-0 z-30 ${subtaskMode ? 'cursor-crosshair' : 'pointer-events-none'}`}
                    style={{ height: `${itemsWithTiming.length * rowH}px` }}
                    onMouseDown={handleSubtaskDrawStart}
                />

                {itemsWithTiming.map((item, index) => {
                    const { redStart: redS, redEnd: redE, parallelSegments } = getEffectiveRedRange(item);
                    const containedGrey = (containedCpMap.get(item.id) || []).map((entry) => ({
                        start: entry.meta.redStart,
                        end: entry.meta.redEnd
                    }));

                    return (
                        <SmartGanttBar
                            key={item.id}
                            item={item}
                            startDay={item.startDay}
                            durationDays={item.durationDays}
                            pixelsPerUnit={pixelsPerUnit}
                            dateScale={dateScale}
                            onBarDragStart={onBarDragStart}
                            onBarDragPreview={onBarDragPreview}
                            onBarDragEnd={onBarDragEnd}
                            onBarResize={onBarResize}
                            onBarResizing={onBarResizing}
                            setPopoverState={setPopoverState}
                            redStartDay={redS}
                            redEndDay={redE}
                            isSelected={Array.isArray(selectedItemIds) && selectedItemIds.includes(item.id)}
                            onItemClick={onItemClick}
                            linkMode={linkMode}
                            onLinkAnchorClick={onLinkAnchorClick}
                            onLinkDragStart={handleLinkDragStart}
                            onLinkAnchorComplete={handleLinkAnchorClick}
                            linkDragActive={!!linkDrag}
                            aiPreview={aiPreviewMap.get(item.id)}
                            aiActive={aiActiveItemId === item.id}
                            greySegments={[...parallelSegments, ...containedGrey]}
                            getBarSnapCandidate={getBarSnapCandidate}
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
