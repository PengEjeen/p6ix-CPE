import api from "../axios";

export const fetchFloorBatchTemplates = async () => {
  const response = await api.get("cpe/floor-batch-templates/");
  return response.data;
};

export const createFloorBatchTemplate = async (payload) => {
  const response = await api.post("cpe/floor-batch-templates/", payload);
  return response.data;
};

export const updateFloorBatchTemplate = async (templateId, payload) => {
  const response = await api.patch(`cpe/floor-batch-templates/${templateId}/`, payload);
  return response.data;
};

export const deleteFloorBatchTemplate = async (templateId) => {
  const response = await api.delete(`cpe/floor-batch-templates/${templateId}/`);
  return response.data;
};
