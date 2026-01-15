import React from "react";

const GanttSidebar = ({ groupedItems, expandedCategories, setExpandedCategories }) => {
    return (
        <div className="w-80 border-r border-gray-200 bg-white flex-shrink-0 overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-3 py-2 z-10">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">작업 목록</span>
            </div>

            {/* Content */}
            {groupedItems.map((categoryGroup, catIdx) => {
                const isCategoryExpanded = expandedCategories[catIdx] !== false;

                const duration = Math.max(0, categoryGroup.maxEnd - categoryGroup.minStart);
                const months = (duration / 30).toFixed(1);

                return (
                    <div key={catIdx}>
                        <div
                            className="flex items-center px-3 py-2 bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-300 cursor-pointer"
                            onClick={() => setExpandedCategories(prev => ({ ...prev, [catIdx]: !isCategoryExpanded }))}
                        >
                            <span className="mr-2 text-gray-400 text-xs">{isCategoryExpanded ? '▼' : '▶'}</span>
                            <div className="w-1 h-5 bg-blue-500 rounded-full mr-2"></div>
                            <h3 className="font-bold text-gray-800 text-sm flex-1">{categoryGroup.mainCategory}</h3>
                            <div className="text-right flex-shrink-0 ml-2">
                                <div className="text-[10px] font-bold text-slate-600">{duration.toFixed(0)}일</div>
                                <div className="text-[9px] text-gray-400 font-medium">({months}개월)</div>
                            </div>
                        </div>
                        {isCategoryExpanded && categoryGroup.processes.map((processGroup, procIdx) => (
                            <div key={procIdx}>
                                {processGroup.items.map((item) => {
                                    const calendarDays = item.calendar_days || item.durationDays || 0;
                                    const months = (calendarDays / 30).toFixed(1);
                                    return (
                                        <div
                                            key={item.id}
                                            className="flex items-center px-3 py-2 hover:bg-blue-50/50 border-b border-gray-100 transition-colors"
                                            style={{ height: '44px' }}
                                        >
                                            <div className="flex-1 min-w-0 pr-2">
                                                <div className="text-[11px] font-medium text-gray-800 truncate">{item.work_type}</div>
                                                <div className="text-[10px] text-gray-500 truncate">{item.process}</div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <div className="text-[10px] font-medium text-gray-700 whitespace-nowrap">{calendarDays.toFixed(1)}일</div>
                                                <div className="text-[9px] text-gray-400 whitespace-nowrap">{months}개월</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
};

export default GanttSidebar;
