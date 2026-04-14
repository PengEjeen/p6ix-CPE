import React, { useMemo } from "react";
import useWeightScheduleData from "../../../hooks/useWeightScheduleData";
import { calculateGanttItems } from "../ganttUtils";

const toDateStr = (d) => d.toISOString().slice(0, 10);
const addDays   = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

export default function WeightSchedulePage({ startDate, totalCalendarDays, workDayType, operatingRates, items = [] }) {
    // raw items → startDay/durationDays 계산된 items
    const ganttItems = useMemo(() => calculateGanttItems(items).itemsWithTiming, [items]);

    const { dayMap, totalWorking, loading, projectStart, projectEnd } =
        useWeightScheduleData({ startDate, totalCalendarDays, workDayType, operatingRates, items: ganttItems });

    if (!startDate || !totalCalendarDays) {
        return (
            <div className="flex items-center justify-center h-40 text-sm text-gray-500">
                시작일과 공사기간을 먼저 설정해주세요.
            </div>
        );
    }
    if (loading) {
        return (
            <div className="flex items-center justify-center h-40 text-sm text-gray-500">
                공휴일 데이터 로딩 중...
            </div>
        );
    }

    return (
        <ActivityMatrix
            ganttItems={ganttItems}
            dayMap={dayMap}
            totalWorking={totalWorking}
            projectStart={projectStart}
            projectEnd={projectEnd}
        />
    );
}

/* ── 이진 활동 매트릭스 ── */
function ActivityMatrix({ ganttItems, dayMap, totalWorking, projectStart, projectEnd }) {
    // 프로젝트 전체 날짜 배열
    const days = useMemo(() => {
        if (!projectStart || !projectEnd) return [];
        const arr = [];
        let cur = new Date(projectStart);
        while (cur <= projectEnd) {
            arr.push(new Date(cur));
            cur = addDays(cur, 1);
        }
        return arr;
    }, [projectStart?.getTime(), projectEnd?.getTime()]);

    // 숨김 처리 제외, 기간 있는 세부공종만
    const visibleItems = useMemo(() => {
        return ganttItems.filter(
            (item) => !item._singleTotalHidden && (item.durationDays ?? item.calendar_days ?? 0) > 0
        );
    }, [ganttItems]);

    // 월 그룹 (헤더 colspan 계산)
    const monthGroups = useMemo(() => {
        const groups = [];
        let cur = null;
        days.forEach((date, idx) => {
            const key = `${date.getFullYear()}-${date.getMonth()}`;
            if (!cur || cur.key !== key) {
                cur = {
                    key,
                    label: `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`,
                    count: 1,
                };
                groups.push(cur);
            } else {
                cur.count++;
            }
        });
        return groups;
    }, [days]);

    if (!days.length || !visibleItems.length) {
        return (
            <div className="flex items-center justify-center h-40 text-sm text-[var(--navy-text-muted)]">
                공종 데이터가 없습니다.
            </div>
        );
    }

    const ROW_BG = ["var(--navy-bg)", "var(--navy-surface)"];

    return (
        <div className="overflow-auto h-full">
            <table className="border-collapse text-xs" style={{ tableLayout: "fixed" }}>
                <colgroup>
                    <col style={{ width: 240, minWidth: 240 }} />
                    {days.map((_, i) => <col key={i} style={{ width: 28, minWidth: 28 }} />)}
                </colgroup>

                <thead className="sticky top-0 z-20">
                    {/* 월 헤더 */}
                    <tr>
                        <th
                            className="sticky left-0 z-30 border border-[var(--navy-border)] px-2 py-1.5 text-left text-[var(--navy-text-muted)] text-sm font-semibold"
                            style={{ backgroundColor: "var(--navy-bg)" }}
                        >
                            세부공종
                        </th>
                        {monthGroups.map((g) => (
                            <th
                                key={g.key}
                                colSpan={g.count}
                                className="border border-[var(--navy-border)] text-center text-[var(--navy-text)] text-xs font-semibold py-1.5"
                                style={{ backgroundColor: "var(--navy-bg)" }}
                            >
                                {g.label}
                            </th>
                        ))}
                    </tr>

                    {/* 일 헤더 */}
                    <tr>
                        <th
                            className="sticky left-0 z-30 border border-[var(--navy-border)]"
                            style={{ backgroundColor: "var(--navy-bg)" }}
                        />
                        {days.map((date, i) => {
                            const ds  = toDateStr(date);
                            const dow = date.getDay();
                            const isWorking = dayMap.get(ds) === 1;
                            return (
                                <th
                                    key={i}
                                    className={`border border-[var(--navy-border)] text-center py-1 font-normal text-xs
                                        ${!isWorking ? "text-[var(--navy-border)]" : dow === 0 ? "text-red-400" : dow === 6 ? "text-blue-400" : "text-[var(--navy-text-muted)]"}`}
                                    style={{ backgroundColor: "var(--navy-bg)" }}
                                >
                                    {date.getDate()}
                                </th>
                            );
                        })}
                    </tr>
                </thead>

                <tbody>
                    {visibleItems.map((item, rowIdx) => {
                        const s   = item.startDay ?? 0;
                        const dur = item.durationDays ?? item.calendar_days ?? 0;
                        const bg  = ROW_BG[rowIdx % 2];
                        const label = [item.process, item.work_type].filter(Boolean).join(" > ");

                        return (
                            <tr key={item.id ?? rowIdx}>
                                <td
                                    className="sticky left-0 z-10 border border-[var(--navy-border)] px-2 py-1 text-xs text-[var(--navy-text)] truncate"
                                    style={{ backgroundColor: bg }}
                                    title={label}
                                >
                                    {label}
                                </td>
                                {days.map((date, colIdx) => {
                                    const ds        = toDateStr(date);
                                    const inRange   = dur > 0 && colIdx >= s && colIdx < s + dur;
                                    const isWorking = dayMap.get(ds) === 1;
                                    const active    = inRange && isWorking;

                                    return (
                                        <td
                                            key={colIdx}
                                            className={`border border-[var(--navy-border)] text-center py-1 text-xs font-mono leading-none
                                                ${active ? "text-[var(--navy-success)]" : "text-[var(--navy-border)]"}`}
                                            style={{ backgroundColor: active ? "color-mix(in srgb, var(--navy-success) 15%, var(--navy-bg))" : bg }}
                                        >
                                            {active ? "1" : "0"}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
