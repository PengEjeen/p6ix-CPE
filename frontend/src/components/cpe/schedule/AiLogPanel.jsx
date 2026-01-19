import React, { useMemo } from "react";

export default function AiLogPanel({
    aiMode,
    aiLogs,
    aiSummary,
    aiPreviewItems,
    aiOriginalItems,
    aiShowCompare,
    onToggleCompare,
    onApply
}) {
    const compareRows = useMemo(() => {
        if (!aiPreviewItems || !aiOriginalItems) return [];
        return aiPreviewItems
            .map((preview) => {
                const original = aiOriginalItems.find((i) => i.id === preview.id);
                if (!original) return null;
                const crewDiff = (parseFloat(preview.crew_size) || 0) - (parseFloat(original.crew_size) || 0);
                const prodDiff = (parseFloat(preview.productivity) || 0) - (parseFloat(original.productivity) || 0);
                if (Math.abs(crewDiff) < 0.01 && Math.abs(prodDiff) < 0.01) return null;
                return {
                    id: preview.id,
                    label: `${preview.process} ${preview.work_type}`,
                    crewDiff,
                    prodDiff
                };
            })
            .filter(Boolean);
    }, [aiPreviewItems, aiOriginalItems]);

    return (
        <div className="w-80 min-w-[280px] max-w-[360px] flex flex-col rounded-xl border border-gray-700 bg-[#2c2c3a] shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700 bg-[#3a3a4a] flex items-center justify-between">
                <div className="text-sm font-semibold text-white">AI 조정 로그</div>
                <span className="text-[10px] text-gray-400">{aiMode.toUpperCase()}</span>
            </div>
            <div className="px-4 py-3 text-xs text-gray-300 border-b border-gray-700">
                {aiMode === "running" && "목표 공기 달성을 위한 조정안을 계산 중입니다…"}
                {aiMode === "success" && "목표 공기 달성"}
                {aiMode === "fail" && "목표 달성이 어려워 추가 조정이 필요합니다."}
                {aiMode === "cancelled" && "작업이 취소되었습니다."}
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-xs text-gray-300">
                {aiLogs.length === 0 && <div className="text-gray-500">조정 로그가 없습니다.</div>}
                {aiLogs.map((log) => (
                    <div
                        key={log.id}
                        className={
                            log.kind === "status"
                                ? "text-gray-400"
                                : log.kind === "reason"
                                    ? "text-gray-400 italic"
                                    : log.kind === "summary"
                                        ? "text-blue-300"
                                        : ""
                        }
                    >
                        {log.message}
                    </div>
                ))}
            </div>
            <div className="border-t border-gray-700 px-4 py-3 text-xs text-gray-300 space-y-2">
                <div>
                    <span className="text-gray-400 mr-1">현재 누적 단축</span>
                    <span className="text-blue-400 font-semibold">-{aiSummary.savedDays.toFixed(1)}일</span>
                </div>
                <div>
                    <span className="text-gray-400 mr-1">남은 목표</span>
                    <span className="text-gray-200 font-semibold">{aiSummary.remainingDays.toFixed(1)}일</span>
                </div>
                <div className="flex gap-2 pt-2">
                    <button
                        onClick={onApply}
                        disabled={!aiPreviewItems}
                        className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:bg-gray-700 disabled:text-gray-400"
                    >
                        AI 조정안 적용
                    </button>
                    <button
                        onClick={onToggleCompare}
                        className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold border border-gray-600 text-gray-200 hover:bg-[#3a3a4a]"
                    >
                        Compare
                    </button>
                </div>
                {aiShowCompare && compareRows.length > 0 && (
                    <div className="mt-3 max-h-40 overflow-y-auto text-[11px] text-gray-400 space-y-1">
                        {compareRows.map((row) => (
                            <div key={row.id}>
                                {row.label} · 인원 {row.crewDiff > 0 ? `+${row.crewDiff}` : row.crewDiff.toFixed(1)}, 생산성 {row.prodDiff > 0 ? `+${row.prodDiff.toFixed(2)}` : row.prodDiff.toFixed(2)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
