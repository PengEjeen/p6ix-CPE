import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, ChevronDown, ChevronUp } from "lucide-react";

const OverlapResolvePopover = ({ data, onClose, onSelectCurrentAsCP, onSelectOtherAsCP }) => {
    const [showDetails, setShowDetails] = React.useState(false);

    if (!data || !data.visible) return null;

    // Support both old single-overlap and new multi-overlap formats
    const isMultiOverlap = data.overlappingTasks && Array.isArray(data.overlappingTasks);
    const overlappingTasks = isMultiOverlap ? data.overlappingTasks : (data.overlappingTask ? [data.overlappingTask] : []);
    const totalOverlaps = data.totalOverlaps || overlappingTasks.length;

    // For backward compatibility with single overlap
    const firstOverlap = overlappingTasks[0];

    return (
        <AnimatePresence>
            <motion.div
                key="overlap-popover"
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed z-[200] w-[36rem] bg-white/90 backdrop-blur-xl border border-amber-100 rounded-2xl shadow-2xl overflow-hidden font-sans"
                style={{ left: data.x || window.innerWidth / 2 - 288, top: data.y || window.innerHeight / 2 - 200 }}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-5 border-b border-amber-200 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-amber-700">
                        <AlertTriangle size={22} className="text-amber-600" />
                        <span className="font-bold text-lg tracking-wider">
                            {totalOverlaps > 1 ? '다중 겹침 감지' : '작업 겹침 감지'}
                        </span>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-6">
                    {/* Overlap Info */}
                    <div className="mb-4 p-5 bg-amber-50 border border-amber-200 rounded-2xl">
                        <div className="text-base font-bold text-amber-900 mb-2">
                            {totalOverlaps > 1 ? (
                                <>작업이 <span className="text-red-600">{totalOverlaps}개</span>의 다른 작업과 겹칩니다</>
                            ) : (
                                <>작업이 {(firstOverlap?.overlapDays || 0).toFixed(1)}일 겹칩니다</>
                            )}
                        </div>
                        <div className="text-sm text-amber-700 mb-1">
                            <strong>이동한 작업:</strong> {data.currentTask.name}
                        </div>

                        {totalOverlaps > 1 ? (
                            <>
                                <button
                                    onClick={() => setShowDetails(!showDetails)}
                                    className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-800 font-medium mt-2"
                                >
                                    {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    {showDetails ? '목록 숨기기' : '겹친 작업 목록 보기'}
                                </button>

                                <AnimatePresence>
                                    {showDetails && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="mt-3 space-y-2 overflow-hidden"
                                        >
                                            {overlappingTasks.map((task, idx) => (
                                                <div key={idx} className="text-sm text-amber-700 pl-4 border-l-2 border-amber-300">
                                                    <strong>#{idx + 1}:</strong> {task.name}
                                                    <span className="text-amber-600 ml-2">({task.overlapDays.toFixed(1)}일)</span>
                                                </div>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </>
                        ) : (
                            <div className="text-sm text-amber-700">
                                <strong>겹친 작업:</strong> {firstOverlap?.name}
                            </div>
                        )}
                    </div>

                    {/* CP Selection */}
                    <div className="space-y-2">
                        <div className="text-base font-bold text-gray-700 mb-3">
                            {totalOverlaps > 1
                                ? '어느 작업을 Critical Path로 설정하시겠습니까?'
                                : '어느 작업을 Critical Path로 설정하시겠습니까?'}
                        </div>

                        {/* Option 1: Current task is CP (red) */}
                        <button
                            className="w-full p-5 rounded-2xl border-2 border-red-300 bg-red-50 hover:bg-red-100 transition-all text-left"
                            onClick={onSelectCurrentAsCP}
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 bg-red-600 rounded-full"></div>
                                <div className="flex-1">
                                    <div className="text-base font-bold text-red-900">
                                        "{data.currentTask.name}" 우선 (CP)
                                    </div>
                                    <div className="text-sm text-red-700 mt-1">
                                        → 이동한 작업이 <strong>빨강(Critical Path)</strong>
                                        <br />
                                        → {totalOverlaps > 1 ? `${totalOverlaps}개의 겹친 작업이` : '겹친 작업이'} <strong>회색(병행)</strong>
                                    </div>
                                </div>
                            </div>
                        </button>

                        {/* Option 2: Overlapping task(s) is/are CP (red) */}
                        <button
                            className="w-full p-5 rounded-2xl border-2 border-slate-300 bg-slate-50 hover:bg-slate-100 transition-all text-left"
                            onClick={onSelectOtherAsCP}
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 bg-slate-400 rounded-full"></div>
                                <div className="flex-1">
                                    <div className="text-base font-bold text-slate-900">
                                        {totalOverlaps > 1 ? '기존 작업들 우선 (CP)' : `"${firstOverlap?.name}" 우선 (CP)`}
                                    </div>
                                    <div className="text-sm text-slate-700 mt-1">
                                        → {totalOverlaps > 1 ? `${totalOverlaps}개의 겹친 작업이` : '겹친 작업이'} <strong>빨강(Critical Path)</strong>
                                        <br />
                                        → 이동한 작업이 <strong>회색(병행)</strong>
                                    </div>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default OverlapResolvePopover;
