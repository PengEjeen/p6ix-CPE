import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { detailProject } from "../../api/cpe/project";

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState(null);

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

  const menus = [
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

  const activeMenu =
    menus.find((m) => location.pathname === m.path) || menus[0];

  // 여기서 렌더 제한 (Hook 이후에 return)
  if (!id) return null;

  return (
    <header className="w-full border-b border-gray-700 bg-[#1e1e2f] text-white px-6 py-3 flex flex-col items-start justify-center relative shadow-md shadow-black/20">
      <div className="relative flex flex-col items-start">
        {/* 드롭다운 버튼 */}
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-3 px-5 py-2.5 rounded-md hover:bg-[#3b3b4f] transition"
        >
          <span className="font-bold text-xl text-white">
            {project?.title || "로딩 중..."}
          </span>
          <span className="font-medium text-lg">{activeMenu.name}</span>
          <span
            className={`transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          >
            ▼
          </span>
        </button>

        {/* 프로젝트 설명 */}
        <span className="ml-5 mt-1 text-sm text-gray-400">
          {project?.description || "프로젝트 설명이 없습니다."}
        </span>

        {/* 드롭다운 메뉴 */}
        {open && (
          <div className="absolute top-full left-0 mt-3 w-60 bg-[#2c2c3a] border border-gray-700 rounded-md shadow-lg z-20 divide-y divide-gray-700">
            {menus.map((menu) => (
              <button
                key={menu.path}
                onClick={() => {
                  navigate(menu.path);
                  setOpen(false);
                }}
                className={`block w-full text-left px-4 py-3 transition ${
                  location.pathname === menu.path
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
