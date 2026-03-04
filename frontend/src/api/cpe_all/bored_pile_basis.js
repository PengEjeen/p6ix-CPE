import instance from "../axios";
import isUuid from "../../utils/isUuid";

// Bored Pile Productivity Basis
export const fetchBoredPileBasis = async (projectId) => {
    if (!isUuid(projectId)) {
        console.error("fetchBoredPileBasis: invalid projectId", projectId);
        return [];
    }
    const response = await instance.get("/cpe-all/bored-pile-basis/", { params: { project: projectId } });
    return response.data;
};

export const createBoredPileBasis = async (data) => {
    const response = await instance.post("/cpe-all/bored-pile-basis/", data);
    return response.data;
};

export const updateBoredPileBasis = async (id, data) => {
    const response = await instance.patch(`/cpe-all/bored-pile-basis/${id}/`, data);
    return response.data;
};

export const deleteBoredPileBasis = async (id) => {
    const response = await instance.delete(`/cpe-all/bored-pile-basis/${id}/`);
    return response.data;
};

// Bored Pile Result (Summary)
export const fetchBoredPileResults = async (projectId) => {
    if (!isUuid(projectId)) {
        console.error("fetchBoredPileResults: invalid projectId", projectId);
        return [];
    }
    const response = await instance.get("/cpe-all/bored-pile-result/", { params: { project: projectId } });
    return response.data;
};

export const fetchBoredPileResultSummary = async (projectId) => {
    if (!isUuid(projectId)) {
        console.error("fetchBoredPileResultSummary: invalid projectId", projectId);
        return null;
    }
    const response = await instance.get("/cpe-all/bored-pile-result/", { params: { project: projectId } });
    return response.data?.[0] || null;
};

export const createBoredPileResult = async (data) => {
    const response = await instance.post('/cpe-all/bored-pile-result/', data);
    return response.data;
};

export const updateBoredPileResult = async (id, data) => {
    const response = await instance.patch(`/cpe-all/bored-pile-result/${id}/`, data);
    return response.data;
};

export const updateBoredPileResultSummary = async (id, data) => {
    const response = await instance.patch(`/cpe-all/bored-pile-result/${id}/`, data);
    return response.data;
};

export const createBoredPileResultSummary = async (data) => {
    const response = await instance.post('/cpe-all/bored-pile-result/', data);
    return response.data;
};

// Bored Pile Standard
export const fetchBoredPileStandard = async () => {
    const response = await instance.get("/cpe-all/bored-pile-standard/");
    return response.data;
};

export const updateBoredPileStandard = async (id, data) => {
    const response = await instance.patch(`/cpe-all/bored-pile-standard/${id}/`, data);
    return response.data;
};
