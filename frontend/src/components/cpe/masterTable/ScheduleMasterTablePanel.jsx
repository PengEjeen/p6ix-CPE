import React from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import ScheduleMasterTableToolbarRow from "./ScheduleMasterTableToolbarRow";
import ScheduleCategorySection from "./ScheduleCategorySection";
import { SCHEDULE_MASTER_TABLE_COLUMNS } from "./scheduleMasterTableColumns";

export default function ScheduleMasterTablePanel({
    activeCell,
    cellSelectionRange,
    activeEditingItem,
    activeEditingItemId,
    activeId,
    allSelected,
    canScrollLeft,
    canScrollRight,
    categoryFilter,
    categoryItemsMap,
    categoryMenuDropdownRef,
    categoryMenuPosition,
    categoryMenuRef,
    categoryOptions,
    categoryRenameTarget,
    categoryRenameValue,
    dragSelectItem,
    dragMovingItemSet,
    dropPosition,
    dropTargetId,
    fallbackItem,
    forPrint = false,
    groupedVisibleItems,
    getCellSelectionClassName,
    handleActivateCell,
    handleActivateItem,
    handleAddItem,
    handleAddMainCategory,
    handleApplyStandardToRow,
    handleCancelCategoryRename,
    handleCellKeyDown,
    handleCellPaste,
    handleCellSelectionEnter,
    handleCellSelectionStart,
    handleCategoryRunRateChange,
    handleCategoryTotalDaysChange,
    handleChange,
    handleCommitCategoryRename,
    handleDeleteCategory,
    handleDeleteItem,
    handleDeleteSelectedItems,
    handleDragCancel,
    handleDragEnd,
    handleDragOver,
    handleDragStart,
    handleMoveCategory,
    handleOpenEvidence,
    handleOpenFloorBatchModal,
    handleOpenImport,
    handleOpenRowClassEdit,
    handleScroll,
    handleStartCategoryRename,
    handleTableBlurCapture,
    hasHorizontalOverflow,
    hasSearchKeyword,
    isCellSelected,
    isDropInvalid,
    isFilterActive,
    isScrolling,
    newMainCategory,
    onClearSearch,
    onDismissHorizontalHint,
    onNewMainCategoryChange,
    onSearchKeywordChange,
    openCategoryMenu,
    operatingRates,
    searchKeyword,
    selectedCount,
    selectedItemIds,
    selectAllRef,
    sensors,
    setCategoryFilter,
    setCategoryRenameValue,
    setIsTableFocusInside,
    setIsTablePointerInside,
    setOpenCategoryMenu,
    showHorizontalHint,
    showAllColumns,
    standardItems,
    startSelectionDrag,
    tableHeaderHeight,
    tableHeaderRef,
    tableToolbarHeight,
    tableToolbarRef,
    tableInteractionRef,
    tableScrollRef,
    toggleColumnVisibility,
    toggleSelectAllItems,
    toggleSelectItem,
    totalItemCount,
    visibleColumnKeys,
    visibleColumnKeySet,
    visibleItemIds,
    visibleItems,
}) {
    const visibleColumns = SCHEDULE_MASTER_TABLE_COLUMNS.filter(
        (column) => column.alwaysVisible || visibleColumnKeySet?.has(column.key)
    );

    return (
        <div
            className="relative h-full w-full"
            ref={forPrint ? undefined : tableInteractionRef}
            onMouseEnter={forPrint ? undefined : () => setIsTablePointerInside(true)}
            onMouseLeave={forPrint ? undefined : () => setIsTablePointerInside(false)}
            onFocusCapture={forPrint ? undefined : () => setIsTableFocusInside(true)}
            onBlurCapture={forPrint ? undefined : handleTableBlurCapture}
        >
            <div
                className={`scroll-container w-full overflow-auto rounded-xl border border-[var(--navy-border-soft)] shadow-xl bg-[var(--navy-surface)] relative ${isScrolling ? "scrolling" : ""} ${forPrint ? "print-table" : ""}`}
                style={{ height: "100%" }}
                ref={forPrint ? undefined : tableScrollRef}
                onScroll={forPrint ? undefined : handleScroll}
            >
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragCancel={handleDragCancel}
                    onDragEnd={handleDragEnd}
                >
                    <table className="w-full text-m box-border table-fixed border-collapse bg-[var(--navy-surface)] rounded-lg text-[var(--navy-text)]">
                        <colgroup>
                            {visibleColumns.map((column) => (
                                <col key={column.key} width={column.width} />
                            ))}
                        </colgroup>
                        <thead ref={tableHeaderRef} className="bg-[var(--navy-surface-3)] text-[var(--navy-text)]">
                            <tr className="bg-[var(--navy-surface)] text-[var(--navy-text-muted)] font-medium sticky top-0 z-[2] shadow-sm border-b border-[var(--navy-border-soft)]">
                                {visibleColumns.map((column) => {
                                    const className = column.sticky === "select"
                                        ? "sticky top-0 left-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-1 z-30"
                                        : column.sticky === "drag"
                                            ? "sticky top-0 left-[40px] bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-1 z-30"
                                            : `${column.accent ? "bg-[var(--navy-surface-3)] text-[var(--navy-text)] font-bold" : "bg-[var(--navy-surface)]"} sticky top-0 border-r border-[var(--navy-border-soft)] px-2 py-2 z-10`;

                                    if (column.key === "select") {
                                        return (
                                            <th key={column.key} className={className}>
                                                <input
                                                    ref={selectAllRef}
                                                    type="checkbox"
                                                    checked={allSelected}
                                                    onChange={(e) => toggleSelectAllItems(e.target.checked)}
                                                    className="h-3.5 w-3.5 accent-[var(--navy-accent)] cursor-pointer"
                                                    aria-label="전체 선택"
                                                />
                                            </th>
                                        );
                                    }

                                    if (column.key === "drag" || column.key === "action") {
                                        return <th key={column.key} className={className}></th>;
                                    }

                                    return (
                                        <th key={column.key} className={className}>
                                            {column.label}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <SortableContext items={visibleItemIds} strategy={verticalListSortingStrategy}>
                            <tbody className="divide-y divide-gray-700">
                                {[
                                    (
                                        <ScheduleMasterTableToolbarRow
                                            key="add-main-category"
                                            forPrint={forPrint}
                                            tableHeaderHeight={tableHeaderHeight}
                                            tableToolbarRef={tableToolbarRef}
                                            visibleColumnKeys={visibleColumnKeys}
                                            onToggleColumnVisibility={toggleColumnVisibility}
                                            onShowAllColumns={showAllColumns}
                                            newMainCategory={newMainCategory}
                                            onNewMainCategoryChange={onNewMainCategoryChange}
                                            onAddMainCategory={handleAddMainCategory}
                                            searchKeyword={searchKeyword}
                                            onSearchKeywordChange={onSearchKeywordChange}
                                            onClearSearch={onClearSearch}
                                            categoryFilter={categoryFilter}
                                            onCategoryFilterChange={setCategoryFilter}
                                            categoryOptions={categoryOptions}
                                            isFilterActive={isFilterActive}
                                            hasSearchKeyword={hasSearchKeyword}
                                            visibleItemCount={visibleItems.length}
                                            totalItemCount={totalItemCount}
                                            selectedCount={selectedCount}
                                            onDeleteSelectedItems={handleDeleteSelectedItems}
                                        />
                                    ),
                                    ...Object.entries(groupedVisibleItems).map(([category, categoryItems], categoryIndex, categoryEntries) => (
                                        <ScheduleCategorySection
                                            key={category}
                                            forPrint={forPrint}
                                            category={category}
                                            categoryItems={categoryItems}
                                            allCategoryItems={categoryItemsMap.get(category) || categoryItems}
                                            categoryIndex={categoryIndex}
                                            categoryEntriesLength={categoryEntries.length}
                                            categoryRenameTarget={categoryRenameTarget}
                                            categoryRenameValue={categoryRenameValue}
                                            setCategoryRenameValue={setCategoryRenameValue}
                                            handleCommitCategoryRename={handleCommitCategoryRename}
                                            handleCancelCategoryRename={handleCancelCategoryRename}
                                            handleStartCategoryRename={handleStartCategoryRename}
                                            isFilterActive={isFilterActive}
                                            hasSearchKeyword={hasSearchKeyword}
                                            operatingRates={operatingRates}
                                            handleCategoryRunRateChange={handleCategoryRunRateChange}
                                            handleCategoryTotalDaysChange={handleCategoryTotalDaysChange}
                                            openCategoryMenu={openCategoryMenu}
                                            setOpenCategoryMenu={setOpenCategoryMenu}
                                            categoryMenuRef={categoryMenuRef}
                                            categoryMenuPosition={categoryMenuPosition}
                                            categoryMenuDropdownRef={categoryMenuDropdownRef}
                                            handleMoveCategory={handleMoveCategory}
                                            activeEditingItem={activeEditingItem}
                                            fallbackItem={fallbackItem}
                                            handleAddItem={handleAddItem}
                                            handleOpenImport={handleOpenImport}
                                            handleOpenEvidence={handleOpenEvidence}
                                            handleOpenFloorBatchModal={handleOpenFloorBatchModal}
                                            handleDeleteCategory={handleDeleteCategory}
                                            selectedItemIds={selectedItemIds}
                                            toggleSelectItem={toggleSelectItem}
                                            startSelectionDrag={startSelectionDrag}
                                            dragSelectItem={dragSelectItem}
                                            handleChange={handleChange}
                                            handleDeleteItem={handleDeleteItem}
                                            handleOpenRowClassEdit={handleOpenRowClassEdit}
                                            handleActivateItem={handleActivateItem}
                                            activeCell={activeCell}
                                            cellSelectionRange={cellSelectionRange}
                                            handleActivateCell={handleActivateCell}
                                            handleCellKeyDown={handleCellKeyDown}
                                            handleCellPaste={handleCellPaste}
                                            handleCellSelectionEnter={handleCellSelectionEnter}
                                            handleCellSelectionStart={handleCellSelectionStart}
                                            getCellSelectionClassName={getCellSelectionClassName}
                                            isCellSelected={isCellSelected}
                                            standardItems={standardItems}
                                            handleApplyStandardToRow={handleApplyStandardToRow}
                                            activeId={activeId}
                                            dragMovingItemSet={dragMovingItemSet}
                                            dropTargetId={dropTargetId}
                                            dropPosition={dropPosition}
                                            isDropInvalid={isDropInvalid}
                                            activeEditingItemId={activeEditingItemId}
                                            stickyTopOffset={tableHeaderHeight + tableToolbarHeight}
                                            visibleColumnKeySet={visibleColumnKeySet}
                                            columnSpan={visibleColumns.length}
                                        />
                                    )),
                                    ...(Object.keys(groupedVisibleItems).length === 0
                                        ? [(
                                            <tr key="empty-filter-result">
                                                <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-sm text-[var(--navy-text-muted)]">
                                                    검색/필터 조건에 맞는 항목이 없습니다.
                                                </td>
                                            </tr>
                                        )]
                                        : [])
                                ]}
                            </tbody>
                        </SortableContext>
                    </table>
                </DndContext>
            </div>

            {!forPrint && hasHorizontalOverflow && canScrollLeft && (
                <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center">
                    <div className="h-full w-12 bg-gradient-to-r from-[var(--navy-bg)] to-transparent" />
                    <div className="absolute left-2 rounded-full border border-[var(--navy-border)] bg-[rgb(30_30_47/0.9)] p-1 text-[var(--navy-text)]">
                        <ChevronLeft size={14} />
                    </div>
                </div>
            )}
            {!forPrint && hasHorizontalOverflow && canScrollRight && (
                <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center justify-end">
                    <div className="h-full w-12 bg-gradient-to-l from-[var(--navy-bg)] to-transparent" />
                    <div className="absolute right-2 rounded-full border border-[var(--navy-border)] bg-[rgb(30_30_47/0.9)] p-1 text-[var(--navy-text)]">
                        <ChevronRight size={14} />
                    </div>
                </div>
            )}
            {!forPrint && showHorizontalHint && hasHorizontalOverflow && (
                <div className="ui-hint absolute right-3 top-3 z-30 flex items-center gap-2">
                    <span>좌우 이동: Shift + 휠 또는 하단 스크롤바 사용, 좌측 2열은 고정됩니다.</span>
                    <button
                        type="button"
                        className="rounded p-0.5 text-[var(--navy-text)] hover:bg-[rgb(75_85_99/0.25)]"
                        onClick={onDismissHorizontalHint}
                        aria-label="가로 스크롤 힌트 닫기"
                    >
                        <X size={12} />
                    </button>
                </div>
            )}
        </div>
    );
}
