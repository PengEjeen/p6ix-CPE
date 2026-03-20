from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend
from ..models.bored_pile_productivity_models import BoredPileResult, BoredPileProductivityBasis, BoredPileStandard
from ..serializers.bored_pile_productivity_serializers import (
    BoredPileResultSerializer, 
    BoredPileProductivityBasisSerializer, 
    BoredPileStandardSerializer
)

class BoredPileResultViewSet(viewsets.ModelViewSet):
    queryset = BoredPileResult.objects.all()
    serializer_class = BoredPileResultSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project']
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset().filter(
            project__user=self.request.user,
            project__is_delete=False,
        )
        project_id = self.request.query_params.get("project")
        if project_id:
            queryset = queryset.filter(project__id=project_id)
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

class BoredPileProductivityBasisViewSet(viewsets.ModelViewSet):
    queryset = BoredPileProductivityBasis.objects.all().order_by('id')
    serializer_class = BoredPileProductivityBasisSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project']
    pagination_class = None # Show all rows for ease of use in tables
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset().filter(
            project__user=self.request.user,
            project__is_delete=False,
        )
        project_id = self.request.query_params.get("project")
        if project_id:
            queryset = queryset.filter(project__id=project_id)
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

class BoredPileStandardViewSet(viewsets.ModelViewSet):
    queryset = BoredPileStandard.objects.all().order_by('id')
    serializer_class = BoredPileStandardSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['method', 'diameter_spec']
    pagination_class = None
    permission_classes = [IsAuthenticated]
