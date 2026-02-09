from django.db.models.signals import post_save
from django.dispatch import receiver
from cpe_all_module.models import ConstructionScheduleItem
from .models import WorkScheduleWeight


@receiver(post_save, sender=ConstructionScheduleItem)
def create_operating_rates_for_new_categories(sender, instance, **kwargs):
    """
    ConstructionScheduleItem이 저장될 때, 새로운 main_category가 있으면
    자동으로 WorkScheduleWeight 생성
    """
    if not instance.data:
        WorkScheduleWeight.objects.filter(project=instance.project).delete()
        return
    
    # data에서 main_category 추출 (list 또는 dict payload 모두 대응)
    raw_data = instance.data
    items = raw_data.get("items", []) if isinstance(raw_data, dict) else raw_data
    data_categories = {
        item.get("main_category")
        for item in items
        if isinstance(item, dict) and item.get("main_category")
    }

    # 새로운 카테고리만 생성 (중복 안전)
    for category in data_categories:
        if not category:
            continue
        WorkScheduleWeight.objects.get_or_create(
            project=instance.project,
            main_category=category,
            defaults={
                'winter_threshold': "평균 -5℃ 이하",
                'winter_threshold_value': -5,
                'winter_threshold_enabled': True,
                'summer_threshold': "35℃ 이상",
                'summer_threshold_value': 35,
                'summer_threshold_enabled': True,
                'rainfall_threshold': "10mm 이상",
                'rainfall_threshold_value': 10,
                'rainfall_threshold_enabled': True,
                'snowfall_threshold': "1cm 이상",
                'snowfall_threshold_value': 1,
                'snowfall_threshold_enabled': True,
                'wind_threshold': "15m/s 이상",
                'visibility_threshold': "미적용",
                'dust_alert_level': "ALERT",
                'sector_type': "PRIVATE",
                'work_week_days': 6,
                'winter_criteria': "AVG",
            }
        )

    
    # 3. 계산 로직 호출 (생성된 weights에 대해)
    # create_operating_rates_for_new_categories는 instance.save() 시점에 호출되므로
    # 아직 DB에 반영되지 않은 상태일 수 있음 -> post_save이므로 안전
    from .views.operating_rate import calculate_operating_rates
    
    # 새로 생성된 weights 조회
    new_weights = WorkScheduleWeight.objects.filter(
        project=instance.project,
        main_category__in=data_categories
    )
    
    # 기본 설정 (OperatingRate.jsx의 defaults와 동일하게 맞춤)
    default_settings = {
        "region": "서울", 
        "dataYears": 10,
        "workWeekDays": 6
    }
    
    calculate_operating_rates(instance.project.id, new_weights, default_settings)

