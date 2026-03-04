from django.db.models.signals import post_save
from django.dispatch import receiver
from cpe_all_module.models import ConstructionScheduleItem
from .models import WorkScheduleWeight
from .utils.operating_rate_defaults import (
    PROCESS_KEY_DELIMITER,
    build_operating_rate_defaults,
    resolve_operating_rate_preset_code,
)


@receiver(post_save, sender=ConstructionScheduleItem)
def create_operating_rates_for_new_categories(sender, instance, **kwargs):
    """
    ConstructionScheduleItem이 저장될 때, 새로운 main_category가 있으면
    자동으로 WorkScheduleWeight 생성
    """
    if not instance.data:
        WorkScheduleWeight.objects.filter(project=instance.project).delete()
        return
    
    # data에서 main_category 및 process 키 추출 (list 또는 dict payload 모두 대응)
    raw_data = instance.data
    items = raw_data.get("items", []) if isinstance(raw_data, dict) else raw_data
    data_categories = set()
    for item in items:
        if not isinstance(item, dict):
            continue

        main_category = item.get("main_category")
        process = item.get("process")
        if not main_category:
            continue

        data_categories.add(main_category)

        # process 별 프리셋이 정의된 경우 main|||process 키를 따로 생성
        if process:
            process_key = f"{main_category}{PROCESS_KEY_DELIMITER}{process}"
            if resolve_operating_rate_preset_code(process_key):
                data_categories.add(process_key)

    # 새로운 카테고리만 생성 (중복 안전)
    for category in data_categories:
        if not category:
            continue
        WorkScheduleWeight.objects.get_or_create(
            project=instance.project,
            main_category=category,
            defaults=build_operating_rate_defaults(category)
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
