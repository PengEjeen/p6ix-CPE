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


# 단일 조회 (project_id 기준) - main_category 기반
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def detail_work_schedule_weight(request, project_id):
    if not project_id:
        return Response({"error": "project_id parameter is required"}, status=400)

    # main_category 기반으로 여러 개 조회
    weights = WorkScheduleWeight.objects.filter(
        project__id=project_id,
        project__user=request.user
    ).order_by('main_category')

    # 데이터가 없어도 빈 배열 반환 (404 대신)
    serializer = WorkScheduleWeightSerializer(weights, many=True, context={"request": request})
    return Response(serializer.data)


# 생성
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_work_schedule_weight(request, project_id):
    serializer = WorkScheduleWeightSerializer(
        data=request.data,
        context={"request": request, "project_id": project_id}
    )

    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# 수정 - main_category 기반으로 변경
@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_work_schedule_weight(request, project_id):
    weights_data = request.data

    # 유효성 검사: 리스트인지 확인
    if not isinstance(weights_data, list):
        return Response({"error": "리스트 형태의 데이터가 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)

    updated_items = []

    for item in weights_data:
        main_category = item.get("main_category")
        item_id = item.get("id")
        
        if not main_category and not item_id:
            continue  # main_category나 id가 없으면 스킵

        # ID가 있으면 ID로 찾고, 없으면 main_category로 찾기
        try:
            if item_id:
                weight = WorkScheduleWeight.objects.get(
                    id=item_id,
                    project__id=project_id,
                    project__user=request.user
                )
            else:
                weight = WorkScheduleWeight.objects.get(
                    project__id=project_id,
                    project__user=request.user,
                    main_category=main_category
                )
        except WorkScheduleWeight.DoesNotExist:
            # 없으면 생성
            serializer = WorkScheduleWeightSerializer(
                data=item,
                context={"request": request, "project_id": project_id}
            )
            if serializer.is_valid():
                serializer.save()
                updated_items.append(serializer.data)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            continue

        # 업데이트
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
