from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from ..models.floor_batch_template_models import FloorBatchTemplate
from ..serializers.floor_batch_template_serializers import FloorBatchTemplateSerializer


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def floor_batch_templates(request):
    if request.method == "GET":
        queryset = FloorBatchTemplate.objects.filter(user=request.user)
        serializer = FloorBatchTemplateSerializer(queryset, many=True, context={"request": request})
        return Response({"results": serializer.data})

    serializer = FloorBatchTemplateSerializer(data=request.data, context={"request": request})
    if serializer.is_valid():
        template = serializer.save()
        return Response(
            FloorBatchTemplateSerializer(template, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def floor_batch_template_detail(request, template_id):
    template = get_object_or_404(FloorBatchTemplate, id=template_id, user=request.user)

    if request.method == "DELETE":
        template.delete()
        return Response({"detail": "층별생성 템플릿이 삭제되었습니다."}, status=status.HTTP_200_OK)

    serializer = FloorBatchTemplateSerializer(
        template,
        data=request.data,
        partial=request.method == "PATCH",
        context={"request": request},
    )
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
