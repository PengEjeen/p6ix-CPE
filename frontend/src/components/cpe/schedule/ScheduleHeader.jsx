import React from "react";
import { Undo2, Redo2, History, Maximize2, Minimize2 } from "lucide-react";
import SaveButton from "../SaveButton";

export default function ScheduleHeader({
    viewMode,
    onViewModeChange,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onSnapshotOpen,
    startDate,
    onStartDateChange,
    workDayType,
    onWorkDayTypeChange,
    onSave,
    saving,
    totalCalendarDays,
    totalCalendarMonths,
    onExportExcel,
    showFullscreenToggle = false,
    isFullscreen = false,
    onToggleFullscreen
}) {
    return (
        <div className="flex justify-between items-end mb-4 flex-shrink-0">
            <div>
                <h1 className="text-2xl font-bold text-[var(--navy-text)] mb-1 tracking-tight">공사기간 산정 기준</h1>
                <div className="flex items-center gap-4">
                    <p className="text-sm text-[var(--navy-text-muted)]">같은 대공종 내 드래그 이동, 전체 셀 편집, Shift+드래그 다중선택, Ctrl/Cmd+Enter 일괄 적용</p>
                    <div className="ui-tab-group">
                        <button
                            className={`ui-tab ${viewMode === "table"
                                ? "ui-tab-active"
                                : ""
                                }`}
                            onClick={() => onViewModeChange("table")}
                        >
                            테이블 뷰
                        </button>
                        <button
                            className={`ui-tab ${viewMode === "gantt"
                                ? "ui-tab-active"
                                : ""
                                }`}
                            onClick={() => onViewModeChange("gantt")}
                        >
                            간트차트
                        </button>
                        <button
                            className={`ui-tab ${viewMode === "weight"
                                ? "ui-tab-active"
                                : ""
                                }`}
                            onClick={() => onViewModeChange("weight")}
                        >
                            보할표
                        </button>
                    </div>
                </div>
            </div>

            {/* 아래의 기능 헤더는 항상 오른쪽에 위치해서 어떤 페이지 크기여도 전체가 보여야함 */}
            <div className="ui-toolbar flex gap-3 items-center px-4 py-2 flex-wrap">
                <div className="flex items-center gap-1 mr-2 border-r border-[var(--navy-border)] pr-3">
                    <button
                        className={`ui-icon-btn ${!canUndo ? 'opacity-30 cursor-not-allowed' : ''}`}
                        onClick={onUndo}
                        disabled={!canUndo}
                        title="실행 취소 (Ctrl+Z)"
                    >
                        <Undo2 size={16} />
                    </button>
                    <button
                        className={`ui-icon-btn ${!canRedo ? 'opacity-30 cursor-not-allowed' : ''}`}
                        onClick={onRedo}
                        disabled={!canRedo}
                        title="다시 실행 (Ctrl+Shift+Z)"
                    >
                        <Redo2 size={16} />
                    </button>
                </div>

                <button
                    className="ui-icon-btn mr-2 relative group"
                    onClick={onSnapshotOpen}
                    title="스냅샷 / 히스토리"
                >
                    <History size={18} />
                </button>

                <div className="flex flex-col gap-1">
                    <label className="ui-label pl-1">시작일</label>
                    <input
                        type="date"
                        className="ui-input w-36 uppercase pl-3 pr-2"
                        value={startDate}
                        onChange={(e) => onStartDateChange(e.target.value)}
                    />
                </div>
                <button
                    onClick={onExportExcel}
                    className="ui-btn-secondary"
                >
                    엑셀 내보내기
                </button>
                {showFullscreenToggle && (
                    <button
                        type="button"
                        onClick={onToggleFullscreen}
                        className="ui-btn-secondary inline-flex items-center gap-1.5"
                        title={isFullscreen ? "전체화면 해제" : "전체화면"}
                    >
                        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        {isFullscreen ? "전체화면 해제" : "전체화면"}
                    </button>
                )}
                <SaveButton onSave={onSave} saving={saving} />
                <div className="ml-2 px-4 py-2 rounded-xl bg-[var(--navy-bg)] border border-[var(--navy-border)] text-sm text-[var(--navy-text)]">
                    <span className="text-[var(--navy-text-muted)] mr-2">전체 기간</span>
                    <span className="ui-accent-text font-bold text-base">{totalCalendarDays}일</span>
                    <span className="text-[var(--navy-text-muted)] ml-2">({totalCalendarMonths}개월)</span>
                </div>
            </div>
        </div>
    );
}
