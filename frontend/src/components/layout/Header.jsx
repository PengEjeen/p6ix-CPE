import React from "react";
import { useNavigate } from "react-router-dom";

function Header() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <nav className="w-full bg-[#1e1e2f] text-white border-b border-gray-700 shadow-sm">
      {/* flex로 좌우 정렬 */}
      <div className="flex justify-between items-center px-6 py-3 w-full">
        {/* 왼쪽: 플랫폼명 */}
        <button
          onClick={() => navigate("/")}
          className="font-bold tracking-wide hover:opacity-90"
        >
          공기산정
        </button>

        {/* 오른쪽: 유저 정보 */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-300">{user.name || "Guest"}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-white border border-gray-500 rounded px-2 py-1 transition"
          >
            로그아웃
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Header;
