import React, { useState, useRef, useEffect } from "react";
import DataTable from "../DataTable";
import "../utils/scroll.css";

export default function PreparationSection({ data, setData, onAutoSave }) {
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollRef = useRef(null);
  const scrollTimeout = useRef(null);

  // 최신 데이터 ref
  const latestDataRef = useRef(data);
  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);

  // 값 변경 시 즉시 최신 ref 반영
  const handleChange = (key, value) => {
    setData((prev) => {
      const updated = { ...prev, [key]: value };
      latestDataRef.current = updated; // 최신값 반영
      return updated;
    });
  };

  // 스크롤 감지 (스크롤 중일 때만 스크롤바 강조)
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

  // 테이블 렌더링
  const renderTable = (title, headers, rows, keys) => (
    <section className="rounded-xl overflow-hidden shadow-lg bg-[#2c2c3a] border border-gray-700">
      {/* 카드 헤더 */}
      <div className="bg-[#3a3a4a] px-4 py-2 border-b border-gray-600 flex items-center justify-between">
        <h3 className="text-sm md:text-md font-semibold text-white">{title}</h3>
        <span className="text-xs text-gray-400">{headers[1]}</span>
      </div>

      {/* 테이블 영역 */}
      <div className="p-3">
        <DataTable
          columns={[
            { key: "label", label: headers[0] },
            { key: "value", label: headers[1], editable: true },
          ]}
          rows={rows.map((r) => ({ label: r.label, value: r.value }))}
          onChange={(i, k, v) => handleChange(keys[i], v)}
          onAutoSave={() => onAutoSave(latestDataRef.current)} // 최신 데이터 전달
        />
      </div>
    </section>
  );

  // 렌더링
  return (
    <div
      ref={scrollRef}
      className={`scroll-container h-[80vh] overflow-y-auto pr-2 space-y-6 transition-all duration-300 ${
        isScrolling ? "scrolling" : ""
      }`}
    >
      {renderTable(
        "정리기간",
        ["구분", "소요일(일)"],
        [
          { label: "주거시설", value: data.residential_days },
          { label: "비주거시설", value: data.non_residential_days },
        ],
        ["residential_days", "non_residential_days"]
      )}

      {renderTable(
        "세대수에 따른 추가 공사기간",
        ["세대수", "소요기간(개월)"],
        [
          { label: "2000세대 이하", value: data.units_under_2000 },
          { label: "2000~3000세대", value: data.units_2000_3000 },
          { label: "3000세대 이상", value: data.units_over_3000 },
        ],
        ["units_under_2000", "units_2000_3000", "units_over_3000"]
      )}

      {renderTable(
        "마감공사기간",
        ["층수", "소요기간(개월)"],
        [
          { label: "10F 이하", value: data.floors_under_10 },
          { label: "15F 이하", value: data.floors_under_15 },
          { label: "20F 이하", value: data.floors_under_20 },
          { label: "30F 이하", value: data.floors_under_30 },
          { label: "45F 이하", value: data.floors_under_45 },
          { label: "46F 이상", value: data.floors_over_46 },
        ],
        [
          "floors_under_10",
          "floors_under_15",
          "floors_under_20",
          "floors_under_30",
          "floors_under_45",
          "floors_over_46",
        ]
      )}
    </div>
  );
}
