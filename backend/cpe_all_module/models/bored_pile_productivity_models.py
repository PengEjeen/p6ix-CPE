from django.db import models

class BoredPileResult(models.Model):
    project = models.ForeignKey(
        "cpe_module.Project",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="bored_pile_results",
        verbose_name="프로젝트"
    )
    
    # --- INPUT FIELDS ---
    method_selection = models.CharField(max_length=50, blank=True, null=True, verbose_name="공법 선택") # RCD, 요동식, 전회전식
    diameter_selection = models.CharField(max_length=50, blank=True, null=True, verbose_name="직경 규격(선택)")
    
    # Layer-specific methods
    method_clay = models.CharField(max_length=50, blank=True, null=True, verbose_name="점질토 공법")
    method_sand = models.CharField(max_length=50, blank=True, null=True, verbose_name="사질토 공법")
    method_gravel = models.CharField(max_length=50, blank=True, null=True, verbose_name="자갈 공법")
    method_weathered = models.CharField(max_length=50, blank=True, null=True, verbose_name="풍화암 공법")
    method_soft_rock = models.CharField(max_length=50, blank=True, null=True, verbose_name="연암 공법")
    method_hard_rock = models.CharField(max_length=50, blank=True, null=True, verbose_name="경암 공법")
    
    # Layer Depths (User Inputs)
    layer_depth_clay = models.FloatField(default=0.0, verbose_name="점질토 깊이(m)")
    layer_depth_sand = models.FloatField(default=0.0, verbose_name="사질토 깊이(m)")
    layer_depth_gravel = models.FloatField(default=0.0, verbose_name="자갈 깊이(m)")
    layer_depth_weathered = models.FloatField(default=0.0, verbose_name="풍화암 깊이(m)")
    layer_depth_soft_rock = models.FloatField(default=0.0, verbose_name="연암 깊이(m)")
    layer_depth_hard_rock = models.FloatField(default=0.0, verbose_name="경암 깊이(m)")
    
    # t1 Preparation
    t1 = models.FloatField(default=2.0, verbose_name="준비시간(t1, 시간)")
    
    # Factor
    classification_factor = models.FloatField(default=0.85, verbose_name="작업계수(f)")

    # --- CALCULATED RESULTS ---
    total_depth = models.FloatField(default=0.0, verbose_name="합계 깊이(m)")
    t2 = models.FloatField(default=0.0, verbose_name="천공 시간(t2, 시간)")
    cycle_time = models.FloatField(default=0.0, verbose_name="본당 작업시간(시간)")
    daily_production_count = models.FloatField(default=0.0, verbose_name="일일 생산성(본)")

    class Meta:
        verbose_name = "현장타설말뚝 결과 요약"
        verbose_name_plural = "현장타설말뚝 결과 요약 목록"


class BoredPileProductivityBasis(models.Model):
    project = models.ForeignKey(
        "cpe_module.Project",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="bored_pile_productivity_bases",
        verbose_name="프로젝트"
    )
    
    # Basic Specs
    description = models.CharField(max_length=255, verbose_name="비고/설명")
    
    # --- INPUTS ---
    
    # t1: Preparation
    t1 = models.FloatField(default=2.0, verbose_name="준비시간(t1)", help_text="입력값 (시간)")

    # t2: Drilling Inputs
    method = models.CharField(max_length=50, blank=True, null=True, verbose_name="굴착 공법")
    pile_diameter = models.FloatField(default=0.0, verbose_name="말뚝 직경(mm)", help_text="입력값")
    
    layer_depth_clay = models.FloatField(default=0.0, verbose_name="점질토 깊이", help_text="입력값 (m)")
    layer_depth_sand = models.FloatField(default=0.0, verbose_name="사질토 깊이", help_text="입력값 (m)")
    layer_depth_gravel = models.FloatField(default=0.0, verbose_name="자갈 깊이", help_text="입력값 (m)")
    layer_depth_weathered = models.FloatField(default=0.0, verbose_name="풍화암 깊이", help_text="입력값 (m)")
    layer_depth_soft_rock = models.FloatField(default=0.0, verbose_name="연암 깊이", help_text="입력값 (m)")
    layer_depth_hard_rock = models.FloatField(default=0.0, verbose_name="경암 깊이", help_text="입력값 (m)")
    
    # Factor Inputs
    classification_factor = models.FloatField(default=0.85, verbose_name="작업계수(f)", help_text="입력값")


    # --- CALCULATED RESULTS ---
    
    # t2: Calculated Time
    total_depth = models.FloatField(default=0.0, verbose_name="굴착 깊이 합계(m)", help_text="계산값")
    t2 = models.FloatField(default=0.0, verbose_name="천공시간(t2)", help_text="계산값 (시간)") 
    
    # Final Results
    cycle_time = models.FloatField(default=0.0, verbose_name="본당 소요시간(T)", help_text="계산값 (시간)")
    daily_production_count = models.FloatField(default=0.0, verbose_name="일일 작업량(본)", help_text="계산값 (8/T)")
    calculation_formula = models.CharField(max_length=255, blank=True, verbose_name="계산식", help_text="참고용")
    
    class Meta:
        verbose_name = "현장타설말뚝 생산성 근거"
        verbose_name_plural = "현장타설말뚝 생산성 근거 목록"


class BoredPileStandard(models.Model):
    """
    현장타설말뚝 천공 속도/시간 기준표 (Reference Table)
    Stores standard drilling times (hr/m) per method and diameter.
    """
    METHOD_CHOICES = [
        ("RCD", "R.C.D"),
        ("OSCILLATOR", "요동식"),
        ("ALL_CASING", "전회전식"),
    ]

    method = models.CharField(max_length=20, choices=METHOD_CHOICES, verbose_name="공법")
    diameter_spec = models.CharField(max_length=50, verbose_name="말뚝직경 규격", help_text="예: 1000, 1500, 2000, 2500, 3000")
    
    # Values per soil type (hr/m)
    value_clay = models.FloatField(null=True, blank=True, verbose_name="점질토")
    value_sand = models.FloatField(null=True, blank=True, verbose_name="사질토")
    value_gravel = models.FloatField(null=True, blank=True, verbose_name="자갈")
    value_weathered = models.FloatField(null=True, blank=True, verbose_name="풍화암")
    value_soft_rock = models.FloatField(null=True, blank=True, verbose_name="연암")
    value_hard_rock = models.FloatField(null=True, blank=True, verbose_name="경암")

    class Meta:
        verbose_name = "현장타설말뚝 천공 기준"
        verbose_name_plural = "현장타설말뚝 천공 기준 목록"

    def __str__(self):
        return f"[{self.get_method_display()}] {self.diameter_spec}"
