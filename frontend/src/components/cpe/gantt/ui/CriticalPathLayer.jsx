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
    const isParallelItem = (item) => {
        const remarksText = (item?.remarks || "").trim();
        return (
            remarksText === "병행작업"
            || Boolean(item?._parallelGroup)
            || Boolean(item?.parallelGroup)
            || Boolean(item?.parallel_group)
            || Boolean(item?.is_parallelism)
        );
    };

    const containedItemIds = new Set();
    if (containedCpMap) {
        containedCpMap.forEach((list) => {
            if (!Array.isArray(list)) return;
            list.forEach((entry) => {
                if (entry?.item?.id) containedItemIds.add(entry.item.id);
            });
        });
    }

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
                const isParallelTask = isParallelItem(item) || !hasCriticalSegment;

                if (isParallelTask) return null;

                // If this CP item is fully contained by another CP item,
                // its link is rendered via the outer item's down/up detour.
                if (containedItemIds.has(item.id)) return null;

                // Find the CP task with the minimum distance on x-axis (time)
                // Search ALL tasks (both above and below) to find temporally closest CP task
                let targetIndex = -1;
                let targetItem = null;
                let minDistance = Infinity;

                // Loop through ALL tasks to find the closest on x-axis
                for (let j = 0; j < itemsWithTiming.length; j++) {
                    // Skip the current item itself
                    if (j === i) continue;

                    const candidateItem = itemsWithTiming[j];

                    const candidateFrontParallel = parseFloat(candidateItem.front_parallel_days) || 0;
                    const candidateBackParallel = parseFloat(candidateItem.back_parallel_days) || 0;
                    const candidateRedStart = candidateItem.startDay + candidateFrontParallel;
                    const candidateRedEnd = (candidateItem.startDay + candidateItem.durationDays) - candidateBackParallel;
                    const candidateHasCritical = candidateRedEnd > candidateRedStart;

                    // Skip parallel tasks and tasks without critical segments
                    if (!isParallelItem(candidateItem) && candidateHasCritical) {
                        // Only connect to tasks that start after current task ends (forward only in time)
                        if (candidateRedStart >= redEnd) {
                            // Calculate distance on x-axis between current redEnd and candidate redStart
                            const distance = candidateRedStart - redEnd;

                            // Check if vertical arrow would overlap with intermediate task bars
                            // This is only necessary if the target is not adjacent (i.e., |i - j| > 1)
                            let hasOverlap = false;
                            if (Math.abs(i - j) > 1) {
                                // Check all tasks between current (i) and candidate (j)
                                const minRow = Math.min(i, j);
                                const maxRow = Math.max(i, j);

                                for (let k = minRow + 1; k < maxRow; k++) {
                                    const intermediateTask = itemsWithTiming[k];
                                    const intermediateStart = intermediateTask.startDay;
                                    const intermediateEnd = intermediateTask.startDay + intermediateTask.durationDays;

                                    // Check if intermediate task overlaps with the arrow path [redEnd, candidateRedStart]
                                    // Overlap occurs if: intermediateStart < candidateRedStart AND intermediateEnd > redEnd
                                    if (intermediateStart < candidateRedStart && intermediateEnd > redEnd) {
                                        hasOverlap = true;
                                        break;
                                    }
                                }
                            }

                            // Only accept this candidate if there's no overlap (or it's adjacent)
                            if (!hasOverlap && distance < minDistance) {
                                minDistance = distance;
                                targetIndex = j;
                                targetItem = candidateItem;
                            }
                        }
                    }
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
