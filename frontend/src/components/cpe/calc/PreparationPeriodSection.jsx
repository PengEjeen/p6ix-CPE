import React, { useEffect, useState, useRef } from "react";
import DataTable from "../DataTable";
import {
  detailPreparationPeriod,
  updatePreparationPeriod,
} from "../../../api/cpe/calc";
import { updateQuotation } from "../../../api/cpe/quotation";
import { detailPreparationWork } from "../../../api/cpe/criteria";

export default function PreparationPeriodSection({ projectId, ground_floor, earthwork_day, framework_day }) {
    const [data, setData] = useState({});
    const latestDataRef = useRef({});
    const [loading, setLoading] = useState(true);
    const [utilData, setUtilData] = useState({});

    // 데이터 로드
    useEffect(() => {
        const fetchData = async () => {
        try {
            const res = await detailPreparationPeriod(projectId);
            setData(res.data);
            latestDataRef.current = res.data;

            const res1 = await detailPreparationWork(projectId);
            setUtilData(res1);
        } catch (err) {
            console.error("준비/정리기간 불러오기 실패:", err);
        } finally {
            setLoading(false);
        }
        };
        fetchData();
    }, [projectId]);

    if (loading) return <div className="text-gray-400">로딩 중...</div>;

    // 값 변경 핸들러
    const handleChange = (key, value) => {
        const updated = { ...data, [key]: value };
        setData(updated);
        latestDataRef.current = updated;
    };

    // 자동 저장
    const onAutoSave = async (latestData) => {
        try {
        await updatePreparationPeriod(projectId, latestData);
        } catch (err) {
        console.error("준비/정리기간 자동저장 실패:", err);
        }
    };

    // utilData 기반 계산
    const getFloorMonth = (floor) => {
        if (!utilData) return null;
        if (floor <= 10) return utilData.floors_under_10;
        if (floor <= 15) return utilData.floors_under_15;
        if (floor <= 20) return utilData.floors_under_20;
        if (floor <= 30) return utilData.floors_under_30;
        if (floor <= 45) return utilData.floors_under_45;
        return utilData.floors_over_46;
    };

    const getUnitMonth = (household) => {
        if (!utilData) return null;
        if (household === "2000 이하") return utilData.units_under_2000;
        if (household === "2000~3000세대") return utilData.units_2000_3000;
        if (household === "3000 이상") return utilData.units_over_3000;
        return null;
    };

    const floorMonth = getFloorMonth(Number(ground_floor));
    const unitMonth = getUnitMonth(data.household);

    // 공사기간 산정 (Calendar Day)
    const columnsPeriod = [
        { key: "preparation", label: "준비기간" },
        { key: "construction", label: "공사기간" },
        { key: "cleanup", label: "정리기간" },
        { key: "total", label: "총 공사기간" },
    ];

    // 공사기간 산정 (Calendar Day)
    const rowsPeriod = (() => {
        // 안전한 숫자 변환
        const prep = data.is_preparation_input_days
            ? Number(data.preparation_input_days) || 0
            : 15; // 기본 준비기간 15일

        const earthCal = Number(earthwork_day?.total_calendar_day) || 0;
        const frameCal = Number(framework_day?.total_calendar_day) || 0;

        const clean =
            data.is_home && utilData
            ? Number(utilData.residential_days) || 0
            : Number(utilData.non_residential_days) || 0;

        const floorTerm =
            (data.is_floors_under_months
            ? Number(data.floors_under_months)
            : Number(floorMonth) || 0) * 30.5;

        // 합계 계산
        const construction =
            earthCal + frameCal + floorTerm + (unitMonth*30.5); //세대 수 공사기간과 마감공사 기간

        const total = prep + construction + clean;

    // Quotation 동기화
    if (!isNaN(prep) && !isNaN(floorTerm) && !isNaN(clean)) {
        const unitMonth = getUnitMonth(data.household);
        const additionalDays = unitMonth ? unitMonth * 30.5 : 0;

        const payload = {
        preparation_period: Math.round(prep),       // 준비기간
        finishing_work: Math.round(floorTerm),      // 마감공사 (층수별)
        additional_period: Math.round(additionalDays), // 추가기간 (세대 수)
        cleanup_period: Math.round(clean),          // 정리기간
        };

        updateQuotation(projectId, payload)
        .then(() => console.log("Quotation updated:", payload))
        .catch((err) => console.error("Quotation update failed:", err));
    }

    return [
        {
        label: "공사기간 합계",
        preparation: `${prep.toFixed(0)}일`,
        construction: `${Math.round(construction)}일`,
        cleanup: `${clean.toFixed(0)}일`,
        total: `${Math.round(total)}일 / ${Math.round(total / 30.5)}개월`,
        },
    ];
    })();



  // 공종별 공사기간 산정
  const columnsByType = [
    { key: "label", label: "공종" },
    { key: "working", label: "작업일" },
    { key: "nonworking", label: "비작업일" },
  ];

  const rowsByType = [
    { label: "토공사", working: earthwork_day.total_working_day, 
        nonworking: earthwork_day.total_calendar_day - earthwork_day.total_working_day },
    { label: "골조공사", working: Number(framework_day.total_working_day), 
        nonworking: framework_day.total_calendar_day - Number(framework_day.total_working_day) },
  ];
  // 공통 컬럼 정의
  const columns = [
    { key: "label", label: "분류" },
    { key: "value", label: "선택 / 입력 사항", editable: true },
    { key: "calendar", label: "Calendar Day" },
  ];

  // 준비/정리 기간 및 추가공사기간
  const rowsMain = [
    {
      label: "준비기간",
      value: data.preparation_fixed_months,
      type: "text",
      calendar: data.is_preparation_input_days ? data.preparation_input_days : "15",
    },
    {
      label: "준비기간 직접입력",
      type: "manual",
      value: data.preparation_input_days,
      manualFlags: {
        is_preparation_input_days: data.is_preparation_input_days,
      },
    },
    {
      label: "정리기간",
      type: "select",
      value: data.is_home ? "주거시설" : "비주거시설",
      options: ["주거시설", "비주거시설"],
      calendar: data.is_home ? utilData.residential_days : utilData.non_residential_days,
    },
    {
      label: "세대 수에 따른 추가공사기간",
      value: data.household,
      type: "select",
      options: ["2000 이하", "2000~3000세대", "3000 이상"],
      calendar: unitMonth ? `${unitMonth}개월` : "",
    },
  ];

  // 마감공사 (층수별 공기산정)
  const rowsFinishing = [
    {
      label: "층수 별 공기산정",
      value: `${ground_floor || 0}F`,
      type: "readonly",
      calendar: data.is_floors_under_months ? `${data.floors_under_months}개월` : `${floorMonth}개월`,
    },
    {
      label: "직접입력",
      type: "manual",
      value: data.floors_under_months,
      manualFlags: {
        is_floors_under_months: data.is_floors_under_months,
      },
      calendar: "",
    },
  ];

  // 렌더링
  return (
    <div className="space-y-6">
        {/* 공사기간 산정 */}
        <section className="rounded-xl overflow-hidden shadow-lg bg-[#2c2c3a] border border-gray-700">
            <div className="bg-[#3a3a4a] px-4 py-2 border-b border-gray-600 flex items-center justify-between">
            <h3 className="text-sm md:text-md font-semibold text-white">
                공사기간 산정 (Calendar Day)
            </h3>
            </div>
            <div className="p-3">
            <DataTable
                columns={columnsPeriod}
                rows={rowsPeriod}
                onChange={() => {}}
            />
            </div>
        </section>

        {/* 공종별 공사기간 산정 */}
        <section className="rounded-xl overflow-hidden shadow-lg bg-[#2c2c3a] border border-gray-700">
            <div className="bg-[#3a3a4a] px-4 py-2 border-b border-gray-600 flex items-center justify-between">
            <h3 className="text-sm md:text-md font-semibold text-white">
                공종별 공사기간 산정
            </h3>
            </div>
            <div className="p-3">
            <DataTable
                columns={columnsByType}
                rows={rowsByType}
                onChange={() => {}}
            />
            </div>
        </section>
        {/* 준비/정리 기간 및 추가공사기간 */}
        <section className="rounded-xl overflow-hidden shadow-lg bg-[#2c2c3a] border border-gray-700">
            <div className="bg-[#3a3a4a] px-4 py-2 border-b border-gray-600 flex items-center justify-between">
            <h3 className="text-sm md:text-md font-semibold text-white">
                준비/정리 기간 및 추가공사기간
            </h3>
            </div>

            <div className="p-3">
            <DataTable
                columns={columns}
                rows={rowsMain}
                onChange={(i, k, v) => {
                if (i === 1) {
                    if (k === "is_preparation_input_days")
                    handleChange("is_preparation_input_days", v);
                    else if (k === "value")
                    handleChange("preparation_input_days", v);
                } else if (i === 2) {
                    handleChange("is_home", v === "주거시설");
                } else if (i === 0)
                    handleChange("preparation_fixed_months", v);
                else if (i === 3) handleChange("household", v);
                }}
                onAutoSave={() => onAutoSave(latestDataRef.current)}
            />
            </div>
        </section>

        {/* 마감공사 (층수별 공기산정) */}
        <section className="rounded-xl overflow-hidden shadow-lg bg-[#2c2c3a] border border-gray-700">
            <div className="bg-[#3a3a4a] px-4 py-2 border-b border-gray-600 flex items-center justify-between">
            <h3 className="text-sm md:text-md font-semibold text-white">
                마감공사 (층수별 공기산정)
            </h3>
            </div>

            <div className="p-3">
            <DataTable
                columns={columns}
                rows={rowsFinishing}
                onChange={(i, k, v) => {
                if (i === 1) {
                    if (k === "is_floors_under_months")
                    handleChange("is_floors_under_months", v);
                    else if (k === "value")
                    handleChange("floors_under_months", v);
                }
                }}
                onAutoSave={() => onAutoSave(latestDataRef.current)}
            />
            </div>
        </section>
    </div>
  );
}
