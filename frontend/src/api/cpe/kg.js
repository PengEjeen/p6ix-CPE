import api from "../axios";

export const searchKg = (payload) => api.post("/cpe/kg/search/", payload);

export const answerKg = (payload) => api.post("/cpe/kg/answer/", payload);

export const cardKg = (payload) => api.post("/cpe/kg/card/", payload);

// Batch helpers (stateless: operate on provided schedule items)
export const enrichScheduleKg = (payload) => api.post("/cpe/kg/enrich-schedule/", payload);

export const enrichScheduleKgAsync = (payload) =>
  api.post("/cpe/kg/enrich-schedule/", { ...(payload || {}), async: true });

export const enrichScheduleKgJob = (jobId, params = {}) =>
  api.get(`/cpe/kg/enrich-schedule/jobs/${jobId}/`, { params });

export const evidencePackKg = (payload) => api.post("/cpe/kg/evidence-pack/", payload);

export const durationAgentKg = (payload) => api.post("/cpe/kg/duration-agent/", payload);
