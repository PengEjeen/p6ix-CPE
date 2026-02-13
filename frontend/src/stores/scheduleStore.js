import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';
import { calculateItem, solveForCrewSize, solveForProductivity } from '../utils/solver';
import { buildParallelStateFromSegments, buildRightAlignedParallelSegments } from '../utils/parallelSegments';

const deriveApplicationRateFromParallel = (item, frontDays, backDays) => {
    const duration = parseFloat(item?.calendar_days) || 0;
    if (duration <= 0) return 100;

    const front = Math.max(0, parseFloat(frontDays) || 0);
    const back = Math.max(0, parseFloat(backDays) || 0);
    const criticalDays = Math.max(0, duration - front - back);
    const rate = (criticalDays / duration) * 100;

    return parseFloat(rate.toFixed(1));
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
                state.items = items;
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
                    state.items[index][field] = value;
                    // Auto-calculate after update
                    state.items[index] = calculateItem(
                        state.items[index],
                        state.operatingRates,
                        state.workDayType
                    );

                    if (field === 'application_rate') {
                        const duration = parseFloat(state.items[index]?.calendar_days) || 0;
                        const inputRate = parseFloat(value);
                        const rightAlignedSegments = buildRightAlignedParallelSegments(duration, inputRate);
                        const parallelState = buildParallelStateFromSegments(duration, rightAlignedSegments);
                        state.items[index].parallel_segments = parallelState.parallel_segments;
                        state.items[index].front_parallel_days = parallelState.front_parallel_days;
                        state.items[index].back_parallel_days = parallelState.back_parallel_days;
                        state.items[index].application_rate = parallelState.application_rate;
                    }
                }
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
                    if (index === -1) return state;

                    const item = state.items[index];

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
                                    application_rate: 100
                                }
                                : item
                        );
                        return { ...state, items: newItems };
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
                                application_rate: parallelState.application_rate
                            }
                            : item
                    );

                    return { ...state, items: newItems };
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
                    const idx = state.items.findIndex(i => i.id === draggedId);
                    if (idx !== -1) {
                        state.items[idx]._startDay = newStartDay;
                    }
                }

                // 2. Update Parallel Periods
                if (parallelUpdates && parallelUpdates.length > 0) {
                    parallelUpdates.forEach(update => {
                        const idx = state.items.findIndex(i => i.id === update.id);
                        if (idx !== -1) {
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

                            const explicitRate = parseFloat(update.application_rate);
                            if (Number.isFinite(explicitRate)) {
                                state.items[idx].application_rate = Math.min(100, Math.max(0, parseFloat(explicitRate.toFixed(1))));
                            } else if (derivedFromSegments !== null) {
                                state.items[idx].application_rate = derivedFromSegments;
                            } else {
                                const nextFront = parseFloat(state.items[idx].front_parallel_days) || 0;
                                const nextBack = parseFloat(state.items[idx].back_parallel_days) || 0;
                                state.items[idx].application_rate = deriveApplicationRateFromParallel(
                                    state.items[idx],
                                    nextFront,
                                    nextBack
                                );
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
