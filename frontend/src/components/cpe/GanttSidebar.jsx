import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Layers, FileText, Clock } from "lucide-react";

const GanttSidebar = ({ groupedItems, expandedCategories, setExpandedCategories, selectedItemIds, onItemClick, containerRef, aiPreviewItems, aiOriginalItems, aiActiveItemId }) => {
    const aiPreviewMap = React.useMemo(() => {
        if (!aiPreviewItems || !aiOriginalItems) return new Map();
        const originalMap = new Map(aiOriginalItems.map(item => [item.id, item]));
        const map = new Map();
        aiPreviewItems.forEach(item => {
            const original = originalMap.get(item.id);
            if (!original) return;
            const crewDiff = (parseFloat(item.crew_size) || 0) - (parseFloat(original.crew_size) || 0);
            const prodDiff = (parseFloat(item.productivity) || 0) - (parseFloat(original.productivity) || 0);
            const daysDiff = (parseFloat(item.calendar_days) || 0) - (parseFloat(original.calendar_days) || 0);
            if (Math.abs(crewDiff) > 0.01 || Math.abs(prodDiff) > 0.01 || Math.abs(daysDiff) > 0.01) {
                map.set(item.id, { crewDiff, prodDiff, daysDiff });
            }
        });
        return map;
    }, [aiPreviewItems, aiOriginalItems]);

    const [isScrolling, setIsScrolling] = useState(false);

    const handleScroll = useCallback(() => {
        setIsScrolling(true);
        clearTimeout(window.ganttSidebarScrollTimeout);
        window.ganttSidebarScrollTimeout = setTimeout(() => {
            setIsScrolling(false);
        }, 1000);
    }, []);

    return (
        <div
            ref={containerRef}
            className={`scroll-container w-80 h-full border-r border-gray-200 bg-white flex-shrink-0 overflow-y-auto font-sans scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent ${isScrolling ? 'scrolling' : ''}`}
            onScroll={handleScroll}
        >
            {/* Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-200 px-4 py-3 z-[2] shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Layers size={16} className="text-blue-600" />
                    <span className="text-sm font-bold text-slate-700 uppercase tracking-widest">Project Tasks</span>
                </div>
                <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                    {groupedItems.length} Categories
                </span>
            </div>

            {/* Content */}
            <div className="pb-10">
                {groupedItems.map((categoryGroup, catIdx) => {
                    const isCategoryExpanded = expandedCategories[catIdx] !== false;
                    const duration = Math.max(0, categoryGroup.maxEnd - categoryGroup.minStart);
                    const months = (duration / 30).toFixed(1);

                    return (
                        <div key={catIdx} className="border-b border-gray-50 last:border-0">
                            {/* Category Header */}
                            <div
                                className={`group flex items-center px-4 py-3 cursor-pointer transition-all duration-200 select-none
                                    ${isCategoryExpanded ? 'bg-slate-50' : 'hover:bg-gray-50 bg-white'}
                                `}
                                onClick={() => setExpandedCategories(prev => ({ ...prev, [catIdx]: !isCategoryExpanded }))}
                            >
                                <div className={`mr-3 transition-transform duration-200 ${isCategoryExpanded ? 'rotate-90' : 'rotate-0'}`}>
                                    <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-500" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3 className={`text-lg font-bold truncate transition-colors ${isCategoryExpanded ? 'text-slate-800' : 'text-slate-600'}`}>
                                        {categoryGroup.mainCategory}
                                    </h3>
                                    {!isCategoryExpanded && (
                                        <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"></span>
                                            {categoryGroup.processes.length} Processes
                                        </div>
                                    )}
                                </div>

                                <div className="text-right flex-shrink-0 ml-3 flex flex-col items-end">
                                    <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-md px-2 py-1 shadow-sm">
                                        <Clock size={12} className="text-blue-500" />
                                        <span className="text-xs font-bold text-slate-700">{duration.toFixed(0)}d</span>
                                    </div>
                                    {isCategoryExpanded && <span className="text-[10px] text-gray-400 mt-1 font-medium">{months} mo</span>}
                                </div>
                            </div>

                            {/* Processes & Items (Accordion Body) */}
                            <AnimatePresence initial={false}>
                                {isCategoryExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2, ease: "easeInOut" }}
                                        className="overflow-hidden bg-gray-50/30"
                                    >
                                        {categoryGroup.processes.map((processGroup, procIdx) => (
                                            <div key={procIdx} className="relative">
                                                {/* Vertical Line for Tree Structure */}
                                                <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-200" />

                                                {processGroup.items.map((item, itemIdx) => {
                                                    const calendarDays = item.calendar_days || item.durationDays || 0;
                                                    const isSelected = Array.isArray(selectedItemIds) && selectedItemIds.includes(item.id);
                                                    const aiPreview = aiPreviewMap.get(item.id);
                                                    const isAiActive = aiActiveItemId === item.id;

                                                    return (
                                                        <motion.div
                                                            key={item.id}
                                                            layout
                                                            initial={{ opacity: 0, x: -10 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: itemIdx * 0.03 }}
                                                            id={`sidebar-item-${item.id}`} // For scroll targeting
                                                            onClick={(event) => onItemClick && onItemClick(item.id, 'sidebar', event)}
                                                            className={`relative flex items-center pl-10 pr-4 py-3 cursor-pointer border-l-[3px] transition-all duration-200
                                                                ${isSelected
                                                                    ? 'bg-blue-50/60 border-l-blue-600 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)]'
                                                                    : 'border-l-transparent hover:bg-slate-100/80 hover:border-l-gray-300'
                                                                }
                                                            `}
                                                            style={{ height: '60px' }}
                                                        >
                                                            {/* Horizontal Connector Line */}
                                                            <div className="absolute left-6 top-1/2 w-3 h-px bg-gray-200" />

                                                            <div className="flex-1 min-w-0 pr-3">
                                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                                    <FileText size={12} className={isSelected ? 'text-blue-500' : 'text-gray-400'} />
                                                                    <div className={`text-xs font-semibold truncate transition-colors ${isSelected ? 'text-blue-900' : 'text-slate-500'}`}>
                                                                        {item.process}
                                                                    </div>
                                                                    {aiPreview && (
                                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${isAiActive ? 'border-blue-500 text-blue-600' : 'border-gray-300 text-gray-500'}`}>
                                                                            AI
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className={`text-base font-bold truncate ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                                                                    {item.work_type}
                                                                </div>
                                                            </div>

                                                            <div className="text-right flex-shrink-0">
                                                                <div className={`text-xs font-mono font-bold ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
                                                                    {calendarDays.toFixed(1)}
                                                                </div>
                                                                <div className="text-[10px] text-gray-400">days</div>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                        <div className="h-2"></div> {/* Spacing at bottom of group */}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default GanttSidebar;
