import React from "react";

export default function EditableTable({
    data,
    columns,
    onRowChange,
    onSaveRow,
    customThead,
    loading = false
}) {
    if (loading) return <div className="text-white p-4">Loading...</div>;

    const inputClass = "bg-transparent w-full text-center focus:outline-none focus:bg-gray-700/50 rounded py-1 text-white transition-colors duration-200 no-spin";

    const handleKeyDown = (e, id) => {
        if (e.key === 'Enter') {
            e.target.blur(); // Trigger onBlur
        }
    };

    return (
        <div className="bg-[#27293d] p-4 rounded-lg shadow-lg overflow-x-auto">
            <table className="w-full text-center border-collapse border border-gray-600 text-sm">
                {customThead ? customThead : (
                    <thead className="bg-[#3b3b4f] text-gray-200">
                        <tr>
                            {columns.map((col) => (
                                <th key={col.key} className="border border-gray-600 p-2">
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                )}

                <tbody>
                    {data.map((row) => (
                        <tr key={row.id} className="hover:bg-[#343442] transition-colors">
                            {columns.map((col) => {
                                const val = row[col.key];
                                const isEditable = typeof col.editable === 'function' ? col.editable(row) : col.editable;

                                return (
                                    <td key={`${row.id}-${col.key}`} className={`border border-gray-600 p-2 ${col.className || ''}`}>
                                        {isEditable ? (
                                            <input
                                                className={`${inputClass} ${col.inputClassName || ''}`}
                                                type={col.type || "text"}
                                                step={col.step}
                                                value={val ?? ''}
                                                onChange={(e) => onRowChange(row.id, col.key, e.target.value)}
                                                onBlur={() => onSaveRow && onSaveRow(row.id)}
                                                onKeyDown={(e) => handleKeyDown(e, row.id)}
                                                disabled={col.disabled}
                                            />
                                        ) : (
                                            col.render ? col.render(row, val) : (val ?? '-')
                                        )}
                                        {col.subContent && col.subContent(row)}
                                        {col.extraContent && (
                                            <div className="mt-1 text-xs text-gray-400">
                                                {col.extraContent(row, val)}
                                            </div>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                    {data.length === 0 && (
                        <tr>
                            <td colSpan={columns.length} className="p-8 text-center text-gray-400">
                                데이터가 없습니다.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
            <style>{`
                input.no-spin::-webkit-outer-spin-button,
                input.no-spin::-webkit-inner-spin-button {
                  -webkit-appearance: none;
                  margin: 0;
                }
                input.no-spin[type=number] {
                  -moz-appearance: textfield;
                }
            `}</style>
        </div>
    );
}
