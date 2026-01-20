from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from ..utils.gemini_runner import gantt_ai_log_runner


@api_view(["POST"])
def summarize_schedule_ai_log(request):
    payload = request.data or {}
    summary = gantt_ai_log_runner(payload)
    return Response({"summary": summary}, status=status.HTTP_200_OK)
