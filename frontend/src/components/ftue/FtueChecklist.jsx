import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Circle,
    Lock,
    PlayCircle,
    Trophy,
} from "lucide-react";
import { FTUE_STEPS, FTUE_STEP_IDS } from "../../config/ftueSteps";
import { getFtueProgress, setFtueHidden } from "../../utils/ftue";

/**
 * FtueChecklist
 *
 * Props:
 *   ftueTotal     — loadFtue("TOTAL") 결과 state
 *   ftueApartment — loadFtue("APARTMENT") 결과 state
 *   projects      — 홈에서 내려주는 프로젝트 배열 (CTA용)
 *   onOpenCreate(type) — 생성 모달 오픈 콜백
 *   onOpenProject(project) — 프로젝트 진입 콜백
 *   compact       — 사이드바용 소형 모드 (다음 1단계만 강조, 완료시 배지)
 */
export default function FtueChecklist({
    ftueTotal,
    ftueApartment,
    projects,
    onOpenCreate,
    onOpenProject,
    compact = false,
}) {
    const [activeTab, setActiveTab] = useState("TOTAL");
    const [expandedCompleted, setExpandedCompleted] = useState({ TOTAL: false, APARTMENT: false });
    const [showAll, setShowAll] = useState(false); // compact 모드에서 전체 list 펼침

    const ftueState = activeTab === "TOTAL" ? ftueTotal : ftueApartment;
    const allStepIds = FTUE_STEP_IDS[activeTab];
    const stepDefs = FTUE_STEPS[activeTab];

    const totalHidden = Boolean(ftueTotal?.hidden);
    const apartmentHidden = Boolean(ftueApartment?.hidden);
    const isHidden = activeTab === "TOTAL" ? totalHidden : apartmentHidden;
    const bothHidden = totalHidden && apartmentHidden;

    const totalCompleted = Boolean(ftueTotal?.completedAt);
    const apartmentCompleted = Boolean(ftueApartment?.completedAt);
    const isCompleted = activeTab === "TOTAL" ? totalCompleted : apartmentCompleted;
    const bothCompleted = totalCompleted && apartmentCompleted;

    const progress = useMemo(
        () => getFtueProgress(ftueState, allStepIds),
        [ftueState, allStepIds]
    );

    useEffect(() => {
        if (activeTab === "TOTAL" && totalHidden && !apartmentHidden) setActiveTab("APARTMENT");
        else if (activeTab === "APARTMENT" && apartmentHidden && !totalHidden) setActiveTab("TOTAL");
    }, [totalHidden, apartmentHidden, activeTab]);

    // 최근 프로젝트 (CTA용)
    const sortedProjects = useMemo(() => {
        const arr = Array.isArray(projects) ? projects : [];
        return [...arr].sort((a, b) => {
            const aTime = a?.updated_at ? new Date(a.updated_at).getTime() : a?.created_at ? new Date(a.created_at).getTime() : 0;
            const bTime = b?.updated_at ? new Date(b.updated_at).getTime() : b?.created_at ? new Date(b.created_at).getTime() : 0;
            return bTime - aTime;
        });
    }, [projects]);

    const latestTotal = useMemo(() => sortedProjects.find((p) => p?.calc_type === "TOTAL") || null, [sortedProjects]);
    const latestApartment = useMemo(() => sortedProjects.find((p) => p?.calc_type === "APARTMENT") || null, [sortedProjects]);

    const steps = useMemo(() => {
        return stepDefs.map((def) => {
            const done = Boolean(ftueState?.steps?.[def.id]);
            let action = null;
            let actionLabel = def.actionLabel;
            if (activeTab === "TOTAL") {
                if (def.id === "create_project") { action = () => onOpenCreate("TOTAL"); }
                else if (def.id === "open_project") { action = latestTotal ? () => onOpenProject(latestTotal) : () => onOpenCreate("TOTAL"); actionLabel = latestTotal ? "이동" : "생성"; }
                else if (def.id === "export_report") { action = latestTotal ? () => onOpenProject(latestTotal) : () => onOpenCreate("TOTAL"); actionLabel = latestTotal ? "이동" : "생성"; }
            } else {
                if (def.id === "create_project") { action = () => onOpenCreate("APARTMENT"); }
                else if (def.id === "open_project") { action = latestApartment ? () => onOpenProject(latestApartment) : () => onOpenCreate("APARTMENT"); actionLabel = latestApartment ? "이동" : "생성"; }
            }
            return { ...def, done, action, actionLabel };
        });
    }, [stepDefs, ftueState, activeTab, latestTotal, latestApartment, onOpenCreate, onOpenProject]);

    const firstIncompleteIndex = steps.findIndex((s) => !s.done);
    const activeIndex = firstIncompleteIndex === -1 ? steps.length - 1 : firstIncompleteIndex;
    const nextStep = steps[firstIncompleteIndex === -1 ? steps.length - 1 : firstIncompleteIndex];

    const isExpanded = isCompleted ? expandedCompleted[activeTab] : true;
    const handleHide = () => setFtueHidden(activeTab, true);
    const handleUnhide = (type) => setFtueHidden(type, false);
    const handleUnhideAll = () => {
        if (totalHidden) setFtueHidden("TOTAL", false);
        if (apartmentHidden) setFtueHidden("APARTMENT", false);
    };

    // 둘 다 숨겨져 있으면 → 복원 버튼만 표시 (완전 null 금지)
    if (bothHidden) {
        return (
            <button
                type="button"
                onClick={handleUnhideAll}
                className="w-full flex items-center gap-2 rounded-xl border border-dashed border-[var(--navy-border-soft)] px-3 py-2.5 text-[11px] text-[var(--navy-text-muted)] hover:bg-[var(--navy-surface-2)] hover:text-[var(--navy-text)] transition"
            >
                <ChevronDown size={13} />
                시작 가이드 다시 보기
            </button>
        );
    }

    // ── COMPACT MODE ─────────────────────────────────────────────────────────────
    if (compact) {
        // 둘 다 완료면 작은 배지만 표시
        if (bothCompleted) {
            return (
                <div className="rounded-2xl bg-[var(--navy-surface)] border border-[var(--navy-border-soft)] px-4 py-3 flex items-center gap-3">
                    <Trophy size={16} className="text-amber-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[var(--navy-text)]">시작 가이드 완료</div>
                        <div className="text-[11px] text-[var(--navy-text-muted)] mt-0.5">모든 항목을 완료했습니다 ✓</div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setExpandedCompleted((p) => ({ ...p, TOTAL: !p.TOTAL, APARTMENT: !p.APARTMENT }))}
                        className="shrink-0 text-[11px] text-[var(--navy-text-muted)] hover:text-[var(--navy-text)] transition"
                    >
                        다시보기
                    </button>
                </div>
            );
        }

        return (
            <div className="rounded-2xl bg-[var(--navy-surface)] border border-[var(--navy-border-soft)] overflow-hidden">
                {/* Compact header */}
                <div className="px-4 pt-4 pb-3">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-black text-[var(--navy-text)]">시작 가이드</span>
                        <span className="text-[11px] font-semibold text-[var(--navy-text-muted)]">{progress}%</span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full bg-[var(--navy-surface-2)] overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    {/* Type tabs */}
                    <div className="mt-3 inline-flex rounded-lg border border-[var(--navy-border-soft)] bg-[var(--navy-surface-2)] p-0.5">
                        {!totalHidden && (
                            <button type="button" onClick={() => setActiveTab("TOTAL")}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition ${activeTab === "TOTAL" ? "bg-blue-600 text-white" : "text-[var(--navy-text-muted)] hover:text-[var(--navy-text)]"}`}>
                                전체 {totalCompleted && "✓"}
                            </button>
                        )}
                        {!apartmentHidden && (
                            <button type="button" onClick={() => setActiveTab("APARTMENT")}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition ${activeTab === "APARTMENT" ? "bg-blue-600 text-white" : "text-[var(--navy-text-muted)] hover:text-[var(--navy-text)]"}`}>
                                공기계산 {apartmentCompleted && "✓"}
                            </button>
                        )}
                    </div>
                </div>

                {/* Next step (active) — always visible */}
                {!isCompleted && nextStep && (
                    <div className="mx-4 mb-3 rounded-xl border border-blue-500/30 bg-blue-500/8 px-3 py-2.5">
                        <div className="flex items-center gap-2 mb-1.5">
                            <Circle size={13} className="text-blue-400 shrink-0" />
                            <span className="text-xs font-bold text-[var(--navy-text)] leading-tight">{nextStep.title}</span>
                        </div>
                        <div className="text-[11px] text-[var(--navy-text-muted)] leading-4 mb-2 pl-[21px]">{nextStep.howTo}</div>
                        <div className="pl-[21px]">
                            <button
                                type="button"
                                onClick={nextStep.action}
                                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-500 transition"
                            >
                                <PlayCircle size={12} />
                                {nextStep.actionLabel}
                            </button>
                        </div>
                    </div>
                )}

                {/* Completed message */}
                {isCompleted && (
                    <div className="mx-4 mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-3 py-2.5 flex items-center gap-2">
                        <Trophy size={14} className="text-amber-400 shrink-0" />
                        <span className="text-xs font-bold text-[var(--navy-text)]">이 유형 완료!</span>
                    </div>
                )}

                {/* "나머지 단계 보기" toggle */}
                <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-2 text-[11px] text-[var(--navy-text-muted)] hover:bg-[var(--navy-surface-2)] border-t border-[var(--navy-border-soft)] transition"
                >
                    <span>{showAll ? "접기" : `전체 단계 보기 (${steps.filter(s => s.done).length}/${steps.length} 완료)`}</span>
                    {showAll ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>

                {/* Full step list (expanded) */}
                {showAll && (
                    <div className="px-4 pb-3 space-y-1.5 border-t border-[var(--navy-border-soft)] pt-3">
                        {steps.map((step, index) => {
                            const isDone = step.done;
                            const isLocked = !isDone && index > activeIndex;
                            const isActiveStep = !isDone && index === activeIndex;
                            return (
                                <div key={step.id} className="flex items-center gap-2">
                                    {isDone ? <CheckCircle2 size={13} className="text-[var(--navy-success)] shrink-0" />
                                        : isLocked ? <Lock size={13} className="text-[var(--navy-text-muted)] shrink-0 opacity-50" />
                                            : <Circle size={13} className="text-blue-400 shrink-0" />}
                                    <span className={`text-[11px] ${isDone ? "line-through text-[var(--navy-text-muted)]" : isActiveStep ? "font-bold text-[var(--navy-text)]" : "text-[var(--navy-text-muted)]"}`}>
                                        {step.title}
                                    </span>
                                    {isDone && <span className="ml-auto text-[10px] text-[var(--navy-success)] shrink-0">완료</span>}
                                </div>
                            );
                        })}
                        {!isCompleted && (
                            <button type="button" onClick={handleHide}
                                className="mt-2 text-[11px] text-[var(--navy-text-muted)] hover:text-[var(--navy-text)] transition underline underline-offset-2">
                                숨기기
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ── FULL MODE (기존 동작 유지) ────────────────────────────────────────────────
    return (
        <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="rounded-3xl bg-[var(--navy-surface)] p-5 shadow-xl shadow-black/10 border border-[var(--navy-border-soft)]"
        >
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-lg font-black text-[var(--navy-text)]">시작 가이드</div>
                    <div className="mt-1 text-xs text-[var(--navy-text-muted)]">지금 해야 할 단계와 이동 경로를 한 번에 안내합니다.</div>
                </div>
                <div className="flex items-center gap-2">
                    {isCompleted ? (
                        <span className="text-xs font-bold text-[var(--navy-success)]">✓ 완료</span>
                    ) : (
                        <span className="text-xs font-semibold text-[var(--navy-text-muted)]">{progress}% 완료</span>
                    )}
                    {isCompleted && (
                        <button type="button"
                            onClick={() => setExpandedCompleted((prev) => ({ ...prev, [activeTab]: !prev[activeTab] }))}
                            className="rounded-lg p-1 hover:bg-[var(--navy-surface-2)] transition">
                            {isExpanded ? <ChevronUp size={16} className="text-[var(--navy-text-muted)]" /> : <ChevronDown size={16} className="text-[var(--navy-text-muted)]" />}
                        </button>
                    )}
                </div>
            </div>
            <div className="mt-4 inline-flex rounded-xl border border-[var(--navy-border-soft)] bg-[var(--navy-surface-2)] p-1">
                {!totalHidden && (
                    <button type="button" onClick={() => setActiveTab("TOTAL")}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${activeTab === "TOTAL" ? "bg-blue-600 text-white" : "text-[var(--navy-text-muted)] hover:bg-[var(--navy-surface-3)]"}`}>
                        전체 공기산정{totalCompleted && <span className="ml-1.5 text-[10px] opacity-70">✓</span>}
                    </button>
                )}
                {!apartmentHidden && (
                    <button type="button" onClick={() => setActiveTab("APARTMENT")}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${activeTab === "APARTMENT" ? "bg-blue-600 text-white" : "text-[var(--navy-text-muted)] hover:bg-[var(--navy-surface-3)]"}`}>
                        공기 계산{apartmentCompleted && <span className="ml-1.5 text-[10px] opacity-70">✓</span>}
                    </button>
                )}
            </div>
            <div className="mt-4 h-2 rounded-full bg-[var(--navy-surface-2)] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            {isExpanded && (
                <div className="mt-4 space-y-2">
                    {steps.map((step, index) => {
                        const isDone = step.done;
                        const isLocked = !isDone && index > activeIndex;
                        const isActiveStep = !isDone && index === activeIndex;
                        return (
                            <div key={step.id} className={`rounded-2xl border px-4 py-3 flex items-center justify-between gap-3 ${isActiveStep ? "border-blue-500/40 bg-blue-500/10" : "border-[var(--navy-border-soft)] bg-[var(--navy-surface-2)]"}`}>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        {isDone ? <CheckCircle2 size={16} className="text-[var(--navy-success)] shrink-0" />
                                            : isLocked ? <Lock size={16} className="text-[var(--navy-text-muted)] shrink-0" />
                                                : <Circle size={16} className="text-blue-300 shrink-0" />}
                                        <span className={`text-sm font-bold ${isDone ? "text-[var(--navy-text-muted)] line-through" : "text-[var(--navy-text)]"}`}>{step.title}</span>
                                    </div>
                                    <div className="mt-1 text-xs text-[var(--navy-text-muted)]">{step.desc}</div>
                                    <div className="mt-0.5 text-[11px] text-[var(--navy-text-muted)]/90">{step.howTo}</div>
                                </div>
                                {isDone ? <span className="text-xs font-semibold text-[var(--navy-success)] shrink-0">완료</span>
                                    : isActiveStep ? (
                                        <button type="button" onClick={step.action}
                                            className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500 transition">
                                            <PlayCircle size={14} />{step.actionLabel}
                                        </button>
                                    ) : <span className="text-xs text-[var(--navy-text-muted)] shrink-0">이전 단계 완료 후 열림</span>}
                            </div>
                        );
                    })}
                </div>
            )}
            {!isCompleted && (
                <div className="mt-4 flex items-center gap-2">
                    <button type="button" onClick={handleHide}
                        className="rounded-xl border border-[var(--navy-border-soft)] px-3 py-2 text-xs font-semibold text-[var(--navy-text-muted)] hover:bg-[var(--navy-surface-2)] transition">
                        이 가이드 숨기기
                    </button>
                    <button type="button" onClick={handleHide}
                        className="rounded-xl border border-[var(--navy-border-soft)] px-3 py-2 text-xs font-semibold text-[var(--navy-text-muted)] hover:bg-[var(--navy-surface-2)] transition">
                        나중에 하기
                    </button>
                </div>
            )}
        </motion.section>
    );
}
