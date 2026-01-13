import instance from "../axios";

// Pile Productivity Basis
export const fetchPileBasis = async (projectId) => {
    const response = await instance.get(`/cpe-all/pile-basis/?project=${projectId}`);
    return response.data;
};

export const createPileBasis = async (data) => {
    const response = await instance.post("/cpe-all/pile-basis/", data);
    return response.data;
};

export const updatePileBasis = async (id, data) => {
    const response = await instance.patch(`/cpe-all/pile-basis/${id}/`, data);
    return response.data;
};

export const deletePileBasis = async (id) => {
    const response = await instance.delete(`/cpe-all/pile-basis/${id}/`);
    return response.data;
};

// Pile Result (Summary)
export const fetchPileResults = async (projectId) => {
    const response = await instance.get(`/cpe-all/pile-result/?project=${projectId}`);
    return response.data;
};

export const fetchPileResultSummary = async (projectId) => {
    const response = await instance.get(`/cpe-all/pile-result/?project=${projectId}`);
    return response.data?.[0] || null;
};

export const createPileResult = async (data) => {
    const response = await instance.post('/cpe-all/pile-result/', data);
    return response.data;
};

export const updatePileResult = async (id, data) => {
    const response = await instance.patch(`/cpe-all/pile-result/${id}/`, data);
    return response.data;
};

export const updatePileResultSummary = async (id, data) => {
    const response = await instance.patch(`/cpe-all/pile-result/${id}/`, data);
    return response.data;
};

export const createPileResultSummary = async (data) => {
    const response = await instance.post('/cpe-all/pile-result/', data);
    return response.data;
};

// Pile Standard
export const fetchPileStandard = async () => {
    const response = await instance.get("/cpe-all/pile-standard/");
    return response.data;
};

export const updatePileStandard = async (id, data) => {
    const response = await instance.patch(`/cpe-all/pile-standard/${id}/`, data);
    return response.data;
};
