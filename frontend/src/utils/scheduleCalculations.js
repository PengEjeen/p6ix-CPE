/**
 * Schedule Calculation Utilities
 * Extracted from ScheduleMasterList.jsx
 */
import { deriveParallelMeta, getParallelSegmentsFromItem } from "./parallelSegments";

const SINGLE_TOTAL_CATEGORY_PATTERN = /준비|마감/;

const normalizeCategory = (category) => String(category || "기타");

const parseManualCategoryTotalDays = (value) => {
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parseFloat(parsed.toFixed(1));
};

export const isSingleTotalInputCategory = (category) => {
    return SINGLE_TOTAL_CATEGORY_PATTERN.test(normalizeCategory(category));
};

export const getCategoryManualTotalDays = (items) => {
    if (!Array.isArray(items) || items.length === 0) return null;
    for (const item of items) {
        const manual = parseManualCategoryTotalDays(item?.category_total_days);
        if (manual !== null) return manual;
    }
    return null;
};

const buildEffectiveItemsForTotalDays = (items) => {
    if (!Array.isArray(items) || items.length === 0) return [];

    const categoryMetaMap = new Map();
    items.forEach((item) => {
        const category = normalizeCategory(item?.main_category);
        const currentMeta = categoryMetaMap.get(category);
        const manualDays = parseManualCategoryTotalDays(item?.category_total_days);
        if (!currentMeta) {
            categoryMetaMap.set(category, {
                manualDays: manualDays,
                singleInput: isSingleTotalInputCategory(category)
            });
            return;
        }
        if (currentMeta.manualDays === null && manualDays !== null) {
            currentMeta.manualDays = manualDays;
        }
    });

    const consumedSpecialCategory = new Set();
    const effectiveItems = [];

    items.forEach((item) => {
        const category = normalizeCategory(item?.main_category);
        const categoryMeta = categoryMetaMap.get(category);
        if (!categoryMeta || !categoryMeta.singleInput || categoryMeta.manualDays === null) {
            effectiveItems.push(item);
            return;
        }

        if (consumedSpecialCategory.has(category)) {
            return;
        }
        consumedSpecialCategory.add(category);
        effectiveItems.push({
            ...item,
            calendar_days: categoryMeta.manualDays,
            parallel_segments: [],
            front_parallel_days: 0,
            back_parallel_days: 0
        });
    });

    return effectiveItems;
};

/**
 * Calculate total calendar days for a list of schedule items
 * @param {Array} items - Schedule items
 * @returns {number} Total calendar days
 */
export const calculateTotalCalendarDays = (items) => {
    const effectiveItems = buildEffectiveItemsForTotalDays(items);
    let cumulativeCPEnd = 0;
    let maxEnd = 0;
    effectiveItems.forEach((item, index) => {
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
    const effectiveItems = buildEffectiveItemsForTotalDays(items);
    let cumulativeCPEnd = 0;
    const criticalIds = [];
    effectiveItems.forEach((item, index) => {
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
