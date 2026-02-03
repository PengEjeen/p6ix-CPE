import React from "react";
import { Calendar } from "lucide-react";

const SCALE_OPTIONS = [1, 5, 10, 30];

export default function GanttToolbar({
    dateScale,
    onSetScale,
    linkMode,
    setLinkMode,
    linkDraft,
    subtaskMode,
    setSubtaskMode
}) {
    return (
        <div className="gantt-toolbar px-6 py-4 flex items-center justify-between bg-white border-b border-gray-100 z-[2]">
            <div className="flex items-center gap-4">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">공사 일정 (Construction Schedule)</h2>
                    <div className="text-xs text-slate-500 font-medium flex gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                                <Calendar size={14} className="text-gray-500" />
                                <span className="text-xs font-medium text-gray-600">Scale:</span>
                                {SCALE_OPTIONS.map(scale => (
                                    <button
                                        key={scale}
                                        onClick={() => onSetScale(scale)}
                                        className={`px-2 py-0.5 text-xs rounded transition-all ${dateScale === scale
                                            ? 'bg-violet-500 text-white font-bold'
                                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        {scale}d
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => setLinkMode((prev) => !prev)}
                                    className={`px-3 py-1 text-xs rounded-full transition-all font-semibold border ${linkMode
                                        ? 'bg-slate-900 text-amber-300 border-amber-400/60 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
                                        }`}
                                >
                                    링크 편집
                                </button>
                                {linkDraft && (
                                    <span className="text-[10px] text-amber-600 font-semibold tracking-wide">대상 선택</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => setSubtaskMode((prev) => !prev)}
                                    className={`px-3 py-1 text-xs rounded-full transition-all font-semibold border ${subtaskMode
                                        ? 'bg-slate-900 text-emerald-300 border-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
                                        }`}
                                >
                                    부공종 추가
                                </button>
                                {subtaskMode && (
                                    <span className="text-[10px] text-emerald-600 font-semibold tracking-wide">드래그해서 그리기</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 p-1 rounded-lg border border-gray-100">
                {SCALE_OPTIONS.map(scale => (
                    <button
                        key={scale}
                        onClick={() => onSetScale(scale)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${dateScale === scale
                            ? "bg-white text-blue-600 shadow-sm ring-1 ring-gray-100"
                            : "text-gray-500 hover:text-gray-900"
                            }`}
                    >
                        {scale === 1 ? '일별' : scale === 30 ? '월별' : `${scale}일 단위`}
                    </button>
                ))}
            </div>
        </div>
    );
}
