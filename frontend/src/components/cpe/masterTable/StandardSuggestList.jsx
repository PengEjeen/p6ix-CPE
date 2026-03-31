import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const QUICK_COLUMNS = [
    { key: "main_category", label: "중공종" },
    { key: "category", label: "공정" },
    { key: "sub_category", label: "세부공종" },
    { key: "item_name", label: "표준품셈 목차" },
    { key: "standard", label: "규격" },
    { key: "average_workload", label: "평균", type: "number", align: "right" }
];

const DETAIL_FIELDS = [
    { key: "main_category", label: "중공종" },
    { key: "category", label: "공정" },
    { key: "sub_category", label: "세부공종" },
    { key: "standard", label: "규격" },
    { key: "unit", label: "단위" },
    { key: "skill_worker_1_count", label: "기능공1", type: "number" },
    { key: "skill_worker_2_count", label: "기능공2", type: "number" },
    { key: "special_worker_count", label: "특별인부", type: "number" },
    { key: "common_worker_count", label: "보통인부", type: "number" },
    { key: "equipment_count", label: "장비", type: "number" },
    { key: "total_pum", label: "투입 품", type: "number" }
];

const QUICK_GRID_TEMPLATE = "minmax(0,1fr) minmax(0,1.05fr) minmax(0,1.1fr) minmax(0,1.9fr) minmax(0,0.95fr) minmax(0,0.7fr)";

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

    const activeItem = useMemo(() => {
        if (!items || items.length === 0) return null;
        const clamped = Math.max(0, Math.min(activeIndex, items.length - 1));
        return items[clamped] || null;
    }, [items, activeIndex]);

    const activeId = activeItem?.id ?? null;

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

    const formatText = (value) => {
        const text = String(value ?? "").trim();
        return text || "-";
    };

    const formatNumber = (value) => {
        if (value === null || value === undefined || value === "") return "-";
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return String(value);
        return parsed.toLocaleString("ko-KR", {
            minimumFractionDigits: Number.isInteger(parsed) ? 0 : 1,
            maximumFractionDigits: Number.isInteger(parsed) ? 0 : 2
        });
    };

    const getAverageWorkload = (std) => {
        const pumsam = Number(std?.pumsam_workload || 0);
        const molit = Number(std?.molit_workload || 0);
        if (pumsam > 0 && molit > 0) {
            return (pumsam + molit) / 2;
        }
        return pumsam || molit || 0;
    };

    const getTotalPum = (std) => {
        const pumFields = [
            std?.skill_worker_1_pum,
            std?.skill_worker_2_pum,
            std?.special_worker_pum,
            std?.common_worker_pum,
            std?.equipment_pum
        ];
        return pumFields.reduce((sum, value) => sum + (Number(value) || 0), 0);
    };

    const getColumnValue = (std, key) => {
        switch (key) {
        case "category":
            return std.category || std.process_name;
        case "sub_category":
            return std.sub_category || std.work_type_name;
        case "total_pum":
            return getTotalPum(std);
        case "average_workload":
            return getAverageWorkload(std);
        default:
            return std?.[key];
        }
    };

    const renderValue = (std, column) => {
        const rawValue = getColumnValue(std, column.key);
        return column.type === "number" ? formatNumber(rawValue) : formatText(rawValue);
    };

    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1440;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 900;
    const horizontalMargin = 12;
    const verticalMargin = 12;
    const popupGap = 8;
    const headerBottom = (() => {
        if (typeof document === "undefined") return 0;
        const headerElement = document.querySelector("header");
        return headerElement?.getBoundingClientRect?.().bottom || 0;
    })();
    const safeTop = Math.max(verticalMargin, Math.round(headerBottom + popupGap));
    const safeBottom = Math.max(safeTop + 240, viewportHeight - verticalMargin);
    const listPopupWidth = anchorRect
        ? Math.min(Math.max(anchorRect.width, 560), Math.min(700, viewportWidth - (horizontalMargin * 2)))
        : Math.min(700, viewportWidth - (horizontalMargin * 2));
    const detailPopupWidth = Math.min(680, viewportWidth - (horizontalMargin * 2));
    const listPopupLeft = anchorRect
        ? Math.min(
            Math.max(horizontalMargin, anchorRect.left),
            Math.max(horizontalMargin, viewportWidth - listPopupWidth - horizontalMargin)
        )
        : horizontalMargin;

    const availableBelow = anchorRect
        ? Math.max(220, safeBottom - (anchorRect.bottom + popupGap))
        : safeBottom - safeTop;
    const preferredPanelHeight = Math.min(520, Math.floor((safeBottom - safeTop) * 0.8));
    const maxPanelHeight = Math.max(
        260,
        Math.min(preferredPanelHeight, availableBelow)
    );
    const popupTopValue = anchorRect
        ? Math.max(safeTop, Math.min(anchorRect.bottom + popupGap, safeBottom - maxPanelHeight))
        : safeTop;
    const quickListMaxHeight = Math.max(180, maxPanelHeight - 56);
    const detailGap = 12;
    const rightCandidateLeft = listPopupLeft + listPopupWidth + detailGap;
    const leftCandidateLeft = listPopupLeft - detailPopupWidth - detailGap;
    const canPlaceRight = rightCandidateLeft + detailPopupWidth <= viewportWidth - horizontalMargin;
    const canPlaceLeft = leftCandidateLeft >= horizontalMargin;
    const detailPopupLeft = canPlaceRight
        ? rightCandidateLeft
        : canPlaceLeft
            ? leftCandidateLeft
            : Math.min(
                Math.max(horizontalMargin, rightCandidateLeft),
                Math.max(horizontalMargin, viewportWidth - detailPopupWidth - horizontalMargin)
            );

    const content = (
        <div
            className="fixed inset-0 pointer-events-none isolate"
            style={{ zIndex: 2147483640 }}
        >
            <div
                className="schedule-suggest-popup fixed overflow-hidden rounded-lg pointer-events-auto"
                onWheel={(e) => e.stopPropagation()}
                style={{
                    zIndex: 2147483646,
                    left: `${listPopupLeft}px`,
                    top: `${popupTopValue}px`,
                    width: `${listPopupWidth}px`,
                    maxWidth: `${viewportWidth - (horizontalMargin * 2)}px`,
                    maxHeight: `${maxPanelHeight}px`
                }}
            >
                <div className="schedule-suggest-popup-header px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="schedule-suggest-title text-sm font-semibold">빠른 추천</div>
                            <div className="schedule-suggest-subtitle text-[11px]">표는 한 눈에 비교하고, 상세는 오른쪽 팝업에서 확인합니다.</div>
                        </div>
                        <div className="schedule-suggest-popup-badge rounded-md px-2 py-1 text-[11px]">
                            {items.length}개 항목
                        </div>
                    </div>
                </div>

                <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: `${quickListMaxHeight}px` }}>
                    <div
                        className="schedule-suggest-popup-header schedule-suggest-subtitle sticky top-0 z-10 grid gap-x-2 px-3 py-2 text-[10px] font-semibold"
                        style={{ gridTemplateColumns: QUICK_GRID_TEMPLATE }}
                    >
                        {QUICK_COLUMNS.map((column) => (
                            <div
                                key={column.key}
                                className={`${column.align === "right" ? "text-right" : "text-left"} truncate whitespace-nowrap leading-snug`}
                                title={column.label}
                            >
                                {column.label}
                            </div>
                        ))}
                    </div>
                    <div ref={listRef}>
                        {items.map((std, index) => {
                            const isActive = index === activeIndex;
                            return (
                                <button
                                    key={std.id}
                                    type="button"
                                    data-suggest-id={std.id}
                                    className={`schedule-suggest-row grid w-full items-center gap-x-2 border-b px-3 py-2 text-left text-[11px] transition last:border-b-0 ${isActive ? "schedule-suggest-row-active" : ""}`}
                                    style={{ gridTemplateColumns: QUICK_GRID_TEMPLATE }}
                                    onMouseEnter={() => onActiveIndexChange(index)}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        onSelect(std);
                                    }}
                                >
                                    {QUICK_COLUMNS.map((column) => (
                                        <div
                                            key={column.key}
                                            className={`min-w-0 ${column.align === "right" ? "text-right font-mono" : "text-left"} truncate whitespace-nowrap leading-snug ${column.key === "main_category" ? "font-medium" : ""}`}
                                            title={String(renderValue(std, column))}
                                        >
                                            {renderValue(std, column)}
                                        </div>
                                    ))}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div
                className="schedule-suggest-popup schedule-suggest-detail-popup fixed overflow-hidden rounded-lg pointer-events-auto"
                style={{
                    zIndex: 2147483647,
                    left: `${detailPopupLeft}px`,
                    top: `${popupTopValue}px`,
                    width: `${detailPopupWidth}px`,
                    maxWidth: `${viewportWidth - (horizontalMargin * 2)}px`,
                    maxHeight: `${maxPanelHeight}px`
                }}
            >
                <div className="schedule-suggest-popup-header px-3 py-2.5">
                    <div className="schedule-suggest-title text-sm font-semibold">선택 항목 상세</div>
                    <div className="schedule-suggest-subtitle text-[11px]">리스트와 분리된 우측 팝업에서 핵심 정보를 바로 확인합니다.</div>
                </div>

                <div className="px-3 py-2.5">
                    {activeItem ? (
                        <div className="space-y-1.5">
                            <div className="schedule-suggest-card rounded-md border border-blue-900/60 px-2.5 py-2">
                                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-blue-200">표준품셈 목차</div>
                                <div className="schedule-suggest-title text-[12px] font-semibold leading-snug">
                                    {renderValue(activeItem, { key: "item_name" })}
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-1.5">
                                {[
                                    { key: "pumsam_workload", label: "표준품셈", type: "number" },
                                    { key: "molit_workload", label: "국토부", type: "number" },
                                    { key: "average_workload", label: "평균", type: "number" },
                                    { key: "total_pum", label: "투입 품", type: "number" }
                                ].map((field) => (
                                    <div key={field.key} className="schedule-suggest-card rounded-md border border-gray-800 px-2 py-1.5">
                                        <div className="schedule-suggest-subtitle text-[9px] font-semibold uppercase tracking-wider">{field.label}</div>
                                        <div className="schedule-suggest-title mt-0.5 text-[12px] font-mono font-semibold">{renderValue(activeItem, field)}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-6 gap-1.5">
                                {DETAIL_FIELDS.map((field) => (
                                    <div
                                        key={field.key}
                                        className="schedule-suggest-card rounded-md border border-gray-800 px-2 py-1.5"
                                    >
                                        <div className="schedule-suggest-subtitle mb-0.5 text-[9px] font-semibold uppercase tracking-wider">{field.label}</div>
                                        <div className={`schedule-suggest-body text-[11px] leading-snug ${field.type === "number" ? "font-mono" : ""}`}>
                                            {renderValue(activeItem, field)}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="schedule-suggest-card rounded-md border border-gray-800 px-2.5 py-1.5">
                                <div className="schedule-suggest-subtitle mb-0.5 text-[9px] font-semibold uppercase tracking-wider">산출근거(작업조 1팀당 인원 및 장비구성)</div>
                                <div className="schedule-suggest-body text-[11px] leading-snug line-clamp-2">
                                    {renderValue(activeItem, { key: "crew_composition_text" })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="schedule-suggest-card schedule-suggest-subtitle rounded-md border border-gray-800 px-2.5 py-3 text-sm">
                            표시할 항목이 없습니다.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
};

export default StandardSuggestList;
