from rest_framework import serializers
from cpe_all_module.models import PileProductivityBasis, PileStandard, PileResult

class PileProductivityBasisSerializer(serializers.ModelSerializer):
    class Meta:
        model = PileProductivityBasis
        fields = '__all__'

class PileResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = PileResult
        fields = '__all__'

class PileStandardSerializer(serializers.ModelSerializer):
    class Meta:
        model = PileStandard
        fields = '__all__'
