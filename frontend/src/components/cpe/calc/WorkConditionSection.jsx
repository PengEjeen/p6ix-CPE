import React, { useEffect, useRef, useState } from "react";
import DataTable from "../DataTable";
import {
  detailWorkCondition,
  updateWorkCondition,
} from "../../../api/cpe/calc";

export default function WorkConditionSection({ projectId, onUtilizationChange }) {
  const [data, setData] = useState({});
  const latestDataRef = useRef({});
  const [loading, setLoading] = useState(true);

  // 이전 전달값 기억용 ref
  const prevUtilizationRef = useRef({ earthwork: null, framework: null });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await detailWorkCondition(projectId);
        setData(res.data);
        latestDataRef.current = res.data;
      } catch (err) {
        console.error("근무조건 불러오기 실패:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  // 자동 저장
  const onAutoSave = async (latestData) => {
    try {
      await updateWorkCondition(projectId, latestData);
    } catch (err) {
      console.error("자동 저장 실패:", err);
    }
  };

  const handleChange = (key, value) => {
    const updated = { ...data, [key]: value };
    setData(updated);
    latestDataRef.current = updated;
    onAutoSave(updated);
  };

  // 가동률 계산 함수
  const getUtilizationValue = (isManual, inputVal, typeVal, utilDict) => {
    if (isManual && inputVal) return Number(inputVal).toFixed(2);
    if (!utilDict || !typeVal) return null;
    const val = utilDict[typeVal];
    return val !== undefined ? Number(val).toFixed(2) : null;
  };

  const earthworkDisplay = getUtilizationValue(
    data.is_earthwork_input,
    data.earthwork_utilization_input,
    data.earthwork_type,
    data.earthwork_utilization
  );

  const frameworkDisplay = getUtilizationValue(
    data.is_framework_input,
    data.framework_utilization_input,
    data.framework_type,
    data.framework_utilization
  );

  // 상위로 값 전달 (실제로 변경된 경우에만)
  useEffect(() => {
    if (!onUtilizationChange) return;

    const current = {
      earthwork: Number(earthworkDisplay) || 0,
      framework: Number(frameworkDisplay) || 0,
    };

    const prev = prevUtilizationRef.current;

    if (
      current.earthwork !== prev.earthwork ||
      current.framework !== prev.framework
    ) {
      onUtilizationChange(current);
      prevUtilizationRef.current = current; // 최신값 갱신
    }
  }, [earthworkDisplay, frameworkDisplay, onUtilizationChange]);

  if (loading) return <div className="text-gray-400">로딩 중...</div>;

  // 테이블 구조
  const columns = [
    { key: "label", label: "구분" },
    { key: "earthwork", label: "토공사", editable: true },
    { key: "framework", label: "골조공사", editable: true },
  ];

  const rows = [
    {
      label: "근무 조건",
      type: "radio",
      earthwork: data.earthwork_type,
      framework: data.framework_type,
      options: [
        { label: "주7일", value: 7 },
        { label: "주6일", value: 6 },
        { label: "주5일", value: 5 },
      ],
    },
    {
      label: "가동률(%)",
      type: "readonly",
      earthwork: earthworkDisplay ? `${earthworkDisplay}%` : "—",
      framework: frameworkDisplay ? `${frameworkDisplay}%` : "—",
    },
    {
      label: "직접입력(%)",
      type: "manual",
      earthwork: data.earthwork_utilization_input,
      framework: data.framework_utilization_input,
      manualFlags: {
        is_earthwork_input: data.is_earthwork_input,
        is_framework_input: data.is_framework_input,
      },
    },
  ];

  return (
    <section className="rounded-xl overflow-hidden shadow-lg bg-[#2c2c3a] border border-gray-700 mb-6">
      {/* 카드 헤더 */}
      <div className="bg-[#3a3a4a] px-4 py-2 border-b border-gray-600 flex items-center justify-between">
        <h3 className="text-sm md:text-md font-semibold text-white">
          근무조건 가동률
        </h3>
      </div>

      {/* 본문 */}
      <div className="p-4">
        <DataTable
          columns={columns}
          rows={rows}
          onChange={(i, k, v) => {
            if (i === 0) {
              if (k === "earthwork") handleChange("earthwork_type", v);
              else if (k === "framework") handleChange("framework_type", v);
            } else if (i === 2) {
              if (k === "is_earthwork_input") handleChange("is_earthwork_input", v);
              else if (k === "is_framework_input") handleChange("is_framework_input", v);
              else if (k === "earthwork") handleChange("earthwork_utilization_input", v);
              else if (k === "framework") handleChange("framework_utilization_input", v);
            }
          }}
          onAutoSave={() => onAutoSave(latestDataRef.current)}
        />
      </div>
    </section>
  );
}
