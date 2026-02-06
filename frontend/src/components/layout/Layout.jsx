import { useEffect, useState, useRef, useCallback } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Header from "./Header";
import Projects from "./tools/Projects";
import {
  FiUser,
  FiMail,
  FiChevronLeft, FiChevronRight, FiChevronDown, FiChevronUp
} from "react-icons/fi";

function Layout() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(true);
  const [userOpen, setUserOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarScrolling, setIsSidebarScrolling] = useState(false);
  const [isMainScrolling, setIsMainScrolling] = useState(false);

  const handleSidebarScroll = useCallback(() => {
    setIsSidebarScrolling(true);
    clearTimeout(window.sidebarScrollTimeout);
    window.sidebarScrollTimeout = setTimeout(() => {
      setIsSidebarScrolling(false);
    }, 1000);
  }, []);

  const handleMainScroll = useCallback(() => {
    setIsMainScrolling(true);
    clearTimeout(window.mainScrollTimeout);
    window.mainScrollTimeout = setTimeout(() => {
      setIsMainScrolling(false);
    }, 1000);
  }, []);
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userRef = useRef(null);

  useEffect(() => {
    const access = localStorage.getItem("access");
    if (!access || !user?.id) navigate("/login");
  }, [navigate, user]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) setMenuOpen(false);
  }, [isMobile]);

  const handleLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="h-screen w-full flex bg-[#1e1e2f] text-white overflow-hidden relative">
      {/* 모바일용 오버레이 */}
      {menuOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-10 transition-opacity duration-300"
          onClick={() => setMenuOpen(false)}
        ></div>
      )}

      {/* === 사이드바 === */}
      <aside
        className={`fixed top-0 left-0 h-full bg-[#2c2c3a] border-r border-gray-700 flex flex-col justify-between transition-all duration-300 ease-in-out z-20 ${menuOpen ? "w-60" : "w-12"
          }`}
      >
        <div
          className={`scroll-container flex-1 flex flex-col justify-start overflow-y-auto p-3 ${isSidebarScrolling ? 'scrolling' : ''}`}
          onScroll={handleSidebarScroll}
        >
          {/* 홈버튼 */}
          <div className="flex items-center justify-between mb-4">
            {menuOpen ? (
              <>
                <button
                  onClick={() => navigate("/")}
                  className="flex items-center gap-2 px-2 py-2 rounded hover:bg-[#3b3b4f] transition"
                >
                  <div className="w-5 h-5 bg-gray-500 rounded-full"></div>
                  <span className="font-semibold text-lg">P6ix</span>
                </button>

                <button
                  onClick={() => setMenuOpen(false)}
                  className="text-gray-300 border border-gray-600 p-1 rounded hover:bg-[#3b3b4f] transition"
                >
                  <FiChevronLeft size={18} />
                </button>
              </>
            ) : (
              <button
                onClick={() => setMenuOpen(true)}
                className="text-gray-300 hover:text-white transition"
              >
                <FiChevronRight size={20} />
              </button>
            )}
          </div>

          {/* 갑지목록 컴포넌트 삽입 */}
          {menuOpen && <Projects />}
        </div>

        {/* ==== 하단 유저 정보 ==== */}
        {menuOpen && (
          <div className="border-t border-gray-700 p-3">
            <button
              onClick={() => setUserOpen(!userOpen)}
              className="w-full flex justify-between items-center text-base text-gray-300 hover:text-white"
            >
              {/* 왼쪽 묶음 (아이콘 + 이름) */}
              <div className="flex items-center gap-2">
                <FiUser className="text-gray-400" />
                <span className="text-white tracking-wide">
                  {user.username || "Guest"}
                </span>
              </div>

              {/* 위아래 화살표 */}
              {userOpen ? (
                <FiChevronDown className="transition-transform duration-300" size={18} />
              ) : (
                <FiChevronUp className="transition-transform duration-300" size={18} />
              )}
            </button>

            <div
              ref={userRef}
              className={`overflow-hidden transition-all duration-300 ${userOpen ? "max-h-40 mt-3" : "max-h-0"
                }`}
            >
              <div className="text-sm text-gray-400 space-y-2">
                <div className="flex items-center gap-2">
                  <FiMail className="text-gray-400" />
                  <p className="truncate">
                    이메일: {user.email || "unknown@example.com"}
                  </p>
                </div>
                <button
                  className="w-full border border-gray-600 rounded px-2 py-1 bg-[#3b3b4f] hover:bg-[#4b4b5f] transition"
                  onClick={() => navigate("/profile")}
                >
                  내 정보
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full border border-gray-600 rounded px-2 py-1 bg-[#3b3b4f] hover:bg-[#4b4b5f] transition"
                >
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* === 메인 === */}
      <main
        className={`flex-1 flex flex-col bg-[#1e1e2f] transition-all duration-300 ${menuOpen && !isMobile ? "ml-60" : "ml-12"
          }`}
      >
        <Header />
        <div
          className={`scroll-container flex-1 overflow-y-auto p-6 text-gray-200 ${isMainScrolling ? 'scrolling' : ''}`}
          onScroll={handleMainScroll}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default Layout;
