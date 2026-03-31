import { useCallback } from "react";

export default function useScheduleMasterGantt({
    addSubTask,
    updateSubTask,
    deleteSubTask,
    resizeTaskBar,
    resizeTaskBarByProductivity
}) {
    const handleGanttResize = useCallback((itemId, newCalendarDays, mode = "crew") => {
        if (mode === "prod") {
            resizeTaskBarByProductivity(itemId, newCalendarDays);
            return;
        }
        resizeTaskBar(itemId, newCalendarDays);
    }, [resizeTaskBar, resizeTaskBarByProductivity]);

    const handleSmartResize = useCallback((itemId, newCalendarDays, baseProductivity = null) => {
        resizeTaskBar(itemId, newCalendarDays, baseProductivity);
    }, [resizeTaskBar]);

    const handleCreateSubtask = useCallback((itemId, startDay, durationDays, extraProps = {}) => {
        addSubTask({
            id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            itemId,
            startDay,
            durationDays,
            label: "부세부공종",
            ...extraProps
        });
    }, [addSubTask]);

    const handleUpdateSubtask = useCallback((id, updates) => {
        updateSubTask(id, updates);
    }, [updateSubTask]);

    const handleDeleteSubtask = useCallback((id) => {
        deleteSubTask(id);
    }, [deleteSubTask]);

    return {
        handleCreateSubtask,
        handleDeleteSubtask,
        handleGanttResize,
        handleSmartResize,
        handleUpdateSubtask
    };
}
