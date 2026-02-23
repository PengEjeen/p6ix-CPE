import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const normalizePathPrefix = (value = "/") => {
    let path = String(value).trim();
    if (!path) return "/";
    if (!path.startsWith("/")) path = `/${path}`;
    path = path.replace(/\/+$/, "");
    return path || "/";
};

const deriveBaseFromApi = (apiBase = "/api") => {
    const normalizedApiBase = normalizePathPrefix(apiBase);
    if (normalizedApiBase === "/api") return "/";
    if (normalizedApiBase.endsWith("/api")) {
        return normalizedApiBase.slice(0, -4) || "/";
    }
    return "/";
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const explicitBase = env.VITE_APP_BASE;
    const derivedBase = explicitBase
        ? normalizePathPrefix(explicitBase)
        : deriveBaseFromApi(env.VITE_API_BASE || "/api");

    const base = derivedBase === "/" ? "/" : `${derivedBase}/`;

    return {
        base,
        plugins: [react()],
        server: {
            host: true,
            port: 3000,
            strictPort: true,
        },
        resolve: {
            alias: [
                { find: "@", replacement: "/src" },
            ],
        },
    };
});
