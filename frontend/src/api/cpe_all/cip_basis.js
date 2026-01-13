import axiosInstance from "../axios";
const BASE_URL = "/cpe-all/cip-basis/";

// List
export const fetchCIPBasis = async (projectId) => {
    try {
        const response = await axiosInstance.get(BASE_URL, {
            params: { project: projectId },
        });
        return response.data;
    } catch (error) {
        console.error("fetchCIPBasis Error:", error);
        throw error;
    }
};

// Update
export const updateCIPBasis = async (id, data) => {
    try {
        const response = await axiosInstance.patch(`${BASE_URL}${id}/`, data);
        return response.data;
    } catch (error) {
        console.error("updateCIPBasis Error:", error);
        throw error;
    }
};

// Create
export const createCIPBasis = async (data) => {
    try {
        const response = await axiosInstance.post(BASE_URL, data);
        return response.data;
    } catch (error) {
        console.error("createCIPBasis Error:", error);
        throw error;
    }
};

// Delete
export const deleteCIPBasis = async (id) => {
    try {
        await axiosInstance.delete(`${BASE_URL}${id}/`);
    } catch (error) {
        console.error("deleteCIPBasis Error:", error);
        throw error;
    }
};

// --- Drilling Standard ---
// --- Drilling Standard ---
export const fetchCIPStandard = async () => {
    try {
        const response = await axiosInstance.get("/cpe-all/cip-standard/");
        return response.data;
    } catch (error) {
        console.error("fetchCIPStandard Error:", error);
        throw error;
    }
};

export const updateCIPStandard = async (id, data) => {
    try {
        const response = await axiosInstance.patch(`/cpe-all/cip-standard/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error("updateCIPStandard Error:", error);
        throw error;
    }
};
// --- CIP Result (Bits/Diameter) ---
export const fetchCIPResults = async (projectId) => {
    try {
        const response = await axiosInstance.get("/cpe-all/cip-result/", {
            params: { project: projectId },
        });
        return response.data;
    } catch (error) {
        console.error("fetchCIPResults Error:", error);
        throw error;
    }
};

export const updateCIPResult = async (id, data) => {
    try {
        const response = await axiosInstance.patch(`/cpe-all/cip-result/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error("updateCIPResult Error:", error);
        throw error;
    }
};

export const createCIPResult = async (data) => {
    try {
        const response = await axiosInstance.post("/cpe-all/cip-result/", data);
        return response.data;
    } catch (error) {
        console.error("createCIPResult Error:", error);
        throw error;
    }
};
