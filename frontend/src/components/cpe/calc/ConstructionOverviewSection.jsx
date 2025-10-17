import React, { useState, useEffect, useRef } from "react";
import DataTable from "../DataTable";
import {
  detailConstructionOverview,
  updateConstructionOverview,
} from "../../../api/cpe/calc";

export default function ConstructionOverviewSection({ projectId }) {
  const [data, setData] = useState({});
  const latestDataRef = useRef({});
  const [loading, setLoading] = useState(true);

  // 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await detailConstructionOverview(projectId);
        setData(res.data);
        latestDataRef.current = res.data;
      } catch (err) {
        console.error("공사개요 불러오기 실패:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  // 변경 핸들러
  const handleChange = (key, value) => {
    setData((prev) => {
      const updated = { ...prev, [key]: value };
      latestDataRef.current = updated;
      return updated;
    });
  };

  // 자동 저장
  const onAutoSave = async (latestData) => {
    try {
      await updateConstructionOverview(projectId, latestData);
    } catch (err) {
      console.error("공사개요 자동저장 실패:", err);
    }
  };

  if (loading) return <div className="text-gray-400">로딩 중...</div>;

  // 공통 렌더 함수
  const renderTable = (title, headers, rows, keys) => (
    <section className="rounded-xl overflow-hidden shadow-lg bg-[#2c2c3a] border border-gray-700 mb-6">
      {/* 헤더 */}
      <div className="bg-[#3a3a4a] px-4 py-2 border-b border-gray-600 flex items-center justify-between">
        <h3 className="text-sm md:text-md font-semibold text-white">{title}</h3>
        <span className="text-xs text-gray-400">{headers[1]}</span>
      </div>

      {/* 내용 */}
      <div className="p-3">
        <DataTable
          columns={[
            { key: "label", label: headers[0] },
            { key: "value", label: headers[1], editable: true },
          ]}
          rows={rows.map((r) => ({
            label: r.label,
            value: r.value,
            type: r.type,
            options: r.options,
            unit: r.unit, // 단위 전달
          }))}
          onChange={(i, k, v) => handleChange(keys[i], v)}
          onAutoSave={() => onAutoSave(latestDataRef.current)}
        />
      </div>
    </section>
  );

  // 섹션별 데이터 구성
  const sections = [
    {
      title: "유형",
      headers: ["구분", "선택 / 입력 사항"],
      rows: [
        {
          label: "발주처",
          value: data.client_type,
          type: "select",
          options: ["민간공사", "공공공사"],
        },
        {
          label: "건물 용도",
          value: data.building_use,
          type: "select",
          options: ["공동주택", "오피스텔", "상업시설", "기타"],
        },
        {
          label: "공사 형식",
          value: data.construction_type,
          type: "select",
          options: ["턴키", "CM", "시공", "기타"],
        },
      ],
      keys: ["client_type", "building_use", "construction_type"],
    },
    {
      title: "Site",
      headers: ["구분", "입력 사항"],
      rows: [
        { label: "위치", value: data.location },
        { label: "대지면적", value: data.site_area, type: "number", unit: "㎡" },
        { label: "인접도로", value: data.adjacent_road },
        { label: "도로 접한 면 수", value: data.adjacent_side_count, type: "number", unit: "면" },
        { label: "최고 고저차", value: data.elevation_max, type: "number", unit: "m" },
        { label: "최저 고저차", value: data.elevation_min, type: "number", unit: "m" },
        {
          label: "주변 현황",
          value: data.nearby_env,
          type: "select",
          options: ["학교", "주거지", "노후시설", "문화재", "택지개발"],
        },
      ],
      keys: [
        "location",
        "site_area",
        "adjacent_road",
        "adjacent_side_count",
        "elevation_max",
        "elevation_min",
        "nearby_env",
      ],
    },
    {
      title: "건물",
      headers: ["구분", "입력 사항"],
      rows: [
        { label: "지하층수", value: data.basement_floors, type: "number", unit: "층" },
        { label: "지상층수", value: data.ground_floors, type: "number", unit: "층" },
        { label: "세대수", value: data.total_units, type: "number", unit: "세대" },
        { label: "동수", value: data.total_buildings, type: "number", unit: "동" },
        { label: "연면적", value: data.total_floor_area, type: "number", unit: "㎡" },
      ],
      keys: [
        "basement_floors",
        "ground_floors",
        "total_units",
        "total_buildings",
        "total_floor_area",
      ],
    },
  ];

  // 렌더링
  return (
    <div className="space-y-6">
      {sections.map((s, idx) => (
        <div key={idx}>{renderTable(s.title, s.headers, s.rows, s.keys)}</div>
      ))}
    </div>
  );
}
