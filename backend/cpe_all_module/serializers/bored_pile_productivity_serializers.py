from rest_framework import serializers
from ..models.bored_pile_productivity_models import BoredPileResult, BoredPileProductivityBasis, BoredPileStandard

class BoredPileResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoredPileResult
        fields = '__all__'

class BoredPileProductivityBasisSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoredPileProductivityBasis
        fields = '__all__'

class BoredPileStandardSerializer(serializers.ModelSerializer):
    method_display = serializers.CharField(source='get_method_display', read_only=True)
    
    class Meta:
        model = BoredPileStandard
        fields = '__all__'
