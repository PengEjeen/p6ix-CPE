import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../api/axios";
import { getAuthToken } from "../utils/authTokens";

const USE_SESSION_AUTH =
  String(import.meta.env.VITE_USE_SESSION_AUTH).toLowerCase() === "true";

export default function RequireAuth({ children }) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;

    const finish = (next) => {
      if (!cancelled) setStatus(next);
    };

    const checkAuth = async () => {
      if (USE_SESSION_AUTH) {
        try {
          const res = await api.get("sso/session/");
          if (res.data?.authenticated && res.data?.user?.id) {
            localStorage.setItem("user", JSON.stringify(res.data.user));
            finish("ok");
            return;
          }
          localStorage.removeItem("user");
          finish("deny");
          return;
        } catch (err) {
          console.error("세션 확인 실패:", err);
          localStorage.removeItem("access");
          localStorage.removeItem("refresh");
          localStorage.removeItem("user");
          finish("deny");
          return;
        }
      }

      const access = getAuthToken("access");
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      finish(access && storedUser?.id ? "ok" : "deny");
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "checking") {
    return <div className="min-h-screen w-full bg-[#1e1e2f]" />;
  }

  if (status !== "ok") {
    return <Navigate to="/login" replace />;
  }

  return children;
}
