const PERSIST_LOGIN =
  String(import.meta.env.VITE_PERSIST_LOGIN).toLowerCase() === "true";

const TOKEN_KEYS = ["access", "refresh"];

function getPrimaryStorage() {
  if (typeof window === "undefined") return null;
  return PERSIST_LOGIN ? window.localStorage : window.sessionStorage;
}

function getFallbackStorage() {
  if (typeof window === "undefined") return null;
  return PERSIST_LOGIN ? window.sessionStorage : window.localStorage;
}

function readStorage(storage, key) {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage, key, value) {
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // ignore storage write errors (private mode/quota exceeded)
  }
}

function removeStorage(storage, key) {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore storage remove errors
  }
}

export function getAuthToken(key) {
  if (!TOKEN_KEYS.includes(key)) return null;
  return readStorage(getPrimaryStorage(), key) || readStorage(getFallbackStorage(), key);
}

export function getRefreshToken() {
  return getAuthToken("refresh");
}

export function setAuthToken(key, value) {
  if (!TOKEN_KEYS.includes(key) || !value) return;
  const primary = getPrimaryStorage();
  const fallback = getFallbackStorage();
  writeStorage(primary, key, value);
  removeStorage(fallback, key);
}

export function clearAuthTokens() {
  const primary = getPrimaryStorage();
  const fallback = getFallbackStorage();
  TOKEN_KEYS.forEach((key) => {
    removeStorage(primary, key);
    removeStorage(fallback, key);
  });
}
