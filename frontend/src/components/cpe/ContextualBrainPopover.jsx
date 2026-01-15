import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Users, ArrowRight, Zap } from "lucide-react";

const ContextualBrainPopover = ({ data, onClose, onApplyCrewAdjustment }) => {
    if (!data || !data.visible) return null;

    const savedDays = data.oldDuration - data.newDuration;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed z-[200] w-80 bg-white/90 backdrop-blur-xl border border-violet-100 rounded-2xl shadow-2xl overflow-hidden font-sans"
                style={{ left: data.x - 300 > 0 ? data.x - 300 : data.x + 20, top: data.y - 10 }} // Simple smart positioning
            >
                {/* Sleek Header */}
                <div className="bg-gradient-to-r from-violet-50 to-indigo-50 px-4 py-3 border-b border-violet-100 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-violet-700">
                        <Sparkles size={16} className="text-violet-500 fill-violet-200" />
                        <span className="font-bold text-xs tracking-wider uppercase">AI 분석</span>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={14} />
                    </button>
                </div>

                <div className="p-4">
                    <div className="text-sm text-gray-700 mb-3">
                        공사기간이 <strong className="text-gray-900">{savedDays.toFixed(1)}일</strong> 단축되었습니다.
                        <br />작업량을 어떻게 조정하시겠습니까?
                    </div>

                    <div className="space-y-2">
                        {/* Primary Option: Increase Crew */}
                        <button
                            className="w-full group relative flex items-center justify-between p-3 rounded-xl border border-violet-200 bg-violet-50 hover:bg-violet-100 transition-all text-left"
                            onClick={() => onApplyCrewAdjustment(data.item.id, data.newDuration)}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-violet-200 rounded-lg text-violet-700 group-hover:scale-110 transition-transform">
                                    <Users size={16} />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-violet-900">인원(Crew) 충원</div>
                                    <div className="text-[10px] text-violet-600">목표 기간에 맞춰 필요 인원 자동 계산</div>
                                </div>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <ArrowRight size={14} className="text-violet-500" />
                            </div>
                        </button>

                        {/* Secondary Option: Overtime (Mock) */}
                        <button className="w-full group flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-all text-left">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 rounded-lg text-gray-500">
                                    <Zap size={16} />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-gray-700">생산성 조정</div>
                                    <div className="text-[10px] text-gray-500">작업 효율 증가 가정 (야근/특근)</div>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ContextualBrainPopover;
