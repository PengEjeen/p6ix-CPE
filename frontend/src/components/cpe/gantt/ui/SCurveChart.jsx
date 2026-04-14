import React, { useMemo } from "react";

const PAD = { top: 16, right: 16, bottom: 40, left: 40 };

/**
 * S-커브 차트 (순수 SVG)
 * @param {object[]} monthlyData  - [{ label, pct, cumulative, working }]
 * @param {number}   todayPct     - 오늘까지 누적 %
 * @param {string}   todayLabel   - 오늘이 속한 월 label
 * @param {number}   width        - 컨테이너 너비 (px)
 * @param {number}   height       - 컨테이너 높이 (px)
 */
export default function SCurveChart({ monthlyData, todayPct, todayLabel, width = 300, height = 220 }) {
    const W = width  - PAD.left - PAD.right;
    const H = height - PAD.top  - PAD.bottom;

    const n = monthlyData.length;

    // x: 0 ~ W  (월 인덱스)
    // y: H ~ 0  (0% ~ 100%)
    const xOf = (i) => n <= 1 ? W / 2 : (i / (n - 1)) * W;
    const yOf = (pct) => H - (pct / 100) * H;

    // 곡선 path (cubic bezier smooth)
    const linePath = useMemo(() => {
        if (!monthlyData.length) return "";
        const pts = monthlyData.map((d, i) => [xOf(i), yOf(d.pct)]);
        if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;

        let d = `M ${pts[0][0]} ${pts[0][1]}`;
        for (let i = 1; i < pts.length; i++) {
            const [x0, y0] = pts[i - 1];
            const [x1, y1] = pts[i];
            const cpx = (x0 + x1) / 2;
            d += ` C ${cpx} ${y0} ${cpx} ${y1} ${x1} ${y1}`;
        }
        return d;
    }, [monthlyData, W, H]);

    // X축 레이블: 최대 8개 표시
    const xLabels = useMemo(() => {
        if (!n) return [];
        const step = Math.max(1, Math.ceil(n / 8));
        return monthlyData
            .filter((_, i) => i % step === 0 || i === n - 1)
            .map((d, _, arr) => {
                const i = monthlyData.indexOf(d);
                return { x: xOf(i), label: d.label };
            });
    }, [monthlyData, W]);

    // Y축 눈금: 0, 25, 50, 75, 100
    const yTicks = [0, 25, 50, 75, 100];

    // 오늘 마커 x 위치
    const todayIdx = monthlyData.findIndex((d) => d.label === todayLabel);
    const todayX   = todayIdx >= 0 ? xOf(todayIdx) : null;
    const todayY   = todayPct != null ? yOf(todayPct) : null;

    return (
        <svg width={width} height={height} className="overflow-visible">
            <defs>
                <clipPath id="scurve-clip">
                    <rect x="0" y="0" width={W} height={H} />
                </clipPath>
            </defs>

            <g transform={`translate(${PAD.left},${PAD.top})`}>
                {/* Y축 그리드 + 레이블 */}
                {yTicks.map((t) => (
                    <g key={t}>
                        <line x1={0} y1={yOf(t)} x2={W} y2={yOf(t)} stroke="#334155" strokeWidth={0.5} strokeDasharray={t === 0 ? "0" : "3 3"} />
                        <text x={-6} y={yOf(t)} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#64748b">
                            {t}%
                        </text>
                    </g>
                ))}

                {/* S 커브 선 */}
                {linePath && (
                    <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" clipPath="url(#scurve-clip)" />
                )}

                {/* 오늘 마커 */}
                {todayX != null && todayY != null && (
                    <g>
                        <line x1={todayX} y1={0} x2={todayX} y2={H} stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 2" />
                        <circle cx={todayX} cy={todayY} r={4} fill="#f59e0b" stroke="#1e293b" strokeWidth={1.5} />
                        <text x={todayX + 5} y={todayY - 6} fontSize={9} fill="#f59e0b" fontWeight="bold">
                            {todayPct?.toFixed(1)}%
                        </text>
                    </g>
                )}

                {/* 데이터 포인트 */}
                {monthlyData.map((d, i) => (
                    <circle key={i} cx={xOf(i)} cy={yOf(d.pct)} r={2} fill="#3b82f6" opacity={0.7} />
                ))}

                {/* X축 */}
                <line x1={0} y1={H} x2={W} y2={H} stroke="#475569" strokeWidth={1} />

                {/* X축 레이블 */}
                {xLabels.map(({ x, label }) => (
                    <text key={label} x={x} y={H + 12} textAnchor="middle" fontSize={8} fill="#64748b">
                        {label}
                    </text>
                ))}

                {/* 100% 도달 표시 */}
                {monthlyData.length > 0 && monthlyData[monthlyData.length - 1].pct >= 99.9 && (
                    <text x={xOf(n - 1)} y={yOf(100) - 6} textAnchor="middle" fontSize={9} fill="#22c55e" fontWeight="bold">
                        100%
                    </text>
                )}
            </g>
        </svg>
    );
}
