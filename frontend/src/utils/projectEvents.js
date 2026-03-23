const PROJECTS_CHANGED_EVENT = "p6ix:projects-changed";

const PROJECT_EVENT_TYPES = {
  CREATED: "created",
  UPDATED: "updated",
  DELETED: "deleted",
};

const emitProjectsChanged = (detail) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROJECTS_CHANGED_EVENT, { detail }));
};

export { PROJECTS_CHANGED_EVENT, PROJECT_EVENT_TYPES, emitProjectsChanged };
