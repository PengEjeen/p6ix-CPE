import api from "../axios";

export const detailQuotation = (projectId) =>
  api.get(`/cpe/quotation/${projectId}/`);

export const updateQuotation = (projectId, data) =>
  api.patch(`/cpe/quotation/${projectId}/update/`, data);

export const updateQuotationAi = (projectId, data) =>
  api.post(`/cpe/quotation/${projectId}/ai_update/`, data);