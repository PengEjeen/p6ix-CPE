from rest_framework import serializers
from cpe_all_module.models.construction_productivity_models import ConstructionProductivity

class ConstructionProductivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = ConstructionProductivity
        fields = '__all__'
