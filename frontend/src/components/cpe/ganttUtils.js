// --- Design Tokens ---
export const TOKENS = {
    colors: {
        primary: "bg-blue-600",
        aiAccent: "bg-violet-500", // The "Magic" Color
        aiGradient: "bg-gradient-to-r from-violet-500 to-fuchsia-500",
        glass: "bg-white/80 backdrop-blur-md border border-white/20",
        slate: "bg-slate-900",
        textMain: "text-slate-800"
    }
};

// Helper: Generate week/month grid labels based on date scale
export const generateTimeline = (startDate, totalDays, dateScale = 1) => {
    if (!startDate || totalDays <= 0) return { months: [], weeks: [], days: [] };

    const start = new Date(startDate);
    const months = [];
    const days = [];

    const totalUnits = Math.ceil(totalDays / dateScale);

    let currentDate = new Date(start);
    let currentMonth = null;

    // Generate units based on scale
    for (let unit = 0; unit < totalUnits; unit++) {
        const dayNumber = unit * dateScale;
        const unitDate = new Date(start);
        unitDate.setDate(unitDate.getDate() + dayNumber);

        const monthKey = `${unitDate.getFullYear()}-${unitDate.getMonth()}`;

        // Track months
        if (monthKey !== currentMonth) {
            months.push({
                key: monthKey,
                label: `${unitDate.getFullYear()}.${String(unitDate.getMonth() + 1).padStart(2, '0')}`,
                startUnit: unit,
                count: 1
            });
            currentMonth = monthKey;
        } else if (months.length > 0) {
            months[months.length - 1].count++;
        }

        // Generate day/week labels based on scale
        let label;
        if (dateScale === 1) {
            label = unitDate.getDate().toString();
        } else if (dateScale === 5) {
            label = `${Math.floor(unit / (7 / dateScale)) + 1}주`;
        } else if (dateScale === 10) {
            const dekad = Math.floor((unitDate.getDate() - 1) / 10);
            label = ['상순', '중순', '하순'][dekad] || `${unit * 10 + 1}일~`;
        } else if (dateScale === 30) {
            label = `${unitDate.getMonth() + 1}월`;
        } else {
            label = `${dayNumber + 1}일`;
        }

        days.push({
            date: unitDate,
            dayOfMonth: label,
            actualDay: dayNumber
        });
    }

    return { months, weeks: [], days };
};

// Color mapping by category (Updated for Professional Vibe)
export const getCategoryColor = (mainCategory) => {
    const lower = mainCategory ? mainCategory.toLowerCase() : "";
    if (lower.includes('토공') || lower.includes('준비')) return 'bg-slate-500';
    if (lower.includes('골조')) return 'bg-blue-600';
    if (lower.includes('마감')) return 'bg-emerald-500';
    if (lower.includes('mep')) return 'bg-violet-500';
    if (lower.includes('조경')) return 'bg-amber-500';
    return 'bg-blue-400';
};

// Calculate Gantt items with timing (startDay, duration, CP logic)
export const calculateGanttItems = (items) => {
    if (!items || items.length === 0) return { itemsWithTiming: [], totalDays: 0, parallelGroups: new Map(), dailyLoads: new Map() };

    const result = [];
    const groups = new Map();
    const loads = new Map();

    // Track the cumulative CRITICAL PATH end across all tasks
    let cumulativeCPEnd = 0;

    for (let i = 0; i < items.length; i++) {
        const originalItem = items[i];
        const item = { ...originalItem };

        const duration = parseFloat(item.calendar_days) || 0;
        const crew = parseFloat(item.crew_size) || 0;
        const frontParallel = parseFloat(item.front_parallel_days) || 0;
        const backParallel = parseFloat(item.back_parallel_days) || 0;

        let startDay;

        if (item._startDay !== undefined && item._startDay !== null) {
            startDay = item._startDay;
        } else {
            if (i === 0) {
                startDay = 0;
            } else {
                // Critical Path Logic: startDay = cumulativeCPEnd - frontParallel
                startDay = Math.max(0, cumulativeCPEnd - frontParallel);
            }
        }

        // Calculate this task's CP end
        const cpEnd = startDay + duration - backParallel;

        // Update cumulative CP end
        cumulativeCPEnd = Math.max(cumulativeCPEnd, cpEnd);

        const endDay = Math.ceil(startDay + duration);
        for (let d = Math.floor(startDay); d < endDay; d++) {
            loads.set(d, (loads.get(d) || 0) + crew);
        }

        result.push({ ...item, startDay, durationDays: duration });

        if (item._parallelGroup) {
            if (!groups.has(item._parallelGroup)) groups.set(item._parallelGroup, []);
            groups.get(item._parallelGroup).push(i);
        }
    }
    const maxEndDay = result.reduce((max, item) => Math.max(max, item.startDay + item.durationDays), 0);
    return { itemsWithTiming: result, totalDays: maxEndDay, parallelGroups: groups, dailyLoads: loads };
};
