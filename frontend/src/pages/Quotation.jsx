import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import PageHeader from "../components/cpe/PageHeader";
import DataTable from "../components/cpe/DataTable";
import { detailQuotation, updateQuotation } from "../api/cpe/quotation";

export default function Quotation() {
  const { id: projectId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef(null);

  // 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await detailQuotation(projectId);
        setData(res.data);
      } catch (err) {
        console.error("Quotation 불러오기 실패:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  // remark 변경
  const handleRemarkChange = (section, index, value) => {
    const updated = { ...data };
    const remarkKeys = {
      earthwork: [
        "remark_earth_retention",
        "remark_support",
        "remark_excavation",
        "remark_designated_work",
        "remark_earthwork_total",
      ],
      framework: [
        "remark_base_framework",
        "remark_basement_framework",
        "remark_ground_framework",
        "remark_framework_total",
      ],
      etc: [
        "remark_preparation",
        "remark_finishing_work",
        "remark_additional_period",
        "remark_cleanup_period",
        "remark_total",
      ],
    };
    const key = remarkKeys[section][index];
    updated[key] = value;
    setData(updated);

    // 입력 중 저장 지연 (2초 디바운스)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      onAutoSave(updated);
    }, 2000);
  };

  // 자동 저장 (debounce된 실제 호출 함수)
  const onAutoSave = useCallback(async (latestData) => {
    try {
      setSaving(true);
      await updateQuotation(projectId, latestData);
    } catch (error) {
      console.error("Quotation 자동 저장 실패:", error);
    } finally {
      setSaving(false);
    }
  }, [projectId]);

  // cleanup (unmount 시 타이머 제거)
  useEffect(() => {
    return () => clearTimeout(saveTimeoutRef.current);
  }, []);

  if (loading) return <p className="p-6 text-gray-400">불러오는 중...</p>;
  if (!data) return <p className="p-6 text-gray-400">데이터 없음</p>;

  // 공통 컬럼
  const columns = [
    { key: "label", label: "공종" },
    { key: "calendar", label: "공사기간 (일)" },
    { key: "remark", label: "비고", editable: true, type: "text" },
  ];

  // 데이터 테이블
  const rowsEarthwork = [
    { label: "흙막이가시설", calendar: data.earth_retention+"일", remark: data.remark_earth_retention },
    { label: "지보공", calendar: data.support+"일", remark: data.remark_support },
    { label: "터파기", calendar: data.excavation+"일", remark: data.remark_excavation },
    { label: "지정공사", calendar: data.designated_work+"일", remark: data.remark_designated_work },
    {
      label:
         <span className="text-blue-400 font-semibold text-base bg-[#2f2f45] rounded-md px-2 py-1 inline-block">소계</span>,
      calendar:
        <span className="text-blue-400 font-semibold text-base bg-[#2f2f45] rounded-md px-2 py-1 inline-block">
        {data.earth_retention +
            data.support +
            data.excavation +
            data.designated_work}
        일
        </span>,
      remark: data.remark_earthwork_total,
    },
  ];

  const rowsFramework = [
    { label: "기초골조", calendar: data.base_framework+"일", remark: data.remark_base_framework },
    { label: "지하골조", calendar: data.basement_framework+"일", remark: data.remark_basement_framework },
    { label: "지상골조", calendar: data.ground_framework+"일", remark: data.remark_ground_framework },
    {
      label: <span className="text-blue-400 font-semibold text-base bg-[#2f2f45] rounded-md px-2 py-1 inline-block">소계</span>,
      calendar:
        <span className="text-blue-400 font-semibold text-base bg-[#2f2f45] rounded-md px-2 py-1 inline-block">
        {data.base_framework +
            data.basement_framework +
            data.ground_framework+"일"}
        </span>,
      remark: data.remark_framework_total,
    },
  ];

  const rowsEtc = [
    { label: "준비기간", calendar: data.preparation_period+"일", remark: data.remark_preparation },
    { label: "마감공사", calendar: data.finishing_work+"일", remark: data.remark_finishing_work },
    { label: "추가기간", calendar: data.additional_period+"일", remark: data.remark_additional_period },
    { label: "정리기간", calendar: data.cleanup_period+"일", remark: data.remark_cleanup_period },
    {
        label: <span className="text-blue-400 font-semibold text-base bg-[#2f2f45] rounded-md px-2 py-1 inline-block">소계</span>,
        calendar:
        <span className="text-blue-400 font-semibold text-base bg-[#2f2f45] rounded-md px-2 py-1 inline-block">
            {data.preparation_period +
            data.finishing_work +
            data.additional_period+
            data.cleanup_period+"일"}
        </span>,
      remark: data.remark_framework_total,
    },
];

  // 총합 계산
  const totalDays =
    data.preparation_period +
    data.earth_retention +
    data.support +
    data.excavation +
    data.designated_work +
    data.base_framework +
    data.basement_framework +
    data.ground_framework +
    data.finishing_work +
    data.additional_period +
    data.cleanup_period;

  const totalMonths = Math.round(totalDays / 30.5);

    return (
        <div className="p-6 text-gray-200">
            <PageHeader
            title="공사기간 견적서"
            description="공종별 공사기간 요약 및 AI 분석 결과"
            />

            {/* 전체 그리드: 왼쪽(본문) + 오른쪽(AI 결과) */}
            <div className="grid grid-cols-1 xl:grid-cols-[3.6fr_1fr] gap-6 mt-6 items-start">
            {/* 왼쪽 본문 전체 */}
            <div className="flex flex-col space-y-6">
                {/* 기본 정보 섹션 */}
                <section className="rounded-xl overflow-hidden shadow-lg bg-[#2c2c3a] border border-gray-700">
                <div className="bg-[#3a3a4a] px-4 py-2 border-b border-gray-600">
                    <h3 className="text-sm md:text-md font-semibold text-white">
                    기본 정보
                    </h3>
                </div>
                <div className="p-4 text-gray-300 text-sm md:text-base space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                    <span className="font-semibold text-white w-28">공사명</span>
                    <span className="flex-1 border-b border-gray-700 pb-1">
                        {data.project_title || "—"}
                    </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                    <span className="font-semibold text-white w-28">공사 규모</span>
                    <span className="flex-1 border-b border-gray-700 pb-1">
                        지하 {data.construction_overview?.basement_floors ?? "—"}층 / 지상{" "}
                        {data.construction_overview?.ground_floors ?? "—"}층 /{" "}
                        {data.construction_overview?.building_use || "—"}
                    </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                    <span className="font-semibold text-white w-28">공사 면적</span>
                    <span className="flex-1 border-b border-gray-700 pb-1">
                        대지면적 : {data.construction_overview?.site_area ?? "—"}㎡ / 연면적 :{" "}
                        {data.construction_overview?.total_floor_area ?? "—"}㎡
                    </span>
                    </div>
                </div>
                </section>

                {/* 세 공사 구분 */}
                <div className="flex flex-col xl:flex-row gap-4">
                {/* 토공사 */}
                <section className="flex-1 rounded-xl overflow-hidden shadow-lg bg-[#2c2c3a] border border-gray-700">
                    <div className="bg-[#3a3a4a] px-4 py-2 border-b border-gray-600">
                    <h3 className="text-sm md:text-md font-semibold text-white">토공사</h3>
                    </div>
                    <div className="p-4">
                    <DataTable
                        columns={columns}
                        rows={rowsEarthwork}
                        onChange={(i, k, v) => {
                        if (k === "remark") handleRemarkChange("earthwork", i, v);
                        }}
                        onAutoSave={onAutoSave}
                    />
                    </div>
                </section>

                {/* 골조공사 */}
                <section className="flex-1 rounded-xl overflow-hidden shadow-lg bg-[#2c2c3a] border border-gray-700">
                    <div className="bg-[#3a3a4a] px-4 py-2 border-b border-gray-600">
                    <h3 className="text-sm md:text-md font-semibold text-white">골조공사</h3>
                    </div>
                    <div className="p-4">
                    <DataTable
                        columns={columns}
                        rows={rowsFramework}
                        onChange={(i, k, v) => {
                        if (k === "remark") handleRemarkChange("framework", i, v);
                        }}
                        onAutoSave={onAutoSave}
                    />
                    </div>
                </section>

                {/* 기타 기간 */}
                <section className="flex-1 rounded-xl overflow-hidden shadow-lg bg-[#2c2c3a] border border-gray-700">
                    <div className="bg-[#3a3a4a] px-4 py-2 border-b border-gray-600">
                    <h3 className="text-sm md:text-md font-semibold text-white">기타 기간</h3>
                    </div>
                    <div className="p-4">
                    <DataTable
                        columns={columns}
                        rows={rowsEtc}
                        onChange={(i, k, v) => {
                        if (k === "remark") handleRemarkChange("etc", i, v);
                        }}
                        onAutoSave={onAutoSave}
                    />
                    </div>
                </section>
                </div>

                {/* 총 공사기간 */}
                <section className="bg-gradient-to-r from-indigo-600 to-blue-500 rounded-xl p-5 text-center text-white shadow">
                <h3 className="text-lg font-bold mb-1">총 공사기간</h3>
                <p className="text-4xl font-extrabold">{totalDays}일</p>
                <p className="text-sm opacity-90">약 {totalMonths}개월</p>
                </section>
            </div>

            {/* 오른쪽: AI 분석 결과 (위아래 꽉 차게) */}
            <section className="rounded-xl overflow-hidden shadow-lg bg-[#2c2c3a] border border-gray-700 flex flex-col h-full">
                <div className="bg-[#3a3a4a] px-4 py-2 border-b border-gray-600">
                <h3 className="text-sm md:text-md font-semibold text-white">
                    AI 분석 결과
                </h3>
                </div>
                <div className="p-4 text-gray-300 whitespace-pre-line leading-relaxed flex-1 overflow-y-auto">
                {data.ai_response ? (
                    data.ai_response
                ) : (
                    <p className="text-gray-500 italic">AI 분석 결과가 없습니다.</p>
                )}
                </div>
            </section>
            </div>
        </div>
    );

}
