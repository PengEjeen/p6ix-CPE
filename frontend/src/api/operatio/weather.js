import api from "../axios";

// 지점(기상관측소) 목록 조회
export const getWeatherStations = async () => {
    try {
        const res = await api.get('operatio/weather-stations/');
        return res.data;
    } catch (error) {
        console.error("지점 목록 불러오기 실패:", error);
        throw error;
    }
};
