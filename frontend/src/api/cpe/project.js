import api from "../axios";

// 프로젝트 리스트 불러오기
export const fetchProjects = async () => {
  try {
    const res = await api.get("cpe/project");
    return res.data;
  } catch (error) {
    console.error("프로젝트 불러오기 실패:", error);
    throw error;
  }
};

// 프로젝트 디테일 불러오기
export const detailProject = async (project_id) => {
  try {
    const res = await api.get(`cpe/project/${project_id}/`);
    return res.data;
  } catch (error) {
    console.error("프로젝트 불러오기 실패:", error);
    throw error;
  }
};


export const createProjects = async (data) => {
  try {
    const res = await api.post("cpe/project/create/", data);
    return res.data;
  } catch (error) {
    console.error("프로젝트 생성 실패:", error);
    throw error;
  }
};
