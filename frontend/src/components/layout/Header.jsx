import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { detailProject } from "../../api/cpe/project";
import { exportScheduleReport } from "../../api/cpe_all/construction_schedule";
import toast from "react-hot-toast";
import {
  FiChevronDown, FiChevronUp, FiDownload
} from "react-icons/fi";
import { useTheme } from "../../contexts/ThemeContext";
import isUuid from "../../utils/isUuid";
import { markFtueDone } from "../../utils/ftue";
import { FTUE_STEP_IDS } from "../../config/ftueSteps";

const REPORT_EXPORT_AT_KEY = "p6ix_last_report_export_at";
const REPORT_EXPORTED_EVENT = "p6ix_report_exported";

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [openGroupKey, setOpenGroupKey] = useState(null);
  const [project, setProject] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportGuideModal, setShowExportGuideModal] = useState(false);
  const { theme, setTheme } = useTheme();

  // 항상 호출되지만, 내부에서 id 체크
  useEffect(() => {
    const loadProject = async () => {
      if (!id) return;
      if (!isUuid(id)) return;
      try {
        const data = await detailProject(id);
        setProject(data);
      } catch (error) {
        console.error("프로젝트 정보 로드 실패:", error);
      }
    };
    loadProject();
  }, [id]);

  const apartmentMenuGroups = [
    {
      key: "calc",
      name: "공기산정",
      items: [
        {
          name: "프로젝트",
          desc: "프로젝트 개요 및 기본정보 관리",
          path: `/projects/${id}`,
        },
        {
          name: "공기산정",
          desc: "전체 공사 기간 산정 및 분석",
          path: `/projects/${id}/calc`,
        },
        {
          name: "적용기준",
          desc: "산정 기준값 및 조건 설정",
          path: `/projects/${id}/criteria`,
        },
      ],
    },
    {
      key: "operating",
      name: "가동률",
      items: [
        {
          name: "가동률",
          desc: "작업 가동률 입력 및 자동 계산",
          path: `/projects/${id}/operating_rate`,
        },
      ],
    },
  ];

  const totalMenuGroups = [
    {
      key: "calc",
      name: "공기산정",
      items: [
        {
          name: "공기산정기준",
          desc: "공정별 생산성 데이터 및 공기 산정 기준",
          path: `/projects/${id}/schedule-master`,
        },
        {
          name: "요약장표",
          desc: "공기산정 결과 요약 및 비고 정리",
          path: `/projects/${id}/summary`,
        },
      ],
    },
    {
      key: "productivity",
      name: "생산성 데이터",
      items: [
        {
          name: "표준품셈",
          desc: "세부공종별 표준품셈 및 생산성 데이터",
          path: `/projects/${id}/total-calc`,
        },
        {
          name: "CIP 생산성 근거",
          desc: "CIP 공법 생산성 산출 근거",
          path: `/projects/${id}/cip-basis`,
        },
        {
          name: "기성말뚝 생산성 근거",
          desc: "기성말뚝 기초 생산성 산출 근거",
          path: `/projects/${id}/pile-basis`,
        },
        {
          name: "현장타설말뚝 생산성 근거",
          desc: "현장타설말뚝 생산성 산출 근거",
          path: `/projects/${id}/bored-pile-basis`,
        },
      ],
    },
    {
      key: "operating",
      name: "가동률",
      items: [
        {
          name: "가동률",
          desc: "작업 가동률 입력 및 자동 계산",
          path: `/projects/${id}/operating_rate`,
        },
      ],
    },
  ];

  const menuGroups = project?.calc_type === "TOTAL" ? totalMenuGroups : apartmentMenuGroups;
  const menus = menuGroups.flatMap((group) => group.items);

  const activeMenu =
    menus.find((m) => location.pathname === m.path) || menus[0];
  const activeGroup =
    menuGroups.find((group) => group.items.some((item) => item.path === activeMenu?.path)) || menuGroups[0];
  useEffect(() => {
    setOpenGroupKey(null);
  }, [location.pathname, id]);

  const themeOptions = [
    { key: "white", label: "화이트" },
    { key: "navy", label: "네이비" },
    { key: "dark", label: "다크" },
    { key: "brown", label: "브라운" },
  ];

  const handleExportReport = async () => {
    if (!id || isExporting) return;
    setIsExporting(true);
    try {
      const response = await exportScheduleReport(id);
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeProject = (project?.title || "프로젝트").replace(/[\\/:*?"<>|]/g, "_");
      link.download = `보고서_${safeProject}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      localStorage.setItem(REPORT_EXPORT_AT_KEY, String(Date.now()));
      // FTUE 이중 안전장치: 이벤트 dispatch 외 직접 markDone도 호출 (다른 탭 분리 대응)
      markFtueDone("TOTAL", "export_report", FTUE_STEP_IDS.TOTAL);
      window.dispatchEvent(new Event(REPORT_EXPORTED_EVENT));
      toast.success("보고서 내보내기 완료");
      setShowExportGuideModal(true);
    } catch (error) {
      console.error("보고서 내보내기 실패:", error);
      toast.error("보고서 내보내기 실패");
    } finally {
      setIsExporting(false);
    }
  };

  // 여기서 렌더 제한 (Hook 이후에 return)
  if (!id || !isUuid(id)) return null;

  return (
    <>
      <header className="w-full border-b border-gray-700 bg-[#1e1e2f] text-white px-6 py-3.5 flex items-start justify-between relative z-[40] shadow-md shadow-black/20 gap-4">
        <div className="relative flex flex-col items-start">
          <div className="flex items-center gap-3">
            <span className="font-bold text-2xl text-white px-2">
              {project?.title || "로딩 중..."}
            </span>

            <div className="inline-flex items-center gap-1 rounded-lg border border-gray-700 bg-[#2a2a3a] p-1">
              {menuGroups.map((group) => {
                const isActive = group.key === activeGroup?.key;
                const isOpen = group.key === openGroupKey;
                const hasDropdown = group.items.length > 1;
                return (
                  <div key={group.key} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (!hasDropdown) {
                          navigate(group.items[0].path);
                          setOpenGroupKey(null);
                          return;
                        }
                        setOpenGroupKey((prev) => (prev === group.key ? null : group.key));
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-base font-semibold transition ${isActive
                        ? "bg-[#3b3b4f] text-white"
                        : "text-gray-300 hover:bg-[#3b3b4f] hover:text-white"
                        }`}
                    >
                      <span>{group.name}</span>
                      {hasDropdown && (
                        isOpen
                          ? <FiChevronUp size={14} />
                          : <FiChevronDown size={14} />
                      )}
                    </button>
                    {hasDropdown && isOpen && (
                      <div className="absolute left-0 top-[calc(100%+8px)] w-72 bg-[#2c2c3a] border border-gray-700 rounded-md shadow-lg z-[60] divide-y divide-gray-700">
                        {group.items.map((menu) => (
                          <button
                            key={menu.path}
                            onClick={() => {
                              navigate(menu.path);
                              setOpenGroupKey(null);
                            }}
                            className={`block w-full text-left px-4 py-3 transition ${location.pathname === menu.path
                              ? "bg-[#3b3b4f] text-white"
                              : "hover:bg-[#3b3b4f] text-gray-300"
                              }`}
                          >
                            <div className="font-semibold text-lg">{menu.name}</div>
                            <div className="text-sm text-gray-400 mt-0.5">{menu.desc}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {project?.calc_type === "TOTAL" && (
              <button
                type="button"
                onClick={handleExportReport}
                disabled={isExporting}
                className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-base font-semibold transition ${isExporting
                  ? "cursor-not-allowed border-gray-700 bg-[#2a2a3a] text-gray-500"
                  : "border-gray-600 bg-[#3b3b4f] text-gray-100 hover:bg-[#4b4b5f]"
                  }`}
              >
                <FiDownload size={16} />
                {isExporting ? "내보내는 중..." : "보고서 내보내기"}
              </button>
            )}
          </div>

          {/* 프로젝트 설명 */}
          <div className="ml-2 mt-1 flex items-center gap-3 text-base">
            <span className="text-gray-300 font-semibold">{activeMenu?.name}</span>
            <span className="text-gray-500">|</span>
            <span className="text-gray-400">{project?.description || "프로젝트 설명이 없습니다."}</span>
          </div>

        </div>

        <div className="flex items-center gap-1 rounded-lg border border-gray-600 bg-[#2a2a3a] p-1">
          {themeOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setTheme(opt.key)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-md transition ${theme === opt.key
                ? "bg-[#3b3b4f] text-white"
                : "text-gray-300 hover:bg-[#3b3b4f]"
                }`}
              aria-pressed={theme === opt.key}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      {showExportGuideModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div className="w-[460px] max-w-[92vw] rounded-2xl border border-gray-700 bg-[#2c2c3a] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700 bg-[#3a3a4a]">
              <h3 className="text-lg font-semibold text-gray-100">보고서 확인 안내</h3>
            </div>
            <div className="px-6 py-6 text-sm text-gray-300 whitespace-pre-line leading-relaxed">
              {"Word에서 목차 페이지 번호가 바로 갱신되지 않으면\n문서를 연 뒤 Ctrl + A 후 F9를 눌러 필드를 업데이트해 주세요."}
            </div>
            <div className="px-6 py-4 flex justify-end border-t border-gray-700 bg-[#2c2c3a]">
              <button
                type="button"
                onClick={() => setShowExportGuideModal(false)}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Header;
