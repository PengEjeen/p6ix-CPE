const PINNED_PROJECTS_EVENT = "p6ix:pinned-projects-changed";

const getPinnedStorageKey = () => {
  try {
    const user = JSON.parse(window.localStorage.getItem("user") || "{}");
    return `p6ix_home_pinned_projects:${user?.id || "anon"}`;
  } catch {
    return "p6ix_home_pinned_projects:anon";
  }
};

const loadPinnedProjectIds = () => {
  try {
    const raw = window.localStorage.getItem(getPinnedStorageKey());
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const savePinnedProjectIds = (ids) => {
  const next = Array.isArray(ids) ? ids.map(String) : [];
  try {
    window.localStorage.setItem(getPinnedStorageKey(), JSON.stringify(next));
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(PINNED_PROJECTS_EVENT, { detail: { ids: next } }));
  return next;
};

export { PINNED_PROJECTS_EVENT, loadPinnedProjectIds, savePinnedProjectIds };

