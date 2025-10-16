from rest_framework import serializers
from ..models.operating_rate_models import WorkScheduleWeight
from ..models.project_models import Project


class WorkScheduleWeightSerializer(serializers.ModelSerializer):
    project = serializers.PrimaryKeyRelatedField(read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model = WorkScheduleWeight
        fields = [
            "project",
            "type",
            "type_display",
            "pct_7d",
            "pct_6d",
            "pct_5d",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ("created_at", "updated_at")

    def create(self, validated_data):
        project = self.context.get("project")

        # context에 project 객체 대신 id만 넘어온 경우도 처리
        if not project:
            project_id = self.context.get("project_id")
            if not project_id:
                raise serializers.ValidationError("프로젝트 정보가 필요합니다.")
            project = Project.objects.filter(id=project_id).first()
            if not project:
                raise serializers.ValidationError("유효하지 않은 프로젝트입니다.")

        # WorkScheduleWeight 생성
        return WorkScheduleWeight.objects.create(project=project, **validated_data)

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
