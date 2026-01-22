from django.conf import settings
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class ConstructionType(models.TextChoices):
    """Deprecated - keeping for migration compatibility"""
    EARTHWORK = "EARTH", "토공사"
    FRAME = "FRAME", "골조공사"
    EXTERIOR_FINISH = "EXT_FIN", "외부 마감공사"
    INTERIOR_FINISH = "INT_FIN", "내부 마감공사"
    FRAME_POURING = "POUR", "골조 타설"


class WorkScheduleWeight(models.Model):
    """
    가동률 데이터 - 대공종별로 저장
    """
    # 프로젝트
    project = models.ForeignKey(
        'cpe_module.Project',
        db_column='project',
        on_delete=models.CASCADE,
        related_name='workscheduleweight_project',
    )

    # 대공종 (ConstructionScheduleItem의 main_category와 일치)
    main_category = models.CharField(
        max_length=100,
        verbose_name="대공종",
        help_text="e.g., '1. 공사준비', '2. 토공사', '3. 골조공사'"
    )

    # ===== 기후불능일 조건 (6가지) =====
    winter_threshold = models.CharField(
        max_length=50,
        default="최저 5℃ 이하",
        verbose_name="동절기",
        blank=True
    )
    # 동절기 기준값 (n 이하, ℃)
    winter_threshold_value = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="동절기 기준값(℃)"
    )
    winter_threshold_enabled = models.BooleanField(
        default=True,
        verbose_name="동절기 적용여부"
    )
    summer_threshold = models.CharField(
        max_length=50,
        default="35℃ 이상",
        verbose_name="혹서기",
        blank=True
    )
    # 혹서기 기준값 (n 이상, ℃)
    summer_threshold_value = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="혹서기 기준값(℃)"
    )
    summer_threshold_enabled = models.BooleanField(
        default=True,
        verbose_name="혹서기 적용여부"
    )
    rainfall_threshold = models.CharField(
        max_length=50,
        default="10mm 이상",
        verbose_name="강우량",
        blank=True
    )
    # 강우량 기준값 (n 이상, mm)
    rainfall_threshold_value = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="강우량 기준값(mm)"
    )
    rainfall_threshold_enabled = models.BooleanField(
        default=True,
        verbose_name="강우량 적용여부"
    )
    snowfall_threshold = models.CharField(
        max_length=50,
        default="0.3 이상",
        verbose_name="강설량",
        blank=True
    )
    # 강설량 기준값 (n 이상, cm)
    snowfall_threshold_value = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="강설량 기준값(cm)"
    )
    snowfall_threshold_enabled = models.BooleanField(
        default=True,
        verbose_name="강설량 적용여부"
    )
    wind_threshold = models.CharField(
        max_length=50,
        default="15m/s 이상",
        verbose_name="순간대풍속",
        blank=True
    )
    visibility_threshold = models.CharField(
        max_length=50,
        default="미적용",
        verbose_name="비시정",
        blank=True
    )

    # 미세먼지 경보 기준 (경보/주의/미적용)
    DUST_CHOICES = [
        ("ALERT", "경보"),
        ("WARNING", "주의"),
        ("NONE", "미적용"),
    ]
    dust_alert_level = models.CharField(
        max_length=10,
        choices=DUST_CHOICES,
        default="NONE",
        verbose_name="미세먼지 기준"
    )

    # 공공/민간 구분 (공공/민간)
    SECTOR_CHOICES = [
        ("PUBLIC", "공공"),
        ("PRIVATE", "민간"),
    ]
    sector_type = models.CharField(
        max_length=10,
        choices=SECTOR_CHOICES,
        default="PRIVATE",
        verbose_name="공공/민간"
    )

    # ===== 계산 결과 (유저 입력 또는 자동 계산) =====
    working_days = models.IntegerField(
        default=0,
        verbose_name="작업일",
        help_text="연간 작업 가능일수"
    )
    climate_days_excl_dup = models.IntegerField(
        default=0,
        verbose_name="기후불능일(중복제외)",
        help_text="기후 조건으로 작업 불가능한 일수 (중복 제외)"
    )
    legal_holidays = models.IntegerField(
        default=0,
        verbose_name="법정공휴일",
        help_text="공공/민간 구분에 따른 법정공휴일 수"
    )
    operating_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name="가동률(%)",
        help_text="최종 가동률 (계산 또는 입력)"
    )

    # ===== Deprecated fields - keeping for migration =====
    type = models.CharField(
        max_length=16,
        blank=True,
        null=True,
        help_text="[DEPRECATED] Use main_category instead"
    )
    pct_7d = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="[DEPRECATED]"
    )
    pct_6d = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="[DEPRECATED]"
    )
    pct_5d = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="[DEPRECATED]"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "가동률"
        verbose_name_plural = "가동률 목록"
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'main_category'],
                name='unique_project_main_category_operating_rate'
            )
        ]
        ordering = ['project', 'main_category']

    def __str__(self):
        return f"{self.project} - {self.main_category} ({self.operating_rate}%)"
