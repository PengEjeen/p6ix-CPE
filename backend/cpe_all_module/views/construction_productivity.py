from rest_framework import viewsets
from cpe_all_module.models.construction_productivity_models import ConstructionProductivity
from cpe_all_module.serializers.construction_productivity_serializers import ConstructionProductivitySerializer

class ConstructionProductivityViewSet(viewsets.ModelViewSet):
    queryset = ConstructionProductivity.objects.all().order_by('id')
    serializer_class = ConstructionProductivitySerializer

    pagination_class = None

    def get_queryset(self):
        queryset = super().get_queryset()
        project_id = self.kwargs.get('project_id') or self.request.query_params.get('project_id')
        print(project_id)
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset

