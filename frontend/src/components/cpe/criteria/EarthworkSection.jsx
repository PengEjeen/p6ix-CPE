import React, { useState, useRef, useEffect } from "react";
import DataTable from "../DataTable";
import "../utils/scroll.css";

export default function EarthworkSection({ data, setData, onAutoSave }) {
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollRef = useRef(null);
  const scrollTimeout = useRef(null);

  // 항상 최신 데이터 유지
  const latestDataRef = useRef(data);
  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);

  // 값 변경 핸들러 (Ref에도 즉시 반영)
  const handleChange = (key, val) => {
    setData((prev) => {
      const updated = { ...prev, [key]: val };
      latestDataRef.current = updated; // 최신 데이터 즉시 반영
      return updated;
    });
  };

  // 스크롤 감지 (UI 효과)
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

  // 공용 테이블 렌더링 함수
  const renderTable = (title, headers, rows, keys) => (
    <section className="bg-[#2c2c3a] p-4 rounded-xl shadow space-y-2 min-w-[340px]">
      <h3 className="text-md font-semibold border-b border-gray-600 pb-1">
        {title}
      </h3>
      <DataTable
        columns={[
          { key: "label", label: headers[0] },
          { key: "value", label: headers[1], editable: true },
        ]}
        rows={rows.map((r) => ({ label: r.label, value: r.value }))}
        onChange={(i, k, v) => handleChange(keys[i], v)}
        onAutoSave={() => onAutoSave(latestDataRef.current)} // 최신 데이터 전달
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
      {renderTable("● 흙막이 지보공", ["공법", "소요일(일)"], [
        { label: "어스앵커", value: data.support_earth_anchor },
        { label: "레이커", value: data.support_raker },
        { label: "스트럿", value: data.support_strut },
      ], ["support_earth_anchor", "support_raker", "support_strut"])}

      {renderTable("● 흙막이공법별 생산량", ["공법", "생산량(㎡/일)"], [
        { label: "CIP", value: data.production_cip },
        { label: "Slurry Wall", value: data.production_slurry },
        { label: "Sheet Pile", value: data.production_sheet },
        { label: "D-WALL", value: data.production_dwall },
        { label: "H-PILE+토류판", value: data.production_hpile },
      ], [
        "production_cip",
        "production_slurry",
        "production_sheet",
        "production_dwall",
        "production_hpile",
      ])}

      {renderTable("● 토사별 CIP공법 생산량", ["토사유형", "생산량(m/일)"], [
        { label: "토사", value: data.cip_soil },
        { label: "풍화암", value: data.cip_weathered },
        { label: "연암", value: data.cip_soft_rock },
        { label: "경암", value: data.cip_hard_rock },
      ], ["cip_soil", "cip_weathered", "cip_soft_rock", "cip_hard_rock"])}

      {renderTable("● 토사별 H-Pile+토류판 생산량", ["토사유형", "생산량(m/일)"], [
        { label: "토사", value: data.hpile_soil },
        { label: "풍화암", value: data.hpile_weathered },
        { label: "연암", value: data.hpile_soft_rock },
        { label: "경암", value: data.hpile_hard_rock },
      ], [
        "hpile_soil",
        "hpile_weathered",
        "hpile_soft_rock",
        "hpile_hard_rock",
      ])}

      {renderTable("● 토공사 할증", ["주변현황", "할증(%)"], [
        { label: "학교", value: data.surcharge_school },
        { label: "주거지", value: data.surcharge_residential },
        { label: "노후시설", value: data.surcharge_old_facility },
        { label: "문화재", value: data.surcharge_cultural },
        { label: "택지개발", value: data.surcharge_development },
      ], [
        "surcharge_school",
        "surcharge_residential",
        "surcharge_old_facility",
        "surcharge_cultural",
        "surcharge_development",
      ])}

      {renderTable("● 터파기", ["구분", "생산량(㎥/일)"], [
        { label: "토사", value: data.excavation_soil },
        { label: "풍화암", value: data.excavation_weathered },
      ], ["excavation_soil", "excavation_weathered"])}

      {renderTable("● 토사 반출방법", ["방법", "계수"], [
        { label: "직상차", value: data.haul_direct },
        { label: "크람쉘", value: data.haul_cram },
      ], ["haul_direct", "haul_cram"])}

      {renderTable("● 연암 발파공법별 반출량", ["공법", "생산량(㎥/일)"], [
        { label: "미진동", value: data.blasting_soft_vibrationless },
        { label: "정밀제어", value: data.blasting_soft_precision },
        { label: "소규모", value: data.blasting_soft_small },
        { label: "중규모", value: data.blasting_soft_medium },
      ], [
        "blasting_soft_vibrationless",
        "blasting_soft_precision",
        "blasting_soft_small",
        "blasting_soft_medium",
      ])}

      {renderTable("● 경암 발파공법별 반출량", ["공법", "생산량(㎥/일)"], [
        { label: "미진동", value: data.blasting_hard_vibrationless },
        { label: "정밀제어", value: data.blasting_hard_precision },
        { label: "소규모", value: data.blasting_hard_small },
        { label: "중규모", value: data.blasting_hard_medium },
      ], [
        "blasting_hard_vibrationless",
        "blasting_hard_precision",
        "blasting_hard_small",
        "blasting_hard_medium",
      ])}

      {renderTable("● RCD 직경에 따른 생산량", ["직경(mm)", "생산량(m/일)"], [
        { label: "1500mm", value: data.rcd_1500 },
        { label: "1800mm", value: data.rcd_1800 },
        { label: "2000mm", value: data.rcd_2000 },
        { label: "2500mm", value: data.rcd_2500 },
        { label: "3000mm", value: data.rcd_3000 },
      ], [
        "rcd_1500",
        "rcd_1800",
        "rcd_2000",
        "rcd_2500",
        "rcd_3000",
      ])}

      {renderTable("● PRD 직경에 따른 생산량", ["직경(mm)", "생산량(m/일)"], [
        { label: "600mm", value: data.prd_600 },
        { label: "750mm", value: data.prd_750 },
        { label: "900mm", value: data.prd_900 },
        { label: "1000mm", value: data.prd_1000 },
        { label: "1500mm", value: data.prd_1500 },
      ], ["prd_600", "prd_750", "prd_900", "prd_1000", "prd_1500"])}
    </div>
  );
}
