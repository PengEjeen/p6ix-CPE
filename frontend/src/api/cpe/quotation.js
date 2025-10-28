import api from "../axios";

export const detailQuotation = (projectId) =>
  api.get(`/cpe/quotation/${projectId}/`);

export const updateQuotation = (projectId, data) =>
  api.patch(`/cpe/quotation/${projectId}/update/`, data);
