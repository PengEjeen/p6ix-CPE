import React, { useEffect, useRef } from "react";

export default function SubtaskNameModal({ isOpen, value, onChange, onClose, onSubmit }) {
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[13000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-[420px] max-w-[90vw] rounded-2xl border border-gray-700 bg-[#2c2c3a] shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-700 bg-[#3a3a4a]">
                    <h3 className="text-lg font-semibold text-gray-100">부공종 이름 수정</h3>
                </div>
                <div className="px-6 py-6">
                    <input
                        ref={inputRef}
                        className="w-full bg-[#1f1f2b] border border-gray-600 text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") onSubmit();
                            if (e.key === "Escape") onClose();
                        }}
                    />
                </div>
                <div className="px-6 py-4 flex justify-end gap-2 border-t border-gray-700 bg-[#2c2c3a]">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-600 text-gray-200 hover:bg-[#3a3a4a] transition"
                    >
                        취소
                    </button>
                    <button
                        onClick={onSubmit}
                        className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition"
                    >
                        적용
                    </button>
                </div>
            </div>
        </div>
    );
}
