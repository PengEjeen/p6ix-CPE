import { useEffect, useState, useRef, useCallback } from "react";
import { Navigate, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Header from "./Header";
import Projects from "./tools/Projects";
import {
  FiUser,
  FiMail,
  FiChevronLeft, FiChevronRight, FiChevronDown, FiChevronUp
} from "react-icons/fi";
import isUuid from "../../utils/isUuid";
import { useTheme } from "../../contexts/ThemeContext";
import { clearAuthTokens, getAuthToken, getRefreshToken } from "../../utils/authTokens";
import { getCompanyLogoSrc } from "../../utils/brandAssets";
import { resolveApiBase } from "../../utils/runtimePaths";
import api from "../../api/axios";

function Layout() {
  const USE_SESSION_AUTH =
    String(import.meta.env.VITE_USE_SESSION_AUTH).toLowerCase() === "true";
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(true);
  const [userOpen, setUserOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarScrolling, setIsSidebarScrolling] = useState(false);
  const [isMainScrolling, setIsMainScrolling] = useState(false);
  const [authStatus, setAuthStatus] = useState("checking");
  const guidePrevThemeRef = useRef(null);
  const isGuideMode = searchParams.get("guide") === "true";

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
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem("user") || "{}")
  );
  const userRef = useRef(null);

  useEffect(() => {
    if (!isGuideMode) return undefined;

    const root = document.documentElement;
    const prevTheme = root.getAttribute("data-theme");
    guidePrevThemeRef.current = prevTheme;

    if (prevTheme !== "navy") {
      root.setAttribute("data-theme", "navy");
    }

    return () => {
      if (guidePrevThemeRef.current) {
        root.setAttribute("data-theme", guidePrevThemeRef.current);
      } else {
        root.removeAttribute("data-theme");
      }
    };
  }, [isGuideMode]);

  useEffect(() => {
    let cancelled = false;
    const finish = (next) => {
      if (!cancelled) setAuthStatus(next);
    };

    const checkAuth = async () => {
      if (USE_SESSION_AUTH) {
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        try {
          const res = await api.get("sso/session/");
          if (res.data?.authenticated && res.data?.user?.id) {
            if (cancelled) return;
            setUser(res.data.user);
            localStorage.setItem("user", JSON.stringify(res.data.user));
            finish("ok");
            return;
          }
          localStorage.removeItem("user");
          finish("deny");
          return;
        } catch (err) {
          console.error("세션 확인 실패:", err);
          if (storedUser?.id) {
            if (cancelled) return;
            setUser(storedUser);
            finish("ok");
            return;
          }
          localStorage.removeItem("user");
          finish("deny");
          return;
        }
      }

      const access = getAuthToken("access");
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (!access || !storedUser?.id) {
        finish("deny");
        return;
      }
      if (cancelled) return;
      setUser(storedUser);
      finish("ok");
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [USE_SESSION_AUTH, location.pathname]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) setMenuOpen(false);
  }, [isMobile]);

  const handleLogout = async () => {
    if (USE_SESSION_AUTH) {
      clearAuthTokens();
      localStorage.removeItem("user");

      const appBase = import.meta.env.BASE_URL || "/";
      const normalizedAppBase = appBase.endsWith("/") ? appBase : `${appBase}/`;
      const nextUrl = `${window.location.origin}${normalizedAppBase}login`;

      const apiBase = import.meta.env.DEV ? "/api" : resolveApiBase();
      const normalizedApiBase = apiBase.endsWith("/") ? apiBase : `${apiBase}/`;
      const logoutUrl = `${normalizedApiBase}sso/logout/?next=${encodeURIComponent(nextUrl)}`;
      window.location.assign(logoutUrl);
      return;
    }

    try {
      await api.post("users/logout/", {
        refresh: getRefreshToken(),
      });
    } catch (err) {
      console.error("로그아웃 요청 실패:", err);
    }
    clearAuthTokens();
    localStorage.removeItem("user");
    navigate("/login");
  };

  const mainLayoutClass = isMobile
    ? "ml-0 w-full"
    : (menuOpen ? "ml-60 w-[calc(100%-15rem)]" : "ml-12 w-[calc(100%-3rem)]");

  const invalidProjectPath = (() => {
    const match = /^\/projects\/([^/?#]+)/.exec(location.pathname);
    if (!match) return false;
    return !isUuid(match[1]);
  })();

  if (authStatus === "checking") {
    return <div className="h-screen w-full bg-[#1e1e2f]" />;
  }

  if (authStatus !== "ok") {
    return <Navigate to="/login" replace />;
  }

  if (invalidProjectPath) {
    return <Navigate to="/" replace />;
  }

  if (isGuideMode) {
    return (
      <div className="h-screen w-full bg-[#1e1e2f] text-white flex flex-col p-0 m-0 overflow-auto">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex bg-[#1e1e2f] text-white overflow-hidden relative">
      {/* 모바일용 오버레이 */}
      {menuOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[20] transition-opacity duration-300"
          onClick={() => setMenuOpen(false)}
        ></div>
      )}

      {/* === 사이드바 === */}
      <aside
        className={`fixed top-0 left-0 h-full bg-[#2c2c3a] border-r border-gray-700 flex flex-col justify-between transition-all duration-300 ease-in-out z-[30] ${menuOpen ? "w-60" : "w-12"
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
                  className="flex items-center gap-2 px-2 py-2 rounded hover:bg-[var(--navy-surface-3)] transition"
                >
                  <img
                    src={getCompanyLogoSrc(theme)}
                    alt="P6ix 로고"
                    className="h-6 w-9 object-contain"
                    loading="eager"
                    decoding="async"
                  />
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

          {/* 프로젝트목록 컴포넌트 삽입 */}
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
                  className="w-full border border-gray-600 rounded px-2 py-1 bg-[#3b3b4f] hover:bg-[#4b4b5f] transition"
                  onClick={() => navigate("/guide")}
                >
                  사용자 가이드
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
        className={`min-w-0 flex flex-col bg-[#1e1e2f] transition-all duration-300 ${mainLayoutClass}`}
      >
        <Header />
        <div
          className={`scroll-container min-w-0 flex-1 overflow-y-auto p-6 text-gray-200 ${isMainScrolling ? 'scrolling' : ''}`}
          onScroll={handleMainScroll}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default Layout;
