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
    
    # data에서 main_category 추출
    data_categories = {
        item.get("main_category")
        for item in instance.data
        if item.get("main_category")
    }

    # 새로운 카테고리만 생성 (중복 안전)
    for category in data_categories:
        if not category:
            continue
        WorkScheduleWeight.objects.get_or_create(
            project=instance.project,
            main_category=category,
        )

    # 삭제된 대공종 정리
    WorkScheduleWeight.objects.filter(project=instance.project).exclude(
        main_category__in=data_categories
    ).delete()
