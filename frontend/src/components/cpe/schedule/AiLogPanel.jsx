import React, { useMemo, useState, useCallback } from "react";

export default function AiLogPanel({
    aiMode,
    aiLogs,
    aiPreviewItems,
    aiOriginalItems,
    aiShowCompare,
    onToggleCompare,
    onApply
}) {
    const changeLogs = useMemo(
        () => aiLogs.filter((log) => log.kind === "step"),
        [aiLogs]
    );
    const resultStatusLabel = useMemo(() => {
        if (aiMode === "success") return "성공";
        if (aiMode === "fail") return "실패";
        if (aiMode === "cancelled") return "취소";
        if (aiMode === "running") return "진행 중";
        return "대기";
    }, [aiMode]);
    const latestSummaryText = useMemo(() => {
        for (let i = aiLogs.length - 1; i >= 0; i -= 1) {
            const log = aiLogs[i];
            if (log.kind === "summary" || log.kind === "result") {
                return log.message;
            }
        }
        return "요약 정보가 없습니다.";
    }, [aiLogs]);

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

    const [isLogScrolling, setIsLogScrolling] = useState(false);
    const [isCompareScrolling, setIsCompareScrolling] = useState(false);

    const handleLogScroll = useCallback(() => {
        setIsLogScrolling(true);
        clearTimeout(window.aiLogScrollTimeout);
        window.aiLogScrollTimeout = setTimeout(() => {
            setIsLogScrolling(false);
        }, 1000);
    }, []);

    const handleCompareScroll = useCallback(() => {
        setIsCompareScrolling(true);
        clearTimeout(window.aiCompareScrollTimeout);
        window.aiCompareScrollTimeout = setTimeout(() => {
            setIsCompareScrolling(false);
        }, 1000);
    }, []);

    return (
        <div className="w-80 min-w-[280px] max-w-[360px] flex flex-col ui-panel overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--navy-border)] bg-[var(--navy-surface-3)] flex items-center justify-between">
                <div className="text-sm font-semibold text-[var(--navy-text)]">AI 조정 로그</div>
                <span className="text-[10px] text-[var(--navy-text-muted)]">{aiMode.toUpperCase()}</span>
            </div>
            <div className="px-4 py-3 text-xs text-[var(--navy-text)] border-b border-[var(--navy-border)]">
                {aiMode === "running" && "목표 공기 달성을 위한 조정안을 계산 중입니다…"}
                {aiMode === "success" && "목표 공기 달성"}
                {aiMode === "fail" && "목표 달성이 어려워 추가 조정이 필요합니다."}
                {aiMode === "cancelled" && "작업이 취소되었습니다."}
            </div>
            <div
                className={`scroll-container flex-1 overflow-y-auto px-4 py-3 space-y-2 text-xs text-[var(--navy-text)] ${isLogScrolling ? 'scrolling' : ''}`}
                onScroll={handleLogScroll}
            >
                <div className="text-[11px] font-semibold text-[var(--navy-text-muted)] uppercase tracking-wide">변경 이력</div>
                {changeLogs.length === 0 && <div className="text-[var(--navy-text-muted)]">변경된 항목이 없습니다.</div>}
                {changeLogs.map((log) => (
                    <div
                        key={log.id}
                        className="ui-accent-text"
                    >
                        {log.message}
                    </div>
                ))}
            </div>
            <div className="border-t border-[var(--navy-border)] px-4 py-3 text-xs text-[var(--navy-text)] space-y-2">
                <div>
                    <span className="text-[var(--navy-text-muted)] mr-1">성공 여부</span>
                    <span className={`font-semibold ${aiMode === "success" ? "ui-status-success" : aiMode === "fail" ? "ui-status-danger" : "ui-status-muted"}`}>
                        {resultStatusLabel}
                    </span>
                </div>
                <div>
                    <span className="text-[var(--navy-text-muted)] mr-1">요약</span>
                    <span className="text-[var(--navy-text)]">{latestSummaryText}</span>
                </div>
                <div className="flex gap-2 pt-2">
                    <button
                        onClick={onApply}
                        disabled={!aiPreviewItems}
                        className="flex-1 ui-btn-primary py-2"
                    >
                        AI 조정안 적용
                    </button>
                    <button
                        onClick={onToggleCompare}
                        className="flex-1 ui-btn-secondary py-2"
                    >
                        Compare
                    </button>
                </div>
                {aiShowCompare && compareRows.length > 0 && (
                    <div
                        className={`scroll-container mt-3 max-h-40 overflow-y-auto text-[11px] text-[var(--navy-text-muted)] space-y-1 ${isCompareScrolling ? 'scrolling' : ''}`}
                        onScroll={handleCompareScroll}
                    >
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
