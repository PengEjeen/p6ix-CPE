import api from "./axios";

// sector_type: 'PUBLIC' | 'PRIVATE'  (가동률 산정 기준과 동일)
export const fetchHolidays = async (start, end, sector_type = 'PUBLIC') => {
    const response = await api.get("/operatio/holidays/", {
        params: { start, end, sector_type },
    });
    return response.data; // string[] of "YYYY-MM-DD"
};
