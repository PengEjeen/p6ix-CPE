import React, { useEffect, useRef, useState } from "react";
import DataTable from "../DataTable";
import "../utils/scroll.css";
import AccordionSection from "../AccordionSection";
import {
  detailFrameworkInput,
  updateFrameworkInput,
} from "../../../api/cpe/calc";
import { updateQuotation } from "../../../api/cpe/quotation";
import { detailFramework } from "../../../api/cpe/criteria";

// 층 테이블 섹션
function FloorSection({
  title,
  floors,
  type,
  floorOptions,
  onChange,
  onAutoSave,
  is_sunta,
  utilData,
  utilization,
  defaultOpen = false,
}) {
  // 지상만 병행유무 편집 가능, 지하는 readonly
  const baseCols = [
    { key: "floor", label: "층", editable: false },
    { key: "height", label: "층고 (m)", editable: true },
    { key: "floor_sep", label: "층 구분", editable: true },
  ];
  const tailCols = [
    { key: "workingday", label: "Work Day", editable: false },
    { key: "calendarday", label: "Cal Day", editable: false },
  ];
  const columns =
    type === "ground"
      ? [...baseCols, { key: "is_parallelism", label: "병행유무", editable: true }, ...tailCols]
      : [...baseCols, ...tailCols];

  // Cal Day 계산 함수
  const calcCalendarDay = (
    floor_sep,
    height,
    is_sunta,
    type,
    utilData,
    is_parallelism = false
  ) => {
    if (!utilData) return null;

    const {
      reverse_excavation, // 역타 시 적용
      floor_height_data = [],
      change_transfer,
      change_setting,
      change_refuge,
      change_piloti,
      change_podium,
      change_sky,
      change_cycle_time,
    } = utilData;

    // 층 구분 → 소요일 매핑
    const floorSepMap = {
      전이층: change_transfer,
      세팅층: change_setting,
      피난층: change_refuge,
      필로티: change_piloti,
      포디움: change_podium,
      스카이라운지: change_sky,
      "Cycle Time": change_cycle_time,
    };

    // 1) 병행: 지상 + 병행 체크 → 0
    if (type === "ground" && is_parallelism === true) return 0;

    // 2) 역타: 지하 + 역타(!is_sunta) → reverse_excavation
    if (!is_sunta && type === "basement") return reverse_excavation;

    // 3) 층 구분 우선
    if (
      floor_sep &&
      Object.prototype.hasOwnProperty.call(floorSepMap, floor_sep) &&
      floorSepMap[floor_sep] != null
    ) {
      return floorSepMap[floor_sep];
    }

    // 4) 층고 기반 (상한 매칭: h ≤ r.height 인 "첫" 항목, 없으면 마지막)
    if (!Array.isArray(floor_height_data) || floor_height_data.length === 0) return null;

    const h = Number(height);
    if (!Number.isFinite(h) || h === 0) {
      return floor_height_data[0]?.day ?? null;
    }
    const ge = floor_height_data.find((r) => Number(r.height) >= h);
    return ge ? ge.day : floor_height_data[floor_height_data.length - 1]?.day ?? null;
  };

  // 각 층별 Cal/Work Day 계산 → rows 구성
  const rows = floors.map((f) => {
    const heightNum = Number(f.height) || 0;
    const calDay = calcCalendarDay(
      f.floor_sep,
      heightNum,
      is_sunta,
      type,
      utilData,
      type === "ground" ? !!f.is_parallelism : false
    );
    const workDay = Number.isFinite(calDay)
      ? Math.round(calDay * ((Number(utilization) || 100) / 100))
      : "";

    const common = {
      floor: f.floor,
      height: f.height,
      floor_sep: f.floor_sep,
      calendarday: calDay ?? "",
      workingday: workDay ?? "",
      type: {
        floor: "readonly",
        height: "number",
        floor_sep: "select",
        calendarday: "readonly",
        workingday: "readonly",
      },
      options: floorOptions,
      unit: "m",
    };

    if (type === "ground") {
      return {
        ...common,
        is_parallelism: !!f.is_parallelism,
        type: { ...common.type, is_parallelism: "checkbox" },
      };
    }
    return common; // basement: 병행유무 칼럼 없음
  });

  return (
    <AccordionSection title={title} defaultOpen={defaultOpen}>
      <div className="p-3">
        <DataTable
          columns={columns}
          rows={rows}
          onChange={(rowIdx, key, value) => onChange(type, rowIdx, key, value)}
          onAutoSave={onAutoSave}
        />
      </div>
    </AccordionSection>
  );
}

// 메인 컴포넌트
export default function FrameworkInputSection({
  projectId,
  basement_floors = 0,
  ground_floors = 0,
  utilization,
  is_sunta,
  onFrameworkInputChange,
  onSavingChange
}) {
  const [data, setData] = useState({});
  const latestDataRef = useRef({});
  const lastQuotationPayloadRef = useRef(null);
  const [utilData, setUtilData] = useState({});
  const [loading, setLoading] = useState(true);

  // 스크롤 관련 상태
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollRef = useRef(null);
  const scrollTimeout = useRef(null);
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

  // 데이터 로드 (입력 데이터)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await detailFrameworkInput(projectId);
        const baseData = res.data;

        // 층별 기본 구조 생성 (누락 방지 + 병행유무 초기화)
        const defaultFloors = {
          basement: Array.from({ length: basement_floors }, (_, i) => ({
            floor: i + 1,
            height: baseData?.floor_height_data?.basement?.[i]?.height ?? null,
            floor_sep: baseData?.floor_height_data?.basement?.[i]?.floor_sep ?? null,
          })),
          ground: Array.from({ length: ground_floors }, (_, i) => ({
            floor: i + 1,
            height: baseData?.floor_height_data?.ground?.[i]?.height ?? null,
            floor_sep: baseData?.floor_height_data?.ground?.[i]?.floor_sep ?? null,
            is_parallelism: baseData?.floor_height_data?.ground?.[i]?.is_parallelism ?? false,
          })),
        };

        const merged = { ...baseData, floor_height_data: defaultFloors };
        setData(merged);
        latestDataRef.current = merged;

      } catch (err) {
        console.error("골조공사 입력 불러오기 실패:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId, basement_floors, ground_floors,]);

  // 기준/적용값(utilData) 로드
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await detailFramework(projectId);
        setUtilData(res);
      } catch (err) {
        console.error("utilData not founded:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  // 자동 저장
  const onAutoSave = async (latestData) => {
    try {
      const payload = {
        ...latestData,
        floor_height_data: {
          basement: latestData.floor_height_data?.basement || [],
          ground: latestData.floor_height_data?.ground || [],
        },
      };
      await updateFrameworkInput(projectId, payload);
    } catch (err) {
      console.error("골조공사 자동저장 실패:", err);
    }
  };

  // 값 변경 핸들러 (상위 키)
  const handleChange = (key, value) => {
    const updated = { ...data, [key]: value };
    setData(updated);
    latestDataRef.current = updated;
    if (onFrameworkInputChange) {
      onFrameworkInputChange({
        total_working_day: baseWorkingDay + totalWorkSum,
        total_calendar_day: baseCalendarDay + totalCalSum
      })
    }
    onAutoSave(updated);
  };

  // 층별 변경 핸들러
  const handleFloorChange = (type, rowIdx, key, value) => {
    const updatedFloors = {
      ...data.floor_height_data,
      [type]: data.floor_height_data[type].map((f, i) =>
        i === rowIdx ? { ...f, [key]: value } : f
      ),
    };
    handleChange("floor_height_data", updatedFloors);
  };



  // 기초 골조 기간 계산
  const calcBaseDays = () => {
    const thicknessData = utilData?.base_thickness_data || [];
    if (!Array.isArray(thicknessData) || thicknessData.length === 0) return { work: 0, cal: 0 };

    const t = Number(data.base_thickness);
    if (!Number.isFinite(t) || t === 0) {
      // 두께 미입력 → 첫 번째 값
      const d = thicknessData[0]?.day ?? 0;
      return {
        work: d,
        cal: Math.round(d * (100 / (Number(utilization) || 100))),
      };
    }

    // thickness 이하(<=) 조건 만족하는 마지막 항목
    const lowerOrEqual = thicknessData.filter((r) => Number(r.thickness) <= t);
    let matched;
    if (lowerOrEqual.length > 0) {
      matched = lowerOrEqual.reduce((prev, curr) =>
        Number(curr.thickness) > Number(prev.thickness) ? curr : prev
      );
    } else {
      matched = thicknessData[0]; // 이하값 없음 → 첫 번째
    }

    const work = matched?.day ?? 0;
    const cal = Math.round(work * (100 / (Number(utilization) || 100)));
    return { work, cal };
  };

  const { work: baseWorkingDay, cal: baseCalendarDay } = calcBaseDays();
  // 합계 계산 (지하+지상 → 총합)

  const calcCalDayForRow = (
    floor_sep,
    height,
    isSunta,
    typeRow,
    util,
    isParallel = false
  ) => {
    if (!util) return null;

    const {
      reverse_excavation,
      floor_height_data = [],
      change_transfer,
      change_setting,
      change_refuge,
      change_piloti,
      change_podium,
      change_sky,
      change_cycle_time,
    } = util;

    const floorSepMap = {
      전이층: change_transfer,
      세팅층: change_setting,
      피난층: change_refuge,
      필로티: change_piloti,
      포디움: change_podium,
      스카이라운지: change_sky,
      "Cycle Time": change_cycle_time,
    };

    if (typeRow === "ground" && isParallel === true) return 0;
    if (!isSunta && typeRow === "basement") return reverse_excavation;

    if (
      floor_sep &&
      Object.prototype.hasOwnProperty.call(floorSepMap, floor_sep) &&
      floorSepMap[floor_sep] != null
    ) {
      return floorSepMap[floor_sep];
    }

    const table = Array.isArray(floor_height_data) ? floor_height_data : [];
    if (table.length === 0) return null;

    const h = Number(height);
    if (!Number.isFinite(h) || h === 0) return table[0]?.day ?? null;

    const ge = table.find((r) => Number(r.height) >= h);
    return ge ? ge.day : table[table.length - 1]?.day ?? null;
  };

  const sum = (arr) => arr.reduce((a, b) => a + b, 0);

  // 모든 층(지하+지상) 합쳐서 총합 도출
  // 1. 층 데이터 분리
  const basementFloorsArr = data.floor_height_data?.basement ?? [];
  const groundFloorsArr = data.floor_height_data?.ground ?? [];

  // 2. 합쳐서 allFloors 생성 (기존 유지)
  const allFloors = [
    ...basementFloorsArr.map((f) => ({ ...f, _type: "basement" })),
    ...groundFloorsArr.map((f) => ({ ...f, _type: "ground" })),
  ];

  // 3. 층별 Calendar Day 계산
  const allCalList = allFloors.map((f) => {
    const cd = calcCalDayForRow(
      f.floor_sep,
      f.height,
      is_sunta,
      f._type,
      utilData,
      f._type === "ground" ? !!f.is_parallelism : false
    );
    return Number.isFinite(cd) ? cd : 0;
  });

  // 4. 각 층의 CalendarDay를 그대로 합계로 쓰는 대신,
  //    basement / ground 각각 따로 필터링해서 합산
  const basementCalSum = sum(
    allFloors
      .filter((f) => f._type === "basement")
      .map((f, idx) => allCalList[idx])
  );

  const groundCalSum = sum(
    allFloors
      .filter((f) => f._type === "ground")
      .map((f, idx) => allCalList[idx])
  );

  // 5. 기존처럼 전체 합계도 필요하다면 유지 가능
  const totalCalSum = basementCalSum + groundCalSum;

  // 6. WorkingDay 계산도 동일하게 처리
  const allWorkList = allCalList.map((cd) =>
    Math.round(cd * ((Number(utilization) || 100) / 100))
  );
  const totalWorkSum = sum(allWorkList);

  useEffect(() => {
    if (!utilData || Object.keys(utilData).length === 0) return;
    if (loading || !projectId) return;

    const totalWorking = baseWorkingDay + totalWorkSum;
    const totalCalendar = baseCalendarDay + totalCalSum;

    // 프레임워크 입력 변경 콜백
    if (onFrameworkInputChange) {
      const latest = latestDataRef.current.framework_totals || {};
      if (
        latest.total_working_day !== totalWorking ||
        latest.total_calendar_day !== totalCalendar
      ) {
        onFrameworkInputChange({
          total_working_day: totalWorking,
          total_calendar_day: totalCalendar,
        });

        latestDataRef.current.framework_totals = {
          total_working_day: totalWorking,
          total_calendar_day: totalCalendar,
        };
      }
    }

    // -------------------------
    // Quotation 테이블 업데이트
    // -------------------------
    const payload = {
      base_framework: baseCalendarDay,          // 기초골조
      basement_framework: basementCalSum ?? 0,  // 지하골조 (아래 참고)
      ground_framework: groundCalSum ?? 0,      // 지상골조 (아래 참고)
    };

    if (JSON.stringify(lastQuotationPayloadRef.current) !== JSON.stringify(payload)) {
      console.log('[골조공사] Quotation 업데이트:', payload);
      lastQuotationPayloadRef.current = payload;

      if (onSavingChange) onSavingChange(true);

      const timer = setTimeout(() => {
        updateQuotation(projectId, payload)
          .then(() => console.log('[골조공사] Quotation 저장 완료'))
          .catch((err) => console.error('[골조공사] Quotation 저장 실패:', err))
          .finally(() => {
            if (onSavingChange) onSavingChange(false);
          });
      }, 1500);

      return () => clearTimeout(timer);
    }

  }, [
    loading,
    projectId,
    baseWorkingDay,
    baseCalendarDay,
    totalWorkSum,
    totalCalSum,
    basementCalSum,
    groundCalSum,
    utilData,
  ]);

  // 일반 섹션 (총합만 표시)
  const sections = [
    {
      title: "기초 골조",
      rows: [
        { label: "기초 두께", value: data.base_thickness, type: "number", unit: "m" },
        { label: "Working Day", value: baseWorkingDay, type: "readonly", unit: "일" },
        { label: "Calendar Day", value: baseCalendarDay, type: "readonly", unit: "일" },
      ],
      keys: ["base_thickness", "base_working_day", "base_calendar_day"],
    },
    {
      title: "지하·지상 골조",
      rows: [
        {
          label: "갱폼 인양방식",
          value: data.is_TC ? "TC 인양식" : "유압인양방식",
          type: "select",
          options: ["TC 인양식", "유압인양방식"],
        },
        {
          label: "Cycle Time",
          value: data.cycle_time,
          type: "number",
          unit: "일",
        },
        // 총합 표시 (readonly)
        { label: "Working Day", value: totalWorkSum, type: "readonly", unit: "일" },
        { label: "Calendar Day", value: totalCalSum, type: "readonly", unit: "일" },
      ],
      keys: ["is_TC", "cycle_time", "_total_work_sum", "_total_cal_sum"],
    },
  ];

  // 층 구분 옵션
  const floorOptions = [
    "전이층",
    "세팅층",
    "피난층",
    "필로티",
    "포디움",
    "스카이라운지",
    "Cycle Time",
  ];

  if (loading) return <div className="text-gray-400">로딩 중...</div>;
  // 렌더링
  return (
    <div
      className="space-y-4 pr-2 transition-all duration-300"
    >
      {/* 일반 섹션 */}
      {sections.map((section, idx) => (
        <AccordionSection
          key={section.title}
          title={section.title}
          defaultOpen={idx === 0}
        >
          <div className="p-4">
            <DataTable
              columns={[
                { key: "label", label: "구분" },
                { key: "value", label: "입력 사항", editable: true },
              ]}
              rows={section.rows}
              onChange={(rowIdx, key, val) => {
                const targetKey = section.keys[rowIdx];
                if (targetKey === "is_TC") handleChange(targetKey, val === "TC 인양식");
                else if (targetKey && targetKey.startsWith("_")) {
                  // 총합 로우들은 readonly라 변경 없음
                  return;
                } else {
                  handleChange(targetKey, val);
                }
              }}
              onAutoSave={() => onAutoSave(latestDataRef.current)}
            />
          </div>
        </AccordionSection>
      ))}

      {/* 층고 입력 데이터 */}
      <AccordionSection title="층고 입력 데이터">
        <div className="p-4 space-y-6">
          <FloorSection
            title="지하층"
            type="basement"
            floors={data.floor_height_data?.basement || []}
            floorOptions={floorOptions}
            onChange={handleFloorChange}
            onAutoSave={() => onAutoSave(latestDataRef.current)}
            is_sunta={is_sunta}
            utilData={utilData}
            utilization={utilization}
            defaultOpen
          />
          <FloorSection
            title="지상층"
            type="ground"
            floors={data.floor_height_data?.ground || []}
            floorOptions={floorOptions}
            onChange={handleFloorChange}
            onAutoSave={() => onAutoSave(latestDataRef.current)}
            is_sunta={is_sunta}
            utilData={utilData}
            utilization={utilization}
          />
        </div>
      </AccordionSection>
    </div>
  );
}
