import api from "../axios";

export const safetyCheck = (formData) =>
  api.post("/cpe/vision/safety/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

