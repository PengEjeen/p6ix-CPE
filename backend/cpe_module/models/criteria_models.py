from django.db import models


# 준비·정리·가설·마감공사
class PreparationWork(models.Model):
    project = models.ForeignKey(
        "cpe_module.Project",
        on_delete=models.CASCADE,
        related_name="preparation_works",
    )

    # 정리기간
    residential_days = models.PositiveIntegerField("주거시설 소요일(일)", default=45)
    non_residential_days = models.PositiveIntegerField("비주거시설 소요일(일)", default=30)

    # 세대수별 추가기간
    units_under_2000 = models.DecimalField("2000세대 이하 추가(개월)", max_digits=5, decimal_places=2, default=0)
    units_2000_3000 = models.DecimalField("2000~3000세대 추가(개월)", max_digits=5, decimal_places=2, default=1)
    units_over_3000 = models.DecimalField("3000세대 이상 추가(개월)", max_digits=5, decimal_places=2, default=2)

    # 마감공사기간
    floors_under_10 = models.DecimalField("10F 이하(개월)", max_digits=5, decimal_places=2, default=5.5)
    floors_under_15 = models.DecimalField("15F 이하(개월)", max_digits=5, decimal_places=2, default=6.6)
    floors_under_20 = models.DecimalField("20F 이하(개월)", max_digits=5, decimal_places=2, default=7.7)
    floors_under_30 = models.DecimalField("30F 이하(개월)", max_digits=5, decimal_places=2, default=8.8)
    floors_under_45 = models.DecimalField("45F 이하(개월)", max_digits=5, decimal_places=2, default=9.9)
    floors_over_46 = models.DecimalField("46F 이상(개월)", max_digits=5, decimal_places=2, default=11.0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.project.name} - 준비/정리공사"


# 토공사
class Earthwork(models.Model):
    project = models.ForeignKey(
        "cpe_module.Project",
        on_delete=models.CASCADE,
        related_name="earthworks",
    )

    # 흙막이 지보공
    support_earth_anchor = models.PositiveIntegerField("어스앵커(소요일)", default=25)
    support_raker = models.PositiveIntegerField("레이커(소요일)", default=25)
    support_strut = models.PositiveIntegerField("스트럿(소요일)", default=30)

    # 흙막이 공법별 생산량 (㎡/일)
    production_cip = models.DecimalField("CIP", max_digits=6, decimal_places=1, default=81.4)
    production_slurry = models.DecimalField("Slurry Wall", max_digits=6, decimal_places=1, default=55.0)
    production_sheet = models.DecimalField("Sheet Pile", max_digits=6, decimal_places=1, default=150.0)
    production_dwall = models.DecimalField("D-WALL", max_digits=6, decimal_places=1, default=60.0)
    production_hpile = models.DecimalField("H-PILE+토류판", max_digits=6, decimal_places=1, default=81.4)

    # 토사별 CIP공법 생산량
    cip_soil = models.DecimalField("CIP-토사(m/일)", max_digits=6, decimal_places=1, default=100.0)
    cip_weathered = models.DecimalField("CIP-풍화암(m/일)", max_digits=6, decimal_places=1, default=80.0)
    cip_soft_rock = models.DecimalField("CIP-연암(m/일)", max_digits=6, decimal_places=1, default=60.0)
    cip_hard_rock = models.DecimalField("CIP-경암(m/일)", max_digits=6, decimal_places=1, default=60.0)

    # 토사별 H-Pile+토류판 생산량
    hpile_soil = models.DecimalField("H-Pile-토사(m/일)", max_digits=6, decimal_places=1, default=100.0)
    hpile_weathered = models.DecimalField("H-Pile-풍화암(m/일)", max_digits=6, decimal_places=1, default=80.0)
    hpile_soft_rock = models.DecimalField("H-Pile-연암(m/일)", max_digits=6, decimal_places=1, default=60.0)
    hpile_hard_rock = models.DecimalField("H-Pile-경암(m/일)", max_digits=6, decimal_places=1, default=60.0)

    # 할증 (%)
    surcharge_school = models.DecimalField("학교 주변 할증(%)", max_digits=4, decimal_places=1, default=0.0)
    surcharge_residential = models.DecimalField("주거지 주변 할증(%)", max_digits=4, decimal_places=1, default=0.0)
    surcharge_old_facility = models.DecimalField("노후시설 주변 할증(%)", max_digits=4, decimal_places=1, default=0.0)
    surcharge_cultural = models.DecimalField("문화재 주변 할증(%)", max_digits=4, decimal_places=1, default=0.0)
    surcharge_development = models.DecimalField("택지개발 주변 할증(%)", max_digits=4, decimal_places=1, default=0.0)

    # 터파기
    excavation_soil = models.DecimalField("토사 생산량(㎥/일)", max_digits=6, decimal_places=0, default=600)
    excavation_weathered = models.DecimalField("풍화암 생산량(㎥/일)", max_digits=6, decimal_places=0, default=420)

    # 반출방법
    haul_direct = models.DecimalField("직상차", max_digits=3, decimal_places=1, default=1.0)
    haul_cram = models.DecimalField("크람쉘", max_digits=3, decimal_places=1, default=1.5)

    # 연암 발파공법별 반출량
    blasting_soft_vibrationless = models.DecimalField("연암-미진동(㎥/일)", max_digits=6, decimal_places=0, default=120)
    blasting_soft_precision = models.DecimalField("연암-정밀제어(㎥/일)", max_digits=6, decimal_places=0, default=160)
    blasting_soft_small = models.DecimalField("연암-소규모(㎥/일)", max_digits=6, decimal_places=0, default=300)
    blasting_soft_medium = models.DecimalField("연암-중규모(㎥/일)", max_digits=6, decimal_places=0, default=450)

    # 경암 발파공법별 반출량
    blasting_hard_vibrationless = models.DecimalField("경암-미진동(㎥/일)", max_digits=6, decimal_places=0, default=60)
    blasting_hard_precision = models.DecimalField("경암-정밀제어(㎥/일)", max_digits=6, decimal_places=0, default=100)
    blasting_hard_small = models.DecimalField("경암-소규모(㎥/일)", max_digits=6, decimal_places=0, default=200)
    blasting_hard_medium = models.DecimalField("경암-중규모(㎥/일)", max_digits=6, decimal_places=0, default=350)

    # RCD / PRD 생산량
    rcd_1500 = models.DecimalField("RCD-1500mm", max_digits=6, decimal_places=0, default=10)
    rcd_1800 = models.DecimalField("RCD-1800mm", max_digits=6, decimal_places=0, default=20)
    rcd_2000 = models.DecimalField("RCD-2000mm", max_digits=6, decimal_places=0, default=30)
    rcd_2500 = models.DecimalField("RCD-2500mm", max_digits=6, decimal_places=0, default=40)
    rcd_3000 = models.DecimalField("RCD-3000mm", max_digits=6, decimal_places=0, default=50)

    prd_600 = models.DecimalField("PRD-600mm", max_digits=6, decimal_places=0, default=10)
    prd_750 = models.DecimalField("PRD-750mm", max_digits=6, decimal_places=0, default=20)
    prd_900 = models.DecimalField("PRD-900mm", max_digits=6, decimal_places=0, default=30)
    prd_1000 = models.DecimalField("PRD-1000mm", max_digits=6, decimal_places=0, default=40)
    prd_1500 = models.DecimalField("PRD-1500mm", max_digits=6, decimal_places=0, default=50)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.project.name} - 토공사 기준"


# 골조공사
class FrameWork(models.Model):
    project = models.ForeignKey(
        "cpe_module.Project",
        on_delete=models.CASCADE,
        related_name="frameworks",
    )

    # 기초공사 (복수입력 가능)
    base_thickness_data = models.JSONField(
        "기초두께별 소요일 데이터",
        default=list,
        help_text="예: [{'thickness':1.0,'day':10}, {'thickness':1.5,'day':17}]"
    )

    # 층고 (복수입력 가능)
    floor_height_data = models.JSONField(
        "층고별 소요일 데이터",
        default=list,
        help_text="예: [{'height':3.5,'day':33}, {'height':4.2,'day':40}]"
    )

    # 층변화
    change_transfer = models.PositiveIntegerField("전이층", default=45)
    change_setting = models.PositiveIntegerField("세팅층", default=20)
    change_refuge = models.PositiveIntegerField("피난층", default=45)
    change_piloti = models.PositiveIntegerField("필로티", default=40)
    change_podium = models.PositiveIntegerField("포디움", default=30)
    change_sky = models.PositiveIntegerField("스카이라운지", default=60)
    change_cycle_time = models.PositiveIntegerField("Cycle Time", default=8)

    # 층 수별 전이층
    transfer_height_data = models.JSONField(
        "층 수에 따른 전이층 소요일",
        default=list,
        help_text="예: [{'floors':20,'day':30}, {'floors':40,'day':45}]"
    )

    # 갱폼 인양방식
    form_tc = models.PositiveIntegerField("TC 인양식", default=20)
    form_hydraulic = models.PositiveIntegerField("유압 인양식", default=30)

    # 역타공법
    reverse_excavation = models.PositiveIntegerField("역타공법 적용", default=25)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.project.name} - 골조공사 기준"
