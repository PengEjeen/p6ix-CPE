from rest_framework import serializers
from ..models.criteria_models import PreparationWork, Earthwork, FrameWork


# ----------------------------
# 준비·정리·가설·마감공사
# ----------------------------
class PreparationWorkSerializer(serializers.ModelSerializer):
    project = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = PreparationWork
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


# ----------------------------
# 토공사
# ----------------------------
class EarthworkSerializer(serializers.ModelSerializer):
    project = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Earthwork
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


# ----------------------------
# 골조공사
# ----------------------------
class FrameWorkSerializer(serializers.ModelSerializer):
    project = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = FrameWork
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

    # JSONField 유효성 검사
    def validate_base_thickness_data(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("기초두께 데이터는 리스트 형태여야 합니다.")
        for item in value:
            if not isinstance(item, dict):
                raise serializers.ValidationError("기초두께 데이터 항목은 객체여야 합니다.")
            if "thickness" not in item or "day" not in item:
                raise serializers.ValidationError("각 항목에는 'thickness'와 'day' 키가 필요합니다.")
        return value

    def validate_floor_height_data(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("층고 데이터는 리스트 형태여야 합니다.")
        for item in value:
            if not isinstance(item, dict):
                raise serializers.ValidationError("층고 데이터 항목은 객체여야 합니다.")
            if "height" not in item or "day" not in item:
                raise serializers.ValidationError("각 항목에는 'height'와 'day' 키가 필요합니다.")
        return value

    def validate_transfer_height_data(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("전이층 데이터는 리스트 형태여야 합니다.")
        for item in value:
            if not isinstance(item, dict):
                raise serializers.ValidationError("전이층 데이터 항목은 객체여야 합니다.")
            if "floors" not in item or "day" not in item:
                raise serializers.ValidationError("각 항목에는 'floors'와 'day' 키가 필요합니다.")
        return value