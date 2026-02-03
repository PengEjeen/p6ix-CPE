export const buildDragPreviewState = (targetIds, itemsWithTiming, subTasks) => {
    const base = new Map();
    targetIds.forEach((id) => {
        const timing = itemsWithTiming.find(i => i.id === id);
        base.set(id, timing ? timing.startDay : 0);
    });

    const subtaskBase = new Map();
    (subTasks || []).forEach((subtask) => {
        if (targetIds.includes(subtask.itemId)) {
            subtaskBase.set(subtask.id, subtask.startDay);
        }
    });

    return { base, subtaskBase };
};

export const buildItemDragUpdates = (targetIds, base, delta) => {
    return targetIds.map((id) => {
        const start = base.get(id) ?? 0;
        return { id, newStartDay: Math.max(0, start + delta) };
    });
};

export const buildSubtaskDragUpdates = (subtaskBase, delta) => {
    const updates = [];
    if (!subtaskBase) return updates;
    subtaskBase.forEach((start, id) => {
        updates.push({ id, startDay: start + delta });
    });
    return updates;
};
