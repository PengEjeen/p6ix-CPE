from rest_framework import serializers
from django.db import transaction
from ..models.project_models import Project
from ..models.calc_models import *
from ..models.criteria_models import *
from ..models.estimate_models import *
from ..models.operating_rate_models import *


class ProjectSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source="user.id")

    class Meta:
        model = Project
        fields = [
            "id",
            "user",
            "title",
            "description",
            "created_at",
            "updated_at",
            "is_delete",
        ]
        read_only_fields = ("id", "created_at", "updated_at", "is_delete", "user")

    @transaction.atomic
    def create(self, validated_data):
        user = self.context["request"].user
        project = Project.objects.create(user=user, **validated_data)

        # 공기산정 관련 (calc_models)
        ConstructionOverview.objects.create(project=project)
        WorkCondition.objects.create(project=project)
        PreparationPeriod.objects.create(project=project)
        EarthworkInput.objects.create(project=project)
        FrameWorkInput.objects.create(project=project)

        # 가동률 관련 (operating_rate_models)
        WorkScheduleWeight.objects.bulk_create([
            WorkScheduleWeight(project=project, type="EARTH"),
            WorkScheduleWeight(project=project, type="FRAME"),
            WorkScheduleWeight(project=project, type="EXT_FIN"),
            WorkScheduleWeight(project=project, type="INT_FIN"),
            WorkScheduleWeight(project=project, type="POUR"),
        ])

        # 적용기준 관련 (criteria_models)
        PreparationWork.objects.create(project=project)
        Earthwork.objects.create(project=project)
        FrameWork.objects.create(project=project)

        return project
