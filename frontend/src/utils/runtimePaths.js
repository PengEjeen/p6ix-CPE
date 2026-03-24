const ABSOLUTE_URL_RE = /^https?:\/\//i;
const APP_ROUTE_ROOTS = new Set(["login", "register", "guide", "profile", "projects"]);

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

export function resolveAppBase() {
  const appBase = normalizePath(import.meta.env.BASE_URL || "/", "/");
  if (appBase !== "/") return appBase;
  return inferAppBaseFromLocation();
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
