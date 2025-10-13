import { useLocation, useNavigate } from "react-router-dom";
import React, { useState } from "react";
import { Bell } from "lucide-react";
import AlertDropdown from "../alerts/AlertDropdown";

function Header({ username }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [spin, setSpin] = useState(false);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const projects = JSON.parse(localStorage.getItem("projects") || "[]");

  const projectId = localStorage.getItem("projectId");
  const isSelectProjectPage = location.pathname.startsWith("/select-project");

  const [open, setOpen] = useState(false); // alert

  const goDashboard = () =>
    projectId ? navigate(`/project/${projectId}`) : navigate("/select-project");
  const goSystem = () => {
    setSpin(true);
    navigate(
      projectId ? `/project/${projectId}/system/user` : "/select-project"
    );
    setTimeout(() => setSpin(false), 900);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <nav className="w-full bg-[#1e1e2f] text-white">
      {/* ★ 절대 'mx-auto / max-w-* / container' 쓰지 말 것 */}
      <div className="w-full px-4 py-3 flex items-center justify-between">
        {/* 왼쪽: PMIS */}
        <button
          onClick={goDashboard}
          className="font-bold tracking-wide hover:opacity-90"
        >
          PMIS
        </button>

        {/* 오른쪽: 메뉴 */}
        <div className="ml-auto flex items-center gap-2">
          {projectId ? (
            <button
              onClick={goSystem}
              title={projectId ? "시스템 관리" : "프로젝트 선택 필요"}
              aria-label="시스템 관리"
              className="group p-2 rounded-lg hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40 leading-none"
            >
              <img
                src={`${process.env.PUBLIC_URL}/duck.ico`}
                alt="오리 아이콘"
                className={`h-7 w-7 shrink-0 ${
                  spin ? "animate-spin" : ""
                } group-hover:animate-spin`}
              />
            </button>
          ): null }

          <span className="hidden sm:inline-block mr-1">{user.name}</span>
          
          {projectId ? (
          <div className="relative">
            <button
              onClick={() => setOpen(!open)}
              aria-label="알림"
              className="relative p-2 rounded-full hover:bg-gray-700"
            >
              <Bell size={20} />
            </button>
            <AlertDropdown isOpen={open} setOpen={setOpen} />
          </div>
          ) : null}

          {projects.length > 1 && !isSelectProjectPage && (
            <button onClick={() => {
              localStorage.removeItem("projectId");
              navigate("/select-project");
            }}>
              프로젝트 변경
            </button>
          )}
          <button onClick={handleLogout}>로그아웃</button>
        </div>
      </div>
    </nav>
  );
}

export default Header;
