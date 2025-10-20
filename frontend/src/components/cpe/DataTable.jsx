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
    <div className="relative bg-[#2c2c3a] border border-gray-700 rounded-lg p-4 shadow-lg">
      {/* 저장 상태 표시 */}
      {saveState !== "idle" && (
        <div className="absolute top-2 right-4 text-xs text-gray-400 italic">
          {saveState === "saving" ? "저장 중..." : "✓ 저장됨"}
        </div>
      )}

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-gray-400 border-b border-gray-600">
            {columns.map((col) => (
              <th key={col.key} className="py-2 px-3 text-center">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className="hover:bg-[#3b3b4f] transition-colors border-b border-gray-700"
            >
              {columns.map((col) => {
                const cellKey = col.key;
                const manualFlags = row.manualFlags || {};
                const manualKeys = Object.keys(manualFlags);
                const valueKeys = Object.keys(row).filter(
                  (k) => !["manualFlags", "type", "label"].includes(k)
                );

                const valueIndex = valueKeys.indexOf(cellKey);
                const manualKey = manualKeys[valueIndex] || manualKeys[0];
                const isManualActive = manualKey ? manualFlags[manualKey] : false;

                return (
                  <td key={col.key} className="py-2 px-3 text-center text-gray-200">
                    {col.editable ? (
                      row.type === "radio" ? (
                        // Radio Buttons
                        row.options.map((opt) => (
                          <label key={opt.value} className="mx-2 inline-flex items-center">
                            <input
                              type="radio"
                              name={`${col.key}_${rowIdx}`}
                              value={opt.value}
                              checked={row[col.key] === opt.value}
                              onChange={(e) => {
                                let val = e.target.value;

                                // 문자열을 실제 타입으로 변환
                                if (val === "true") val = true;
                                else if (val === "false") val = false;
                                else if (!isNaN(val) && val.trim() !== "") val = Number(val);

                                handleInputChange(rowIdx, col.key, val);
                              }}
                              className="accent-blue-500 mr-1"
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))
                      ) : row.type === "select" ? (
                        // Select Box
                        <select
                          value={row[col.key] ?? ""}
                          onChange={(e) =>
                            handleInputChange(rowIdx, col.key, e.target.value)
                          }
                          className="bg-[#1e1e2f] border border-gray-600 rounded px-2 py-1 text-gray-200 text-sm w-32"
                        >
                          {(row.options || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : row.type === "readonly" ? (
                        // Readonly
                        <span className="text-yellow-400 font-semibold">
                          {row[col.key] ?? "—"}
                        </span>
                      ) : row.type === "manual" ? (
                        // Manual Input + Checkbox
                        <div className="flex items-center justify-center gap-2">
                          <input
                            type="checkbox"
                            checked={isManualActive}
                            onChange={(e) =>
                              handleInputChange(rowIdx, manualKey, e.target.checked)
                            }
                            className="accent-blue-500"
                          />
                          <input
                            type="number"
                            disabled={!isManualActive}
                            value={row[col.key] ?? ""}
                            onChange={(e) =>
                              handleInputChange(rowIdx, col.key, e.target.value)
                            }
                            className={`no-spin w-24 bg-[#1e1e2f] border ${
                              isManualActive ? "border-blue-500" : "border-gray-600"
                            } rounded px-2 py-1 text-gray-200 text-right focus:outline-none focus:ring-1 focus:ring-blue-500`}
                          />
                        </div>
                      ) : (
                        // Default Input + Unit (추가됨)
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type={row.type || "text"}
                            value={row[col.key] ?? ""}
                            onChange={(e) =>
                              handleInputChange(rowIdx, col.key, e.target.value)
                            }
                            className="no-spin w-24 bg-[#1e1e2f] border border-gray-600 rounded px-2 py-1 text-gray-200 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          {row.unit && (
                            <span className="text-white text-xs">{row.unit}</span>
                          )}
                        </div>
                      )
                    ) : (
                      row[col.key]
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

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
