from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ConstructionProductivityViewSet,
    CIPProductivityBasisViewSet,
    CIPDrillingStandardViewSet,
    CIPResultViewSet,
    PileProductivityBasisViewSet,
    PileStandardViewSet,
    PileResultViewSet,
    BoredPileProductivityBasisViewSet,
    BoredPileStandardViewSet,
    BoredPileResultViewSet,
    ConstructionScheduleItemViewSet
)

router = DefaultRouter()
router.register(r'productivity', ConstructionProductivityViewSet, basename='productivity')
router.register(r'cip-basis', CIPProductivityBasisViewSet, basename='cip-basis')
router.register(r'cip-result', CIPResultViewSet, basename='cip-result')
router.register(r'cip-standard', CIPDrillingStandardViewSet, basename='cip-standard')
router.register(r'pile-basis', PileProductivityBasisViewSet, basename='pile-basis')
router.register(r'pile-result', PileResultViewSet, basename='pile-result')
router.register(r'pile-standard', PileStandardViewSet, basename='pile-standard')
router.register(r'bored-pile-basis', BoredPileProductivityBasisViewSet, basename='bored-pile-basis')
router.register(r'bored-pile-result', BoredPileResultViewSet, basename='bored-pile-result')
router.register(r'bored-pile-standard', BoredPileStandardViewSet, basename='bored-pile-standard')
router.register(r'schedule-item', ConstructionScheduleItemViewSet, basename='schedule-item')

urlpatterns = [
    path('productivity/project/<str:project_id>/', ConstructionProductivityViewSet.as_view({'get': 'list'}), name='productivity-project-list'),
    path('', include(router.urls)),
]
