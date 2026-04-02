import React, { useMemo } from "react";
import ScheduleMasterTablePanel from "./ScheduleMasterTablePanel";
import useScheduleMasterTableFeature from "./useScheduleMasterTableFeature";
import { getVisibleOperatingRateOptions } from "../../../utils/operatingRateKeys";

export default function ScheduleMasterTablePage(props) {
    const feature = useScheduleMasterTableFeature(props);
    const selectableOperatingRates = useMemo(
        () => getVisibleOperatingRateOptions(props.operatingRates, props.items),
        [props.operatingRates, props.items]
    );

    return (
        <ScheduleMasterTablePanel
            activeCell={feature.activeCell}
            cellSelectionRange={feature.cellSelectionRange}
            activeEditingItem={feature.activeEditingItem}
            activeEditingItemId={feature.activeEditingItemId}
            activeId={feature.activeId}
            allSelected={feature.allSelected}
            canScrollLeft={feature.canScrollLeft}
            canScrollRight={feature.canScrollRight}
            categoryFilter={feature.categoryFilter}
            categoryItemsMap={feature.categoryItemsMap}
            categoryMenuDropdownRef={feature.categoryMenuDropdownRef}
            categoryMenuPosition={feature.categoryMenuPosition}
            categoryMenuRef={feature.categoryMenuRef}
            categoryOptions={feature.categoryOptions}
            categoryRenameTarget={feature.categoryRenameTarget}
            categoryRenameValue={feature.categoryRenameValue}
            dragMovingItemSet={feature.dragMovingItemSet}
            dragSelectItem={feature.dragSelectItem}
            dropPosition={feature.dropPosition}
            dropTargetId={feature.dropTargetId}
            fallbackItem={props.items[0]}
            groupedVisibleItems={feature.groupedVisibleItems}
            handleActivateCell={feature.handleActivateCell}
            handleActivateItem={feature.handleActivateItem}
            handleAddItem={feature.handleAddItem}
            handleAddMainCategory={feature.handleAddMainCategory}
            handleApplyStandardToRow={feature.handleApplyStandardToRow}
            handleCancelCategoryRename={feature.handleCancelCategoryRename}
            handleCellKeyDown={feature.handleCellKeyDown}
            handleCellPaste={feature.handleCellPaste}
            handleCellSelectionEnter={feature.handleCellSelectionEnter}
            handleCellSelectionStart={feature.handleCellSelectionStart}
            handleCategoryRunRateChange={feature.handleCategoryRunRateChange}
            handleCategoryTotalDaysChange={feature.handleCategoryTotalDaysChange}
            handleChange={feature.handleChange}
            handleCommitCategoryRename={feature.handleCommitCategoryRename}
            handleDeleteCategory={feature.handleDeleteCategory}
            handleDeleteItem={feature.handleDeleteItem}
            handleDeleteSelectedItems={feature.handleDeleteSelectedItems}
            handleDragCancel={feature.handleDragCancel}
            handleDragEnd={feature.handleDragEnd}
            handleDragOver={feature.handleDragOver}
            handleDragStart={feature.handleDragStart}
            handleMoveCategory={feature.handleMoveCategory}
            handleOpenEvidence={feature.onOpenEvidence}
            handleOpenFloorBatchModal={feature.onOpenFloorBatchModal}
            handleOpenImport={feature.onOpenImport}
            handleOpenRowClassEdit={feature.onOpenRowClassEdit}
            handleScroll={feature.handleScroll}
            handleStartCategoryRename={feature.handleStartCategoryRename}
            handleTableBlurCapture={feature.handleTableBlurCapture}
            hasHorizontalOverflow={feature.hasHorizontalOverflow}
            hasSearchKeyword={feature.hasSearchKeyword}
            getCellSelectionClassName={feature.getCellSelectionClassName}
            isCellSelected={feature.isCellSelected}
            isDropInvalid={feature.isDropInvalid}
            isFilterActive={feature.isFilterActive}
            isScrolling={feature.isScrolling}
            newMainCategory={feature.newMainCategory}
            onClearSearch={() => feature.setSearchKeyword("")}
            onDismissHorizontalHint={feature.dismissHorizontalHint}
            onNewMainCategoryChange={feature.setNewMainCategory}
            onSearchKeywordChange={feature.setSearchKeyword}
            openCategoryMenu={feature.openCategoryMenu}
            operatingRates={props.operatingRates}
            selectableOperatingRates={selectableOperatingRates}
            searchKeyword={feature.searchKeyword}
            selectedCount={feature.selectedCount}
            selectedItemIds={feature.selectedItemIds}
            selectAllRef={feature.selectAllRef}
            sensors={feature.sensors}
            setCategoryFilter={feature.setCategoryFilter}
            setCategoryRenameValue={feature.setCategoryRenameValue}
            setIsTableFocusInside={feature.setIsTableFocusInside}
            setIsTablePointerInside={feature.setIsTablePointerInside}
            setOpenCategoryMenu={feature.setOpenCategoryMenu}
            showHorizontalHint={feature.showHorizontalHint}
            showAllColumns={feature.showAllColumns}
            standardItems={props.standardItems}
            startSelectionDrag={feature.startSelectionDrag}
            tableHeaderHeight={feature.tableHeaderHeight}
            tableHeaderRef={feature.tableHeaderRef}
            tableToolbarHeight={feature.tableToolbarHeight}
            tableToolbarRef={feature.tableToolbarRef}
            tableInteractionRef={feature.tableInteractionRef}
            tableScrollRef={feature.tableScrollRef}
            toggleColumnVisibility={feature.toggleColumnVisibility}
            toggleSelectAllItems={feature.toggleSelectAllItems}
            toggleSelectItem={feature.toggleSelectItem}
            totalItemCount={props.items.length}
            visibleColumnKeys={feature.visibleColumnKeys}
            visibleColumnKeySet={feature.visibleColumnKeySet}
            visibleItemIds={feature.visibleItemIds}
            visibleItems={feature.visibleItems}
        />
    );
}
