import api from "../axios";

// 가동률 세부 불러오기(5개 결과)
export const detailOperatingRate = async (project_id) => {
  try {
    const res = await api.get(`cpe/work-schedule-weights/${project_id}/`);
    return res.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return [];
    }
    console.error("가동률 불러오기 실패:", error);
    throw error;
  }
};

// 가동률 수정(5개)
export const updateOperatingRate = async (project_id, weights) => {
  try {
    const res = await api.put(`cpe/work-schedule-weights/${project_id}/update/`, weights);
    return res.data;
  } catch (error) {
    console.error("가동률 수정 실패:", error);
    throw error;
  }
};