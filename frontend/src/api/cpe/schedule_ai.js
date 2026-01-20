import api from "../axios";

export const summarizeScheduleAiLog = (payload) =>
    api.post("/cpe/schedule-ai/summary/", payload);
