import React, { useEffect, useState } from "react";
import { useParams, useBlocker } from "react-router-dom";
import toast from "react-hot-toast";
import ConstructionOverviewSection from "../components/cpe/calc/ConstructionOverviewSection";
import WorkConditionSection from "../components/cpe/calc/WorkConditionSection";
import EarthworkInputSection from "../components/cpe/calc/EarthworkInputSection";
import FrameworkInputSection from "../components/cpe/calc/FrameworkInputSection";
import PreparationPeriodSection from "../components/cpe/calc/PreparationPeriodSection";
import PageHeader from "../components/cpe/PageHeader";
import { detailProject } from "../api/cpe/project";

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

  const [earthWorkInput, setEarthWorkInput] = useState({
    is_sunta: null,
    total_working_day: null,
    total_calendar_day: null
  })

  const [frameWorkInput, setFrameWorkInput] = useState({
    total_working_day: null,
    total_calendar_day: null
  });

  const [calcType, setCalcType] = useState(null);
  const [projectLoading, setProjectLoading] = useState(true);

  // Quotation 저장 상태 추적
  const [savingStates, setSavingStates] = useState({
    earthwork: false,
    framework: false,
    preparation: false,
  });

  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) return;
      try {
        const res = await detailProject(projectId);
        setCalcType(res.calc_type || "APARTMENT");
      } catch (error) {
        console.error("프로젝트 불러오기 실패:", error);
      } finally {
        setProjectLoading(false);
      }
    };
    fetchProject();
  }, [projectId]);

  // Navigation Blocking Logic
  const isSaving = savingStates.earthwork || savingStates.framework || savingStates.preparation;

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isSaving && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === "blocked") {
      toast.error("저장 중입니다. 잠시만 기다려주세요.");
      blocker.reset();
    }
  }, [blocker.state]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isSaving) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isSaving]);
  if (projectLoading) {
    return (
      <div className="p-6 overflow-x-auto">
        <PageHeader
          title="공기산정 입력"
          description="전체 공사기간 산정 및 분석"
        />
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  if (calcType === "TOTAL") {
    return (
      <div className="p-6 overflow-x-auto">
        <PageHeader
          title="공기산정 입력"
          description="전체 공사기간 산정 및 분석"
        />
      </div>
    );
  }

  return (
    <div className="p-6 overflow-x-auto">
      {/* 상단 페이지 제목 */}
      <PageHeader
        title="공기산정 입력"
        description="전체 공사기간 산정 및 분석"
      />

      {/* Quotation 저장 상태 표시 */}
      {(savingStates.earthwork || savingStates.framework || savingStates.preparation) && (
        <div className="mb-4 px-4 py-2 bg-blue-900/30 border border-blue-500/50 rounded-lg flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
          <span className="text-sm text-blue-300">갑지 업데이트 중...</span>
        </div>
      )}

      {/* 전체 레이아웃 */}
      <div className="flex overflow-x-auto gap-6 pb-4 no-scrollbar">
        <div className="flex flex-nowrap justify-start items-start gap-8">
          {/* === 공사개요 === */}
          <div className="min-w-[360px]">
            <div className="bg-[#2c2c3a] rounded-xl border border-gray-700 shadow-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-white text-center mb-3 border-b border-gray-600 pb-1">
                공사개요
              </h2>
              <ConstructionOverviewSection
                projectId={projectId}
                onOverviewChange={(vals) => setConstructionOverview(vals)}
              />
            </div>
          </div>

          {/* === 근무조건 + 골조공사 === */}
          <div className="min-w-[420px]">
            <div className="bg-[#2c2c3a] rounded-xl border border-gray-700 shadow-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-white text-center mb-3 border-b border-gray-600 pb-1">
                근무조건 및 가동률
              </h2>
              <WorkConditionSection
                projectId={projectId}
                onUtilizationChange={(vals) => setUtilization(vals)}
              />
            </div>
            <div className="bg-[#2c2c3a] rounded-xl border border-gray-700 shadow-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-white text-center mb-3 border-b border-gray-600 pb-1">
                공사기간
              </h2>
              <PreparationPeriodSection
                projectId={projectId}
                ground_floor={constructionOverview.ground_floors}
                earthwork_day={{
                  total_calendar_day: earthWorkInput.total_calendar_day,
                  total_working_day: earthWorkInput.total_working_day
                }}
                framework_day={{
                  total_calendar_day: frameWorkInput.total_calendar_day,
                  total_working_day: frameWorkInput.total_working_day
                }}
                onSavingChange={(saving) => setSavingStates(prev => ({ ...prev, preparation: saving }))}
              />
            </div>
            <div className="bg-[#2c2c3a] rounded-xl border border-gray-700 shadow-lg p-4">
              <h2 className="text-lg font-semibold text-white text-center mb-3 border-b border-gray-600 pb-1">
                골조공사
              </h2>
              <FrameworkInputSection
                projectId={projectId}
                basement_floors={constructionOverview.basement_floors}
                ground_floors={constructionOverview.ground_floors}
                utilization={utilization.framework}
                is_sunta={earthWorkInput.is_sunta}
                onFrameworkInputChange={(vals) => setFrameWorkInput(vals)}
                onSavingChange={(saving) => setSavingStates(prev => ({ ...prev, framework: saving }))}
              />
            </div>
          </div>

          {/* === 토공사 === */}
          <div className="min-w-[420px]">
            <div className="bg-[#2c2c3a] rounded-xl border border-gray-700 shadow-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-white text-center mb-3 border-b border-gray-600 pb-1">
                토공사
              </h2>
              <EarthworkInputSection
                projectId={projectId}
                utilization={utilization.earthwork}
                nearby_env={constructionOverview.nearby_env}
                onEarthWorkInputChange={(vals) => setEarthWorkInput(vals)}
                onSavingChange={(saving) => setSavingStates(prev => ({ ...prev, earthwork: saving }))}
              />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
