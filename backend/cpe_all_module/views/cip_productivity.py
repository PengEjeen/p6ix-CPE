from rest_framework import viewsets
from cpe_all_module.models import CIPProductivityBasis, CIPResult
from cpe_all_module.serializers.cip_productivity_serializers import CIPProductivityBasisSerializer, CIPResultSerializer

class CIPProductivityBasisViewSet(viewsets.ModelViewSet):
    queryset = CIPProductivityBasis.objects.all()
    serializer_class = CIPProductivityBasisSerializer
    filterset_fields = ['project']
    permission_classes = [] # Adjust as needed, e.g., IsAuthenticated

    def get_queryset(self):
        queryset = super().get_queryset()
        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project__id=project_id)
        return queryset

class CIPResultViewSet(viewsets.ModelViewSet):
    queryset = CIPResult.objects.all()
    serializer_class = CIPResultSerializer
    filterset_fields = ['project']
    permission_classes = []

    def get_queryset(self):
        queryset = super().get_queryset()
        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project__id=project_id)
        return queryset

from cpe_all_module.models import CIPDrillingStandard
from cpe_all_module.serializers.cip_productivity_serializers import CIPDrillingStandardSerializer

class CIPDrillingStandardViewSet(viewsets.ModelViewSet):
    queryset = CIPDrillingStandard.objects.all()
    serializer_class = CIPDrillingStandardSerializer
    permission_classes = []
    pagination_class = None # Explicitly disable pagination to return list
