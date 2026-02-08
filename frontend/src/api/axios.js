import axios from "axios";

// 개발 환경에서는 localhost:8000/api 사용, 배포 환경에서는 .env 설정 사용
const isDev = import.meta.env.DEV;
const baseURL = isDev
  ? "http://localhost:8000/api"
  : (import.meta.env.VITE_API_BASE || "/api");

// ▶ 테스트서버에서 계속 로그인 유지하고 싶으면 .env에 VITE_PERSIST_LOGIN=true
const PERSIST_LOGIN =
  String(import.meta.env.VITE_PERSIST_LOGIN).toLowerCase() === "true";

const api = axios.create({
  baseURL: baseURL.endsWith("/") ? baseURL : `${baseURL}/`,
  headers: { "Content-Type": "application/json" },
});

// refresh 전용 클라이언트(인터셉터 없음)
const refreshClient = axios.create({
  baseURL: api.defaults.baseURL,
  headers: { "Content-Type": "application/json" },
});

// 요청 인터셉터: 토큰/프로젝트 파라미터 주입
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  const projectId = localStorage.getItem("projectId");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const excludedPaths = ["users/login", "users/register", "users/token/refresh"];

  const url = config.url || "";
  const shouldExclude = excludedPaths.some((p) => url.includes(p));

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
  // 테스트서버(지속로그인) 모드면 절대 로그아웃/리다이렉트하지 않음
  if (PERSIST_LOGIN) {
    // UI에서 필요시 읽어 알림 띄울 수 있도록 힌트만 남김
    localStorage.setItem("__auth_error", "refresh_invalid");
    return;
  }
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  window.location.href = "/login";
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    // 네트워크 오류 등: 자동 로그아웃 금지
    if (!error.response) return Promise.reject(error);

    const status = error.response.status;
    const code = error.response.data?.code;
    const url = (originalRequest && originalRequest.url) || "";
    const isAuthEndpoint =
      url.includes("users/token/refresh") || url.includes("token/verify");

    // 토큰 엔드포인트 자체는 루프 방지
    if (isAuthEndpoint) return Promise.reject(error);

    // Access 만료로 인한 401 → refresh 시도
    const looksExpired =
      code === "token_not_valid" ||
      String(error.response.data?.detail || "")
        .toLowerCase()
        .includes("token");
    if (status === 401 && looksExpired && !originalRequest._retry) {
      // 이미 갱신 중이면 큐에 합류
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

        // 테스트서버에서 토큰이 이미 만료됐더라도, 리프레시 네트워크/서버에러 때문에 실패했다면
        // 세션을 유지(리다이렉트 X)하고 에러만 올려 UI가 재시도할 수 있게 둠.
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
          // ▶ 진짜 refresh가 무효면: 테스트서버는 세션 유지(리다이렉트 X), 운영은 로그아웃
          forceLogout();
        }
        // 네트워크/5xx 등은 그냥 에러만 전달(세션 유지)
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    // 그 외 401은 권한 문제 등 → 세션 유지, 에러만 전달
    return Promise.reject(error);
  }
);

export default api;
