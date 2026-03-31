import React, { useEffect, useMemo, useRef, useState } from "react";
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
    handleDeleteItem,
    onOpenRowClassEdit,
    onActivateItem,
    activeCell,
    cellSelectionRange,
    onActivateCell,
    onCellKeyDown,
    onCellPaste,
    onCellSelectionEnter,
    onCellSelectionStart,
    getCellSelectionClassName,
    isCellSelected,
    isOverlay,
    rowClassName = "",
    operatingRates = [],
    standardItems = [],
    onApplyStandard,
    isDropTarget = false,
    dropPosition = null,
    isDropInvalid = false,
    isPartOfDraggingGroup = false,
    isDragActive = false,
    disableDrag = false,
    isActive = false,
    spanInfo = null
}) => {
    const STICKY_LEFT_SELECT = 0;
    const STICKY_LEFT_DRAG = 40;

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
    const [suggestionField, setSuggestionField] = useState(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const blurTimeoutRef = useRef(null);
    const editOriginRef = useRef({});
    const processInputRef = useRef(null);
    const subProcessInputRef = useRef(null);
    const workTypeInputRef = useRef(null);
    const formulaInputRef = useRef(null);
    const unitInputRef = useRef(null);
    const noteInputRef = useRef(null);
    const editableInputBaseClass = "ui-table-editable-input text-gray-100";
    const focusRingClass = "ring-1 ring-cyan-400/70";
    const multilineInputClass = "resize-none overflow-hidden whitespace-pre-wrap break-words leading-snug";
    const getEditableStateClass = (field) => (
        activeCell?.itemId === item.id && activeCell?.field === field ? focusRingClass : ""
    );
    const getCellWrapperClass = (field, baseClass) => {
        const selectionClassName = getCellSelectionClassName?.(item.id, field)
            || `${isCellSelected?.(item.id, field) ? "schedule-cell-selected" : ""} ${activeCell?.itemId === item.id && activeCell?.field === field ? "schedule-cell-active" : ""}`;
        return `${baseClass} ${selectionClassName}`.trim();
    };

    const getCellWrapperProps = (field) => ({
        onMouseDownCapture: (e) => {
            if (isOverlay || e.button !== 0) return;
            onCellSelectionStart?.(item.id, field);
        },
        onMouseEnter: (e) => {
            if (isOverlay || (e.buttons & 1) !== 1) return;
            onCellSelectionEnter?.(item.id, field);
        }
    });

    const handleCellFocus = (field, currentValue) => {
        handleInputFocus(field, currentValue);
        onActivateCell?.(item.id, field);
    };

    const handleFieldKeyDown = (e, field, currentValue, options = {}) => {
        const {
            revertField = null,
            afterRevert = null,
            suggestions = null
        } = options;

        if (revertField && handleEscRevert(e, revertField, afterRevert)) {
            return;
        }
        if (suggestions) {
            handleSuggestionKeyDown(e, suggestions);
        }
        if (e.defaultPrevented) return;
        onCellKeyDown?.({ event: e, rowId: item.id, field, value: currentValue });
    };

    const handleFieldPaste = (e, field) => {
        const pastedText = e.clipboardData?.getData("text/plain");
        const intercepted = onCellPaste?.({
            rowId: item.id,
            field,
            text: pastedText
        });
        if (intercepted) {
            e.preventDefault();
        }
    };

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
        handleChange(item.id, field, original);
        clearFieldOrigin(field);
        return original;
    };

    const handleEscRevert = (e, field, afterRevert) => {
        if (e.key !== "Escape") return false;
        const reverted = revertField(field);
        if (afterRevert) afterRevert(reverted);
        setActiveField(null);
        setSuggestionField(null);
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
        return scored.sort((a, b) => b.score - a.score).slice(0, 80).map((entry) => entry.std);
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
        setSuggestionField(null);
    };

    const handleInputBlur = (field) => {
        clearFieldOrigin(field);
        blurTimeoutRef.current = setTimeout(() => {
            setActiveField(null);
            setSuggestionField(null);
        }, 220);
    };

    const handleSuggestionSelect = (std) => {
        if (onApplyStandard) onApplyStandard(item, std);
        setActiveField(null);
        setSuggestionField(null);
    };

    const handleSuggestionKeyDown = (e, suggestions) => {
        if (!suggestions || suggestions.length === 0) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSuggestionField(activeField);
            setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSuggestionField(activeField);
            setActiveIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === "Enter") {
            if (suggestionField !== activeField) return;
            e.preventDefault();
            const selected = suggestions[activeIndex] || suggestions[0];
            if (selected) handleSuggestionSelect(selected);
        }
    };

    const resizeTextarea = (element) => {
        if (!element) return;
        element.style.height = "0px";
        element.style.height = `${Math.max(element.scrollHeight, 34)}px`;
    };

    useEffect(() => {
        resizeTextarea(processInputRef.current);
        resizeTextarea(subProcessInputRef.current);
        resizeTextarea(workTypeInputRef.current);
        resizeTextarea(formulaInputRef.current);
        resizeTextarea(unitInputRef.current);
        resizeTextarea(noteInputRef.current);
    }, [item.process, item.sub_process, item.work_type, item.quantity_formula, item.unit, item.note]);

    const normalizedSpanInfo = spanInfo || {
        isProcessFirst: true,
        processRowSpan: 1,
        isSubProcessFirst: true,
        subProcessRowSpan: 1
    };

    return (
        <tr
            ref={setNodeRef}
            style={style}
            className={`hover:bg-white/5 transition-colors text-base ${rowClassName} ${isSelected ? "bg-blue-900/50" : ""} ${isDragging && !isOverlay ? "bg-blue-900/25" : ""} ${isPartOfDraggingGroup && !isDragging ? "bg-blue-900/30" : ""} ${isDropTarget ? (isDropInvalid ? "bg-red-900/25" : "bg-cyan-900/25") : ""}`}
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
                className={`sticky z-50 border-r border-gray-700 text-center p-1 select-none cursor-cell ${isSelected ? "bg-cyan-900/55 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.85)]" : "bg-[var(--navy-surface)]"}`}
                style={{ left: `${STICKY_LEFT_SELECT}px` }}
                onMouseDown={(e) => {
                    if (isOverlay || e.button !== 0) return;
                    if (!e.shiftKey) return;
                    e.preventDefault();
                    e.stopPropagation();
                    onStartSelectionDrag?.(item.id);
                }}
                onMouseEnter={(e) => {
                    if (isOverlay || e.buttons !== 1) return;
                    onDragSelectionEnter?.(item.id);
                }}
                title="체크박스 클릭: 단일 선택, Shift+드래그: 다중 선택"
            >
                {!isOverlay ? (
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                            e.stopPropagation();
                            onToggleSelect?.(item.id);
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                        }}
                        className="h-4 w-4 accent-cyan-400 cursor-pointer"
                        aria-label="행 선택"
                    />
                ) : null}
            </td>

            {/* Drag Handle */}
            <td
                className={`sticky z-30 border-r border-gray-700 bg-[var(--navy-surface)] text-center p-1 ${isDragActive ? "text-blue-300" : "text-gray-400"}`}
                style={{ left: `${STICKY_LEFT_DRAG}px` }}
            >
                <button
                    type="button"
                    aria-label="행 이동"
                    title={isPartOfDraggingGroup ? "선택 항목 일괄 이동 (같은 대공종 내)" : "행 이동 (같은 대공종 내)"}
                    disabled={isOverlay || disableDrag}
                    className={`mx-auto flex h-6 w-6 items-center justify-center rounded-md transition ${(isOverlay || disableDrag) ? "text-gray-500 cursor-default" : "cursor-grab active:cursor-grabbing hover:bg-blue-500/20 hover:text-blue-100 active:scale-95"} ${isDragging ? "bg-blue-500/30 text-blue-100" : ""}`}
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical size={14} className="mx-auto" />
                </button>
            </td>

            {/* Classification (중공종) */}
            {normalizedSpanInfo.isProcessFirst && (
                <td
                    rowSpan={normalizedSpanInfo.processRowSpan}
                    className={getCellWrapperClass('process', "border-r border-gray-700 bg-[#2c2c3a] p-1 align-top")}
                    {...getCellWrapperProps('process')}
                >
                    <div className="relative">
                        <textarea
                            ref={processInputRef}
                            rows={1}
                            className={`${editableInputBaseClass} ${multilineInputClass} px-1 py-1 font-medium text-center text-base ${getEditableStateClass('process')}`}
                            data-schedule-cell="true"
                            data-schedule-row-id={item.id}
                            data-schedule-field="process"
                            value={item.process}
                            onChange={(e) => {
                                handleChange(item.id, 'process', e.target.value);
                                setProcessQuery(e.target.value);
                                setSuggestionField('process');
                                resizeTextarea(e.currentTarget);
                            }}
                            onFocus={(e) => {
                                handleCellFocus('process', item.process || "");
                                resizeTextarea(e.currentTarget);
                            }}
                            onBlur={() => handleInputBlur('process')}
                            onKeyDown={(e) => handleFieldKeyDown(e, 'process', e.currentTarget.value, {
                                revertField: 'process',
                                afterRevert: (value) => setProcessQuery(value ?? ""),
                                suggestions: processSuggestions
                            })}
                            onPaste={(e) => handleFieldPaste(e, 'process')}
                        />
                        <StandardSuggestList
                            items={processSuggestions}
                            isOpen={!isOverlay && activeField === 'process' && suggestionField === 'process'}
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
            {normalizedSpanInfo.isSubProcessFirst && (
                <td
                    rowSpan={normalizedSpanInfo.subProcessRowSpan}
                    className={getCellWrapperClass('sub_process', "border-r border-gray-700 bg-[#2c2c3a] p-1 align-top")}
                    {...getCellWrapperProps('sub_process')}
                >
                    <div className="relative">
                        <textarea
                            ref={subProcessInputRef}
                            rows={1}
                            className={`${editableInputBaseClass} ${multilineInputClass} px-1 py-1 font-medium text-center text-base ${getEditableStateClass('sub_process')}`}
                            data-schedule-cell="true"
                            data-schedule-row-id={item.id}
                            data-schedule-field="sub_process"
                            value={item.sub_process || ""}
                            onChange={(e) => {
                                handleChange(item.id, 'sub_process', e.target.value);
                                setSubProcessQuery(e.target.value);
                                setSuggestionField('sub_process');
                                resizeTextarea(e.currentTarget);
                            }}
                            onFocus={(e) => {
                                handleCellFocus('sub_process', item.sub_process || "");
                                resizeTextarea(e.currentTarget);
                            }}
                            onBlur={() => handleInputBlur('sub_process')}
                            onKeyDown={(e) => handleFieldKeyDown(e, 'sub_process', e.currentTarget.value, {
                                revertField: 'sub_process',
                                afterRevert: (value) => setSubProcessQuery(value ?? ""),
                                suggestions: subProcessSuggestions
                            })}
                            onPaste={(e) => handleFieldPaste(e, 'sub_process')}
                        />
                        <StandardSuggestList
                            items={subProcessSuggestions}
                            isOpen={!isOverlay && activeField === 'sub_process' && suggestionField === 'sub_process'}
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
            <td
                className={getCellWrapperClass('work_type', "border-r border-gray-700 px-2 py-1")}
                {...getCellWrapperProps('work_type')}
            >
                <div className="flex items-center gap-1 relative">
                    {isLinked && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-blue-400/40 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-200" title="외부 모듈과 연결된 항목">
                            <Link size={11} className="text-blue-300" />
                            연결
                        </span>
                    )}
                    <textarea
                        ref={workTypeInputRef}
                        rows={1}
                        className={`${editableInputBaseClass} ${multilineInputClass} p-1 text-base font-medium ${getEditableStateClass('work_type')}`}
                        data-schedule-cell="true"
                        data-schedule-row-id={item.id}
                        data-schedule-field="work_type"
                        value={item.work_type}
                        onChange={(e) => {
                            handleChange(item.id, 'work_type', e.target.value);
                            setWorkTypeQuery(e.target.value);
                            setSuggestionField('work_type');
                            resizeTextarea(e.currentTarget);
                        }}
                        onFocus={(e) => {
                            handleCellFocus('work_type', item.work_type || "");
                            resizeTextarea(e.currentTarget);
                        }}
                        onBlur={() => handleInputBlur('work_type')}
                        onKeyDown={(e) => handleFieldKeyDown(e, 'work_type', e.currentTarget.value, {
                            revertField: 'work_type',
                            afterRevert: (value) => setWorkTypeQuery(value ?? ""),
                            suggestions: workTypeSuggestions
                        })}
                        onPaste={(e) => handleFieldPaste(e, 'work_type')}
                    />
                    <StandardSuggestList
                        items={workTypeSuggestions}
                        isOpen={!isOverlay && activeField === 'work_type' && suggestionField === 'work_type'}
                        activeIndex={activeIndex}
                        onActiveIndexChange={setActiveIndex}
                        onSelect={handleSuggestionSelect}
                        position="bottom"
                        anchorRef={workTypeInputRef}
                    />
                </div>
            </td>

            {/* Formula */}
            <td
                className={getCellWrapperClass('quantity_formula', "border-r border-gray-700 p-1")}
                {...getCellWrapperProps('quantity_formula')}
            >
                <textarea
                    ref={formulaInputRef}
                    rows={1}
                    className={`${editableInputBaseClass} ${multilineInputClass} p-1 text-right text-sm font-medium ${getEditableStateClass('quantity_formula')}`}
                    data-schedule-cell="true"
                    data-schedule-row-id={item.id}
                    data-schedule-field="quantity_formula"
                    value={item.quantity_formula || ''}
                    placeholder="-"
                    onChange={(e) => {
                        handleChange(item.id, 'quantity_formula', e.target.value);
                        resizeTextarea(e.currentTarget);
                    }}
                    onFocus={(e) => {
                        onActivateCell?.(item.id, 'quantity_formula');
                        rememberFieldOrigin('quantity_formula', item.quantity_formula || "");
                        resizeTextarea(e.currentTarget);
                    }}
                    onBlur={() => clearFieldOrigin('quantity_formula')}
                    onKeyDown={(e) => handleFieldKeyDown(e, 'quantity_formula', e.currentTarget.value, {
                        revertField: 'quantity_formula'
                    })}
                    onPaste={(e) => handleFieldPaste(e, 'quantity_formula')}
                />
            </td>

            {/* Unit */}
            <td
                className={getCellWrapperClass('unit', "border-r border-gray-700 p-1")}
                {...getCellWrapperProps('unit')}
            >
                <textarea
                    ref={unitInputRef}
                    rows={1}
                    className={`${editableInputBaseClass} ${multilineInputClass} p-1 text-center text-base font-medium ${getEditableStateClass('unit')}`}
                    data-schedule-cell="true"
                    data-schedule-row-id={item.id}
                    data-schedule-field="unit"
                    value={item.unit}
                    onChange={(e) => {
                        handleChange(item.id, 'unit', e.target.value);
                        resizeTextarea(e.currentTarget);
                    }}
                    onFocus={(e) => {
                        onActivateCell?.(item.id, 'unit');
                        rememberFieldOrigin('unit', item.unit || "");
                        resizeTextarea(e.currentTarget);
                    }}
                    onBlur={() => clearFieldOrigin('unit')}
                    onKeyDown={(e) => handleFieldKeyDown(e, 'unit', e.currentTarget.value, {
                        revertField: 'unit'
                    })}
                    onPaste={(e) => handleFieldPaste(e, 'unit')}
                />
            </td>

            {/* Quantity */}
            <td
                className={getCellWrapperClass('quantity', "border-r border-gray-700 p-1")}
                {...getCellWrapperProps('quantity')}
            >
                <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    className={`${editableInputBaseClass} p-1 text-right font-bold text-base tracking-tight ${getEditableStateClass('quantity')}`}
                    data-schedule-cell="true"
                    data-schedule-row-id={item.id}
                    data-schedule-field="quantity"
                    value={item.quantity}
                    onChange={(e) => handleChange(item.id, 'quantity', e.target.value)}
                    onFocus={() => {
                        onActivateCell?.(item.id, 'quantity');
                        rememberFieldOrigin('quantity', item.quantity ?? "");
                    }}
                    onBlur={() => clearFieldOrigin('quantity')}
                    onKeyDown={(e) => handleFieldKeyDown(e, 'quantity', e.currentTarget.value, {
                        revertField: 'quantity'
                    })}
                    onPaste={(e) => handleFieldPaste(e, 'quantity')}
                />
            </td>

            {/* Productivity */}
            <td
                className={getCellWrapperClass('productivity', `border-r border-gray-700 p-1 ${isLinked ? 'bg-blue-900/20' : ''}`)}
                {...getCellWrapperProps('productivity')}
            >
                <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    className={`w-full text-right outline-none p-1 text-base rounded ${isLinked
                        ? 'ui-table-editable-input-disabled text-blue-300 font-bold cursor-not-allowed'
                        : `ui-table-editable-input text-gray-200 font-semibold ${getEditableStateClass('productivity')}`}`}
                    data-schedule-cell="true"
                    data-schedule-row-id={item.id}
                    data-schedule-field="productivity"
                    value={item.productivity}
                    disabled={isLinked}
                    onChange={(e) => handleChange(item.id, 'productivity', e.target.value)}
                    onFocus={() => {
                        onActivateCell?.(item.id, 'productivity');
                        rememberFieldOrigin('productivity', item.productivity ?? "");
                    }}
                    onBlur={() => clearFieldOrigin('productivity')}
                    onKeyDown={(e) => handleFieldKeyDown(e, 'productivity', e.currentTarget.value, {
                        revertField: 'productivity'
                    })}
                    onPaste={(e) => handleFieldPaste(e, 'productivity')}
                    title={isLinked ? "연결 모듈 항목은 생산량을 직접 수정할 수 없습니다." : undefined}
                />
            </td>

            {/* Crew */}
            <td
                className={getCellWrapperClass('crew_size', "border-r border-gray-700 p-1")}
                {...getCellWrapperProps('crew_size')}
            >
                <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    className={`${editableInputBaseClass} p-1 text-center text-base font-semibold ${getEditableStateClass('crew_size')}`}
                    data-schedule-cell="true"
                    data-schedule-row-id={item.id}
                    data-schedule-field="crew_size"
                    value={item.crew_size}
                    onChange={(e) => handleChange(item.id, 'crew_size', e.target.value)}
                    onFocus={() => {
                        onActivateCell?.(item.id, 'crew_size');
                        rememberFieldOrigin('crew_size', item.crew_size ?? "");
                    }}
                    onBlur={() => clearFieldOrigin('crew_size')}
                    onKeyDown={(e) => handleFieldKeyDown(e, 'crew_size', e.currentTarget.value, {
                        revertField: 'crew_size'
                    })}
                    onPaste={(e) => handleFieldPaste(e, 'crew_size')}
                />
            </td>

            {/* Daily Prod */}
            <td className="border-r border-gray-700 px-2 py-1 text-right text-gray-200 font-mono bg-[#1f1f2b] text-base font-semibold">
                {item.daily_production?.toLocaleString()}
            </td>

            {/* CP Check */}
            <td
                className={getCellWrapperClass('cp_checked', "border-r border-gray-700 p-1 text-center")}
                {...getCellWrapperProps('cp_checked')}
            >
                <input
                    type="checkbox"
                    data-schedule-cell="true"
                    data-schedule-row-id={item.id}
                    data-schedule-field="cp_checked"
                    checked={item.cp_checked !== false}
                    onChange={(e) => handleChange(item.id, 'cp_checked', e.target.checked)}
                    onFocus={() => {
                        onActivateCell?.(item.id, 'cp_checked');
                        rememberFieldOrigin('cp_checked', item.cp_checked !== false);
                    }}
                    onBlur={() => clearFieldOrigin('cp_checked')}
                    onKeyDown={(e) => handleFieldKeyDown(e, 'cp_checked', e.currentTarget.checked, {
                        revertField: 'cp_checked'
                    })}
                    onPaste={(e) => handleFieldPaste(e, 'cp_checked')}
                    className="h-4 w-4 accent-blue-500 cursor-pointer"
                    aria-label="CP 체크"
                />
            </td>

            {/* Parallel Rate */}
            <td
                className={getCellWrapperClass('parallel_rate', "border-r border-gray-700 p-1")}
                {...getCellWrapperProps('parallel_rate')}
            >
                <div className="relative">
                    <input
                        className={`${editableInputBaseClass} p-1 pr-5 text-right text-base font-semibold ${item.cp_checked === false ? "bg-[#1f1f2b] text-gray-300" : ""} ${getEditableStateClass('parallel_rate')}`}
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        data-schedule-cell="true"
                        data-schedule-row-id={item.id}
                        data-schedule-field="parallel_rate"
                        value={item.cp_checked === false ? 100 : (item.parallel_rate ?? item.application_rate ?? 100)}
                        onChange={(e) => {
                            if (item.cp_checked === false) {
                                handleChange(item.id, 'cp_checked', true);
                            }
                            handleChange(item.id, 'parallel_rate', e.target.value);
                        }}
                        onFocus={() => {
                            onActivateCell?.(item.id, 'parallel_rate');
                            rememberFieldOrigin('parallel_rate', item.parallel_rate ?? item.application_rate ?? 100);
                        }}
                        onBlur={() => clearFieldOrigin('parallel_rate')}
                        onKeyDown={(e) => handleFieldKeyDown(e, 'parallel_rate', e.currentTarget.value, {
                            revertField: 'parallel_rate'
                        })}
                        onPaste={(e) => handleFieldPaste(e, 'parallel_rate')}
                        title={item.cp_checked === false ? "입력 시 CP 체크가 자동 활성화됩니다." : undefined}
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">%</span>
                </div>
            </td>

            {/* Reflection Rate */}
            <td
                className={getCellWrapperClass('reflection_rate', "border-r border-gray-700 p-1")}
                {...getCellWrapperProps('reflection_rate')}
            >
                <div className="relative">
                    <input
                        className={`${editableInputBaseClass} p-1 pr-5 text-right text-base font-semibold ${getEditableStateClass('reflection_rate')}`}
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        data-schedule-cell="true"
                        data-schedule-row-id={item.id}
                        data-schedule-field="reflection_rate"
                        value={item.reflection_rate ?? 100}
                        onChange={(e) => handleChange(item.id, 'reflection_rate', e.target.value)}
                        onFocus={() => {
                            onActivateCell?.(item.id, 'reflection_rate');
                            rememberFieldOrigin('reflection_rate', item.reflection_rate ?? 100);
                        }}
                        onBlur={() => clearFieldOrigin('reflection_rate')}
                        onKeyDown={(e) => handleFieldKeyDown(e, 'reflection_rate', e.currentTarget.value, {
                            revertField: 'reflection_rate'
                        })}
                        onPaste={(e) => handleFieldPaste(e, 'reflection_rate')}
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
            <td
                className={getCellWrapperClass('note', "border-r border-gray-700 p-1")}
                {...getCellWrapperProps('note')}
            >
                <textarea
                    ref={noteInputRef}
                    rows={1}
                    className={`${editableInputBaseClass} ${multilineInputClass} p-1 text-sm font-medium ${getEditableStateClass('note')}`}
                    data-schedule-cell="true"
                    data-schedule-row-id={item.id}
                    data-schedule-field="note"
                    value={item.note || ""}
                    onChange={(e) => {
                        handleChange(item.id, 'note', e.target.value);
                        resizeTextarea(e.currentTarget);
                    }}
                    onFocus={(e) => {
                        onActivateCell?.(item.id, 'note');
                        rememberFieldOrigin('note', item.note || "");
                        resizeTextarea(e.currentTarget);
                    }}
                    onBlur={() => clearFieldOrigin('note')}
                    onKeyDown={(e) => handleFieldKeyDown(e, 'note', e.currentTarget.value, {
                        revertField: 'note'
                    })}
                    onPaste={(e) => handleFieldPaste(e, 'note')}
                />
            </td>

            {/* Action */}
            <td className="p-1 text-center">
                <div className="flex items-center justify-center gap-1">
                    <button
                        type="button"
                        aria-label="행 삭제"
                        title="행 삭제"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:text-red-400 hover:bg-red-500/15 transition-colors"
                        onClick={() => handleDeleteItem(item.id)}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </td>
        </tr>
    );
};

export default ScheduleTableRow;
