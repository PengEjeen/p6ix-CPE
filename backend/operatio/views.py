from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import WeatherStation


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_weather_stations(request):
    """
    지점(기상관측소) 목록 조회
    """
    stations = WeatherStation.objects.all().order_by('station_id')
    data = [
        {
            'station_id': station.station_id,
            'name': station.name
        }
        for station in stations
    ]
    return Response(data, status=status.HTTP_200_OK)
