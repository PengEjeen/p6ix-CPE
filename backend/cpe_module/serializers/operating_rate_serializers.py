from rest_framework import serializers
from ..models.operating_rate_models import WorkScheduleWeight

class WorkScheduleWeightSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_type_display", read_only=True)

    class Meta:
        model = WorkScheduleWeight
        fields = [
            "id", "type", "type_display",
            "pct_7d", "pct_6d", "pct_5d",
            "created_at", "updated_at", "is_delete"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
