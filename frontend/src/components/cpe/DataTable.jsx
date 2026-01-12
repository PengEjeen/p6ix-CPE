import React, { useRef, useState } from "react";

export default function DataTable({ columns, rows, onChange, onAutoSave }) {
  const typingTimeout = useRef(null);
  const [saveState, setSaveState] = useState("idle");

  const handleInputChange = (rowIdx, key, value) => {
    onChange(rowIdx, key, value);

    if (typingTimeout.current) clearTimeout(typingTimeout.current);

    typingTimeout.current = setTimeout(async () => {
      if (onAutoSave) {
        setSaveState("saving");
        try {
          await onAutoSave();
          setSaveState("saved");
          setTimeout(() => setSaveState("idle"), 1500);
        } catch {
          setSaveState("idle");
        }
      }
    }, 1000);
  };

  return (
    <div className="relative bg-[#20202a] border border-white/10 rounded-xl p-5 shadow-2xl backdrop-blur-sm">
      {/* 저장 상태 표시 (Floating Badge) */}
      <div className={`absolute -top-3 right-4 transition-all duration-300 transform ${saveState !== "idle" ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium shadow-lg border ${saveState === "saving"
            ? "bg-blue-500/20 border-blue-500/30 text-blue-200"
            : "bg-emerald-500/20 border-emerald-500/30 text-emerald-200"
          }`}>
          {saveState === "saving" ? (
            <>
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
              <span>저장 중...</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>저장됨</span>
            </>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/5">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#2a2a35] text-gray-300 uppercase text-xs tracking-wider border-b border-white/5">
              {columns.map((col) => (
                <th key={col.key} className="py-3 px-4 text-center font-semibold">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-white/5">
            {rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="hover:bg-white/[0.03] transition-colors duration-200 group"
              >
                {columns.map((col) => {
                  const cellKey = col.key;
                  const cellType =
                    typeof row.type === "object"
                      ? row.type?.[cellKey] || "text"
                      : row.type || "text";

                  const manualFlags = row.manualFlags || {};
                  const manualKeys = Object.keys(manualFlags);
                  const valueKeys = Object.keys(row).filter(
                    (k) => !["manualFlags", "type", "label"].includes(k)
                  );
                  const valueIndex = valueKeys.indexOf(cellKey);
                  const manualKey = manualKeys[valueIndex] || manualKeys[0];
                  const isManualActive = manualKey ? manualFlags[manualKey] : false;

                  return (
                    <td key={col.key} className="py-3 px-4 text-center text-gray-300">
                      {col.editable ? (
                        cellType === "radio" ? (
                          <div className="flex justify-center flex-wrap gap-2">
                            {(row.options || []).map((opt) => (
                              <label key={opt.value || opt} className="inline-flex items-center cursor-pointer group/radio">
                                <input
                                  type="radio"
                                  name={`${col.key}_${rowIdx}`}
                                  value={opt.value ?? opt}
                                  checked={row[col.key] === (opt.value ?? opt)}
                                  onChange={(e) => {
                                    let val = e.target.value;
                                    if (val === "true") val = true;
                                    else if (val === "false") val = false;
                                    else if (!isNaN(val) && val.trim() !== "") val = Number(val);
                                    handleInputChange(rowIdx, col.key, val);
                                  }}
                                  className="hidden peer"
                                />
                                <div className="w-4 h-4 rounded-full border border-gray-500 peer-checked:border-blue-500 peer-checked:bg-blue-500 mr-2 relative flex items-center justify-center transition-all">
                                  <div className="w-1.5 h-1.5 rounded-full bg-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                                </div>
                                <span className="text-gray-400 peer-checked:text-blue-200 transition-colors">{opt.label ?? opt}</span>
                              </label>
                            ))}
                          </div>
                        ) : cellType === "select" ? (
                          <div className="relative inline-block w-32">
                            <select
                              value={row[col.key] ?? ""}
                              onChange={(e) => handleInputChange(rowIdx, col.key, e.target.value)}
                              className="w-full bg-[#181825] border border-gray-700 hover:border-gray-500 rounded-md px-3 py-1.5 text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none transition-all cursor-pointer"
                            >
                              <option value="">—</option>
                              {(row.options || []).map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                            {/* Custom Arrow */}
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                            </div>
                          </div>
                        ) : cellType === "checkbox" ? (
                          <input
                            type="checkbox"
                            checked={Boolean(row[col.key])}
                            onChange={(e) => handleInputChange(rowIdx, col.key, e.target.checked)}
                            className="w-5 h-5 rounded border-gray-600 bg-[#181825] checked:bg-blue-600 focus:ring-offset-0 focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer accent-blue-600"
                          />
                        ) : cellType === "readonly" ? (
                          <span className="inline-block px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 font-semibold border border-yellow-500/20">
                            {row[col.key] ?? "—"}
                          </span>
                        ) : cellType === "manual" ? (
                          <div className="flex items-center justify-center gap-2 group/manual">
                            <input
                              type="checkbox"
                              checked={isManualActive}
                              onChange={(e) =>
                                handleInputChange(rowIdx, manualKey, e.target.checked)
                              }
                              className="w-4 h-4 rounded border-gray-600 bg-[#181825] checked:bg-blue-600 focus:ring-offset-0 focus:ring-2 focus:ring-blue-500/50 cursor-pointer accent-blue-600"
                            />
                            <input
                              type="number"
                              disabled={!isManualActive}
                              value={row[col.key] ?? ""}
                              onChange={(e) =>
                                handleInputChange(rowIdx, col.key, e.target.value)
                              }
                              className={`no-spin w-28 bg-[#181825] border rounded-md px-3 py-1.5 text-right transition-all focus:outline-none focus:ring-2 ${isManualActive
                                  ? "border-blue-500/50 text-white focus:ring-blue-500/50"
                                  : "border-gray-700 text-gray-500 bg-gray-900/50 cursor-not-allowed"
                                }`}
                              placeholder="0"
                            />
                          </div>
                        ) : (
                          // 기본 Number/Text
                          <div className="flex items-center justify-center gap-2 relative group/input">
                            <input
                              type={cellType || "text"}
                              value={row[col.key] ?? ""}
                              onChange={(e) => {
                                const val = cellType === "number" ? Number(e.target.value) : e.target.value;
                                handleInputChange(rowIdx, col.key, val);
                              }}
                              className="no-spin w-28 bg-[#181825] border border-gray-700 hover:border-gray-600 rounded-md px-3 py-1.5 text-gray-200 text-right focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder-gray-600"
                              placeholder="-"
                            />
                            {row.unit && (
                              <span className="text-gray-500 text-xs font-medium w-6 text-left">{row.unit}</span>
                            )}
                          </div>
                        )
                      ) : (
                        <span className="font-medium text-gray-400">{row[col.key]}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 스핀 제거 */}
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
