from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404

from ..models.operating_rate_models import WorkScheduleWeight
from ..serializers.operating_rate_serializers import WorkScheduleWeightSerializer


# 목록 조회 (로그인 유저 기준)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_work_schedule_weights(request):
    weights = WorkScheduleWeight.objects.filter(project__user=request.user)
    serializer = WorkScheduleWeightSerializer(
        weights, many=True, context={"request": request}
    )
    return Response({"results": serializer.data})


# 단일 조회 (project_id 기준)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def detail_work_schedule_weight(request, project_id):
    if not project_id:
        return Response({"error": "project_id parameter is required"}, status=400)

    # 여러 개 가능
    weights = WorkScheduleWeight.objects.filter(
        project__id=project_id,
        project__user=request.user
    )

    if not weights.exists():
        return Response({"error": "데이터가 없습니다."}, status=404)

    serializer = WorkScheduleWeightSerializer(weights, many=True, context={"request": request})
    return Response(serializer.data)


# 생성
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_work_schedule_weight(request, project_id):
    # 해당 유저가 접근 가능한 프로젝트에 연결된 Weight만 생성 허용
    if WorkScheduleWeight.objects.filter(
        project__id=project_id,
        project__user=request.user
    ).exists():
        return Response(
            {"detail": "해당 프로젝트의 WorkScheduleWeight가 이미 존재합니다."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = WorkScheduleWeightSerializer(
        data=request.data,
        context={"request": request, "project_id": project_id}
    )

    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# 수정
@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_work_schedule_weight(request, project_id):
    weights_data = request.data

    # 유효성 검사: 리스트인지 확인
    if not isinstance(weights_data, list):
        return Response({"error": "리스트 형태의 데이터가 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)

    updated_items = []

    for item in weights_data:
        type_value = item.get("type")
        if not type_value:
            continue  # type이 없으면 스킵

        # project_id + type 조합으로 정확히 한 개 존재
        weight = get_object_or_404(
            WorkScheduleWeight,
            project__id=project_id,
            project__user=request.user,
            type=type_value
        )

        serializer = WorkScheduleWeightSerializer(
            weight,
            data=item,
            partial=True,
            context={"request": request, "project_id": project_id}
        )

        if serializer.is_valid():
            serializer.save()
            updated_items.append(serializer.data)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    return Response(updated_items, status=status.HTTP_200_OK)
