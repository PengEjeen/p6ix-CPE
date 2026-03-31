import React from "react";
import GanttChart from "../GanttChart";

export default function ScheduleGanttPanel({
    items,
    links,
    startDate,
    onResize,
    onSmartResize,
    aiPreviewItems,
    aiOriginalItems,
    aiActiveItemId,
    subTasks,
    onCreateSubtask,
    onUpdateSubtask,
    onDeleteSubtask,
    readOnly = false
}) {
    return (
        <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-gray-700 bg-[#2c2c3a] p-3 shadow-lg">
            <GanttChart
                items={items}
                links={links}
                startDate={startDate}
                onResize={onResize}
                onSmartResize={onSmartResize}
                aiPreviewItems={aiPreviewItems}
                aiOriginalItems={aiOriginalItems}
                aiActiveItemId={aiActiveItemId}
                subTasks={subTasks}
                onCreateSubtask={onCreateSubtask}
                onUpdateSubtask={onUpdateSubtask}
                onDeleteSubtask={onDeleteSubtask}
                readOnly={readOnly}
            />
        </div>
    );
}
