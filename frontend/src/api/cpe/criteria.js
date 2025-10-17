import api from "../axios";

// 준비·정리·가설·마감공사
// 조회
export const detailPreparationWork = async (projectId) => {
  const res = await api.get(`/cpe/criteria/preparation/${projectId}/`);
  return res.data;
};

// 수정
export const updatePreparationWork = async (projectId, payload) => {
  const res = await api.put(`/cpe/criteria/preparation/${projectId}/update/`, payload);
  return res.data;
};



//토공사
// 조회
export const detailEarthwork = async (projectId) => {
  const res = await api.get(`/cpe/criteria/earthwork/${projectId}/`);
  return res.data;
};

// 수정
export const updateEarthwork = async (projectId, payload) => {
  const res = await api.put(`/cpe/criteria/earthwork/${projectId}/update/`, payload);
  return res.data;
};

//골조공사
// 조회
export const detailFramework = async (projectId) => {
  const res = await api.get(`/cpe/criteria/framework/${projectId}/`);
  return res.data;
};

// 수정
export const updateFramework = async (projectId, payload) => {
  const res = await api.put(`/cpe/criteria/framework/${projectId}/update/`, payload);
  return res.data;
};
