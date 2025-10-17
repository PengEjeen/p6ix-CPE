import api from "../axios";

// 공사개요
export const detailConstructionOverview = (projectId) =>
  api.get(`/cpe/calc/construction-overview/${projectId}/`);

export const updateConstructionOverview = (projectId, data) =>
  api.put(`/cpe/calc/construction-overview/${projectId}/update/`, data);

// 근무조건 및 가동률
export const detailWorkCondition = (projectId) =>
  api.get(`/cpe/calc/work-condition/${projectId}/`);

export const updateWorkCondition = (projectId, data) =>
  api.put(`/cpe/calc/work-condition/${projectId}/update/`, data);

// 준비/정리 기간
export const detailPreparationPeriod = (projectId) =>
  api.get(`/cpe/calc/preparation-period/${projectId}/`);

export const updatePreparationPeriod = (projectId, data) =>
  api.put(`/cpe/calc/preparation-period/${projectId}/update/`, data);

// 토공사 입력
export const detailEarthworkInput = (projectId) =>
  api.get(`/cpe/calc/earthwork-input/${projectId}/`);

export const updateEarthworkInput = (projectId, data) =>
  api.put(`/cpe/calc/earthwork-input/${projectId}/update/`, data);

// 골조공사 입력
export const detailFrameworkInput = (projectId) =>
  api.get(`/cpe/calc/framework-input/${projectId}/`);

export const updateFrameworkInput = (projectId, data) =>
  api.put(`/cpe/calc/framework-input/${projectId}/update/`, data);
