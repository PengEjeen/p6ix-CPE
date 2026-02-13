import React, { useEffect, useState, useCallback } from "react";
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
  Thermometer,
  CloudRain,
  Snowflake,
  Wind,
  Eye,
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  X,
  Info,
  MapPin,
  Clock
} from "lucide-react";

// --- Enterprise Grid Components ---

const GridToggle = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`
      relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
      transition-colors duration-200 ease-in-out focus:outline-none 
      ${checked ? 'bg-blue-600' : 'bg-gray-600'}
    `}
  >
    <span className="sr-only">Use setting</span>
    <span
      className={`
        ${checked ? 'translate-x-4' : 'translate-x-0'}
        pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 
        transition duration-200 ease-in-out
      `}
    />
  </button>
);

const GridSelect = ({ value, onChange, options, align = "left" }) => (
  <div className="relative w-full">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`
        w-full appearance-none bg-[#1a1a20] border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 
        focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 
        hover:border-gray-500 transition-colors cursor-pointer
        ${align === "right" ? "text-right pr-7" : "pl-2 pr-6"}
      `}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-[#1a1a20]">
          {opt.label}
        </option>
      ))}
    </select>
    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
  </div>
);

const GridInput = ({ value, onChange, placeholder, disabled, unit }) => (
  <div className={`flex items-center gap-1.5 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
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

// --- Main Component ---

export default function OperatingRate() {
  const { id: projectId } = useParams();
  const [workTypes, setWorkTypes] = useState([]);
  const [regions, setRegions] = useState([]);
  const [globalSettings, setGlobalSettings] = useState({
    region: '',
    dataYears: '10년',
    workWeekDays: 6,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { alert } = useConfirm();

  // Tutorial
  useTutorial('operatingRate', operatingRateSteps);

  // Load Regions
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

  // Load Data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [data, scheduleData, workCondData] = await Promise.all([
          detailOperatingRate(projectId),
          fetchScheduleItems(projectId),
          detailWorkCondition(projectId),
        ]);

        const scheduleItems = scheduleData?.items || [];
        const categoryOrder = [];
        scheduleItems.forEach((item) => {
          const category = item.main_category || "기타";
          if (!categoryOrder.includes(category)) categoryOrder.push(category);
        });

        const existing = Array.isArray(data) ? data : [];
        const existingMap = new Map(existing.map((row) => [row.main_category, row]));
        const merged = categoryOrder.map((category) => (
          existingMap.get(category) || {
            main_category: category,
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
            working_days: 0,
            climate_days_excl_dup: 0,
            legal_holidays: 0,
            operating_rate: 0,
            winter_criteria: "AVG",
          }
        ));

        setWorkTypes(merged);

        const workCond = workCondData?.data || workCondData;
        if (workCond) {
          const weekDays = Number(workCond.earthwork_type);
          setGlobalSettings((prev) => ({
            ...prev,
            workWeekDays: Number.isNaN(weekDays) ? prev.workWeekDays : weekDays,
            region: workCond.region || prev.region || '',
            dataYears: workCond.data_years ? `${workCond.data_years}년` : '10년',
            winterCriteria: workCond.winter_criteria || prev.winterCriteria || 'AVG',
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

  // Set default region
  useEffect(() => {
    if (!loading && !globalSettings.region && regions.length > 0) {
      setGlobalSettings(prev => ({ ...prev, region: regions[0].name }));
    }
  }, [regions, globalSettings.region, loading]);

  const handleCellChange = (workTypeIndex, field, value) => {
    const updated = [...workTypes];
    updated[workTypeIndex][field] = value;
    if (field.endsWith("_enabled") && value === false) {
      const base = field.replace("_enabled", "");
      const valueField = `${base}_value`;
      if (valueField in updated[workTypeIndex]) {
        updated[workTypeIndex][valueField] = null;
      }
    }
    setWorkTypes(updated);
  };

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      await updateWorkCondition(projectId, {
        earthwork_type: String(globalSettings.workWeekDays),
        framework_type: String(globalSettings.workWeekDays),
        region: globalSettings.region,
        data_years: parseInt(globalSettings.dataYears),
      });

      await updateOperatingRate(projectId, {
        weights: workTypes,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
        <span className="ml-3 text-gray-400">데이터 로딩중...</span>
      </div>
    );
  }

  const climateRows = [
    { key: "winter_threshold", label: "동절기", icon: Thermometer, type: "threshold", operator: "이하", unit: "℃", valueField: "winter_threshold_value", enabledField: "winter_threshold_enabled" },
    { key: "summer_threshold", label: "혹서기", icon: Thermometer, type: "threshold", operator: "이상", unit: "℃", valueField: "summer_threshold_value", enabledField: "summer_threshold_enabled" },
    { key: "rainfall_threshold", label: "강우량", icon: CloudRain, type: "threshold", operator: "이상", unit: "mm", valueField: "rainfall_threshold_value", enabledField: "rainfall_threshold_enabled" },
    { key: "snowfall_threshold", label: "강설량", icon: Snowflake, type: "threshold", operator: "이상", unit: "cm", valueField: "snowfall_threshold_value", enabledField: "snowfall_threshold_enabled" },
    { key: "wind_threshold", label: "순간최대풍속", icon: Wind, type: "wind" },
    { key: "dust_alert_level", label: "미세먼지", icon: Wind, type: "dust" },
    { key: "sector_type", label: "공공/민간", icon: Building2, type: "sector" },
    { key: "work_week_days", label: "주간 작업일", icon: Calendar, type: "workWeek" },
  ];

  return (
    <div className="h-full flex flex-col p-4 text-gray-200 bg-[#1e1e24] overflow-hidden">
      {/* Saving Overlay */}
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
        description="운영 가동률 상세 설정"
        className="mb-4"
      />

      {/* Control Tools */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 bg-[#2a2a35] p-4 rounded-lg border border-gray-700 shadow-sm min-h-[48px]">
        <div className="flex gap-6">
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
                options={Array.from({ length: 10 }, (_, i) => ({ value: `${i + 1}년`, label: `최근 ${i + 1}년` }))}
              />
            </div>
          </div>
        </div>
        <SaveButton onSave={handleSave} saving={saving} className="btn-blue px-6 py-2" />
      </div>

      {/* Main Grid Table */}
      <div className="flex-1 overflow-hidden bg-[#2a2a35] rounded-lg border border-gray-700 shadow-lg flex flex-col">
        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-20 shadow-md">
              <tr className="bg-[#323240] border-b border-gray-600">
                <th className="sticky left-0 bg-[#323240] py-3 px-4 text-left border-r border-gray-600 min-w-[180px] shadow-[4px_0_12px_-4px_rgba(0,0,0,0.3)]">
                  <span className="text-xs font-bold text-gray-400 uppercase">조건 항목</span>
                </th>
                {workTypes.map((workType, index) => (
                  <th key={index} className="py-3 px-4 text-center min-w-[200px] border-r border-gray-600 font-bold text-gray-200">
                    <span className="block truncate max-w-[180px] mx-auto" title={workType.main_category}>
                      {workType.main_category}
                    </span>
                  </th>
                ))}
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
                  {workTypes.map((workType, index) => (
                    <td key={index} className="p-3 border-r border-gray-600 text-center align-middle">
                      {row.type === "threshold" ? (
                        <div className="flex items-center justify-center gap-3 h-full">
                          {/* Toggle */}
                          <div className="flex items-center gap-1.5">
                            <GridToggle
                              checked={workType[row.enabledField]}
                              onChange={(val) => handleCellChange(index, row.enabledField, val)}
                            />
                            {row.key === "winter_threshold" && workType[row.enabledField] && (
                              <select
                                value={workType.winter_criteria || "AVG"}
                                onChange={(e) => handleCellChange(index, "winter_criteria", e.target.value)}
                                className="bg-[#1a1a20] border border-gray-600 rounded text-[11px] px-0.5 py-0.5 text-gray-300 focus:border-blue-500"
                              >
                                <option value="MIN">최저</option>
                                <option value="AVG">평균</option>
                                <option value="MAX">최고</option>
                              </select>
                            )}
                          </div>

                          {/* Input Area */}
                          <div className={`transition-opacity ${workType[row.enabledField] ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                            <GridInput
                              value={workType[row.valueField]}
                              onChange={(val) => handleCellChange(index, row.valueField, val)}
                              unit={row.unit}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="w-full">
                          <GridSelect
                            align="center"
                            value={
                              row.type === "wind" ? (workType.wind_threshold || "미적용") :
                              row.type === "dust" ? (workType.dust_alert_level || "NONE") :
                                row.type === "sector" ? (workType.sector_type || "PRIVATE") :
                                  (workType.work_week_days || 6)
                            }
                            onChange={(val) => handleCellChange(
                              index,
                              row.key === "work_week_days"
                                ? "work_week_days"
                                : row.type === "dust"
                                  ? "dust_alert_level"
                                  : row.type === "wind"
                                    ? "wind_threshold"
                                    : "sector_type",
                              row.type === "workWeek" ? Number(val) : val
                            )}
                            options={
                              row.type === "wind" ? [
                                { value: "미적용", label: "미적용" },
                                { value: "12m/s 이상", label: "12m/s 이상" },
                                { value: "15m/s 이상", label: "15m/s 이상" },
                              ] :
                              row.type === "dust" ? [
                                { value: "NONE", label: "미적용" },
                                { value: "WARNING", label: "주의보" },
                                { value: "ALERT", label: "경보" },
                              ] : row.type === "sector" ? [
                                { value: "PUBLIC", label: "공공" },
                                { value: "PRIVATE", label: "민간" },
                              ] : [
                                { value: 7, label: "주 7일" },
                                { value: 6, label: "주 6일" },
                                { value: 5, label: "주 5일" },
                              ]
                            }
                          />
                        </div>
                      )}
                    </td>
                  ))}
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
                {workTypes.map((workType, index) => (
                  <td key={index} className="p-4 border-r border-gray-600 bg-[#22222b] hover:bg-[#2a2a35] transition-colors">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="text-2xl font-black text-green-400 tracking-tight">
                        {workType.operating_rate}<span className="text-sm font-bold ml-0.5">%</span>
                      </span>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-400 w-full px-2">
                        <div className="flex justify-between"><span>작업</span><span className="text-gray-200 font-mono">{workType.working_days}일</span></div>
                        <div className="flex justify-between"><span>불능</span><span className="text-gray-200 font-mono">{workType.climate_days_excl_dup}일</span></div>
                        <div className="flex justify-between col-span-2 border-t border-gray-600 pt-1 mt-1"><span>휴일</span><span className="text-gray-200 font-mono">{workType.legal_holidays}일</span></div>
                      </div>
                    </div>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {workTypes.length === 0 && !loading && (
        <div className="mt-8 text-center p-12 bg-[#2a2a35] border border-gray-700 rounded-lg">
          <Info className="w-10 h-10 text-gray-500 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-300">데이터가 없습니다</p>
        </div>
      )}
    </div>
  );
}
