import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Users, ArrowRight, Zap } from "lucide-react";

const ContextualBrainPopover = ({ data, onClose, onApplyCrewAdjustment, onApplyProdAdjustment }) => {
    if (!data || !data.visible) return null;

    const savedDays = data.oldDuration - data.newDuration;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed z-[200] w-[28rem] bg-white/90 backdrop-blur-xl border border-violet-100 rounded-2xl shadow-2xl overflow-hidden font-sans"
                style={{ left: data.x - 448 > 0 ? data.x - 448 : data.x + 20, top: data.y - 10 }} // Simple smart positioning
            >
                {/* Sleek Header */}
                <div className="bg-gradient-to-r from-violet-50 to-indigo-50 px-6 py-5 border-b border-violet-100 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-violet-700">
                        <Sparkles size={20} className="text-violet-500 fill-violet-200" />
                        <span className="font-bold text-base tracking-wider uppercase">AI 분석</span>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-6">
                    <div className="text-base text-gray-700 mb-5">
                        공사기간이 <strong className="text-gray-900">{Math.abs(savedDays).toFixed(1)}일</strong> {savedDays > 0 ? '단축' : '연장'}되었습니다.
                        <br />작업 조건을 어떻게 변경하시겠습니까?
                    </div>

                    <div className="space-y-2">
                        {/* Option 1: Adjust Crew (Keep Workload, Change Crew) */}
                        <button
                            className="w-full group relative flex items-center justify-between p-5 rounded-2xl border border-violet-200 bg-violet-50 hover:bg-violet-100 transition-all text-left"
                            onClick={() => onApplyCrewAdjustment(data.item.id, data.newDuration)}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-violet-200 rounded-xl text-violet-700 group-hover:scale-110 transition-transform">
                                    <Users size={20} />
                                </div>
                                <div>
                                    <div className="text-base font-bold text-violet-900">인원(Crew) 조정</div>
                                    <div className="text-sm text-violet-600">작업량 유지, 인원을 변경하여 기간 맞춤</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-gray-500 line-through">{parseFloat(data.item.crew_size || 0).toFixed(1)}</div>
                                    <div className="text-lg font-bold text-violet-600">{data.impact?.crew}명</div>
                                </div>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-1/2 -translate-y-1/2">
                                <ArrowRight size={18} className="text-violet-500" />
                            </div>
                        </button>

                        {/* Option 2: Adjust Productivity (Keep Crew, Change Prod) */}
                        <button
                            className="w-full group relative flex items-center justify-between p-5 rounded-2xl border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-all text-left"
                            onClick={() => onApplyProdAdjustment(data.item.id, data.newDuration)}
                        >
                            <div className="flex items-center gap-3 w-full">
                                <div className="p-3 bg-blue-200 rounded-xl text-blue-700 group-hover:scale-110 transition-transform shrink-0">
                                    <Zap size={20} />
                                </div>
                                <div className="flex-1">
                                    <div className="text-base font-bold text-blue-900">생산성(Productivity) 조정</div>
                                    <div className="text-sm text-blue-600">인원 유지, 생산성을 변경하여 기간 맞춤</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-gray-500 line-through">{parseFloat(data.item.productivity || 0).toFixed(1)}</div>
                                    <div className="text-lg font-bold text-blue-600">{data.impact?.prod}</div>
                                </div>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-1/2 -translate-y-1/2">
                                <ArrowRight size={18} className="text-blue-500" />
                            </div>
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ContextualBrainPopover;
