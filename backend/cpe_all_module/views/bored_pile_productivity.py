from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from ..models.bored_pile_productivity_models import BoredPileResult, BoredPileProductivityBasis, BoredPileStandard
from ..serializers.bored_pile_productivity_serializers import (
    BoredPileResultSerializer, 
    BoredPileProductivityBasisSerializer, 
    BoredPileStandardSerializer
)

class BoredPileResultViewSet(viewsets.ModelViewSet):
    queryset = BoredPileResult.objects.all()
    serializer_class = BoredPileResultSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project']

class BoredPileProductivityBasisViewSet(viewsets.ModelViewSet):
    queryset = BoredPileProductivityBasis.objects.all().order_by('id')
    serializer_class = BoredPileProductivityBasisSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project']
    pagination_class = None # Show all rows for ease of use in tables

class BoredPileStandardViewSet(viewsets.ModelViewSet):
    queryset = BoredPileStandard.objects.all().order_by('id')
    serializer_class = BoredPileStandardSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['method', 'diameter_spec']
    pagination_class = None
