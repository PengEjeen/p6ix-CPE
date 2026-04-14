from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import WeatherStation, PublicHoliday


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_holidays(request):
    """
    날짜 범위 내 공휴일 날짜 목록 조회 (가동률 산정 기준과 동일)

    Query params:
      start       YYYY-MM-DD  (필수)
      end         YYYY-MM-DD  (필수)
      sector_type PUBLIC | PRIVATE  (기본 PUBLIC)
                  PUBLIC  → is_holiday='Y' 전체
                  PRIVATE → is_private=True 만
    """
    start = request.query_params.get('start')
    end = request.query_params.get('end')
    sector_type = request.query_params.get('sector_type', 'PUBLIC').upper()

    if not start or not end:
        return Response({"error": "start, end 파라미터가 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)

    if sector_type == 'PRIVATE':
        qs = PublicHoliday.objects.filter(
            date__range=(start, end),
            is_private=True,
        )
    else:
        qs = PublicHoliday.objects.filter(
            date__range=(start, end),
            is_holiday='Y',
        )

    dates = list(qs.values_list('date', flat=True).distinct().order_by('date'))
    return Response([d.isoformat() for d in dates], status=status.HTTP_200_OK)


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
