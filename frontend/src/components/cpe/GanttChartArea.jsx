import React from "react";
import SmartGanttBar from "./SmartGanttBar";

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
    selectedLinkId
}) => {
    const rowH = 44;
    const rowCenter = 22;
    const pxFactor = pixelsPerUnit / dateScale;
    const itemIndexById = new Map(itemsWithTiming.map((item, index) => [item.id, { item, index }]));
    const getAnchorX = (itemData, anchor) => {
        const startX = itemData.startDay * pxFactor;
        const endX = (itemData.startDay + itemData.durationDays) * pxFactor;
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
    const buildLinkPath = (fromX, fromY, toX, toY, fromAnchor) => {
        // 앵커 기준 판단:
        // - start에서 시작: 그래프 시작 지점 → Y축 먼저 (세로→가로)
        // - end에서 시작: 그래프 끝 지점 → X축 먼저 (가로→세로)

        if (fromAnchor === "start") {
            // 그래프 시작에서 출발: Y축 먼저
            return `M ${fromX} ${fromY} L ${fromX} ${toY} L ${toX} ${toY}`;
        } else {
            // 그래프 끝(end)에서 출발: X축 먼저
            return `M ${fromX} ${fromY} L ${toX} ${fromY} L ${toX} ${toY}`;
        }
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
                className={`absolute inset-0 z-20 ${linkMode ? "pointer-events-auto" : "pointer-events-none"}`}
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
                    const fromData = itemIndexById.get(link.from);
                    const toData = itemIndexById.get(link.to);
                    if (!fromData || !toData) return null;
                    const anchors = deriveAnchorForType(link.type);
                    const fromX = getAnchorX(fromData.item, anchors.from);
                    const lagValue = parseFloat(link.lag) || 0;
                    const toX = getAnchorX(toData.item, anchors.to) + (lagValue * pxFactor);
                    const fromY = getAnchorY(fromData.index);
                    const toY = getAnchorY(toData.index);
                    const path = buildLinkPath(fromX, fromY, toX, toY, anchors.from);
                    const isSelected = link.id === selectedLinkId;
                    return (
                        <g key={link.id}>
                            <path
                                d={path}
                                fill="none"
                                stroke={isSelected ? "#2563eb" : "#94a3b8"}
                                strokeWidth={isSelected ? 2.5 : 2}
                                markerEnd="url(#arrowhead-link)"
                                className="opacity-90 gantt-link-path"
                            />
                            <path
                                d={path}
                                fill="none"
                                stroke="transparent"
                                strokeWidth="10"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onLinkClick) onLinkClick(link.id, e.clientX, e.clientY);
                                }}
                            />
                        </g>
                    );
                })}
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
                    const rowH = 44;
                    const rowCenter = 22;

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
            <div className="relative py-1">
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
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default GanttChartArea;
