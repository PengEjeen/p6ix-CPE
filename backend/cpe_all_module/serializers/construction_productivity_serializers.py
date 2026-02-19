from rest_framework import serializers
from cpe_all_module.models.construction_productivity_models import ConstructionProductivity

class ConstructionProductivitySerializer(serializers.ModelSerializer):
    process_name = serializers.SerializerMethodField()
    work_type_name = serializers.SerializerMethodField()

    class Meta:
        model = ConstructionProductivity
        fields = '__all__'

    def get_process_name(self, obj):
        return (obj.category or "").strip()

    def get_work_type_name(self, obj):
        return (obj.sub_category or obj.item_name or "").strip()
