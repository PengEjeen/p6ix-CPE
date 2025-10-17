import React, { useEffect, useRef, useState } from "react";
import DataTable from "../DataTable";
import {
  detailWorkCondition,
  updateWorkCondition,
} from "../../../api/cpe/calc";

export default function WorkConditionSection({ projectId }) {
  const [data, setData] = useState({});
  const latestDataRef = useRef({});
  const [loading, setLoading] = useState(true);

  // 데이터 로드
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

  // 값 변경 핸들러
  const handleChange = (key, value) => {
    const updated = { ...data, [key]: value };
    setData(updated);
    latestDataRef.current = updated;
    onAutoSave(updated);
  };

  if (loading) return <div className="text-gray-400">로딩 중...</div>;

  // 가동률 표시 로직
  const getUtilizationValue = (isManual, inputVal, typeVal, utilDict) => {
    // 직접입력이 true일 경우 입력값 표시
    if (isManual && inputVal) return Number(inputVal).toFixed(2);
    // 자동 계산 (dict에서 선택된 근무타입값 사용)
    if (!utilDict || !typeVal) return "—";
    const val = utilDict[typeVal];
    return val !== undefined ? Number(val).toFixed(2) : "—";
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

  // 테이블 컬럼 정의
  const columns = [
    { key: "label", label: "구분" },
    { key: "earthwork", label: "토공사", editable: true },
    { key: "framework", label: "골조공사", editable: true },
  ];

  // 테이블 행 정의
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
      earthwork: `${earthworkDisplay}%`,
      framework: `${frameworkDisplay}%`,
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
        <span className="text-xs text-gray-400">아니야</span>
      </div>

      {/* 본문 */}
      <div className="p-4">
        <DataTable
          columns={columns}
          rows={rows}
          onChange={(i, k, v) => {
            if (i === 0) {
              // 근무 조건 변경
              if (k === "earthwork") handleChange("earthwork_type", v);
              else if (k === "framework") handleChange("framework_type", v);
            } else if (i === 2) {
              // 직접입력 및 체크박스
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
