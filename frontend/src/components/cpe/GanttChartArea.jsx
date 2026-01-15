import React from "react";
import SmartGanttBar from "./SmartGanttBar";

const GanttChartArea = ({
    timeline,
    dailyLoads,
    pixelsPerUnit,
    dateScale,
    itemsWithTiming,
    categoryMilestones,
    onBarDragStart,
    onBarResize,
    onBarResizing,
    setPopoverState,
    selectedItemId,
    onItemClick
}) => {
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
                            onBarDragStart={onBarDragStart}
                            onBarResize={onBarResize}
                            onBarResizing={onBarResizing}
                            setPopoverState={setPopoverState}
                            redStartDay={redS}
                            redEndDay={redE}
                            selectedItemId={selectedItemId}
                            onItemClick={onItemClick}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default GanttChartArea;
