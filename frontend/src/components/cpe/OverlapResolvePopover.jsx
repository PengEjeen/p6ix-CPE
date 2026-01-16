import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

const OverlapResolvePopover = ({ data, onClose, onSelectCurrentAsCP, onSelectOtherAsCP }) => {
    if (!data || !data.visible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed z-[200] w-96 bg-white/90 backdrop-blur-xl border border-amber-100 rounded-2xl shadow-2xl overflow-hidden font-sans"
                style={{ left: data.x || window.innerWidth / 2 - 192, top: data.y || window.innerHeight / 2 - 100 }}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 border-b border-amber-200 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-amber-700">
                        <AlertTriangle size={18} className="text-amber-600" />
                        <span className="font-bold text-sm tracking-wider">⚠️ 작업 겹침 감지</span>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={14} />
                    </button>
                </div>

                <div className="p-4">
                    {/* Overlap Info */}
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="text-xs font-bold text-amber-900 mb-2">
                            작업이 {data.overlapDays.toFixed(1)}일 겹칩니다
                        </div>
                        <div className="text-[11px] text-amber-700 mb-1">
                            <strong>이동한 작업:</strong> {data.currentTask.name}
                        </div>
                        <div className="text-[11px] text-amber-700">
                            <strong>겹친 작업:</strong> {data.overlappingTask.name}
                        </div>
                    </div>

                    {/* CP Selection */}
                    <div className="space-y-2">
                        <div className="text-xs font-bold text-gray-700 mb-2">
                            어느 작업을 Critical Path로 설정하시겠습니까?
                        </div>

                        {/* Option 1: Current task is CP (red) */}
                        <button
                            className="w-full p-3 rounded-lg border-2 border-red-300 bg-red-50 hover:bg-red-100 transition-all text-left"
                            onClick={onSelectCurrentAsCP}
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-red-600 rounded-full"></div>
                                <div className="flex-1">
                                    <div className="text-xs font-bold text-red-900">
                                        "{data.currentTask.name}" 우선 (CP)
                                    </div>
                                    <div className="text-[10px] text-red-700 mt-0.5">
                                        → 이동한 작업이 <strong>빨강(Critical Path)</strong>
                                        <br />
                                        → 겹친 작업이 <strong>회색(병행)</strong>
                                    </div>
                                </div>
                            </div>
                        </button>

                        {/* Option 2: Overlapping task is CP (red) */}
                        <button
                            className="w-full p-3 rounded-lg border-2 border-slate-300 bg-slate-50 hover:bg-slate-100 transition-all text-left"
                            onClick={onSelectOtherAsCP}
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-slate-400 rounded-full"></div>
                                <div className="flex-1">
                                    <div className="text-xs font-bold text-slate-900">
                                        "{data.overlappingTask.name}" 우선 (CP)
                                    </div>
                                    <div className="text-[10px] text-slate-700 mt-0.5">
                                        → 겹친 작업이 <strong>빨강(Critical Path)</strong>
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
