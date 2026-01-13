from django.db import models

class CIPProductivityBasis(models.Model):
    project = models.ForeignKey(
        "cpe_module.Project",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="cip_productivity_bases",
        verbose_name="프로젝트"
    )
    
    # Basic Specs
    description = models.CharField(max_length=255, verbose_name="비고/설명")
    
    
    
    # --- INPUTS ---
    
    # t1: Preparation
    t1 = models.FloatField(default=3.0, verbose_name="준비시간(t1)", help_text="입력값 (분)")

    # t2: Drilling Inputs
    drill_diameter = models.FloatField(default=0.0, verbose_name="천공 직경(mm)", help_text="입력값")
    layer_depth_clay = models.FloatField(default=0.0, verbose_name="점질토 깊이", help_text="입력값 (m)")
    layer_depth_sand = models.FloatField(default=0.0, verbose_name="사질토 깊이", help_text="입력값 (m)")
    layer_depth_weathered = models.FloatField(default=0.0, verbose_name="풍화암 깊이", help_text="입력값 (m)")
    layer_depth_soft_rock = models.FloatField(default=0.0, verbose_name="연암 깊이", help_text="입력값 (m)")
    layer_depth_hard_rock = models.FloatField(default=0.0, verbose_name="경암 깊이", help_text="입력값 (m)")
    layer_depth_mixed = models.FloatField(default=0.0, verbose_name="혼합층 깊이", help_text="입력값 (m)")

    # t3: Rebar Inputs
    t3 = models.FloatField(default=2.0, verbose_name="철근망 및 H형강 건입(t3)", help_text="입력값 (분)")

    # t4: Concrete Inputs
    concrete_pouring_length = models.FloatField(default=0.0, verbose_name="콘크리트 타설 길이(m)", help_text="입력값 (m)")
    
    # Factor Inputs
    classification_factor = models.FloatField(default=0.8, verbose_name="작업계수(f)", help_text="입력값")


    # --- CALCULATED RESULTS ---
    
    # t2: Calculated Time
    total_depth = models.FloatField(default=0.0, verbose_name="굴착 깊이 합계(m)", help_text="계산값 (지층 깊이 합계)")
    t2 = models.FloatField(default=0.0, verbose_name="천공시간(t2)", help_text="계산값 (지층별 깊이 * 굴착속도)") 
    
    # t4: Calculated Time
    t4 = models.FloatField(default=0.0, verbose_name="콘크리트 타설 시간(t4)", help_text="계산값 (타설 길이 기반)")
    
    # Final Results
    cycle_time = models.FloatField(default=0.0, verbose_name="본당 소요시간(T)", help_text="계산값 (t1+t2+t3+t4)")
    daily_production_count = models.FloatField(default=0.0, verbose_name="일일 작업량(공)", help_text="계산값 (480*f/T)")
    calculation_formula = models.CharField(max_length=255, blank=True, verbose_name="계산식", help_text="참고용")
    
    # Link to main productivity item? 
    # Maybe 1 CIP Basis -> N ConstructionProductivity items? OR 1-to-1?
    # Usually used to justify ONE item like "CIP (Soil Type A)".
    
    class Meta:
        verbose_name = "CIP 생산성 근거"
        verbose_name_plural = "CIP 생산성 근거 목록"

    def __str__(self):
        return f"CIP 근거: {self.description} (D{self.drill_diameter})"

class CIPDrillingStandard(models.Model):
    """
    CIP 천공 속도/시간 기준표 (Reference Table)
    Stores standard drilling times (min/m?) per bit type and diameter.
    """
    BIT_TYPE_CHOICES = [
        ("AUGER", "오거비트"),
        ("IMPROVED", "개량형비트"),
        ("HAMMER", "해머비트"),
    ]

    bit_type = models.CharField(max_length=20, choices=BIT_TYPE_CHOICES, verbose_name="비트 타입")
    diameter_spec = models.CharField(max_length=50, verbose_name="말뚝직경 규격", help_text="예: 500미만, 500이상, 500~600")
    
    # Values per soil type (might be null if not applicable)
    value_clay = models.FloatField(null=True, blank=True, verbose_name="점질토")
    value_sand = models.FloatField(null=True, blank=True, verbose_name="사질토")
    value_weathered = models.FloatField(null=True, blank=True, verbose_name="풍화암")
    value_soft_rock = models.FloatField(null=True, blank=True, verbose_name="연암")
    value_hard_rock = models.FloatField(null=True, blank=True, verbose_name="경암")
    value_mixed = models.FloatField(null=True, blank=True, verbose_name="혼합층")

    class Meta:
        verbose_name = "CIP 천공 기준(표준품셈)"
        verbose_name_plural = "CIP 천공 기준 목록"

    def __str__(self):
        return f"[{self.get_bit_type_display()}] {self.diameter_spec}"
