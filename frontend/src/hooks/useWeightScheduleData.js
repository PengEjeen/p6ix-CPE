import { useEffect, useMemo, useState } from "react";
import { fetchHolidays } from "../api/operatio";

const toDateStr = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

const toWorkWeekDays = (t) => {
    if (t === "7d") return 7;
    if (t === "5d") return 5;
    return 6;
};

const isWorkday = (date, workWeekDays) => {
    const wd = date.getDay();
    if (workWeekDays >= 7) return true;
    if (workWeekDays === 6) return wd !== 0;
    return wd !== 0 && wd !== 6;
};

export const dominantSectorType = (operatingRates) => {
    if (!operatingRates || operatingRates.length === 0) return "PUBLIC";
    const counts = { PUBLIC: 0, PRIVATE: 0 };
    operatingRates.forEach((r) => {
        const t = (r.sector_type || "PUBLIC").toUpperCase();
        counts[t] = (counts[t] || 0) + 1;
    });
    return counts.PRIVATE > counts.PUBLIC ? "PRIVATE" : "PUBLIC";
};

/**
 * 보할표 데이터 계산 훅
 * @param {object[]} items - 간트 아이템 배열 [{ startDay, durationDays, ... }]
 *   items가 있으면 활성 공종 수로 가중해서 S커브 분포를 만듦 (공종 중복 구간에서 기울기 급해짐)
 *   items가 없으면 작업일 균등 분배 (직선)
 * @returns {object} { dayMap, totalWorking, monthlyData, loading, sectorType, workWeekDays }
 *   monthlyData: [{ year, month, label, working, cumulative, pct }]
 */
export default function useWeightScheduleData({ startDate, totalCalendarDays, workDayType, operatingRates, items = [] }) {
    const [holidaySet, setHolidaySet] = useState(new Set());
    const [loading, setLoading] = useState(false);

    const workWeekDays = toWorkWeekDays(workDayType || "6d");
    const sectorType   = dominantSectorType(operatingRates);

    const projectStart = useMemo(() => {
        if (!startDate) return null;
        return new Date(startDate + "T00:00:00");
    }, [startDate]);

    const projectEnd = useMemo(() => {
        if (!projectStart || !totalCalendarDays) return null;
        return addDays(projectStart, Math.ceil(totalCalendarDays) - 1);
    }, [projectStart, totalCalendarDays]);

    // 공휴일 fetch
    useEffect(() => {
        if (!projectStart || !projectEnd) return;
        setLoading(true);
        fetchHolidays(toDateStr(projectStart), toDateStr(projectEnd), sectorType)
            .then((dates) => setHolidaySet(new Set(dates)))
            .catch(() => setHolidaySet(new Set()))
            .finally(() => setLoading(false));
    }, [projectStart?.getTime(), projectEnd?.getTime(), sectorType]);

    // 날짜별 0/1 맵
    const { dayMap, totalWorking } = useMemo(() => {
        if (!projectStart || !projectEnd) return { dayMap: new Map(), totalWorking: 0 };
        const map = new Map();
        let total = 0;
        let cur = new Date(projectStart);
        while (cur <= projectEnd) {
            const ds = toDateStr(cur);
            const v = isWorkday(cur, workWeekDays) && !holidaySet.has(ds) ? 1 : 0;
            map.set(ds, v);
            total += v;
            cur = addDays(cur, 1);
        }
        return { dayMap: map, totalWorking: total };
    }, [projectStart?.getTime(), projectEnd?.getTime(), workWeekDays, holidaySet]);

    // 간트 아이템으로부터 일별 활성 공종 수 맵 계산 (S커브 가중치)
    // 활성 공종이 없는 날은 1로 처리 (fallback: 균등 분배)
    const activeCountMap = useMemo(() => {
        if (!projectStart || !projectEnd || items.length === 0) return null;
        const map = new Map();
        let cur = new Date(projectStart);
        while (cur <= projectEnd) {
            const dayOffset = Math.round((cur - projectStart) / 86400000);
            let count = 0;
            for (const item of items) {
                // 스토어 raw items: _startDay / calendar_days
                // calculateGanttItems 결과: startDay / durationDays
                const s = parseFloat(item._startDay ?? item.startDay) || 0;
                const dur = parseFloat(item.calendar_days ?? item.durationDays) || 0;
                if (dur > 0 && dayOffset >= s && dayOffset < s + dur) count++;
            }
            map.set(toDateStr(cur), count > 0 ? count : 0);
            cur = addDays(cur, 1);
        }
        return map;
    }, [projectStart?.getTime(), projectEnd?.getTime(), items]);

    // 월별 집계 (누적 포함, 활성 공종 수 가중)
    const monthlyData = useMemo(() => {
        if (!projectStart || !projectEnd || !dayMap.size) return [];
        const useWeighted = activeCountMap !== null;
        const result = [];
        let cumulative = 0;
        let cumulativeWorking = 0;  // 실제 작업일 누적 (달력 표시용)
        let y = projectStart.getFullYear();
        let m = projectStart.getMonth();
        const ey = projectEnd.getFullYear();
        const em = projectEnd.getMonth();

        // 가중 합계 (totalWorking 대신 사용)
        let totalWeighted = 0;
        if (useWeighted) {
            let c = new Date(projectStart);
            while (c <= projectEnd) {
                const ds = toDateStr(c);
                if (dayMap.get(ds) === 1) {
                    totalWeighted += (activeCountMap.get(ds) || 0);
                }
                c = addDays(c, 1);
            }
        }
        const denom = useWeighted ? totalWeighted : totalWorking;

        while (y < ey || (y === ey && m <= em)) {
            const first = new Date(y, m, 1);
            const last  = new Date(y, m + 1, 0);
            let working = 0;
            let weightedWorking = 0;
            let cur = new Date(Math.max(first.getTime(), projectStart.getTime()));
            const end = new Date(Math.min(last.getTime(), projectEnd.getTime()));
            while (cur <= end) {
                const ds = toDateStr(cur);
                if (dayMap.get(ds) === 1) {
                    working++;
                    weightedWorking += useWeighted ? (activeCountMap.get(ds) || 0) : 1;
                }
                cur = addDays(cur, 1);
            }
            cumulative += weightedWorking;
            cumulativeWorking += working;
            const pct = denom > 0 ? (cumulative / denom) * 100 : 0;
            const workingPct = totalWorking > 0 ? (cumulativeWorking / totalWorking) * 100 : 0;
            result.push({ year: y, month: m, label: `${y}.${String(m + 1).padStart(2, "0")}`, working, cumulativeWorking, cumulative, pct, workingPct });
            m++;
            if (m > 11) { m = 0; y++; }
        }
        return result;
    }, [dayMap, totalWorking, activeCountMap, projectStart?.getTime(), projectEnd?.getTime()]);

    return { dayMap, totalWorking, monthlyData, loading, sectorType, workWeekDays, projectStart, projectEnd };
}
