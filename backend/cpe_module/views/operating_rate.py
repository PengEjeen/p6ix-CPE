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

    def compute_year_stats(weight, year, station_id, work_week_days, winter_criteria="AVG"):
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
            if winter_criteria == "MIN":
                filter_kwargs = {"minTa__lte": weight.winter_threshold_value}
            elif winter_criteria == "MAX":
                filter_kwargs = {"maxTa__lte": weight.winter_threshold_value}
            else:
                filter_kwargs = {"avgTa__lte": weight.winter_threshold_value}

            climate_dates |= set(
                qs.filter(**filter_kwargs)
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

        # 기후불능일: 작업일과의 교집합
        climate_dates = climate_dates & workdays

        # 법정공휴일 조회 - 해당 연도에 데이터가 없으면 2025년 데이터 사용
        reference_year = year
        if weight.sector_type == "PRIVATE":
            holiday_qs = PublicHoliday.objects.filter(
                date__range=(year_start, year_end),
                is_private=True,
            )
            if not holiday_qs.exists():
                # 해당 연도에 데이터 없으면 2025년 데이터로 대체
                reference_year = 2025
                ref_start = date_cls(2025, 1, 1)
                ref_end = date_cls(2025, 12, 31)
                holiday_qs = PublicHoliday.objects.filter(
                    date__range=(ref_start, ref_end),
                    is_private=True,
                )
        else:
            holiday_qs = PublicHoliday.objects.filter(
                date__range=(year_start, year_end),
                is_holiday="Y",
            )
            if not holiday_qs.exists():
                reference_year = 2025
                ref_start = date_cls(2025, 1, 1)
                ref_end = date_cls(2025, 12, 31)
                holiday_qs = PublicHoliday.objects.filter(
                    date__range=(ref_start, ref_end),
                    is_holiday="Y",
                )
        
        # 법정공휴일 날짜 - reference_year의 요일을 기준으로 현재 연도 작업일과 매칭
        # 요일(월~일)만 비교하여 작업일에 해당하는지 판단
        all_holiday_dates = set(holiday_qs.values_list("date", flat=True))
        
        # 주간 휴일 계산 (주5일이면 토/일, 주6일이면 일요일만)
        all_days = {
            year_start + timedelta(days=offset)
            for offset in range((year_end - year_start).days + 1)
        }
        weekend_days = all_days - workdays  # 작업일이 아닌 날 = 주간 휴일
        
        # 법정공휴일 중 작업일(요일 기준)에 해당하는 것만 카운트
        # reference_year 데이터를 사용하는 경우 요일로 판단
        holidays_on_workdays_count = 0
        for hdate in all_holiday_dates:
            weekday = hdate.weekday()
            # 작업일 요일 범위에 해당하는지 확인
            if work_week_days >= 7:
                holidays_on_workdays_count += 1
            elif work_week_days == 6 and weekday <= 5:
                holidays_on_workdays_count += 1
            elif work_week_days == 5 and weekday <= 4:
                holidays_on_workdays_count += 1
        
        # 총 법정공휴일 = 주간 휴일(토/일) + 작업일 중 법정공휴일
        legal_holidays_count = len(weekend_days) + holidays_on_workdays_count

        # 실제 연도의 법정공휴일 날짜 (기후불능일 중복 제외용)
        # reference_year(법정공휴일 데이터 연도)가 calculation year(기상 데이터 연도)와 다를 경우
        # 법정공휴일의 날짜를 calculation year로 투영하여 중복 여부를 판단해야 함
        holiday_dates_on_workdays = set()
        
        if reference_year == year:
            holiday_dates_on_workdays = all_holiday_dates & workdays
        else:
            # 날짜 투영 (월/일 매핑)
            projected_holidays = set()
            for h_date in all_holiday_dates:
                try:
                    # 해당 연도로 날짜 변경
                    new_date = h_date.replace(year=year)
                    projected_holidays.add(new_date)
                except ValueError:
                    # 2월 29일 처리: 윤년이 아닌 해로 투영 시 에러 발생 -> 2월 28일로 매핑하거나 제외
                    # 여기서는 2월 28일로 매핑
                    if h_date.month == 2 and h_date.day == 29:
                        projected_holidays.add(date_cls(year, 2, 28))
            
            holiday_dates_on_workdays = projected_holidays & workdays

        # 중복 제외는 기후불능일에만 적용: 법정공휴일과 겹치는 날을 기후불능일에서 제외
        climate_dates_excl_holidays = climate_dates - holiday_dates_on_workdays

        # 작업일 = 365 - 기후불능일(중복제외) - 법정공휴일
        total_days = len(all_days)  # 365
        working_days = max(total_days - len(climate_dates_excl_holidays) - legal_holidays_count, 0)

        # 가동률 = 작업일 / 365 * 100
        operating_rate = round((working_days / total_days) * 100, 2) if total_days else 0
        
        # 공공 기준일 때 법정공휴일 최소 8일 보장
        if weight.sector_type == "PUBLIC" and legal_holidays_count < 8:
            legal_holidays_count = 8

        return {
            "working_days": working_days,
            "climate_days_excl_dup": len(climate_dates_excl_holidays),
            "legal_holidays": legal_holidays_count,
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
    
    # 기상 데이터가 충분한 연도 기준으로 계산 (과거 데이터 사용)
    # 기상 데이터는 과거에 충분, 법정공휴일 데이터는 미래에 있음
    end_year = today.year - 1  # 작년까지 (기상 데이터 완전한 연도)
    start_year = end_year - years + 1
    years_range = range(start_year, end_year + 1)

    if station_id:
        # settings에서 전달된 workWeekDays 우선 사용, 없으면 WorkCondition에서 조회
        work_week_days = settings.get("workWeekDays")
        if work_week_days is None:
            work_cond = WorkCondition.objects.filter(project__id=project_id).first()
            work_week_days = int(work_cond.earthwork_type) if work_cond and work_cond.earthwork_type else 6
            work_week_days = int(work_week_days)
            work_cond = None # Ensure variable exists for later use

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

            # 공종별 work_week_days 사용 (개별 설정 우선, 없으면 기본 6일)
            per_weight_work_week_days = weight.work_week_days or 6
            per_weight_winter_criteria = weight.winter_criteria or "AVG"

            stats = []
            for year in years_range:
                year_stats = compute_year_stats(weight, year, station_id, per_weight_work_week_days, per_weight_winter_criteria)
                if year_stats:
                    stats.append(year_stats)

            if not stats:
                continue

            # 기후불능일, 작업일, 가동률은 기상 데이터 연도 기준 평균
            avg_working = round(sum(s["working_days"] for s in stats) / len(stats))
            avg_climate = round(sum(s["climate_days_excl_dup"] for s in stats) / len(stats))
            avg_operating = round(sum(s["operating_rate"] for s in stats) / len(stats), 2)

            # 법정공휴일은 DB에 있는 연도(2025~2034) 기준으로 별도 평균 계산
            holiday_years = PublicHoliday.objects.values_list('date__year', flat=True).distinct()
            if holiday_years.exists():
                holiday_stats = []
                for h_year in sorted(set(holiday_years))[:years]:  # 최대 years개 연도
                    h_year_start = date_cls(h_year, 1, 1)
                    h_year_end = date_cls(h_year, 12, 31)
                    
                    # 해당 연도 작업일 계산
                    h_all_days = {
                        h_year_start + timedelta(days=offset)
                        for offset in range((h_year_end - h_year_start).days + 1)
                    }
                    if work_week_days >= 7:
                        h_workdays = h_all_days
                    elif work_week_days == 6:
                        h_workdays = {d for d in h_all_days if d.weekday() <= 5}
                    else:
                        h_workdays = {d for d in h_all_days if d.weekday() <= 4}
                    
                    h_weekend_days = h_all_days - h_workdays
                    
                    # 법정공휴일 조회
                    if weight.sector_type == "PRIVATE":
                        h_holiday_qs = PublicHoliday.objects.filter(
                            date__range=(h_year_start, h_year_end),
                            is_private=True,
                        )
                    else:
                        h_holiday_qs = PublicHoliday.objects.filter(
                            date__range=(h_year_start, h_year_end),
                            is_holiday="Y",
                        )
                    
                    h_all_holidays = set(h_holiday_qs.values_list("date", flat=True))
                    h_holidays_on_workdays = h_all_holidays & h_workdays
                    
                    # 총 법정공휴일 = 주간 휴일 + 작업일 중 법정공휴일
                    h_total = len(h_weekend_days) + len(h_holidays_on_workdays)
                    holiday_stats.append(h_total)
                
                if holiday_stats:
                    avg_holidays = round(sum(holiday_stats) / len(holiday_stats))
                else:
                    avg_holidays = 0
            else:
                avg_holidays = 0
            
            # 공공 기준일 때 법정공휴일 최소 8일 보장
            if weight.sector_type == "PUBLIC" and avg_holidays < 8:
                avg_holidays = 8

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
