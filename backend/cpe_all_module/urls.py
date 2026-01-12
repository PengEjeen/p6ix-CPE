from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ConstructionProductivityViewSet

router = DefaultRouter()
router.register(r'productivity', ConstructionProductivityViewSet, basename='productivity')

urlpatterns = [
    path('productivity/project/<str:project_id>/', ConstructionProductivityViewSet.as_view({'get': 'list'}), name='productivity-project-list'),
    path('', include(router.urls)),
]
