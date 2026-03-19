import axios from "axios";

// 개발 환경에서는 Vite /api 프록시 사용, 배포 환경에서는 .env 설정 사용
const isDev = import.meta.env.DEV;
const baseURL = isDev
  ? "/api"
  : (import.meta.env.VITE_API_BASE || "/api");

const USE_SESSION_AUTH =
  String(import.meta.env.VITE_USE_SESSION_AUTH).toLowerCase() === "true";

// ▶ 테스트서버에서 계속 로그인 유지하고 싶으면 .env에 VITE_PERSIST_LOGIN=true
const PERSIST_LOGIN =
  String(import.meta.env.VITE_PERSIST_LOGIN).toLowerCase() === "true";

const api = axios.create({
  baseURL: baseURL.endsWith("/") ? baseURL : `${baseURL}/`,
  headers: { "Content-Type": "application/json" },
  withCredentials: USE_SESSION_AUTH,
});

// refresh 전용 클라이언트(인터셉터 없음)
const refreshClient = axios.create({
  baseURL: api.defaults.baseURL,
  headers: { "Content-Type": "application/json" },
  withCredentials: USE_SESSION_AUTH,
});

// 요청 인터셉터: 인증/프로젝트 파라미터 주입
api.interceptors.request.use((config) => {
  const projectId = localStorage.getItem("projectId");
  const url = config.url || "";

  const excludedPaths = [
    "users/login",
    "users/register",
    "users/token/refresh",
    "users/keycloak/login",
    "sso/login",
    "sso/callback",
    "sso/logout",
    "sso/session",
  ];
  const shouldExclude = excludedPaths.some((p) => url.includes(p));

  if (!USE_SESSION_AUTH) {
    const token = localStorage.getItem("access");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  if (projectId && !shouldExclude) {
    config.params ||= {};
    if (config.params.project == null) config.params.project = projectId;
  }

  return config;
});

let isRefreshing = false;
let queue = [];
function processQueue(error, token = null) {
  queue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  queue = [];
}
function setAccessToken(access) {
  localStorage.setItem("access", access);
  api.defaults.headers.common.Authorization = `Bearer ${access}`;
}

function forceLogout() {
  if (PERSIST_LOGIN) {
    localStorage.setItem("__auth_error", "refresh_invalid");
    return;
  }

  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  localStorage.removeItem("user");

  const appBase = import.meta.env.BASE_URL || "/";
  const loginPath = `${appBase.endsWith("/") ? appBase : `${appBase}/`}login`;
  window.location.href = loginPath;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    if (!error.response) return Promise.reject(error);

    const status = error.response.status;
    const code = error.response.data?.code;
    const url = (originalRequest && originalRequest.url) || "";

    // Session 모드에서는 refresh를 하지 않고 그대로 에러 전달
    if (USE_SESSION_AUTH) {
      const isSessionCheck = url.includes("sso/session");
      if (status === 401 && !isSessionCheck) {
        forceLogout();
      }
      return Promise.reject(error);
    }

    const isAuthEndpoint =
      url.includes("users/token/refresh") || url.includes("token/verify");

    if (isAuthEndpoint) return Promise.reject(error);

    const looksExpired =
      code === "token_not_valid" ||
      String(error.response.data?.detail || "")
        .toLowerCase()
        .includes("token");

    if (status === 401 && looksExpired && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({
            resolve: (token) => {
              if (token)
                originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refresh = localStorage.getItem("refresh");
        if (!refresh) {
          forceLogout();
          return Promise.reject(error);
        }

        const res = await refreshClient.post("users/token/refresh/", { refresh });
        const newAccess = res.data?.access;
        const newRefresh = res.data?.refresh;
        if (!newAccess) {
          forceLogout();
          return Promise.reject(error);
        }

        setAccessToken(newAccess);
        if (newRefresh) {
          localStorage.setItem("refresh", newRefresh);
        }
        processQueue(null, newAccess);

        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);

        const rStatus = err.response?.status;
        const rCode = err.response?.data?.code;
        const definitelyInvalid =
          rStatus === 401 || rStatus === 403 || rCode === "token_not_valid";

        if (definitelyInvalid) {
          forceLogout();
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
