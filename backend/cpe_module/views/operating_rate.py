from datetime import date as date_cls
from datetime import timedelta

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404

from ..models.operating_rate_models import WorkScheduleWeight
from ..models.calc_models import WorkCondition
from ..serializers.operating_rate_serializers import WorkScheduleWeightSerializer
from operatio.models import WeatherDailyRecord, WeatherStation, PublicHoliday


# 목록 조회 (로그인 유저 기준)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_work_schedule_weights(request):
    weights = WorkScheduleWeight.objects.filter(project__user=request.user)
    serializer = WorkScheduleWeightSerializer(
        weights, many=True, context={"request": request}
    )
    return Response({"results": serializer.data})


# 단일 조회 (project_id 기준) - main_category 기반
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def detail_work_schedule_weight(request, project_id):
    if not project_id:
        return Response({"error": "project_id parameter is required"}, status=400)

    # main_category 기반으로 여러 개 조회
    weights = WorkScheduleWeight.objects.filter(
        project__id=project_id,
        project__user=request.user
    ).order_by('main_category')

    # 데이터가 없어도 빈 배열 반환 (404 대신)
    serializer = WorkScheduleWeightSerializer(weights, many=True, context={"request": request})
    return Response(serializer.data)


# 생성
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_work_schedule_weight(request, project_id):
    serializer = WorkScheduleWeightSerializer(
        data=request.data,
        context={"request": request, "project_id": project_id}
    )

    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# 수정 - main_category 기반으로 변경
@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_work_schedule_weight(request, project_id):
    payload = request.data
    settings = {}

    if isinstance(payload, dict) and "weights" in payload:
        weights_data = payload.get("weights") or []
        settings = payload.get("settings") or {}
    else:
        weights_data = payload

    # 유효성 검사: 리스트인지 확인
    if not isinstance(weights_data, list):
        return Response({"error": "리스트 형태의 데이터가 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)

    updated_items = []
    project = None

    def parse_years(value):
        if value is None:
            return 10
        text = str(value)
        digits = "".join([c for c in text if c.isdigit()])
        return int(digits) if digits else 10

    def resolve_station_id():
        region = settings.get("region")
        station_id = settings.get("station_id")
        if station_id:
            return int(station_id)
        if region:
            station = WeatherStation.objects.filter(name=region).first()
            if station:
                return station.station_id
        station = WeatherStation.objects.first()
        return station.station_id if station else None

    def is_workday(day, work_week_days):
        weekday = day.weekday()  # 0=Mon, 6=Sun
        if work_week_days >= 7:
            return True
        if work_week_days == 6:
            return weekday <= 5
        return weekday <= 4

    def year_range(year):
        return date_cls(year, 1, 1), date_cls(year, 12, 31)

    def compute_year_stats(weight, year, station_id, work_week_days):
        year_start, year_end = year_range(year)
        workdays = {
            year_start + timedelta(days=offset)
            for offset in range((year_end - year_start).days + 1)
            if is_workday(year_start + timedelta(days=offset), work_week_days)
        }
        if not workdays:
            return None

        qs = WeatherDailyRecord.objects.filter(
            station_id=station_id,
            date__range=(year_start, year_end),
        )
        if not qs.exists():
            return None

        climate_dates = set()

        if weight.winter_threshold_enabled and weight.winter_threshold_value is not None:
            climate_dates |= set(
                qs.filter(minTa__lte=weight.winter_threshold_value)
                .values_list("date", flat=True)
            )
        if weight.summer_threshold_enabled and weight.summer_threshold_value is not None:
            climate_dates |= set(
                qs.filter(maxTa__gte=weight.summer_threshold_value)
                .values_list("date", flat=True)
            )
        if weight.rainfall_threshold_enabled and weight.rainfall_threshold_value is not None:
            climate_dates |= set(
                qs.filter(sumRn__gte=weight.rainfall_threshold_value)
                .values_list("date", flat=True)
            )
        if weight.snowfall_threshold_enabled and weight.snowfall_threshold_value is not None:
            climate_dates |= set(
                qs.filter(ddMes__gte=weight.snowfall_threshold_value)
                .values_list("date", flat=True)
            )

        climate_dates = climate_dates & workdays

        if weight.sector_type == "PRIVATE":
            holiday_qs = PublicHoliday.objects.filter(
                date__range=(year_start, year_end),
                is_private=True,
            )
        else:
            holiday_qs = PublicHoliday.objects.filter(
                date__range=(year_start, year_end),
                is_holiday="Y",
            )
        holiday_dates = set(holiday_qs.values_list("date", flat=True)) & workdays

        non_work_dates = climate_dates | holiday_dates
        base_workdays = len(workdays)
        working_days = max(base_workdays - len(non_work_dates), 0)

        operating_rate = round((working_days / base_workdays) * 100, 2) if base_workdays else 0

        return {
            "working_days": working_days,
            "climate_days_excl_dup": len(climate_dates),
            "legal_holidays": len(holiday_dates),
            "operating_rate": operating_rate,
        }

    for item in weights_data:
        main_category = item.get("main_category")
        item_id = item.get("id")
        
        if not main_category and not item_id:
            continue  # main_category나 id가 없으면 스킵

        # ID가 있으면 ID로 찾고, 없으면 main_category로 찾기
        try:
            if item_id:
                weight = WorkScheduleWeight.objects.get(
                    id=item_id,
                    project__id=project_id,
                    project__user=request.user
                )
            else:
                weight = WorkScheduleWeight.objects.get(
                    project__id=project_id,
                    project__user=request.user,
                    main_category=main_category
                )
        except WorkScheduleWeight.DoesNotExist:
            # 없으면 생성
            serializer = WorkScheduleWeightSerializer(
                data=item,
                context={"request": request, "project_id": project_id}
            )
            if serializer.is_valid():
                serializer.save()
                updated_items.append(serializer.data)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            continue

        # 업데이트
        serializer = WorkScheduleWeightSerializer(
            weight,
            data=item,
            partial=True,
            context={"request": request, "project_id": project_id}
        )

        if serializer.is_valid():
            weight = serializer.save()
            updated_items.append(serializer.data)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # 계산된 값 갱신
    if updated_items:
        project = updated_items[0].get("project") or project
    station_id = resolve_station_id()
    years = parse_years(settings.get("dataYears"))
    today = date_cls.today()
    end_year = today.year - 1
    start_year = end_year - years + 1
    years_range = range(start_year, end_year + 1)

    if station_id:
        work_cond = WorkCondition.objects.filter(project__id=project_id).first()
        work_week_days = int(work_cond.earthwork_type) if work_cond and work_cond.earthwork_type else 6

        for item in updated_items:
            weight_id = item.get("id")
            if not weight_id:
                continue
            weight = WorkScheduleWeight.objects.filter(
                id=weight_id,
                project__id=project_id,
                project__user=request.user,
            ).first()
            if not weight:
                continue

            stats = []
            for year in years_range:
                year_stats = compute_year_stats(weight, year, station_id, work_week_days)
                if year_stats:
                    stats.append(year_stats)

            if not stats:
                continue

            avg_working = round(sum(s["working_days"] for s in stats) / len(stats))
            avg_climate = round(sum(s["climate_days_excl_dup"] for s in stats) / len(stats))
            avg_holidays = round(sum(s["legal_holidays"] for s in stats) / len(stats))
            avg_operating = round(sum(s["operating_rate"] for s in stats) / len(stats), 2)

            weight.working_days = avg_working
            weight.climate_days_excl_dup = avg_climate
            weight.legal_holidays = avg_holidays
            weight.operating_rate = avg_operating
            weight.save(update_fields=[
                "working_days",
                "climate_days_excl_dup",
                "legal_holidays",
                "operating_rate",
                "updated_at",
            ])

    serializer = WorkScheduleWeightSerializer(
        WorkScheduleWeight.objects.filter(
            project__id=project_id,
            project__user=request.user
        ).order_by("main_category"),
        many=True,
        context={"request": request}
    )
    return Response(serializer.data, status=status.HTTP_200_OK)
