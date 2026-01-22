import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  detailOperatingRate,
  updateOperatingRate,
} from "../api/cpe/operating_rate";
import { fetchScheduleItems } from "../api/cpe_all/construction_schedule";
import { getWeatherStations } from "../api/operatio/weather";
import PageHeader from "../components/cpe/PageHeader";
import SaveButton from "../components/cpe/SaveButton";
import { useConfirm } from "../contexts/ConfirmContext";

export default function OperatingRate() {
  const { id: projectId } = useParams();
  const [workTypes, setWorkTypes] = useState([]);
  const [regions, setRegions] = useState([]);
  const [globalSettings, setGlobalSettings] = useState({
    region: '',
    dataYears: '10년',
    interiorType: '건식'  // 건식/습식
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { alert } = useConfirm();

  // 지역 목록 로드
  useEffect(() => {
    const loadRegions = async () => {
      try {
        const data = await getWeatherStations();
        setRegions(data || []);
        if (data && data.length > 0) {
          setGlobalSettings(prev => ({ ...prev, region: data[0].name }));
        }
      } catch (error) {
        console.error("지역 목록 불러오기 실패:", error);
      }
    };
    loadRegions();
  }, []);

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        const [data, scheduleData] = await Promise.all([
          detailOperatingRate(projectId),
          fetchScheduleItems(projectId),
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
          }
        ));

        const extras = existing.filter((row) => !categoryOrder.includes(row.main_category));
        setWorkTypes([...merged, ...extras]);
      } catch (error) {
        console.error("가동률 불러오기 실패:", error);
        // 404 오류여도 빈 배열 설정
        setWorkTypes([]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [projectId]);

  // 값 변경 핸들러
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

  // 저장 함수
  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      await updateOperatingRate(projectId, workTypes);
      await alert("저장되었습니다.");
    } catch (error) {
      console.error("가동률 저장 실패:", error);
      await alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }, [alert, projectId, workTypes]);

  if (loading) {
    return <p className="p-6 text-gray-400">불러오는 중...</p>;
  }

  // 행 정의
  const rows = [
    // 기후불능일 조건 (공종별)
    { key: "winter_threshold", label: "동절기", type: "threshold", operator: "이하", unit: "℃", valueField: "winter_threshold_value", enabledField: "winter_threshold_enabled", color: "bg-[#20202a]" },
    { key: "summer_threshold", label: "혹서기", type: "threshold", operator: "이상", unit: "℃", valueField: "summer_threshold_value", enabledField: "summer_threshold_enabled", color: "bg-[#20202a]" },
    { key: "rainfall_threshold", label: "강우량", type: "threshold", operator: "이상", unit: "mm", valueField: "rainfall_threshold_value", enabledField: "rainfall_threshold_enabled", color: "bg-[#20202a]" },
    { key: "snowfall_threshold", label: "강설량", type: "threshold", operator: "이상", unit: "cm", valueField: "snowfall_threshold_value", enabledField: "snowfall_threshold_enabled", color: "bg-[#20202a]" },
    { key: "dust_alert_level", label: "미세먼지", type: "dust", color: "bg-[#20202a]" },
    { key: "sector_type", label: "공공/민간", type: "sector", color: "bg-[#20202a]" },
    // 계산값 (4개 - NORMAL/GREEN)
    { key: "working_days", label: "작업일", type: "number", color: "bg-[#20202a]" },
    { key: "climate_days_excl_dup", label: "기후불능일(중복 제외)", type: "number", color: "bg-[#20202a]" },
    { key: "legal_holidays", label: "법정공휴일", type: "number", color: "bg-[#20202a]" },
  ];

  return (
    <div className="p-6 text-gray-200 space-y-6">
      <PageHeader title="가동률 입력" description="대공종별 가동률 및 기후 조건 입력" />

      {/* Header Controls */}
      <div className="flex items-center gap-4 bg-[#20202a] p-4 rounded-xl border border-white/10 shadow-2xl">
        {/* 지역 */}
        <div>
          <label className="text-sm text-gray-400 mr-2">지역</label>
          <select
            value={globalSettings.region}
            onChange={(e) => setGlobalSettings({ ...globalSettings, region: e.target.value })}
            className="bg-[#181825] border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            {regions.map((r) => (
              <option key={r.station_id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* 데이터 적용 */}
        <div>
          <label className="text-sm text-gray-400 mr-2">데이터 적용</label>
          <select
            value={globalSettings.dataYears}
            onChange={(e) => setGlobalSettings({ ...globalSettings, dataYears: e.target.value })}
            className="bg-[#1f1f2b] border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200"
          >
            <option value="10년">10년</option>
            <option value="20년">20년</option>
            <option value="30년">30년</option>
          </select>
        </div>

        {/* 내부마감 구분 */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">내부마감 구분</label>
          <div className="flex gap-1 bg-[#181825] rounded p-1 border border-gray-700">
            {['건식', '습식'].map(type => (
              <button
                key={type}
                onClick={() => setGlobalSettings({ ...globalSettings, interiorType: type })}
                className={`px-3 py-1 text-sm rounded transition ${globalSettings.interiorType === type
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
                  }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="ml-auto">
          <SaveButton onSave={handleSave} saving={saving} />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-[#20202a] border border-white/10 rounded-xl p-5 shadow-2xl">
        <div className="overflow-x-auto rounded-lg border border-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#2a2a35] text-gray-400 border-b border-white/5">
                <th className="sticky left-0 bg-[#2a2a35] border-r border-white/5 px-4 py-3 text-left min-w-[140px]">
                구분
              </th>
              {workTypes.map((workType, index) => (
                <th
                  key={index}
                  className="bg-[#2a2a35] border-r border-white/5 px-4 py-3 text-center min-w-[120px]"
                >
                  {workType.main_category}
                </th>
              ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
            {/* Climate Conditions Header */}
            <tr className="bg-[#2a2a35]">
              <td className="sticky left-0 bg-[#2a2a35] border-r border-white/5 px-4 py-2 font-bold text-gray-200" colSpan={workTypes.length + 1}>
                기후불능일
              </td>
            </tr>

            {/* Climate Rows */}
            {rows.filter(row => row.type === 'threshold' || row.type === 'dust' || row.type === 'sector').map((row) => (
              <tr key={row.key} className="hover:bg-white/[0.03]">
                <td className={`sticky left-0 ${row.color} border-r border-white/5 px-4 py-2 font-medium`}>
                  {row.label}
                </td>
                {workTypes.map((workType, index) => (
                  <td key={index} className={`${row.color} border-r border-white/5 px-2 py-1`}>
                    {row.type === "threshold" && (
                      <div className="flex items-center justify-center gap-2">
                        <select
                          value={workType[row.enabledField] ? "apply" : "none"}
                          onChange={(e) => handleCellChange(index, row.enabledField, e.target.value === "apply")}
                          className="bg-[#181825] border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                          <option value="apply">적용</option>
                          <option value="none">미적용</option>
                        </select>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={workType[row.valueField] ?? ""}
                            onChange={(e) => handleCellChange(index, row.valueField, e.target.value === "" ? null : Number(e.target.value))}
                            disabled={!workType[row.enabledField]}
                            className="w-20 bg-[#181825] border border-gray-700 text-center text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 px-2 py-1 rounded disabled:opacity-50"
                            placeholder="0"
                          />
                          <span className="text-xs text-gray-400">{row.unit}</span>
                          <span className="text-xs text-gray-400">{row.operator}</span>
                        </div>
                      </div>
                    )}
                    {row.type === "dust" && (
                      <select
                        value={workType.dust_alert_level || "NONE"}
                        onChange={(e) => handleCellChange(index, "dust_alert_level", e.target.value)}
                        className="w-full bg-[#181825] border border-gray-700 rounded px-2 py-1 text-center text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="NONE">미적용</option>
                        <option value="WARNING">주의</option>
                        <option value="ALERT">경보</option>
                      </select>
                    )}
                    {row.type === "sector" && (
                      <select
                        value={workType.sector_type || "PRIVATE"}
                        onChange={(e) => handleCellChange(index, "sector_type", e.target.value)}
                        className="w-full bg-[#181825] border border-gray-700 rounded px-2 py-1 text-center text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="PUBLIC">공공</option>
                        <option value="PRIVATE">민간</option>
                      </select>
                    )}
                  </td>
                ))}
              </tr>
            ))}

            {/* Calculation Header */}
            <tr className="bg-[#2a2a35]">
              <td className="sticky left-0 bg-[#2a2a35] border-r border-white/5 px-4 py-2 font-bold text-gray-200" colSpan={workTypes.length + 1}>
                산정일수
              </td>
            </tr>

            {/* Calculation Rows */}
            {rows.filter(row => row.type !== 'climate').map((row) => (
              <tr key={row.key} className="hover:bg-white/[0.03]">
                <td className={`sticky left-0 ${row.color} border-r border-white/5 px-4 py-2 font-medium ${row.key === 'operating_rate' ? 'text-green-200 font-bold' : ''
                  }`}>
                  {row.label}
                </td>
                {workTypes.map((workType, index) => (
                  <td key={index} className={`${row.color} border-r border-white/5 px-2 py-1`}>
                    <span className={`inline-flex w-full justify-center rounded-md px-2 py-1 text-sm ${row.key === 'operating_rate'
                      ? 'text-green-300 font-bold'
                      : 'text-gray-200'
                      }`}>
                      {workType[row.key] ?? "-"}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {workTypes.length === 0 && (
        <div className="text-center py-12 text-gray-400 bg-[#20202a] border border-white/10 rounded-xl shadow-2xl">
          <p>대공종이 없습니다.</p>
          <p className="text-sm mt-2">공사기간 산정 페이지에서 대공종을 먼저 생성해주세요.</p>
        </div>
      )}
    </div>
  );
}
