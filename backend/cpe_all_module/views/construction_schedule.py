import logging
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from datetime import date as date_cls, timedelta
import io
import xlsxwriter
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
from cpe_all_module.utils.excel.construction_schedule_gantt import build_items_with_timing
from cpe_all_module.utils.excel.construction_schedule_preview import (
    build_gantt_preview_png,
)
from cpe_all_module.utils.word.construction_schedule import (
    build_schedule_report_aux_data,
    build_schedule_report_docx,
)

logger = logging.getLogger(__name__)


class ConstructionScheduleItemViewSet(viewsets.ModelViewSet):
    queryset = ConstructionScheduleItem.objects.all()
    serializer_class = ConstructionScheduleItemSerializer
    pagination_class = None

    permission_classes = [permissions.IsAuthenticated]

    def _get_owned_project_or_404(self, project_id):
        return get_object_or_404(
            Project,
            id=project_id,
            user=self.request.user,
            is_delete=False,
        )

    def get_queryset(self):
        queryset = super().get_queryset().filter(
            project__user=self.request.user,
            project__is_delete=False,
        )
        project_id = self.request.query_params.get('project_id')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset

    def perform_create(self, serializer):
        project = serializer.validated_data.get("project")
        if (
            project is None
            or project.user_id != self.request.user.id
            or project.is_delete
        ):
            raise PermissionDenied("project access denied")
        serializer.save()

    def perform_update(self, serializer):
        project = serializer.validated_data.get("project", serializer.instance.project)
        if (
            project is None
            or project.user_id != self.request.user.id
            or project.is_delete
        ):
            raise PermissionDenied("project access denied")
        serializer.save()
        
    def update(self, request, *args, **kwargs):
        logger.debug("Schedule update request keys: %s", list(request.data.keys()))
        if 'data' in request.data:
            logger.debug("Schedule update items count: %s", len(request.data['data']))
        return super().update(request, *args, **kwargs)

    @action(detail=False, methods=['post'])
    def initialize_default(self, request):
        project_id = request.data.get('project_id')
        if not project_id:
            return Response({"error": "project_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        project = self._get_owned_project_or_404(project_id)

        # Cleanup legacy multiple rows if they exist
        existing = ConstructionScheduleItem.objects.filter(project=project)
        if existing.count() > 1:
            existing.delete()
        
        # Get or Create Single Container
        container, created = ConstructionScheduleItem.objects.get_or_create(project=project)
        
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

            project = self._get_owned_project_or_404(project_id)
            container = ConstructionScheduleItem.objects.filter(project=project).first()
            if not container or not container.data:
                return Response({"error": "schedule data not found"}, status=status.HTTP_404_NOT_FOUND)

            raw_data = container.data
            items, _sub_tasks, _links = extract_schedule_payload(raw_data)
            if not isinstance(items, list):
                return Response({"error": "invalid schedule data"}, status=status.HTTP_400_BAD_REQUEST)

            project_name = project.title
            start_date = project.start_date if project.start_date else date_cls.today()

            gantt_image_bytes = build_gantt_preview_png(
                items=items,
                sub_tasks=_sub_tasks,
                links=_links,
                project_name=project_name,
                start_date=start_date,
            )

            rate_qs = WorkScheduleWeight.objects.filter(project_id=project_id).values("main_category", "operating_rate")
            rate_map = {row["main_category"]: row["operating_rate"] for row in rate_qs}

            grouped, ordered_categories = group_items_by_category(items)

            work_condition = WorkCondition.objects.filter(project_id=project_id).first()
            region = work_condition.region if work_condition and work_condition.region else ""
            work_condition_years = work_condition.data_years if work_condition and work_condition.data_years else 10

            rate_summary = build_rate_summary(project_id, ordered_categories, rate_map, region)
            report_aux_data = build_schedule_report_aux_data(
                project_id=project_id,
                ordered_categories=ordered_categories,
                region=region,
                project_start_date=project.start_date,
                work_condition_years=work_condition_years,
            )

            report_bytes = build_schedule_report_docx(
                project_name=project_name,
                rate_summary=rate_summary,
                ordered_categories=ordered_categories,
                grouped_items=grouped,
                rate_map=rate_map,
                region=region,
                gantt_image_bytes=gantt_image_bytes,
                **report_aux_data,
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
            logger.exception("export-report failed for project_id=%s", request.query_params.get('project_id'))
            return Response(
                {"error": "export-report failed"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _export_excel_impl(self, request):
        try:
            project_id = request.query_params.get('project_id')
            if not project_id:
                return Response({"error": "project_id is required"}, status=status.HTTP_400_BAD_REQUEST)

            project = self._get_owned_project_or_404(project_id)
            container = ConstructionScheduleItem.objects.filter(project=project).first()
            if not container or not container.data:
                return Response({"error": "schedule data not found"}, status=status.HTTP_404_NOT_FOUND)

            logger.debug("[export-excel] project_id=%s", project_id)
            logger.debug("[export-excel] xlsxwriter_version=%s", getattr(xlsxwriter, "__version__", "unknown"))
            logger.debug("[export-excel] xlsxwriter_path=%s", getattr(xlsxwriter, "__file__", "unknown"))

            raw_data = container.data
            items, sub_tasks, links = extract_schedule_payload(raw_data)
            cost_inputs = raw_data.get("cost_inputs", {}) if isinstance(raw_data, dict) else {}
            milestones = raw_data.get("milestones", []) if isinstance(raw_data, dict) else []

            if not isinstance(items, list):
                return Response({"error": "invalid schedule data"}, status=status.HTTP_400_BAD_REQUEST)

            project_name = project.title

            weight_rows = list(
                WorkScheduleWeight.objects.filter(project_id=project_id)
                .values("main_category", "operating_rate", "sector_type", "work_week_days")
            )
            rate_map = {row["main_category"]: row["operating_rate"] for row in weight_rows}

            public_count = sum(1 for r in weight_rows if (r.get("sector_type") or "PUBLIC").upper() == "PUBLIC")
            private_count = len(weight_rows) - public_count
            sector_type = "PRIVATE" if private_count > public_count else "PUBLIC"

            grouped, ordered_categories = group_items_by_category(items)

            work_condition = WorkCondition.objects.filter(project_id=project_id).first()
            region = work_condition.region if work_condition and work_condition.region else ""

            work_week_days = 6
            if work_condition and work_condition.earthwork_type:
                try:
                    work_week_days = int(work_condition.earthwork_type)
                except (TypeError, ValueError):
                    work_week_days = 6

            rate_summary = build_rate_summary(project_id, ordered_categories, rate_map, region)

            start_date = project.start_date if project.start_date else date_cls.today()

            max_item_end = 0.0
            for it in items:
                try:
                    max_item_end = max(max_item_end, float(it.get("start_day") or 0) + float(it.get("calendar_days") or 0))
                except (TypeError, ValueError):
                    continue
            for ms in milestones if isinstance(milestones, list) else []:
                try:
                    max_item_end = max(max_item_end, float(ms.get("day") or ms.get("endDay") or 0))
                except (TypeError, ValueError, AttributeError):
                    continue
            span_days = max(1, int(round(max_item_end)) + 1)
            end_date = start_date + timedelta(days=span_days)

            if sector_type == "PRIVATE":
                holiday_qs = PublicHoliday.objects.filter(date__range=(start_date, end_date), is_private=True)
            else:
                holiday_qs = PublicHoliday.objects.filter(date__range=(start_date, end_date), is_holiday='Y')
            holiday_set = {d.isoformat() for d in holiday_qs.values_list('date', flat=True).distinct()}

            output = io.BytesIO()
            wb = xlsxwriter.Workbook(output, {'in_memory': True})

            # ---- Sheet 1: Table ----
            write_table_sheet(wb, items, ordered_categories, grouped, rate_summary, rate_map, project_name)

            # ---- Sheet 2: Gantt (shape-based, Excel-editable) ----
            gantt_meta = write_gantt_sheet(
                wb,
                items,
                sub_tasks,
                links,
                project_name,
                start_date,
                custom_milestones=milestones,
                cost_inputs=cost_inputs,
                include_bohal_table=True,
                work_week_days=work_week_days,
                holiday_set=holiday_set,
            )
            logger.debug("[export-excel] gantt_shapes_count=%s", len(gantt_meta['shapes']))

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
            logger.exception("export-excel failed for project_id=%s", request.query_params.get('project_id'))
            return Response(
                {"error": "export-excel failed"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
