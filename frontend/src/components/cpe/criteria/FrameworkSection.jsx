import React, { useState, useRef, useEffect } from "react";
import DataTable from "../DataTable";
import "./utils/scroll.css";
import { PlusCircle, Trash2 } from "lucide-react";

export default function FrameworkSection({ data, setData, onAutoSave }) {
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollRef = useRef(null);
  const scrollTimeout = useRef(null);

  const handleChange = (key, val) => setData((p) => ({ ...p, [key]: val }));

  // 스크롤 감지 (스크롤 중에만 스크롤바 표시)
  const handleScroll = () => {
    setIsScrolling(true);
    clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => setIsScrolling(false), 1000);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // JSON 데이터 변경 (중복 방지 + 정렬)
  const handleJsonChange = (field, index, key, value) => {
    let updated = [...(data[field] || [])];
    updated[index][key] = Number(value);

    // 중복 체크
    const uniqueValues = new Set();
    updated = updated.filter((row) => {
      if (uniqueValues.has(row[key])) return false;
      uniqueValues.add(row[key]);
      return true;
    });

    // 정렬 (숫자 오름차순)
    updated.sort((a, b) => (a[key] || 0) - (b[key] || 0));

    setData((prev) => ({ ...prev, [field]: updated }));
    onAutoSave({ ...data, [field]: updated });
  };

  // 행 추가 / 삭제
  const handleAddRow = (field, defaultRow) => {
    const updated = [...(data[field] || []), defaultRow];
    setData((prev) => ({ ...prev, [field]: updated }));
    onAutoSave({ ...data, [field]: updated });
  };
  const handleRemoveRow = (field, index) => {
    const updated = [...(data[field] || [])];
    updated.splice(index, 1);
    setData((prev) => ({ ...prev, [field]: updated }));
    onAutoSave({ ...data, [field]: updated });
  };

  // 일반 테이블
  const renderTable = (title, headers, rows, keys) => (
    <section className="bg-[#2c2c3a] p-4 rounded-xl shadow space-y-2 min-w-[340px]">
      <h3 className="text-md font-semibold border-b border-gray-600 pb-1">{title}</h3>
      <DataTable
        columns={[
          { key: "label", label: headers[0] },
          { key: "value", label: headers[1], editable: true },
        ]}
        rows={rows.map((r) => ({ label: r.label, value: r.value }))}
        onChange={(i, k, v) => handleChange(keys[i], v)}
        onAutoSave={() => onAutoSave(data)}
      />
    </section>
  );

  // JSON 테이블
  const renderJsonTable = (title, field, headers, keyMap, defaultRow) => (
    <section className="bg-[#2c2c3a] p-4 rounded-xl shadow space-y-2 min-w-[340px]">
      <div className="flex justify-between items-center border-b border-gray-600 pb-1">
        <h3 className="text-md font-semibold">{title}</h3>
        <button
          onClick={() => handleAddRow(field, defaultRow)}
          className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-sm"
        >
          <PlusCircle size={16} /> 행 추가
        </button>
      </div>

      <table className="w-full text-sm border-t border-gray-700">
        <thead>
          <tr className="text-gray-400">
            {headers.map((h, i) => (
              <th key={i} className="py-2 px-3 text-left">{h}</th>
            ))}
            <th className="w-12"></th>
          </tr>
        </thead>
        <tbody>
          {(data[field] || []).map((row, idx) => (
            <tr key={idx} className="border-t border-gray-700 hover:bg-[#3b3b4f] transition-colors">
              {keyMap.map((key) => (
                <td key={key} className="py-2 px-3">
                  <input
                    type="number"
                    value={row[key] ?? ""}
                    onChange={(e) => handleJsonChange(field, idx, key, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onAutoSave(data)}
                    className="no-spin w-24 bg-[#1e1e2f] border border-gray-600 rounded px-2 py-1 text-gray-200 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </td>
              ))}
              <td className="text-center">
                <button
                  onClick={() => handleRemoveRow(field, idx)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );

  return (
    <div
      ref={scrollRef}
      className={`scroll-container space-y-4 h-[80vh] overflow-y-auto pr-2 transition-all duration-300 ${
        isScrolling ? "scrolling" : ""
      }`}
    >
      {renderJsonTable("● 기초공사 (기초두께별 소요일)", "base_thickness_data", ["기초두께(m)", "소요일(일)"], ["thickness", "day"], { thickness: 0, day: 0 })}
      {renderJsonTable("● 층고별 소요일", "floor_height_data", ["층고(m)", "소요일(일)"], ["height", "day"], { height: 0, day: 0 })}
      {renderTable(
        "● 층변화",
        ["구분", "소요일(일)"],
        [
          { label: "전이층", value: data.change_transfer },
          { label: "세팅층", value: data.change_setting },
          { label: "피난층", value: data.change_refuge },
          { label: "필로티", value: data.change_piloti },
          { label: "포디움", value: data.change_podium },
          { label: "스카이라운지", value: data.change_sky },
          { label: "Cycle Time", value: data.change_cycle_time },
        ],
        [
          "change_transfer",
          "change_setting",
          "change_refuge",
          "change_piloti",
          "change_podium",
          "change_sky",
          "change_cycle_time",
        ]
      )}
      {renderJsonTable("● 층 수별 전이층 소요일", "transfer_height_data", ["층 수", "소요일(일)"], ["floors", "day"], { floors: 0, day: 0 })}
      {renderTable("● 갱폼 인양방식", ["방식", "소요일(일)"], [{ label: "TC 인양식", value: data.form_tc }, { label: "유압 인양식", value: data.form_hydraulic }], ["form_tc", "form_hydraulic"])}
      {renderTable("● 역타공법 지하층 소요일", ["구분", "소요일(일)"], [{ label: "적용", value: data.reverse_excavation }], ["reverse_excavation"])}
    </div>
  );
}
