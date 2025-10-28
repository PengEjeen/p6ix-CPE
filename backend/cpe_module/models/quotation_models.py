from django.db import models

class Quotation(models.Model):
    # 프로젝트 기본 정보
    project = models.ForeignKey(
        'cpe_module.Project',
        db_column='project',
        on_delete=models.CASCADE,
        related_name='quotation_project',
    )

    # 기간 항목
    preparation_period = models.PositiveIntegerField("준비기간", default=0)

    # 토공사
    earth_retention = models.PositiveIntegerField("흙막이가시설", default=0)
    support = models.PositiveIntegerField("지보공", default=0)
    excavation = models.PositiveIntegerField("터파기", default=0)
    designated_work = models.PositiveIntegerField("지정공사", default=0)

    # 골조공사
    base_framework = models.PositiveIntegerField("기초골조", default=0)
    basement_framework = models.PositiveIntegerField("지하골조", default=0)
    ground_framework = models.PositiveIntegerField("지상골조", default=0)

    # 기타 공사
    finishing_work = models.PositiveIntegerField("마감공사", default=0)
    additional_period = models.PositiveIntegerField("추가기간", default=0)
    cleanup_period = models.PositiveIntegerField("정리기간", default=0)

    # 각 항목별 비고 (14개)
    remark_preparation = models.CharField("준비기간 비고", max_length=100, blank=True, null=True)
    remark_earth_retention = models.CharField("흙막이가시설 비고", max_length=100, blank=True, null=True)
    remark_support = models.CharField("지보공 비고", max_length=100, blank=True, null=True)
    remark_excavation = models.CharField("터파기 비고", max_length=100, blank=True, null=True)
    remark_designated_work = models.CharField("지정공사 비고", max_length=100, blank=True, null=True)
    remark_earthwork_total = models.CharField("토공사 소계 비고", max_length=100, blank=True, null=True)
    remark_base_framework = models.CharField("기초골조 비고", max_length=100, blank=True, null=True)
    remark_basement_framework = models.CharField("지하골조 비고", max_length=100, blank=True, null=True)
    remark_ground_framework = models.CharField("지상골조 비고", max_length=100, blank=True, null=True)
    remark_framework_total = models.CharField("골조공사 소계 비고", max_length=100, blank=True, null=True)
    remark_finishing_work = models.CharField("마감공사 비고", max_length=100, blank=True, null=True)
    remark_additional_period = models.CharField("추가기간 비고", max_length=100, blank=True, null=True)
    remark_cleanup_period = models.CharField("정리기간 비고", max_length=100, blank=True, null=True)
    remark_total = models.CharField("합계 비고", max_length=100, blank=True, null=True)

    # AI 답변 저장용
    ai_response = models.TextField("AI 분석 결과", blank=True, null=True)

    class Meta:
        verbose_name = "공사기간 견적서"
        verbose_name_plural = "공사기간 견적서 목록"

    def __str__(self):
        return f"Quotation for {self.project}"
