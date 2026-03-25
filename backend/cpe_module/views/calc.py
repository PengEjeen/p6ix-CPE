from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404

from ..models.calc_models import (
    ConstructionOverview,
    WorkCondition,
    PreparationPeriod,
    EarthworkInput,
    FrameWorkInput,
)
from ..serializers.calc_serializers import (
    ConstructionOverviewSerializer,
    WorkConditionSerializer,
    PreparationPeriodSerializer,
    EarthworkInputSerializer,
    FrameWorkInputSerializer,
)
from ..models.project_models import Project


def _get_owned_project_or_404(request, project_id):
    return get_object_or_404(
        Project,
        id=project_id,
        user=request.user,
        is_delete=False,
    )


# 공사개요
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def detail_construction_overview(request, project_id):
    project = _get_owned_project_or_404(request, project_id)
    instance, _ = ConstructionOverview.objects.get_or_create(project=project)
    serializer = ConstructionOverviewSerializer(instance)
    return Response(serializer.data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_construction_overview(request, project_id):
    project = _get_owned_project_or_404(request, project_id)
    instance, _ = ConstructionOverview.objects.get_or_create(project=project)
    serializer = ConstructionOverviewSerializer(instance, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# 근무조건 및 가동률
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def detail_work_condition(request, project_id):
    project = _get_owned_project_or_404(request, project_id)
    instance, _ = WorkCondition.objects.get_or_create(project=project)
    serializer = WorkConditionSerializer(instance)
    return Response(serializer.data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_work_condition(request, project_id):
    project = _get_owned_project_or_404(request, project_id)
    instance, _ = WorkCondition.objects.get_or_create(project=project)

    serializer = WorkConditionSerializer(instance, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# 준비·정리 기간
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def detail_preparation_period(request, project_id):
    project = _get_owned_project_or_404(request, project_id)
    instance = get_object_or_404(PreparationPeriod, project=project)
    serializer = PreparationPeriodSerializer(instance)
    return Response(serializer.data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_preparation_period(request, project_id):
    project = _get_owned_project_or_404(request, project_id)
    instance = get_object_or_404(PreparationPeriod, project=project)
    serializer = PreparationPeriodSerializer(instance, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# 토공사 입력
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def detail_earthwork_input(request, project_id):
    project = _get_owned_project_or_404(request, project_id)
    instance = get_object_or_404(EarthworkInput, project=project)
    serializer = EarthworkInputSerializer(instance)
    return Response(serializer.data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_earthwork_input(request, project_id):
    project = _get_owned_project_or_404(request, project_id)
    instance = get_object_or_404(EarthworkInput, project=project)
    serializer = EarthworkInputSerializer(instance, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# 골조공사 입력
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def detail_framework_input(request, project_id):
    project = _get_owned_project_or_404(request, project_id)
    instance = get_object_or_404(FrameWorkInput, project=project)
    serializer = FrameWorkInputSerializer(instance)
    return Response(serializer.data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_framework_input(request, project_id):
    project = _get_owned_project_or_404(request, project_id)
    instance = get_object_or_404(FrameWorkInput, project=project)
    serializer = FrameWorkInputSerializer(instance, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
