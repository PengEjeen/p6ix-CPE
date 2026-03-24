const ABSOLUTE_URL_RE = /^https?:\/\//i;

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

export function resolveApiBase() {
  const configured = String(import.meta.env.VITE_API_BASE || "").trim();
  if (configured) return normalizePath(configured, "/api");

  const appBase = normalizePath(import.meta.env.BASE_URL || "/", "/");
  if (appBase === "/") return "/api";
  return `${appBase}/api`;
}
