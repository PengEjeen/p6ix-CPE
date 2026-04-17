import React, { useMemo, useRef, useCallback, useState, useEffect, useDeferredValue } from "react";
import useWeightScheduleData from "../../../hooks/useWeightScheduleData";

const toDateStr = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
};
const parseNum = (s) => parseFloat(String(s).replace(/,/g, "")) || 0;

const LABEL_W = 240;
const INPUT_W = 150;
const DAY_W = 28;
const ROW_H = 28;
const BUF_ROWS = 5;
const BUF_COLS = 6;
const ROW_BUCKET = 4;

export default function WeightSchedulePage({
    startDate,
    totalCalendarDays,
    workDayType,
    operatingRates,
    items = [],
    initialCostInputs = {},
    onPersistInputs,
}) {
    const { dayMap, loading, projectStart, projectEnd } =
        useWeightScheduleData({ startDate, totalCalendarDays, workDayType, operatingRates, items });

    if (!startDate || !totalCalendarDays) {
        return (
            <div className="flex items-center justify-center h-40 text-sm text-[var(--navy-text-muted)]">
                시작일과 공사기간을 먼저 설정해주세요.
            </div>
        );
    }
    if (loading) {
        return (
            <div className="flex items-center justify-center h-40 text-sm text-[var(--navy-text-muted)]">
                공휴일 데이터 로딩 중...
            </div>
        );
    }

    return (
        <ActivityMatrix
            ganttItems={items}
            dayMap={dayMap}
            projectStart={projectStart}
            projectEnd={projectEnd}
            initialCostInputs={initialCostInputs}
            onPersistInputs={onPersistInputs}
        />
    );
}

function ActivityMatrix({
    ganttItems,
    dayMap,
    projectStart,
    projectEnd,
    initialCostInputs,
    onPersistInputs,
}) {
    const [costValues, setCostValues] = useState(
        () => (initialCostInputs && typeof initialCostInputs === "object" ? initialCostInputs : {})
    );
    const [scrollRow, setScrollRow] = useState(0);
    const [scrollCol, setScrollCol] = useState(0);
    const [viewH, setViewH] = useState(600);
    const [viewW, setViewW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1000));
    const deferredCostValues = useDeferredValue(costValues);

    const tableRef = useRef(null);
    const scrollRafRef = useRef(0);
    const pendingScrollTopRef = useRef(0);
    const pendingScrollLeftRef = useRef(0);
    const costValuesRef = useRef(costValues);

    useEffect(() => {
        const el = tableRef.current;
        if (!el) return;

        const syncSize = () => {
            const nextH = el.clientHeight || 0;
            const nextW = el.clientWidth || 0;
            if (nextH > 0) setViewH(nextH);
            if (nextW > 0) setViewW(nextW);
        };

        syncSize();
        const rafId = window.requestAnimationFrame(syncSize);
        const timerId = window.setTimeout(syncSize, 120);

        let ro;
        if (typeof ResizeObserver !== "undefined") {
            ro = new ResizeObserver(([entry]) => {
                const nextH = entry.contentRect.height || 0;
                const nextW = entry.contentRect.width || 0;
                if (nextH > 0) setViewH(nextH);
                if (nextW > 0) setViewW(nextW);
            });
            ro.observe(el);
        }

        window.addEventListener("resize", syncSize);
        return () => {
            window.cancelAnimationFrame(rafId);
            window.clearTimeout(timerId);
            window.removeEventListener("resize", syncSize);
            if (ro) ro.disconnect();
        };
    }, []);

    useEffect(() => {
        const nextCostInputs = initialCostInputs && typeof initialCostInputs === "object" ? initialCostInputs : {};
        setCostValues(nextCostInputs);
        costValuesRef.current = nextCostInputs;
    }, [initialCostInputs]);

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

    const visibleItems = useMemo(
        () => ganttItems.filter((item) => !item._singleTotalHidden && (item.durationDays ?? item.calendar_days ?? 0) > 0),
        [ganttItems]
    );

    const workingColSet = useMemo(() => {
        const set = new Set();
        days.forEach((d, i) => {
            if (dayMap.get(toDateStr(d)) === 1) set.add(i);
        });
        return set;
    }, [days, dayMap]);

    const monthGroups = useMemo(() => {
        const out = [];
        let cur = null;
        days.forEach((date) => {
            const key = `${date.getFullYear()}-${date.getMonth()}`;
            if (!cur || cur.key !== key) {
                cur = {
                    key,
                    label: `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`,
                    count: 1,
                };
                out.push(cur);
            } else {
                cur.count += 1;
            }
        });
        return out;
    }, [days]);

    const dayHeaders = useMemo(
        () => days.map((d, i) => ({ day: d.getDate(), dow: d.getDay(), isWorking: workingColSet.has(i) })),
        [days, workingColSet]
    );

    const dayIndexes = useMemo(() => Array.from({ length: days.length }, (_, i) => i), [days.length]);

    const totalCost = useMemo(() => {
        return visibleItems.reduce((sum, it) => sum + parseNum(deferredCostValues[String(it.id)] ?? ""), 0);
    }, [deferredCostValues, visibleItems]);

    const costWeightMap = useMemo(() => {
        if (totalCost <= 0) return {};
        const out = {};
        visibleItems.forEach((it) => {
            const id = String(it.id);
            out[id] = (parseNum(deferredCostValues[id] ?? "") / totalCost) * 100;
        });
        return out;
    }, [totalCost, deferredCostValues, visibleItems]);

    const { rowStart, rowEnd } = useMemo(() => {
        const rowAnchor = Math.floor(scrollRow / ROW_BUCKET) * ROW_BUCKET;
        const visibleRowCount = Math.ceil(viewH / ROW_H);
        return {
            rowStart: Math.max(0, rowAnchor - BUF_ROWS),
            rowEnd: Math.min(visibleItems.length, rowAnchor + visibleRowCount + BUF_ROWS),
        };
    }, [scrollRow, viewH, visibleItems.length]);

    const stickyWidth = LABEL_W + INPUT_W;
    const measuredWidth = Math.max(viewW, tableRef.current?.clientWidth || 0);
    const availableDayWidth = Math.max(0, measuredWidth - stickyWidth);
    const shouldStretchDays = days.length > 0 && availableDayWidth > 0 && days.length * DAY_W < availableDayWidth;
    const effectiveDayW = shouldStretchDays ? availableDayWidth / days.length : DAY_W;
    const viewportDayWidth = Math.max(0, viewW - stickyWidth);
    const visibleColCount = Math.ceil(viewportDayWidth / Math.max(effectiveDayW, 1));
    const colStart = Math.max(0, scrollCol - BUF_COLS);
    const colEnd = Math.min(days.length, scrollCol + visibleColCount + BUF_COLS);
    const visibleDayIndexes = useMemo(() => dayIndexes.slice(colStart, colEnd), [dayIndexes, colStart, colEnd]);
    const leftHiddenCols = colStart;
    const rightHiddenCols = Math.max(0, days.length - colEnd);

    useEffect(() => {
        const el = tableRef.current;
        if (!el) return;
        const nextScrollCol = Math.floor(el.scrollLeft / Math.max(effectiveDayW, 1));
        setScrollCol((prev) => (prev === nextScrollCol ? prev : nextScrollCol));
    }, [effectiveDayW]);

    if (!days.length || !visibleItems.length) {
        return <div className="flex items-center justify-center h-40 text-sm text-[var(--navy-text-muted)]">공종 데이터가 없습니다.</div>;
    }

    const totalTableWidth = stickyWidth + days.length * effectiveDayW;
    const persistInputs = useCallback((nextCostInputs) => {
        if (typeof onPersistInputs === "function") {
            onPersistInputs(nextCostInputs);
        }
    }, [onPersistInputs]);

    const updateCostValue = useCallback((id, val) => {
        setCostValues((prev) => {
            const next = { ...prev, [String(id)]: val };
            costValuesRef.current = next;
            persistInputs(next);
            return next;
        });
    }, [persistInputs]);

    const handleInput = useCallback((id, val) => {
        updateCostValue(id, val);
    }, [updateCostValue]);

    const handlePaste = useCallback(
        (e, startId) => {
            const text = e.clipboardData.getData("text");
            const rows = text
                .split(/\r?\n/)
                .map((r) => r.split("\t")[0].trim().replace(/,/g, ""))
                .filter((v) => v !== "");
            if (rows.length <= 1) return;
            e.preventDefault();

            const startIndex = visibleItems.findIndex((it) => String(it.id) === String(startId));
            if (startIndex === -1) return;

            setCostValues((prev) => {
                const next = { ...prev };
                rows.forEach((v, i) => {
                    const item = visibleItems[startIndex + i];
                    if (item) next[String(item.id)] = v;
                });
                costValuesRef.current = next;
                persistInputs(next);
                return next;
            });
        },
        [persistInputs, visibleItems]
    );

    const onScroll = useCallback((e) => {
        pendingScrollTopRef.current = e.currentTarget.scrollTop;
        pendingScrollLeftRef.current = e.currentTarget.scrollLeft;
        if (scrollRafRef.current) return;

        scrollRafRef.current = window.requestAnimationFrame(() => {
            scrollRafRef.current = 0;
            const nextScrollRow = Math.floor(pendingScrollTopRef.current / ROW_H);
            const nextScrollCol = Math.floor(pendingScrollLeftRef.current / Math.max(effectiveDayW, 1));
            setScrollRow((prev) => (prev === nextScrollRow ? prev : nextScrollRow));
            setScrollCol((prev) => (prev === nextScrollCol ? prev : nextScrollCol));
        });
    }, [effectiveDayW]);

    useEffect(() => () => {
        if (scrollRafRef.current) {
            window.cancelAnimationFrame(scrollRafRef.current);
        }
    }, []);

    useEffect(() => () => {
        persistInputs(costValuesRef.current);
    }, [persistInputs]);

    return (
        <div className="flex w-full min-w-0 flex-col flex-1 min-h-0">
            <div className="flex items-center gap-4 px-3 py-2 shrink-0 border-b border-[var(--navy-border)] bg-[var(--navy-surface)]">
                <span className="text-sm text-[var(--navy-text-muted)]">
                    총 공사비 <span className="font-semibold text-[var(--navy-text)]">{totalCost.toLocaleString("ko-KR")}원</span>
                </span>
            </div>

            <div ref={tableRef} className="w-full min-w-0 overflow-auto flex-1" onScroll={onScroll}>
                <table className="border-collapse text-xs" style={{ tableLayout: "fixed", width: totalTableWidth, minWidth: totalTableWidth }}>
                    <thead className="sticky top-0 z-20">
                        <tr>
                            <th
                                rowSpan={2}
                                className="sticky left-0 z-30 border border-[var(--navy-border)] px-2 text-left text-[var(--navy-text-muted)] text-sm font-semibold align-middle"
                                style={{ width: LABEL_W, backgroundColor: "var(--navy-bg)" }}
                            >
                                세부공종
                            </th>
                            <th
                                rowSpan={2}
                                className="sticky z-30 border border-[var(--navy-border)] px-2 text-center text-[var(--navy-text-muted)] text-xs font-semibold align-middle"
                                style={{ left: LABEL_W, width: INPUT_W, backgroundColor: "var(--navy-bg)" }}
                            >
                                비용(원)
                            </th>

                            {monthGroups.map((group) => (
                                <th
                                    key={group.key}
                                    colSpan={group.count}
                                    className="border border-[var(--navy-border)] text-center text-[var(--navy-text)] text-xs font-semibold py-1.5"
                                    style={{ backgroundColor: "var(--navy-bg)" }}
                                >
                                    {group.label}
                                </th>
                            ))}
                        </tr>
                        <tr>
                            {dayHeaders.map((h, i) => (
                                <th
                                    key={i}
                                    className={`border border-[var(--navy-border)] text-center py-1 font-normal text-xs ${
                                        !h.isWorking ? "text-[var(--navy-border)]" : h.dow === 0 ? "text-red-400" : h.dow === 6 ? "text-blue-400" : "text-[var(--navy-text-muted)]"
                                    }`}
                                    style={{ width: effectiveDayW, backgroundColor: "var(--navy-bg)" }}
                                >
                                    {h.day}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {rowStart > 0 && (
                            <tr style={{ height: rowStart * ROW_H }}>
                                <td colSpan={2 + days.length} />
                            </tr>
                        )}

                        {visibleItems.slice(rowStart, rowEnd).map((item, idx) => {
                            const rowIdx = rowStart + idx;
                            const id = String(item.id);
                            const rawVal = costValues[id] ?? "";
                            return (
                                <MatrixRow
                                    key={item.id ?? rowIdx}
                                    item={item}
                                    rowIdx={rowIdx}
                                    rawVal={rawVal}
                                    weight={costWeightMap?.[id] ?? 0}
                                    handleInput={handleInput}
                                    handlePaste={handlePaste}
                                    workingColSet={workingColSet}
                                    dayIndexes={visibleDayIndexes}
                                    leftHiddenCols={leftHiddenCols}
                                    rightHiddenCols={rightHiddenCols}
                                    dayW={effectiveDayW}
                                />
                            );
                        })}

                        {rowEnd < visibleItems.length && (
                            <tr style={{ height: (visibleItems.length - rowEnd) * ROW_H }}>
                                <td colSpan={2 + days.length} />
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const MatrixRow = React.memo(function MatrixRow({
    item,
    rowIdx,
    rawVal,
    weight,
    handleInput,
    handlePaste,
    workingColSet,
    dayIndexes,
    leftHiddenCols,
    rightHiddenCols,
    dayW,
}) {
    const start = Number(item.startDay ?? item._startDay ?? 0) || 0;
    const duration = Number(item.durationDays ?? item.calendar_days ?? 0) || 0;
    const bg = rowIdx % 2 === 0 ? "var(--navy-bg)" : "var(--navy-surface)";
    const label = [item.process, item.work_type].filter(Boolean).join(" > ");

    return (
        <tr style={{ height: ROW_H }}>
            <td
                className="sticky left-0 z-10 border border-[var(--navy-border)] px-2 text-xs text-[var(--navy-text)] truncate"
                style={{ width: LABEL_W, backgroundColor: bg }}
                title={label}
            >
                {label}
            </td>

            <td className="sticky z-10 border border-[var(--navy-border)] px-2" style={{ left: LABEL_W, width: INPUT_W, backgroundColor: bg }}>
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                        <input
                            type="number"
                            min="0"
                            step="10000"
                            value={rawVal}
                            onChange={(e) => handleInput(item.id, e.target.value)}
                            onPaste={(e) => handlePaste(e, item.id)}
                            className="w-full bg-transparent text-right text-xs text-[var(--navy-text)] outline-none border-b border-transparent focus:border-blue-400 transition-colors"
                            placeholder="0"
                        />
                        <span className="text-[var(--navy-text-muted)] text-[10px] shrink-0">원</span>
                    </div>
                    <span className="text-[10px] text-right text-[var(--navy-text-muted)]">→ {weight.toFixed(1)}%</span>
                </div>
            </td>

            {leftHiddenCols > 0 && <td colSpan={leftHiddenCols} className="border border-[var(--navy-border)] p-0" style={{ backgroundColor: bg }} />}

            {dayIndexes.map((colIdx) => {
                const active = duration > 0 && colIdx >= start && colIdx < start + duration && workingColSet.has(colIdx);
                return (
                    <td
                        key={colIdx}
                        className={`border border-[var(--navy-border)] text-center text-xs font-mono leading-none ${active ? "text-[var(--navy-success)]" : "text-[var(--navy-border)]"}`}
                        style={{
                            width: dayW,
                            backgroundColor: active ? "color-mix(in srgb, var(--navy-success) 15%, var(--navy-bg))" : bg,
                        }}
                    >
                        {active ? "1" : "0"}
                    </td>
                );
            })}

            {rightHiddenCols > 0 && <td colSpan={rightHiddenCols} className="border border-[var(--navy-border)] p-0" style={{ backgroundColor: bg }} />}
        </tr>
    );
}, areRowsEqual);

function areRowsEqual(prev, next) {
    return (
        prev.item === next.item &&
        prev.rowIdx === next.rowIdx &&
        prev.rawVal === next.rawVal &&
        prev.weight === next.weight &&
        prev.handleInput === next.handleInput &&
        prev.handlePaste === next.handlePaste &&
        prev.workingColSet === next.workingColSet &&
        prev.dayIndexes === next.dayIndexes &&
        prev.leftHiddenCols === next.leftHiddenCols &&
        prev.rightHiddenCols === next.rightHiddenCols &&
        prev.dayW === next.dayW
    );
}
