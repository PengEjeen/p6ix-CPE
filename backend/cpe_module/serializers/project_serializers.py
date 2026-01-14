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
            "calc_type",
            "start_date",
            "created_at",
            "updated_at",
            "is_delete",
        ]
        read_only_fields = ("id", "created_at", "updated_at", "is_delete", "user")

    @transaction.atomic
    def create(self, validated_data):
        user = self.context["request"].user
        project = Project.objects.create(user=user, **validated_data)

        if project.calc_type == "APARTMENT":
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

        elif project.calc_type == "TOTAL":
            # cpe_all_module 모델 초기화
            from cpe_all_module.models.construction_productivity_models import ConstructionProductivity
            
            # 표준 생산성 데이터(project=None)를 복제하여 해당 프로젝트용으로 생성
            standard_productivities = ConstructionProductivity.objects.filter(project__isnull=True).values()
            new_objects = [
                ConstructionProductivity(
                    project=project, 
                    **{k: v for k, v in item.items() if k != 'id' and k != 'project_id'}
                )
                for item in standard_productivities
            ]
            ConstructionProductivity.objects.bulk_create(new_objects)

            # CIP 생산성 근거 초기화 (Template Copy)
            from cpe_all_module.models.cip_productivity_models import CIPProductivityBasis, CIPResult
            
            standard_cip = CIPProductivityBasis.objects.filter(project__isnull=True).values()
            cip_new_objects = [
                CIPProductivityBasis(
                    project=project,
                    **{k: v for k, v in item.items() if k != 'id' and k != 'project_id'}
                )
                for item in standard_cip
            ]
            CIPProductivityBasis.objects.bulk_create(cip_new_objects)

            # CIP 생산성 결과 초기화
            # 생산성 결과는 별도의 템플릿이 없음 그냥 지금의 프로젝트와 연결해서 생성
            CIPResult.objects.create(project=project)


            # Pile 생산성 근거 및 결과 초기화
            from cpe_all_module.models.pile_productivity_models import PileProductivityBasis, PileResult
            
            standard_pile = PileProductivityBasis.objects.filter(project__isnull=True).values()
            pile_new_objects = [
                PileProductivityBasis(
                    project=project,
                    **{k: v for k, v in item.items() if k != 'id' and k != 'project_id'}
                )
                for item in standard_pile
            ]
            PileProductivityBasis.objects.bulk_create(pile_new_objects)
            
            # Pile 생산성 결과 초기화
            PileResult.objects.create(project=project)

            # Bored Pile 생산성 근거 및 결과 초기화
            from cpe_all_module.models.bored_pile_productivity_models import BoredPileProductivityBasis, BoredPileResult
            
            standard_bored = BoredPileProductivityBasis.objects.filter(project__isnull=True).values()
            bored_new_objects = [
                BoredPileProductivityBasis(
                    project=project,
                    **{k: v for k, v in item.items() if k != 'id' and k != 'project_id'}
                )
                for item in standard_bored
            ]
            BoredPileProductivityBasis.objects.bulk_create(bored_new_objects)
            
            # Bored Pile 생산성 결과 초기화
            BoredPileResult.objects.create(project=project)

            # 가동률 초기화
            # from ..models.operating_rate_models import ConstructionType, WorkScheduleWeight (Already imported globally)
            for choice in ConstructionType:
                WorkScheduleWeight.objects.create(project=project, type=choice.value)
        
        # Schedule Master Initial Data (For ALL project types)
        # cpe_all_module/models/construction_schedule_models
        from cpe_all_module.models.construction_schedule_models import ConstructionScheduleItem
        from cpe_all_module.initial_data import get_default_schedule_data
        
        ConstructionScheduleItem.objects.create(
            project=project,
            data=get_default_schedule_data()
        )

        return project
