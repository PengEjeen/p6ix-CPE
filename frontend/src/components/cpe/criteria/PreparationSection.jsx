import React, { useState, useRef, useEffect } from "react";
import DataTable from "../DataTable";
import "./utils/scroll.css"; // ← 이 줄 중요 (CSS 따로 작성할거임)

export default function PreparationSection({ data, setData, onAutoSave }) {
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollRef = useRef(null);
  const scrollTimeout = useRef(null);

  const handleChange = (key, value) =>
    setData((prev) => ({ ...prev, [key]: value }));

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

  const renderTable = (title, headers, rows, keys) => (
    <section className="bg-[#2c2c3a] p-4 rounded-xl shadow space-y-2">
      <h3 className="text-md font-semibold border-b border-gray-600 pb-1">{title}</h3>
      <DataTable
        columns={[
          { key: "label", label: headers[0] },
          { key: "value", label: headers[1], editable: true },
        ]}
        rows={rows.map((r) => ({ label: r.label, value: r.value }))}
        onChange={(rowIdx, key, value) => handleChange(keys[rowIdx], value)}
        onAutoSave={() => onAutoSave(data)}
      />
    </section>
  );

  return (
    <div
      ref={scrollRef}
      className={`scroll-container h-[80vh] overflow-y-auto pr-2 space-y-6 transition-all duration-300 ${
        isScrolling ? "scrolling" : ""
      }`}
    >
      {renderTable(
        "● 정리기간",
        ["구분", "소요일(일)"],
        [
          { label: "주거시설", value: data.residential_days },
          { label: "비주거시설", value: data.non_residential_days },
        ],
        ["residential_days", "non_residential_days"]
      )}

      {renderTable(
        "● 세대수에 따른 추가 공사기간",
        ["세대수", "소요기간(개월)"],
        [
          { label: "2000세대 이하", value: data.units_under_2000 },
          { label: "2000~3000세대", value: data.units_2000_3000 },
          { label: "3000세대 이상", value: data.units_over_3000 },
        ],
        ["units_under_2000", "units_2000_3000", "units_over_3000"]
      )}

      {renderTable(
        "● 마감공사기간",
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
