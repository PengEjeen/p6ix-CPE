"""Static templates/constants for construction schedule Word report."""

PREP_REF_ROWS = [
    ("공동주택", "45일", "상수도공사", "60일"),
    ("고속도로공사", "180일", "하천공사", "40일"),
    ("철도공사", "90일", "항만공사", "40일"),
    ("포장공사(신설)", "50일", "강교가설공사", "90일"),
    ("포장공사(수선)", "60일", "PC교량공사", "70일"),
    ("공동구공사", "80일", "교량보수공사", "60일"),
]

LABOR50_TEXT = (
    "① 1주 간의 근로시간은 휴게시간을 제외하고 40시간을 초과할 수 없다.\n"
    "② 1일의 근로시간은 휴게시간을 제외하고 8시간을 초과할 수 없다.\n"
    "③ 제1항 및 제2항에 따라 근로시간을 산정하는 경우 작업을 위하여 "
    "근로자가 사용자의 지휘·감독 아래에 있는 대기시간 등은 근로시간으로 본다.\n"
    "<신설 2012. 2. 1., 2020. 5. 26.>"
)

GUIDELINE_TEXT = (
    "③ 작업일수 산정 시 건설현장 근로자의 작업조건이 법정 근로시간"
    "(1일 8시간, 주 40시간)을 준수하는 것을 원칙으로 한다. 다만, 연속작업 등에 "
    "필요한 경우에는 근로기준법에 따라 근로시간을 연장할 수 있고, 과다근무 및 "
    "주·야간 공사를 구분하여 산출한다."
)

LABOR53_TEXT = (
    "② 당사자 간에 합의하면 1주 간에 12시간을 한도로 제51조 및 제51조의2의 "
    "근로시간을 연장할 수 있고, 제52조 제1항 제2호의 시간간주를 평균하여 "
    "1주 간에 12시간을 초과하지 아니하는 범위에서 제52조 제1항의 근로시간을 "
    "연장할 수 있다.\n"
    "<개정 2021. 1. 5.>"
)

HOLIDAY_PUBLIC_BULLETS = [
    "- 일요일(52일)",
    "- 명절(6일): 설 연휴, 추석 연휴 + 대체공휴일 시행",
    "- 국경일(4일): 삼일절, 광복절, 개천절, 한글날 + 대체공휴일 시행",
    "- 기타(5일): 1월 1일, 5월 5일(대체공휴일 시행), 6월 6일, 부처님 오신 날(음력 4월 8일), 12월 25일",
    "- 공직선거법 제34조에 따른 임기만료에 따른 선거의 선거일",
    "- 기타 정부에서 수시 지정하는 날 → 대체공휴일 적용. 해당 공휴일이 일요일과 겹치는 경우 대체공휴일, 토요일·일요일과 겹치는 경우 대체공휴일을 적용함",
]

NON_WORK_EXAMPLE_TEXTS = [
    "※ 법정공휴일 = (2022~2024년 1월 공휴일 합산) / 3 = 6.7일",
    "※ 중복일수(C) = A × B ÷ 달력일수 = 2.0 × 6.7 ÷ 31 = 0.4일",
    "※ 비작업일수 = A + B - C = 2.0 + 6.7 - 0.4 = 8.3일 ≒ 8일(소수점 반올림)",
]

CLIMATE_CRITERIA_DEFS = [
    ("동절기", "① 일 평균기온 0℃ 이하", lambda w, v: bool(w and w.winter_threshold_enabled and w.winter_criteria == "AVG" and (v["winter"] is not None and v["winter"] <= 0))),
    ("동절기", "② 일 평균기온 -5℃ 이하", lambda w, v: bool(w and w.winter_threshold_enabled and w.winter_criteria == "AVG" and (v["winter"] is not None and v["winter"] <= -5))),
    ("동절기", "③ 일 평균기온 -12℃ 이하", lambda w, v: bool(w and w.winter_threshold_enabled and w.winter_criteria == "AVG" and (v["winter"] is not None and v["winter"] <= -12))),
    ("동절기", "④ 일 최고기온 0℃ 이하", lambda w, v: bool(w and w.winter_threshold_enabled and w.winter_criteria == "MAX" and (v["winter"] is not None and v["winter"] <= 0))),
    ("동절기", "⑤ 일 최저기온 -10℃ 이하", lambda w, v: bool(w and w.winter_threshold_enabled and w.winter_criteria == "MIN" and (v["winter"] is not None and v["winter"] <= -10))),
    ("동절기", "⑥ 일 최저기온 -12℃ 이하", lambda w, v: bool(w and w.winter_threshold_enabled and w.winter_criteria == "MIN" and (v["winter"] is not None and v["winter"] <= -12))),
    ("혹서기", "⑦ 일 최고기온 33℃ 이상", lambda w, v: bool(w and w.summer_threshold_enabled and (v["summer"] is not None and v["summer"] >= 33))),
    ("혹서기", "⑧ 일 최고기온 35℃ 이상", lambda w, v: bool(w and w.summer_threshold_enabled and (v["summer"] is not None and v["summer"] >= 35))),
    ("강수량", "⑨ 일 강수량 5mm 이상", lambda w, v: bool(w and w.rainfall_threshold_enabled and (v["rain"] is not None and v["rain"] >= 5))),
    ("강수량", "⑩ 일 강수량 10mm 이상", lambda w, v: bool(w and w.rainfall_threshold_enabled and (v["rain"] is not None and v["rain"] >= 10))),
    ("강수량", "⑪ 일 강수량 20mm 이상", lambda w, v: bool(w and w.rainfall_threshold_enabled and (v["rain"] is not None and v["rain"] >= 20))),
    ("적설량", "⑫ 신적설 5cm 이상", lambda w, v: bool(w and w.snowfall_threshold_enabled and (v["snow"] is not None and v["snow"] >= 5))),
    ("적설량", "⑬ 신적설 20cm 이상", lambda w, v: bool(w and w.snowfall_threshold_enabled and (v["snow"] is not None and v["snow"] >= 20))),
    ("풍속", "⑭ 일 최대풍속 10m/s 이상", lambda w, v: bool(w and (v["wind"] is not None and v["wind"] >= 10))),
    ("풍속", "⑮ 일 최대풍속 15m/s 이상", lambda w, v: bool(w and (v["wind"] is not None and v["wind"] >= 15))),
    ("미세먼지", "⑯ 경보 발령일", lambda w, _v: bool(w and w.dust_alert_level == "ALERT")),
]

MONTHLY_CONDITION_DEFS = [
    ("① 일 평균 0℃ 이하", lambda r: r["avgTa"] is not None and r["avgTa"] <= 0),
    ("② 일 평균 -5℃ 이하", lambda r: r["avgTa"] is not None and r["avgTa"] <= -5),
    ("③ 일 평균 -12℃ 이하", lambda r: r["avgTa"] is not None and r["avgTa"] <= -12),
    ("④ 일 최고 0℃ 이하", lambda r: r["maxTa"] is not None and r["maxTa"] <= 0),
    ("⑤ 일 최저 -10℃ 이하", lambda r: r["minTa"] is not None and r["minTa"] <= -10),
    ("⑥ 일 최저 -12℃ 이하", lambda r: r["minTa"] is not None and r["minTa"] <= -12),
    ("⑦ 일 최고 33℃ 이상", lambda r: r["maxTa"] is not None and r["maxTa"] >= 33),
    ("⑧ 일 최고 35℃ 이상", lambda r: r["maxTa"] is not None and r["maxTa"] >= 35),
    ("⑨ 일 강수량 5mm 이상", lambda r: r["sumRn"] is not None and r["sumRn"] >= 5),
    ("⑩ 일 강수량 10mm 이상", lambda r: r["sumRn"] is not None and r["sumRn"] >= 10),
    ("⑪ 일 강수량 20mm 이상", lambda r: r["sumRn"] is not None and r["sumRn"] >= 20),
    ("⑫ 신적설 5cm 이상", lambda r: r["ddMes"] is not None and r["ddMes"] >= 5),
    ("⑬ 신적설 20cm 이상", lambda r: r["ddMes"] is not None and r["ddMes"] >= 20),
    ("⑭ 순간최대풍속 10m/s 이상", lambda r: r["maxInsWs"] is not None and r["maxInsWs"] >= 10),
    ("⑮ 순간최대풍속 15m/s 이상", lambda r: r["maxInsWs"] is not None and r["maxInsWs"] >= 15),
    ("⑯ 경보 발령일", lambda _r: False),
]

OPERATING_RATE_PREFERRED_ORDER = ["토공사", "골조공사", "내부마감공사", "외부마감공사", "골조타설"]

OPERATING_RATE_THRESHOLD_TASKS = [
    "동절기 최고기온(℃이하)",
    "동절기 평균기온(℃이하)",
    "혹서기 최고기온(℃이상)",
    "일 강수량(mm이상)",
    "신적설(cm이상)",
    "최대순간풍속(m/s이상)",
    "미세먼지",
]

EARTHWORK_STANDARD_TABLES = [
    {
        "rows": [
            ("토사", "백호우(0.7m³) 560m³/일", "품셈\n기준"),
        ],
    },
    {
        "rows": [
            ("굴삭기", "백호우(1.0m³) 950m³/일", "가이드 라인\n기준"),
        ],
    },
]

STRUCTURE_STANDARD_ROWS = [
    (
        "철골공사",
        "· 60TON미만 → 2.48 톤/일\n"
        "· 60TON이상 100TON미만 → 2.31 톤/일\n"
        "· 100TON이상 300TON미만 → 2.20 톤/일\n"
        "· 300TON이상 1,000TON미만 → 1.97 톤/일\n"
        "· 1,000TON이상 2,000TON미만 → 1.75 톤/일\n"
        "· 2,000TON이상 → 1.36 톤/일",
        "품셈\n기준",
    ),
    (
        "철근\n콘크리트\n공사",
        "· 철근가공 및 조립 : 철근공 8인 → 3.5톤/일\n"
        "· 유로폼조립 : 형틀목공 5인 → 50㎡/일\n"
        "· 데크작업 : 5인 → 85㎡/일\n"
        "· 콘크리트타설 : 펌프카 1대 → 403㎡/일 (실적치 적용)",
        "품셈\n기준",
    ),
    (
        "기초\n공사",
        "· 기성말뚝 기초 : 보링공 1인, 기계설비공 1인, 특별인부 2인, 보통인부 1인,\n"
        "  용접공 1인, 파일천공장비 1대 등 → 15본/일\n"
        "· 기성말뚝 두부정리 : 용접공 1인, 보통인부 1인, 굴삭기 1대 → 21본/일",
        "가이드라인\n기준",
    ),
]

STANDARD_PRODUCTIVITY_NOTE = (
    "※ 공종이 다양하고 복잡한 공정이 연계되는 건축공사 특성을 고려하여 "
    "공사여건에 따라 작업조를 추가 투입할 수 있음"
)
