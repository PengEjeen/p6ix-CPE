import React, { useEffect, useState, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { RefreshCcw, Maximize2, X } from "lucide-react";
import "../components/cpe/utils/scroll.css";
import { useParams } from "react-router-dom";
import PageHeader from "../components/cpe/PageHeader";
import DataTable from "../components/cpe/DataTable";
import { detailQuotation, updateQuotation, updateQuotationAi } from "../api/cpe/quotation";

export default function Quotation() {
  const { id: projectId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollRef = useRef(null);
  const scrollTimeout = useRef(null);
  const [showModal, setShowModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const hasInitialSyncRef = useRef(false);
  const syncTimerRef = useRef(null);

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

  const getQuotationSignature = (payload) => {
    if (!payload) return "";
    const fields = [
      "preparation_period",
      "earth_retention",
      "support",
      "excavation",
      "designated_work",
      "base_framework",
      "basement_framework",
      "ground_framework",
      "finishing_work",
      "additional_period",
      "cleanup_period",
    ];
    return fields.map((key) => Number(payload[key]) || 0).join("|");
  };

  const startSync = useCallback(() => {
    if (!projectId || !data) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

    let attempt = 0;
    const maxAttempts = 6;
    const baseSignature = getQuotationSignature(data);

    setSyncing(true);

    const poll = async () => {
      attempt += 1;
      try {
        const res = await detailQuotation(projectId);
        const nextSignature = getQuotationSignature(res.data);
        if (nextSignature !== baseSignature) {
          setData(res.data);
          setSyncing(false);
          return;
        }
      } catch (err) {
        console.error("Quotation 동기화 실패:", err);
      }

      if (attempt >= maxAttempts) {
        setSyncing(false);
        return;
      }

      syncTimerRef.current = setTimeout(poll, 1500);
    };

    syncTimerRef.current = setTimeout(poll, 1500);
  }, [projectId, data]);

  useEffect(() => {
    if (loading || !data || hasInitialSyncRef.current) return;
    hasInitialSyncRef.current = true;
    startSync();
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [loading, data, startSync]);

  const handleScroll = () => {
    setIsScrolling(true);
    clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => setIsScrolling(false), 1000);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // AI 분석 요청 + 폴링으로 결과 확인
  const handleGenerateAi = async () => {
    try {
      setAiLoading(true);
      // AI 분석 요청 (비동기 큐 등록)
      await updateQuotationAi(projectId, {});
      console.log("AI 분석 요청 완료. 결과 대기 중...");

      // 폴링 (3초마다 결과 확인)
      const interval = setInterval(async () => {
        try {
          const res = await detailQuotation(projectId);
          if (res.data.ai_response) {
            setData(res.data);
            clearInterval(interval);
            setAiLoading(false);
            console.log("AI 분석 결과 수신 완료!");
          }
        } catch (err) {
          console.error("AI 분석 결과 확인 실패:", err);
        }
      }, 3000); // 3초마다 확인

    } catch (err) {
      console.error("AI 분석 생성 실패:", err);
      alert("AI 분석 생성 중 오류가 발생했습니다.");
      setAiLoading(false);
    }
  };

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

  const toNumber = (value) => {
    if (typeof value === "number") return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatDays = (value) => `${toNumber(value)}일`;

  const earthRetention = toNumber(data.earth_retention);
  const support = toNumber(data.support);
  const excavation = toNumber(data.excavation);
  const designatedWork = toNumber(data.designated_work);
  const baseFramework = toNumber(data.base_framework);
  const basementFramework = toNumber(data.basement_framework);
  const groundFramework = toNumber(data.ground_framework);
  const preparationPeriod = toNumber(data.preparation_period);
  const finishingWork = toNumber(data.finishing_work);
  const additionalPeriod = toNumber(data.additional_period);
  const cleanupPeriod = toNumber(data.cleanup_period);

  const earthworkTotal =
    earthRetention + support + excavation + designatedWork;
  const frameworkTotal = baseFramework + basementFramework + groundFramework;
  const etcTotal =
    preparationPeriod + finishingWork + additionalPeriod + cleanupPeriod;

  // 데이터 테이블
  const rowsEarthwork = [
    { label: "흙막이가시설", calendar: formatDays(earthRetention), remark: data.remark_earth_retention },
    { label: "지보공", calendar: formatDays(support), remark: data.remark_support },
    { label: "터파기", calendar: formatDays(excavation), remark: data.remark_excavation },
    { label: "지정공사", calendar: formatDays(designatedWork), remark: data.remark_designated_work },
    {
      label:
        <span className="text-blue-400 font-semibold text-base bg-[#2f2f45] rounded-md px-2 py-1 inline-block">소계</span>,
      calendar:
        <span className="text-blue-400 font-semibold text-base bg-[#2f2f45] rounded-md px-2 py-1 inline-block">
          {formatDays(earthworkTotal)}
        </span>,
      remark: data.remark_earthwork_total,
    },
  ];

  const rowsFramework = [
    { label: "기초골조", calendar: formatDays(baseFramework), remark: data.remark_base_framework },
    { label: "지하골조", calendar: formatDays(basementFramework), remark: data.remark_basement_framework },
    { label: "지상골조", calendar: formatDays(groundFramework), remark: data.remark_ground_framework },
    {
      label: <span className="text-blue-400 font-semibold text-base bg-[#2f2f45] rounded-md px-2 py-1 inline-block">소계</span>,
      calendar:
        <span className="text-blue-400 font-semibold text-base bg-[#2f2f45] rounded-md px-2 py-1 inline-block">
          {formatDays(frameworkTotal)}
        </span>,
      remark: data.remark_framework_total,
    },
  ];

  const rowsEtc = [
    { label: "준비기간", calendar: formatDays(preparationPeriod), remark: data.remark_preparation },
    { label: "마감공사", calendar: formatDays(finishingWork), remark: data.remark_finishing_work },
    { label: "추가기간", calendar: formatDays(additionalPeriod), remark: data.remark_additional_period },
    { label: "정리기간", calendar: formatDays(cleanupPeriod), remark: data.remark_cleanup_period },
    {
      label: <span className="text-blue-400 font-semibold text-base bg-[#2f2f45] rounded-md px-2 py-1 inline-block">소계</span>,
      calendar:
        <span className="text-blue-400 font-semibold text-base bg-[#2f2f45] rounded-md px-2 py-1 inline-block">
          {formatDays(etcTotal)}
        </span>,
      remark: data.remark_total,
    },
  ];

  // 총합 계산
  const totalDays = earthworkTotal + frameworkTotal + etcTotal;

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
          {/* 상단 헤더: 제목 + 생성/전체보기 버튼 */}
          <div className="bg-[#3a3a4a] px-5 py-4 border-b border-gray-600 flex justify-between items-center">
            <h3 className="text-sm md:text-md font-semibold text-white tracking-wide">
              AI 분석 결과
            </h3>

            <div className="flex items-center gap-2">
              {/* 전체보기 버튼 */}
              <button
                onClick={() => setShowModal(true)}  // ⬅ 모달 열기
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-gray-700 hover:bg-gray-600 text-white transition"
              >
                <Maximize2 size={13} />
                전체보기
              </button>

              {/* 생성 버튼 */}
              <button
                onClick={handleGenerateAi}
                disabled={aiLoading}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition
                      ${aiLoading
                    ? "bg-gray-600 text-gray-300 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                  }`}
              >
                <RefreshCcw
                  size={14}
                  className={aiLoading ? "animate-spin" : ""}
                />
                {aiLoading ? "생성 중..." : "생성"}
              </button>
            </div>
          </div>

          {/* 내용 영역 (Markdown + 스크롤) */}
          <div
            ref={scrollRef}
            className={`scroll-container flex-1 min-h-0 max-h-[70vh] px-5 py-4 space-y-6 overflow-y-auto transition-all duration-300 w-full ${isScrolling ? "scrolling" : ""}`}
          >
            {data.ai_response ? (
              <ReactMarkdown
                components={{
                  h1: ({ node, ...props }) => <h1 {...props} className="text-2xl font-bold text-white mb-3 mt-2" />,
                  h2: ({ node, ...props }) => <h2 {...props} className="text-xl font-semibold text-white mt-4 mb-2" />,
                  h3: ({ node, ...props }) => <h3 {...props} className="text-lg font-semibold text-white mt-3 mb-2" />,
                  p: ({ node, ...props }) => <p {...props} className="my-2 text-gray-300 leading-7" />,
                  strong: ({ node, ...props }) => <strong {...props} className="text-blue-300" />,
                  li: ({ node, ...props }) => <li {...props} className="ml-5 list-disc leading-7 text-gray-300" />,
                }}
              >
                {data.ai_response}
              </ReactMarkdown>
            ) : (
              <p className="text-gray-500 italic">AI 분석 결과가 없습니다.</p>
            )}
          </div>
        </section>

        {/* 전체보기 모달 */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50">
            <div className="bg-[#2c2c3a] w-[80vw] h-[80vh] rounded-xl shadow-2xl flex flex-col border border-gray-700">
              {/* 모달 헤더 */}
              <div className="flex justify-between items-center px-5 py-3 rounded-xl border-b border-gray-600 bg-[#3a3a4a]">
                <h2 className="text-white text-lg font-semibold">AI 분석 결과 전체보기</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-300 hover:text-white transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* 모달 내용 (스크롤 + Markdown) */}
              <div className="flex-1 overflow-y-auto p-6 text-gray-300 leading-relaxed scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                {data.ai_response ? (
                  <ReactMarkdown
                    components={{
                      h1: ({ node, ...props }) => <h1 {...props} className="text-2xl font-bold text-white mb-3" />,
                      h2: ({ node, ...props }) => <h2 {...props} className="text-xl font-semibold text-white mt-3 mb-2" />,
                      h3: ({ node, ...props }) => <h3 {...props} className="text-lg font-semibold text-white mt-2 mb-1" />,
                      p: ({ node, ...props }) => <p {...props} className="my-2 text-gray-300" />,
                      strong: ({ node, ...props }) => <strong {...props} className="text-blue-300" />,
                      li: ({ node, ...props }) => <li {...props} className="ml-6 list-disc" />,
                    }}
                  >
                    {data.ai_response}
                  </ReactMarkdown>
                ) : (
                  <p className="text-gray-500 italic">AI 분석 결과가 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
