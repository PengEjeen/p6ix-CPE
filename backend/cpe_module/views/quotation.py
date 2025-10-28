from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404

from ..models.quotation_models import Quotation
from ..serializers.quotation_serializers import QuotationSerializer


# 견적서 상세조회
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def detail_quotation(request, project_id):
    instance = get_object_or_404(Quotation, project_id=project_id)
    serializer = QuotationSerializer(instance)
    return Response(serializer.data)


# 견적서 수정
@api_view(["Patch"])
@permission_classes([IsAuthenticated])
def update_quotation(request, project_id):
    instance = get_object_or_404(Quotation, project_id=project_id)
    serializer = QuotationSerializer(instance, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
