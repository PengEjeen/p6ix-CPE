import api from "../axios";

const API_URL = "/cpe-all/schedule-item/";

// Fetch the single container for the project and return its .data (JSON array)
export const fetchScheduleItems = async (projectId) => {
    try {
        const response = await api.get(`${API_URL}?project_id=${projectId}`);
        // Response is a list of containers (should be 1)
        if (response.data && response.data.length > 0) {
            // Return the data field of the first container, plus the container ID for future updates
            const container = response.data[0];
            const rawData = container.data || [];
            if (Array.isArray(rawData)) {
                return {
                    containerId: container.id,
                    items: rawData,
                    links: [],
                    sub_tasks: []
                };
            }
            return {
                containerId: container.id,
                items: rawData.items || [],
                links: rawData.links || [],
                sub_tasks: rawData.sub_tasks || rawData.subTasks || []
            };
        }
        return { containerId: null, items: [], links: [], sub_tasks: [] };
    } catch (error) {
        console.error("Error fetching schedule items:", error);
        return { containerId: null, items: [], links: [], sub_tasks: [] };
    }
};

// Initialize default items (creates the container if missing)
export const initializeDefaultItems = async (projectId) => {
    try {
        await api.post(`${API_URL}initialize_default/`, { project_id: projectId });
    } catch (error) {
        console.error("Error initializing default items:", error);
        throw error;
    }
};

// Update the ENTIRE schedule data (JSON array)
export const saveScheduleData = async (containerId, payload) => {
    try {
        const dataPayload = Array.isArray(payload)
            ? payload
            : {
                items: payload.items || [],
                links: payload.links || [],
                sub_tasks: payload.sub_tasks || payload.subTasks || []
            };
        // We patch the container with the new data array
        await api.patch(`${API_URL}${containerId}/`, {
            data: dataPayload
        });
    } catch (error) {
        console.error("Error saving schedule data:", error);
        throw error;
    }
};

// Legacy stubs (to avoid breaking imports immediately, but should be unused)
export const createScheduleItem = async () => { throw new Error("Use saveScheduleData"); };
export const updateScheduleItem = async () => { throw new Error("Use saveScheduleData"); };
export const deleteScheduleItem = async () => { throw new Error("Use saveScheduleData"); };
