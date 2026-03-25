import React from "react";
import { Search, Trash2, X } from "lucide-react";

export default function ScheduleMasterTableToolbarRow({
    forPrint,
    tableHeaderHeight,
    newMainCategory,
    onNewMainCategoryChange,
    onAddMainCategory,
    searchKeyword,
    onSearchKeywordChange,
    onClearSearch,
    categoryFilter,
    onCategoryFilterChange,
    categoryOptions,
    isFilterActive,
    hasSearchKeyword,
    visibleItemCount,
    totalItemCount,
    selectedCount,
    onDeleteSelectedItems
}) {
    return (
        <tr className={`bg-[var(--navy-bg)] ${forPrint ? "no-print" : ""}`}>
            <td
                colSpan="19"
                className={`px-4 py-3 ${forPrint ? "" : "sticky z-[6] bg-[var(--navy-bg)] border-b border-[var(--navy-border-soft)]"}`}
                style={forPrint ? undefined : { top: `${tableHeaderHeight}px` }}
            >
                <div className="sticky left-0 right-0 z-[7]">
                    <div className="flex w-full min-w-max items-center gap-2 rounded-lg border border-[var(--navy-border-soft)] bg-[var(--navy-surface)] px-2 py-1.5 shadow-sm">
                        <div className="sticky left-0 z-[8] -ml-2 flex items-center gap-2 border-r border-[var(--navy-border-soft)] bg-[var(--navy-surface)] pl-2 pr-2">
                            <span className="inline-flex items-center rounded-md border border-[var(--navy-border-soft)] bg-[var(--navy-surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--navy-text)]">
                                대공종 추가
                            </span>
                            <input
                                type="text"
                                value={newMainCategory}
                                onChange={(e) => onNewMainCategoryChange(e.target.value)}
                                placeholder="대공종명 입력"
                                className="ui-input h-8 w-44 px-2"
                            />
                            <button
                                type="button"
                                onClick={onAddMainCategory}
                                className="ui-btn-primary h-8 px-3"
                            >
                                추가
                            </button>
                        </div>

                        <div className="sticky left-[320px] z-[7] flex items-center gap-2 border-r border-[var(--navy-border-soft)] bg-[var(--navy-surface)] pr-2">
                            <div className="relative w-72 min-w-[220px] max-w-[420px]">
                                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--navy-text-muted)]" />
                                <input
                                    type="text"
                                    value={searchKeyword}
                                    onChange={(e) => onSearchKeywordChange(e.target.value)}
                                    placeholder="검색 (대공종/공정/세부공종/비고)"
                                    className="ui-input h-8 w-full pl-8 pr-8"
                                />
                                {searchKeyword && (
                                    <button
                                        type="button"
                                        onClick={onClearSearch}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--navy-text-muted)] hover:bg-[var(--navy-surface-3)]"
                                        aria-label="검색어 지우기"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>

                            <select
                                className="ui-input h-8 min-w-[140px] px-2"
                                value={categoryFilter}
                                onChange={(e) => onCategoryFilterChange(e.target.value)}
                            >
                                <option value="ALL">전체 대공종</option>
                                {categoryOptions.map((category) => (
                                    <option key={category} value={category}>{category}</option>
                                ))}
                            </select>
                        </div>

                        {isFilterActive && (
                            <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                                필터 적용 중
                            </span>
                        )}
                        {hasSearchKeyword && (
                            <span className="inline-flex max-w-[260px] items-center truncate rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200">
                                검색어: {searchKeyword}
                            </span>
                        )}

                        <div className="sticky right-0 z-[8] -mr-2 ml-auto flex items-center gap-2 border-l border-[var(--navy-border-soft)] bg-[var(--navy-surface)] pl-2 pr-2">
                            <span className="inline-flex items-center rounded-full border border-[var(--navy-border-soft)] bg-[var(--navy-surface-2)] px-2 py-1 text-[11px] text-[var(--navy-text-muted)]">
                                표시 행: {visibleItemCount} / 전체 {totalItemCount}
                            </span>
                            <button
                                type="button"
                                onClick={onDeleteSelectedItems}
                                disabled={selectedCount === 0}
                                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition ${selectedCount > 0
                                    ? "border-red-500/50 text-red-200 hover:bg-red-500/10"
                                    : "border-gray-700 text-gray-500 cursor-not-allowed"
                                    }`}
                            >
                                <Trash2 size={14} />
                                선택 삭제 {selectedCount > 0 ? `(${selectedCount})` : ""}
                            </button>
                        </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="inline-flex items-center rounded-full border border-blue-400/35 bg-blue-500/10 px-2 py-0.5 text-blue-200">
                            선택: 체크박스 단일 선택, Shift+드래그 다중 선택, Ctrl/Cmd+A 현재 표시 행 전체 선택
                        </span>
                        <span className="inline-flex items-center rounded-full border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                            삭제: 상단 버튼 또는 Delete 키
                        </span>
                        {selectedCount > 0 && (
                            <span className="inline-flex items-center rounded-full border border-red-400/35 bg-red-500/10 px-2 py-0.5 text-red-200">
                                현재 {selectedCount}개 선택됨
                            </span>
                        )}
                    </div>
                </div>
            </td>
        </tr>
    );
}
