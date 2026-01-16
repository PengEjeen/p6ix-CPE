import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';
import { calculateItem, solveForCrewSize, solveForProductivity } from '../utils/solver';

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
            operatingRates: [],
            workDayType: '6d', // '5d', '6d', '7d'

            // Actions
            setItems: (items) => set((state) => {
                state.items = items;
            }),

            setOperatingRates: (rates) => set((state) => {
                state.operatingRates = rates;
                // Re-calculate all items when rates change
                state.items = state.items.map(item =>
                    calculateItem(item, rates, state.workDayType)
                );
            }),

            setWorkDayType: (type) => set((state) => {
                state.workDayType = type;
                // Re-calculate all items when work day type changes
                state.items = state.items.map(item =>
                    calculateItem(item, state.operatingRates, type)
                );
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
            }),

            reorderItems: (newItems) => set((state) => {
                state.items = newItems;
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
             * Update Parallel Periods
             * - Sets front_parallel_days and back_parallel_days
             */
            updateParallelPeriods: (id, frontDays, backDays) => {
                console.log('[Store] updateParallelPeriods called:', { id, frontDays, backDays });

                set((state) => {
                    const index = state.items.findIndex(i => i.id === id);
                    console.log('[Store] Found item at index:', index);

                    if (index === -1) {
                        console.log('[Store] ERROR: Item not found with id:', id);
                        return state; // No change
                    }

                    console.log('[Store] Before update:', {
                        id: state.items[index].id,
                        front_parallel_days: state.items[index].front_parallel_days,
                        back_parallel_days: state.items[index].back_parallel_days
                    });

                    // IMPORTANT: Create new array and new object for immutability!
                    const newItems = state.items.map((item, idx) => {
                        if (idx === index) {
                            const updated = {
                                ...item,
                                front_parallel_days: frontDays || 0,
                                back_parallel_days: backDays || 0
                            };
                            console.log('[Store] After update:', {
                                id: updated.id,
                                front_parallel_days: updated.front_parallel_days,
                                back_parallel_days: updated.back_parallel_days
                            });
                            return updated;
                        }
                        return item;
                    });

                    console.log('[Store] Returning new state with updated items');
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
