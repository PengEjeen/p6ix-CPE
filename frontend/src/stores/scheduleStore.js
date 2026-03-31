import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';
import { calculateItem, solveForCrewSize, solveForProductivity } from '../utils/solver';
import { buildParallelStateFromSegments, buildRightAlignedParallelSegments } from '../utils/parallelSegments';

const clampRate = (value, fallback = 100) => {
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(100, Math.max(0, parseFloat(parsed.toFixed(1))));
};

const displayParallelRateFromApplication = (applicationRate, cpChecked = true) => {
    if (!cpChecked) return 100;
    const normalizedApplication = clampRate(applicationRate, 100);
    return clampRate(100 - normalizedApplication, 0);
};

const applicationRateFromDisplayParallel = (parallelRate) => {
    const normalizedParallel = clampRate(parallelRate, 0);
    return clampRate(100 - normalizedParallel, 100);
};

const normalizeCpState = (item) => {
    const cpChecked = item?.cp_checked !== false;
    if (!cpChecked) {
        return {
            ...item,
            cp_checked: false,
            parallel_segments: [],
            front_parallel_days: 0,
            back_parallel_days: 0,
            parallel_rate: 100,
            application_rate: 100
        };
    }

    const normalizedApplicationRate = clampRate(
        item?.application_rate ?? item?.parallel_rate,
        100
    );
    return {
        ...item,
        cp_checked: true,
        parallel_rate: displayParallelRateFromApplication(normalizedApplicationRate, true),
        application_rate: normalizedApplicationRate
    };
};

const deriveParallelRateFromParallel = (item, frontDays, backDays) => {
    const duration = parseFloat(item?.calendar_days) || 0;
    if (duration <= 0) return 100;

    const front = Math.max(0, parseFloat(frontDays) || 0);
    const back = Math.max(0, parseFloat(backDays) || 0);
    const criticalDays = Math.max(0, duration - front - back);
    const rate = (criticalDays / duration) * 100;

    return parseFloat(rate.toFixed(1));
};

const clearLegacyParallelMarkers = (item) => {
    if (!item || typeof item !== "object") return;
    if (String(item.remarks || "").trim() === "병행작업") {
        item.remarks = "";
    }
    if (Object.prototype.hasOwnProperty.call(item, "_parallelGroup")) {
        item._parallelGroup = null;
    }
    if (Object.prototype.hasOwnProperty.call(item, "parallelGroup")) {
        item.parallelGroup = null;
    }
    if (Object.prototype.hasOwnProperty.call(item, "parallel_group")) {
        item.parallel_group = null;
    }
    if (item.is_parallelism === true) {
        item.is_parallelism = false;
    }
};

const buildUpdatedItem = (item, field, value, operatingRates, workDayType) => {
    if (!item) return item;

    const nextItem = {
        ...item,
        [field]: value
    };

    if (field === 'cp_checked' && value === false) {
        nextItem.parallel_segments = [];
        nextItem.front_parallel_days = 0;
        nextItem.back_parallel_days = 0;
        nextItem.parallel_rate = 100;
        nextItem.application_rate = 100;
    }
    if ((field === 'application_rate' || field === 'parallel_rate') && nextItem.cp_checked === false) {
        nextItem.parallel_segments = [];
        nextItem.front_parallel_days = 0;
        nextItem.back_parallel_days = 0;
        nextItem.parallel_rate = 100;
        nextItem.application_rate = 100;
    }
    if (nextItem.cp_checked !== false && field === 'parallel_rate') {
        const nextDisplayRate = clampRate(value, 0);
        nextItem.parallel_rate = nextDisplayRate;
        nextItem.application_rate = applicationRateFromDisplayParallel(nextDisplayRate);
    }
    if (nextItem.cp_checked !== false && field === 'application_rate') {
        const nextApplicationRate = clampRate(value, 100);
        nextItem.application_rate = nextApplicationRate;
        nextItem.parallel_rate = displayParallelRateFromApplication(nextApplicationRate, true);
    }

    const calculatedItem = calculateItem(
        nextItem,
        operatingRates,
        workDayType
    );

    if ((field === 'application_rate' || field === 'parallel_rate') && calculatedItem.cp_checked !== false) {
        const duration = parseFloat(calculatedItem?.calendar_days) || 0;
        const inputApplicationRate = field === 'parallel_rate'
            ? applicationRateFromDisplayParallel(value)
            : clampRate(value, 100);
        const rightAlignedSegments = buildRightAlignedParallelSegments(duration, inputApplicationRate);
        const parallelState = buildParallelStateFromSegments(duration, rightAlignedSegments);
        calculatedItem.parallel_segments = parallelState.parallel_segments;
        calculatedItem.front_parallel_days = parallelState.front_parallel_days;
        calculatedItem.back_parallel_days = parallelState.back_parallel_days;
        calculatedItem.parallel_rate = displayParallelRateFromApplication(parallelState.application_rate, true);
        calculatedItem.application_rate = parallelState.application_rate;
    } else if (field === 'cp_checked' && calculatedItem.cp_checked === false) {
        calculatedItem.parallel_segments = [];
        calculatedItem.front_parallel_days = 0;
        calculatedItem.back_parallel_days = 0;
        calculatedItem.parallel_rate = 100;
        calculatedItem.application_rate = 100;
    }

    return calculatedItem;
};

/**
 * Schedule Store
 * - Manages the list of schedule items
 * - Handles inverse calculation logic
 * - Synchronizes state between Grid and Gantt views
 */
export const useScheduleStore = create(
    temporal(
        immer((set, get) => ({
            // State
            items: [],
            links: [],
            subTasks: [],
            operatingRates: [],
            workDayType: '6d', // '5d', '6d', '7d'
            ganttDateScale: 1,

            // Actions
            setItems: (items) => set((state) => {
                const safeItems = Array.isArray(items) ? items : [];
                state.items = safeItems.map(normalizeCpState);
            }),
            setLinks: (links) => set((state) => {
                state.links = links;
            }),
            setSubTasks: (subTasks) => set((state) => {
                state.subTasks = subTasks || [];
            }),

            setOperatingRates: (rates) => set((state) => {
                state.operatingRates = rates;
                // Re-calculate all items when rates change
                state.items = state.items.map(item =>
                    calculateItem(item, rates, state.workDayType)
                );
            }),

            updateOperatingRate: (main_category, work_week_days) => set((state) => {
                // Find and update the specific category's run rate
                const index = state.operatingRates.findIndex(r => r.main_category === main_category);
                if (index !== -1) {
                    state.operatingRates[index].work_week_days = work_week_days;
                } else {
                    // If not found, create a new entry
                    state.operatingRates.push({
                        main_category,
                        work_week_days,
                        operating_rate: 100 // Default, will be recalculated by backend
                    });
                }
                // Re-calculate all items in this category
                state.items = state.items.map(item =>
                    calculateItem(item, state.operatingRates, state.workDayType)
                );
            }),

            setWorkDayType: (type) => set((state) => {
                state.workDayType = type;
                // Re-calculate all items when work day type changes
                state.items = state.items.map(item =>
                    calculateItem(item, state.operatingRates, type)
                );
            }),
            setGanttDateScale: (scale) => set((state) => {
                state.ganttDateScale = scale;
            }),

            // Individual Item Update (from Table)
            updateItem: (id, field, value) => set((state) => {
                const index = state.items.findIndex(i => i.id === id);
                if (index !== -1) {
                    state.items[index] = buildUpdatedItem(
                        state.items[index],
                        field,
                        value,
                        state.operatingRates,
                        state.workDayType
                    );
                }
            }),

            updateItemsField: (ids, field, value) => set((state) => {
                if (!Array.isArray(ids) || ids.length === 0) return;
                const idSet = new Set(ids.map((id) => String(id)));

                state.items.forEach((item, index) => {
                    if (!idSet.has(String(item.id))) return;
                    state.items[index] = buildUpdatedItem(
                        state.items[index],
                        field,
                        value,
                        state.operatingRates,
                        state.workDayType
                    );
                });
            }),

            applyItemFieldChanges: (changes) => set((state) => {
                if (!Array.isArray(changes) || changes.length === 0) return;

                const groupedChanges = new Map();
                changes.forEach((change) => {
                    if (!change?.id || !change?.field) return;
                    const key = String(change.id);
                    if (!groupedChanges.has(key)) {
                        groupedChanges.set(key, []);
                    }
                    groupedChanges.get(key).push(change);
                });

                if (groupedChanges.size === 0) return;

                state.items.forEach((item, index) => {
                    const itemChanges = groupedChanges.get(String(item.id));
                    if (!itemChanges || itemChanges.length === 0) return;

                    let nextItem = state.items[index];
                    itemChanges.forEach((change) => {
                        nextItem = buildUpdatedItem(
                            nextItem,
                            change.field,
                            change.value,
                            state.operatingRates,
                            state.workDayType
                        );
                    });
                    state.items[index] = nextItem;
                });
            }),

            // Add New Item
            addItem: (newItem) => set((state) => {
                // Initial calculation
                const calculated = calculateItem(newItem, state.operatingRates, state.workDayType);
                state.items.push(calculated);
            }),

            // Add Item at Index (for inserting below parent)
            addItemAtIndex: (newItem, index) => set((state) => {
                const calculated = calculateItem(newItem, state.operatingRates, state.workDayType);
                state.items.splice(index, 0, calculated);
            }),

            deleteItem: (id) => set((state) => {
                state.items = state.items.filter(i => i.id !== id);
                state.links = state.links.filter(l => l.from !== id && l.to !== id);
                state.subTasks = state.subTasks.filter(s => s.itemId !== id);
            }),

            deleteItems: (ids) => set((state) => {
                if (!Array.isArray(ids) || ids.length === 0) return;
                const idSet = new Set(ids);
                state.items = state.items.filter(i => !idSet.has(i.id));
                state.links = state.links.filter(l => !idSet.has(l.from) && !idSet.has(l.to));
                state.subTasks = state.subTasks.filter(s => !idSet.has(s.itemId));
            }),

            addLink: (link) => set((state) => {
                state.links.push(link);
            }),

            updateLink: (id, updates) => set((state) => {
                const index = state.links.findIndex(l => l.id === id);
                if (index !== -1) {
                    state.links[index] = { ...state.links[index], ...updates };
                }
            }),

            deleteLink: (id) => set((state) => {
                state.links = state.links.filter(l => l.id !== id);
            }),

            reorderItems: (newItems) => set((state) => {
                state.items = newItems;
            }),

            addSubTask: (subtask) => set((state) => {
                state.subTasks.push(subtask);
            }),

            updateSubTask: (id, updates) => set((state) => {
                const index = state.subTasks.findIndex(s => s.id === id);
                if (index !== -1) {
                    state.subTasks[index] = { ...state.subTasks[index], ...updates };
                }
            }),

            moveSubTasks: (updates) => set((state) => {
                if (!Array.isArray(updates) || updates.length === 0) return;
                updates.forEach((update) => {
                    const index = state.subTasks.findIndex(s => s.id === update.id);
                    if (index !== -1 && update.startDay !== undefined) {
                        state.subTasks[index].startDay = Math.max(0, update.startDay);
                    }
                });
            }),

            shiftSubTasksForItem: (itemId, deltaDays) => set((state) => {
                if (!itemId || !deltaDays) return;
                state.subTasks.forEach((subtask) => {
                    if (subtask.itemId === itemId) {
                        subtask.startDay = Math.max(0, (subtask.startDay || 0) + deltaDays);
                    }
                });
            }),

            deleteSubTask: (id) => set((state) => {
                state.subTasks = state.subTasks.filter(s => s.id !== id);
            }),

            // Smart Actions (Inverse Calculation)

            /**
             * Resize Task Bar (Logic A: Crew Adjustment)
             * - Updates calendar_days
             * - Triggers inverse calculation for Crew Size
             * - Optionally resets productivity to baseProductivity
             */
            resizeTaskBar: (id, newCalendarDays, baseProductivity = null) => set((state) => {
                const index = state.items.findIndex(i => i.id === id);
                if (index === -1) return;

                const item = state.items[index];

                // 1. Run Solver (Logic A: Adjust Crew Size)
                const solvedItem = solveForCrewSize(item, newCalendarDays, baseProductivity);

                // Step 2: Update State with new Crew Size & Productivity
                state.items[index].crew_size = solvedItem.crew_size;
                state.items[index].productivity = solvedItem.productivity; // Reset productivity if changed
                state.items[index].calendar_days = newCalendarDays; // Optimistic update

                // Step 3: Full Recalculate to ensure consistency
                state.items[index] = calculateItem(
                    state.items[index],
                    state.operatingRates,
                    state.workDayType
                );
            }),

            /**
             * Resize Task Bar (Logic B: Productivity Adjustment)
             * - Updates calendar_days
             * - Triggers inverse calculation for Productivity
             */
            resizeTaskBarByProductivity: (id, newCalendarDays) => set((state) => {
                const index = state.items.findIndex(i => i.id === id);
                if (index === -1) return;

                const item = state.items[index];

                // 1. Run Solver (Logic B: Adjust Productivity)
                const solvedItem = solveForProductivity(item, newCalendarDays);

                // Step 2: Update State with new Productivity
                state.items[index].productivity = solvedItem.productivity;
                state.items[index].calendar_days = newCalendarDays;

                // Step 3: Recalculate
                state.items[index] = calculateItem(
                    state.items[index],
                    state.operatingRates,
                    state.workDayType
                );
            }),

            /**
             * Update Parallel Periods (Overlap Management)
             * New structure: overlaps = [{ withTaskId, frontDays, backDays }]
             */
            updateParallelPeriods: (id, frontDays, backDays) => {
                console.log('[Store] updateParallelPeriods called:', { id, frontDays, backDays });

                set((state) => {
                    const index = state.items.findIndex(i => i.id === id);
                    if (index === -1) return;

                    const item = state.items[index];

                    if (item?.cp_checked === false) {
                        state.items[index] = {
                            ...item,
                            parallel_segments: [],
                            front_parallel_days: 0,
                            back_parallel_days: 0,
                            parallel_rate: 100,
                            application_rate: 100
                        };
                        clearLegacyParallelMarkers(state.items[index]);
                        return;
                    }

                    // If both are 0, remove all overlaps for this task
                    if (frontDays === 0 && backDays === 0) {
                        console.log('[Store] Clearing all overlaps for:', id);
                        const newItems = state.items.map((item, idx) =>
                            idx === index
                                ? {
                                    ...item,
                                    parallel_segments: [],
                                    front_parallel_days: 0,
                                    back_parallel_days: 0,
                                    parallel_rate: 0,
                                    application_rate: 100
                                }
                                : item
                        );
                        state.items = newItems;
                        clearLegacyParallelMarkers(state.items[index]);
                        return;
                    }

                    // Otherwise, set the parallel days
                    console.log('[Store] Setting parallel days for:', id);
                    const nextFront = frontDays || 0;
                    const nextBack = backDays || 0;
                    const duration = parseFloat(item?.calendar_days) || 0;
                    const implicitSegments = [];
                    if (nextFront > 0) implicitSegments.push({ start: 0, end: nextFront });
                    if (nextBack > 0) implicitSegments.push({ start: Math.max(0, duration - nextBack), end: duration });
                    const parallelState = buildParallelStateFromSegments(duration, implicitSegments);
                    const newItems = state.items.map((item, idx) =>
                        idx === index
                            ? {
                                ...item,
                                parallel_segments: parallelState.parallel_segments,
                                front_parallel_days: nextFront,
                                back_parallel_days: nextBack,
                                parallel_rate: displayParallelRateFromApplication(parallelState.application_rate, true),
                                application_rate: parallelState.application_rate
                            }
                            : item
                    );

                    state.items = newItems;
                    const nextItem = state.items[index];
                    const hasSegments = Array.isArray(nextItem?.parallel_segments) && nextItem.parallel_segments.length > 0;
                    const normalizedFront = parseFloat(nextItem?.front_parallel_days) || 0;
                    const normalizedBack = parseFloat(nextItem?.back_parallel_days) || 0;
                    if (!hasSegments && normalizedFront <= 0 && normalizedBack <= 0) {
                        clearLegacyParallelMarkers(nextItem);
                    }
                });
            },

            /**
             * Move Task Bar (Gantt Interaction)
             * - Updates start date (custom start day)
             */
            moveTaskBar: (id, newStartDay) => set((state) => {
                const index = state.items.findIndex(i => i.id === id);
                if (index !== -1) {
                    state.items[index]._startDay = newStartDay;
                }
            }),

            moveTaskBars: (updates) => set((state) => {
                if (!Array.isArray(updates) || updates.length === 0) return;
                updates.forEach((update) => {
                    const index = state.items.findIndex(i => i.id === update.id);
                    if (index !== -1) {
                        state.items[index]._startDay = update.newStartDay;
                    }
                });
            }),

            /**
             * Atomic Drag Resolution (for Undo/Redo)
             * Handles position update and parallel updates in one go.
             * parallelUpdates: [{ id, front, back }, ...]
             */
            resolveDragOverlap: (draggedId, newStartDay, parallelUpdates) => set((state) => {
                console.log('[Store] resolveDragOverlap:', { draggedId, newStartDay, parallelUpdates });

                // 1. Move Task
                if (draggedId && newStartDay !== null && newStartDay !== undefined) {
                    const idx = state.items.findIndex(i => String(i.id) === String(draggedId));
                    if (idx !== -1) {
                        state.items[idx]._startDay = newStartDay;
                    }
                }

                // 2. Update Parallel Periods
                if (parallelUpdates && parallelUpdates.length > 0) {
                    parallelUpdates.forEach(update => {
                        const idx = state.items.findIndex(i => String(i.id) === String(update.id));
                        if (idx !== -1) {
                            if (state.items[idx]?.cp_checked === false) {
                                state.items[idx].parallel_segments = [];
                                state.items[idx].front_parallel_days = 0;
                                state.items[idx].back_parallel_days = 0;
                                state.items[idx].parallel_rate = 100;
                                state.items[idx].application_rate = 100;
                                clearLegacyParallelMarkers(state.items[idx]);
                                return;
                            }
                            // If explicit value provided (including 0), set it.
                            if (update.front !== undefined) state.items[idx].front_parallel_days = update.front;
                            if (update.back !== undefined) state.items[idx].back_parallel_days = update.back;

                            const duration = parseFloat(state.items[idx]?.calendar_days) || 0;
                            let derivedFromSegments = null;
                            if (update.parallel_segments !== undefined) {
                                const parallelState = buildParallelStateFromSegments(duration, update.parallel_segments);
                                state.items[idx].parallel_segments = parallelState.parallel_segments;
                                if (update.front === undefined) state.items[idx].front_parallel_days = parallelState.front_parallel_days;
                                if (update.back === undefined) state.items[idx].back_parallel_days = parallelState.back_parallel_days;
                                derivedFromSegments = parallelState.application_rate;
                            } else if (update.front !== undefined || update.back !== undefined) {
                                const nextFront = parseFloat(state.items[idx].front_parallel_days) || 0;
                                const nextBack = parseFloat(state.items[idx].back_parallel_days) || 0;
                                const implicitSegments = [];
                                if (nextFront > 0) implicitSegments.push({ start: 0, end: nextFront });
                                if (nextBack > 0) implicitSegments.push({ start: Math.max(0, duration - nextBack), end: duration });
                                const parallelState = buildParallelStateFromSegments(duration, implicitSegments);
                                state.items[idx].parallel_segments = parallelState.parallel_segments;
                                derivedFromSegments = parallelState.application_rate;
                            }

                            const normalizedFront = Math.max(0, parseFloat(state.items[idx].front_parallel_days) || 0);
                            const normalizedBack = Math.max(0, parseFloat(state.items[idx].back_parallel_days) || 0);
                            const updateSegments = update.parallel_segments;
                            const hasNoSegments = (
                                updateSegments === undefined
                                || (Array.isArray(updateSegments) && updateSegments.length === 0)
                            );
                            // Rule: when overlap is released, parallel rate must return to 0.
                            if (normalizedFront <= 0 && normalizedBack <= 0 && hasNoSegments) {
                                state.items[idx].parallel_segments = [];
                                state.items[idx].application_rate = 100;
                                state.items[idx].parallel_rate = 0;
                                clearLegacyParallelMarkers(state.items[idx]);
                                return;
                            }

                            const explicitRate = parseFloat(update.parallel_rate ?? update.application_rate);
                            const explicitApplicationRate = parseFloat(update.application_rate);
                            if (Number.isFinite(explicitApplicationRate)) {
                                const nextApplicationRate = clampRate(explicitApplicationRate, 100);
                                state.items[idx].application_rate = nextApplicationRate;
                                state.items[idx].parallel_rate = displayParallelRateFromApplication(nextApplicationRate, true);
                            } else if (Number.isFinite(explicitRate)) {
                                const nextDisplayRate = clampRate(explicitRate, 0);
                                state.items[idx].parallel_rate = nextDisplayRate;
                                state.items[idx].application_rate = applicationRateFromDisplayParallel(nextDisplayRate);
                            } else if (derivedFromSegments !== null) {
                                state.items[idx].application_rate = derivedFromSegments;
                                state.items[idx].parallel_rate = displayParallelRateFromApplication(derivedFromSegments, true);
                            } else {
                                const nextFront = parseFloat(state.items[idx].front_parallel_days) || 0;
                                const nextBack = parseFloat(state.items[idx].back_parallel_days) || 0;
                                const derivedApplicationRate = deriveParallelRateFromParallel(
                                    state.items[idx],
                                    nextFront,
                                    nextBack
                                );
                                state.items[idx].application_rate = derivedApplicationRate;
                                state.items[idx].parallel_rate = displayParallelRateFromApplication(derivedApplicationRate, true);
                            }

                            const hasSegments = Array.isArray(state.items[idx].parallel_segments) && state.items[idx].parallel_segments.length > 0;
                            const nextFront = parseFloat(state.items[idx].front_parallel_days) || 0;
                            const nextBack = parseFloat(state.items[idx].back_parallel_days) || 0;
                            if (!hasSegments && nextFront <= 0 && nextBack <= 0) {
                                clearLegacyParallelMarkers(state.items[idx]);
                            }
                        }
                    });
                }
            }),

            // --- Snapshot / History Management ---
            snapshots: [],

            addSnapshot: (label) => set((state) => {
                const snapshot = {
                    id: `snap-${Date.now()}`,
                    timestamp: Date.now(),
                    label: label || `Snapshot ${new Date().toLocaleTimeString()}`,
                    data: state.items // Immer handles deep copy/proxy, but to be safe we might want to ensure it's detached if strictly needed. 
                    // However, Zundo/Immer usually handles this. Structure-sharing is fine.
                };
                state.snapshots.unshift(snapshot); // Add to top
                if (state.snapshots.length > 20) state.snapshots.pop(); // Limit to 20
            }),

            restoreSnapshot: (id) => set((state) => {
                const snapshot = state.snapshots.find(s => s.id === id);
                if (snapshot) {
                    state.items = snapshot.data;
                }
            }),

            deleteSnapshot: (id) => set((state) => {
                state.snapshots = state.snapshots.filter(s => s.id !== id);
            })
        })),
        { limit: 50 } // Keep 50 steps
    )
);
