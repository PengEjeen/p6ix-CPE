import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const normalizePathPrefix = (value = "/") => {
    let path = String(value).trim();
    if (/^https?:\/\//i.test(path)) {
        try {
            path = new URL(path).pathname || "/";
        } catch {
            path = "/";
        }
    }
    if (!path) return "/";
    if (!path.startsWith("/")) path = `/${path}`;
    path = path.replace(/\/+$/, "");
    return path || "/";
};

const normalizeApiBase = (value = "/api") => {
    const normalizedPath = normalizePathPrefix(value);
    if (normalizedPath === "/") return "/api";
    if (normalizedPath.endsWith("/api")) return normalizedPath;
    return `${normalizedPath}/api`;
};

const deriveBaseFromApi = (apiBase = "/api") => {
    const normalizedApiBase = normalizeApiBase(apiBase);
    if (normalizedApiBase === "/api") return "/";
    return normalizedApiBase.slice(0, -4) || "/";
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const repoRoot = path.resolve(process.cwd(), "..");
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
            proxy: {
                "/api": {
                    target: env.VITE_DEV_API_PROXY_TARGET || "http://127.0.0.1:8000",
                    changeOrigin: true,
                    secure: false,
                },
            },
            fs: {
                allow: [repoRoot],
            },
        },
        resolve: {
            alias: [
                { find: "@", replacement: "/src" },
            ],
        },
        test: {
            environment: "jsdom",
            setupFiles: "./src/test/setup.js",
            globals: true,
            css: true,
        },
    };
});
