from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from datetime import date as date_cls
import io
import xlsxwriter
import traceback
from ..models.construction_schedule_models import ConstructionScheduleItem
from ..serializers.construction_schedule_serializers import ConstructionScheduleItemSerializer
from cpe_module.models.operating_rate_models import WorkScheduleWeight
from cpe_module.models.calc_models import WorkCondition
from cpe_module.models.project_models import Project
from cpe_all_module.services.construction_schedule_export import (
    build_rate_summary,
    extract_schedule_payload,
    group_items_by_category,
    inject_gantt_drawing,
    write_gantt_sheet,
    write_table_sheet,
)

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
