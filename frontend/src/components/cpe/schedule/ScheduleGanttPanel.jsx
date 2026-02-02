import React from "react";
import GanttChart from "../GanttChart";
import AiLogPanel from "./AiLogPanel";

export default function ScheduleGanttPanel({
    items,
    links,
    startDate,
    onResize,
    onSmartResize,
    aiPreviewItems,
    aiOriginalItems,
    aiActiveItemId,
    aiMode,
    aiLogs,
    aiSummary,
    aiShowCompare,
    onToggleCompare,
    onApply,
    subTasks,
    onCreateSubtask,
    onUpdateSubtask,
    onDeleteSubtask
}) {
    return (
        <div className="flex-1 min-h-0 flex gap-4">
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
                />
            </div>
            {(aiMode !== "idle" || aiLogs.length > 0) && (
                <AiLogPanel
                    aiMode={aiMode}
                    aiLogs={aiLogs}
                    aiSummary={aiSummary}
                    aiPreviewItems={aiPreviewItems}
                    aiOriginalItems={aiOriginalItems}
                    aiShowCompare={aiShowCompare}
                    onToggleCompare={onToggleCompare}
                    onApply={onApply}
                />
            )}
        </div>
    );
}
