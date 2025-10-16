import React, { useCallback, useRef, useState } from "react";

export default function DataTable({ columns, rows, onChange, onAutoSave }) {
  const typingTimeout = useRef(null);
  const [saveState, setSaveState] = useState("idle"); // "idle" | "saving" | "saved"

  // 입력 후 0.8초 멈추면 자동 저장
  const handleInputChange = (rowIdx, key, value) => {
    onChange(rowIdx, key, value);

    if (typingTimeout.current) clearTimeout(typingTimeout.current);

    setSaveState("saving");

    typingTimeout.current = setTimeout(async () => {
      if (onAutoSave) {
        try {
          await onAutoSave();
          setSaveState("saved");
          setTimeout(() => setSaveState("idle"), 1500); // 1.5초 후 숨김
        } catch {
          setSaveState("idle");
        }
      }
    }, 800); // 0.8초 대기 후 저장
  };

  return (
    <div className="relative bg-[#2c2c3a] border border-gray-700 rounded-lg p-4 shadow-lg">
      {/* 저장 상태 표시 */}
      {saveState !== "idle" && (
        <div className="absolute top-2 right-4 text-xs text-gray-400 italic">
          {saveState === "saving" ? "저장 중..." : "✓ 저장됨"}
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-600">
            {columns.map((col) => (
              <th key={col.key} className={`py-2 px-3 ${col.align || "text-left"}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr
              key={row.id || rowIdx}
              className="hover:bg-[#3b3b4f] transition-colors border-b border-gray-700"
            >
              {columns.map((col) => (
                <td key={col.key} className={`py-2 px-3 ${col.align || "text-left"}`}>
                  {col.editable ? (
                    <input
                      type={col.type || "text"}
                      value={row[col.key] ?? ""}
                      onChange={(e) =>
                        handleInputChange(rowIdx, col.key, e.target.value)
                      }
                      className="no-spin w-24 bg-[#1e1e2f] border border-gray-600 rounded px-2 py-1 text-gray-200 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                      {...col.inputProps}
                    />
                  ) : (
                    row[col.key]
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 스핀버튼 제거 */}
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
