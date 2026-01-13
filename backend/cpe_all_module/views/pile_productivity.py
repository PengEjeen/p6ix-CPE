from rest_framework import viewsets
from cpe_all_module.models import PileProductivityBasis, PileResult, PileStandard
from cpe_all_module.serializers.pile_productivity_serializers import (
    PileProductivityBasisSerializer,
    PileResultSerializer,
    PileStandardSerializer
)

class PileProductivityBasisViewSet(viewsets.ModelViewSet):
    queryset = PileProductivityBasis.objects.all()
    serializer_class = PileProductivityBasisSerializer
    filterset_fields = ['project']
    permission_classes = []

    def get_queryset(self):
        queryset = super().get_queryset()
        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project__id=project_id)
        return queryset

class PileResultViewSet(viewsets.ModelViewSet):
    queryset = PileResult.objects.all()
    serializer_class = PileResultSerializer
    filterset_fields = ['project']
    permission_classes = []

    def get_queryset(self):
        queryset = super().get_queryset()
        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project__id=project_id)
        return queryset

class PileStandardViewSet(viewsets.ModelViewSet):
    queryset = PileStandard.objects.all()
    serializer_class = PileStandardSerializer
    permission_classes = []
    pagination_class = None  # Explicitly disable pagination to return list
