import React from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import ScheduleMasterTableToolbarRow from "./ScheduleMasterTableToolbarRow";
import ScheduleCategorySection from "./ScheduleCategorySection";

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
    standardItems,
    startSelectionDrag,
    tableHeaderHeight,
    tableHeaderRef,
    tableToolbarHeight,
    tableToolbarRef,
    tableInteractionRef,
    tableScrollRef,
    toggleSelectAllItems,
    toggleSelectItem,
    totalItemCount,
    visibleItemIds,
    visibleItems,
}) {
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
                            <col width="40" />
                            <col width="36" />
                            <col width="180" />
                            <col width="180" />
                            <col width="260" />
                            <col width="130" />
                            <col width="70" />
                            <col width="90" />
                            <col width="90" />
                            <col width="72" />
                            <col width="90" />
                            <col width="72" />
                            <col width="86" />
                            <col width="86" />
                            <col width="90" />
                            <col width="80" />
                            <col width="150" />
                            <col width="280" />
                            <col width="64" />
                        </colgroup>
                        <thead ref={tableHeaderRef} className="bg-[var(--navy-surface-3)] text-[var(--navy-text)]">
                            <tr className="bg-[var(--navy-surface)] text-[var(--navy-text-muted)] font-medium sticky top-0 z-[2] shadow-sm border-b border-[var(--navy-border-soft)]">
                                <th className="sticky top-0 left-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-1 z-30">
                                    <input
                                        ref={selectAllRef}
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={(e) => toggleSelectAllItems(e.target.checked)}
                                        className="h-3.5 w-3.5 accent-[var(--navy-accent)] cursor-pointer"
                                        aria-label="전체 선택"
                                    />
                                </th>
                                <th className="sticky top-0 left-[40px] bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-1 z-30"></th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">중공종</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">공정</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">세부공종</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">수량산출(개산)</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">단위</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">내역수량</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">단위 작업량</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">투입조</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">생산량/일</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">CP</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">병행률(%)</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">반영률(%)</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">작업기간 W/D</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">가동률</th>
                                <th className="sticky top-0 bg-[var(--navy-surface-3)] border-r border-[var(--navy-border-soft)] px-2 py-2 text-[var(--navy-text)] font-bold z-10">Cal Day</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10">비고</th>
                                <th className="sticky top-0 bg-[var(--navy-surface)] border-r border-[var(--navy-border-soft)] px-2 py-2 z-10"></th>
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
                                        />
                                    )),
                                    ...(Object.keys(groupedVisibleItems).length === 0
                                        ? [(
                                            <tr key="empty-filter-result">
                                                <td colSpan="19" className="px-4 py-8 text-center text-sm text-[var(--navy-text-muted)]">
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
