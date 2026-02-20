import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  detailOperatingRate,
  updateOperatingRate,
} from "../api/cpe/operating_rate";
import { detailWorkCondition, updateWorkCondition } from "../api/cpe/calc";
import { fetchScheduleItems } from "../api/cpe_all/construction_schedule";
import { getWeatherStations } from "../api/operatio/weather";
import PageHeader from "../components/cpe/PageHeader";
import SaveButton from "../components/cpe/SaveButton";
import { useConfirm } from "../contexts/ConfirmContext";
import { useTutorial } from "../hooks/useTutorial";
import { operatingRateSteps } from "../config/tutorialSteps";
import Combobox from "../components/common/Combobox";
import {
  ChevronDown,
  ChevronRight,
  Thermometer,
  CloudRain,
  Snowflake,
  Wind,
  Building2,
  Calendar,
  Check,
  Info,
} from "lucide-react";
import {
  makeMainOperatingRateKey,
  makeProcessOperatingRateKey,
  parseOperatingRateKey,
} from "../utils/operatingRateKeys";

const WEIGHT_FIELDS = [
  "winter_threshold",
  "winter_threshold_value",
  "winter_threshold_enabled",
  "summer_threshold",
  "summer_threshold_value",
  "summer_threshold_enabled",
  "rainfall_threshold",
  "rainfall_threshold_value",
  "rainfall_threshold_enabled",
  "snowfall_threshold",
  "snowfall_threshold_value",
  "snowfall_threshold_enabled",
  "wind_threshold",
  "visibility_threshold",
  "dust_alert_level",
  "sector_type",
  "work_week_days",
  "winter_criteria",
  "working_days",
  "climate_days_excl_dup",
  "legal_holidays",
  "operating_rate",
  "type",
  "pct_7d",
  "pct_6d",
  "pct_5d",
];

const INHERIT_COMPARE_FIELDS = [
  "winter_threshold_value",
  "winter_threshold_enabled",
  "summer_threshold_value",
  "summer_threshold_enabled",
  "rainfall_threshold_value",
  "rainfall_threshold_enabled",
  "snowfall_threshold_value",
  "snowfall_threshold_enabled",
  "wind_threshold",
  "visibility_threshold",
  "dust_alert_level",
  "sector_type",
  "work_week_days",
  "winter_criteria",
];

const PROCESS_INHERIT_TYPE = "INHERIT";
const PROCESS_SPLIT_TYPE = "CUSTOM";

const defaultWeightData = (rowKey) => ({
  id: null,
  main_category: rowKey,
  winter_threshold: "최저 5℃ 이하",
  winter_threshold_value: 5,
  winter_threshold_enabled: true,
  summer_threshold: "35℃ 이상",
  summer_threshold_value: 35,
  summer_threshold_enabled: true,
  rainfall_threshold: "10mm 이상",
  rainfall_threshold_value: 10,
  rainfall_threshold_enabled: true,
  snowfall_threshold: "0.3 이상",
  snowfall_threshold_value: 0.3,
  snowfall_threshold_enabled: true,
  wind_threshold: "15m/s 이상",
  visibility_threshold: "미적용",
  dust_alert_level: "NONE",
  sector_type: "PRIVATE",
  work_week_days: 6,
  winter_criteria: "AVG",
  working_days: 0,
  climate_days_excl_dup: 0,
  legal_holidays: 0,
  operating_rate: 0,
  type: null,
  pct_7d: null,
  pct_6d: null,
  pct_5d: null,
});

const pickWeightFields = (source = {}) => {
  const picked = {};
  WEIGHT_FIELDS.forEach((field) => {
    if (source[field] !== undefined) picked[field] = source[field];
  });
  return picked;
};

const sameInheritanceValues = (left = {}, right = {}) => (
  INHERIT_COMPARE_FIELDS.every((field) => String(left[field] ?? "") === String(right[field] ?? ""))
);

const resolveProcessInheritance = (existingProcess, mainColumn) => {
  if (!existingProcess) return true;
  const typeMarker = String(existingProcess?.type || "").trim().toUpperCase();
  if (typeMarker === PROCESS_INHERIT_TYPE) return true;
  if (typeMarker === PROCESS_SPLIT_TYPE) return false;
  return sameInheritanceValues(existingProcess, mainColumn);
};

const createWeightColumn = ({
  level,
  mainCategory,
  process,
  rowKey,
  source,
  inheritFromMain = false,
}) => {
  const base = defaultWeightData(rowKey);
  return {
    ...base,
    ...pickWeightFields(source),
    id: source?.id ?? null,
    main_category: rowKey,
    row_key: rowKey,
    display_main_category: mainCategory,
    display_process: process || "",
    level,
    parent_key: mainCategory,
    inherit_from_main: level === "process" ? inheritFromMain : false,
  };
};

const applyFieldChange = (column, field, value) => {
  const next = { ...column, [field]: value };
  if (field.endsWith("_enabled") && value === false) {
    const base = field.replace("_enabled", "");
    const valueField = `${base}_value`;
    if (valueField in next) {
      next[valueField] = null;
    }
  }
  return next;
};

const GridToggle = ({ checked, onChange, disabled = false }) => (
  <button
    type="button"
    onClick={() => {
      if (!disabled) onChange(!checked);
    }}
    className={`
      relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent
      transition-colors duration-200 ease-in-out focus:outline-none
      ${checked ? "bg-blue-600" : "bg-gray-600"}
      ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
    `}
  >
    <span className="sr-only">Use setting</span>
    <span
      className={`
        ${checked ? "translate-x-4" : "translate-x-0"}
        pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0
        transition duration-200 ease-in-out
      `}
    />
  </button>
);

const GridSelect = ({ value, onChange, options, align = "left", disabled = false }) => (
  <div className={`relative w-full ${disabled ? "opacity-40" : ""}`}>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`
        w-full appearance-none bg-[#1a1a20] border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200
        focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50
        hover:border-gray-500 transition-colors
        ${disabled ? "cursor-not-allowed" : "cursor-pointer"}
        ${align === "right" ? "text-right pr-7" : align === "center" ? "text-center pl-2 pr-6" : "pl-2 pr-6"}
      `}
    >
      {options.map((opt) => (
        <option key={String(opt.value)} value={opt.value} className="bg-[#1a1a20]">
          {opt.label}
        </option>
      ))}
    </select>
    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
  </div>
);

const GridInput = ({ value, onChange, placeholder, disabled, unit }) => (
  <div className={`flex items-center gap-1.5 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      disabled={disabled}
      placeholder={placeholder}
      className="
        w-16 bg-[#1a1a20] border border-gray-600 rounded px-2 py-1.5 text-right text-sm text-gray-200
        focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50
        placeholder-gray-600 transition-colors
        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
      "
    />
    {unit && <span className="text-xs text-gray-400 select-none">{unit}</span>}
  </div>
);

export default function OperatingRate() {
  const { id: projectId } = useParams();
  const [workTypes, setWorkTypes] = useState([]);
  const [regions, setRegions] = useState([]);
  const [columnViewMode, setColumnViewMode] = useState("mixed"); // main | mixed | split
  const [expandedMainCategories, setExpandedMainCategories] = useState({});
  const [globalSettings, setGlobalSettings] = useState({
    region: "",
    dataYears: "10년",
    workWeekDays: 6,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { alert } = useConfirm();

  useTutorial("operatingRate", operatingRateSteps);

  useEffect(() => {
    const loadRegions = async () => {
      try {
        const data = await getWeatherStations();
        setRegions(data || []);
      } catch (error) {
        console.error("지역 목록 불러오기 실패:", error);
      }
    };
    loadRegions();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [weightData, scheduleData, workCondData] = await Promise.all([
          detailOperatingRate(projectId),
          fetchScheduleItems(projectId),
          detailWorkCondition(projectId),
        ]);

        const scheduleItems = scheduleData?.items || [];
        const existing = Array.isArray(weightData) ? weightData : [];

        const existingMap = new Map();
        existing.forEach((row) => {
          const key = String(row?.main_category || "").trim();
          if (key) existingMap.set(key, row);
        });

        const mainOrder = [];
        const processByMain = new Map();

        const addMain = (mainCategory) => {
          const main = String(mainCategory || "기타").trim() || "기타";
          if (!mainOrder.includes(main)) {
            mainOrder.push(main);
            processByMain.set(main, []);
          }
          return main;
        };

        const addProcess = (mainCategory, processName) => {
          const main = addMain(mainCategory);
          const process = String(processName || "").trim();
          if (!process) return;
          const list = processByMain.get(main) || [];
          if (!list.includes(process)) {
            list.push(process);
            processByMain.set(main, list);
          }
        };

        scheduleItems.forEach((item) => {
          const main = addMain(item.main_category || "기타");
          addProcess(main, item.process || "");
        });

        existing.forEach((row) => {
          const parsed = parseOperatingRateKey(row.main_category);
          const main = addMain(parsed.mainCategory || row.main_category || "기타");
          if (parsed.isProcessKey && parsed.process) {
            addProcess(main, parsed.process);
          }
        });

        const mergedColumns = [];

        mainOrder.forEach((mainCategory) => {
          const mainKey = makeMainOperatingRateKey(mainCategory);
          const existingMain = existingMap.get(mainKey);
          const mainColumn = createWeightColumn({
            level: "main",
            mainCategory,
            process: "",
            rowKey: mainKey,
            source: existingMain,
          });
          mergedColumns.push(mainColumn);

          const processList = processByMain.get(mainCategory) || [];
          processList.forEach((processName) => {
            const processKey = makeProcessOperatingRateKey(mainCategory, processName);
            const existingProcess = existingMap.get(processKey);
            const inheritFromMain = resolveProcessInheritance(existingProcess, mainColumn);
            const source = inheritFromMain ? mainColumn : existingProcess;

            const processColumn = createWeightColumn({
              level: "process",
              mainCategory,
              process: processName,
              rowKey: processKey,
              source,
              inheritFromMain,
            });

            if (existingProcess?.id) {
              processColumn.id = existingProcess.id;
            }
            processColumn.type = inheritFromMain ? PROCESS_INHERIT_TYPE : PROCESS_SPLIT_TYPE;

            mergedColumns.push(processColumn);
          });
        });

        const defaultExpanded = {};
        mainOrder.forEach((mainCategory) => {
          const hasCustomProcess = mergedColumns.some(
            (column) =>
              column.level === "process" &&
              column.parent_key === mainCategory &&
              !column.inherit_from_main
          );
          defaultExpanded[mainCategory] = hasCustomProcess;
        });

        setWorkTypes(mergedColumns);
        setExpandedMainCategories(defaultExpanded);

        const workCond = workCondData?.data || workCondData;
        if (workCond) {
          const weekDays = Number(workCond.earthwork_type);
          setGlobalSettings((prev) => ({
            ...prev,
            workWeekDays: Number.isNaN(weekDays) ? prev.workWeekDays : weekDays,
            region: workCond.region || prev.region || "",
            dataYears: workCond.data_years ? `${workCond.data_years}년` : "10년",
          }));
        }
      } catch (error) {
        console.error("가동률 불러오기 실패:", error);
        setWorkTypes([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId]);

  useEffect(() => {
    if (!loading && !globalSettings.region && regions.length > 0) {
      setGlobalSettings((prev) => ({ ...prev, region: regions[0].name }));
    }
  }, [regions, globalSettings.region, loading]);

  const processCountByMain = useMemo(() => {
    const counts = {};
    workTypes.forEach((column) => {
      if (column.level !== "process") return;
      counts[column.parent_key] = (counts[column.parent_key] || 0) + 1;
    });
    return counts;
  }, [workTypes]);

  const processSummary = useMemo(() => {
    const processColumns = workTypes.filter((column) => column.level === "process");
    return {
      total: processColumns.length,
      custom: processColumns.filter((column) => !column.inherit_from_main).length,
    };
  }, [workTypes]);

  const visibleWorkTypes = useMemo(() => {
    if (columnViewMode === "main") {
      return workTypes.filter((column) => column.level === "main");
    }
    if (columnViewMode === "split") {
      return workTypes;
    }
    return workTypes.filter(
      (column) => column.level === "main" || expandedMainCategories[column.parent_key]
    );
  }, [workTypes, columnViewMode, expandedMainCategories]);

  const handleCellChange = useCallback((rowKey, field, value) => {
    setWorkTypes((prev) => {
      const targetIndex = prev.findIndex((column) => column.row_key === rowKey);
      if (targetIndex === -1) return prev;

      const updated = [...prev];
      const target = applyFieldChange(updated[targetIndex], field, value);
      updated[targetIndex] = target;

      if (target.level === "main") {
        for (let i = 0; i < updated.length; i += 1) {
          const column = updated[i];
          if (
            column.level === "process" &&
            column.parent_key === target.parent_key &&
            column.inherit_from_main
          ) {
            updated[i] = applyFieldChange(column, field, value);
          }
        }
      }

      return updated;
    });
  }, []);

  const handleProcessInheritanceChange = useCallback((rowKey, inheritFromMain) => {
    setWorkTypes((prev) => {
      const targetIndex = prev.findIndex((column) => column.row_key === rowKey);
      if (targetIndex === -1) return prev;
      const target = prev[targetIndex];
      if (target.level !== "process") return prev;

      const updated = [...prev];
      const nextTarget = {
        ...target,
        inherit_from_main: inheritFromMain,
        type: inheritFromMain ? PROCESS_INHERIT_TYPE : PROCESS_SPLIT_TYPE,
      };

      if (inheritFromMain) {
        const parentColumn = prev.find(
          (column) => column.level === "main" && column.parent_key === target.parent_key
        );
        if (parentColumn) {
          WEIGHT_FIELDS.forEach((field) => {
            if (parentColumn[field] !== undefined) {
              nextTarget[field] = parentColumn[field];
            }
          });
        }
      }

      updated[targetIndex] = nextTarget;
      return updated;
    });
  }, []);

  const handleSetAllProcessInheritance = useCallback((inheritFromMain) => {
    setWorkTypes((prev) => {
      const mainMap = new Map(
        prev
          .filter((column) => column.level === "main")
          .map((column) => [column.parent_key, column])
      );

      return prev.map((column) => {
        if (column.level !== "process") return column;
        if (!inheritFromMain) {
          return {
            ...column,
            inherit_from_main: false,
            type: PROCESS_SPLIT_TYPE,
          };
        }

        const parentColumn = mainMap.get(column.parent_key);
        if (!parentColumn) {
          return {
            ...column,
            inherit_from_main: true,
            type: PROCESS_INHERIT_TYPE,
          };
        }

        const next = {
          ...column,
          inherit_from_main: true,
          type: PROCESS_INHERIT_TYPE,
        };
        WEIGHT_FIELDS.forEach((field) => {
          if (parentColumn[field] !== undefined) {
            next[field] = parentColumn[field];
          }
        });
        return next;
      });
    });
  }, []);

  const handleToggleMainExpand = useCallback((mainCategory) => {
    setExpandedMainCategories((prev) => ({
      ...prev,
      [mainCategory]: !prev[mainCategory],
    }));
  }, []);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);

      await updateWorkCondition(projectId, {
        earthwork_type: String(globalSettings.workWeekDays),
        framework_type: String(globalSettings.workWeekDays),
        region: globalSettings.region,
        data_years: parseInt(globalSettings.dataYears, 10),
      });

      const payloadWeights = workTypes.map((column) => {
        const payload = {
          main_category: column.row_key,
        };

        if (column.id) {
          payload.id = column.id;
        }

        WEIGHT_FIELDS.forEach((field) => {
          if (column[field] !== undefined) {
            payload[field] = column[field];
          }
        });

        return payload;
      });

      await updateOperatingRate(projectId, {
        weights: payloadWeights,
        settings: {
          region: globalSettings.region,
          dataYears: globalSettings.dataYears,
          workWeekDays: globalSettings.workWeekDays,
        },
      });

      await alert("저장되었습니다.");
      window.location.reload();
    } catch (error) {
      console.error("가동률 저장 실패:", error);
      await alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }, [alert, projectId, workTypes, globalSettings]);

  const climateRows = [
    {
      key: "winter_threshold",
      label: "동절기",
      icon: Thermometer,
      type: "threshold",
      unit: "℃",
      valueField: "winter_threshold_value",
      enabledField: "winter_threshold_enabled",
    },
    {
      key: "summer_threshold",
      label: "혹서기",
      icon: Thermometer,
      type: "threshold",
      unit: "℃",
      valueField: "summer_threshold_value",
      enabledField: "summer_threshold_enabled",
    },
    {
      key: "rainfall_threshold",
      label: "강우량",
      icon: CloudRain,
      type: "threshold",
      unit: "mm",
      valueField: "rainfall_threshold_value",
      enabledField: "rainfall_threshold_enabled",
    },
    {
      key: "snowfall_threshold",
      label: "강설량",
      icon: Snowflake,
      type: "threshold",
      unit: "cm",
      valueField: "snowfall_threshold_value",
      enabledField: "snowfall_threshold_enabled",
    },
    { key: "wind_threshold", label: "순간최대풍속", icon: Wind, type: "wind" },
    { key: "dust_alert_level", label: "미세먼지", icon: Wind, type: "dust" },
    { key: "sector_type", label: "공공/민간", icon: Building2, type: "sector" },
    { key: "work_week_days", label: "주간 작업일", icon: Calendar, type: "workWeek" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
        <span className="ml-3 text-gray-400">데이터 로딩중...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 text-gray-200 bg-[#1e1e24] overflow-hidden">
      <AnimatePresence>
        {saving && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm"
          >
            <div className="bg-[#2a2a35] p-8 rounded-lg shadow-2xl flex flex-col items-center border border-gray-700">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mb-4"></div>
              <p className="text-white text-lg font-bold">저장 중...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PageHeader
        title="가동률 분석"
        description="대공종 + process 단위 운영 가동률 설정"
        className="mb-4"
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 bg-[#2a2a35] p-4 rounded-lg border border-gray-700 shadow-sm min-h-[48px]">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-gray-400">지역</label>
            <div className="w-[180px]">
              <Combobox
                options={regions.map((r) => ({ value: r.name, label: r.name }))}
                value={globalSettings.region}
                onChange={(val) => setGlobalSettings({ ...globalSettings, region: val })}
                placeholder="지역 선택"
                className="bg-[#1a1a20] border-gray-600 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-gray-400">데이터 기간</label>
            <div className="w-[140px]">
              <GridSelect
                value={globalSettings.dataYears}
                onChange={(val) => setGlobalSettings({ ...globalSettings, dataYears: val })}
                options={Array.from({ length: 10 }, (_, i) => ({
                  value: `${i + 1}년`,
                  label: `최근 ${i + 1}년`,
                }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-400">보기</span>
            <div className="flex items-center rounded-lg border border-gray-600 overflow-hidden bg-[#1a1a20]">
              <button
                type="button"
                onClick={() => setColumnViewMode("main")}
                className={`px-3 py-1.5 text-xs font-semibold ${
                  columnViewMode === "main"
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-[#2f2f3a]"
                }`}
              >
                통합
              </button>
              <button
                type="button"
                onClick={() => setColumnViewMode("mixed")}
                className={`px-3 py-1.5 text-xs font-semibold border-x border-gray-600 ${
                  columnViewMode === "mixed"
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-[#2f2f3a]"
                }`}
              >
                혼합
              </button>
              <button
                type="button"
                onClick={() => setColumnViewMode("split")}
                className={`px-3 py-1.5 text-xs font-semibold ${
                  columnViewMode === "split"
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-[#2f2f3a]"
                }`}
              >
                분리
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSetAllProcessInheritance(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-600 text-gray-200 hover:bg-[#3a3a4a]"
            >
              전체 합치기(상속)
            </button>
            <button
              type="button"
              onClick={() => handleSetAllProcessInheritance(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-500/40 text-blue-200 hover:bg-blue-500/10"
            >
              전체 분리
            </button>
            <span className="text-xs text-gray-400">
              process {processSummary.total}개 / 분리 {processSummary.custom}개
            </span>
          </div>
        </div>

        <SaveButton onSave={handleSave} saving={saving} className="btn-blue px-6 py-2" />
      </div>

      <div className="flex-1 overflow-hidden bg-[#2a2a35] rounded-lg border border-gray-700 shadow-lg flex flex-col">
        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-20 shadow-md">
              <tr className="bg-[#323240] border-b border-gray-600">
                <th className="sticky left-0 bg-[#323240] py-3 px-4 text-left border-r border-gray-600 min-w-[220px] shadow-[4px_0_12px_-4px_rgba(0,0,0,0.3)]">
                  <span className="text-xs font-bold text-gray-400 uppercase">조건 항목</span>
                </th>
                {visibleWorkTypes.map((workType) => {
                  const hasChild = (processCountByMain[workType.parent_key] || 0) > 0;
                  const expanded = expandedMainCategories[workType.parent_key];
                  const isMain = workType.level === "main";

                  return (
                    <th
                      key={workType.row_key}
                      className={`py-3 px-3 text-center min-w-[220px] border-r border-gray-600 font-bold ${
                        isMain ? "bg-[#323240] text-gray-200" : "bg-[#2b3040] text-blue-100"
                      }`}
                    >
                      {isMain ? (
                        <div className="flex items-center justify-center gap-1">
                          {columnViewMode === "mixed" && hasChild ? (
                            <button
                              type="button"
                              className="rounded p-0.5 text-gray-300 hover:bg-white/10"
                              onClick={() => handleToggleMainExpand(workType.parent_key)}
                              title={expanded ? "process 접기" : "process 펼치기"}
                            >
                              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          ) : (
                            <span className="inline-block w-4" />
                          )}
                          <span
                            className="block truncate max-w-[180px]"
                            title={workType.display_main_category}
                          >
                            {workType.display_main_category}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] text-blue-200/80">
                            {workType.display_main_category}
                          </span>
                          <span
                            className="block truncate max-w-[180px]"
                            title={workType.display_process}
                          >
                            {workType.display_process}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-300">
                              {workType.inherit_from_main ? "상속" : "분리"}
                            </span>
                            <GridToggle
                              checked={!workType.inherit_from_main}
                              onChange={(isSplit) =>
                                handleProcessInheritanceChange(workType.row_key, !isSplit)
                              }
                            />
                          </div>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-700">
              {climateRows.map((row) => (
                <tr key={row.key} className="bg-[#2a2a35] even:bg-[#252530] hover:bg-[#383845] transition-colors">
                  <td className="sticky left-0 py-3 px-4 border-r border-gray-600 bg-inherit shadow-[4px_0_12px_-4px_rgba(0,0,0,0.3)] font-medium text-gray-300">
                    <div className="flex items-center gap-2">
                      <row.icon className="w-4 h-4 text-gray-500" />
                      {row.label}
                    </div>
                  </td>

                  {visibleWorkTypes.map((workType) => {
                    const isInheritedProcess =
                      workType.level === "process" && workType.inherit_from_main;

                    return (
                      <td
                        key={workType.row_key}
                        className={`p-3 border-r border-gray-600 text-center align-middle ${
                          isInheritedProcess ? "bg-[#253243]/40" : ""
                        }`}
                      >
                        {row.type === "threshold" ? (
                          <div className="flex items-center justify-center gap-3 h-full">
                            <div className="flex items-center gap-1.5">
                              <GridToggle
                                checked={Boolean(workType[row.enabledField])}
                                onChange={(val) =>
                                  handleCellChange(workType.row_key, row.enabledField, val)
                                }
                                disabled={isInheritedProcess}
                              />
                              {row.key === "winter_threshold" && workType[row.enabledField] && (
                                <select
                                  value={workType.winter_criteria || "AVG"}
                                  onChange={(e) =>
                                    handleCellChange(
                                      workType.row_key,
                                      "winter_criteria",
                                      e.target.value
                                    )
                                  }
                                  disabled={isInheritedProcess}
                                  className="bg-[#1a1a20] border border-gray-600 rounded text-[11px] px-0.5 py-0.5 text-gray-300 focus:border-blue-500 disabled:opacity-40"
                                >
                                  <option value="MIN">최저</option>
                                  <option value="AVG">평균</option>
                                  <option value="MAX">최고</option>
                                </select>
                              )}
                            </div>

                            <div className={`transition-opacity ${workType[row.enabledField] ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                              <GridInput
                                value={workType[row.valueField]}
                                onChange={(val) =>
                                  handleCellChange(workType.row_key, row.valueField, val)
                                }
                                unit={row.unit}
                                disabled={isInheritedProcess || !workType[row.enabledField]}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="w-full">
                            <GridSelect
                              align="center"
                              disabled={isInheritedProcess}
                              value={
                                row.type === "wind"
                                  ? workType.wind_threshold || "미적용"
                                  : row.type === "dust"
                                  ? workType.dust_alert_level || "NONE"
                                  : row.type === "sector"
                                  ? workType.sector_type || "PRIVATE"
                                  : workType.work_week_days || 6
                              }
                              onChange={(val) =>
                                handleCellChange(
                                  workType.row_key,
                                  row.key === "work_week_days"
                                    ? "work_week_days"
                                    : row.type === "dust"
                                    ? "dust_alert_level"
                                    : row.type === "wind"
                                    ? "wind_threshold"
                                    : "sector_type",
                                  row.type === "workWeek" ? Number(val) : val
                                )
                              }
                              options={
                                row.type === "wind"
                                  ? [
                                      { value: "미적용", label: "미적용" },
                                      { value: "12m/s 이상", label: "12m/s 이상" },
                                      { value: "15m/s 이상", label: "15m/s 이상" },
                                    ]
                                  : row.type === "dust"
                                  ? [
                                      { value: "NONE", label: "미적용" },
                                      { value: "WARNING", label: "주의보" },
                                      { value: "ALERT", label: "경보" },
                                    ]
                                  : row.type === "sector"
                                  ? [
                                      { value: "PUBLIC", label: "공공" },
                                      { value: "PRIVATE", label: "민간" },
                                    ]
                                  : [
                                      { value: 7, label: "주 7일" },
                                      { value: 6, label: "주 6일" },
                                      { value: 5, label: "주 5일" },
                                    ]
                              }
                            />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>

            <tfoot className="sticky bottom-0 z-20 bg-[#1e1e24] border-t-2 border-gray-600 shadow-inner">
              <tr>
                <td className="sticky left-0 bg-[#1e1e24] py-4 px-4 border-r border-gray-600 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.3)]">
                  <div className="flex items-center gap-2 font-bold text-gray-200">
                    <Check className="w-5 h-5 text-green-500" />
                    산출 결과
                  </div>
                </td>

                {visibleWorkTypes.map((workType) => {
                  const isInheritedProcess =
                    workType.level === "process" && workType.inherit_from_main;

                  return (
                    <td
                      key={workType.row_key}
                      className={`p-4 border-r border-gray-600 transition-colors ${
                        isInheritedProcess ? "bg-[#213042]" : "bg-[#22222b] hover:bg-[#2a2a35]"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="text-2xl font-black text-green-400 tracking-tight">
                          {workType.operating_rate}
                          <span className="text-sm font-bold ml-0.5">%</span>
                        </span>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-400 w-full px-2">
                          <div className="flex justify-between">
                            <span>작업</span>
                            <span className="text-gray-200 font-mono">{workType.working_days}일</span>
                          </div>
                          <div className="flex justify-between">
                            <span>불능</span>
                            <span className="text-gray-200 font-mono">{workType.climate_days_excl_dup}일</span>
                          </div>
                          <div className="flex justify-between col-span-2 border-t border-gray-600 pt-1 mt-1">
                            <span>휴일</span>
                            <span className="text-gray-200 font-mono">{workType.legal_holidays}일</span>
                          </div>
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {workTypes.length === 0 && !loading && (
        <div className="mt-8 text-center p-12 bg-[#2a2a35] border border-gray-700 rounded-lg">
          <Info className="w-10 h-10 text-gray-500 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-300">데이터가 없습니다</p>
        </div>
      )}
    </div>
  );
}
