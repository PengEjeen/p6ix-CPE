from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
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
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset().filter(
            project__user=self.request.user,
            project__is_delete=False,
        )
        project_id = self.request.query_params.get('project')
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

class PileResultViewSet(viewsets.ModelViewSet):
    queryset = PileResult.objects.all()
    serializer_class = PileResultSerializer
    filterset_fields = ['project']
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset().filter(
            project__user=self.request.user,
            project__is_delete=False,
        )
        project_id = self.request.query_params.get('project')
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

class PileStandardViewSet(viewsets.ModelViewSet):
    queryset = PileStandard.objects.all()
    serializer_class = PileStandardSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None  # Explicitly disable pagination to return list
