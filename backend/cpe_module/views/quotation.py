from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404

from ..models.quotation_models import Quotation
from ..serializers.quotation_serializers import QuotationSerializer
from ..utils.gemini_runner import gemini_runner
from ..utils.ai_queue import enqueue_task
from cpe_module.models.criteria_models import PreparationWork, Earthwork, FrameWork
from cpe_module.models.calc_models import (
    ConstructionOverview,
    WorkCondition,
    PreparationPeriod,
    EarthworkInput,
    FrameWorkInput,
)

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

# ai 결과 저장
@api_view(["POST"])
# @permission_classes([IsAuthenticated])
def update_ai_quotation(request, project_id):
    quotation = get_object_or_404(Quotation, project_id=project_id)

    # AI 새로 요청할 때 이전 결과 초기화(상태 알림용)
    quotation.ai_response = None
    quotation.save(update_fields=["ai_response"])

    # 기준(Criteria)
    prep_criteria = PreparationWork.objects.filter(project_id=project_id).last()
    earth_criteria = Earthwork.objects.filter(project_id=project_id).last()
    frame_criteria = FrameWork.objects.filter(project_id=project_id).last()

    # 사용자 입력(Calc)
    overview = ConstructionOverview.objects.filter(project_id=project_id).last()
    work = WorkCondition.objects.filter(project_id=project_id).last()
    prep_calc = PreparationPeriod.objects.filter(project_id=project_id).last()
    earth_calc = EarthworkInput.objects.filter(project_id=project_id).last()
    frame_calc = FrameWorkInput.objects.filter(project_id=project_id).last()

    # 비동기 실행 함수 정의
    def run_ai_analysis():
        try:
            ai_result = gemini_runner(
                quotation,
                prep_criteria=prep_criteria,
                earth_criteria=earth_criteria,
                frame_criteria=frame_criteria,
                overview=overview,
                work=work,
                prep_calc=prep_calc,
                earth_calc=earth_calc,
                frame_calc=frame_calc,
            )

            quotation.ai_response = ai_result
            quotation.save(update_fields=["ai_response"])
            print(f"[AI 분석 완료] {quotation.project}")

        except Exception as e:
            print(f"[AI 분석 오류 - project {project_id}] {e}")

    # 큐에 등록 (즉시 응답)
    enqueue_task(run_ai_analysis)

    # 응답 즉시 반환
    serializer = QuotationSerializer(quotation)
    return Response(
        {
            "message": "AI 분석이 큐에 등록되었습니다. 잠시 후 결과가 반영됩니다.",
            "data": serializer.data,
        },
        status=status.HTTP_202_ACCEPTED,
    )
