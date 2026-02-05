import React from "react";
import { Undo2, Redo2, History } from "lucide-react";
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
    aiTargetDays,
    onAiTargetDaysChange,
    onAiRun,
    aiMode,
    onAiCancel,
    onExportExcel
}) {
    return (
        <div className="flex justify-between items-end mb-4 flex-shrink-0">
            <div>
                <h1 className="text-2xl font-bold text-gray-100 mb-1 tracking-tight">공사기간 산정 기준</h1>
                <div className="flex items-center gap-4">
                    <p className="text-sm text-gray-400">Drag & Drop 지원, 자동 셀 병합</p>
                    <div className="flex gap-1 bg-[#2c2c3a] p-1 rounded-lg border border-gray-700">
                        <button
                            className={`px-3 py-1 text-xs font-semibold rounded transition-all ${viewMode === "table"
                                ? "bg-[#3a3a4a] text-white shadow-sm"
                                : "text-gray-400 hover:text-white"
                                }`}
                            onClick={() => onViewModeChange("table")}
                        >
                            테이블 뷰
                        </button>
                        <button
                            className={`px-3 py-1 text-xs font-semibold rounded transition-all ${viewMode === "gantt"
                                ? "bg-[#3a3a4a] text-white shadow-sm"
                                : "text-gray-400 hover:text-white"
                                }`}
                            onClick={() => onViewModeChange("gantt")}
                        >
                            간트차트
                        </button>
                    </div>
                </div>
            </div>

            {/* 아래의 기능 헤더는 항상 오른쪽에 위치해서 어떤 페이지 크기여도 전체가 보여야함 */}
            <div className="flex gap-3 items-center bg-[#2c2c3a] px-4 py-2 rounded-xl border border-gray-700 shadow-sm flex-wrap">
                <div className="flex items-center gap-1 mr-2 border-r border-gray-700 pr-3">
                    <button
                        className={`p-1.5 rounded hover:bg-[#3a3a4d] transition-colors ${!canUndo ? 'opacity-30 cursor-not-allowed' : 'text-gray-200'}`}
                        onClick={onUndo}
                        disabled={!canUndo}
                        title="실행 취소 (Ctrl+Z)"
                    >
                        <Undo2 size={16} />
                    </button>
                    <button
                        className={`p-1.5 rounded hover:bg-[#3a3a4d] transition-colors ${!canRedo ? 'opacity-30 cursor-not-allowed' : 'text-gray-200'}`}
                        onClick={onRedo}
                        disabled={!canRedo}
                        title="다시 실행 (Ctrl+Shift+Z)"
                    >
                        <Redo2 size={16} />
                    </button>
                </div>

                <button
                    className="p-1.5 rounded hover:bg-[#3a3a4d] text-gray-200 mr-2 transition-colors relative group"
                    onClick={onSnapshotOpen}
                    title="스냅샷 / 히스토리"
                >
                    <History size={18} />
                </button>

                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Start Date</label>
                    <input
                        type="date"
                        className="bg-[#181825] text-gray-100 font-bold text-sm py-1.5 pl-3 pr-2 rounded-lg border border-gray-700 focus:border-blue-500 w-36 uppercase"
                        value={startDate}
                        onChange={(e) => onStartDateChange(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">목표 공기</label>
                    <input
                        type="number"
                        min="1"
                        placeholder={`${totalCalendarDays}`}
                        value={aiTargetDays}
                        onChange={(e) => onAiTargetDaysChange(e.target.value)}
                        className="w-24 bg-[#181825] text-gray-100 font-bold text-sm py-1.5 px-3 rounded-lg border border-gray-700 focus:border-blue-500"
                    />
                    <span className="text-xs text-gray-500">일</span>
                </div>

                <button
                    onClick={onAiRun}
                    disabled={aiMode === "running"}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${aiMode === "running"
                        ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-500 text-white"
                        }`}
                >
                    AI로 조정
                </button>
                {aiMode !== "idle" && (
                    <button
                        onClick={onAiCancel}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-600 text-gray-200 hover:bg-[#3a3a4a] transition"
                    >
                        취소/되돌리기
                    </button>
                )}
                <button
                    onClick={onExportExcel}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-600 text-gray-200 hover:bg-[#3a3a4a] transition"
                >
                    엑셀 내보내기
                </button>
                <SaveButton onSave={onSave} saving={saving} />
                <div className="ml-2 px-4 py-2 rounded-xl bg-[#181825] border border-gray-700 text-sm text-gray-300">
                    <span className="text-gray-400 mr-2">전체 기간</span>
                    <span className="text-blue-400 font-bold text-base">{totalCalendarDays}일</span>
                    <span className="text-gray-500 ml-2">({totalCalendarMonths}개월)</span>
                </div>
            </div>
        </div>
    );
}
