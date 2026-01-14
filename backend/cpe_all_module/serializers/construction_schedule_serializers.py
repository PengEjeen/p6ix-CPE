from rest_framework import serializers
from ..models import ConstructionScheduleItem

class ConstructionScheduleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConstructionScheduleItem
        fields = ['id', 'project', 'data']
