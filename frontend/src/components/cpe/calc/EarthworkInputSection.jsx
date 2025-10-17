import React, { useEffect, useState } from "react";
import DataTable from "../DataTable";
import { detailEarthworkInput, updateEarthworkInput } from "../../../api/cpe/calc";

export default function EarthworkInputSection({ projectId, utilization }) {
  const [data, setData] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      const res = await detailEarthworkInput(projectId);
      setData(res.data);
    };
    fetchData();
  }, [projectId]);

  // ✅ 가동률 변경될 때 처리
  useEffect(() => {
    if (utilization) {
      console.log("현재 토공사 가동률:", utilization, "%");
      // 예: 계산 반영 가능
      // setData(prev => ({ ...prev, adjustedDays: prev.baseDays * (100 / utilization) }));
    }
  }, [utilization]);

  return (
    <section className="bg-[#2c2c3a] p-4 rounded-xl border border-gray-700 shadow">
      <h3 className="text-md font-semibold text-white mb-3 border-b border-gray-600 pb-1">
        토공사 입력
      </h3>
      <p className="text-gray-400 mb-2">
        가동률: {utilization ? `${utilization}%` : "—"}
      </p>
      {/* 여기에 DataTable 등 구성 */}
      <DataTable />
    </section>
  );
}
