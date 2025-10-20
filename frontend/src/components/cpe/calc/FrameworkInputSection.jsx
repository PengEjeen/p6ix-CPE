import React, { useEffect, useRef, useState } from "react";
import DataTable from "../DataTable";
import {
  detailFrameworkInput,
  updateFrameworkInput,
} from "../../../api/cpe/calc";

export default function FrameworkInputSection({ projectId, basement_floors, groud_floors }) {
  const [data, setData] = useState({});
  const latestDataRef = useRef({});
  const [loading, setLoading] = useState(true);

  // ----------------------------------------------------------------
  // 데이터 로드
  // ----------------------------------------------------------------
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await detailFrameworkInput(projectId);
        setData(res.data);
        latestDataRef.current = res.data;
      } catch (err) {
        console.error("골조공사 입력 불러오기 실패:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  // ----------------------------------------------------------------
  // 자동 저장
  // ----------------------------------------------------------------
  const onAutoSave = async (latestData) => {
    try {
      await updateFrameworkInput(projectId, latestData);
    } catch (err) {
      console.error("골조공사 자동저장 실패:", err);
    }
  };

  // ----------------------------------------------------------------
  // 값 변경 핸들러
  // ----------------------------------------------------------------
  const handleChange = (key, value) => {
    const updated = { ...data, [key]: value };
    setData(updated);
    latestDataRef.current = updated;
    onAutoSave(updated);
  };

  if (loading) return <div className="text-gray-400">로딩 중...</div>;

  // ----------------------------------------------------------------
  // 테이블 컬럼
  // ----------------------------------------------------------------
  const columns = [
    { key: "label", label: "구분" },
    { key: "value", label: "입력 사항", editable: true },
  ];

  // ----------------------------------------------------------------
  // 섹션별 행 구성
  // ----------------------------------------------------------------
  const sections = [
    {
      title: "기초 골조",
      rows: [
        {
          label: "기초 두께",
          value: data.base_thickness,
          type: "number",
          unit: "m",
        },
        {
          label: "Working Day",
          value: data.base_working_day,
          type: "readonly",
          unit: "일",
        },
        {
          label: "Calendar Day",
          value: data.base_calendar_day,
          type: "readonly",
          unit: "일",
        },
      ],
      keys: ["base_thickness", "base_working_day", "base_calendar_day"],
    },
    {
      title: "지하·지상 골조",
      rows: [
        {
          label: "갱폼 인양방식",
          value: data.is_TC ? "TC 인양식" : "기타 방식",
          type: "select",
          options: ["TC 인양식", "기타 방식"],
        },
        {
          label: "Cycle Time (Calendar Day)",
          value: data.cycle_time,
          type: "number",
          unit: "일",
        },
        {
          label: "층고 입력 데이터",
          value: JSON.stringify(data.floor_height_data || {}, null, 2),
          type: "textarea",
        },
      ],
      keys: ["is_TC", "cycle_time", "floor_height_data"],
    },
  ];

  // ----------------------------------------------------------------
  // 렌더링
  // ----------------------------------------------------------------
  return (
    <div className="space-y-6">
      {sections.map((section, sectionIndex) => (
        <section
          key={sectionIndex}
          className="rounded-xl overflow-hidden shadow-lg bg-[#2c2c3a] border border-gray-700"
        >
          {/* 카드 헤더 */}
          <div className="bg-[#3a3a4a] px-4 py-2 border-b border-gray-600 flex items-center justify-between">
            <h3 className="text-sm md:text-md font-semibold text-white">
              {section.title}
            </h3>
          </div>

          {/* 본문 */}
          <div className="p-4">
            <DataTable
              columns={columns}
              rows={section.rows.map((r) => ({
                label: r.label,
                value: r.value,
                type: r.type,
                options: r.options,
                unit: r.unit,
              }))}
              onChange={(i, k, v) => {
                const key = section.keys[i];

                // select 값 처리
                if (key === "is_TC") {
                  handleChange(key, v === "TC 인양식");
                } else if (key === "floor_height_data") {
                  try {
                    const parsed = JSON.parse(v);
                    handleChange(key, parsed);
                  } catch {
                    handleChange(key, {});
                  }
                } else {
                  handleChange(key, v);
                }
              }}
              onAutoSave={() => onAutoSave(latestDataRef.current)}
            />
          </div>
        </section>
      ))}
    </div>
  );
}
