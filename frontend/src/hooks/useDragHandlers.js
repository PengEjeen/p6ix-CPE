import { useState, useCallback } from "react";
import { arrayMove } from '@dnd-kit/sortable';
import toast from "react-hot-toast";

/**
 * Custom hook for drag-and-drop handlers
 * @param {Array} items - Schedule items
 * @param {Function} reorderItems - Function to reorder items in store
 * @returns {Object} { activeId, handleDragStart, handleDragEnd }
 */
export const useDragHandlers = (items, reorderItems) => {
    const [activeId, setActiveId] = useState(null);

    const handleDragStart = useCallback((event) => {
        setActiveId(event.active.id);
    }, []);

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over || active.id === over.id) return;

        const activeItem = items.find(item => item.id === active.id);
        const overItem = items.find(item => item.id === over.id);

        // Prevent drag-drop across different categories
        if (activeItem.main_category !== overItem.main_category) {
            toast.error('같은 대공종 내에서만 이동 가능합니다.');
            return;
        }

        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        reorderItems(newOrder);
    }, [items, reorderItems]);

    return {
        activeId,
        handleDragStart,
        handleDragEnd
    };
};
