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

    const formatValue = (value) => {
        const text = String(value ?? "").trim();
        return text || "-";
    };

    const getProcessValue = (std) => std.category || std.process_name;
    const getWorkTypeValue = (std) => std.sub_category || std.work_type_name;

    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
    const popupWidth = anchorRect
        ? Math.min(Math.max(anchorRect.width, 460), viewportWidth - 24)
        : Math.min(560, viewportWidth - 24);

    const content = (
        <div
            ref={listRef}
            className="fixed bg-[#1f1f2b] border border-gray-700 rounded-lg shadow-xl z-[9999] max-h-64 overflow-auto"
            style={{
                left: anchorRect ? `${anchorRect.left}px` : "0px",
                top: anchorRect ? `${position === "top" ? anchorRect.top : anchorRect.bottom}px` : "0px",
                transform: position === "top" ? "translateY(-100%)" : "translateY(0)",
                width: `${popupWidth}px`,
                maxWidth: `${viewportWidth - 24}px`
            }}
        >
            <div className="sticky top-0 z-10 grid grid-cols-[0.9fr_0.9fr_1fr_1.2fr_0.8fr] gap-x-2 border-b border-gray-700 bg-[#252536] px-3 py-2 text-[11px] font-semibold text-gray-300">
                <div>구분</div>
                <div>공정</div>
                <div>공종</div>
                <div>목차</div>
                <div>규격</div>
            </div>
            {items.map((std, index) => {
                const isActive = index === activeIndex;
                return (
                    <button
                        key={std.id}
                        type="button"
                        data-suggest-id={std.id}
                        className={`w-full border-b border-gray-800/80 px-3 py-2 text-left text-xs transition last:border-b-0 ${isActive ? "bg-blue-900/40 text-white" : "text-gray-200 hover:bg-blue-900/30"}`}
                        onMouseEnter={() => onActiveIndexChange(index)}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            onSelect(std);
                        }}
                    >
                        <div className="grid grid-cols-[0.9fr_0.9fr_1fr_1.2fr_0.8fr] gap-x-2">
                            <div className="truncate font-medium">{formatValue(std.main_category)}</div>
                            <div className="truncate">{formatValue(getProcessValue(std))}</div>
                            <div className="truncate">{formatValue(getWorkTypeValue(std))}</div>
                            <div className="truncate">{formatValue(std.item_name)}</div>
                            <div className="truncate text-gray-300">{formatValue(std.standard)}</div>
                        </div>
                    </button>
                );
            })}
        </div>
    );

    return createPortal(content, document.body);
};

export default StandardSuggestList;
