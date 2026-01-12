from django.db import models

class ConstructionProductivity(models.Model):
    project = models.ForeignKey(
        "cpe_module.Project",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="construction_productivities",
        verbose_name="프로젝트"
    )

    
    # --- 공종 분류 정보 ---
    main_category = models.CharField(max_length=100, verbose_name="구분") # 
    category = models.CharField(max_length=100, verbose_name="공종")      # 
    sub_category = models.CharField(max_length=100, verbose_name="세부공종", blank=True, null=True) # 
    item_name = models.CharField(max_length=255, verbose_name="목차", blank=True)     # 
    standard = models.CharField(max_length=255, verbose_name="규격", blank=True)       # 
    unit = models.CharField(max_length=50, verbose_name="단위")           # 

    # --- 1일 작업량 산출 근거 ---
    crew_composition_text = models.TextField(verbose_name="산출근거(작업조)") # 
    productivity_type = models.CharField(max_length=50, verbose_name="생산성 기준") # 

    # --- 투입 인력 및 장비 (품/수량 상세) ---
    # 기능공 1
    skill_worker_1_pum = models.FloatField(default=0.0, verbose_name="기능공1 품") # 
    skill_worker_1_count = models.FloatField(default=0.0, verbose_name="기능공1 인원") # 
    
    # 기능공 2
    skill_worker_2_pum = models.FloatField(default=0.0, verbose_name="기능공2 품") # 
    skill_worker_2_count = models.FloatField(default=0.0, verbose_name="기능공2 인원") # 
    
    # 특별인부
    special_worker_pum = models.FloatField(default=0.0, verbose_name="특별인부 품") # 
    special_worker_count = models.FloatField(default=0.0, verbose_name="특별인부 인원") # 
    
    # 보통인부
    common_worker_pum = models.FloatField(default=0.0, verbose_name="보통인부 품") # 
    common_worker_count = models.FloatField(default=0.0, verbose_name="보통인부 인원") # 
    
    # 장비
    equipment_pum = models.FloatField(default=0.0, verbose_name="장비 품") # 
    equipment_count = models.FloatField(default=0.0, verbose_name="장비 대수") # 

    # --- 1일 작업량 원본 데이터 ---
    pumsam_workload = models.FloatField(default=0.0, verbose_name="표준품셈") # 
    molit_workload = models.FloatField(default=0.0, verbose_name="국토부 가이드라인") # 

    @property
    def average_workload(self):
        """저장하지 않고 필요할 때 계산해서 사용하는 평균값"""
        if self.pumsam_workload and self.molit_workload:
            return (self.pumsam_workload + self.molit_workload) / 2
        return self.pumsam_workload or self.molit_workload

    class Meta:
        verbose_name = "표준 생산성 데이터"

    def __str__(self):
        return f"[{self.category}] {self.item_name}"