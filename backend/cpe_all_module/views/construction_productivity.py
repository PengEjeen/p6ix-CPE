from rest_framework import viewsets

from cpe_all_module.models.construction_productivity_models import ConstructionProductivity
from cpe_all_module.serializers.construction_productivity_serializers import (
    ConstructionProductivitySerializer,
)


class ConstructionProductivityViewSet(viewsets.ModelViewSet):
    queryset = ConstructionProductivity.objects.all().order_by(
        "main_category", "category", "sub_category", "item_name", "standard", "id"
    )
    serializer_class = ConstructionProductivitySerializer
    pagination_class = None

    _TEMPLATE_MATCH_FIELDS = (
        "main_category",
        "category",
        "sub_category",
        "item_name",
        "standard",
        "unit",
    )

    def _row_signature(self, row):
        return tuple(
            str(getattr(row, field, "") or "").strip()
            for field in self._TEMPLATE_MATCH_FIELDS
        )

    def _ensure_project_defaults(self, project_id, project_queryset, template_queryset):
        if not template_queryset.exists():
            return

        existing_signatures = {
            self._row_signature(row)
            for row in project_queryset.only(*self._TEMPLATE_MATCH_FIELDS)
        }

        clone_fields = [
            field.name
            for field in ConstructionProductivity._meta.fields
            if field.name not in ("id", "project")
        ]

        missing_rows = []
        for template_row in template_queryset.only(*clone_fields):
            signature = self._row_signature(template_row)
            if signature in existing_signatures:
                continue
            existing_signatures.add(signature)
            payload = {field: getattr(template_row, field) for field in clone_fields}
            missing_rows.append(ConstructionProductivity(project_id=project_id, **payload))

        if missing_rows:
            ConstructionProductivity.objects.bulk_create(missing_rows)

    def get_queryset(self):
        queryset = super().get_queryset()
        project_id = self.kwargs.get("project_id") or self.request.query_params.get(
            "project_id"
        )
        if not project_id:
            return queryset

        project_queryset = queryset.filter(project_id=project_id)
        template_queryset = queryset.filter(project__isnull=True)

        if project_queryset.exists():
            self._ensure_project_defaults(project_id, project_queryset, template_queryset)
            return queryset.filter(project_id=project_id)

        # 일부 구버전 프로젝트는 표준 데이터를 복제하지 않고 생성됨.
        # 이 경우 템플릿(project is null) 데이터를 fallback으로 반환한다.
        return template_queryset
