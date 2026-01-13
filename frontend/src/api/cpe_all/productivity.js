import instance from "../axios";


export const fetchProductivities = async (projectId) => {
    const response = await instance.get(`/cpe-all/productivity/project/${projectId}/`);
    return response.data;
};

export const createProductivity = async (data) => {
    const response = await instance.post("/cpe-all/productivity/", data);
    return response.data;
};

export const updateProductivity = async (id, data) => {
    const response = await instance.patch(`/cpe-all/productivity/${id}/`, data);
    return response.data;
};

export const deleteProductivity = async (id) => {
    const response = await instance.delete(`/cpe-all/productivity/${id}/`);
    return response.data;
};

// --- CIP Result (Single Summary per Project) ---
export const fetchCIPResultSummary = async (projectId) => {
    const response = await instance.get(`/cpe-all/cip-result/?project=${projectId}`);
    return response.data?.[0] || null; // Return first (only) result or null
};

export const updateCIPResultSummary = async (id, data) => {
    const response = await instance.patch(`/cpe-all/cip-result/${id}/`, data);
    return response.data;
};

export const createCIPResultSummary = async (data) => {
    const response = await instance.post('/cpe-all/cip-result/', data);
    return response.data;
};
