import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Header from "./Header";

function Layout() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false); // 드롭다운 상태

  useEffect(() => {
    const access = localStorage.getItem("access");
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (!access || !user?.id) navigate("/login");
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* 상단 헤더 */}
      <Header />

      {/* 아래 영역: 사이드 + 메인 */}
      <div className="flex flex-1">
        {/* 왼쪽 사이드바 */}
        <aside className="w-56 bg-[#2c2c3a] text-white border-r border-gray-700 flex flex-col">
          <nav className="flex-1 p-4 space-y-2">

            {/* ▼ 드롭다운 메뉴 */}
            <div className="relative">
              <button
                onClick={() => setOpen(!open)}
                className="w-full flex justify-between items-center px-3 py-2 rounded hover:bg-[#3b3b4f] transition"
              >
                <span>선택 ▼</span>
                <span className={`transition-transform ${open ? "rotate-180" : ""}`}>
                </span>
              </button>

              {open && (
                <div className="absolute left-0 mt-1 w-full bg-[#3b3b4f] rounded shadow-lg z-10">
                  <button
                    onClick={() => {
                      navigate("/");
                      setOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 hover:bg-[#4a4a60] transition"
                  >
                    옵션 1
                  </button>
                  <button
                    onClick={() => {
                      navigate("/");
                      setOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 hover:bg-[#4a4a60] transition"
                  >
                    옵션 2
                  </button>
                  <button
                    onClick={() => {
                      navigate("/");
                      setOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 hover:bg-[#4a4a60] transition"
                  >
                    옵션 3
                  </button>
                </div>
              )}
            </div>

            {/* 일반 메뉴 */}
            <button
              onClick={() => navigate("/")}
              className="block w-full text-left px-3 py-2 rounded hover:bg-[#3b3b4f] transition"
            >
              홈
            </button>
            <button
              onClick={() => navigate("/")}
              className="block w-full text-left px-3 py-2 rounded hover:bg-[#3b3b4f] transition"
            >
              공기산정
            </button>
            <button
              onClick={() => navigate("/")}
              className="block w-full text-left px-3 py-2 rounded hover:bg-[#3b3b4f] transition"
            >
              적용기준
            </button>
            <button
              onClick={() => navigate("/")}
              className="block w-full text-left px-3 py-2 rounded hover:bg-[#3b3b4f] transition"
            >
              가동률
            </button>
            <button
              onClick={() => navigate("/")}
              className="block w-full text-left px-3 py-2 rounded hover:bg-[#3b3b4f] transition"
            >
              기상청: 예시...
            </button>
          </nav>
        </aside>

        {/* 오른쪽 메인 영역 */}
        <main className="flex-1 p-8 overflow-y-auto bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
