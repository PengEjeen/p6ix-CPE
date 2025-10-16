from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404

from ..models.project_models import Project
from ..serializers.project_serializers import ProjectSerializer


# 프로젝트 목록 조회
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_projects(request):
    projects = Project.objects.filter(user=request.user, is_delete=False).order_by("-created_at")
    serializer = ProjectSerializer(projects, many=True, context={"request": request})
    return Response({"results": serializer.data})


# 프로젝트 단일 조회
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def detail_project(request, project_id):
    project = get_object_or_404(Project, id=project_id, user=request.user, is_delete=False)
    serializer = ProjectSerializer(project, context={"request": request})
    return Response(serializer.data)


# 프로젝트 생성
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_project(request):
    serializer = ProjectSerializer(data=request.data, context={"request": request})
    if serializer.is_valid():
        project = serializer.save()
        return Response(ProjectSerializer(project).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



# 프로젝트 수정
@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_project(request, project_id):
    project = get_object_or_404(Project, id=project_id, user=request.user, is_delete=False)
    serializer = ProjectSerializer(project, data=request.data, partial=True, context={"request": request})

    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# 프로젝트 삭제 (Soft Delete)
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_project(request, project_id):
    project = get_object_or_404(Project, id=project_id, user=request.user, is_delete=False)
    project.is_delete = True
    project.save()
    return Response({"detail": "프로젝트가 삭제되었습니다."}, status=status.HTTP_204_NO_CONTENT)
