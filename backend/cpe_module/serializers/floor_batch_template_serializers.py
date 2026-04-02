from rest_framework import serializers

from ..models.floor_batch_template_models import FloorBatchTemplate


class FloorBatchTemplateSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source="user.id")

    class Meta:
        model = FloorBatchTemplate
        fields = [
            "id",
            "user",
            "name",
            "main_category",
            "rows",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ("id", "user", "created_at", "updated_at")

    def validate_rows(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("rows는 리스트 형태여야 합니다.")

        normalized_rows = []
        for row in value:
            if not isinstance(row, dict):
                raise serializers.ValidationError("각 템플릿 행은 객체 형태여야 합니다.")

            normalized_row = {
                "process": str(row.get("process") or "").strip(),
                "work_type": str(row.get("work_type") or "").strip(),
                "unit": str(row.get("unit") or "").strip(),
                "quantity": str(row.get("quantity") or "").strip(),
                "productivity": str(row.get("productivity") or "").strip(),
                "crew_size": str(row.get("crew_size") or "").strip(),
                "note": str(row.get("note") or "").strip(),
                "remarks": str(row.get("remarks") or "").strip(),
                "quantity_formula": str(row.get("quantity_formula") or "").strip(),
                "standard_code": str(row.get("standard_code") or "").strip(),
            }
            if not normalized_row["work_type"]:
                raise serializers.ValidationError("각 템플릿 행에는 세부공종(work_type)이 필요합니다.")
            normalized_rows.append(normalized_row)

        if not normalized_rows:
            raise serializers.ValidationError("템플릿에는 최소 1개 이상의 행이 필요합니다.")

        return normalized_rows

    def create(self, validated_data):
        request = self.context.get("request")
        return FloorBatchTemplate.objects.create(user=request.user, **validated_data)
