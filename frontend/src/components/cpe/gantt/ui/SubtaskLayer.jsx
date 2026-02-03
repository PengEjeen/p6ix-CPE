import React from "react";

export default function SubtaskLayer({
    subTasks,
    subtaskDraft,
    selectedSubtaskIds,
    onSelectSubtask,
    onUpdateSubtask,
    onDeleteSubtask,
    onLinkAnchorClick,
    onLinkDragStart,
    onLinkAnchorComplete,
    linkMode,
    linkDrag,
    selectedItemIds,
    onGroupDrag,
    onGroupDragPreview,
    onGroupDragEnd,
    onMoveSubtasks,
    itemsWithTiming,
    itemIndexById,
    pxFactor,
    rowH,
    rowCenter,
    chartAreaRef,
    getSnapCandidate,
    hasSubtaskOverlap,
    overlapsCriticalPath,
    setRenameModal
}) {
    const dragSuppressRef = React.useRef(false);
    const renderSubtask = (subtask) => {
        const itemData = itemIndexById.get(subtask.itemId);
        if (!itemData) return null;

        const index = itemData.index;
        const height = 6;
        const parentItem = itemsWithTiming.find((item) => item.id === subtask.itemId);
        const frontParallel = parseFloat(parentItem?.front_parallel_days) || 0;
        const backParallel = parseFloat(parentItem?.back_parallel_days) || 0;
        const redStart = (parentItem?.startDay || 0) + frontParallel;
        const redEnd = (parentItem?.startDay || 0) + (parentItem?.durationDays || 0) - backParallel;
        const subtaskStart = subtask.startDay;
        const subtaskEnd = subtask.startDay + subtask.durationDays;
        const overlapsCp = redEnd > redStart && subtaskStart < redEnd && subtaskEnd > redStart;
        const yOffset = overlapsCp ? 8 : 0;
        const top = (index * rowH) + rowCenter - (height / 2) + yOffset;
        const labelTop = (index * rowH) + yOffset;
        const leftPx = subtask.startDay * pxFactor;
        const widthPx = Math.max(subtask.durationDays * pxFactor, 6);
        const isSelected = Array.isArray(selectedSubtaskIds) && selectedSubtaskIds.includes(subtask.id);

        const handleDragStart = (e, mode) => {
            e.preventDefault();
            e.stopPropagation();
            dragSuppressRef.current = false;
            // Selection handled on click; avoid toggling during drag start.
            if (mode === "move"
                && Array.isArray(selectedSubtaskIds)
                && selectedSubtaskIds.length > 1
                && selectedSubtaskIds.includes(subtask.id)) {
                return;
            }

            const startX = e.clientX;
            const startY = e.clientY;
            const startDay = subtask.startDay;
            const durationDays = subtask.durationDays;
            const endDay = startDay + durationDays;
            const startLeftPx = startDay * pxFactor;
            const startWidthPx = durationDays * pxFactor;
            const containerRect = chartAreaRef.current?.getBoundingClientRect();

            const groupDragActive = mode === "move"
                && onGroupDrag
                && Array.isArray(selectedItemIds)
                && selectedItemIds.length > 0
                && selectedItemIds.includes(subtask.itemId)
                && (!Array.isArray(selectedSubtaskIds) || selectedSubtaskIds.length === 0);
            let groupDelta = 0;
            let groupMoved = false;

            const groupSubtaskActive = mode === "move"
                && Array.isArray(selectedSubtaskIds)
                && selectedSubtaskIds.length > 1
                && selectedSubtaskIds.includes(subtask.id)
                && onMoveSubtasks;
            const groupSubtaskBase = groupSubtaskActive
                ? new Map(selectedSubtaskIds.map((id) => {
                    const current = (subTasks || []).find((s) => s.id === id);
                    return [id, current ? current.startDay : 0];
                }))
                : null;

            const handleMouseMove = (moveEvent) => {
                const deltaX = moveEvent.clientX - startX;
                const deltaY = moveEvent.clientY - startY;
                if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
                    dragSuppressRef.current = true;
                }

                if (mode === "move") {
                    if (groupSubtaskActive) {
                        const groupSubtaskDelta = deltaX / pxFactor;
                        const updates = selectedSubtaskIds.map((id) => ({
                            id,
                            startDay: (groupSubtaskBase?.get(id) ?? 0) + groupSubtaskDelta
                        }));
                        onMoveSubtasks(updates);
                        return;
                    }
                    if (groupDragActive) {
                        const rawStart = (startLeftPx + deltaX) / pxFactor;
                        groupDelta = rawStart - startDay;
                        if (Math.abs(deltaX) > 2) groupMoved = true;
                        if (onGroupDragPreview) {
                            onGroupDragPreview(groupDelta);
                        }
                        return;
                    }
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

                if (mode === "resize-start") {
                    const rawStart = Math.max(0, (startLeftPx + deltaX) / pxFactor);
                    const startSnap = getSnapCandidate(subtask.itemId, rawStart, subtask.id);
                    const newStart = startSnap.within ? startSnap.snapped : rawStart;
                    const nextDuration = Math.max(0.1, endDay - newStart);
                    if (hasSubtaskOverlap(subtask.itemId, newStart, nextDuration, subtask.id)) return;
                    if (overlapsCriticalPath(subtask.itemId, newStart, nextDuration)) return;
                    if (onUpdateSubtask) onUpdateSubtask(subtask.id, { startDay: newStart, durationDays: nextDuration });
                    return;
                }

                if (mode === "resize-end") {
                    const rawEnd = Math.max(0, (startWidthPx + deltaX) / pxFactor) + startDay;
                    const endSnap = getSnapCandidate(subtask.itemId, rawEnd, subtask.id);
                    const snappedEnd = endSnap.within ? endSnap.snapped : rawEnd;
                    const nextDuration = Math.max(0.1, snappedEnd - startDay);
                    if (hasSubtaskOverlap(subtask.itemId, startDay, nextDuration)) return;
                    if (overlapsCriticalPath(subtask.itemId, startDay, nextDuration)) return;
                    if (onUpdateSubtask) onUpdateSubtask(subtask.id, { durationDays: nextDuration });
                }
            };

            const handleMouseUp = () => {
                if (groupSubtaskActive) {
                    // no-op: final state already applied during drag
                }
                if (groupDragActive) {
                    if (onGroupDragPreview) {
                        if (onGroupDragEnd) onGroupDragEnd();
                    } else if (groupMoved && groupDelta) {
                        onGroupDrag(groupDelta);
                    }
                }
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
            };

            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
        };

        return (
            <div key={subtask.id}>
                <div
                    className={`absolute text-[10px] font-bold truncate px-1 whitespace-nowrap pointer-events-auto
                        ${isSelected ? "text-slate-800" : "text-slate-600"}
                    `}
                    style={{ left: `${leftPx}px`, top: `${labelTop}px`, width: "max-content" }}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    onClick={(e) => {
                        if (dragSuppressRef.current) {
                            dragSuppressRef.current = false;
                            return;
                        }
                        if (onSelectSubtask) onSelectSubtask(subtask.id, e);
                    }}
                >
                    {subtask.label || "부공종"}
                </div>
                <div
                    className={`absolute rounded-full cursor-grab select-none pointer-events-auto group/row
                        ${isSelected ? "bg-slate-600/90 text-white ring-2 ring-slate-300" : "bg-slate-300/90 text-slate-900"}
                    `}
                    style={{ left: `${leftPx}px`, top: `${top}px`, height: `${height}px`, width: `${widthPx}px` }}
                    data-subtask-item="true"
                    onMouseDown={(e) => handleDragStart(e, "move")}
                    onClick={(e) => {
                        if (dragSuppressRef.current) {
                            dragSuppressRef.current = false;
                            return;
                        }
                        if (onSelectSubtask) onSelectSubtask(subtask.id, e);
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        setRenameModal({ open: true, id: subtask.id, value: subtask.label || "부공종" });
                    }}
                >
                    <div
                        className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-slate-500 cursor-ew-resize pointer-events-auto"
                        data-subtask-item="true"
                        onMouseDown={(e) => handleDragStart(e, "resize-start")}
                    />
                    <div
                        className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-slate-500 cursor-ew-resize pointer-events-auto"
                        data-subtask-item="true"
                        onMouseDown={(e) => handleDragStart(e, "resize-end")}
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
                                onClickCapture={(e) => onLinkAnchorComplete && onLinkAnchorComplete(e, subtask.id, "start")}
                                onClick={(e) => {
                                    if (linkDrag) return;
                                    if (onLinkDragStart) onLinkDragStart(e, subtask.id, "start");
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
                                onClickCapture={(e) => onLinkAnchorComplete && onLinkAnchorComplete(e, subtask.id, "end")}
                                onClick={(e) => {
                                    if (linkDrag) return;
                                    if (onLinkDragStart) onLinkDragStart(e, subtask.id, "end");
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
    );
}
