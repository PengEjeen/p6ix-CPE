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
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="work_schedule_weights",
        help_text="소유 사용자"
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

    is_delete = models.BooleanField(default=False)

    class Meta:
        verbose_name = "공종별 주간 가중치"
        verbose_name_plural = "공종별 주간 가중치"
        constraints = [
            # 동일 사용자+공종 1행만 허용
            models.UniqueConstraint(fields=["user", "type"], name="uniq_user_type"),
            # DB 레벨 유효성 체크(0~100)
            models.CheckConstraint(check=models.Q(pct_7d__gte=0) & models.Q(pct_7d__lte=100), name="pct_7d_0_100"),
            models.CheckConstraint(check=models.Q(pct_6d__gte=0) & models.Q(pct_6d__lte=100), name="pct_6d_0_100"),
            models.CheckConstraint(check=models.Q(pct_5d__gte=0) & models.Q(pct_5d__lte=100), name="pct_5d_0_100"),
        ]
        indexes = [
            models.Index(fields=["user", "type"], name="idx_user_type"),
        ]

    def __str__(self):
        return f"{self.user} · {self.get_type_display()}"
