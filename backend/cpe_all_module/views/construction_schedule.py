from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from ..models.construction_schedule_models import ConstructionScheduleItem
from ..serializers.construction_schedule_serializers import ConstructionScheduleItemSerializer

class ConstructionScheduleItemViewSet(viewsets.ModelViewSet):
    queryset = ConstructionScheduleItem.objects.all()
    serializer_class = ConstructionScheduleItemSerializer
    pagination_class = None

    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        project_id = self.request.query_params.get('project_id')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset
        
    def update(self, request, *args, **kwargs):
        # Log update request for debugging
        print("Update Request Data keys:", request.data.keys())
        if 'data' in request.data:
            print("Items count:", len(request.data['data']))
        return super().update(request, *args, **kwargs)

    @action(detail=False, methods=['post'])
    def initialize_default(self, request):
        project_id = request.data.get('project_id')
        if not project_id:
            return Response({"error": "project_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Cleanup legacy multiple rows if they exist
        existing = ConstructionScheduleItem.objects.filter(project_id=project_id)
        if existing.count() > 1:
            existing.delete()
        
        # Get or Create Single Container
        container, created = ConstructionScheduleItem.objects.get_or_create(project_id=project_id)
        
        # If it exists but has no data, or we just created it -> Populate Defaults
        if not container.data:
            from cpe_all_module.initial_data import get_default_schedule_data
            container.data = get_default_schedule_data()
            container.save()
            return Response({"message": "Initialized default items"}, status=status.HTTP_201_CREATED)
            
        return Response({"message": "Already initialized"}, status=status.HTTP_200_OK)
