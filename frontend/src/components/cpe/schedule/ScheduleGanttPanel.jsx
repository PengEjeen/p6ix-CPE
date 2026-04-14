import React from "react";
import GanttChart from "../GanttChart";

export default function ScheduleGanttPanel({
    items,
    links,
    startDate,
    onResize,
    onSmartResize,
    subTasks,
    onCreateSubtask,
    onUpdateSubtask,
    onDeleteSubtask,
    readOnly = false,
    monthlyData = [],
    totalWorking = 0,
}) {
    return (
        <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-gray-700 bg-[#2c2c3a] p-3 shadow-lg">
            <GanttChart
                items={items}
                links={links}
                startDate={startDate}
                onResize={onResize}
                onSmartResize={onSmartResize}
                subTasks={subTasks}
                onCreateSubtask={onCreateSubtask}
                onUpdateSubtask={onUpdateSubtask}
                onDeleteSubtask={onDeleteSubtask}
                readOnly={readOnly}
                monthlyData={monthlyData}
                totalWorking={totalWorking}
            />
        </div>
    );
}
