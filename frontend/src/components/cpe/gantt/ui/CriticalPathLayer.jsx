import React from "react";
import { deriveParallelMeta, getParallelSegmentsFromItem } from "../../../../utils/parallelSegments";

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
    const getEffectiveRedRange = (item) => {
        const taskStart = parseFloat(item?.startDay) || 0;
        const durationDays = parseFloat(item?.durationDays) || 0;
        const taskEnd = taskStart + durationDays;
        const customRedStart = Number(item?.cp_red_start);
        const customRedEnd = Number(item?.cp_red_end);
        if (Number.isFinite(customRedStart) && Number.isFinite(customRedEnd)) {
            const redStart = Math.max(taskStart, Math.min(taskEnd, customRedStart));
            const redEnd = Math.max(redStart, Math.min(taskEnd, customRedEnd));
            const hasCriticalSegment = typeof item?._hasCriticalSegment === "boolean"
                ? item._hasCriticalSegment && redEnd > redStart
                : redEnd > redStart;
            return { taskStart, taskEnd, redStart, redEnd, hasCriticalSegment };
        }

        const relativeParallelSegments = getParallelSegmentsFromItem(item, durationDays);
        const parallelMeta = deriveParallelMeta(durationDays, relativeParallelSegments);
        const rawRedStart = taskStart + parallelMeta.frontParallelDays;
        const rawRedEnd = taskEnd - parallelMeta.backParallelDays;
        const redStart = Math.max(taskStart, Math.min(taskEnd, rawRedStart));
        const redEnd = Math.max(redStart, Math.min(taskEnd, rawRedEnd));
        const hasCriticalSegment = typeof item?._hasCriticalSegment === "boolean"
            ? item._hasCriticalSegment && redEnd > redStart
            : parallelMeta.criticalDays > 0;
        return { taskStart, taskEnd, redStart, redEnd, hasCriticalSegment };
    };

    const isParallelItem = (item) => {
        const remarksText = (item?.remarks || "").trim();

        // Check traditional parallel markers
        const hasParallelMarker = (
            remarksText === "병행작업"
            || Boolean(item?._parallelGroup)
            || Boolean(item?.parallelGroup)
            || Boolean(item?.parallel_group)
            || Boolean(item?.is_parallelism)
        );

        // Check if the task has parallel days that cover its entire duration
        const duration = item?.durationDays || 0;
        const relativeParallelSegments = getParallelSegmentsFromItem(item, duration);
        const parallelMeta = deriveParallelMeta(duration, relativeParallelSegments);
        const isFullyParallel = parallelMeta.parallelDays >= duration;

        return hasParallelMarker || isFullyParallel;
    };

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

                const { redStart, redEnd, hasCriticalSegment } = getEffectiveRedRange(item);

                // RELAXED: Treat any positive length as critical segment
                const hasLogicalCriticalSegment = redEnd > redStart;
                const isParallelTask = isParallelItem(item) || !hasCriticalSegment || !hasLogicalCriticalSegment;

                if (isParallelTask) return null;

                // Find next CP task only in lower rows (next process order).
                let targetIndex = -1;
                let targetItem = null;
                let minDistance = Infinity;
                let bestRowDelta = Infinity;

                // Only scan tasks below current row.
                for (let j = i + 1; j < itemsWithTiming.length; j++) {
                    const candidateItem = itemsWithTiming[j];
                    const { redStart: candidateRedStart, hasCriticalSegment: candidateHasCritical } = getEffectiveRedRange(candidateItem);

                    // Skip parallel tasks and tasks without critical segments
                    if (!isParallelItem(candidateItem) && candidateHasCritical) {
                        // Only connect to tasks that start after current task ends (forward only in time)
                        if (candidateRedStart >= redEnd) {
                            // Calculate distance on x-axis between current redEnd and candidate redStart
                            const distance = candidateRedStart - redEnd;
                            const rowDelta = j - i;

                            // 1) 최소 x축 거리 우선
                            // 2) 같은 거리면 더 가까운 아래 행 우선
                            if (distance < minDistance || (distance === minDistance && rowDelta < bestRowDelta)) {
                                minDistance = distance;
                                bestRowDelta = rowDelta;
                                targetIndex = j;
                                targetItem = candidateItem;
                            }
                        }
                    }
                }

                let cpPath = null;
                if (targetItem) {
                    const { redStart: targetRedStart } = getEffectiveRedRange(targetItem);
                    const startX = redEnd * pxFactor;
                    const startY = (i * rowH) + rowCenter;
                    const endX = targetRedStart * pxFactor;
                    const endY = (targetIndex * rowH) + rowCenter;
                    cpPath = `M ${startX} ${startY} L ${endX} ${startY} L ${endX} ${endY}`;
                }

                if (!cpPath) return null;

                return (
                    <g key={`cp-${i}`}>
                        {cpPath && (
                            <path
                                d={cpPath}
                                fill="none"
                                stroke="#ef4444"
                                strokeWidth="2.5"
                                strokeDasharray="4 3"
                                markerEnd="url(#arrowhead-red)"
                                className="opacity-100 mix-blend-multiply transition-all duration-300"
                            />
                        )}
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
