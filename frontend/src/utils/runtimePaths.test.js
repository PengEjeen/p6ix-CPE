import { afterEach, describe, expect, it } from "vitest";
import { normalizeApiPath, resolveApiBase, resolveAppBase } from "./runtimePaths";

const APP_BASE_STORAGE_KEY = "p6ix_app_base";

function resetDom(pathname = "/") {
  window.history.replaceState({}, "", pathname);
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  window.localStorage.clear();
}

describe("runtimePaths", () => {
  afterEach(() => {
    resetDom();
  });

  it("uses root base and clears legacy stored path", () => {
    resetDom("/login");
    window.localStorage.setItem(APP_BASE_STORAGE_KEY, "/p6ix-cpe");

    expect(resolveAppBase()).toBe("/");
    expect(resolveApiBase()).toBe("/api");
    expect(window.localStorage.getItem(APP_BASE_STORAGE_KEY)).toBeNull();
  });

  it("infers nested app base from location", () => {
    resetDom("/custom/projects/123");

    expect(resolveAppBase()).toBe("/custom");
    expect(resolveApiBase()).toBe("/custom/api");
    expect(window.localStorage.getItem(APP_BASE_STORAGE_KEY)).toBe("/custom");
  });

  it("infers nested app base from bundled asset paths", () => {
    resetDom("/login");
    document.head.innerHTML =
      '<script type="module" src="/deploy/assets/index-abc123.js"></script>';

    expect(resolveAppBase()).toBe("/deploy");
    expect(resolveApiBase()).toBe("/deploy/api");
  });

  it("normalizes configured api bases without an api suffix", () => {
    expect(normalizeApiPath("/deploy")).toBe("/deploy/api");
    expect(normalizeApiPath("/deploy/api")).toBe("/deploy/api");
  });
});
