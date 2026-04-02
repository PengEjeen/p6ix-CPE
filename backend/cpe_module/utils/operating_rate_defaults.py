PROCESS_KEY_DELIMITER = "|||"

DEFAULT_OPERATING_RATE_CATEGORIES = [
    "토공사",
    "골조공사",
    "외부 마감공사",
    "내부 마감공사",
    "내부마감(건식)",
    "내부마감(습식)",
    "골조 타설",
]


def normalize_category_key(value):
    return "".join(str(value or "").split()).lower()


INTERNAL_FINISH_PROCESS_KEYS = {
    normalize_category_key("내부마감"),
    normalize_category_key("내부마감(건식)"),
    normalize_category_key("내부마감(습식)"),
    normalize_category_key("내부마감건식"),
    normalize_category_key("내부마감습식"),
}
INTERNAL_FINISH_VARIANT_PROCESSES = [
    "내부마감(건식)",
    "내부마감(습식)",
]


def _format_winter_threshold(criteria, value, enabled=True):
    if not enabled or value is None:
        return "미적용"
    criteria_label = {
        "MIN": "최저",
        "MAX": "최고",
    }.get(str(criteria or "AVG").upper(), "평균")
    return f"{criteria_label} {value}℃ 이하"


def _format_threshold(value, unit, enabled=True):
    if not enabled or value is None:
        return "미적용"
    return f"{value}{unit} 이상"


PRESET_VALUES = {
    "EARTH": {
        "winter_criteria": "MIN",
        "winter_threshold_enabled": True,
        "winter_threshold_value": -10,
        "summer_threshold_enabled": True,
        "summer_threshold_value": 35,
        "rainfall_threshold_enabled": True,
        "rainfall_threshold_value": 10,
        "snowfall_threshold_enabled": True,
        "snowfall_threshold_value": 5,
        "wind_threshold": "15m/s 이상",
        "sector_type": "PRIVATE",
        "work_week_days": 6,
    },
    "FRAME": {
        "winter_criteria": "AVG",
        "winter_threshold_enabled": True,
        "winter_threshold_value": 0,
        "summer_threshold_enabled": True,
        "summer_threshold_value": 35,
        "rainfall_threshold_enabled": True,
        "rainfall_threshold_value": 10,
        "snowfall_threshold_enabled": True,
        "snowfall_threshold_value": 1,
        "wind_threshold": "15m/s 이상",
        "sector_type": "PRIVATE",
        "work_week_days": 6,
    },
    "POUR": {
        "winter_criteria": "AVG",
        "winter_threshold_enabled": True,
        "winter_threshold_value": -5,
        "summer_threshold_enabled": True,
        "summer_threshold_value": 35,
        "rainfall_threshold_enabled": True,
        "rainfall_threshold_value": 5,
        "snowfall_threshold_enabled": True,
        "snowfall_threshold_value": 5,
        "wind_threshold": "15m/s 이상",
        "sector_type": "PRIVATE",
        "work_week_days": 5,
    },
    "EXT_FIN": {
        "winter_criteria": "AVG",
        "winter_threshold_enabled": True,
        "winter_threshold_value": -5,
        "summer_threshold_enabled": True,
        "summer_threshold_value": 33,
        "rainfall_threshold_enabled": True,
        "rainfall_threshold_value": 5,
        "snowfall_threshold_enabled": True,
        "snowfall_threshold_value": 1,
        "wind_threshold": "15m/s 이상",
        "sector_type": "PRIVATE",
        "work_week_days": 6,
    },
    "INT_DRY": {
        "winter_criteria": "AVG",
        "winter_threshold_enabled": False,
        "winter_threshold_value": None,
        "summer_threshold_enabled": True,
        "summer_threshold_value": 35,
        "rainfall_threshold_enabled": True,
        "rainfall_threshold_value": 50,
        "snowfall_threshold_enabled": True,
        "snowfall_threshold_value": 5,
        "wind_threshold": "미적용",
        "sector_type": "PRIVATE",
        "work_week_days": 6,
    },
    "INT_WET": {
        "winter_criteria": "AVG",
        "winter_threshold_enabled": True,
        "winter_threshold_value": 0,
        "summer_threshold_enabled": True,
        "summer_threshold_value": 35,
        "rainfall_threshold_enabled": True,
        "rainfall_threshold_value": 50,
        "snowfall_threshold_enabled": True,
        "snowfall_threshold_value": 5,
        "wind_threshold": "15m/s 이상",
        "sector_type": "PRIVATE",
        "work_week_days": 6,
    },
}


PRESET_BY_MAIN = {
    normalize_category_key("토공사"): "EARTH",
    normalize_category_key("2. 토공사"): "EARTH",
    normalize_category_key("골조공사"): "FRAME",
    normalize_category_key("3. 골조공사"): "FRAME",
    normalize_category_key("골조타설"): "POUR",
    normalize_category_key("골조 타설"): "POUR",
    normalize_category_key("외부마감"): "EXT_FIN",
    normalize_category_key("외부 마감공사"): "EXT_FIN",
    normalize_category_key("내부마감"): "INT_DRY",
    normalize_category_key("내부마감(습식)"): "INT_WET",
    normalize_category_key("내부마감(건식)"): "INT_DRY",
    normalize_category_key("내부 마감공사"): "INT_DRY",
}


PRESET_BY_PROCESS = {
    normalize_category_key("외부마감"): "EXT_FIN",
    normalize_category_key("내부마감"): "INT_DRY",
    normalize_category_key("내부마감(습식)"): "INT_WET",
    normalize_category_key("내부마감습식"): "INT_WET",
    normalize_category_key("내부마감(건식)"): "INT_DRY",
    normalize_category_key("내부마감건식"): "INT_DRY",
    normalize_category_key("골조타설"): "POUR",
    normalize_category_key("골조 타설"): "POUR",
}


def resolve_operating_rate_preset_code(main_category):
    raw_key = str(main_category or "").strip()
    if not raw_key:
        return None

    if PROCESS_KEY_DELIMITER in raw_key:
        main_part, process_part = raw_key.split(PROCESS_KEY_DELIMITER, 1)
        process_key = normalize_category_key(process_part)
        if process_key and process_key in PRESET_BY_PROCESS:
            return PRESET_BY_PROCESS[process_key]
        main_key = normalize_category_key(main_part)
        if main_key and main_key in PRESET_BY_MAIN:
            return PRESET_BY_MAIN[main_key]
        return None

    main_key = normalize_category_key(raw_key)
    return PRESET_BY_MAIN.get(main_key)


def build_operating_rate_defaults(main_category):
    base = {
        "winter_criteria": "AVG",
        "winter_threshold_enabled": True,
        "winter_threshold_value": -5,
        "summer_threshold_enabled": True,
        "summer_threshold_value": 35,
        "rainfall_threshold_enabled": True,
        "rainfall_threshold_value": 10,
        "snowfall_threshold_enabled": True,
        "snowfall_threshold_value": 1,
        "wind_threshold": "15m/s 이상",
        "visibility_threshold": "미적용",
        "dust_alert_level": "ALERT",
        "sector_type": "PRIVATE",
        "work_week_days": 6,
    }

    preset_code = resolve_operating_rate_preset_code(main_category)
    if preset_code and preset_code in PRESET_VALUES:
        base.update(PRESET_VALUES[preset_code])
        base["type"] = preset_code

    base["winter_threshold"] = _format_winter_threshold(
        base.get("winter_criteria"),
        base.get("winter_threshold_value"),
        base.get("winter_threshold_enabled", True),
    )
    base["summer_threshold"] = _format_threshold(
        base.get("summer_threshold_value"),
        "℃",
        base.get("summer_threshold_enabled", True),
    )
    base["rainfall_threshold"] = _format_threshold(
        base.get("rainfall_threshold_value"),
        "mm",
        base.get("rainfall_threshold_enabled", True),
    )
    base["snowfall_threshold"] = _format_threshold(
        base.get("snowfall_threshold_value"),
        "cm",
        base.get("snowfall_threshold_enabled", True),
    )
    return base


def apply_operating_rate_defaults(main_category, payload=None):
    defaults = build_operating_rate_defaults(main_category)
    result = dict(payload or {})
    for key, value in defaults.items():
        result.setdefault(key, value)
    return result


def get_additional_operating_rate_keys(main_category, process=None):
    raw_main = str(main_category or "").strip()
    raw_process = str(process or "").strip()
    if not raw_main or not raw_process:
        return []

    normalized_process = normalize_category_key(raw_process)
    if normalized_process not in INTERNAL_FINISH_PROCESS_KEYS:
        return []

    return [
        f"{raw_main}{PROCESS_KEY_DELIMITER}{variant_process}"
        for variant_process in INTERNAL_FINISH_VARIANT_PROCESSES
    ]


def ensure_project_default_operating_rate_weights(project):
    from ..models.operating_rate_models import WorkScheduleWeight

    ensured_weights = []
    created_weights = []

    for main_category in DEFAULT_OPERATING_RATE_CATEGORIES:
        weight, created = WorkScheduleWeight.objects.get_or_create(
            project=project,
            main_category=main_category,
            defaults=build_operating_rate_defaults(main_category),
        )
        ensured_weights.append(weight)
        if created:
            created_weights.append(weight)

    return ensured_weights, created_weights
