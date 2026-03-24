const ABSOLUTE_URL_RE = /^https?:\/\//i;
const APP_ROUTE_ROOTS = new Set(["login", "register", "guide", "profile", "projects"]);
const APP_BASE_STORAGE_KEY = "p6ix_app_base";

function normalizePath(value, fallback = "/") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;

  if (ABSOLUTE_URL_RE.test(raw)) {
    try {
      const pathname = new URL(raw).pathname || "/";
      const normalizedPathname = pathname.replace(/\/+$/, "");
      return normalizedPathname || "/";
    } catch {
      return fallback;
    }
  }

  let path = raw;
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/+$/, "");
  return path || "/";
}

function inferAppBaseFromLocation() {
  if (typeof window === "undefined") return "/";

  const pathname = String(window.location.pathname || "/");
  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) return "/";

  const first = segments[0];
  if (!first || APP_ROUTE_ROOTS.has(first) || first === "api") return "/";

  const second = segments[1];
  if (!second || APP_ROUTE_ROOTS.has(second)) return `/${first}`;
  return "/";
}

function inferAppBaseFromAssets() {
  if (typeof document === "undefined" || typeof URL === "undefined") return "/";

  const moduleScript = document.querySelector('script[type="module"][src]');
  const stylesheet = document.querySelector('link[rel="stylesheet"][href]');
  const candidateUrl = moduleScript?.getAttribute("src") || stylesheet?.getAttribute("href") || "";
  if (!candidateUrl || !String(candidateUrl).includes("/assets/")) return "/";

  try {
    const pathname = new URL(candidateUrl, window.location.origin).pathname || "/";
    const index = pathname.indexOf("/assets/");
    if (index <= 0) return "/";
    return normalizePath(pathname.slice(0, index), "/");
  } catch {
    return "/";
  }
}

function readStoredAppBase() {
  if (typeof window === "undefined") return "/";
  try {
    return normalizePath(window.localStorage.getItem(APP_BASE_STORAGE_KEY) || "", "/");
  } catch {
    return "/";
  }
}

function persistAppBase(path) {
  if (typeof window === "undefined" || !path || path === "/") return;
  try {
    window.localStorage.setItem(APP_BASE_STORAGE_KEY, path);
  } catch {
    // ignore storage failures
  }
}

export function resolveAppBase() {
  const appBase = normalizePath(import.meta.env.BASE_URL || "/", "/");
  if (appBase !== "/") {
    persistAppBase(appBase);
    return appBase;
  }

  const assetBase = inferAppBaseFromAssets();
  if (assetBase !== "/") {
    persistAppBase(assetBase);
    return assetBase;
  }

  const locationBase = inferAppBaseFromLocation();
  if (locationBase !== "/") {
    persistAppBase(locationBase);
    return locationBase;
  }

  return readStoredAppBase();
}

export function resolveApiBase() {
  const appBase = resolveAppBase();
  const configured = String(import.meta.env.VITE_API_BASE || "").trim();
  if (configured) {
    const normalizedConfigured = normalizePath(configured, "/api");
    if (normalizedConfigured === "/api" && appBase !== "/") {
      return `${appBase}/api`;
    }
    return normalizedConfigured;
  }

  if (appBase === "/") return "/api";
  return `${appBase}/api`;
}
