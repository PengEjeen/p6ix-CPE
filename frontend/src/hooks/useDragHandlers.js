import { useState, useCallback } from "react";
import { arrayMove } from '@dnd-kit/sortable';
import toast from "react-hot-toast";

/**
 * Custom hook for drag-and-drop handlers
 * @param {Array} items - Schedule items
 * @param {Function} reorderItems - Function to reorder items in store
 * @param {Array} selectedItemIds - Currently selected row ids
 * @returns {Object} { activeId, handleDragStart, handleDragEnd }
 */
export const useDragHandlers = (items, reorderItems, selectedItemIds = []) => {
    const [activeId, setActiveId] = useState(null);
    const [overId, setOverId] = useState(null);

    const handleDragStart = useCallback((event) => {
        const nextActiveId = event?.active?.id ?? null;
        setActiveId(nextActiveId);
        setOverId(nextActiveId);
    }, []);

    const handleDragOver = useCallback((event) => {
        setOverId(event?.over?.id ?? null);
    }, []);

    const handleDragCancel = useCallback(() => {
        setActiveId(null);
        setOverId(null);
    }, []);

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        setActiveId(null);
        setOverId(null);

        if (!over || active.id === over.id) return;

        const activeItem = items.find(item => item.id === active.id);
        const overItem = items.find(item => item.id === over.id);
        if (!activeItem || !overItem) return;

        // Prevent drag-drop across different categories
        if (activeItem.main_category !== overItem.main_category) {
            toast.error('같은 대공종 내에서만 이동 가능합니다.');
            return;
        }

        const selectedSet = new Set(selectedItemIds);
        const activeCategorySelectedItems = items.filter(
            (item) => selectedSet.has(item.id) && item.main_category === activeItem.main_category
        );
        const shouldMoveGroup = selectedSet.has(active.id) && activeCategorySelectedItems.length > 1;

        if (shouldMoveGroup) {
            const excludedCount = selectedSet.size - activeCategorySelectedItems.length;
            if (excludedCount > 0) {
                toast('다른 대공종 선택은 제외하고 같은 대공종만 이동합니다.', {
                    icon: 'ℹ️',
                });
            }

            const movingItems = activeCategorySelectedItems;
            const movingIds = new Set(movingItems.map((item) => item.id));
            if (movingIds.has(over.id)) {
                return;
            }

            const remainingItems = items.filter((item) => !movingIds.has(item.id));
            const overIndexInRemaining = remainingItems.findIndex((item) => item.id === over.id);
            if (overIndexInRemaining === -1) return;

            const activeIndex = items.findIndex((item) => item.id === active.id);
            const overIndex = items.findIndex((item) => item.id === over.id);
            const insertIndex = activeIndex < overIndex ? overIndexInRemaining + 1 : overIndexInRemaining;

            const sortedMovingItems = items.filter((item) => movingIds.has(item.id));
            const boundedInsertIndex = Math.max(0, Math.min(insertIndex, remainingItems.length));
            const newOrder = [
                ...remainingItems.slice(0, boundedInsertIndex),
                ...sortedMovingItems,
                ...remainingItems.slice(boundedInsertIndex),
            ];
            reorderItems(newOrder);
            return;
        }

        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        reorderItems(newOrder);
    }, [items, reorderItems, selectedItemIds]);

    return {
        activeId,
        overId,
        handleDragStart,
        handleDragOver,
        handleDragCancel,
        handleDragEnd
    };
};
