from rest_framework import serializers
from ..models.quotation_models import Quotation
from ..models.calc_models import ConstructionOverview


class ConstructionOverviewSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConstructionOverview
        fields = [
            "building_use",
            "basement_floors",
            "ground_floors",
            "site_area",
            "total_floor_area",
        ]


class QuotationSerializer(serializers.ModelSerializer):
    project_title = serializers.CharField(source='project.title', read_only=True)
    construction_overview = serializers.SerializerMethodField()  # ✅ 추가

    class Meta:
        model = Quotation
        fields = '__all__'
        read_only_fields = ['project_title']

    def get_construction_overview(self, obj):
        """같은 project_id의 ConstructionOverview를 함께 반환"""
        overview = ConstructionOverview.objects.filter(project=obj.project).first()
        if overview:
            return ConstructionOverviewSimpleSerializer(overview).data
        return None
