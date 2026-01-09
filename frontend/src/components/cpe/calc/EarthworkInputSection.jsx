import React, { useEffect, useRef, useState } from "react";
import DataTable from "../DataTable";
import "../utils/scroll.css";
import AccordionSection from "../AccordionSection";
import {
  detailEarthworkInput,
  updateEarthworkInput,
} from "../../../api/cpe/calc";
import { updateQuotation } from "../../../api/cpe/quotation";
import { detailEarthwork } from "../../../api/cpe/criteria";

export default function EarthworkInputSection({ projectId, utilization, nearby_env, onEarthWorkInputChange }) {
    const [data, setData] = useState({});
    const [utilData, setUtilData] = useState({});
    const [loading, setLoading] = useState(true);
    const latestDataRef = useRef({});
    const lastQuotationPayloadRef = useRef(null);

    // 스크롤 관련 상태
    const [isScrolling, setIsScrolling] = useState(false);
    const scrollRef = useRef(null);
    const scrollTimeout = useRef(null);
    
    // 상위 컴포넌트로 보낼 값
    const totalWork = 0;
    const totalCal = 0;

    const handleScroll = () => {
        setIsScrolling(true);
        clearTimeout(scrollTimeout.current);
        scrollTimeout.current = setTimeout(() => setIsScrolling(false), 1000);
    };

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        el.addEventListener("scroll", handleScroll);
        return () => el.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (!projectId) return;
            try {
                const res = await detailEarthworkInput(projectId);
                setData(res.data);
                latestDataRef.current = res.data;
                if (onEarthWorkInputChange) {
                    onEarthWorkInputChange({
                        is_sunta: res.data.is_sunta,
                        total_working_day: totalWork,
                        total_calendar_day: totalCal,
                    })
                }
                const res1 = await detailEarthwork(projectId);
                setUtilData(res1);
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
    
        if (onEarthWorkInputChange) {
            onEarthWorkInputChange({
                is_sunta: updated.is_sunta
            })
        }
    };
    //날짜계산 변수들
    const [earthRetentionWorkingDay, setEarthRetentionWorkingDay] = useState(null);
    const [earthRetentionCalendarDay, setEarthRetentionCalendarDay] = useState(null);
    const [earthsupportWorkingDay, setEarthSupportWorkingDay] = useState(null);
    const [earthsupportCalendarDay, setEarthSupportCalendarDay] = useState(null);
    const [earthsoilWorkingDay, setSoilWorkingDay] = useState(null);
    const [earthsoilCalendarDay, setSoilCalendarDay] = useState(null);
    const [weatheredWorkingDay, setWeatheredWorkingDay] = useState(null)
    const [weatheredCalendarDay, setWeatheredCalendarDay] = useState(null)
    const [softrockWorkingDay, setSoftrockWorkingDay] = useState(null)
    const [softrockCalendarDay, setSoftrockCalendarDay] = useState(null)
    const [hardrockWorkingDay, setHardrockWorkingDay] = useState(null)
    const [hardrockCalendarDay, setHardrockCalendarDay] = useState(null)
    const [desighnatedWorkingDay, setDesignatedWorkingDay] = useState(null)
    const [desighnatedCalendarDay, setDesignatedCalendarDay] = useState(null)

    //날짜계산 함수들
    useEffect(() => {
        const utilizationValue = Number(utilization);
        const safeUtilization =
            Number.isFinite(utilizationValue) && utilizationValue > 0
                ? utilizationValue
                : 100;

        // 흙막이 가시설 계산

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
        const calendarDay = Math.round(workingDay * (100 / safeUtilization));

        setEarthRetentionWorkingDay(workingDay);
        setEarthRetentionCalendarDay(calendarDay);


        // 지보공 계산

        const supportMethod = data.support_method;
        if (supportMethod) {
            const supportDays = {
            "어스앵커": Number(utilData?.support_earth_anchor),
            "레이커": Number(utilData?.support_raker),
            "스트럿": Number(utilData?.support_strut),
            };
            const calendarDay2 = supportDays[supportMethod] || 0;
            const workingDay2 = Math.round(calendarDay2 * (safeUtilization / 100));

            setEarthSupportCalendarDay(calendarDay2);
            setEarthSupportWorkingDay(workingDay2);
        } else {
            setEarthSupportCalendarDay(null);
            setEarthSupportWorkingDay(null);
        }

        // 터파기 (토사) 계산

        const soilVolume = Number(data.total_earth_volume) * ((Number(data.soil_ratio) || 0) / 100) || 0; // 전체 토사량 × 비율
        const soilCrew = Math.max(Number(data.soil_crew_actual) || 1, 1); // 투입 조 (최소 1조)
        const directRatio = (Number(data.soil_direct_ratio) || 0) / 100; // 직상차 비율 (% → 소수)
        const cramRatio = (Number(data.soil_cram_ratio) || 0) / 100;     // 크람쉘 비율 (% → 소수)

        const productivitySoil = Number(utilData?.excavation_soil) || 30; // 생산성 (㎥/일)

        // 반출방법 계수 (직상차 / 크람쉘)
        const haulDirect = Number(utilData?.haul_direct) || 1;
        const haulCram = Number(utilData?.haul_cram) || 1;

        // Working Day = (전체토사량 / (투입조 × 생산성)) × (직상차비율×직상차계수 + 크람쉘비율×크람쉘계수)
        const workingDay3 = Math.round(
        (soilVolume / (soilCrew * productivitySoil)) *
        (directRatio * haulDirect + cramRatio * haulCram)
        );

        // Calendar Day = Working Day × (100 / 가동률)
        const calendarDay3 = Math.round(workingDay3 * (100 / safeUtilization));

        setSoilWorkingDay(workingDay3);
        setSoilCalendarDay(calendarDay3);



        // 풍화암 계산

        const weatheredVolume = Number(data.total_earth_volume) * ((Number(data.weathered_ratio) || 0) / 100) || 0; // 전체 풍화암량
        const weatheredCrew = Math.max(Number(data.weathered_crew_actual) || 1, 1); // 투입 조
        const directRatioW = (Number(data.weathered_direct_ratio) || 0) / 100; // 직상차 비율
        const cramRatioW = (Number(data.weathered_cram_ratio) || 0) / 100;     // 크람쉘 비율

        // 생산성
        const productivityWeathered = Number(utilData?.excavation_weathered) || 25;

        // Working Day = (전체풍화암량 / (조수 × 생산성)) × (직상차비율×직상차계수 + 크람쉘비율×크람쉘계수)
        const workingDayWeathered = Math.round(
        (weatheredVolume / (weatheredCrew * productivityWeathered)) *
        (directRatioW * haulDirect + cramRatioW * haulCram)
        );

        // Calendar Day = Working Day × (100 / 가동률)
        const calendarDayWeathered = Math.round(workingDayWeathered * (100 / safeUtilization));

        setWeatheredWorkingDay(workingDayWeathered);
        setWeatheredCalendarDay(calendarDayWeathered);



        // 연암 (Soft Rock) 계산

        const soft_rockVolume =
        Number(data.total_earth_volume) * ((Number(data.soft_rock_ratio) || 0) / 100) || 0; // 전체 연암량 (㎥)
        const soft_rockCrew = Math.max(Number(data.softrock_crew_actual) || 1, 1); // 투입 조 (최소 1조)

        // 발파공법 비율 (% → 소수)
        const soft_vibRatio = (Number(data.softrock_vibration_ratio) || 0) / 100; // 미진동
        const soft_preRatio = (Number(data.softrock_precision_ratio) || 0) / 100; // 정밀제어
        const soft_smallRatio = (Number(data.softrock_small_ratio) || 0) / 100;   // 소규모
        const soft_medRatio = (Number(data.softrock_medium_ratio) || 0) / 100;   // 중규모

        // 공법별 생산성 (㎥/일)
        const soft_prodVib = Number(utilData?.blasting_soft_vibrationless) || 60;
        const soft_prodPre = Number(utilData?.blasting_soft_precision) || 40;
        const soft_prodSmall = Number(utilData?.blasting_soft_small) || 30;
        const soft_prodMed = Number(utilData?.blasting_soft_medium) || 20;

        // 가중평균 생산성
        const soft_weightedProd =
        soft_vibRatio * soft_prodVib +
        soft_preRatio * soft_prodPre +
        soft_smallRatio * soft_prodSmall +
        soft_medRatio * soft_prodMed;

        // 계산
        const workingDaySoftRock = Math.round(
        (soft_rockVolume / (soft_rockCrew * soft_weightedProd)) *
        (directRatio * haulDirect + cramRatio * haulCram)
        );

        const calendarDaySoftRock = Math.round(
        workingDaySoftRock * (100 / safeUtilization)
        );

        // 상태 저장
        setSoftrockWorkingDay(workingDaySoftRock);
        setSoftrockCalendarDay(calendarDaySoftRock);


        // 경암 (Hard Rock) 계산

        const hard_rockVolume =
        Number(data.total_earth_volume) * ((Number(data.hard_rock_ratio) || 0) / 100) || 0; // 전체 연암량 (㎥)
        const hard_rockCrew = Math.max(Number(data.hardrock_crew_actual) || 1, 1); // 투입 조 (최소 1조)

        // 발파공법 비율 (% → 소수)
        const hard_vibRatio = (Number(data.hardrock_vibration_ratio) || 0) / 100; // 미진동
        const hard_preRatio = (Number(data.hardrock_precision_ratio) || 0) / 100; // 정밀제어
        const hard_smallRatio = (Number(data.hardrock_small_ratio) || 0) / 100;   // 소규모
        const hard_medRatio = (Number(data.hardrock_medium_ratio) || 0) / 100;   // 중규모

        // 공법별 생산성 (㎥/일)
        const hard_prodVib = Number(utilData?.blasting_hard_vibrationless) || 60;
        const hard_prodPre = Number(utilData?.blasting_hard_precision) || 40;
        const hard_prodSmall = Number(utilData?.blasting_hard_small) || 30;
        const hard_prodMed = Number(utilData?.blasting_hard_medium) || 20;

        // 가중평균 생산성
        const hard_weightedProd =
        hard_vibRatio * hard_prodVib +
        hard_preRatio * hard_prodPre +
        hard_smallRatio * hard_prodSmall +
        hard_medRatio * hard_prodMed;

        // 계산
        const workingDayHardRock = Math.round(
        (hard_rockVolume / (hard_rockCrew * hard_weightedProd)) *
        (directRatio * haulDirect + cramRatio * haulCram)
        );

        const calendarDayHardRock = Math.round(
        workingDayHardRock * (100 / safeUtilization)
        );

        // 상태 저장
        setHardrockWorkingDay(workingDayHardRock);
        setHardrockCalendarDay(calendarDayHardRock);


        // 지정공사 (Designated Work) 계산

        const designated_method = data.designated_method || ""; // 지정 공법
        const designated_work_unit = Number(data.designated_work_unit) || 0; // 공수
        const designated_drilling_depth = Number(data.designated_drilling_depth) || 0; // 천공 심도 (m)
        const designated_diameter = String(
        parseInt(data.designated_diameter) || ""
        );
        const designated_crew = Math.max(Number(data.designated_crew) || 1, 1); // 투입 조 (최소 1조)

        // 직경별 생산성 (utilData)
        const designated_rcd_prod = {
        "1500": Number(utilData?.rcd_1500) || 0,
        "1800": Number(utilData?.rcd_1800) || 0,
        "2000": Number(utilData?.rcd_2000) || 0,
        "2500": Number(utilData?.rcd_2500) || 0,
        "3000": Number(utilData?.rcd_3000) || 0,
        };

        const designated_prd_prod = {
        "600": Number(utilData?.prd_600) || 0,
        "750": Number(utilData?.prd_750) || 0,
        "900": Number(utilData?.prd_900) || 0,
        "1000": Number(utilData?.prd_1000) || 0,
        "1500": Number(utilData?.prd_1500) || 0,
        };


        // 계산 로직 (공법별 분기)

        let designated_working_day = 0;

        if (designated_method === "RCD") {
        const prod = designated_rcd_prod[designated_diameter] || 1;
        designated_working_day =
            (designated_work_unit * designated_drilling_depth) /
            (designated_crew * prod);
        } else if (designated_method === "PRD") {
        const prod = designated_prd_prod[designated_diameter] || 1;
        designated_working_day =
            (designated_work_unit * designated_drilling_depth) /
            (designated_crew * prod);
        } else if (
        ["PHC-Pile", "지내력 기초"].includes(designated_method)
        ) {
        designated_working_day = 30; // 기타 공법 고정 30일
        } else {
        designated_working_day = 0;
        }

        // Calendar Day = Working Day × (100 / 가동률)
        const designated_calendar_day = Math.round(
        designated_working_day * (100 / safeUtilization)
        );

        setDesignatedWorkingDay(Math.round(designated_working_day));
        setDesignatedCalendarDay(designated_calendar_day);
    }, [
        utilization,
        data,
        utilData,
    ]);


    useEffect(() => {
        if (!nearby_env || !utilData) return;

        // 주변현황별 기본 할증률 매핑
        const surchargeMap = {
            학교: Number(utilData.surcharge_school) || 0,
            주거지: Number(utilData.surcharge_residential) || 0,
            노후시설: Number(utilData.surcharge_old_facility) || 0,
            문화재: Number(utilData.surcharge_cultural) || 0,
            택지개발: Number(utilData.surcharge_development) || 0,
        };

        // 현재 주변현황에 맞는 할증률
        const autoSurcharge = surchargeMap[nearby_env] ?? 0;

        // 수동입력이 비활성화된 경우에만 자동 적용
        if (!data.is_surcharge) {
            setData((prev) => ({
            ...prev,
            surcharge_ratio: autoSurcharge,
            }));
            latestDataRef.current = {
            ...latestDataRef.current,
            surcharge_ratio: autoSurcharge,
            };
        }
    }, [nearby_env, data.is_surcharge, utilData]);

    //if (loading) return <p className="text-gray-400">불러오는 중...</p>;

    // totalWork / totalCal 상위 전달
    useEffect(() => {
        if (!onEarthWorkInputChange || !data) return;

        const util = Number(utilization) || 100;
        const surcharge = data.is_surcharge ? 1 + (Number(data.surcharge_ratio) || 0) / 100 : 1;

        const retentionWork = Math.round(
            (earthRetentionWorkingDay || 0) *
            ((Number(data.parallel_retention) || 100) / 100) *
            surcharge
        );
        const retentionCal = Math.round(retentionWork * (100 / util));

        const supportWork = Math.round(
            (earthsupportWorkingDay || 0) *
            ((Number(data.parallel_support) || 100) / 100) *
            surcharge
        );
        const supportCal = Math.round(supportWork * (100 / util));

        const excavationWork = Math.round(
            (earthsoilWorkingDay || 0) *
            ((Number(data.parallel_excavation) || 100) / 100) *
            surcharge
        );
        const excavationCal = Math.round(excavationWork * (100 / util));

        const designatedWork = Math.round(
            (desighnatedWorkingDay || 0) *
            ((Number(data.parallel_designated) || 100) / 100) *
            surcharge
        );
        const designatedCal = Math.round(designatedWork * (100 / util));

        const totalWork =
            retentionWork + supportWork + excavationWork + designatedWork;
        const totalCal = retentionCal + supportCal + excavationCal + designatedCal;

        onEarthWorkInputChange({
            is_sunta: data.is_sunta,
            total_working_day: totalWork,
            total_calendar_day: totalCal,
        });
        }, [
        data.is_sunta,
        data.parallel_retention,
        data.parallel_support,
        data.parallel_excavation,
        data.parallel_designated,
        data.is_surcharge,
        data.surcharge_ratio,
        utilization,
        earthRetentionWorkingDay,
        earthsupportWorkingDay,
        earthsoilWorkingDay,
        desighnatedWorkingDay,
    ]);

    // 갑지 모델에 날짜 update
    useEffect(() => {
    if (loading || !projectId) return;
    if (
        earthRetentionCalendarDay === null ||
        earthsupportCalendarDay === null ||
        earthsoilCalendarDay === null ||
        desighnatedCalendarDay === null
    ) return;

    const payload = {
        earth_retention: earthRetentionCalendarDay,
        support: earthsupportCalendarDay,
        excavation: earthsoilCalendarDay,
        designated_work: desighnatedCalendarDay,
    };

    if (JSON.stringify(lastQuotationPayloadRef.current) !== JSON.stringify(payload)) {
        lastQuotationPayloadRef.current = payload;
        updateQuotation(projectId, payload)
            .catch((err) => console.error("Quotation update failed:", err));
    }

    }, [
    loading,
    projectId,
    earthRetentionCalendarDay,
    earthsupportCalendarDay,
    earthsoilCalendarDay,
    desighnatedCalendarDay,
    ]);
    // 공통 카드 렌더러
    const renderTable = (title, headers, rows, keys, defaultOpen = false) => (
    <AccordionSection title={title} meta={headers[1]} defaultOpen={defaultOpen}>
        <div className="p-3">
        <DataTable
            columns={[
            { key: "label", label: headers[0] },
            { key: "value", label: headers[1], editable: true },
            ]}
            rows={rows}
            onChange={(i, k, v) => {
            const row = rows[i];

            // manual 타입일 때 key 매핑 다르게 처리
            if (row.type === "manual") {
                const targetKey = k === "value" ? keys[1] : keys[0];
                handleChange(targetKey, v);
            } else {
                handleChange(keys[i], v);
            }
            }}
            onAutoSave={() => onAutoSave(latestDataRef.current)}
        />
        </div>
    </AccordionSection>
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
        keys: ["soil_direct_ratio", "soil_cram_ratio", "soil_crew_actual"],
        rows: [
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
            { label: "WORKING DAY",
                value: weatheredWorkingDay ?? "-",
                type: "readonly", 
                unit: "일",
            },
            { label: "CALENDAR DAY",
                value: weatheredCalendarDay ?? "-",
                type: "readonly", 
                unit: "일",
            },
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
            { label: "WORKING DAY",
                value: softrockWorkingDay ?? "-",
                type: "readonly", 
                unit: "일",
            },
            { label: "CALENDAR DAY",
                value: softrockCalendarDay ?? "-",
                type: "readonly", 
                unit: "일",
            },
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
            { label: "WORKING DAY",
                value: hardrockWorkingDay ?? "-",
                type: "readonly", 
                unit: "일",
            },
            { label: "CALENDAR DAY",
                value: hardrockCalendarDay ?? "-",
                type: "readonly", 
                unit: "일",
            },
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
            {
            label: "직경",
            value: data.designated_diameter,
            type:
                data.designated_method === "RCD"
                ? "select"
                : data.designated_method === "PRD"
                ? "select"
                : "readonly",
            options:
                data.designated_method === "RCD"
                ? ["1500", "1800", "2000", "2500", "3000"]
                : data.designated_method === "PRD"
                ? ["600", "750", "900", "1000", "1500"]
                : [],
            unit: data.designated_method === "RCD" || data.designated_method === "PRD" ? "mm" : undefined,
            },
            { label: "투입 조(장비)", value: data.designated_crew, unit: "조" },
            { label: "WORKING DAY",
                value: desighnatedWorkingDay ?? "-",
                type: "readonly", 
                unit: "일",
            },
            { label: "CALENDAR DAY",
                value: desighnatedCalendarDay ?? "-",
                type: "readonly", 
                unit: "일",
            },
        ],
        },
        
        // 할증
        {
        title: "할증",
        headers: ["항목", "입력값"],
        keys: ["is_surcharge", "surcharge_ratio"],
        rows: [
                {
                label: "주변현황",
                type: "readonly",
                value: nearby_env
                },
                {
                label: "할증 적용 여부(%)",
                type: "manual",
                value: data.surcharge_ratio,
                manualFlags: {
                    is_surcharge: data.is_surcharge,
                },
                }
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
        {
            label: "흙막이가시설",
            value: data.parallel_retention,
            unit: `%  → WorkDay: ${Math.round(
            earthRetentionWorkingDay *
                ((Number(data.parallel_retention) || 100) / 100) *
                (data.is_surcharge
                ? 1 + (Number(data.surcharge_ratio) || 0) / 100
                : 1)
            )}일, CalDay: ${Math.round(
            (earthRetentionWorkingDay *
                ((Number(data.parallel_retention) || 100) / 100) *
                (data.is_surcharge
                ? 1 + (Number(data.surcharge_ratio) || 0) / 100
                : 1)) *
                (100 / (Number(utilization) || 100))
            )}일`,
        },
        {
            label: "지보공",
            value: data.parallel_support,
            unit: `% → WorkDay: ${Math.round(
            earthsupportWorkingDay *
                ((Number(data.parallel_support) || 100) / 100) *
                (data.is_surcharge
                ? 1 + (Number(data.surcharge_ratio) || 0) / 100
                : 1)
            )}일, CalDay: ${Math.round(
            (earthsupportWorkingDay *
                ((Number(data.parallel_support) || 100) / 100) *
                (data.is_surcharge
                ? 1 + (Number(data.surcharge_ratio) || 0) / 100
                : 1)) *
                (100 / (Number(utilization) || 100))
            )}일`,
        },
        {
            label: "터파기",
            value: data.parallel_excavation,
            unit: `% → WorkDay: ${Math.round(
            earthsoilWorkingDay *
                ((Number(data.parallel_excavation) || 100) / 100) *
                (data.is_surcharge
                ? 1 + (Number(data.surcharge_ratio) || 0) / 100
                : 1)
            )}일, CalDay: ${Math.round(
            (earthsoilWorkingDay *
                ((Number(data.parallel_excavation) || 100) / 100) *
                (data.is_surcharge
                ? 1 + (Number(data.surcharge_ratio) || 0) / 100
                : 1)) *
                (100 / (Number(utilization) || 100))
            )}일`,
        },
        {
            label: "지정공사",
            value: data.parallel_designated,
            unit: `% → WorkDay: ${Math.round(
            desighnatedWorkingDay *
                ((Number(data.parallel_designated) || 100) / 100) *
                (data.is_surcharge
                ? 1 + (Number(data.surcharge_ratio) || 0) / 100
                : 1)
            )}일, CalDay: ${Math.round(
            (desighnatedWorkingDay *
                ((Number(data.parallel_designated) || 100) / 100) *
                (data.is_surcharge
                ? 1 + (Number(data.surcharge_ratio) || 0) / 100
                : 1)) *
                (100 / (Number(utilization) || 100))
            )}일`,
        },
        ],

        },
    ];

    return (
        <div
        ref={scrollRef}
        className={`scroll-container space-y-4 h-[100vh] overflow-y-auto pr-2 transition-all duration-300 ${
            isScrolling ? "scrolling" : ""
        }`}
        >
        {tableData.map((tbl, idx) =>
            renderTable(tbl.title, tbl.headers, tbl.rows, tbl.keys, idx === 0)
        )}
        </div>
    );
}
