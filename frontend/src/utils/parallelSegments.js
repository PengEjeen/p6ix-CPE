const EPS = 1e-6;

const toNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const round = (value, digits = 3) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

const toPair = (segment) => {
    if (Array.isArray(segment) && segment.length >= 2) {
        return { start: segment[0], end: segment[1] };
    }
    if (segment && typeof segment === "object") {
        if ("start" in segment && "end" in segment) {
            return { start: segment.start, end: segment.end };
        }
        if ("s" in segment && "e" in segment) {
            return { start: segment.s, end: segment.e };
        }
    }
    return null;
};

export const normalizeParallelSegments = (segments, duration) => {
    const maxDuration = Math.max(0, toNumber(duration, 0));
    if (!Array.isArray(segments) || segments.length === 0 || maxDuration <= EPS) return [];

    const normalized = segments
        .map(toPair)
        .filter(Boolean)
        .map(({ start, end }) => {
            const s = clamp(toNumber(start, 0), 0, maxDuration);
            const e = clamp(toNumber(end, 0), 0, maxDuration);
            return {
                start: Math.min(s, e),
                end: Math.max(s, e)
            };
        })
        .filter(({ end, start }) => (end - start) > EPS)
        .sort((a, b) => a.start - b.start);

    if (normalized.length === 0) return [];

    const merged = [normalized[0]];
    for (let i = 1; i < normalized.length; i += 1) {
        const current = normalized[i];
        const last = merged[merged.length - 1];
        if (current.start <= last.end + EPS) {
            last.end = Math.max(last.end, current.end);
        } else {
            merged.push({ ...current });
        }
    }

    return merged.map((segment) => ({
        start: round(segment.start),
        end: round(segment.end)
    }));
};

const parseSegmentsField = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_error) {
            return [];
        }
    }
    return [];
};

export const getParallelSegmentsFromItem = (item, durationOverride = null) => {
    const duration = Math.max(
        0,
        toNumber(
            durationOverride,
            toNumber(item?.durationDays, toNumber(item?.calendar_days, 0))
        )
    );

    const fieldSegments = normalizeParallelSegments(parseSegmentsField(item?.parallel_segments), duration);
    if (fieldSegments.length > 0) return fieldSegments;

    const frontParallel = clamp(toNumber(item?.front_parallel_days, 0), 0, duration);
    const backParallel = clamp(toNumber(item?.back_parallel_days, 0), 0, duration);
    const fallback = [];
    if (frontParallel > EPS) fallback.push({ start: 0, end: frontParallel });
    if (backParallel > EPS) fallback.push({ start: Math.max(0, duration - backParallel), end: duration });

    return normalizeParallelSegments(fallback, duration);
};

export const getParallelUnionDays = (segments = []) => (
    (Array.isArray(segments) ? segments : []).reduce((sum, seg) => {
        const s = toNumber(seg?.start, 0);
        const e = toNumber(seg?.end, 0);
        return sum + Math.max(0, e - s);
    }, 0)
);

export const deriveParallelMeta = (duration, segments = []) => {
    const safeDuration = Math.max(0, toNumber(duration, 0));
    const normalized = normalizeParallelSegments(segments, safeDuration);
    const parallelDays = Math.min(safeDuration, getParallelUnionDays(normalized));
    const criticalDays = Math.max(0, safeDuration - parallelDays);
    const applicationRate = safeDuration > EPS ? (criticalDays / safeDuration) * 100 : 100;

    let frontParallelDays = 0;
    let cursor = 0;
    for (let i = 0; i < normalized.length; i += 1) {
        const seg = normalized[i];
        if (seg.start <= cursor + EPS) {
            cursor = Math.max(cursor, seg.end);
            frontParallelDays = cursor;
        } else {
            break;
        }
    }

    let backParallelDays = 0;
    let rightCursor = safeDuration;
    for (let i = normalized.length - 1; i >= 0; i -= 1) {
        const seg = normalized[i];
        if (seg.end >= rightCursor - EPS) {
            rightCursor = Math.min(rightCursor, seg.start);
            backParallelDays = safeDuration - rightCursor;
        } else {
            break;
        }
    }

    return {
        segments: normalized,
        parallelDays: round(parallelDays),
        criticalDays: round(criticalDays),
        applicationRate: round(applicationRate, 1),
        frontParallelDays: round(frontParallelDays, 1),
        backParallelDays: round(backParallelDays, 1)
    };
};

export const toAbsoluteParallelSegments = (segments, taskStart) => {
    const start = toNumber(taskStart, 0);
    return (Array.isArray(segments) ? segments : []).map((seg) => ({
        start: round(start + toNumber(seg?.start, 0)),
        end: round(start + toNumber(seg?.end, 0))
    }));
};

export const buildCriticalSegmentsFromParallel = (taskStart, duration, relativeParallelSegments = []) => {
    const safeStart = toNumber(taskStart, 0);
    const safeDuration = Math.max(0, toNumber(duration, 0));
    const safeEnd = safeStart + safeDuration;
    const absoluteParallel = toAbsoluteParallelSegments(
        normalizeParallelSegments(relativeParallelSegments, safeDuration),
        safeStart
    );

    const criticalSegments = [];
    let cursor = safeStart;
    absoluteParallel.forEach((seg) => {
        const segStart = clamp(seg.start, safeStart, safeEnd);
        const segEnd = clamp(seg.end, safeStart, safeEnd);
        if (segStart > cursor + EPS) {
            criticalSegments.push({ start: round(cursor), end: round(segStart) });
        }
        cursor = Math.max(cursor, segEnd);
    });
    if (cursor < safeEnd - EPS) {
        criticalSegments.push({ start: round(cursor), end: round(safeEnd) });
    }
    return criticalSegments;
};

export const buildRightAlignedParallelSegments = (duration, applicationRate) => {
    const safeDuration = Math.max(0, toNumber(duration, 0));
    if (safeDuration <= EPS) return [];

    const rate = clamp(toNumber(applicationRate, 100), 0, 100);
    const criticalEnd = safeDuration * (rate / 100);
    const parallelStart = clamp(criticalEnd, 0, safeDuration);
    if (parallelStart >= safeDuration - EPS) return [];
    return normalizeParallelSegments([{ start: parallelStart, end: safeDuration }], safeDuration);
};

export const buildParallelStateFromSegments = (duration, segments) => {
    const safeDuration = Math.max(0, toNumber(duration, 0));
    const meta = deriveParallelMeta(safeDuration, segments);
    return {
        parallel_segments: meta.segments,
        front_parallel_days: meta.frontParallelDays,
        back_parallel_days: meta.backParallelDays,
        application_rate: meta.applicationRate
    };
};
