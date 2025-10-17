from rest_framework import serializers
from ..models.calc_models import (
    ConstructionOverview,
    WorkCondition,
    PreparationPeriod,
    EarthworkInput,
    FrameWorkInput,
)


# 공사개요
class ConstructionOverviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConstructionOverview
        fields = "__all__"
        read_only_fields = ["project"]


from rest_framework import serializers
from ..models.calc_models import WorkCondition
from ..models.operating_rate_models import WorkScheduleWeight


class WorkConditionSerializer(serializers.ModelSerializer):
    # 계산된 가동률 필드 추가 (read_only)
    earthwork_utilization = serializers.SerializerMethodField()
    framework_utilization = serializers.SerializerMethodField()

    class Meta:
        model = WorkCondition
        fields = "__all__"
        read_only_fields = ["project"]

    # --- 계산 메서드 ---
    def get_earthwork_utilization(self, obj):
        weight = WorkScheduleWeight.objects.filter(
            project=obj.project, type="EARTH"
        ).first()
        if not weight:
            return None

        return {
            7: weight.pct_7d,
            6: weight.pct_6d,
            5: weight.pct_5d,
        }

    def get_framework_utilization(self, obj):
        weight = WorkScheduleWeight.objects.filter(
            project=obj.project, type="FRAME"
        ).first()
        if not weight:
            return None

        return {
            7: weight.pct_7d,
            6: weight.pct_6d,
            5: weight.pct_5d,
        }


# 준비/정리 기간 및 추가공사기간
class PreparationPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreparationPeriod
        fields = "__all__"
        read_only_fields = ["project"]


# 토공사 입력
class EarthworkInputSerializer(serializers.ModelSerializer):
    class Meta:
        model = EarthworkInput
        fields = "__all__"
        read_only_fields = ["project"]


# 골조공사 입력 (JSONField 검증 포함)
class FrameWorkInputSerializer(serializers.ModelSerializer):
    class Meta:
        model = FrameWorkInput
        fields = "__all__"
        read_only_fields = ["project"]

    def validate_floor_height_data(self, value):
        """
        floor_height_data 구조 검증
        {
            "basement": [{"floor": 10, "height": 3.5, "floor_sep": "전이층"}],
            "ground": [{"floor": 1, "height": 3.2, "floor_sep": "세팅층"}]
        }
        """
        if not isinstance(value, dict):
            raise serializers.ValidationError("floor_height_data는 JSON 객체(dict) 형태여야 합니다.")

        # 키 검증
        required_keys = {"basement", "ground"}
        if set(value.keys()) != required_keys:
            raise serializers.ValidationError(
                f"floor_height_data는 {required_keys} 두 키를 모두 포함해야 합니다."
            )

        # 층 리스트 검증
        for section, floors in value.items():
            if not isinstance(floors, list):
                raise serializers.ValidationError(f"{section}의 값은 리스트여야 합니다.")
            for i, floor_info in enumerate(floors):
                if not isinstance(floor_info, dict):
                    raise serializers.ValidationError(f"{section}[{i}] 항목은 객체여야 합니다.")
                if set(floor_info.keys()) != {"floor", "height", "floor_sep"}:
                    raise serializers.ValidationError(
                        f"{section}[{i}] 항목은 'floor', 'height', 'floor_sep' 3개의 필드만 가져야 합니다."
                    )

                # 각 필드 타입 검증
                floor = floor_info["floor"]
                height = floor_info["height"]
                floor_sep = floor_info["floor_sep"]

                if not isinstance(floor, (int, float)):
                    raise serializers.ValidationError(f"{section}[{i}].floor 은 숫자여야 합니다.")
                if not isinstance(height, (int, float)):
                    raise serializers.ValidationError(f"{section}[{i}].height 은 숫자여야 합니다.")
                if not isinstance(floor_sep, str):
                    raise serializers.ValidationError(f"{section}[{i}].floor_sep 은 문자열이어야 합니다.")

                # 선택지 제한 (옵션)
                allowed_sep = [
                    "전이층", "세팅층", "피난층", "필로티", "포디움", "스카이라운지", "Cycle Time"
                ]
                if floor_sep not in allowed_sep:
                    raise serializers.ValidationError(
                        f"{section}[{i}].floor_sep 값은 {allowed_sep} 중 하나여야 합니다."
                    )

        return value
