from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ConstructionProductivityViewSet, CIPProductivityBasisViewSet, CIPDrillingStandardViewSet, CIPResultViewSet

router = DefaultRouter()
router.register(r'productivity', ConstructionProductivityViewSet, basename='productivity')
router.register(r'cip-basis', CIPProductivityBasisViewSet, basename='cip-basis')
router.register(r'cip-result', CIPResultViewSet, basename='cip-result')
router.register(r'cip-standard', CIPDrillingStandardViewSet, basename='cip-standard')

urlpatterns = [
    path('productivity/project/<str:project_id>/', ConstructionProductivityViewSet.as_view({'get': 'list'}), name='productivity-project-list'),
    path('', include(router.urls)),
]
