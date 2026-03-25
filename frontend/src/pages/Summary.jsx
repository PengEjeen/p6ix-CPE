import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import PageHeader from "../components/cpe/PageHeader";
import { detailQuotation } from "../api/cpe/quotation";
import { detailProject } from "../api/cpe/project";
import { detailConstructionOverview, updateConstructionOverview } from "../api/cpe/calc";
import { fetchScheduleItems, initializeDefaultItems } from "../api/cpe_all/construction_schedule";

export default function Summary() {
  const { id: projectId } = useParams();
  const [project, setProject] = useState(null);
  const [quotation, setQuotation] = useState(null);
  const [constructionOverview, setConstructionOverview] = useState(null);
  const [overviewForm, setOverviewForm] = useState({});
  const [overviewSaving, setOverviewSaving] = useState(false);
  const [scheduleItems, setScheduleItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const projectData = await detailProject(projectId);
        setProject(projectData);
        try {
          const overviewRes = await detailConstructionOverview(projectId);
          const overviewData = overviewRes.data || null;
          setConstructionOverview(overviewData);
          setOverviewForm({
            building_use: overviewData?.building_use ?? "",
            site_area: overviewData?.site_area ?? "",
            total_floor_area: overviewData?.total_floor_area ?? "",
            basement_floors: overviewData?.basement_floors ?? "",
            ground_floors: overviewData?.ground_floors ?? "",
          });
        } catch (overviewErr) {
          console.error("공사개요 불러오기 실패:", overviewErr);
          setConstructionOverview(null);
        }

        if (projectData?.calc_type === "TOTAL") {
          let fetched = await fetchScheduleItems(projectId);
          let items = fetched?.items || [];
          if (!items.length) {
            await initializeDefaultItems(projectId);
            fetched = await fetchScheduleItems(projectId);
            items = fetched?.items || [];
          }
          setScheduleItems(Array.isArray(items) ? items : []);
          return;
        }

        const quotationRes = await detailQuotation(projectId);
        setQuotation(quotationRes.data);
      } catch (err) {
        console.error("Summary 데이터 불러오기 실패:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  const toNumber = (value) => {
    if (typeof value === "number") return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const roundDays = (value) => Math.round(toNumber(value));

  const summaryRows = useMemo(() => {
    if (!project) return null;

    const calcTypeLabel = project.calc_type === "TOTAL" ? "전체 공기산정" : "공기 계산";
    const overview = constructionOverview || quotation?.construction_overview;

    const projectOverview = [
      { item: "공사명", value: project.title || "—" },
      { item: "산정유형", value: calcTypeLabel },
      { item: "착공일", value: project.start_date || "—" },
      {
        item: "공사규모",
        value: overview
          ? `지하 ${overview?.basement_floors ?? "—"}층 / 지상 ${overview?.ground_floors ?? "—"}층`
          : "—",
      },
      { item: "건물용도", value: overview?.building_use || "—" },
      { item: "대지면적", value: overview ? `${overview?.site_area ?? "—"}㎡` : "—" },
      { item: "연면적", value: overview ? `${overview?.total_floor_area ?? "—"}㎡` : "—" },
    ];

    if (project.calc_type === "TOTAL") {
      const byMiddleCategory = new Map();
      (scheduleItems || []).forEach((item, index) => {
        const mainCategory = String(item?.main_category || "기타");
        const middleCategory = String(item?.process || item?.sub_process || "미분류");
        const key = `${mainCategory}__${middleCategory}`;

        if (!byMiddleCategory.has(key)) {
          byMiddleCategory.set(key, {
            mainCategory,
            middleCategory,
            rawDays: 0,
            firstIndex: index,
          });
        }
        byMiddleCategory.get(key).rawDays += toNumber(item?.calendar_days);
      });

      let cumulative = 0;
      const rows = Array.from(byMiddleCategory.values())
        .sort((a, b) => a.firstIndex - b.firstIndex)
        .map((row) => {
          cumulative += row.rawDays;
          const dayValue = roundDays(row.rawDays);
          const cumulativeValue = roundDays(cumulative);
          return {
            mainCategory: row.mainCategory,
            middleCategory: row.middleCategory,
            dayValue,
            cumulativeValue,
            days: `${dayValue}일`,
            cumulative: `${cumulativeValue}일`,
            isTotal: false,
          };
        });

      const totalValue = roundDays(cumulative);
      rows.push({
        mainCategory: "-",
        middleCategory: "총 공사기간",
        dayValue: totalValue,
        cumulativeValue: totalValue,
        days: `${totalValue}일`,
        cumulative: `${totalValue}일`,
        isTotal: true,
      });

      return {
        projectOverview,
        mainCategoryDuration: rows,
      };
    }

    if (!quotation) {
      return {
        projectOverview,
        mainCategoryDuration: [],
      };
    }

    const apartmentRows = [];
    let cumulative = 0;

    const apartmentMiddleRows = [
      { mainCategory: "토공사", middleCategory: "흙막이가시설", rawDays: toNumber(quotation.earth_retention) },
      { mainCategory: "토공사", middleCategory: "지보공", rawDays: toNumber(quotation.support) },
      { mainCategory: "토공사", middleCategory: "터파기", rawDays: toNumber(quotation.excavation) },
      { mainCategory: "토공사", middleCategory: "지정공사", rawDays: toNumber(quotation.designated_work) },
      { mainCategory: "골조공사", middleCategory: "기초골조", rawDays: toNumber(quotation.base_framework) },
      { mainCategory: "골조공사", middleCategory: "지하골조", rawDays: toNumber(quotation.basement_framework) },
      { mainCategory: "골조공사", middleCategory: "지상골조", rawDays: toNumber(quotation.ground_framework) },
      { mainCategory: "기타기간", middleCategory: "준비기간", rawDays: toNumber(quotation.preparation_period) },
      { mainCategory: "기타기간", middleCategory: "마감공사", rawDays: toNumber(quotation.finishing_work) },
      { mainCategory: "기타기간", middleCategory: "추가기간", rawDays: toNumber(quotation.additional_period) },
      { mainCategory: "기타기간", middleCategory: "정리기간", rawDays: toNumber(quotation.cleanup_period) },
    ];

    apartmentMiddleRows.forEach((row) => {
      cumulative += row.rawDays;
      const dayValue = roundDays(row.rawDays);
      const cumulativeValue = roundDays(cumulative);
      apartmentRows.push({
        mainCategory: row.mainCategory,
        middleCategory: row.middleCategory,
        dayValue,
        cumulativeValue,
        days: `${dayValue}일`,
        cumulative: `${cumulativeValue}일`,
        isTotal: false,
      });
    });

    const totalValue = roundDays(cumulative);
    apartmentRows.push({
      mainCategory: "-",
      middleCategory: "총 공사기간",
      dayValue: totalValue,
      cumulativeValue: totalValue,
      days: `${totalValue}일`,
      cumulative: `${totalValue}일`,
      isTotal: true,
    });

    return {
      projectOverview,
      mainCategoryDuration: apartmentRows,
    };
  }, [project, quotation, scheduleItems, constructionOverview]);

  if (loading) return <p className="p-6 text-gray-400">불러오는 중...</p>;
  if (!project || !summaryRows) return <p className="p-6 text-gray-400">데이터 없음</p>;

  const durationRows = summaryRows.mainCategoryDuration || [];
  const middleCategoryCount = durationRows.filter((row) => !row.isTotal).length;
  const totalDurationRow = durationRows.find((row) => row.isTotal) || null;
  const totalDurationValue = totalDurationRow?.dayValue || 0;

  const groupMap = new Map();
  durationRows
    .filter((row) => !row.isTotal)
    .forEach((row) => {
      if (!groupMap.has(row.mainCategory)) {
        groupMap.set(row.mainCategory, {
          mainCategory: row.mainCategory,
          items: [],
          subtotal: 0,
        });
      }
      const group = groupMap.get(row.mainCategory);
      group.items.push(row);
      group.subtotal += row.dayValue || 0;
    });

  let groupedCumulative = 0;
  const groupedDuration = Array.from(groupMap.values()).map((group) => {
    groupedCumulative += group.subtotal;
    const share = totalDurationValue > 0 ? Math.round((group.subtotal / totalDurationValue) * 1000) / 10 : 0;
    return {
      ...group,
      cumulative: groupedCumulative,
      share,
    };
  });

  const majorCategoryCount = groupedDuration.length;
  const generatedDate = new Date().toLocaleDateString("ko-KR");
  const calcTypeText = project.calc_type === "TOTAL" ? "전체 공기산정" : "공기 계산";
  const formatDateDot = (value) => {
    if (!value) return "미입력";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "미입력";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}.${m}.${day}`;
  };
  const startDateText = formatDateDot(project.start_date);
  const computedEndDateText = (() => {
    if (!project.start_date || !totalDurationValue) return "미입력";
    const start = new Date(project.start_date);
    if (Number.isNaN(start.getTime())) return "미입력";
    const end = new Date(start);
    end.setDate(end.getDate() + Math.max(0, totalDurationValue - 1));
    return formatDateDot(end);
  })();
  const formatInt = (value) => new Intl.NumberFormat("ko-KR").format(Math.round(toNumber(value)));
  const totalDurationLabel = `${formatInt(totalDurationValue)}일`;

  const accentPalette = [
    { border: "border-sky-400", pillText: "text-sky-300", pillBg: "bg-sky-500/10", bar: "bg-sky-400" },
    { border: "border-indigo-400", pillText: "text-indigo-300", pillBg: "bg-indigo-500/10", bar: "bg-indigo-400" },
    { border: "border-emerald-400", pillText: "text-emerald-300", pillBg: "bg-emerald-500/10", bar: "bg-emerald-400" },
    { border: "border-amber-400", pillText: "text-amber-300", pillBg: "bg-amber-500/10", bar: "bg-amber-400" },
    { border: "border-rose-400", pillText: "text-rose-300", pillBg: "bg-rose-500/10", bar: "bg-rose-400" },
  ];

  const accentByMainCategory = new Map(
    groupedDuration.map((group, index) => [group.mainCategory, accentPalette[index % accentPalette.length]])
  );

  const distributionRows = groupedDuration.map((group) => ({
    ...group,
    accent: accentByMainCategory.get(group.mainCategory) || accentPalette[0],
  }));

  const groupedDetailRows = groupedDuration.flatMap((group) =>
    group.items.map((row, idx) => {
      const share = totalDurationValue > 0 ? (row.dayValue / totalDurationValue) * 100 : 0;
      return {
        ...row,
        share,
        accent: accentByMainCategory.get(row.mainCategory) || accentPalette[0],
        showMainCategory: idx === 0,
        rowSpan: group.items.length,
      };
    })
  );

  const isBlankValue = (value) => {
    if (value === null || value === undefined) return true;
    return String(value).trim() === "";
  };

  const scaleText = isBlankValue(constructionOverview?.basement_floors) && isBlankValue(constructionOverview?.ground_floors)
    ? "-"
    : `지하 ${constructionOverview?.basement_floors ?? "—"}층 / 지상 ${constructionOverview?.ground_floors ?? "—"}층`;

  const specificationCards = [
    { label: "공사명", value: project.title || "-" },
    { label: "건물용도", value: constructionOverview?.building_use || "-", field: "building_use", editType: "text" },
    { label: "대지면적", value: isBlankValue(constructionOverview?.site_area) ? "-" : `${constructionOverview.site_area}㎡`, field: "site_area", editType: "decimal", unit: "㎡" },
    { label: "연면적", value: isBlankValue(constructionOverview?.total_floor_area) ? "-" : `${constructionOverview.total_floor_area}㎡`, field: "total_floor_area", editType: "decimal", unit: "㎡" },
    { label: "규모 (지하/지상)", value: scaleText, editType: "floors" },
    { label: "산정유형", value: calcTypeText },
  ];

  const buildOverviewPayload = () => {
    const payload = {};
    const invalidLabels = [];

    const buildingUse = String(overviewForm.building_use ?? "").trim();
    if (buildingUse && buildingUse !== String(constructionOverview?.building_use ?? "")) {
      payload.building_use = buildingUse;
    }

    const siteAreaRaw = String(overviewForm.site_area ?? "").trim();
    if (siteAreaRaw) {
      const n = Number(siteAreaRaw);
      if (Number.isFinite(n) && n >= 0) {
        if (Number(constructionOverview?.site_area) !== n) payload.site_area = n;
      } else {
        invalidLabels.push("대지면적");
      }
    }

    const floorAreaRaw = String(overviewForm.total_floor_area ?? "").trim();
    if (floorAreaRaw) {
      const n = Number(floorAreaRaw);
      if (Number.isFinite(n) && n >= 0) {
        if (Number(constructionOverview?.total_floor_area) !== n) payload.total_floor_area = n;
      } else {
        invalidLabels.push("연면적");
      }
    }

    const basementRaw = String(overviewForm.basement_floors ?? "").trim();
    if (basementRaw) {
      const n = Number(basementRaw);
      if (Number.isInteger(n) && n >= 0) {
        if (Number(constructionOverview?.basement_floors) !== n) payload.basement_floors = n;
      } else {
        invalidLabels.push("지하층수");
      }
    }

    const groundRaw = String(overviewForm.ground_floors ?? "").trim();
    if (groundRaw) {
      const n = Number(groundRaw);
      if (Number.isInteger(n) && n >= 0) {
        if (Number(constructionOverview?.ground_floors) !== n) payload.ground_floors = n;
      } else {
        invalidLabels.push("지상층수");
      }
    }

    return { payload, invalidLabels };
  };

  const { payload: overviewPayload, invalidLabels: overviewInvalidLabels } = buildOverviewPayload();
  const canSaveOverview = overviewInvalidLabels.length === 0 && Object.keys(overviewPayload).length > 0 && !overviewSaving;

  const handleSaveOverview = async () => {
    if (overviewInvalidLabels.length > 0) {
      toast.error(`${overviewInvalidLabels.join(", ")} 값을 확인해주세요.`);
      return;
    }
    if (!Object.keys(overviewPayload).length) {
      toast.error("저장할 입력값이 없습니다.");
      return;
    }

    try {
      setOverviewSaving(true);
      const res = await updateConstructionOverview(projectId, overviewPayload);
      const nextOverview = res.data || {};
      setConstructionOverview(nextOverview);
      setOverviewForm({
        building_use: nextOverview?.building_use ?? "",
        site_area: nextOverview?.site_area ?? "",
        total_floor_area: nextOverview?.total_floor_area ?? "",
        basement_floors: nextOverview?.basement_floors ?? "",
        ground_floors: nextOverview?.ground_floors ?? "",
      });
      toast.success("프로젝트 개요를 저장했습니다.");
    } catch (err) {
      console.error("프로젝트 개요 저장 실패:", err);
      toast.error("저장에 실패했습니다.");
    } finally {
      setOverviewSaving(false);
    }
  };

  return (
    <div className="p-6 text-[var(--navy-text)]">
      <PageHeader title="요약장표" description="프로젝트 개요 및 중공종 기간 요약" />

      <div className="mx-auto mt-6 max-w-[1580px] space-y-8">
        <section className="relative min-h-[240px] overflow-hidden rounded-xl border border-[var(--navy-border-soft)]/20 bg-[var(--navy-surface)] p-8">
          <div className="absolute inset-0 z-0">
            <img
              className="h-full w-full object-cover opacity-30 mix-blend-luminosity"
              alt="건설 현장 배경 이미지"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD_PMSCKMe0-K6L-OwF54uXoKDKHH8s_cyV6ZdjJipGGdk-8Rc0yRLC31lujhuXp38sJPthH7TejPAREiCpWRFpGe-7UlnigAcHLW5OXUBjA8XBBA7HauzolGpvrY2OK5h-YS8koLJSapXYi-7NJx-akCTKreuPA40564uYZQ3WblfkJ9f2yLg0wCGaC2DE1rkOA1584K8XX02qCfBKrqRRiaspTnJ4R3nwiZD4E-ydhrVaU9Tie9JO4Hoc8Fd6e1ABKAAyyGaeTA4"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--navy-surface)] via-[var(--navy-surface)]/65 to-transparent" />
          </div>
          <div className="relative z-10 flex w-full flex-col items-end justify-between gap-6 md:flex-row md:items-end">
            <div className="space-y-2">
              <span className="inline-block rounded bg-sky-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-300">
                {calcTypeText}
              </span>
              <h2 className="text-4xl font-extrabold tracking-tighter text-white md:text-5xl">
                {project.title || "프로젝트명 미정"}
              </h2>
              <div className="mt-4 flex flex-wrap gap-6">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--navy-text-muted)]">시작일</span>
                  <span className="text-lg font-bold text-[var(--navy-text)]">{startDateText}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--navy-text-muted)]">종료일</span>
                  <span className="text-lg font-bold text-[var(--navy-text)]">{computedEndDateText}</span>
                </div>
                <div className="flex flex-col border-l border-[var(--navy-border-soft)]/50 pl-6">
                  <span className="text-[10px] uppercase tracking-wider text-sky-300">총 공기</span>
                  <span className="text-3xl font-black leading-none text-sky-300">{totalDurationLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="glass-card flex h-32 flex-col justify-between rounded-lg border-l-2 border-sky-400 p-6">
            <span className="text-xs uppercase tracking-[0.16em] text-[var(--navy-text-muted)]">총 공사기간</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-[var(--navy-text)]">{formatInt(totalDurationValue)}</span>
              <span className="text-sm font-bold text-[var(--navy-text-muted)]">일</span>
            </div>
          </div>
          <div className="glass-card flex h-32 flex-col justify-between rounded-lg border-l-2 border-sky-400 p-6">
            <span className="text-xs uppercase tracking-[0.16em] text-[var(--navy-text-muted)]">대공종 수</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-[var(--navy-text)]">{majorCategoryCount}</span>
              <span className="text-sm font-bold text-[var(--navy-text-muted)]">개 부문</span>
            </div>
          </div>
          <div className="glass-card flex h-32 flex-col justify-between rounded-lg border-l-2 border-sky-400 p-6">
            <span className="text-xs uppercase tracking-[0.16em] text-[var(--navy-text-muted)]">중공종 수</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-[var(--navy-text)]">{middleCategoryCount}</span>
              <span className="text-sm font-bold text-[var(--navy-text-muted)]">개 항목</span>
            </div>
          </div>
          <div className="glass-card flex h-32 flex-col justify-between rounded-lg border-l-2 border-emerald-400 p-6">
            <span className="text-xs uppercase tracking-[0.16em] text-[var(--navy-text-muted)]">산정유형</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-[var(--navy-text)]">{calcTypeText}</span>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <section className="space-y-6 lg:col-span-5">
            <div className="flex items-center justify-between">
              <h3 className="border-l-4 border-emerald-400 pl-3 text-xl font-bold text-white">프로젝트 개요</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {specificationCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-lg border border-[var(--navy-border-soft)]/20 bg-[var(--navy-surface)] px-4 py-3"
                >
                  <span className="text-[10px] font-medium uppercase text-[var(--navy-text-muted)]">{card.label}</span>
                  {card.editType === "text" ? (
                    <input
                      type="text"
                      value={overviewForm.building_use ?? ""}
                      onChange={(e) => setOverviewForm((prev) => ({ ...prev, building_use: e.target.value }))}
                      placeholder="건물용도 입력"
                      className="mt-1 h-8 w-full rounded border border-[var(--navy-border-soft)]/50 bg-[var(--navy-bg)] px-2 text-sm font-semibold text-[var(--navy-text)] placeholder:text-[var(--navy-text-muted)]/70 focus:outline-none focus:ring-1 focus:ring-sky-400/50"
                    />
                  ) : card.editType === "decimal" ? (
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={overviewForm[card.field] ?? ""}
                        onChange={(e) => setOverviewForm((prev) => ({ ...prev, [card.field]: e.target.value }))}
                        placeholder="값 입력"
                        className="h-8 w-full rounded border border-[var(--navy-border-soft)]/50 bg-[var(--navy-bg)] px-2 text-sm font-semibold text-[var(--navy-text)] placeholder:text-[var(--navy-text-muted)]/70 focus:outline-none focus:ring-1 focus:ring-sky-400/50"
                      />
                      <span className="text-xs text-[var(--navy-text-muted)]">{card.unit}</span>
                    </div>
                  ) : card.editType === "floors" ? (
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={overviewForm.basement_floors ?? ""}
                        onChange={(e) => setOverviewForm((prev) => ({ ...prev, basement_floors: e.target.value }))}
                        placeholder="지하층"
                        className="h-8 w-full rounded border border-[var(--navy-border-soft)]/50 bg-[var(--navy-bg)] px-2 text-sm font-semibold text-[var(--navy-text)] placeholder:text-[var(--navy-text-muted)]/70 focus:outline-none focus:ring-1 focus:ring-sky-400/50"
                      />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={overviewForm.ground_floors ?? ""}
                        onChange={(e) => setOverviewForm((prev) => ({ ...prev, ground_floors: e.target.value }))}
                        placeholder="지상층"
                        className="h-8 w-full rounded border border-[var(--navy-border-soft)]/50 bg-[var(--navy-bg)] px-2 text-sm font-semibold text-[var(--navy-text)] placeholder:text-[var(--navy-text-muted)]/70 focus:outline-none focus:ring-1 focus:ring-sky-400/50"
                      />
                    </div>
                  ) : (
                    <p className="mt-1 truncate text-sm font-semibold text-[var(--navy-text)]">{card.value || "-"}</p>
                  )}
                </div>
              ))}
              <div className="col-span-2 flex items-center justify-between rounded-lg border border-[var(--navy-border-soft)]/25 bg-[var(--navy-surface-2)]/40 px-3 py-2">
                <p className="text-xs text-[var(--navy-text-muted)]">수정 후 개요 저장을 누르면 DB에 반영됩니다.</p>
                <button
                  type="button"
                  onClick={handleSaveOverview}
                  disabled={!canSaveOverview}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {overviewSaving ? "저장 중..." : "개요 저장"}
                </button>
              </div>
            </div>

            <div className="space-y-5 rounded-xl border border-[var(--navy-border-soft)]/20 bg-[var(--navy-surface)] px-6 py-6">
              <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.15em] text-[var(--navy-text-muted)]">
                공종별 기간 점유율
              </h4>
              <div className="space-y-4">
                {distributionRows.length ? distributionRows.map((group) => (
                  <div key={group.mainCategory} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-[var(--navy-text)]">{group.mainCategory}</span>
                      <span className="text-[var(--navy-text-muted)]">
                        {formatInt(group.subtotal)}일 ({group.share.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--navy-surface-3)]/70">
                      <div
                        className={`h-full rounded-full ${group.accent.bar}`}
                        style={{ width: `${Math.max(3, Math.min(100, group.share))}%` }}
                      />
                    </div>
                  </div>
                )) : (
                  <div className="rounded-lg border border-[var(--navy-border-soft)]/30 bg-[var(--navy-surface-2)] px-4 py-6 text-sm text-[var(--navy-text-muted)]">
                    기간 데이터 없음
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-6 lg:col-span-7">
            <div className="flex items-center justify-between">
              <h3 className="border-l-4 border-sky-400 pl-3 text-xl font-bold text-white">공정 세부 구조</h3>
              <div className="flex gap-2">
                <span className="rounded bg-[var(--navy-surface-3)] px-2 py-1 text-[11px] font-bold tracking-wider text-[var(--navy-text-muted)]">
                  총 {middleCategoryCount} 항목
                </span>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-[var(--navy-border-soft)]/30 bg-[var(--navy-bg)]">
              {groupedDetailRows.length ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-[var(--navy-surface-3)]/70">
                          <th className="p-4 text-sm font-bold tracking-[0.08em] text-[var(--navy-text-muted)]">대공종</th>
                          <th className="p-4 text-sm font-bold tracking-[0.08em] text-[var(--navy-text-muted)]">중공종</th>
                          <th className="p-4 text-right text-sm font-bold tracking-[0.08em] text-[var(--navy-text-muted)]">소요일</th>
                          <th className="p-4 text-right text-sm font-bold tracking-[0.08em] text-[var(--navy-text-muted)]">누적일수</th>
                          <th className="p-4 text-center text-sm font-bold tracking-[0.08em] text-[var(--navy-text-muted)]">비율</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--navy-border-soft)]/20">
                        {groupedDetailRows.map((row, idx) => (
                          <tr
                            key={`${row.mainCategory}-${row.middleCategory}-${idx}`}
                            className={`${idx % 2 ? "bg-[var(--navy-surface)]/30" : "bg-transparent"} hover:bg-[var(--navy-surface)]/70 transition-colors`}
                          >
                            {row.showMainCategory && (
                              <td
                                rowSpan={row.rowSpan}
                                className={`p-4 align-top text-sm font-extrabold text-[var(--navy-text)] border-l-2 ${row.accent.border}`}
                              >
                                {row.mainCategory}
                              </td>
                            )}
                            <td className="p-4 text-sm font-medium text-[var(--navy-text-muted)]">{row.middleCategory}</td>
                            <td className="p-4 text-right text-sm tabular-nums font-semibold text-[var(--navy-text)]">{formatInt(row.dayValue)}</td>
                            <td className="p-4 text-right text-sm tabular-nums font-semibold text-[var(--navy-text)]">{formatInt(row.cumulativeValue)}</td>
                            <td className="p-4 text-center">
                              <span className={`rounded px-2.5 py-1 text-xs font-bold ${row.accent.pillBg} ${row.accent.pillText}`}>
                                {row.share.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between bg-[var(--navy-surface-3)]/70 p-4">
                    <span className="text-xs font-bold tracking-[0.12em] text-[var(--navy-text-muted)]">총합 요약</span>
                    <span className="text-base font-black text-white">{totalDurationLabel} (100%)</span>
                  </div>
                </>
              ) : (
                <div className="px-4 py-10 text-center text-sm text-[var(--navy-text-muted)]">
                  기간 데이터가 없어 요약표를 생성할 수 없습니다.
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="border-t border-[var(--navy-border-soft)]/20 pt-6 text-center">
          <p className="text-[10px] tracking-[0.16em] text-[var(--navy-text-muted)]">
            © {new Date().getFullYear()} 피식스 공기검토 플랫폼. 요약장표 생성일 {generatedDate}
          </p>
        </footer>
      </div>
    </div>
  );
}
