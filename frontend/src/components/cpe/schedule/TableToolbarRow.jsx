import React from "react";
import { RefreshCw, Plus, SlidersHorizontal } from "lucide-react";

export default function TableToolbarRow({ colSpan, onImport, onAdd, onEvidence, className = "" }) {
    return (
        <tr className={`bg-[#1f1f2b] border-b border-gray-700 ${className}`}>
            <td colSpan={colSpan} className="px-4 py-2">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={onImport}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2c2c3a] hover:bg-[#38384a] text-gray-200 rounded-lg text-sm font-semibold border border-gray-700 transition"
                    >
                        <RefreshCw size={14} />
                        표준품셈 선택
                    </button>
                    <button
                        onClick={onAdd}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition"
                    >
                        <Plus size={14} />
                        항목 추가
                    </button>
                    <button
                        onClick={onEvidence}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2c2c3a] hover:bg-[#38384a] text-blue-200 rounded-lg text-sm font-semibold border border-blue-600/50 transition"
                    >
                        <SlidersHorizontal size={14} />
                        근거 데이터 반영
                    </button>
                </div>
            </td>
        </tr>
    );
}
