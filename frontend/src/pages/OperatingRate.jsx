import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  detailOperatingRate,
  updateOperatingRate,
} from "../api/cpe/operating_rate";
import PageHeader from "../components/cpe/PageHeader";
import DataTable from "../components/cpe/DataTable";
import SaveButton from "../components/cpe/SaveButton";

export default function OperatingRate() {
  const { id: projectId } = useParams();
  const [weights, setWeights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ✅ 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await detailOperatingRate(projectId);
        // unit 필드 추가
        const withUnit = data.map((item) => ({ ...item, unit: "%" }));
        setWeights(withUnit);
      } catch (error) {
        console.error("가동률 불러오기 실패:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [projectId]);

  // ✅ 값 변경 핸들러
  const handleChange = (index, field, value) => {
    const updated = [...weights];
    updated[index][field] = value;
    setWeights(updated);
  };

  // ✅ 저장 함수
  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      // unit 제거 후 서버 전송
      const payload = weights.map(({ unit, ...rest }) => rest);
      await updateOperatingRate(projectId, payload);
    } catch (error) {
      console.error("가동률 저장 실패:", error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }, [projectId, weights]);

  if (loading) {
    return <p className="p-6 text-gray-400">불러오는 중...</p>;
  }

  // ✅ 테이블 컬럼 정의
  const columns = [
    { key: "type_display", label: "공종(Type)" },
    {
      key: "pct_7d",
      label: "주 7일(%)",
      align: "text-right",
      editable: true,
      type: "number",
    },
    {
      key: "pct_6d",
      label: "주 6일(%)",
      align: "text-right",
      editable: true,
      type: "number",
    },
    {
      key: "pct_5d",
      label: "주 5일(%)",
      align: "text-right",
      editable: true,
      type: "number",
    },
  ];

  // 렌더링
  return (
    <div className="p-6 text-gray-200">
      <PageHeader title="가동률 입력" description="작업 가동률 입력 및 자동 계산" />

      <div className="flex justify-end mb-6">
        <SaveButton onSave={handleSave} saving={saving} />
      </div>

      <DataTable
        columns={columns}
        rows={weights}
        onChange={handleChange}
        onAutoSave={handleSave}
      />
    </div>
  );
}
