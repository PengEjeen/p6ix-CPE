import React from "react";
import { RefreshCw, Plus, SlidersHorizontal } from "lucide-react";

export default function TableToolbarRow({ colSpan, onImport, onAdd, onEvidence, className = "" }) {
    return (
        <tr className={`bg-[var(--navy-bg)] border-b border-[var(--navy-border-soft)] ${className}`}>
            <td colSpan={colSpan} className="px-4 py-2">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        data-tutorial="standard-import"
                        onClick={onImport}
                        className="ui-btn-secondary text-sm inline-flex items-center gap-1.5"
                    >
                        <RefreshCw size={14} />
                        표준품셈 선택
                    </button>
                    <button
                        data-tutorial="add-schedule"
                        onClick={onAdd}
                        className="ui-btn-primary text-sm inline-flex items-center gap-1.5"
                    >
                        <Plus size={14} />
                        항목 추가
                    </button>
                    <button
                        onClick={onEvidence}
                        className="ui-btn-outline text-sm inline-flex items-center gap-1.5"
                    >
                        <SlidersHorizontal size={14} />
                        근거 데이터 반영
                    </button>
                </div>
            </td>
        </tr>
    );
}
