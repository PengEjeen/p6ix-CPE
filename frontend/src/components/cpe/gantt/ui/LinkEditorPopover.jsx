import React from "react";

const LINK_TYPES = ["FS", "SS", "FF", "SF"];

export default function LinkEditorPopover({ linkEditor, links, updateLink, deleteLink, onClose }) {
    if (!linkEditor) return null;
    const currentLink = (links || []).find(l => l.id === linkEditor.id);

    return (
        <div
            className="fixed z-[120] rounded-2xl p-6 w-80 backdrop-blur-xl border border-amber-300/40 shadow-[0_20px_60px_rgba(15,23,42,0.35)] bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-slate-800/95"
            style={{ left: linkEditor.x + 12, top: linkEditor.y + 12 }}
        >
            <div className="flex items-center justify-between mb-3">
                <div className="text-[12px] uppercase tracking-[0.2em] text-amber-300/80 font-semibold">Link Editor</div>
                <div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]"></div>
            </div>
            <div className="space-y-3">
                <div>
                    <label className="block text-[12px] text-slate-300 mb-1">유형</label>
                    <div className="grid grid-cols-4 gap-1 bg-slate-900/60 rounded-full p-1 border border-slate-700/60">
                        {LINK_TYPES.map((type) => {
                            const isActive = currentLink?.type === type;
                            return (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => updateLink(linkEditor.id, { type })}
                                    className={`text-[12px] py-1.5 rounded-full transition-all ${isActive
                                        ? "bg-amber-400 text-slate-900 font-bold shadow-[0_0_10px_rgba(251,191,36,0.45)]"
                                        : "text-slate-300 hover:text-white"
                                        }`}
                                >
                                    {type}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div>
                    <label className="block text-[12px] text-slate-300 mb-1">Lag(일)</label>
                    <div className="flex items-center gap-2">
                        <input
                            className="w-full bg-slate-900/70 border border-slate-700/60 rounded-lg px-3 py-2.5 text-base text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                            type="number"
                            value={currentLink?.lag ?? 0}
                            onChange={(e) => updateLink(linkEditor.id, { lag: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="text-[12px] text-slate-400">d</span>
                    </div>
                </div>
            </div>
            <div className="flex justify-between mt-4">
                <button
                    type="button"
                    className="text-[13px] text-rose-300 hover:text-rose-200 font-semibold"
                    onClick={() => {
                        deleteLink(linkEditor.id);
                        onClose();
                    }}
                >
                    삭제
                </button>
                <button
                    type="button"
                    className="text-[13px] text-slate-300 hover:text-white font-semibold"
                    onClick={onClose}
                >
                    닫기
                </button>
            </div>
        </div>
    );
}
