import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { getCategoryColor } from "./ganttUtils";

const SmartGanttBar = ({
    item,
    startDay,
    durationDays,
    pixelsPerUnit,
    dateScale,
    onBarDragStart,
    onBarResize,
    onResizing,
    setPopoverState,
    redStartDay,
    redEndDay,
    selectedItemId,
    onItemClick,
    linkMode,
    onLinkAnchorClick,
    onLinkDragStart,
    linkDragActive,
    onLinkAnchorComplete,
    aiPreview,
    aiActive
}) => {
    const [isResizing, setIsResizing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [hasMoved, setHasMoved] = useState(false); // Track if drag actually moved

    // Temp states for live preview
    const [tempDuration, setTempDuration] = useState(null);
    const tempDurationRef = useRef(null);
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
        setHasMoved(false);
        const startX = e.clientX;
        const startLeftPx = leftPx;

        const handleMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            if (Math.abs(deltaX) > 2) setHasMoved(true); // movement threshold

            const newLeftPx = Math.max(0, startLeftPx + deltaX);
            const newStartDay = Math.round((newLeftPx / pixelsPerUnit) * dateScale);
            setTempStartDay(newStartDay);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            if (hasMoved && tempStartDay !== null) {
                onBarDragStart(item.id, tempStartDay);
                setTempStartDay(null);
            } else if (!hasMoved) {
                // It was a click, not a drag
                if (onItemClick) onItemClick(item.id, 'chart');
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
            tempDurationRef.current = newDuration;
            if (onResizing) {
                onResizing(item.id, newDuration, moveEvent.clientX, moveEvent.clientY);
            }
        };

        const handleMouseUp = (moveEvent) => {
            setIsResizing(false);
            const finalDuration = tempDurationRef.current ?? tempDuration;
            if (finalDuration !== null) {
                // Pass coordinates to parent for Popover positioning
                onBarResize(item.id, finalDuration, moveEvent.clientX, moveEvent.clientY);

                setTempDuration(null);
                tempDurationRef.current = null;
            }
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div id={`chart-item-${item.id}`} className={`relative h-11 border-b border-gray-50/50 group/row hover:bg-slate-50 transition-colors ${selectedItemId === item.id ? 'bg-violet-50/50' : ''}`}>

            {/* Task Label (Floating Above) */}
            <div
                className={`absolute top-0 text-[10px] font-bold truncate px-1 whitespace-nowrap pointer-events-none z-10 
                    ${selectedItemId === item.id ? 'text-violet-700' : 'text-slate-800'}`}
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
                className={`absolute top-2 h-7 flex items-center cursor-grab z-10 ${aiActive ? "ring-2 ring-blue-400/80" : ""}`}
                style={{
                    left: `${leftPx}px`,
                    width: `${widthPx}px`,
                }}
                onMouseDown={handleBarDrag}
            >
                {/* 1. Multi-segment Line (Grey-Red-Grey) */}
                {(() => {
                    // This logic seems specific to the original component's state, specifically redStartDay/redEndDay passed as props
                    const taskEnd = startDay + durationDays;
                    const relRedStart = Math.min(durationDays, Math.max(0, redStartDay - startDay));
                    const relRedEnd = Math.min(durationDays, Math.max(relRedStart, redEndDay - startDay));
                    const s1 = (relRedStart / durationDays) * 100;
                    const s2 = ((relRedEnd - relRedStart) / durationDays) * 100;
                    const s3 = 100 - (s1 + s2);

                    return (
                        <div className={`absolute top-1/2 left-0 right-0 h-1.5 -translate-y-1/2 rounded-full overflow-hidden flex shadow-sm ring-1 ring-black/5
                            ${isDragging || isResizing || selectedItemId === item.id ? 'ring-2 ring-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.3)]' : ''}`}>
                            {s1 > 0 && <div className="h-full bg-slate-400" style={{ width: `${s1}%` }} />}
                            {s2 > 0 && <div className="h-full bg-red-600" style={{ width: `${s2}%` }} />}
                            {s3 > 0 && <div className="h-full bg-slate-400" style={{ width: `${s3}%` }} />}
                            {s1 <= 0 && s2 <= 0 && s3 <= 0 && <div className="h-full w-full bg-slate-400" />}
                        </div>
                    );
                })()}

                {aiPreview && (
                    <div
                        className="absolute inset-0 border border-dashed border-blue-400/80 rounded-full pointer-events-none"
                        style={{ transform: "translateY(-50%)", top: "50%" }}
                    ></div>
                )}

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

                {linkMode && (
                <>
                    <button
                        type="button"
                        className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-white shadow-[0_0_6px_rgba(251,191,36,0.45)] z-30 opacity-0 group-hover/row:opacity-100 transition-opacity"
                        style={{ left: `${leftPx}px` }}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onLinkAnchorClick) onLinkAnchorClick(item.id, "start");
                        }}
                        onClickCapture={(e) => {
                            if (linkDragActive && onLinkAnchorComplete) {
                                onLinkAnchorComplete(e, item.id, "start");
                                return;
                            }
                            if (linkDragActive) return;
                            if (onLinkDragStart) onLinkDragStart(e, item.id, "start");
                        }}
                        data-link-id={item.id}
                        data-link-anchor="start"
                        aria-label="Link start"
                    />
                    <button
                        type="button"
                        className="absolute top-0 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-white shadow-[0_0_6px_rgba(251,191,36,0.45)] z-30 opacity-0 group-hover/row:opacity-100 transition-opacity"
                        style={{ left: `${leftPx + widthPx}px` }}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onLinkAnchorClick) onLinkAnchorClick(item.id, "end");
                        }}
                        onClickCapture={(e) => {
                            if (linkDragActive && onLinkAnchorComplete) {
                                onLinkAnchorComplete(e, item.id, "end");
                                return;
                            }
                            if (linkDragActive) return;
                            if (onLinkDragStart) onLinkDragStart(e, item.id, "end");
                        }}
                        data-link-id={item.id}
                        data-link-anchor="end"
                        aria-label="Link end"
                    />
                </>
            )}

        </div>
    );
};

export default SmartGanttBar;
