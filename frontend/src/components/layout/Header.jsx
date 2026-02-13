import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { detailProject } from "../../api/cpe/project";
import { exportScheduleReport } from "../../api/cpe_all/construction_schedule";
import toast from "react-hot-toast";
import {
  FiChevronDown, FiChevronUp, FiDownload
} from "react-icons/fi";

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // 항상 호출되지만, 내부에서 id 체크
  useEffect(() => {
    const loadProject = async () => {
      if (!id) return;
      try {
        const data = await detailProject(id);
        setProject(data);
      } catch (error) {
        console.error("프로젝트 정보 로드 실패:", error);
      }
    };
    loadProject();
  }, [id]);

  const apartmentMenus = [
    {
      name: "갑지",
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
    {
      name: "가동률",
      desc: "작업 가동률 입력 및 자동 계산",
      path: `/projects/${id}/operating_rate`,
    },
  ];

  const totalMenus = [
    {
      name: "공사기간 산정 기준",
      desc: "공정별 생산성 데이터 및 공기 산정 기준",
      path: `/projects/${id}/schedule-master`,
    },
    {
      name: "표준품셈",
      desc: "공종별 표준품셈 및 생산성 데이터",
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
    {
      name: "가동률",
      desc: "작업 가동률 입력 및 자동 계산",
      path: `/projects/${id}/operating_rate`,
    },
  ];

  const menus = project?.calc_type === "TOTAL" ? totalMenus : apartmentMenus;

  const activeMenu =
    menus.find((m) => location.pathname === m.path) || menus[0];

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
      toast.success("보고서 내보내기 완료");
    } catch (error) {
      console.error("보고서 내보내기 실패:", error);
      toast.error("보고서 내보내기 실패");
    } finally {
      setIsExporting(false);
    }
  };

  // 여기서 렌더 제한 (Hook 이후에 return)
  if (!id) return null;

  return (
    <header className="w-full border-b border-gray-700 bg-[#1e1e2f] text-white px-6 py-3 flex items-start justify-between relative z-[10000] shadow-md shadow-black/20 gap-4">
      <div className="relative flex flex-col items-start">
        <div className="flex items-center gap-2">
          {/* 드롭다운 버튼 */}
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-3 px-5 py-2.5 rounded-md hover:bg-[#3b3b4f] transition"
          >
            <span className="font-bold text-xl text-white">
              {project?.title || "로딩 중..."}
            </span>
            <span className="font-medium text-lg">{activeMenu.name}</span>
            {open ? (
              <FiChevronUp className="transition-transform duration-300" size={25} />
            ) : (
              <FiChevronDown className="transition-transform duration-300" size={25} />
            )}
          </button>

          {project?.calc_type === "TOTAL" && (
            <button
              type="button"
              onClick={handleExportReport}
              disabled={isExporting}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${isExporting
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
        <span className="ml-5 mt-1 text-sm text-gray-400">
          {project?.description || "프로젝트 설명이 없습니다."}
        </span>

        {/* 드롭다운 메뉴 */}
        {open && (
          <div className="absolute top-full left-0 mt-3 w-60 bg-[#2c2c3a] border border-gray-700 rounded-md shadow-lg z-[10001] divide-y divide-gray-700">
            {menus.map((menu) => (
              <button
                key={menu.path}
                onClick={() => {
                  navigate(menu.path);
                  setOpen(false);
                }}
                className={`block w-full text-left px-4 py-3 transition ${location.pathname === menu.path
                  ? "bg-[#3b3b4f] text-white"
                  : "hover:bg-[#3b3b4f] text-gray-300"
                  }`}
              >
                <div className="font-medium text-base">{menu.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{menu.desc}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>

  );
}

export default Header;
