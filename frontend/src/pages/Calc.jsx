import React from "react";
import { useParams } from "react-router-dom";
import ConstructionOverviewSection from "../components/cpe/calc/ConstructionOverviewSection";
import WorkConditionSection from "../components/cpe/calc/WorkConditionSection";
// import PreparationPeriodSection from "../components/cpe/calc/PreparationPeriodSection";
// import EarthworkInputSection from "../components/cpe/calc/EarthworkInputSection";
// import FrameworkInputSection from "../components/cpe/calc/FrameworkInputSection";
import PageHeader from "../components/cpe/PageHeader";

export default function Calc() {
  const { id: projectId } = useParams();

  return (
    <div className="p-6 overflow-x-auto">
      {/* 상단 페이지 제목 */}
      <PageHeader title="공기산정 입력" description="전체 공사기간 산정 및 분석" />

      {/* 전체 레이아웃 */}
      <div className="flex flex-col gap-6 min-w-[900px]">
        
        {/* 1행: 공사개요 + 근무조건 나란히 */}
        <div className="flex flex-wrap gap-6 justify-start items-start">
          
          {/* --- 공사개요 --- */}
          <div className="bg-[#2c2c3a] rounded-xl border border-gray-700 shadow-lg p-4 inline-block align-top">
            <h2 className="text-lg font-semibold text-white text-center mb-3 border-b border-gray-600 pb-1">
              공사개요
            </h2>
            <ConstructionOverviewSection projectId={projectId} />
          </div>

          {/* --- 근무조건 및 가동률 --- */}
          <div className="bg-[#2c2c3a] rounded-xl border border-gray-700 shadow-lg p-4 inline-block align-top">
            <h2 className="text-lg font-semibold text-white text-center mb-3 border-b border-gray-600 pb-1">
              근무조건 및 가동률
            </h2>
            <WorkConditionSection projectId={projectId} />
          </div>
        </div>

        {/* 2행: 이후 단계 섹션들 */}
        {/*
        <div className="flex flex-col gap-6">
          {/* --- 준비/정리/가설 기간 입력 --- *-/}
          <PreparationPeriodSection projectId={projectId} />

          {/* --- 토공사 입력 --- *-/}
          <EarthworkInputSection projectId={projectId} />

          {/* --- 골조공사 입력 --- *-/}
          <FrameworkInputSection projectId={projectId} />
        </div>
        */}
      </div>
    </div>
  );
}
