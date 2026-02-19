import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const StandardSuggestList = ({
    items,
    isOpen,
    activeIndex,
    onActiveIndexChange,
    onSelect,
    position = "bottom",
    anchorRef
}) => {
    const listRef = useRef(null);
    const [anchorRect, setAnchorRect] = useState(null);

    const activeId = useMemo(() => {
        if (!items || items.length === 0) return null;
        const clamped = Math.max(0, Math.min(activeIndex, items.length - 1));
        return items[clamped]?.id ?? null;
    }, [items, activeIndex]);

    useEffect(() => {
        if (!listRef.current || activeId === null) return;
        const activeEl = listRef.current.querySelector(`[data-suggest-id="${activeId}"]`);
        if (activeEl) {
            activeEl.scrollIntoView({ block: "nearest" });
        }
    }, [activeId]);

    useEffect(() => {
        if (!isOpen || !anchorRef?.current) return;
        const updateRect = () => {
            const rect = anchorRef.current.getBoundingClientRect();
            setAnchorRect(rect);
        };
        updateRect();
        window.addEventListener("resize", updateRect);
        window.addEventListener("scroll", updateRect, true);
        return () => {
            window.removeEventListener("resize", updateRect);
            window.removeEventListener("scroll", updateRect, true);
        };
    }, [isOpen, anchorRef]);

    if (!isOpen || !items || items.length === 0) return null;

    const content = (
        <div
            ref={listRef}
            className="fixed bg-[#1f1f2b] border border-gray-700 rounded-lg shadow-xl z-[9999] max-h-56 overflow-auto"
            style={{
                left: anchorRect ? `${anchorRect.left}px` : "0px",
                top: anchorRect ? `${position === "top" ? anchorRect.top : anchorRect.bottom}px` : "0px",
                transform: position === "top" ? "translateY(-100%)" : "translateY(0)",
                width: "max-content",
                minWidth: anchorRect ? `${anchorRect.width}px` : "120px"
            }}
        >
            {items.map((std, index) => {
                const isActive = index === activeIndex;
                return (
                    <button
                        key={std.id}
                        type="button"
                        data-suggest-id={std.id}
                        className={`w-full text-left px-3 py-2 text-sm transition whitespace-nowrap ${isActive ? "bg-blue-900/40 text-white" : "text-gray-200 hover:bg-blue-900/30"}`}
                        onMouseEnter={() => onActiveIndexChange(index)}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            onSelect(std);
                        }}
                    >
                        <div className="font-semibold">{std.sub_category || std.work_type_name || std.item_name || std.category}</div>
                        <div className="text-xs text-gray-400">
                            {(std.main_category || "-")} / {(std.category || std.process_name || "-")}
                        </div>
                    </button>
                );
            })}
        </div>
    );

    return createPortal(content, document.body);
};

export default StandardSuggestList;
