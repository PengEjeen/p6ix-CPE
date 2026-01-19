import React from "react";

export default function ConfirmModal({
    isOpen,
    title,
    message,
    confirmText,
    cancelText,
    showCancel,
    onConfirm,
    onCancel
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/55 backdrop-blur-sm">
            <div className="w-[420px] max-w-[90vw] rounded-2xl border border-gray-700 bg-[#2c2c3a] shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-700 bg-[#3a3a4a]">
                    <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
                </div>
                <div className="px-6 py-6 text-sm text-gray-300 whitespace-pre-line leading-relaxed">
                    {message}
                </div>
                <div className="px-6 py-4 flex justify-end gap-2 border-t border-gray-700 bg-[#2c2c3a]">
                    {showCancel && (
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-600 text-gray-200 hover:bg-[#3a3a4a] transition"
                        >
                            {cancelText || "취소"}
                        </button>
                    )}
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition"
                    >
                        {confirmText || "확인"}
                    </button>
                </div>
            </div>
        </div>
    );
}
