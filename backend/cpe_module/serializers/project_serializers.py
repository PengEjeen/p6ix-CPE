from rest_framework import serializers
from django.db import transaction
from ..models.project_models import Project
from ..models.calc_models import *
from ..models.criteria_models import *
from ..models.estimate_models import *
from ..models.operating_rate_models import *
from ..models.quotation_models import Quotation


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
        # admin의 기준데이터(is_admin=True) 복제
        prep_admin = PreparationWork.objects.filter(is_admin=True).last()
        earth_admin = Earthwork.objects.filter(is_admin=True).last()
        frame_admin = FrameWork.objects.filter(is_admin=True).last()

        if prep_admin:
            PreparationWork.objects.create(
                project=project,
                **{
                    f.name: getattr(prep_admin, f.name)
                    for f in PreparationWork._meta.fields
                    if f.name not in ["id", "project", "created_at", "updated_at", "is_admin"]
                },
            )
        else:
            PreparationWork.objects.create(project=project)

        if earth_admin:
            Earthwork.objects.create(
                project=project,
                **{
                    f.name: getattr(earth_admin, f.name)
                    for f in Earthwork._meta.fields
                    if f.name not in ["id", "project", "created_at", "updated_at", "is_admin"]
                },
            )
        else:
            Earthwork.objects.create(project=project)

        if frame_admin:
            FrameWork.objects.create(
                project=project,
                **{
                    f.name: getattr(frame_admin, f.name)
                    for f in FrameWork._meta.fields
                    if f.name not in ["id", "project", "created_at", "updated_at", "is_admin"]
                },
            )
        else:
            FrameWork.objects.create(project=project)

        # ④ 갑지 관련
        Quotation.objects.create(project=project)

        return project
