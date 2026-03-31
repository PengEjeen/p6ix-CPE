import React, { useMemo, useState } from "react";

const STATUS_STYLES = {
    pending: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    applied: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    rejected: "border-slate-500/40 bg-slate-500/10 text-slate-300"
};

const STATUS_LABELS = {
    pending: "대기",
    applied: "적용됨",
    rejected: "거절됨"
};

export default function AiSuggestionPanel({
    aiMode,
    aiThreadMessages,
    aiProposalCards,
    pendingProposalCount,
    aiTargetDays,
    onSubmitRequest,
    onApplyProposal,
    onRejectProposal,
    onApplyAll,
    onReset,
    onToggleCompare,
    aiShowCompare
}) {
    const [draft, setDraft] = useState("");
    const pendingCards = useMemo(
        () => aiProposalCards.filter((proposal) => proposal.status === "pending"),
        [aiProposalCards]
    );

    const handleSubmit = async (event) => {
        event.preventDefault();
        const text = draft.trim();
        if (!text) return;
        await onSubmitRequest(text);
        setDraft("");
    };

    return (
        <aside className="w-[360px] min-w-[320px] max-w-[380px] flex flex-col ui-panel overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--navy-border)] bg-[var(--navy-surface-3)]">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="text-sm font-semibold text-[var(--navy-text)]">AI 수정 제안기</div>
                        <div className="text-[11px] text-[var(--navy-text-muted)]">
                            채팅으로 요청하고, 카드별로 사용 여부를 결정합니다.
                        </div>
                    </div>
                    <span className="text-[10px] text-[var(--navy-text-muted)] uppercase">{aiMode}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-md border border-[var(--navy-border)] px-2 py-1 text-[var(--navy-text-muted)]">
                        목표 공기 {aiTargetDays || "-"}일
                    </span>
                    <span className="rounded-md border border-[var(--navy-border)] px-2 py-1 text-[var(--navy-text-muted)]">
                        대기 제안 {pendingProposalCount}건
                    </span>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
                <section className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--navy-text-muted)]">
                        대화
                    </div>
                    {aiThreadMessages.length === 0 && (
                        <div className="rounded-lg border border-dashed border-[var(--navy-border)] px-3 py-3 text-xs text-[var(--navy-text-muted)]">
                            예: `이 구간 목표 공기를 10일 줄이고 싶어. 무리한 인력 증원은 피해서 제안해줘.`
                        </div>
                    )}
                    {aiThreadMessages.map((message) => (
                        <div
                            key={message.id}
                            className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${
                                message.role === "user"
                                    ? "ml-6 bg-[var(--navy-accent)]/15 text-[var(--navy-text)] border border-[var(--navy-accent)]/30"
                                    : "mr-6 bg-[var(--navy-surface-3)] text-[var(--navy-text)] border border-[var(--navy-border)]"
                            }`}
                        >
                            <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--navy-text-muted)]">
                                {message.role === "user" ? "사용자" : "AI"}
                            </div>
                            <div>{message.text}</div>
                        </div>
                    ))}
                </section>

                <section className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--navy-text-muted)]">
                            제안 카드
                        </div>
                        <button
                            type="button"
                            onClick={onToggleCompare}
                            className="text-[11px] text-[var(--navy-text-muted)] underline-offset-2 hover:underline"
                        >
                            {aiShowCompare ? "비교 숨기기" : "비교 보기"}
                        </button>
                    </div>
                    {aiProposalCards.length === 0 && (
                        <div className="rounded-lg border border-dashed border-[var(--navy-border)] px-3 py-3 text-xs text-[var(--navy-text-muted)]">
                            아직 생성된 제안이 없습니다.
                        </div>
                    )}
                    {aiShowCompare && pendingCards.length > 0 && (
                        <div className="rounded-xl border border-[var(--navy-border)] bg-[var(--navy-surface-3)] px-3 py-3 text-xs text-[var(--navy-text-muted)] space-y-1">
                            {pendingCards.map((proposal) => (
                                <div key={`compare-${proposal.id}`}>
                                    <span className="font-semibold text-[var(--navy-text)]">{proposal.label}</span>
                                    <span className="ml-2">{proposal.changes.map((change) => `${change.label} ${change.beforeText} → ${change.afterText}`).join(" / ")}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {aiProposalCards.map((proposal) => (
                        <article
                            key={proposal.id}
                            className="rounded-xl border border-[var(--navy-border)] bg-[var(--navy-surface)] p-3 shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold text-[var(--navy-text)]">{proposal.label}</div>
                                    <div className="mt-1 text-[11px] text-[var(--navy-text-muted)]">{proposal.impactSummary}</div>
                                </div>
                                <span className={`rounded-md border px-2 py-1 text-[10px] ${STATUS_STYLES[proposal.status] || STATUS_STYLES.pending}`}>
                                    {STATUS_LABELS[proposal.status] || proposal.status}
                                </span>
                            </div>

                            <div className="mt-3 space-y-2">
                                {proposal.changes.map((change) => (
                                    <div
                                        key={`${proposal.id}-${change.field}`}
                                        className="rounded-lg border border-[var(--navy-border-soft)] bg-[var(--navy-surface-3)] px-3 py-2"
                                    >
                                        <div className="text-[11px] font-semibold text-[var(--navy-text-muted)]">{change.label}</div>
                                        <div className="mt-1 text-xs text-[var(--navy-text)]">
                                            <span className="text-[var(--navy-text-muted)]">Before</span>
                                            <span className="mx-2">{change.beforeText}</span>
                                            <span className="text-[var(--navy-text-muted)]">→</span>
                                            <span className="mx-2 font-semibold text-[var(--navy-accent)]">{change.afterText}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-3 text-xs text-[var(--navy-text-muted)]">
                                {proposal.reason}
                            </div>

                            {proposal.status === "pending" && (
                                <div className="mt-3 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onApplyProposal(proposal)}
                                        className="flex-1 ui-btn-primary py-2"
                                    >
                                        사용
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onRejectProposal(proposal)}
                                        className="flex-1 ui-btn-secondary py-2"
                                    >
                                        거절
                                    </button>
                                </div>
                            )}
                        </article>
                    ))}
                </section>
            </div>

            <div className="border-t border-[var(--navy-border)] px-4 py-3 space-y-3">
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onApplyAll}
                        disabled={pendingCards.length === 0}
                        className="flex-1 ui-btn-primary py-2 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        전체 적용
                    </button>
                    <button
                        type="button"
                        onClick={onReset}
                        className="flex-1 ui-btn-secondary py-2"
                    >
                        세션 초기화
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-2">
                    <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        rows={4}
                        placeholder="수정 요청을 입력하세요."
                        className="ui-input min-h-[96px] w-full resize-none px-3 py-2"
                    />
                    <button
                        type="submit"
                        disabled={aiMode === "running" || !draft.trim()}
                        className="w-full ui-btn-primary py-2 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {aiMode === "running" ? "제안 생성 중..." : "제안 요청"}
                    </button>
                </form>
            </div>
        </aside>
    );
}
