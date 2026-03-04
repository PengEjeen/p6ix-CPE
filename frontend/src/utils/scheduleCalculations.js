/**
 * Schedule Calculation Utilities
 * Extracted from ScheduleMasterList.jsx
 */
import { deriveParallelMeta, getParallelSegmentsFromItem } from "./parallelSegments";

/**
 * Calculate total calendar days for a list of schedule items
 * @param {Array} items - Schedule items
 * @returns {number} Total calendar days
 */
export const calculateTotalCalendarDays = (items) => {
    let cumulativeCPEnd = 0;
    let maxEnd = 0;
    items.forEach((item, index) => {
        const duration = parseFloat(item.calendar_days) || 0;
        const relativeParallelSegments = getParallelSegmentsFromItem(item, duration);
        const parallelMeta = deriveParallelMeta(duration, relativeParallelSegments);
        const frontParallel = parallelMeta.frontParallelDays;
        const backParallel = parallelMeta.backParallelDays;

        const startDay = item._startDay !== undefined && item._startDay !== null
            ? item._startDay
            : (index === 0 ? 0 : Math.max(0, cumulativeCPEnd - frontParallel));

        const taskEnd = startDay + duration;
        const rawRedStart = startDay + frontParallel;
        const redStart = Math.max(startDay, Math.min(taskEnd, rawRedStart));
        const rawCpEnd = taskEnd - backParallel;
        const cpEnd = Math.max(redStart, Math.min(taskEnd, rawCpEnd));
        cumulativeCPEnd = Math.max(cumulativeCPEnd, cpEnd);
        maxEnd = Math.max(maxEnd, startDay + duration);
    });
    return Math.max(0, Math.ceil(maxEnd));
};

/**
 * Calculate total calendar months from total days
 * @param {number} totalDays - Total calendar days
 * @returns {number} Total calendar months (rounded to 1 decimal)
 */
export const calculateTotalCalendarMonths = (totalDays) => {
    if (!totalDays) return 0;
    return Math.round((totalDays / 30) * 10) / 10;
};

/**
 * Get critical path item IDs from schedule items
 * @param {Array} items - Schedule items
 * @returns {Array} Array of critical item IDs
 */
export const getCriticalIds = (items) => {
    let cumulativeCPEnd = 0;
    const criticalIds = [];
    items.forEach((item, index) => {
        const duration = parseFloat(item.calendar_days) || 0;
        const relativeParallelSegments = getParallelSegmentsFromItem(item, duration);
        const parallelMeta = deriveParallelMeta(duration, relativeParallelSegments);
        const frontParallel = parallelMeta.frontParallelDays;
        const backParallel = parallelMeta.backParallelDays;

        const startDay = item._startDay !== undefined && item._startDay !== null
            ? item._startDay
            : (index === 0 ? 0 : Math.max(0, cumulativeCPEnd - frontParallel));

        const taskEnd = startDay + duration;
        const rawRedStart = startDay + frontParallel;
        const redStart = Math.max(startDay, Math.min(taskEnd, rawRedStart));
        const rawCpEnd = taskEnd - backParallel;
        const cpEnd = Math.max(redStart, Math.min(taskEnd, rawCpEnd));
        if (cpEnd >= cumulativeCPEnd && item.remarks !== "병행작업") {
            criticalIds.push(item.id);
        }
        cumulativeCPEnd = Math.max(cumulativeCPEnd, cpEnd);
    });
    return criticalIds;
};
