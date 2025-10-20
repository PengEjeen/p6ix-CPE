import React, { useState } from "react";
import { useParams } from "react-router-dom";
import ConstructionOverviewSection from "../components/cpe/calc/ConstructionOverviewSection";
import WorkConditionSection from "../components/cpe/calc/WorkConditionSection";
import EarthworkInputSection from "../components/cpe/calc/EarthworkInputSection";
import FrameworkInputSection from "../components/cpe/calc/FrameworkInputSection";
import PageHeader from "../components/cpe/PageHeader";

export default function Calc() {
  const { id: projectId } = useParams();

  // WorkConditionSection → EarthworkInputSection 연결용 상태
  const [utilization, setUtilization] = useState({
    earthwork: null,
    framework: null,
  });

  const [constructionOverview, setConstructionOverview] = useState({
    nearby_env: null,
    basement_floors: null,
    ground_floors: null,
  });

  return (
    <div className="p-6 overflow-x-auto">
      {/* 상단 페이지 제목 */}
      <PageHeader
        title="공기산정 입력"
        description="전체 공사기간 산정 및 분석"
      />

      {/* 전체 레이아웃 */}
      <div className="flex flex-col gap-6 min-w-[900px]">
        <div className="flex flex-wrap gap-6 justify-start items-start">
          {/* === 공사개요 영역 === */}
          <div>
            <div className="bg-[#2c2c3a] rounded-xl border border-gray-700 shadow-lg p-4 mb-6 inline-block align-top">
              <h2 className="text-lg font-semibold text-white text-center mb-3 border-b border-gray-600 pb-1">
                공사개요
              </h2>
              <ConstructionOverviewSection
                projectId={projectId}
                onOverviewChange={(vals) => setConstructionOverview(vals)}
              />
            </div>
          </div>

          {/* === 근무조건 + 골조공사 영역 === */}
          <div>
            {/* 근무조건 */}
            <div className="bg-[#2c2c3a] rounded-xl border border-gray-700 shadow-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-white text-center mb-3 border-b border-gray-600 pb-1">
                근무조건 및 가동률
              </h2>
              <WorkConditionSection
                projectId={projectId}
                onUtilizationChange={(vals) => setUtilization(vals)}
              />
            </div>
          </div>

          {/* === 토공사 영역 === */}
          <div>
            <div className="bg-[#2c2c3a] rounded-xl border border-gray-700 shadow-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-white text-center mb-3 border-b border-gray-600 pb-1">
                토공사
              </h2>
              <EarthworkInputSection
                projectId={projectId}
                utilization={utilization.earthwork}
                nearby_env={constructionOverview.nearby_env}
              />
            </div>
            {/* 골조공사 */}
            <div className="bg-[#2c2c3a] rounded-xl border border-gray-700 shadow-lg p-4">
              <h2 className="text-lg font-semibold text-white text-center mb-3 border-b border-gray-600 pb-1">
                골조공사
              </h2>
              <FrameworkInputSection 
                projectId={projectId}
                basement_floors={constructionOverview.basement_floors}
                ground_floors={constructionOverview.ground_floors}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
