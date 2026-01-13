from django.db import models


class PileResult(models.Model):
    """
    기성말뚝 기초 생산성 근거 - 결과 요약 (프로젝트당 1개)
    """
    project = models.ForeignKey(
        "cpe_module.Project",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="pile_results",
        verbose_name="프로젝트"
    )
    
    # --- INPUT FIELDS ---
    diameter_selection = models.CharField(max_length=50, blank=True, null=True, verbose_name="직경 규격(선택)")
    
    # Layer Depths (User Inputs)
    layer_depth_clay = models.FloatField(default=0.0, verbose_name="점질토 깊이(m)")
    layer_depth_sand = models.FloatField(default=0.0, verbose_name="사질토 깊이(m)")
    layer_depth_weathered = models.FloatField(default=0.0, verbose_name="풍화암 깊이(m)")
    layer_depth_soft_rock = models.FloatField(default=0.0, verbose_name="연암 깊이(m)")
    layer_depth_hard_rock = models.FloatField(default=0.0, verbose_name="경암 깊이(m)")
    layer_depth_mixed = models.FloatField(default=0.0, verbose_name="혼합층 깊이(m)")
    
    # Pile Types (Auto-selected or Manual)
    pile_type_clay = models.CharField(max_length=20, blank=True, null=True, verbose_name="점질토 말뚝종류")
    pile_type_sand = models.CharField(max_length=20, blank=True, null=True, verbose_name="사질토 말뚝종류")
    pile_type_weathered = models.CharField(max_length=20, blank=True, null=True, verbose_name="풍화암 말뚝종류")
    pile_type_soft_rock = models.CharField(max_length=20, blank=True, null=True, verbose_name="연암 말뚝종류")
    pile_type_hard_rock = models.CharField(max_length=20, blank=True, null=True, verbose_name="경암 말뚝종류")
    pile_type_mixed = models.CharField(max_length=20, blank=True, null=True, verbose_name="혼합층 말뚝종류")
    
    # Time Inputs
    t1 = models.FloatField(default=5.0, verbose_name="준비시간(t1, 분)")
    t3 = models.FloatField(default=8.0, verbose_name="말뚝 근입/항타(t3, 분)")
    grouting_length = models.FloatField(default=0.0, verbose_name="그라우팅 길이(m)")
    t5 = models.FloatField(default=18.0, verbose_name="용접(t5, 분)")
    welding_diameter = models.FloatField(default=500.0, verbose_name="용접 직경(mm)")
    
    # Factor
    classification_factor = models.FloatField(default=0.85, verbose_name="작업계수(f)")

    # --- CALCULATED RESULTS ---
    total_depth = models.FloatField(default=0.0, verbose_name="합계 깊이(m)")
    t2 = models.FloatField(default=0.0, verbose_name="항타 시간(t2, 분)")
    t4 = models.FloatField(default=0.0, verbose_name="그라우팅(t4, 분)")
    cycle_time = models.FloatField(default=0.0, verbose_name="본당 작업시간(분)")
    daily_production_count = models.FloatField(default=0.0, verbose_name="일일 생산성(본)")
    
    class Meta:
        verbose_name = "기성말뚝 결과"
        verbose_name_plural = "기성말뚝 결과 목록"
    
    def __str__(self):
        return f"Pile Result: {self.project}"


class PileProductivityBasis(models.Model):
    """
    기성말뚝 기초 생산성 근거 - 상세내역 (프로젝트당 N개)
    """
    project = models.ForeignKey(
        "cpe_module.Project",
        on_delete=models.CASCADE,
        related_name="pile_productivity_basis",
        verbose_name="프로젝트",
        null=True,
        blank=True
    )
    
    description = models.CharField(max_length=255, blank=True, verbose_name="설명")
    
    # Pile Specs
    pile_diameter = models.FloatField(default=500.0, verbose_name="말뚝직경(mm)")
    
    # Layer Depths (Inputs)
    layer_depth_clay = models.FloatField(default=0.0, verbose_name="점질토 깊이(m)")
    layer_depth_sand = models.FloatField(default=0.0, verbose_name="사질토 깊이(m)")
    layer_depth_weathered = models.FloatField(default=0.0, verbose_name="풍화암 깊이(m)")
    layer_depth_soft_rock = models.FloatField(default=0.0, verbose_name="연암 깊이(m)")
    layer_depth_hard_rock = models.FloatField(default=0.0, verbose_name="경암 깊이(m)")
    layer_depth_mixed = models.FloatField(default=0.0, verbose_name="혼합층 깊이(m)")
    
    # Time Inputs
    t1 = models.FloatField(default=5.0, verbose_name="준비시간(t1, 분)")
    t3 = models.FloatField(default=8.0, verbose_name="말뚝 근입/항타(t3, 분)")
    grouting_length = models.FloatField(default=0.0, verbose_name="그라우팅 길이(m)")
    t5 = models.FloatField(default=18.0, verbose_name="용접(t5, 분)")
    welding_diameter = models.FloatField(default=500.0, verbose_name="용접 직경(mm)")
    
    # Factor
    classification_factor = models.FloatField(default=0.85, verbose_name="작업계수(f)")
    
    # Calculated Results
    total_depth = models.FloatField(default=0.0, verbose_name="굴착 깊이 합계(m)")
    t2 = models.FloatField(default=0.0, verbose_name="항타 시간(t2, 분)")
    t4 = models.FloatField(default=0.0, verbose_name="그라우팅(t4, 분)")
    cycle_time = models.FloatField(default=0.0, verbose_name="본당 소요시간(T, 분)")
    daily_production_count = models.FloatField(default=0.0, verbose_name="일일 작업량(본)")
    calculation_formula = models.CharField(max_length=255, blank=True, verbose_name="계산식")
    
    class Meta:
        verbose_name = "기성말뚝 생산성 근거"
        verbose_name_plural = "기성말뚝 생산성 근거 목록"
    
    def __str__(self):
        return f"Pile Basis: {self.description}"


class PileStandard(models.Model):
    """
    기성말뚝 시공 기준표
    """
    PILE_TYPE_CHOICES = [
        ("AUGER", "오거비트"),
        ("IMPROVED", "개량형비트"),
        ("HAMMER", "해머비트"),
    ]
    
    pile_type = models.CharField(max_length=20, choices=PILE_TYPE_CHOICES, verbose_name="말뚝 종류")
    diameter_spec = models.CharField(max_length=50, verbose_name="직경 규격")
    
    # Standard values for installation time per meter or per pile
    value_clay = models.FloatField(null=True, blank=True, verbose_name="점질토(분/m)")
    value_sand = models.FloatField(null=True, blank=True, verbose_name="사질토(분/m)")
    value_weathered = models.FloatField(null=True, blank=True, verbose_name="풍화암(분/m)")
    value_soft_rock = models.FloatField(null=True, blank=True, verbose_name="연암(분/m)")
    value_hard_rock = models.FloatField(null=True, blank=True, verbose_name="경암(분/m)")
    value_mixed = models.FloatField(null=True, blank=True, verbose_name="혼합층(분/m)")
    
    class Meta:
        verbose_name = "기성말뚝 기준"
        verbose_name_plural = "기성말뚝 기준 목록"
        unique_together = ('pile_type', 'diameter_spec')
    
    def __str__(self):
        return f"Pile Standard: {self.pile_type} - {self.diameter_spec}"
