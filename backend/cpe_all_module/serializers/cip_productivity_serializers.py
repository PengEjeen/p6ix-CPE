from rest_framework import serializers
from cpe_all_module.models import CIPProductivityBasis, CIPDrillingStandard

class CIPProductivityBasisSerializer(serializers.ModelSerializer):
    class Meta:
        model = CIPProductivityBasis
        fields = '__all__'

class CIPDrillingStandardSerializer(serializers.ModelSerializer):
    class Meta:
        model = CIPDrillingStandard
        fields = '__all__'
