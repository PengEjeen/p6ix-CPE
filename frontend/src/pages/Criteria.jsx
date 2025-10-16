import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import PageHeader from "../components/cpe/PageHeader";
import SaveButton from "../components/cpe/SaveButton";

// 공사별 섹션
import PreparationSection from "../components/cpe/criteria/PreparationSection";
import EarthworkSection from "../components/cpe/criteria/EarthworkSection";
import FrameworkSection from "../components/cpe/criteria/FrameworkSection";

import {
  detailPreparationWork,
  updatePreparationWork,
  detailEarthwork,
  updateEarthwork,
  detailFramework,
  updateFramework,
} from "../api/cpe/criteria";

export default function Criteria() {
  const { id: projectId } = useParams();
  const [preparation, setPreparation] = useState({});
  const [earthwork, setEarthwork] = useState({});
  const [framework, setFramework] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 데이터 로드
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [prep, earth, frame] = await Promise.all([
          detailPreparationWork(projectId),
          detailEarthwork(projectId),
          detailFramework(projectId),
        ]);
        setPreparation(prep || {});
        setEarthwork(earth || {});
        setFramework(frame || {});
      } catch (error) {
        console.error("적용기준 불러오기 실패:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [projectId]);

  // 자동 저장 핸들러 (각 섹션에서 호출)
  const handleAutoSave = async (section, data) => {
    try {
      if (section === "preparation") await updatePreparationWork(projectId, data);
      if (section === "earthwork") await updateEarthwork(projectId, data);
      if (section === "framework") await updateFramework(projectId, data);
    } catch (err) {
      console.error(`${section} 저장 실패:`, err);
    }
  };

  // 전체 수동 저장 (버튼 클릭 시)
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updatePreparationWork(projectId, preparation),
        updateEarthwork(projectId, earthwork),
        updateFramework(projectId, framework),
      ]);
    } catch (err) {
      console.error("전체 저장 실패:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-gray-400">불러오는 중...</div>;

  return (
    <div className="p-6 text-gray-200 space-y-6">
      <PageHeader title="적용기준" description="프로젝트별 기준값 관리" />
      {/* 하단 전체 저장 버튼 */}
      <div className="flex justify-end">
        <SaveButton onSave={handleSaveAll} saving={saving} />
      </div>
      {/* 공사별 영역: 가로 칸반 스타일 */}
      <div className="flex gap-6 overflow-x-auto pb-4">
        {/* 준비·정리·가설·마감공사 */}
        <div className="min-w-[450px] flex-shrink-0">
          <h2 className="text-lg font-semibold text-white text-center mb-2">
            준비·정리·가설·마감공사
          </h2>
          <PreparationSection
            data={preparation}
            setData={setPreparation}
            onAutoSave={(data) => handleAutoSave("preparation", data)}
          />
        </div>

        {/* 토공사 */}
        <div className="min-w-[450px] flex-shrink-0">
          <h2 className="text-lg font-semibold text-white text-center mb-2">
            토공사
          </h2>
          <EarthworkSection
            data={earthwork}
            setData={setEarthwork}
            onAutoSave={(data) => handleAutoSave("earthwork", data)}
          />
        </div>

        {/* 골조공사 */}
        <div className="min-w-[450px] flex-shrink-0">
          <h2 className="text-lg font-semibold text-white text-center mb-2">
            골조공사
          </h2>
          <FrameworkSection
            data={framework}
            setData={setFramework}
            onAutoSave={(data) => handleAutoSave("framework", data)}
          />
        </div>
      </div>
    </div>
  );
}
