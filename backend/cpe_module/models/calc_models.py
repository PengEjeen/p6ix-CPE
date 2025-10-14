#공기산정 유저 입력모델
from django.db import models
from django.conf import settings

#공사개요
##위치
##주변현황(학교, 주거지, 노후시설, 문화재, 택지개발)
class ConstructionOverview(models.Model): #이거 프로젝트 아님
    project = models.ForeignKey(
        "cpe_module.Project",
        on_delete=models.CASCADE,
        related_name="construction_overview",
    )

    # --- 기본 정보 (유형) ---
    client_type = models.CharField("발주처", max_length=50, choices=[
        ("민간공사", "민간공사"),
        ("공공공사", "공공공사"),
    ], default="민간공사")

    building_use = models.CharField("건물 용도", max_length=50, choices=[
        ("공동주택", "공동주택"),
        ("오피스텔", "오피스텔"),
        ("상업시설", "상업시설"),
        ("기타", "기타"),
    ], default="공동주택")

    construction_type = models.CharField("공사 형식", max_length=50, choices=[
        ("턴키", "턴키"),
        ("CM", "CM"),
        ("시공", "시공"),
        ("기타", "기타"),
    ], default="턴키")

    # --- Site 정보 ---
    location = models.CharField("위치", max_length=100, blank=True, null=True)
    site_area = models.DecimalField("대지면적(㎡)", max_digits=10, decimal_places=2, null=True, blank=True)

    # 대지현황
    adjacent_road = models.CharField("인접도로", max_length=100, blank=True, null=True)
    adjacent_side_count = models.PositiveIntegerField("도로 접한 면 수", default=0)
    elevation_max = models.DecimalField("최고 고저차(m)", max_digits=5, decimal_places=2, null=True, blank=True)
    elevation_min = models.DecimalField("최저 고저차(m)", max_digits=5, decimal_places=2, null=True, blank=True)

    nearby_env = models.CharField("주변현황", max_length=50, choices=[
        ("학교", "학교"),
        ("주거지", "주거지"),
        ("노후시설", "노후시설"),
        ("문화재", "문화재"),
        ("택지개발", "택지개발"),
    ], blank=True, null=True)

    # --- 건물 정보 ---
    basement_floors = models.PositiveIntegerField("지하층수", default=10)
    ground_floors = models.PositiveIntegerField("지상층수", default=10)
    total_units = models.PositiveIntegerField("세대수", default=0)
    total_buildings = models.PositiveIntegerField("동수", default=0)
    total_floor_area = models.DecimalField("연면적(㎡)", max_digits=12, decimal_places=2, default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"[{self.id}] {self.location or '무명 프로젝트'} ({self.building_use})"


#가동률
##주 몇일(7,6,5)??
##가동률(직접입력 선택 시)
class WorkCondition(models.Model):
    project = models.ForeignKey(
        "cpe_module.Project",
        on_delete=models.CASCADE,
        related_name="WorkCondition",
    )

    # --- 근무 조건 ---
    earthwork_type = models.CharField(
        "토공사 근무 조건",
        max_length=20,
        choices=[
            (7, 7),
            (6, 6),
            (5, 5),
        ],
        default=7,
    )
    framework_type = models.CharField(
        "골조공사 근무 조건",
        max_length=20,
        choices=[
            (7, 7),
            (6, 6),
            (5, 5),
        ],
        default=7,
    )

    # --- 가동률 (직접 입력값) ---
    earthwork_utilization_input = models.DecimalField(
        "직접 입력 가동률(토공사, %)",
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text="직접 입력한 토공사 가동률(%)"
    )
    framework_utilization_input = models.DecimalField(
        "직접 입력 가동률(골조공사, %)",
        max_digits=5,
        decimal_places=2,
        blank=True, null=True,
        help_text="직접 입력한 골조공사 가동률(%)"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "근무조건 및 가동률"
        verbose_name_plural = "근무조건 및 가동률 목록"

    def __str__(self):
        return f"{self.user.username} - {self.work_type} (가동률 {self.main_utilization_input}% / {self.sub_utilization_input}%)"


#준비/정리 기간 및 추가공사기간
##준비기간
##정리기간
class PreparationPeriod(models.Model):
    project = models.ForeignKey(
        "cpe_module.Project",
        on_delete=models.CASCADE,
        related_name="preparation_period",
    )

    # --- 준비기간 ---
    preparation_fixed_months = models.CharField(
        "준비기간(고정 개월)",
        max_length=50,
        default="0.5개월 고정"
    )

    preparation_input_days = models.PositiveIntegerField(
        "준비기간(직접 입력 일수)",
        null=True,
        blank=True,
        help_text="사용자 직접 입력 시 우선 적용"
    )

    # --- 정리기간 ---
    is_home = models.BooleanField(default=True) #주거 비주거 구분

    # 마감공사 --> 위 테이블에 합치도록 함.
    floors_under_months = models.PositiveIntegerField(
        "마감공사 (직접 입력 일수)",
        null=True,
        blank=True,
        help_text="사용자 직접 입력 시 우선 적용"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "준비/정리 기간 및 추가공사기간"
        verbose_name_plural = "준비/정리 기간 및 추가공사기간 목록"

    def __str__(self):
        return f"{self.user.username} - 준비 {self.preparation_fixed_days}일 / 정리 {self.cleanup_fixed_days}일"


#토공사
##지하 굴착 공법(순타, 역타)
##흙막이 공법(CIP, Slurry Wall, Sheet Pile, D-WALL, H-PILE+토류판)
class EarthworkInput(models.Model):
    project = models.ForeignKey(
        "cpe_module.Project",
        on_delete=models.CASCADE,
        related_name="earthwork_inputs",
    )

    # ------------------------------------------------------------------
    # 굴착공법
    # ------------------------------------------------------------------
    is_sunta = models.BooleanField(default=True)
    reverse_excavation_months = models.CharField(
        "역타 공법",
        max_length=50,
        choices=[
            ("Down-Up", "Down-Up"),
            ("Up-Up", "Up-Up"),
            ("Semi Top Down", "Semi Top Down"),
            ("D-WALL", "D-WALL"),
            ("Top-Down", "Top-Down"),
        ],
        default = "Top-Down"
    )
    # ------------------------------------------------------------------
    # 흙막이가시설
    # ------------------------------------------------------------------
    earth_retention_method = models.CharField(
        "흙막이 공법",
        max_length=50,
        choices=[
            ("CIP", "CIP"),
            ("Slurry Wall", "Slurry Wall"),
            ("Sheet Pile", "Sheet Pile"),
            ("D-WALL", "D-WALL"),
            ("H-PILE+토류판", "H-PILE+토류판"),
        ],
        default="CIP"
    )

    retention_perimeter_length = models.DecimalField("외곽 길이(m)", max_digits=8, decimal_places=2, default=100)
    drilling_depth = models.DecimalField("천공 심도(m)", max_digits=5, decimal_places=1, default=10)
    crew_count = models.PositiveIntegerField("투입 조(장비)", default=2)
    is_special_retention = models.BooleanField(default=True)
    special_retention_extra_days = models.PositiveIntegerField("특수 흙막이 추가 작업일수", null=True, blank=True)
    # ------------------------------------------------------------------
    # 지보공
    # ------------------------------------------------------------------
    support_method = models.CharField(
        "지보공 공법",
        max_length=50,
        choices=[
            ("레이커", "레이커"),
            ("어스앵커", "어스앵커"),
            ("스트럿", "스트럿"),
        ],
        default="어스앵커"
    )

    # ------------------------------------------------------------------
    # 토질 성상 / 토공량 비율
    # ------------------------------------------------------------------
    total_earth_volume = models.DecimalField("전체 토사량(㎥)", max_digits=10, decimal_places=1, default=10000)

    soil_ratio = models.DecimalField("토사 비율(%)", max_digits=5, decimal_places=2, default=50)
    weathered_ratio = models.DecimalField("풍화암 비율(%)", max_digits=5, decimal_places=2, default=25)
    soft_rock_ratio = models.DecimalField("연암 비율(%)", max_digits=5, decimal_places=2, default=15)
    hard_rock_ratio = models.DecimalField("경암 비율(%)", max_digits=5, decimal_places=2, default=10)

    # ------------------------------------------------------------------
    # 터파기 (토사 / 풍화암 / 연암 / 경암)
    # ------------------------------------------------------------------
    # 토사
    soil_excavation_method = models.CharField("토사 반출방법", max_length=20, default="직상차")
    soil_direct_ratio = models.DecimalField("직상차 비율(%)", max_digits=5, decimal_places=2, default=100)
    soil_cram_ratio = models.DecimalField("크람쉘 비율(%)", max_digits=5, decimal_places=2, default=0)
    soil_crew_actual = models.PositiveIntegerField("토사 실제 투입조", default=2)

    # 풍화암
    weathered_direct_ratio = models.DecimalField("풍화암 직상차 비율(%)", max_digits=5, decimal_places=2, default=50)
    weathered_cram_ratio = models.DecimalField("풍화암 크람쉘 비율(%)", max_digits=5, decimal_places=2, default=50)
    weathered_crew_actual = models.PositiveIntegerField("풍화암 실제 투입조", default=3)

    # 연암
    softrock_vibration_ratio = models.DecimalField("연암 미진동 비율(%)", max_digits=5, decimal_places=2, default=70)
    softrock_precision_ratio = models.DecimalField("연암 정밀제어 비율(%)", max_digits=5, decimal_places=2, default=15)
    softrock_small_ratio = models.DecimalField("연암 소규모 비율(%)", max_digits=5, decimal_places=2, default=10)
    softrock_medium_ratio = models.DecimalField("연암 중규모 비율(%)", max_digits=5, decimal_places=2, default=5)
    softrock_direct_ratio = models.DecimalField("연암 반출방법 직상차 비율(%)", max_digits=5, decimal_places=2, default=100)
    softrock_cram_ratio = models.DecimalField("연암 반출방법 크람쉘(%)", max_digits=5, decimal_places=2, default=0)
    softrock_crew_actual = models.PositiveIntegerField("연암 실제 투입조", default=1)

    # 경암
    hardrock_vibration_ratio = models.DecimalField("경암 미진동 비율(%)", max_digits=5, decimal_places=2, default=70)
    hardrock_precision_ratio = models.DecimalField("경암 정밀제어 비율(%)", max_digits=5, decimal_places=2, default=15)
    hardrock_small_ratio = models.DecimalField("경암 소규모 비율(%)", max_digits=5, decimal_places=2, default=10)
    hardrock_medium_ratio = models.DecimalField("경암 중규모 비율(%)", max_digits=5, decimal_places=2, default=5)
    hardrock_direct_ratio = models.DecimalField("경암 반출방법 직상차 비율(%)", max_digits=5, decimal_places=2, default=100)
    hardrock_cram_ratio = models.DecimalField("경암 반출방법 크람쉘(%)", max_digits=5, decimal_places=2, default=0)
    hardrock_crew_actual = models.PositiveIntegerField("경암 실제 투입조", default=1)

    # ------------------------------------------------------------------
    # 지정공사
    # ------------------------------------------------------------------
    designated_method = models.CharField(
        "지정 공법",
        max_length=50,
        choices=[
            ("RCD", "RCD"),
            ("PRD", "PRD"),
            ("PHC-Pile", "PHC-Pile"),
            ("지내력 기초", "지내력 기초")
        ],
        default="RCD"
    )
    designated_work_unit = models.PositiveIntegerField("공수", default=20)
    designated_drilling_depth = models.DecimalField("천공 심도(m)", max_digits=5, decimal_places=1, default=15.0)
    designated_diameter = models.DecimalField("RCD/PRD 직경(mm)", max_digits=6, decimal_places=1, default=1000.0)
    designated_crew = models.PositiveIntegerField("투입 조(장비)", default=1)

    # ------------------------------------------------------------------
    # 할증
    # ------------------------------------------------------------------
    is_surcharge = models.BooleanField(default=False)

    # ------------------------------------------------------------------
    # 병행률
    # ------------------------------------------------------------------
    parallel_retention = models.DecimalField("병행률 - 흙막이가시설(%)", max_digits=5, decimal_places=2, default=100)
    parallel_support = models.DecimalField("병행률 - 지보공(%)", max_digits=5, decimal_places=2, default=100)
    parallel_excavation = models.DecimalField("병행률 - 터파기(%)", max_digits=5, decimal_places=2, default=100)
    parallel_designated = models.DecimalField("병행률 - 지정공사(%)", max_digits=5, decimal_places=2, default=100)

    # ------------------------------------------------------------------
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "토공사 입력"
        verbose_name_plural = "토공사 입력 목록"

    def __str__(self):
        return f"{self.user.username} - 토공사 입력 ({self.excavation_method})"


#골조공사
class FrameWorkInput(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="framework_inputs",
        help_text="골조공사 입력 사용자"
    )

    # ------------------------------------------------------------------
    # 기초 골조
    # ------------------------------------------------------------------
    base_thickness = models.DecimalField(
        "기초 두께(m)",
        max_digits=4,
        decimal_places=2,
        default=1.2
    )
    base_working_day = models.PositiveIntegerField("기초골조 Working Day", default=11)
    base_calendar_day = models.PositiveIntegerField("기초골조 Calendar Day", default=17)

    # ------------------------------------------------------------------
    # 지하·지상 골조
    # ------------------------------------------------------------------
    is_TC = models.BooleanField(default=True)

    # Cycle Time
    cycle_time = models.PositiveIntegerField("Cycle Time (Calendar Day)", default=8)

    # 층고 (층별 입력 가능)
    floor_height_data = models.JSONField(
        "층고 입력 데이터",
        default=dict,
        help_text=(
            "예시: {"
            "'basement': ["
            "  {'floor': 10, 'height': 3.5, 'floor_sep': '전이층, 세팅층, 피난층, 필로티, 포디움, 스카이라운지, Cycle Time 택1'}, "
            "  {'floor': 9, 'height': 3.3, 'floor_sep': '전이층, 세팅층, 피난층, 필로티, 포디움, 스카이라운지, Cycle Time 택1'}"
            "], "
            "'ground': ["
            "  {'floor': 1F, 'height': 3.2, 'floor_sep': '전이층, 세팅층, 피난층, 필로티, 포디움, 스카이라운지, Cycle Time 택1'}, "
            "  {'floor': 2F, 'height': 3.1, 'floor_sep': '전이층, 세팅층, 피난층, 필로티, 포디움, 스카이라운지, Cycle Time 택1'}"
            "]}"
        )
    )
    
    # ------------------------------------------------------------------
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "골조공사 입력"
        verbose_name_plural = "골조공사 입력 목록"

    def __str__(self):
        return f"{self.user.username} - 골조공사 입력 ({self.base_thickness}m)"