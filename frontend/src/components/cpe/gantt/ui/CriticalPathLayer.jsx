import React from "react";

export default function CriticalPathLayer({
    itemsWithTiming,
    pixelsPerUnit,
    dateScale,
    rowH,
    rowCenter,
    containedCpMap,
    itemIndexById,
    categoryMilestones
}) {
    return (
        <svg className="absolute inset-0 pointer-events-none z-10" style={{ width: "100%", height: itemsWithTiming.length * rowH }}>
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
                const isParallelTask = item.remarks === "병행작업" || !hasCriticalSegment;

                if (isParallelTask) return null;

                const prevItem = i > 0 ? itemsWithTiming[i - 1] : null;
                const prevEnd = prevItem ? prevItem.startDay + prevItem.durationDays : 0;
                const isCurrentEnclosed = prevEnd > taskEnd;
                if (isCurrentEnclosed) return null;

                let targetIndex = i + 1;
                let targetItem = itemsWithTiming[targetIndex];

                while (targetItem) {
                    const targetFrontParallel = parseFloat(targetItem.front_parallel_days) || 0;
                    const targetBackParallel = parseFloat(targetItem.back_parallel_days) || 0;
                    const targetRedStartLoop = targetItem.startDay + targetFrontParallel;
                    const targetRedEndLoop = (targetItem.startDay + targetItem.durationDays) - targetBackParallel;
                    const targetHasCriticalLoop = targetRedEndLoop > targetRedStartLoop;

                    if (
                        redEnd <= (targetItem.startDay + targetItem.durationDays) &&
                        targetItem.remarks !== "병행작업" &&
                        targetHasCriticalLoop
                    ) {
                        break;
                    }

                    targetIndex++;
                    targetItem = itemsWithTiming[targetIndex];
                }

                if (!targetItem) return null;

                const targetFrontParallel = parseFloat(targetItem.front_parallel_days) || 0;
                const targetRedStart = targetItem.startDay + targetFrontParallel;

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

            {categoryMilestones.map((milestone, idx) => {
                const pxFactor = pixelsPerUnit / dateScale;
                const milestoneX = milestone.endDay * pxFactor;
                const milestoneY = (milestone.rowIndex * rowH) + 22;

                return (
                    <g key={`milestone-${idx}`}>
                    </g>
                );
            })}
        </svg>
    );
}
