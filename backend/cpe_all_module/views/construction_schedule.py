from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from datetime import date as date_cls
from calendar import monthrange
import re
import io
import xlsxwriter
import traceback
from ..models.construction_schedule_models import ConstructionScheduleItem
from ..serializers.construction_schedule_serializers import ConstructionScheduleItemSerializer
from cpe_module.models.operating_rate_models import WorkScheduleWeight
from cpe_module.models.calc_models import WorkCondition
from cpe_module.models.project_models import Project
from operatio.models import PublicHoliday
from cpe_all_module.utils.excel.construction_schedule import (
    build_rate_summary,
    extract_schedule_payload,
    group_items_by_category,
    inject_gantt_drawing,
    write_gantt_sheet,
    write_table_sheet,
)
from cpe_all_module.utils.word.construction_schedule import build_schedule_report_docx


def _count_sundays_in_month(year, month):
    days_in_month = monthrange(year, month)[1]
    count = 0
    for day in range(1, days_in_month + 1):
        if date_cls(year, month, day).weekday() == 6:
            count += 1
    return count


def _project_holiday_dates(source_dates, target_year):
    projected = set()
    for d in source_dates:
        try:
            projected.add(d.replace(year=target_year))
        except ValueError:
            # Leap-day fallback for non-leap year.
            if d.month == 2 and d.day == 29:
                projected.add(date_cls(target_year, 2, 28))
    return projected


def _build_public_legal_holiday_rows(project=None, max_years=7):
    all_years = list(
        PublicHoliday.objects.filter(is_holiday="Y")
        .values_list("date__year", flat=True)
        .distinct()
    )
    if not all_years:
        return []

    available_years = sorted(set(all_years))
    if project and project.start_date:
        start_year = project.start_date.year
    elif 2024 in available_years:
        start_year = 2024
    else:
        start_year = available_years[0]

    fallback_year = 2025 if 2025 in available_years else available_years[0]
    result = []
    for year in range(start_year, start_year + max_years):
        date_qs = PublicHoliday.objects.filter(
            date__year=year,
            is_holiday="Y",
        ).values_list("date", flat=True)
        holiday_dates = set(date_qs)
        if holiday_dates:
            year_dates = holiday_dates
        else:
            fallback_dates = set(
                PublicHoliday.objects.filter(
                    date__year=fallback_year,
                    is_holiday="Y",
                ).values_list("date", flat=True)
            )
            year_dates = _project_holiday_dates(fallback_dates, year)

        monthly_counts = []
        for month in range(1, 13):
            sundays = _count_sundays_in_month(year, month)
            holiday_extra = sum(
                1
                for d in year_dates
                if d.month == month and d.weekday() != 6
            )
            monthly_counts.append(sundays + holiday_extra)

        result.append({
            "year": year,
            "monthly": monthly_counts,
            "total": sum(monthly_counts),
        })

    return result


def _to_float(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_number(text):
    if not text:
        return None
    m = re.search(r"-?\d+(?:\.\d+)?", str(text))
    if not m:
        return None
    try:
        return float(m.group(0))
    except (TypeError, ValueError):
        return None


def _build_climate_criteria_rows(weights, ordered_categories, region=""):
    category_order = [c for c in ordered_categories if c]
    weight_map = {w.main_category: w for w in (weights or [])}

    def _get_weight(category):
        return weight_map.get(category)

    def _winter_value(weight):
        val = _to_float(weight.winter_threshold_value) if weight else None
        if val is None and weight:
            val = _extract_number(weight.winter_threshold)
        return val

    def _summer_value(weight):
        val = _to_float(weight.summer_threshold_value) if weight else None
        if val is None and weight:
            val = _extract_number(weight.summer_threshold)
        return val

    def _rain_value(weight):
        val = _to_float(weight.rainfall_threshold_value) if weight else None
        if val is None and weight:
            val = _extract_number(weight.rainfall_threshold)
        return val

    def _snow_value(weight):
        val = _to_float(weight.snowfall_threshold_value) if weight else None
        if val is None and weight:
            val = _extract_number(weight.snowfall_threshold)
        return val

    def _wind_value(weight):
        return _extract_number(weight.wind_threshold if weight else None)

    def _row_apply_text(by_category):
        if not by_category:
            return "-"
        return "○" if any(applied for _, applied in by_category) else "-"

    defs = [
        ("동절기", "① 일 평균기온 0℃ 이하", lambda w: bool(w and w.winter_threshold_enabled and w.winter_criteria == "AVG" and (_winter_value(w) is not None and _winter_value(w) <= 0))),
        ("동절기", "② 일 평균기온 -5℃ 이하", lambda w: bool(w and w.winter_threshold_enabled and w.winter_criteria == "AVG" and (_winter_value(w) is not None and _winter_value(w) <= -5))),
        ("동절기", "③ 일 평균기온 -12℃ 이하", lambda w: bool(w and w.winter_threshold_enabled and w.winter_criteria == "AVG" and (_winter_value(w) is not None and _winter_value(w) <= -12))),
        ("동절기", "④ 일 최고기온 0℃ 이하", lambda w: bool(w and w.winter_threshold_enabled and w.winter_criteria == "MAX" and (_winter_value(w) is not None and _winter_value(w) <= 0))),
        ("동절기", "⑤ 일 최저기온 -10℃ 이하", lambda w: bool(w and w.winter_threshold_enabled and w.winter_criteria == "MIN" and (_winter_value(w) is not None and _winter_value(w) <= -10))),
        ("동절기", "⑥ 일 최저기온 -12℃ 이하", lambda w: bool(w and w.winter_threshold_enabled and w.winter_criteria == "MIN" and (_winter_value(w) is not None and _winter_value(w) <= -12))),
        ("혹서기", "⑦ 일 최고기온 33℃ 이상", lambda w: bool(w and w.summer_threshold_enabled and (_summer_value(w) is not None and _summer_value(w) >= 33))),
        ("혹서기", "⑧ 일 최고기온 35℃ 이상", lambda w: bool(w and w.summer_threshold_enabled and (_summer_value(w) is not None and _summer_value(w) >= 35))),
        ("강수량", "⑨ 일 강수량 5mm 이상", lambda w: bool(w and w.rainfall_threshold_enabled and (_rain_value(w) is not None and _rain_value(w) >= 5))),
        ("강수량", "⑩ 일 강수량 10mm 이상", lambda w: bool(w and w.rainfall_threshold_enabled and (_rain_value(w) is not None and _rain_value(w) >= 10))),
        ("강수량", "⑪ 일 강수량 20mm 이상", lambda w: bool(w and w.rainfall_threshold_enabled and (_rain_value(w) is not None and _rain_value(w) >= 20))),
        ("적설량", "⑫ 신적설 5cm 이상", lambda w: bool(w and w.snowfall_threshold_enabled and (_snow_value(w) is not None and _snow_value(w) >= 5))),
        ("적설량", "⑬ 신적설 20cm 이상", lambda w: bool(w and w.snowfall_threshold_enabled and (_snow_value(w) is not None and _snow_value(w) >= 20))),
        ("풍속", "⑭ 일 최대풍속 10m/s 이상", lambda w: bool(w and (_wind_value(w) is not None and _wind_value(w) >= 10))),
        ("풍속", "⑮ 일 최대풍속 15m/s 이상", lambda w: bool(w and (_wind_value(w) is not None and _wind_value(w) >= 15))),
        ("미세먼지", "⑯ 경보 발령일", lambda w: bool(w and w.dust_alert_level == "ALERT")),
    ]

    rows = []
    region_label = (region or "가동률 지역").strip()
    data_source_text = f"{region_label}\n기상관측\n자료"
    for group, detail, fn in defs:
        by_category = []
        for category in category_order:
            weight = _get_weight(category)
            by_category.append((category, fn(weight)))
        rows.append({
            "data_source": data_source_text,
            "group": group,
            "detail": detail,
            "apply_text": _row_apply_text(by_category),
        })
    return rows

class ConstructionScheduleItemViewSet(viewsets.ModelViewSet):
    queryset = ConstructionScheduleItem.objects.all()
    serializer_class = ConstructionScheduleItemSerializer
    pagination_class = None

    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        project_id = self.request.query_params.get('project_id')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset
        
    def update(self, request, *args, **kwargs):
        # Log update request for debugging
        print("Update Request Data keys:", request.data.keys())
        if 'data' in request.data:
            print("Items count:", len(request.data['data']))
        return super().update(request, *args, **kwargs)

    @action(detail=False, methods=['post'])
    def initialize_default(self, request):
        project_id = request.data.get('project_id')
        if not project_id:
            return Response({"error": "project_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Cleanup legacy multiple rows if they exist
        existing = ConstructionScheduleItem.objects.filter(project_id=project_id)
        if existing.count() > 1:
            existing.delete()
        
        # Get or Create Single Container
        container, created = ConstructionScheduleItem.objects.get_or_create(project_id=project_id)
        
        # If it exists but has no data, or we just created it -> Populate Defaults
        if not container.data:
            from cpe_all_module.initial_data import get_default_schedule_data
            container.data = get_default_schedule_data()
            container.save()
            return Response({"message": "Initialized default items"}, status=status.HTTP_201_CREATED)
            
        return Response({"message": "Already initialized"}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='export-excel')
    def export_excel(self, request):
        return self._export_excel_impl(request)

    @action(detail=False, methods=['get'], url_path='export-report')
    def export_report(self, request):
        try:
            project_id = request.query_params.get('project_id')
            if not project_id:
                return Response({"error": "project_id is required"}, status=status.HTTP_400_BAD_REQUEST)

            container = ConstructionScheduleItem.objects.filter(project_id=project_id).first()
            if not container or not container.data:
                return Response({"error": "schedule data not found"}, status=status.HTTP_404_NOT_FOUND)

            raw_data = container.data
            items, _sub_tasks, _links = extract_schedule_payload(raw_data)
            if not isinstance(items, list):
                return Response({"error": "invalid schedule data"}, status=status.HTTP_400_BAD_REQUEST)

            project = Project.objects.filter(id=project_id).first()
            project_name = project.title if project else "프로젝트"

            rate_qs = WorkScheduleWeight.objects.filter(project_id=project_id).values("main_category", "operating_rate")
            rate_map = {row["main_category"]: row["operating_rate"] for row in rate_qs}

            grouped, ordered_categories = group_items_by_category(items)

            work_condition = WorkCondition.objects.filter(project_id=project_id).first()
            region = work_condition.region if work_condition and work_condition.region else ""

            rate_summary = build_rate_summary(project_id, ordered_categories, rate_map, region)
            public_holiday_rows = _build_public_legal_holiday_rows(project=project, max_years=7)
            climate_criteria_rows = _build_climate_criteria_rows(
                weights=WorkScheduleWeight.objects.filter(project_id=project_id).order_by("main_category"),
                ordered_categories=ordered_categories,
                region=region,
            )

            report_bytes = build_schedule_report_docx(
                project_name=project_name,
                rate_summary=rate_summary,
                ordered_categories=ordered_categories,
                grouped_items=grouped,
                rate_map=rate_map,
                region=region,
                public_holiday_rows=public_holiday_rows,
                climate_criteria_rows=climate_criteria_rows,
            )

            safe_name = "".join(ch if ch not in '\\/:*?\"<>|' else "_" for ch in project_name)
            filename = f"공사기간_산정_보고서_{safe_name}.docx"
            response = HttpResponse(
                report_bytes,
                content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )
            response["Content-Disposition"] = f'attachment; filename=\"{filename}\"'
            return response
        except Exception as exc:
            traceback.print_exc()
            return Response(
                {"error": f"export-report failed: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _export_excel_impl(self, request):
        try:
            project_id = request.query_params.get('project_id')
            if not project_id:
                return Response({"error": "project_id is required"}, status=status.HTTP_400_BAD_REQUEST)

            container = ConstructionScheduleItem.objects.filter(project_id=project_id).first()
            if not container or not container.data:
                return Response({"error": "schedule data not found"}, status=status.HTTP_404_NOT_FOUND)

            print(f"[export-excel] project_id={project_id}")
            print(f"[export-excel] xlsxwriter_version={getattr(xlsxwriter, '__version__', 'unknown')}")
            print(f"[export-excel] xlsxwriter_path={getattr(xlsxwriter, '__file__', 'unknown')}")

            raw_data = container.data
            items, sub_tasks, links = extract_schedule_payload(raw_data)

            if not isinstance(items, list):
                return Response({"error": "invalid schedule data"}, status=status.HTTP_400_BAD_REQUEST)

            project = Project.objects.filter(id=project_id).first()
            project_name = project.title if project else "프로젝트"

            rate_qs = WorkScheduleWeight.objects.filter(project_id=project_id).values("main_category", "operating_rate")
            rate_map = {row["main_category"]: row["operating_rate"] for row in rate_qs}

            grouped, ordered_categories = group_items_by_category(items)

            work_condition = WorkCondition.objects.filter(project_id=project_id).first()
            region = work_condition.region if work_condition and work_condition.region else ""

            rate_summary = build_rate_summary(project_id, ordered_categories, rate_map, region)

            output = io.BytesIO()
            wb = xlsxwriter.Workbook(output, {'in_memory': True})

            # ---- Sheet 1: Table ----
            write_table_sheet(wb, items, ordered_categories, grouped, rate_summary, rate_map, project_name)

            # ---- Sheet 2: Gantt (shape-based, Excel-editable) ----
            start_date = project.start_date if project and project.start_date else date_cls.today()
            gantt_meta = write_gantt_sheet(wb, items, sub_tasks, links, project_name, start_date)
            print(f"[export-excel] gantt_shapes_count={len(gantt_meta['shapes'])}")

            wb.close()
            output.seek(0)

            output_bytes = inject_gantt_drawing(output.read(), **gantt_meta)
            output = io.BytesIO(output_bytes)

            safe_name = "".join(ch if ch not in '\\/:*?\"<>|' else "_" for ch in project_name)
            filename = f"공사기간_산정_기준_{safe_name}.xlsx"
            response = HttpResponse(
                output.read(),
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
            response["Content-Disposition"] = f'attachment; filename=\"{filename}\"'
            return response
        except Exception as exc:
            traceback.print_exc()
            return Response(
                {"error": f"export-excel failed: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
