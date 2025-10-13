from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404

from ..models.operating_rate_models import WorkScheduleWeight
from ..serializers.operating_rate_serializers import WorkScheduleWeightSerializer


# 📘 목록 조회 (필터링 & 페이지네이션)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_work_schedule_weights(request):
    """
    공종별 주간 가중치 목록 조회
    - type (공종) 필터 가능
    - page, page_size 파라미터 사용 가능
    """
    weights = WorkScheduleWeight.objects.filter(user=request.user, is_delete=False)

    # 공종(type) 필터링
    construction_type = request.query_params.get("type")
    if construction_type:
        weights = weights.filter(type=construction_type)

    # 정렬: 최신 수정순
    weights = weights.order_by("-updated_at")

    # 페이지네이션
    try:
        page = int(request.query_params.get("page", 1))
    except ValueError:
        page = 1

    try:
        page_size = int(request.query_params.get("page_size", 10))
    except ValueError:
        page_size = 10

    if page_size > 100:
        page_size = 100

    total = weights.count()
    start = (page - 1) * page_size
    end = start + page_size
    weights_page = weights[start:end]

    serializer = WorkScheduleWeightSerializer(
        weights_page, many=True, context={"request": request}
    )

    return Response({
        "count": total,
        "page": page,
        "page_size": page_size,
        "results": serializer.data,
    })


# 📘 단일 조회
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def detail_work_schedule_weight(request, pk):
    weight = get_object_or_404(WorkScheduleWeight, pk=pk, user=request.user, is_delete=False)
    serializer = WorkScheduleWeightSerializer(weight, context={"request": request})
    return Response(serializer.data)


# 📘 생성
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_work_schedule_weight(request):
    serializer = WorkScheduleWeightSerializer(
        data=request.data, context={"request": request}
    )
    if serializer.is_valid():
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# 📘 수정 (PUT/PATCH 공통)
@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def update_work_schedule_weight(request, pk):
    weight = get_object_or_404(WorkScheduleWeight, pk=pk, user=request.user, is_delete=False)
    serializer = WorkScheduleWeightSerializer(
        weight, data=request.data, partial=True, context={"request": request}
    )
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# 📘 Soft Delete
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def soft_delete_work_schedule_weight(request, pk):
    """
    is_delete=True 로 표시만 하고 실제 데이터는 남겨둠
    """
    weight = get_object_or_404(WorkScheduleWeight, pk=pk, user=request.user, is_delete=False)
    weight.is_delete = True
    weight.save(update_fields=["is_delete"])
    return Response(status=status.HTTP_204_NO_CONTENT)
