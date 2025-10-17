import React, { useEffect, useRef, useState } from "react";
import DataTable from "../DataTable";
import {
  detailEarthworkInput,
  updateEarthworkInput,
} from "../../../api/cpe/calc";
import {
    detailEarthwork
} from "../../../api/cpe/criteria";

export default function EarthworkInputSection({ projectId, utilization }) {
    const [data, setData] = useState({});
    const [utilData, setUtilData] = useState({});
    const [loading, setLoading] = useState(true);
    const latestDataRef = useRef({});

    useEffect(() => {
        const fetchData = async () => {
        if (!projectId) return;
        try {
            const res = await detailEarthworkInput(projectId);
            setData(res.data);
            latestDataRef.current = res.data;

            const res1 = await detailEarthwork(projectId)
            setUtilData(res1)

        } catch (err) {
            console.error("토공사 입력 데이터 불러오기 실패:", err);
        } finally {
            setLoading(false);
        }
        };
        fetchData();
    }, [projectId]);

    const onAutoSave = async (latestData) => {
        try {
        await updateEarthworkInput(projectId, latestData);
        } catch (err) {
        console.error("자동 저장 실패:", err);
        }
    };

    const handleChange = (key, value) => {
        const updated = { ...data, [key]: value };
        setData(updated);
        latestDataRef.current = updated;
        onAutoSave(updated);
    };
    //날짜계산 변수들
    const [earthRetentionWorkingDay, setEarthRetentionWorkingDay] = useState(null);
    const [earthRetentionCalendarDay, setEarthRetentionCalendarDay] = useState(null);
    const [earthsupportWorkingDay, setEarthSupportWorkingDay] = useState(null);
    const [earthsupportCalendarDay, setEarthSupportCalendarDay] = useState(null);
    const [earthsoilWorkingDay, setSoilWorkingDay] = useState(null);
    const [earthsoilCalendarDay, setSoilCalendarDay] = useState(null);
    //날짜계산 함수들
    useEffect(() => {
        // -----------------------------
        // 흙막이 가시설 계산
        // -----------------------------
        const method = data.earth_retention_method;
        const length = Number(data.retention_perimeter_length) || 0;
        const depth = Number(data.drilling_depth) || 0;
        const crew = Number(data.crew_count) || 1;

        let coef = 1;
        if (method === "CIP") coef = 0.5;
        else if (method === "H-PILE+토류판") coef = 1.5;

        const bm9 = length * depth / coef;

        const productivities = {
            "CIP": utilData?.production_cip,
            "Slurry Wall": utilData?.production_slurry,
            "Sheet Pile": utilData?.production_sheet,
            "D-WALL": utilData?.production_dwall,
            "H-PILE+토류판": utilData?.production_hpile,
        };
        const productivity = productivities[method] || 30;

        const workingDay = Math.round(bm9 / (productivity * crew));
        const calendarDay = Math.round(workingDay * ((100 / Number(utilization)) || 1));

        setEarthRetentionWorkingDay(workingDay);
        setEarthRetentionCalendarDay(calendarDay);

        // -----------------------------
        // 지보공 계산
        // -----------------------------
        const supportMethod = data.support_method;
        if (supportMethod) {
            const supportDays = {
            "어스앵커": Number(utilData?.support_earth_anchor),
            "레이커": Number(utilData?.support_raker),
            "스트럿": Number(utilData?.support_strut),
            };
            const calendarDay2 = supportDays[supportMethod] || 0;
            const workingDay2 = Math.round(calendarDay2 * ((Number(utilization)/100) || 0));

            setEarthSupportCalendarDay(calendarDay2);
            setEarthSupportWorkingDay(workingDay2);
        } else {
            setEarthSupportCalendarDay(null);
            setEarthSupportWorkingDay(null);
        }
        // -----------------------------
        // 터파기 (토사) 계산
        // -----------------------------
        const soilVolume = Number(data.total_earth_volume) || 0; // 전체 토사량
        const soilCrew = Number(data.soil_crew_actual) || 1;     // 투입 조
        const directRatio = (Number(data.soil_direct_ratio) || 0) / 100; // 직상차 비율 (% → 소수)
        const cramRatio = (Number(data.soil_cram_ratio) || 0) / 100;     // 크람쉘 비율 (% → 소수)
        const methodName = data.soil_excavation_method || "";    // 반출방법

        const productivitySoil = Number(utilData?.production_soil) || 30;

        // 반출방법 계수 utilData에서 직접 참조
        const methodValues = {
        "직상차": Number(utilData?.haul_direct) || 1,
        "크람쉘": Number(utilData?.haul_cram) || 1,
        };
        const methodCoef = methodValues[methodName] || 1;

        // Excel 식 변환
        const workingDay3 = Math.round(
        (soilVolume / (soilCrew * productivitySoil)) *
            (directRatio + cramRatio * methodCoef)
        );
        const calendarDay3 = Math.round(workingDay3 * ((100 / Number(utilization)) || 1));

        setSoilWorkingDay(workingDay3);
        setSoilCalendarDay(calendarDay3);
    }, [
        utilization,
        data.earth_retention_method,
        data.retention_perimeter_length,
        data.drilling_depth,
        data.crew_count,
        data.support_method,
        utilData,
    ]);
    //if (loading) return <p className="text-gray-400">불러오는 중...</p>;
    if (!data) return null;

    // 공통 카드 렌더러
    const renderTable = (title, headers, rows, keys) => (
        <section className="rounded-xl overflow-hidden shadow-lg bg-[#2c2c3a] border border-gray-700 mb-6">
        <div className="bg-[#3a3a4a] px-4 py-2 border-b border-gray-600 flex items-center justify-between">
            <h3 className="text-sm md:text-md font-semibold text-white">{title}</h3>
            <span className="text-xs text-gray-400">{headers[1]}</span>
        </div>

        <div className="p-3">
            <DataTable
            columns={[
                { key: "label", label: headers[0] },
                { key: "value", label: headers[1], editable: true },
            ]}
            rows={rows.map((r) => ({
                label: r.label,
                value: r.value,
                type: r.type,
                options: r.options,
                unit: r.unit,
            }))}
            onChange={(i, k, v) => handleChange(keys[i], v)}
            onAutoSave={() => onAutoSave(latestDataRef.current)}
            />
        </div>
        </section>
    );

    // 모든 분류별 데이터 구성
    const tableData = [
        {
        title: "굴착공법",
        headers: ["항목", "입력값"],
        keys: ["is_sunta", "reverse_excavation_months"],
        rows: [
            {
            label: "순타 여부",
            value: data.is_sunta,
            type: "radio",
            options: [
                { label: "순타", value: true },
                { label: "역타", value: false },
            ],
            },
            {
            label: "역타 공법",
            value: data.is_sunta ? "역타 선택 시 활성화" : data.reverse_excavation_months,
            type: data.is_sunta ? "readonly" : "select",
            options: ["Down-Up", "Up-Up", "Semi Top Down", "D-WALL", "Top-Down"],
            
            },
        ],
        },
        {
        title: "흙막이가시설",
        headers: ["항목", "입력값"],
        keys: [
            "earth_retention_method",
            "retention_perimeter_length",
            "drilling_depth",
            "crew_count",
            "special_retention_extra_days",
        ],
        rows: [
            {
            label: "흙막이 공법",
            value: data.earth_retention_method,
            type: "select",
            options: ["CIP", "Slurry Wall", "Sheet Pile", "D-WALL", "H-PILE+토류판"],
            },
            { label: "외곽 길이", value: data.retention_perimeter_length, unit: "m" },
            { label: "천공 심도", value: data.drilling_depth, unit: "m" },
            { label: "투입 조(장비)", value: data.crew_count, unit: "조" },
            {
            label: "특수 흙막이 추가 작업일수",
            value: data.special_retention_extra_days,
            unit: "일",
            },

            {
            label: "WORKING DAY",
            value: earthRetentionWorkingDay ?? "—",
            type: "readonly", 
            unit: "일",
            },
            {
            label: "CALENDAR DAY",
            value: earthRetentionCalendarDay ?? "—",
            type: "readonly",
            unit: "일",
            },
        ],
        },
        {
        title: "지보공",
        headers: ["항목", "입력값"],
        keys: ["support_method"],
        rows: [
            {
            label: "지보공 공법",
            value: data.is_sunta ? data.support_method : "순타 시 활성화",
            type: data.is_sunta ? "select" : "readonly",
            options: ["레이커", "어스앵커", "스트럿"],
            },
            {
            label: "WORKING DAY",
            value: data.is_sunta ? earthsupportWorkingDay ?? "—" : "순타 시 활성화",
            type: "readonly", 
            unit: "일",
            },
            {
            label: "CALENDAR DAY",
            value: data.is_sunta ? earthsupportCalendarDay ?? "—" : "순타 시 활성화",
            type: "readonly",
            unit: "일",
            },
        ],
        },
        {
        title: "토질 성상",
        headers: ["항목", "입력값"],
        keys: [
            "total_earth_volume",
            "soil_ratio",
            "weathered_ratio",
            "soft_rock_ratio",
            "hard_rock_ratio",
        ],
        rows: [
            { label: "전체 토사량", value: data.total_earth_volume, unit: "㎥" },
            { label: "토사 비율", value: data.soil_ratio, unit: `% → ${data.total_earth_volume * (data.soil_ratio/100)}㎥` },
            { label: "풍화암 비율", value: data.weathered_ratio, unit: `% → ${data.total_earth_volume * (data.weathered_ratio/100)}㎥`  },
            { label: "연암 비율", value: data.soft_rock_ratio, unit: `% → ${data.total_earth_volume * (data.soft_rock_ratio/100)}㎥`  },
            { label: "경암 비율", value: data.hard_rock_ratio, unit: `% → ${data.total_earth_volume * (data.hard_rock_ratio/100)}㎥`  },
        ],
        },
        // 터파기 - 토사
        {
        title: "터파기 (토사)",
        headers: ["항목", "입력값"],
        keys: ["soil_excavation_method", "soil_direct_ratio", "soil_cram_ratio", "soil_crew_actual"],
        rows: [
            { label: "반출방법", value: data.soil_excavation_method, type: "text" },
            { label: "직상차 비율", value: data.soil_direct_ratio, unit: "%" },
            { label: "크람쉘 비율", value: data.soil_cram_ratio, unit: "%" },
            { label: "실제 투입조", value: data.soil_crew_actual, unit: "조" },
            { label: "WORKING DAY",
                value: earthsoilWorkingDay ?? "-",
                type: "readonly", 
                unit: "일",
            },//earthsoilWorkingDay
            { label: "CALENDAR DAY",
                value: earthsoilCalendarDay ?? "-",
                type: "readonly", 
                unit: "일",
            },//earthsoilWorkingDay
        ],
        },
        // 터파기 - 풍화암
        {
        title: "터파기 (풍화암)",
        headers: ["항목", "입력값"],
        keys: [
            "weathered_direct_ratio",
            "weathered_cram_ratio",
            "weathered_crew_actual",
        ],
        rows: [
            { label: "직상차 비율", value: data.weathered_direct_ratio, unit: "%" },
            { label: "크람쉘 비율", value: data.weathered_cram_ratio, unit: "%" },
            { label: "실제 투입조", value: data.weathered_crew_actual, unit: "조" },
        ],
        },
        // 터파기 - 연암
        {
        title: "터파기 (연암)",
        headers: ["항목", "입력값"],
        keys: [
            "softrock_vibration_ratio",
            "softrock_precision_ratio",
            "softrock_small_ratio",
            "softrock_medium_ratio",
            "softrock_direct_ratio",
            "softrock_cram_ratio",
            "softrock_crew_actual",
        ],
        rows: [
            { label: "미진동 비율", value: data.softrock_vibration_ratio, unit: "%" },
            { label: "정밀제어 비율", value: data.softrock_precision_ratio, unit: "%" },
            { label: "소규모 비율", value: data.softrock_small_ratio, unit: "%" },
            { label: "중규모 비율", value: data.softrock_medium_ratio, unit: "%" },
            { label: "직상차 비율", value: data.softrock_direct_ratio, unit: "%" },
            { label: "크람쉘 비율", value: data.softrock_cram_ratio, unit: "%" },
            { label: "실제 투입조", value: data.softrock_crew_actual, unit: "조" },
        ],
        },
        // 터파기 - 경암
        {
        title: "터파기 (경암)",
        headers: ["항목", "입력값"],
        keys: [
            "hardrock_vibration_ratio",
            "hardrock_precision_ratio",
            "hardrock_small_ratio",
            "hardrock_medium_ratio",
            "hardrock_direct_ratio",
            "hardrock_cram_ratio",
            "hardrock_crew_actual",
        ],
        rows: [
            { label: "미진동 비율", value: data.hardrock_vibration_ratio, unit: "%" },
            { label: "정밀제어 비율", value: data.hardrock_precision_ratio, unit: "%" },
            { label: "소규모 비율", value: data.hardrock_small_ratio, unit: "%" },
            { label: "중규모 비율", value: data.hardrock_medium_ratio, unit: "%" },
            { label: "직상차 비율", value: data.hardrock_direct_ratio, unit: "%" },
            { label: "크람쉘 비율", value: data.hardrock_cram_ratio, unit: "%" },
            { label: "실제 투입조", value: data.hardrock_crew_actual, unit: "조" },
        ],
        },
        // 지정공사
        {
        title: "지정공사",
        headers: ["항목", "입력값"],
        keys: [
            "designated_method",
            "designated_work_unit",
            "designated_drilling_depth",
            "designated_diameter",
            "designated_crew",
        ],
        rows: [
            {
            label: "지정 공법",
            value: data.designated_method,
            type: "select",
            options: ["RCD", "PRD", "PHC-Pile", "지내력 기초"],
            },
            { label: "공수", value: data.designated_work_unit, unit: "공" },
            { label: "천공 심도", value: data.designated_drilling_depth, unit: "m" },
            { label: "직경", value: data.designated_diameter, unit: "mm" },
            { label: "투입 조(장비)", value: data.designated_crew, unit: "조" },
        ],
        },
        // 할증
        {
        title: "할증",
        headers: ["항목", "입력값"],
        keys: ["is_surcharge"],
        rows: [
            { label: "적용 여부", value: data.is_surcharge ? "적용" : "미적용", type: "boolean" },
        ],
        },
        // 병행률
        {
        title: "병행률",
        headers: ["항목", "입력값"],
        keys: [
            "parallel_retention",
            "parallel_support",
            "parallel_excavation",
            "parallel_designated",
        ],
        rows: [
            { label: "흙막이가시설", value: data.parallel_retention, unit: "%" },
            { label: "지보공", value: data.parallel_support, unit: "%" },
            { label: "터파기", value: data.parallel_excavation, unit: "%" },
            { label: "지정공사", value: data.parallel_designated, unit: "%" },
        ],
        },
    ];

    return (
        <div className="flex flex-col">
        {tableData.map((tbl) =>
            renderTable(tbl.title, tbl.headers, tbl.rows, tbl.keys)
        )}
        </div>
    );
}
