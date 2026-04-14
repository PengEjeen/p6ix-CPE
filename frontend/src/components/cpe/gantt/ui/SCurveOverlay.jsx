import React, { useMemo, useRef, useState, useEffect } from "react";

const PAD_TOP = 16;
const PAD_BOT = 16;
const PAD_LEFT = 36; // Y축 레이블 공간

/**
 * 간트 차트 위에 absolute 오버레이로 그려지는 S커브
 * - 부모(GanttChartArea wrapper)의 높이를 ResizeObserver로 측정해 그 안에 꽉 채움
 *
 * @param {object[]} monthlyData  - [{ year, month, label, pct, working, cumulative }]
 * @param {string}   startDate    - 프로젝트 시작일 "YYYY-MM-DD"
 * @param {number}   pixelsPerUnit
 * @param {number}   dateScale    - 1일 = dateScale 단위
 * @param {number}   totalWidth   - 전체 타임라인 너비 (px)
 * @param {number}   totalWorking - 전체 작업일수
 */
export default function SCurveOverlay({ monthlyData, startDate, pixelsPerUnit, dateScale, totalWidth, totalWorking }) {
    const containerRef = useRef(null);
    const [height, setHeight] = useState(0);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setHeight(entry.contentRect.height);
            }
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const INNER_H = Math.max(0, height - PAD_TOP - PAD_BOT);
    const pxPerDay = pixelsPerUnit / dateScale;
    const projectStart = useMemo(() => startDate ? new Date(startDate + "T00:00:00") : null, [startDate]);

    const dateToX = useMemo(() => (d) => {
        if (!projectStart) return 0;
        const days = (d - projectStart) / 86400000;
        return PAD_LEFT + days * pxPerDay;
    }, [projectStart, pxPerDay]);

    // 월별 포인트: 각 월의 마지막 날 기준 X, 누적% 기준 Y
    const points = useMemo(() => {
        if (!projectStart || !monthlyData.length || height === 0) return [];
        return monthlyData.map((d) => {
            const lastDay = new Date(d.year, d.month + 1, 0);
            const x = dateToX(lastDay);
            const y = PAD_TOP + INNER_H - (d.pct / 100) * INNER_H;
            return { x, y, ...d };
        });
    }, [monthlyData, projectStart, pxPerDay, height, INNER_H, dateToX]);

    // 시작점 (0%)
    const startPoint = useMemo(() => {
        if (!projectStart || height === 0) return null;
        return { x: PAD_LEFT, y: PAD_TOP + INNER_H };
    }, [projectStart, height, INNER_H]);

    // 곡선 path
    const linePath = useMemo(() => {
        if (!points.length || !startPoint) return "";
        const all = [startPoint, ...points];
        let d = `M ${all[0].x} ${all[0].y}`;
        for (let i = 1; i < all.length; i++) {
            const [x0, y0] = [all[i - 1].x, all[i - 1].y];
            const [x1, y1] = [all[i].x, all[i].y];
            const cpx = (x0 + x1) / 2;
            d += ` C ${cpx} ${y0} ${cpx} ${y1} ${x1} ${y1}`;
        }
        return d;
    }, [points, startPoint]);

    // 오늘 마커
    const todayMarker = useMemo(() => {
        if (!projectStart || height === 0) return null;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const x = dateToX(now);
        if (x < PAD_LEFT || x > totalWidth) return null;

        const yy = String(now.getFullYear());
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const label = `${yy}.${mm}`;
        const entry = monthlyData.find((d) => d.label === label);
        const pct = entry?.pct ?? null;
        const cy = pct != null ? PAD_TOP + INNER_H - (pct / 100) * INNER_H : null;
        return { x, pct, cy };
    }, [projectStart, monthlyData, dateToX, totalWidth, height, INNER_H]);

    // Y축 눈금
    const yTicks = [0, 25, 50, 75, 100];

    if (!monthlyData.length || !projectStart) return null;

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 pointer-events-none z-10"
        >
            {height > 0 && (
                <svg
                    width={totalWidth}
                    height={height}
                    className="absolute inset-0 overflow-visible"
                >
                    <defs>
                        <clipPath id="scurve-overlay-clip">
                            <rect x={PAD_LEFT} y={PAD_TOP} width={totalWidth - PAD_LEFT} height={INNER_H} />
                        </clipPath>
                    </defs>

                    {/* Y축 그리드 + 레이블 */}
                    {yTicks.map((t) => {
                        const y = PAD_TOP + INNER_H - (t / 100) * INNER_H;
                        return (
                            <g key={t}>
                                <line
                                    x1={PAD_LEFT} y1={y} x2={totalWidth} y2={y}
                                    stroke={t === 0 ? "#94a3b8" : "#cbd5e1"}
                                    strokeWidth={t === 0 ? 1 : 0.5}
                                    strokeDasharray={t === 0 ? "0" : "4 4"}
                                    opacity={0.4}
                                />
                                <text
                                    x={PAD_LEFT - 4} y={y}
                                    textAnchor="end" dominantBaseline="middle"
                                    fontSize={8} fill="#64748b"
                                >
                                    {t}%
                                </text>
                            </g>
                        );
                    })}

                    {/* S커브 선 */}
                    {linePath && (
                        <path
                            d={linePath}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            strokeLinecap="round"
                            clipPath="url(#scurve-overlay-clip)"
                        />
                    )}

                    {/* 데이터 포인트 */}
                    {points.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#3b82f6" opacity={0.8} clipPath="url(#scurve-overlay-clip)" />
                    ))}

                    {/* 오늘 마커 */}
                    {todayMarker && (
                        <g>
                            <line
                                x1={todayMarker.x} y1={PAD_TOP}
                                x2={todayMarker.x} y2={PAD_TOP + INNER_H}
                                stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 2"
                            />
                            {todayMarker.cy != null && (
                                <>
                                    <circle
                                        cx={todayMarker.x} cy={todayMarker.cy}
                                        r={4} fill="#f59e0b" stroke="white" strokeWidth={1.5}
                                    />
                                    <text x={todayMarker.x + 6} y={todayMarker.cy - 5} fontSize={9} fill="#f59e0b" fontWeight="bold">
                                        {todayMarker.pct?.toFixed(1)}%
                                    </text>
                                </>
                            )}
                        </g>
                    )}

                    {/* S-커브 레이블 */}
                    <text x={PAD_LEFT + 4} y={PAD_TOP + 11} fontSize={9} fill="#3b82f6" opacity={0.7} fontWeight="bold">
                        S-커브
                    </text>
                </svg>
            )}
        </div>
    );
}
