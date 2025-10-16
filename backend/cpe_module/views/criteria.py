from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404

from ..models.criteria_models import PreparationWork, Earthwork, FrameWork
from ..serializers.criteria_serializers import (
    PreparationWorkSerializer,
    EarthworkSerializer,
    FrameWorkSerializer,
)


# ----------------------------
# 준비·정리·가설·마감공사
# ----------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def detail_preparation_work(request, project_id):
    instance = get_object_or_404(PreparationWork, project_id=project_id)
    serializer = PreparationWorkSerializer(instance)
    return Response(serializer.data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_preparation_work(request, project_id):
    instance = get_object_or_404(PreparationWork, project_id=project_id)
    serializer = PreparationWorkSerializer(instance, data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ----------------------------
# 토공사
# ----------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def detail_earthwork(request, project_id):
    instance = get_object_or_404(Earthwork, project_id=project_id)
    serializer = EarthworkSerializer(instance)
    return Response(serializer.data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_earthwork(request, project_id):
    instance = get_object_or_404(Earthwork, project_id=project_id)
    serializer = EarthworkSerializer(instance, data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ----------------------------
# 골조공사
# ----------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def detail_framework(request, project_id):
    instance = get_object_or_404(FrameWork, project_id=project_id)
    serializer = FrameWorkSerializer(instance)
    return Response(serializer.data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_framework(request, project_id):
    instance = get_object_or_404(FrameWork, project_id=project_id)
    serializer = FrameWorkSerializer(instance, data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
