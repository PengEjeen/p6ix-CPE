import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import PageHeader from "../components/cpe/PageHeader";
import { detailQuotation } from "../api/cpe/quotation";
import { detailProject } from "../api/cpe/project";
import { fetchScheduleItems, initializeDefaultItems } from "../api/cpe_all/construction_schedule";

export default function Summary() {
  const { id: projectId } = useParams();
  const [project, setProject] = useState(null);
  const [quotation, setQuotation] = useState(null);
  const [scheduleItems, setScheduleItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const projectData = await detailProject(projectId);
        setProject(projectData);

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

    const calcTypeLabel = project.calc_type === "TOTAL" ? "전체 공기산정" : "공기산정";

    const overview = quotation?.construction_overview;

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
  }, [project, quotation, scheduleItems]);

  if (loading) return <p className="p-6 text-gray-400">불러오는 중...</p>;
  if (!project || !summaryRows) return <p className="p-6 text-gray-400">데이터 없음</p>;

  const durationRows = summaryRows.mainCategoryDuration || [];
  const totalDurationText =
    durationRows.find((row) => row.isTotal)?.days ||
    durationRows[durationRows.length - 1]?.cumulative ||
    "0일";
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
  const groupedFlatRows = groupedDuration.flatMap((group) =>
    group.items.map((row, idx) => ({
      ...row,
      showMainCategory: idx === 0,
      rowSpan: group.items.length,
      groupSubtotal: group.subtotal,
      groupShare: group.share,
    }))
  );
  const generatedDate = new Date().toLocaleDateString("ko-KR");

  return (
    <div className="p-6 text-gray-200">
      <PageHeader title="요약장표" description="프로젝트 개요 및 중공종 기간 요약" />

      <div className="mt-6 max-w-[1500px] mx-auto space-y-6">
        <section className="rounded-2xl overflow-hidden border border-[var(--navy-border-soft)] bg-[var(--navy-surface)] shadow-[0_20px_34px_rgba(0,0,0,0.22)]">
          <div className="px-6 py-4 border-b border-[var(--navy-border-soft)] bg-gradient-to-r from-[var(--navy-surface-3)] to-[var(--navy-surface-2)]">
            <h2 className="text-lg md:text-xl font-extrabold text-[var(--navy-text)] tracking-wide">공사기간 요약 보고서</h2>
            <p className="text-xs md:text-sm text-[var(--navy-text-muted)] mt-1">작성일: {generatedDate}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5">
            <div className="px-4 py-3 border-b md:border-b-0 md:border-r border-[var(--navy-border-soft)]">
              <p className="text-[11px] md:text-xs text-[var(--navy-text-muted)]">산정유형</p>
              <p className="mt-1 font-bold text-[var(--navy-text)]">{project.calc_type === "TOTAL" ? "전체 공기산정" : "공기산정"}</p>
            </div>
            <div className="px-4 py-3 border-b md:border-b-0 md:border-r border-[var(--navy-border-soft)]">
              <p className="text-[11px] md:text-xs text-[var(--navy-text-muted)]">대공종 수</p>
              <p className="mt-1 font-bold text-[var(--navy-text)]">{majorCategoryCount}개</p>
            </div>
            <div className="px-4 py-3 border-b md:border-b-0 md:border-r border-[var(--navy-border-soft)]">
              <p className="text-[11px] md:text-xs text-[var(--navy-text-muted)]">중공종 수</p>
              <p className="mt-1 font-bold text-[var(--navy-text)]">{middleCategoryCount}개</p>
            </div>
            <div className="px-4 py-3 border-b md:border-b-0 md:border-r border-[var(--navy-border-soft)]">
              <p className="text-[11px] md:text-xs text-[var(--navy-text-muted)]">총 공사기간</p>
              <p className="mt-1 font-bold text-[var(--navy-text)]">{totalDurationText}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[11px] md:text-xs text-[var(--navy-text-muted)]">프로젝트</p>
              <p className="mt-1 font-bold text-[var(--navy-text)] truncate">{project.title || "-"}</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.4fr] gap-6 items-start">
          <section className="rounded-2xl overflow-hidden border border-[var(--navy-border-soft)] bg-[var(--navy-surface)] shadow-[0_16px_30px_rgba(0,0,0,0.20)]">
            <div className="px-5 py-3 border-b border-[var(--navy-border-soft)] bg-[var(--navy-surface-2)]">
              <h3 className="text-sm md:text-base font-bold text-[var(--navy-text)] tracking-wide">1. 프로젝트 개요</h3>
            </div>
            <div className="p-4 md:p-5 overflow-x-auto">
              <table className="w-full text-sm md:text-base text-[var(--navy-text)]">
                <tbody>
                  {summaryRows.projectOverview.map((row, idx) => (
                    <tr
                      key={row.item}
                      className={`border-b border-[var(--navy-border-soft)]/60 last:border-b-0 ${idx % 2 ? "bg-[var(--navy-surface-2)]/20" : "bg-transparent"}`}
                    >
                      <th className="text-left px-3 py-3 w-36 font-semibold text-[var(--navy-text-muted)]">{row.item}</th>
                      <td className="px-3 py-3 font-semibold text-[var(--navy-text)]">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl overflow-hidden border border-[var(--navy-border-soft)] bg-[var(--navy-surface)] shadow-[0_16px_30px_rgba(0,0,0,0.20)]">
            <div className="px-5 py-3 border-b border-[var(--navy-border-soft)] bg-[var(--navy-surface-2)]">
              <h3 className="text-sm md:text-base font-bold text-[var(--navy-text)] tracking-wide">2. 중공종 기간 집계</h3>
            </div>
            <div className="p-4 md:p-5">
              {groupedFlatRows.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm text-[var(--navy-text)]">
                    <thead>
                      <tr className="bg-[var(--navy-surface-2)]">
                        <th className="text-left px-3 py-3 border-b border-[var(--navy-border-soft)] font-semibold">대공종</th>
                        <th className="text-left px-3 py-3 border-b border-[var(--navy-border-soft)] font-semibold">중공종</th>
                        <th className="text-right px-3 py-3 border-b border-[var(--navy-border-soft)] font-semibold">소요일</th>
                        <th className="text-right px-3 py-3 border-b border-[var(--navy-border-soft)] font-semibold">누적</th>
                        <th className="text-right px-3 py-3 border-b border-[var(--navy-border-soft)] font-semibold">대공종 소계/비중</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedFlatRows.map((row, idx) => (
                        <tr
                          key={`${row.mainCategory}-${row.middleCategory}-${idx}`}
                          className={`border-b border-[var(--navy-border-soft)]/60 ${idx % 2 ? "bg-[var(--navy-surface-2)]/18" : "bg-transparent"}`}
                        >
                          {row.showMainCategory && (
                            <td
                              rowSpan={row.rowSpan}
                              className="px-3 py-3 align-top border-r border-[var(--navy-border-soft)]/50"
                            >
                              <p className="font-bold text-[var(--navy-text)]">{row.mainCategory}</p>
                            </td>
                          )}
                          <td className="px-3 py-3 font-semibold">{row.middleCategory}</td>
                          <td className="px-3 py-3 text-right font-mono font-semibold">{row.days}</td>
                          <td className="px-3 py-3 text-right font-mono font-semibold">{row.cumulative}</td>
                          {row.showMainCategory && (
                            <td
                              rowSpan={row.rowSpan}
                              className="px-3 py-3 text-right align-top border-l border-[var(--navy-border-soft)]/50"
                            >
                              <p className="font-mono font-bold">{row.groupSubtotal}일</p>
                              <p className="text-xs text-[var(--navy-text-muted)] mt-0.5">{row.groupShare.toFixed(1)}%</p>
                            </td>
                          )}
                        </tr>
                      ))}
                      <tr className="bg-blue-500/10 border-t border-blue-400/35">
                        <td className="px-3 py-3 font-bold text-blue-200" colSpan={3}>총 공사기간</td>
                        <td className="px-3 py-3 text-right font-mono text-lg font-extrabold text-blue-300">
                          {totalDurationRow?.days || totalDurationText}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-blue-300">100.0%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--navy-border-soft)] bg-[var(--navy-surface-2)]/50 px-4 py-6 text-[var(--navy-text-muted)]">
                  기간 데이터 없음
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
