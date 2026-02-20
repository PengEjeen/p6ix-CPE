import React, { useMemo, useRef, useState } from "react";
import { Trash2, Link, GripVertical, Check } from "lucide-react";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import StandardSuggestList from "./StandardSuggestList";
import { findOperatingRateForItem } from "../../../utils/operatingRateKeys";

const ScheduleTableRow = ({
    item,
    isLinked,
    isSelected = false,
    onToggleSelect,
    onStartSelectionDrag,
    onDragSelectionEnter,
    handleChange,
    handleDeleteItem,
    handleAddItem,
    handleOpenImport,
    spanInfo,
    isOverlay,
    rowClassName = "",
    operatingRates = [],
    workDayType = "6d",
    standardItems = [],
    onApplyStandard,
    isDropTarget = false,
    dropPosition = null,
    isDropInvalid = false,
    isPartOfDraggingGroup = false,
    isDragActive = false
}) => {
    // main+process 우선 매칭, 없으면 main_category 매칭
    const rateObj = findOperatingRateForItem(operatingRates, item);

    // Use auto-calculated operating_rate directly from WorkScheduleWeight
    let rateValue = item.operating_rate_value ?? 100;
    if (rateObj) {
        rateValue = rateObj.operating_rate || 100;
    }
    const parsedApplicationRate = parseFloat(item.application_rate);
    const isForcedParallel = Number.isFinite(parsedApplicationRate) && Math.abs(parsedApplicationRate - 100) > 0.001;
    // 병행 컬럼 표시는 반영률 기반으로만 판단 (100 미만 => 병행)
    const isParallelChecked = isForcedParallel;
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id });

    // Ensure dragging item works if not overlay
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        position: 'relative',
        opacity: isDragging ? 0.3 : 1, // Dim original when dragging
    };

    // If it's the specific Overlay item, force opacity 1 and full cells
    if (isOverlay) {
        style.opacity = 1;
        style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)";
        style.backgroundColor = "white";
    }

    if (!isOverlay && isDropTarget && dropPosition) {
        const indicatorColor = isDropInvalid ? "rgba(248, 113, 113, 0.9)" : "rgba(56, 189, 248, 0.95)";
        const dropShadow = dropPosition === "before"
            ? `inset 0 3px 0 0 ${indicatorColor}`
            : `inset 0 -3px 0 0 ${indicatorColor}`;
        style.boxShadow = style.boxShadow ? `${style.boxShadow}, ${dropShadow}` : dropShadow;
    }

    const [activeField, setActiveField] = useState(null);
    const [processQuery, setProcessQuery] = useState("");
    const [subProcessQuery, setSubProcessQuery] = useState("");
    const [workTypeQuery, setWorkTypeQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const blurTimeoutRef = useRef(null);
    const processInputRef = useRef(null);
    const subProcessInputRef = useRef(null);
    const workTypeInputRef = useRef(null);

    const buildSuggestions = (query) => {
        const term = query.trim().toLowerCase();
        if (!term || !standardItems.length) return [];
        const scored = standardItems.map((std) => {
            const fields = [
                std.item_name,
                std.sub_category,
                std.category,
                std.standard,
                std.main_category,
                std.process_name,
                std.work_type_name
            ].filter(Boolean).map((v) => String(v).toLowerCase());
            let score = 0;
            fields.forEach((f) => {
                if (f === term) score += 10;
                else if (f.startsWith(term)) score += 6;
                else if (f.includes(term)) score += 3;
            });
            return { std, score };
        }).filter((entry) => entry.score > 0);
        return scored.sort((a, b) => b.score - a.score).slice(0, 6).map((entry) => entry.std);
    };

    const processSuggestions = useMemo(() => buildSuggestions(processQuery), [processQuery, standardItems]);
    const subProcessSuggestions = useMemo(() => buildSuggestions(subProcessQuery), [subProcessQuery, standardItems]);
    const workTypeSuggestions = useMemo(() => buildSuggestions(workTypeQuery), [workTypeQuery, standardItems]);

    const handleInputFocus = (field) => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }
        if (field === 'process') setProcessQuery(item.process || "");
        if (field === 'sub_process') setSubProcessQuery(item.sub_process || "");
        if (field === 'work_type') setWorkTypeQuery(item.work_type || "");
        setActiveIndex(0);
        setActiveField(field);
    };

    const handleInputBlur = () => {
        blurTimeoutRef.current = setTimeout(() => {
            setActiveField(null);
        }, 150);
    };

    const handleSuggestionSelect = (std) => {
        if (onApplyStandard) onApplyStandard(item, std);
        setActiveField(null);
    };

    const handleSuggestionKeyDown = (e, suggestions) => {
        if (!suggestions || suggestions.length === 0) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const selected = suggestions[activeIndex] || suggestions[0];
            if (selected) handleSuggestionSelect(selected);
        }
    };

    return (
        <tr
            ref={setNodeRef}
            style={style}
            className={`hover:bg-white/5 transition-colors text-base ${rowClassName} ${isSelected ? "bg-blue-900/20" : ""} ${isDragging && !isOverlay ? "bg-blue-900/20" : ""} ${isPartOfDraggingGroup && !isDragging ? "bg-blue-900/25" : ""} ${isDropTarget ? (isDropInvalid ? "bg-red-900/15" : "bg-cyan-900/15") : ""}`}
        >
            {/* Row Select */}
            <td
                className="border-r border-gray-700 text-center p-1 select-none cursor-cell"
                onMouseDown={(e) => {
                    if (isOverlay || e.button !== 0) return;
                    e.preventDefault();
                    e.stopPropagation();
                    onStartSelectionDrag?.(item.id);
                }}
                onMouseEnter={(e) => {
                    if (isOverlay || e.buttons !== 1) return;
                    onDragSelectionEnter?.(item.id);
                }}
            >
                {!isOverlay ? (
                    <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        className="h-3.5 w-3.5 accent-blue-500 cursor-pointer"
                        aria-label="행 선택"
                    />
                ) : null}
            </td>

            {/* Drag Handle */}
            <td className={`border-r border-gray-700 text-center p-1 ${isDragActive ? "text-blue-300" : "text-gray-400"}`}>
                <button
                    type="button"
                    aria-label="행 이동"
                    title={isPartOfDraggingGroup ? "선택 항목 일괄 이동" : "행 이동"}
                    disabled={isOverlay}
                    className={`mx-auto flex h-6 w-6 items-center justify-center rounded-md transition ${isOverlay ? "text-gray-500 cursor-default" : "cursor-grab active:cursor-grabbing hover:bg-blue-500/20 hover:text-blue-100 active:scale-95"} ${isDragging ? "bg-blue-500/30 text-blue-100" : ""}`}
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical size={14} className="mx-auto" />
                </button>
            </td>

            {/* Classification (구분) - keep using process data */}
            {(isOverlay || spanInfo?.isProcessFirst !== false) && (
                <td
                    rowSpan={isOverlay ? 1 : (spanInfo?.processRowSpan || 1)}
                    className="border-r border-gray-700 bg-[#2c2c3a] p-1 align-top"
                >
                    <div className="relative">
                        <input
                            ref={processInputRef}
                            className="w-full bg-transparent outline-none font-medium text-gray-200 text-center text-base"
                            value={item.process}
                            onChange={(e) => {
                                handleChange(item.id, 'process', e.target.value);
                                setProcessQuery(e.target.value);
                            }}
                            onFocus={() => handleInputFocus('process')}
                            onBlur={handleInputBlur}
                            onKeyDown={(e) => handleSuggestionKeyDown(e, processSuggestions)}
                        />
                        <StandardSuggestList
                            items={processSuggestions}
                            isOpen={!isOverlay && activeField === 'process'}
                            activeIndex={activeIndex}
                            onActiveIndexChange={setActiveIndex}
                            onSelect={handleSuggestionSelect}
                            position="bottom"
                            anchorRef={processInputRef}
                        />
                    </div>
                </td>
            )}

            {/* Sub Process (공정) */}
            {(isOverlay || spanInfo?.isSubProcessFirst !== false) && (
                <td
                    rowSpan={isOverlay ? 1 : (spanInfo?.subProcessRowSpan || 1)}
                    className="border-r border-gray-700 bg-[#2c2c3a] p-1 align-top"
                >
                    <div className="relative">
                        <input
                            ref={subProcessInputRef}
                            className="w-full bg-transparent outline-none font-medium text-gray-200 text-center text-base"
                            value={item.sub_process || ""}
                            onChange={(e) => {
                                handleChange(item.id, 'sub_process', e.target.value);
                                setSubProcessQuery(e.target.value);
                            }}
                            onFocus={() => handleInputFocus('sub_process')}
                            onBlur={handleInputBlur}
                            onKeyDown={(e) => handleSuggestionKeyDown(e, subProcessSuggestions)}
                        />
                        <StandardSuggestList
                            items={subProcessSuggestions}
                            isOpen={!isOverlay && activeField === 'sub_process'}
                            activeIndex={activeIndex}
                            onActiveIndexChange={setActiveIndex}
                            onSelect={handleSuggestionSelect}
                            position="bottom"
                            anchorRef={subProcessInputRef}
                        />
                    </div>
                </td>
            )}

            {/* Work Type (공종) */}
            <td className="border-r border-gray-700 px-2 py-1">
                <div className="flex items-center gap-1 relative">
                    {isLinked && <Link size={12} className="text-blue-500" />}
                    <input
                        type="text"
                        ref={workTypeInputRef}
                        className="w-full bg-transparent outline-none text-gray-200 p-1 rounded hover:bg-white/10 focus:bg-[#1f1f2b] focus:ring-1 focus:ring-blue-500/50 transition text-base font-medium"
                        value={item.work_type}
                        onChange={(e) => {
                            handleChange(item.id, 'work_type', e.target.value);
                            setWorkTypeQuery(e.target.value);
                        }}
                        onFocus={() => handleInputFocus('work_type')}
                        onBlur={handleInputBlur}
                        onKeyDown={(e) => handleSuggestionKeyDown(e, workTypeSuggestions)}
                    />
                    <StandardSuggestList
                        items={workTypeSuggestions}
                        isOpen={!isOverlay && activeField === 'work_type'}
                        activeIndex={activeIndex}
                        onActiveIndexChange={setActiveIndex}
                        onSelect={handleSuggestionSelect}
                        position="bottom"
                        anchorRef={workTypeInputRef}
                    />
                </div>
            </td>

            {/* Formula */}
            <td className="border-r border-gray-700 p-1">
                <input className="w-full text-right outline-none p-1 text-sm text-gray-400 bg-[#1f1f2b] rounded font-medium" value={item.quantity_formula || ''} placeholder="-" onChange={(e) => handleChange(item.id, 'quantity_formula', e.target.value)} />
            </td>

            {/* Unit */}
            <td className="border-r border-gray-700 p-1">
                <input className="w-full text-center outline-none p-1 text-gray-300 bg-[#1f1f2b] rounded text-base font-medium" value={item.unit} onChange={(e) => handleChange(item.id, 'unit', e.target.value)} />
            </td>

            {/* Quantity */}
            <td className="border-r border-gray-700 p-1">
                <input className="w-full text-right outline-none p-1 font-bold text-gray-100 bg-[#1f1f2b] rounded text-base tracking-tight" value={item.quantity} onChange={(e) => handleChange(item.id, 'quantity', e.target.value)} />
            </td>

            {/* Productivity */}
            <td className={`border-r border-gray-700 p-1 ${isLinked ? 'bg-blue-900/20' : ''}`}>
                <input className={`w-full text-right outline-none p-1 text-base bg-[#1f1f2b] rounded ${isLinked ? 'text-blue-300 font-bold' : 'text-gray-200 font-semibold'}`} value={item.productivity} disabled={isLinked} onChange={(e) => handleChange(item.id, 'productivity', e.target.value)} />
            </td>

            {/* Crew */}
            <td className="border-r border-gray-700 p-1">
                <input className="w-full text-center outline-none p-1 text-gray-200 bg-[#1f1f2b] rounded text-base font-semibold" value={item.crew_size} onChange={(e) => handleChange(item.id, 'crew_size', e.target.value)} />
            </td>

            {/* Daily Prod */}
            <td className="border-r border-gray-700 px-2 py-1 text-right text-gray-200 font-mono bg-[#1f1f2b] text-base font-semibold">
                {item.daily_production?.toLocaleString()}
            </td>

            {/* Apply Rate */}
            <td className="border-r border-gray-700 p-1">
                <div className="relative">
                    <input
                        className="w-full text-right outline-none p-1 pr-5 text-gray-200 bg-[#1f1f2b] rounded text-base font-semibold"
                        type="number"
                        value={item.application_rate ?? 100}
                        onChange={(e) => handleChange(item.id, 'application_rate', e.target.value)}
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">%</span>
                </div>
            </td>

            {/* Working Days */}
            <td className="border-r border-gray-700 px-2 py-1 text-right text-gray-200 font-mono bg-[#1f1f2b] text-base font-semibold">
                {item.working_days ? parseFloat(item.working_days).toFixed(1) : "0.0"}
                <span className="ml-[2px] text-xs text-gray-400">일</span>
            </td>

            {/* Op Rate */}
            <td className="border-r border-gray-700 p-1">
                <div className="w-full text-base text-center text-gray-200 bg-[#1f1f2b] rounded font-medium py-1">
                    {rateValue}%
                </div>
            </td>

            {/* Cal Days */}
            <td className="border-r border-gray-700 px-2 py-1 text-right text-blue-300 font-bold font-mono bg-blue-900/20 text-base">
                {item.calendar_days}
                <span className="ml-1 text-sm text-blue-200 font-semibold">일</span>
                <span className="ml-2 text-sm text-blue-200 font-semibold">({item.calendar_months}개월)</span>
            </td>

            {/* Remarks (Note) */}
            <td className="border-r border-gray-700 p-1">
                <input className="w-full text-sm outline-none p-1 text-gray-200 bg-[#1f1f2b] rounded font-medium" value={item.note || ""} onChange={(e) => handleChange(item.id, 'note', e.target.value)} />
            </td>

            {/* Parallel Status */}
            <td className="border-r border-gray-700 p-1 text-center align-middle">
                <span
                    className={`inline-flex h-4 w-4 items-center justify-center rounded border ${isParallelChecked
                        ? "border-blue-400 bg-blue-500/25 text-blue-300"
                        : "border-gray-600 bg-[#1f1f2b] text-transparent"
                        }`}
                    aria-label={isParallelChecked ? "병행" : "비병행"}
                    title={isParallelChecked ? "병행" : "비병행"}
                >
                    <Check size={11} strokeWidth={3} />
                </span>
            </td>

            {/* Action */}
            <td className="p-1 text-center">
                <button className="text-gray-400 hover:text-red-500 transition-colors" onClick={() => handleDeleteItem(item.id)}>
                    <Trash2 size={16} />
                </button>
            </td>
        </tr>
    );
};

export default ScheduleTableRow;
