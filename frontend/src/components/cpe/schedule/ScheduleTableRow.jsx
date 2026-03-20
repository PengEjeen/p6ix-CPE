import React, { useMemo, useRef, useState } from "react";
import { Trash2, Link, GripVertical } from "lucide-react";
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
    handleGroupFieldChange,
    handleDeleteItem,
    onOpenRowClassEdit,
    handleAddItem,
    onActivateItem,
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
    const editOriginRef = useRef({});
    const processInputRef = useRef(null);
    const subProcessInputRef = useRef(null);
    const workTypeInputRef = useRef(null);
    const editableInputBaseClass = "ui-table-editable-input text-gray-100";

    const rememberFieldOrigin = (field, value) => {
        if (!(field in editOriginRef.current)) {
            editOriginRef.current[field] = value;
        }
    };

    const clearFieldOrigin = (field) => {
        delete editOriginRef.current[field];
    };

    const revertField = (field) => {
        if (!(field in editOriginRef.current)) return undefined;
        const original = editOriginRef.current[field];
        if (field === "process" && handleGroupFieldChange && spanInfo?.processGroupIds?.length > 1) {
            handleGroupFieldChange(item.id, field, original, spanInfo.processGroupIds);
        } else if (field === "sub_process" && handleGroupFieldChange && spanInfo?.subProcessGroupIds?.length > 1) {
            handleGroupFieldChange(item.id, field, original, spanInfo.subProcessGroupIds);
        } else {
            handleChange(item.id, field, original);
        }
        clearFieldOrigin(field);
        return original;
    };

    const handleEscRevert = (e, field, afterRevert) => {
        if (e.key !== "Escape") return false;
        const reverted = revertField(field);
        if (afterRevert) afterRevert(reverted);
        setActiveField(null);
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.blur();
        return true;
    };

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
        return scored.sort((a, b) => b.score - a.score).slice(0, 40).map((entry) => entry.std);
    };

    const processSuggestions = useMemo(() => buildSuggestions(processQuery), [processQuery, standardItems]);
    const subProcessSuggestions = useMemo(() => buildSuggestions(subProcessQuery), [subProcessQuery, standardItems]);
    const workTypeSuggestions = useMemo(() => buildSuggestions(workTypeQuery), [workTypeQuery, standardItems]);

    const handleInputFocus = (field, currentValue) => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }
        rememberFieldOrigin(field, currentValue);
        if (field === 'process') setProcessQuery(item.process || "");
        if (field === 'sub_process') setSubProcessQuery(item.sub_process || "");
        if (field === 'work_type') setWorkTypeQuery(item.work_type || "");
        setActiveIndex(0);
        setActiveField(field);
    };

    const handleInputBlur = (field) => {
        clearFieldOrigin(field);
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
            onMouseDownCapture={(e) => {
                if (isOverlay || e.button !== 0) return;
                onActivateItem?.(item);
            }}
            onFocusCapture={() => {
                if (isOverlay) return;
                onActivateItem?.(item);
            }}
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

            {/* Classification (중공종) - keep using process data */}
            {(isOverlay || spanInfo?.isProcessFirst !== false) && (
                <td
                    rowSpan={isOverlay ? 1 : (spanInfo?.processRowSpan || 1)}
                    className="border-r border-gray-700 bg-[#2c2c3a] p-1 align-top"
                >
                    <div className="relative">
                        <input
                            ref={processInputRef}
                            className={`${editableInputBaseClass} px-1 py-1 font-medium text-center text-base`}
                            value={item.process}
                            onChange={(e) => {
                                if (handleGroupFieldChange && spanInfo?.processGroupIds?.length > 1) {
                                    handleGroupFieldChange(item.id, 'process', e.target.value, spanInfo.processGroupIds);
                                } else {
                                    handleChange(item.id, 'process', e.target.value);
                                }
                                setProcessQuery(e.target.value);
                            }}
                            onFocus={() => handleInputFocus('process', item.process || "")}
                            onBlur={() => handleInputBlur('process')}
                            onKeyDown={(e) => {
                                if (handleEscRevert(e, 'process', (value) => setProcessQuery(value ?? ""))) return;
                                handleSuggestionKeyDown(e, processSuggestions);
                            }}
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
                            className={`${editableInputBaseClass} px-1 py-1 font-medium text-center text-base`}
                            value={item.sub_process || ""}
                            onChange={(e) => {
                                if (handleGroupFieldChange && spanInfo?.subProcessGroupIds?.length > 1) {
                                    handleGroupFieldChange(item.id, 'sub_process', e.target.value, spanInfo.subProcessGroupIds);
                                } else {
                                    handleChange(item.id, 'sub_process', e.target.value);
                                }
                                setSubProcessQuery(e.target.value);
                            }}
                            onFocus={() => handleInputFocus('sub_process', item.sub_process || "")}
                            onBlur={() => handleInputBlur('sub_process')}
                            onKeyDown={(e) => {
                                if (handleEscRevert(e, 'sub_process', (value) => setSubProcessQuery(value ?? ""))) return;
                                handleSuggestionKeyDown(e, subProcessSuggestions);
                            }}
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

            {/* Work Type (세부공종) */}
            <td className="border-r border-gray-700 px-2 py-1">
                <div className="flex items-center gap-1 relative">
                    {isLinked && <Link size={12} className="text-blue-500" />}
                    <input
                        type="text"
                        ref={workTypeInputRef}
                        className={`${editableInputBaseClass} p-1 text-base font-medium`}
                        value={item.work_type}
                        onChange={(e) => {
                            handleChange(item.id, 'work_type', e.target.value);
                            setWorkTypeQuery(e.target.value);
                        }}
                        onFocus={() => handleInputFocus('work_type', item.work_type || "")}
                        onBlur={() => handleInputBlur('work_type')}
                        onKeyDown={(e) => {
                            if (handleEscRevert(e, 'work_type', (value) => setWorkTypeQuery(value ?? ""))) return;
                            handleSuggestionKeyDown(e, workTypeSuggestions);
                        }}
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
                <input
                    className={`${editableInputBaseClass} p-1 text-right text-sm font-medium`}
                    value={item.quantity_formula || ''}
                    placeholder="-"
                    onChange={(e) => handleChange(item.id, 'quantity_formula', e.target.value)}
                    onFocus={() => rememberFieldOrigin('quantity_formula', item.quantity_formula || "")}
                    onBlur={() => clearFieldOrigin('quantity_formula')}
                    onKeyDown={(e) => handleEscRevert(e, 'quantity_formula')}
                />
            </td>

            {/* Unit */}
            <td className="border-r border-gray-700 p-1">
                <input
                    className={`${editableInputBaseClass} p-1 text-center text-base font-medium`}
                    value={item.unit}
                    onChange={(e) => handleChange(item.id, 'unit', e.target.value)}
                    onFocus={() => rememberFieldOrigin('unit', item.unit || "")}
                    onBlur={() => clearFieldOrigin('unit')}
                    onKeyDown={(e) => handleEscRevert(e, 'unit')}
                />
            </td>

            {/* Quantity */}
            <td className="border-r border-gray-700 p-1">
                <input
                    className={`${editableInputBaseClass} p-1 text-right font-bold text-base tracking-tight`}
                    value={item.quantity}
                    onChange={(e) => handleChange(item.id, 'quantity', e.target.value)}
                    onFocus={() => rememberFieldOrigin('quantity', item.quantity ?? "")}
                    onBlur={() => clearFieldOrigin('quantity')}
                    onKeyDown={(e) => handleEscRevert(e, 'quantity')}
                />
            </td>

            {/* Productivity */}
            <td className={`border-r border-gray-700 p-1 ${isLinked ? 'bg-blue-900/20' : ''}`}>
                <input
                    className={`w-full text-right outline-none p-1 text-base rounded ${isLinked
                        ? 'ui-table-editable-input-disabled text-blue-300 font-bold cursor-not-allowed'
                        : 'ui-table-editable-input text-gray-200 font-semibold'}`}
                    value={item.productivity}
                    disabled={isLinked}
                    onChange={(e) => handleChange(item.id, 'productivity', e.target.value)}
                    onFocus={() => rememberFieldOrigin('productivity', item.productivity ?? "")}
                    onBlur={() => clearFieldOrigin('productivity')}
                    onKeyDown={(e) => handleEscRevert(e, 'productivity')}
                />
            </td>

            {/* Crew */}
            <td className="border-r border-gray-700 p-1">
                <input
                    className={`${editableInputBaseClass} p-1 text-center text-base font-semibold`}
                    value={item.crew_size}
                    onChange={(e) => handleChange(item.id, 'crew_size', e.target.value)}
                    onFocus={() => rememberFieldOrigin('crew_size', item.crew_size ?? "")}
                    onBlur={() => clearFieldOrigin('crew_size')}
                    onKeyDown={(e) => handleEscRevert(e, 'crew_size')}
                />
            </td>

            {/* Daily Prod */}
            <td className="border-r border-gray-700 px-2 py-1 text-right text-gray-200 font-mono bg-[#1f1f2b] text-base font-semibold">
                {item.daily_production?.toLocaleString()}
            </td>

            {/* Apply Rate */}
            <td className="border-r border-gray-700 p-1">
                <div className="relative">
                    <input
                        className={`${editableInputBaseClass} p-1 pr-5 text-right text-base font-semibold`}
                        type="number"
                        value={item.application_rate ?? 100}
                        onChange={(e) => handleChange(item.id, 'application_rate', e.target.value)}
                        onFocus={() => rememberFieldOrigin('application_rate', item.application_rate ?? 100)}
                        onBlur={() => clearFieldOrigin('application_rate')}
                        onKeyDown={(e) => handleEscRevert(e, 'application_rate')}
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
                <input
                    className={`${editableInputBaseClass} p-1 text-sm font-medium`}
                    value={item.note || ""}
                    onChange={(e) => handleChange(item.id, 'note', e.target.value)}
                    onFocus={() => rememberFieldOrigin('note', item.note || "")}
                    onBlur={() => clearFieldOrigin('note')}
                    onKeyDown={(e) => handleEscRevert(e, 'note')}
                />
            </td>

            {/* Action */}
            <td className="p-1 text-center">
                <div className="flex items-center justify-center gap-1">
                    <button className="text-gray-400 hover:text-red-500 transition-colors" onClick={() => handleDeleteItem(item.id)}>
                        <Trash2 size={16} />
                    </button>
                </div>
            </td>
        </tr>
    );
};

export default ScheduleTableRow;
