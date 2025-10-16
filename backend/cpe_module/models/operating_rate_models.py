from django.conf import settings
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

class ConstructionType(models.TextChoices):
    EARTHWORK = "EARTH", "토공사"
    FRAME = "FRAME", "골조공사"
    EXTERIOR_FINISH = "EXT_FIN", "외부 마감공사"
    INTERIOR_FINISH = "INT_FIN", "내부 마감공사"
    FRAME_POURING = "POUR", "골조 타설"


class WorkScheduleWeight(models.Model):
    #프로젝트
    project = models.ForeignKey(
        'cpe_module.Project',
        db_column='project',
        on_delete=models.CASCADE,
        related_name='workscheduleweight_project',
    )

    type = models.CharField(
        max_length=16,
        choices=ConstructionType.choices,
        help_text="공종 타입"
    )
    pct_7d = models.DecimalField(
        "주7일(%)",
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        default=100,
        help_text="주7일 작업 시 적용 비율(%)"
    )
    pct_6d = models.DecimalField(
        "주6일(%)",
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        default=100,
        help_text="주6일 작업 시 적용 비율(%)"
    )
    pct_5d = models.DecimalField(
        "주5일(%)",
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        default=100,
        help_text="주5일 작업 시 적용 비율(%)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)