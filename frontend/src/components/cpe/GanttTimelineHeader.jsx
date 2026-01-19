import React from "react";

const GanttTimelineHeader = ({ timeline, pixelsPerUnit, dateScale }) => {
    let lastYearLabel = null;
    return (
        <div className="sticky top-0 z-[2] bg-white/95 backdrop-blur shadow-sm border-b border-gray-100">
            {/* Months */}
            <div className="flex border-b border-gray-100">
                {timeline.months.map(m => {
                    let label = m.label;
                    if (dateScale >= 30) {
                        const year = m.label.split(".")[0];
                        label = year !== lastYearLabel ? year : "";
                        lastYearLabel = year;
                    }
                    return (
                        <div
                            key={m.key}
                            style={{ width: m.count * pixelsPerUnit }}
                            className={`py-2 text-xs font-bold text-slate-500 text-center border-r border-gray-200 ${dateScale >= 30 ? "tracking-wider" : ""}`}
                        >
                            {label}
                        </div>
                    );
                })}
            </div>
            {/* Days */}
            <div className="flex relative">
                {timeline.days.map((d, i) => (
                    <div key={i} style={{ width: pixelsPerUnit }} className="py-1 text-[10px] text-gray-400 text-center border-r border-gray-200">
                        {d.dayOfMonth.replace('일', '')}
                    </div>
                ))}

            </div>
        </div>
    );
};

export default GanttTimelineHeader;
