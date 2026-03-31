import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Layers3, MoreVertical, Plus, RefreshCw, SlidersHorizontal, Trash2 } from "lucide-react";
import {
    calculateTotalCalendarDays,
    calculateTotalCalendarMonths,
    getCategoryManualTotalDays,
    isSingleTotalInputCategory
} from "../../../utils/scheduleCalculations";
import ScheduleTableRow from "./ScheduleTableRow";

export default function ScheduleCategorySection({
    forPrint,
    category,
    categoryItems,
    allCategoryItems,
    categoryIndex,
    categoryEntriesLength,
    categoryRenameTarget,
    categoryRenameValue,
    setCategoryRenameValue,
    handleCommitCategoryRename,
    handleCancelCategoryRename,
    handleStartCategoryRename,
    isFilterActive,
    hasSearchKeyword,
    operatingRates,
    handleCategoryRunRateChange,
    handleCategoryTotalDaysChange,
    openCategoryMenu,
    setOpenCategoryMenu,
    categoryMenuRef,
    categoryMenuPosition,
    categoryMenuDropdownRef,
    handleMoveCategory,
    activeEditingItem,
    fallbackItem,
    handleAddItem,
    handleOpenImport,
    handleOpenEvidence,
    handleOpenFloorBatchModal,
    handleDeleteCategory,
    selectedItemIds,
    toggleSelectItem,
    startSelectionDrag,
    dragSelectItem,
    handleChange,
    handleDeleteItem,
    handleOpenRowClassEdit,
    handleActivateItem,
    activeCell,
    cellSelectionRange,
    handleActivateCell,
    handleCellKeyDown,
    handleCellPaste,
    handleCellSelectionEnter,
    handleCellSelectionStart,
    getCellSelectionClassName,
    isCellSelected,
    standardItems,
    handleApplyStandardToRow,
    activeId,
    dragMovingItemSet,
    dropTargetId,
    dropPosition,
    isDropInvalid,
    activeEditingItemId
}) {
    const categoryCalDays = calculateTotalCalendarDays(allCategoryItems);
    const categoryCalMonths = calculateTotalCalendarMonths(categoryCalDays);
    const isSingleInputCategory = useMemo(
        () => isSingleTotalInputCategory(category),
        [category]
    );
    const manualCategoryTotal = useMemo(
        () => getCategoryManualTotalDays(allCategoryItems),
        [allCategoryItems]
    );
    const [categoryTotalInput, setCategoryTotalInput] = useState(
        manualCategoryTotal !== null ? String(manualCategoryTotal) : ""
    );
    const visibleCategoryCount = categoryItems.length;
    const totalCategoryCount = allCategoryItems.length;
    const canGenerateFloorBatch = /골조|RC|철근콘크리트/i.test(String(category));
    const categoryRate = operatingRates.find((rate) => rate.main_category === category);
    const currentRunRate = categoryRate?.work_week_days || 6;

    useEffect(() => {
        if (manualCategoryTotal === null) {
            setCategoryTotalInput("");
            return;
        }
        setCategoryTotalInput(String(manualCategoryTotal));
    }, [manualCategoryTotal, category]);

    const commitCategoryTotalDays = useCallback(() => {
        if (!isSingleInputCategory || !handleCategoryTotalDaysChange) return;

        const rawValue = String(categoryTotalInput || "").trim();
        if (!rawValue) {
            handleCategoryTotalDaysChange(category, null);
            return;
        }

        const parsedValue = parseFloat(rawValue);
        if (!Number.isFinite(parsedValue) || parsedValue < 0) {
            setCategoryTotalInput(manualCategoryTotal !== null ? String(manualCategoryTotal) : "");
            return;
        }

        const normalizedValue = parseFloat(parsedValue.toFixed(1));
        handleCategoryTotalDaysChange(category, normalizedValue);
        setCategoryTotalInput(String(normalizedValue));
    }, [category, categoryTotalInput, handleCategoryTotalDaysChange, isSingleInputCategory, manualCategoryTotal]);

    const getCategoryActionTarget = useCallback(() => {
        const lastCategoryItem = allCategoryItems[allCategoryItems.length - 1] || fallbackItem;
        if (!lastCategoryItem) return null;
        return {
            ...lastCategoryItem,
            main_category: category
        };
    }, [allCategoryItems, category, fallbackItem]);

    const handleQuickOpenImport = useCallback(() => {
        const target = getCategoryActionTarget();
        if (!target) return;
        handleOpenImport(target);
        setOpenCategoryMenu(null);
    }, [getCategoryActionTarget, handleOpenImport, setOpenCategoryMenu]);

    const handleQuickOpenEvidence = useCallback(() => {
        const target = getCategoryActionTarget();
        handleOpenEvidence(target || null);
        setOpenCategoryMenu(null);
    }, [getCategoryActionTarget, handleOpenEvidence, setOpenCategoryMenu]);

    const handleQuickOpenFloorBatch = useCallback(() => {
        if (!canGenerateFloorBatch) return;
        handleOpenFloorBatchModal(category, allCategoryItems);
        setOpenCategoryMenu(null);
    }, [allCategoryItems, canGenerateFloorBatch, category, handleOpenFloorBatchModal, setOpenCategoryMenu]);

    const spanInfoMap = useMemo(() => {
        const map = {};

        let processStart = 0;
        while (processStart < categoryItems.length) {
            const processValue = String(categoryItems[processStart]?.process || "");
            let processEnd = processStart + 1;
            while (
                processEnd < categoryItems.length &&
                String(categoryItems[processEnd]?.process || "") === processValue
            ) {
                processEnd += 1;
            }

            const processRowSpan = processEnd - processStart;
            for (let index = processStart; index < processEnd; index += 1) {
                const itemId = categoryItems[index]?.id;
                if (!itemId) continue;
                map[itemId] = {
                    ...(map[itemId] || {}),
                    isProcessFirst: index === processStart,
                    processRowSpan
                };
            }

            let subProcessStart = processStart;
            while (subProcessStart < processEnd) {
                const subProcessValue = String(categoryItems[subProcessStart]?.sub_process || "");
                let subProcessEnd = subProcessStart + 1;
                while (
                    subProcessEnd < processEnd &&
                    String(categoryItems[subProcessEnd]?.sub_process || "") === subProcessValue
                ) {
                    subProcessEnd += 1;
                }

                const subProcessRowSpan = subProcessEnd - subProcessStart;
                for (let index = subProcessStart; index < subProcessEnd; index += 1) {
                    const itemId = categoryItems[index]?.id;
                    if (!itemId) continue;
                    map[itemId] = {
                        ...(map[itemId] || {}),
                        isSubProcessFirst: index === subProcessStart,
                        subProcessRowSpan
                    };
                }

                subProcessStart = subProcessEnd;
            }

            processStart = processEnd;
        }

        return map;
    }, [categoryItems]);

    return (
        <React.Fragment>
            <tr className="bg-gradient-to-r from-[var(--navy-surface)] to-[var(--navy-surface-2)] border-t border-[var(--navy-border-soft)]">
                <td colSpan="19" className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <div className="ui-accent-dot w-1 h-5 rounded-full"></div>
                            {categoryRenameTarget === category && !forPrint ? (
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="text"
                                        value={categoryRenameValue}
                                        onChange={(e) => setCategoryRenameValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                handleCommitCategoryRename(category);
                                            } else if (e.key === "Escape") {
                                                e.preventDefault();
                                                handleCancelCategoryRename();
                                            }
                                        }}
                                        autoFocus
                                        className="ui-input py-1 px-2 min-w-[180px]"
                                        aria-label="대공종명 수정"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleCommitCategoryRename(category)}
                                        className="rounded-md border border-[var(--navy-accent)] px-2 py-1 text-[11px] font-semibold text-white bg-[var(--navy-accent)] hover:bg-[var(--navy-accent-hover)]"
                                    >
                                        적용
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCancelCategoryRename}
                                        className="rounded-md border border-[var(--navy-border)] px-2 py-1 text-[11px] text-[var(--navy-text-muted)] hover:bg-[var(--navy-surface-3)]"
                                    >
                                        취소
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <h3 className="font-bold text-[var(--navy-text)] text-base tracking-tight">
                                        {category}
                                    </h3>
                                    {!forPrint && (
                                        <button
                                            type="button"
                                            onClick={() => handleStartCategoryRename(category)}
                                            className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--navy-border)] bg-[var(--navy-surface-2)] px-3 text-xs font-bold text-[var(--navy-text)] shadow-sm transition hover:bg-[var(--navy-surface-3)] hover:border-[var(--navy-accent)]"
                                        >
                                            이름수정
                                        </button>
                                    )}
                                </>
                            )}
                            <span className="text-xs text-[var(--navy-text-muted)] bg-[var(--navy-bg)] px-2 py-0.5 rounded-full border border-[var(--navy-border-soft)]">
                                {isFilterActive && visibleCategoryCount !== totalCategoryCount
                                    ? `${visibleCategoryCount}개 표시 / 전체 ${totalCategoryCount}개`
                                    : `${totalCategoryCount}개 항목`}
                            </span>
                            {hasSearchKeyword && (
                                <span className="text-xs text-emerald-200 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-400/40">
                                    검색 결과
                                </span>
                            )}
                            {isSingleInputCategory && !forPrint ? (
                                <div className="flex items-center gap-2 rounded-full border border-[rgb(75_85_99/0.45)] bg-[rgb(59_59_79/0.22)] px-2 py-1">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--navy-text-muted)]">
                                        전체기간
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={categoryTotalInput}
                                        onChange={(e) => setCategoryTotalInput(e.target.value)}
                                        onBlur={commitCategoryTotalDays}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                commitCategoryTotalDays();
                                            } else if (e.key === "Escape") {
                                                e.preventDefault();
                                                setCategoryTotalInput(manualCategoryTotal !== null ? String(manualCategoryTotal) : "");
                                            }
                                        }}
                                        placeholder="일수"
                                        className="ui-input h-7 w-20 py-0 px-2 text-xs"
                                        aria-label={`${category} 전체기간 입력`}
                                    />
                                    <span className="text-xs ui-accent-text font-semibold">
                                        {categoryCalDays}일 ({categoryCalMonths}개월)
                                    </span>
                                </div>
                            ) : (
                                <span className="text-xs ui-accent-text bg-[rgb(59_59_79/0.22)] px-2 py-0.5 rounded-full border border-[rgb(75_85_99/0.45)] font-semibold">
                                    {categoryCalDays}일 ({categoryCalMonths}개월)
                                </span>
                            )}
                            <div className="flex items-center gap-2 ml-4">
                                <label className="text-[10px] font-bold text-[var(--navy-text-muted)] uppercase tracking-widest">주간 가동</label>
                                <select
                                    className="ui-input py-1 px-2"
                                    value={currentRunRate}
                                    onChange={(e) => handleCategoryRunRateChange(category, e.target.value)}
                                    disabled={forPrint}
                                >
                                    <option value="5">주5일</option>
                                    <option value="6">주6일</option>
                                    <option value="7">주7일</option>
                                </select>
                            </div>
                        </div>
                        <div
                            className={`flex items-center ${forPrint
                                ? "no-print"
                                : "sticky right-1 ml-auto border-l border-[var(--navy-border-soft)] bg-[rgb(44_44_58/0.96)] py-1 pl-3 pr-1 backdrop-blur-sm"
                                }`}
                        >
                            <div
                                className="relative inline-flex items-center gap-1 rounded-lg border border-[var(--navy-border)] bg-[var(--navy-surface)] p-1 shadow-sm"
                                ref={openCategoryMenu === category ? categoryMenuRef : undefined}
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleMoveCategory(category, "up");
                                        setOpenCategoryMenu(null);
                                    }}
                                    disabled={isFilterActive || categoryIndex === 0}
                                    className={`flex h-8 w-8 items-center justify-center rounded-md border transition ${(isFilterActive || categoryIndex === 0)
                                        ? "cursor-not-allowed border-gray-700 text-gray-500"
                                        : "border-[var(--navy-border)] text-[var(--navy-text)] hover:bg-[var(--navy-surface-3)]"
                                        }`}
                                    title={isFilterActive ? "필터 적용 중에는 대공종 순서를 이동할 수 없습니다." : "대공종 위로 이동"}
                                    aria-label="대공종 위로 이동"
                                >
                                    <ArrowUp size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleMoveCategory(category, "down");
                                        setOpenCategoryMenu(null);
                                    }}
                                    disabled={isFilterActive || categoryIndex === categoryEntriesLength - 1}
                                    className={`flex h-8 w-8 items-center justify-center rounded-md border transition ${(isFilterActive || categoryIndex === categoryEntriesLength - 1)
                                        ? "cursor-not-allowed border-gray-700 text-gray-500"
                                        : "border-[var(--navy-border)] text-[var(--navy-text)] hover:bg-[var(--navy-surface-3)]"
                                        }`}
                                    title={isFilterActive ? "필터 적용 중에는 대공종 순서를 이동할 수 없습니다." : "대공종 아래로 이동"}
                                    aria-label="대공종 아래로 이동"
                                >
                                    <ArrowDown size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const lastCategoryItem = allCategoryItems[allCategoryItems.length - 1] || fallbackItem;
                                        const activeInCategory = activeEditingItem && activeEditingItem.main_category === category
                                            ? activeEditingItem
                                            : null;
                                        const targetItem = activeInCategory || lastCategoryItem;
                                        if (targetItem) {
                                            handleAddItem({
                                                ...targetItem,
                                                main_category: category,
                                                process: category === targetItem.main_category ? targetItem.process : "",
                                                sub_process: category === targetItem.main_category ? (targetItem.sub_process || "") : ""
                                            });
                                        }
                                        setOpenCategoryMenu(null);
                                    }}
                                    className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--navy-accent)] bg-[var(--navy-accent)] text-white transition hover:bg-[var(--navy-accent-hover)]"
                                    title="항목 추가"
                                    aria-label="항목 추가"
                                >
                                    <Plus size={13} />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleQuickOpenImport}
                                    className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--navy-border)] px-2 text-[11px] font-semibold text-[var(--navy-text)] transition hover:bg-[var(--navy-surface-3)]"
                                    title="표준품셈 선택"
                                    aria-label="표준품셈 선택"
                                >
                                    <RefreshCw size={12} />
                                    표준품셈
                                </button>
                                <button
                                    type="button"
                                    onClick={handleQuickOpenEvidence}
                                    className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--navy-border)] px-2 text-[11px] font-semibold text-[var(--navy-text)] transition hover:bg-[var(--navy-surface-3)]"
                                    title="근거 데이터 반영"
                                    aria-label="근거 데이터 반영"
                                >
                                    <SlidersHorizontal size={12} />
                                    근거반영
                                </button>
                                <button
                                    type="button"
                                    onClick={handleQuickOpenFloorBatch}
                                    disabled={!canGenerateFloorBatch}
                                    className={`inline-flex h-8 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition ${canGenerateFloorBatch
                                        ? "border-[var(--navy-border)] text-[var(--navy-text)] hover:bg-[var(--navy-surface-3)]"
                                        : "cursor-not-allowed border-gray-700 text-[var(--navy-text-muted)] opacity-60"
                                        }`}
                                    title={canGenerateFloorBatch ? "층별 공정 생성" : "골조/RC 계열 대공종에서만 사용할 수 있습니다."}
                                    aria-label="층별 공정 생성"
                                >
                                    <Layers3 size={12} />
                                    층별생성
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOpenCategoryMenu((prev) => (prev === category ? null : category))}
                                    className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--navy-border)] text-[var(--navy-text)] transition hover:bg-[var(--navy-surface-3)]"
                                    title="더보기"
                                    aria-label="더보기"
                                >
                                    <MoreVertical size={13} />
                                </button>
                                {openCategoryMenu === category && categoryMenuPosition && typeof document !== "undefined" && createPortal(
                                    <div
                                        ref={categoryMenuDropdownRef}
                                        className="z-[240] min-w-[172px] rounded-lg border border-[var(--navy-border-soft)] bg-[var(--navy-surface)] p-1 shadow-2xl"
                                        style={{
                                            position: "fixed",
                                            top: `${categoryMenuPosition.top}px`,
                                            left: `${categoryMenuPosition.left}px`
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={handleQuickOpenImport}
                                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[var(--navy-text)] transition hover:bg-[var(--navy-surface-3)]"
                                        >
                                            <RefreshCw size={12} />
                                            표준품셈 선택
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleQuickOpenEvidence}
                                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[var(--navy-text)] transition hover:bg-[var(--navy-surface-3)]"
                                        >
                                            <SlidersHorizontal size={12} />
                                            근거 데이터 반영
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleQuickOpenFloorBatch}
                                            disabled={!canGenerateFloorBatch}
                                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition ${canGenerateFloorBatch
                                                ? "text-[var(--navy-text)] hover:bg-[var(--navy-surface-3)]"
                                                : "cursor-not-allowed text-[var(--navy-text-muted)] opacity-60"
                                                }`}
                                            title={canGenerateFloorBatch ? "층별 공정 생성" : "골조/RC 계열 대공종에서만 사용할 수 있습니다."}
                                        >
                                            <Layers3 size={12} />
                                            층별 공정 생성
                                        </button>
                                        <div className="my-1 h-px w-full bg-[var(--navy-border-soft)]" />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleDeleteCategory(category, allCategoryItems);
                                                setOpenCategoryMenu(null);
                                            }}
                                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-red-200 transition hover:bg-red-500/10"
                                        >
                                            <Trash2 size={12} />
                                            대공종 삭제
                                        </button>
                                    </div>,
                                    document.body
                                )}
                            </div>
                        </div>
                    </div>
                </td>
            </tr>

            {categoryItems.map((item, rowIndex) => (
                <ScheduleTableRow
                    key={item.id}
                    item={item}
                    isSelected={selectedItemIds.includes(item.id)}
                    onToggleSelect={toggleSelectItem}
                    onStartSelectionDrag={startSelectionDrag}
                    onDragSelectionEnter={dragSelectItem}
                    rowClassName={`${rowIndex % 2 === 0 ? "bg-[var(--navy-bg)]" : "bg-[var(--navy-surface)]"} ${hasSearchKeyword ? "outline outline-1 -outline-offset-1 outline-emerald-500/40" : ""}`}
                    operatingRates={operatingRates}
                    isLinked={item.link_module_type && item.link_module_type !== "NONE"}
                    handleChange={handleChange}
                    handleDeleteItem={handleDeleteItem}
                    onOpenRowClassEdit={handleOpenRowClassEdit}
                    onActivateItem={handleActivateItem}
                    activeCell={activeCell}
                    cellSelectionRange={cellSelectionRange}
                    onActivateCell={handleActivateCell}
                    onCellKeyDown={handleCellKeyDown}
                    onCellPaste={handleCellPaste}
                    onCellSelectionEnter={handleCellSelectionEnter}
                    onCellSelectionStart={handleCellSelectionStart}
                    getCellSelectionClassName={getCellSelectionClassName}
                    isCellSelected={isCellSelected}
                    standardItems={standardItems}
                    onApplyStandard={handleApplyStandardToRow}
                    isDragActive={Boolean(activeId)}
                    isPartOfDraggingGroup={Boolean(activeId) && dragMovingItemSet.has(item.id)}
                    isDropTarget={dropTargetId === item.id}
                    dropPosition={dropTargetId === item.id ? dropPosition : null}
                    isDropInvalid={isDropInvalid && dropTargetId === item.id}
                    disableDrag={isFilterActive}
                    isActive={activeEditingItemId === item.id}
                    spanInfo={spanInfoMap[item.id] || {
                        isProcessFirst: true,
                        processRowSpan: 1,
                        isSubProcessFirst: true,
                        subProcessRowSpan: 1
                    }}
                />
            ))}
        </React.Fragment>
    );
}
