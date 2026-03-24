import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../api/axios";
import { getAuthToken } from "../utils/authTokens";
import { getCompanyLogoSrc } from "../utils/brandAssets";
import { resolveApiBase, resolveAppBase } from "../utils/runtimePaths";

function Login() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState("");
  const [isKeycloakLoading, setIsKeycloakLoading] = useState(false);
  const companyLogoSrc = getCompanyLogoSrc("navy");

  const keycloakEnabled =
    String(import.meta.env.VITE_KEYCLOAK_ENABLED).toLowerCase() === "true";
  const useSessionAuth =
    String(import.meta.env.VITE_USE_SESSION_AUTH).toLowerCase() === "true";

  const ssoLoginUrls = useMemo(() => {
    const appBase = resolveAppBase();
    const normalizedAppBase = appBase.endsWith("/") ? appBase : `${appBase}/`;
    const defaultNext = `${window.location.origin}${normalizedAppBase}`;
    const nextPath = import.meta.env.VITE_SSO_NEXT_PATH || defaultNext;

    const candidates = [];
    const pushCandidate = (rawBase) => {
      const normalized = String(rawBase || "").trim();
      if (!normalized) return;
      const apiBase = normalized.endsWith("/") ? normalized : `${normalized}/`;
      candidates.push(`${apiBase}sso/login/?next=${encodeURIComponent(nextPath)}`);
    };

    const pathSegments = window.location.pathname.split("/").filter(Boolean);
    const firstSegment = pathSegments[0];
    if (
      firstSegment &&
      !["login", "register", "guide", "profile", "projects", "api"].includes(firstSegment)
    ) {
      pushCandidate(`/${firstSegment}/api`);
    }

    pushCandidate(import.meta.env.DEV ? "/api" : resolveApiBase());
    pushCandidate("/api");
    return Array.from(new Set(candidates));
  }, []);

  const resolveReachableSsoUrl = useCallback(async () => {
    for (const url of ssoLoginUrls) {
      try {
        const response = await fetch(url, {
          method: "GET",
          credentials: "include",
          redirect: "manual",
          cache: "no-store",
        });
        if (response.status !== 404) return url;
      } catch {
        // try next candidate
      }
    }
    return ssoLoginUrls[0];
  }, [ssoLoginUrls]);

  const mapSsoError = (code) => {
    const mapping = {
      cancelled: "로그인이 취소되었습니다.",
      invalid_state: "인증 상태 검증에 실패했습니다. 다시 시도해주세요.",
      pending_approval: "계정 승인이 필요합니다. 관리자에게 문의하세요.",
      not_registered: "이 앱에 등록되지 않은 사용자입니다.",
      callback_failed: "로그인 처리 중 오류가 발생했습니다.",
    };
    return mapping[code] || "로그인에 실패했습니다.";
  };

  const handleKeycloakLogin = useCallback(async () => {
    if (!keycloakEnabled) return;
    setIsKeycloakLoading(true);
    setErrorMsg("");
    const loginUrl = await resolveReachableSsoUrl();
    if (loginUrl) window.location.assign(loginUrl);
  }, [keycloakEnabled, resolveReachableSsoUrl]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const ssoError = query.get("sso_error");

    const checkAuthenticated = async () => {
      if (useSessionAuth) {
        try {
          const res = await api.get("sso/session/");
          if (res.data?.authenticated && res.data?.user?.id) {
            localStorage.setItem("user", JSON.stringify(res.data.user));
            navigate("/");
            return;
          }
        } catch (err) {
          console.error("세션 확인 실패:", err);
        }
      } else {
        const access = getAuthToken("access");
        const user = localStorage.getItem("user");
        if (access && user) {
          navigate("/");
          return;
        }
      }

      if (ssoError) {
        setErrorMsg(mapSsoError(ssoError));
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    checkAuthenticated();
  }, [navigate, useSessionAuth]);

  return (
    <div
      data-theme="landing"
      data-theme-lock="auth"
      className="min-h-screen bg-[var(--navy-bg)] relative overflow-hidden"
    >
      <div className="absolute top-6 left-6 md:top-8 md:left-8 z-20">
        <img
          src={companyLogoSrc}
          alt="P6ix 회사 로고"
          className="h-8 md:h-10 w-auto object-contain"
          loading="eager"
          decoding="async"
        />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-5xl text-center py-8 md:py-12"
        >
          <p className="inline-flex items-center rounded-full bg-[var(--navy-surface-3)] text-[var(--navy-text)] text-xs font-semibold px-4 py-1.5 mb-7">
            공기산정 서비스
          </p>

          <h1 className="text-4xl md:text-7xl font-extrabold text-[var(--navy-text)] leading-tight tracking-tight">
            복잡한 공기 검토,
            <br className="hidden md:block" />
            더 간편하게
          </h1>

          <p className="mt-6 text-lg md:text-2xl text-[var(--navy-text-muted)] leading-relaxed max-w-3xl mx-auto">
            일정 검토와 산정 결과 관리까지,
            <br className="hidden md:block" />
            공기산정에 필요한 업무를 한 화면에서 진행하세요.
          </p>

          <div className="mt-12">
            <button
              type="button"
              onClick={handleKeycloakLogin}
              disabled={!keycloakEnabled || isKeycloakLoading}
              className="h-14 px-14 rounded-2xl bg-[var(--navy-accent)] text-white text-lg font-bold hover:bg-[var(--navy-accent-hover)] transition disabled:opacity-60"
            >
              {isKeycloakLoading ? "로그인 페이지로 이동 중..." : "로그인"}
            </button>
          </div>

          {errorMsg && (
            <div className="mt-6 mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {errorMsg}
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
}

export default Login;
