export const buildMoveUpdatesByDelta = (targetIds, itemsWithTiming, delta) => {
    return targetIds.map((id) => {
        const timing = itemsWithTiming.find(i => i.id === id);
        const start = timing ? timing.startDay : 0;
        return { id, newStartDay: Math.max(0, start + delta) };
    });
};
