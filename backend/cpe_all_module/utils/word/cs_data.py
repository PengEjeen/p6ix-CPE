"""Data assembly for construction schedule Word report."""

from calendar import monthrange
from datetime import date as date_cls
import re

from cpe_module.models.operating_rate_models import WorkScheduleWeight
from cpe_module.models.calc_models import ConstructionOverview
from operatio.models import PublicHoliday, WeatherDailyRecord, WeatherStation

from .cs_common import to_number
from .cs_template import (
    CLIMATE_CRITERIA_DEFS,
    MONTHLY_CONDITION_DEFS,
    OPERATING_RATE_PREFERRED_ORDER,
)


def _count_sundays_in_month(year, month):
    days_in_month = monthrange(year, month)[1]
    count = 0
    for day in range(1, days_in_month + 1):
        if date_cls(year, month, day).weekday() == 6:
            count += 1
    return count


def _project_holiday_dates(source_dates, target_year):
    projected = set()
    for date_value in source_dates:
        try:
            projected.add(date_value.replace(year=target_year))
        except ValueError:
            if date_value.month == 2 and date_value.day == 29:
                projected.add(date_cls(target_year, 2, 28))
    return projected


def _build_public_legal_holiday_rows(project_start_date=None, max_years=7):
    all_years = list(
        PublicHoliday.objects.filter(is_holiday="Y")
        .values_list("date__year", flat=True)
        .distinct()
    )
    if not all_years:
        return []

    available_years = sorted(set(all_years))
    if project_start_date:
        start_year = project_start_date.year
    elif 2024 in available_years:
        start_year = 2024
    else:
        start_year = available_years[0]

    fallback_year = 2025 if 2025 in available_years else available_years[0]
    result = []
    for year in range(start_year, start_year + max_years):
        date_qs = PublicHoliday.objects.filter(
            date__year=year,
            is_holiday="Y",
        ).values_list("date", flat=True)
        holiday_dates = set(date_qs)
        if holiday_dates:
            year_dates = holiday_dates
        else:
            fallback_dates = set(
                PublicHoliday.objects.filter(
                    date__year=fallback_year,
                    is_holiday="Y",
                ).values_list("date", flat=True)
            )
            year_dates = _project_holiday_dates(fallback_dates, year)

        monthly_counts = []
        for month in range(1, 13):
            sundays = _count_sundays_in_month(year, month)
            holiday_extra = sum(
                1
                for date_value in year_dates
                if date_value.month == month and date_value.weekday() != 6
            )
            monthly_counts.append(sundays + holiday_extra)

        result.append({
            "year": year,
            "monthly": monthly_counts,
            "total": sum(monthly_counts),
        })

    return result


def _to_float(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_number(text):
    if not text:
        return None
    matched = re.search(r"-?\d+(?:\.\d+)?", str(text))
    if not matched:
        return None
    try:
        return float(matched.group(0))
    except (TypeError, ValueError):
        return None


def _build_climate_criteria_rows(weights, ordered_categories, region=""):
    category_order = [category for category in (ordered_categories or []) if category]
    weight_map = {weight.main_category: weight for weight in (weights or [])}

    def _values(weight):
        if not weight:
            return {
                "winter": None,
                "summer": None,
                "rain": None,
                "snow": None,
                "wind": None,
            }
        winter_value = _to_float(weight.winter_threshold_value)
        if winter_value is None:
            winter_value = _extract_number(weight.winter_threshold)

        summer_value = _to_float(weight.summer_threshold_value)
        if summer_value is None:
            summer_value = _extract_number(weight.summer_threshold)

        rain_value = _to_float(weight.rainfall_threshold_value)
        if rain_value is None:
            rain_value = _extract_number(weight.rainfall_threshold)

        snow_value = _to_float(weight.snowfall_threshold_value)
        if snow_value is None:
            snow_value = _extract_number(weight.snowfall_threshold)

        wind_value = _extract_number(weight.wind_threshold)
        return {
            "winter": winter_value,
            "summer": summer_value,
            "rain": rain_value,
            "snow": snow_value,
            "wind": wind_value,
        }

    def _row_apply_text(by_category):
        if not by_category:
            return "-"
        return "○" if any(applied for _, applied in by_category) else "-"

    rows = []
    region_label = (region or "가동률 지역").strip()
    data_source_text = f"{region_label}\n기상관측\n자료"

    for group, detail, predicate in CLIMATE_CRITERIA_DEFS:
        by_category = []
        for category in category_order:
            weight = weight_map.get(category)
            by_category.append((category, predicate(weight, _values(weight))))
        rows.append({
            "data_source": data_source_text,
            "group": group,
            "detail": detail,
            "apply_text": _row_apply_text(by_category),
        })
    return rows


def _resolve_station_id_for_region(region):
    if region:
        station = WeatherStation.objects.filter(name=region).first()
        if station:
            return station.station_id
    station = WeatherStation.objects.first()
    return station.station_id if station else None


def _pick_analysis_years(station_id, years_count):
    if not station_id:
        return []
    qs_years = (
        WeatherDailyRecord.objects.filter(station_id=station_id)
        .values_list("date__year", flat=True)
        .distinct()
    )
    years = sorted(set(qs_years))
    if not years:
        return []
    years_count = max(1, int(years_count or 10))
    return years[-years_count:]


def _fmt_temp_label(value):
    if value is None:
        return "-"
    return f"{int(value) if float(value).is_integer() else value}℃ 이하"


def _build_category_climate_rows(weights, ordered_categories=None):
    ordered = [category for category in (ordered_categories or []) if category]
    weight_map = {weight.main_category: weight for weight in (weights or [])}

    categories = []
    seen = set()
    for category in ordered:
        if category in weight_map and category not in seen:
            categories.append(category)
            seen.add(category)
    for category in weight_map.keys():
        if category not in seen:
            categories.append(category)
            seen.add(category)

    rows = []
    for category in categories:
        weight = weight_map.get(category)
        if not weight:
            continue

        winter_v = _to_float(weight.winter_threshold_value)
        summer_v = _to_float(weight.summer_threshold_value)
        rain_v = _to_float(weight.rainfall_threshold_value)
        snow_v = _to_float(weight.snowfall_threshold_value)
        wind_v = _extract_number(weight.wind_threshold)

        if weight.winter_threshold_enabled:
            if weight.winter_criteria == "AVG":
                if winter_v is not None and winter_v <= -12:
                    avg_label = "③-12℃ 이하"
                elif winter_v is not None and winter_v <= -5:
                    avg_label = "②-5℃ 이하"
                elif winter_v is not None and winter_v <= 0:
                    avg_label = "①0℃ 이하"
                else:
                    avg_label = _fmt_temp_label(winter_v)
            elif weight.winter_criteria == "MAX":
                avg_label = "④0℃ 이하" if winter_v is not None and winter_v <= 0 else _fmt_temp_label(winter_v)
            else:
                if winter_v is not None and winter_v <= -12:
                    avg_label = "⑥-12℃ 이하"
                elif winter_v is not None and winter_v <= -10:
                    avg_label = "⑤-10℃ 이하"
                else:
                    avg_label = _fmt_temp_label(winter_v)
        else:
            avg_label = "-"

        if weight.summer_threshold_enabled:
            if summer_v is not None and summer_v >= 35:
                max_label = "⑧35℃ 이상"
            elif summer_v is not None and summer_v >= 33:
                max_label = "⑦33℃ 이상"
            else:
                max_label = "-" if summer_v is None else f"{summer_v:g}℃ 이상"
        else:
            max_label = "-"

        if weight.rainfall_threshold_enabled:
            if rain_v is not None and rain_v >= 20:
                rain_label = "⑪20mm 이상"
            elif rain_v is not None and rain_v >= 10:
                rain_label = "⑩10mm 이상"
            elif rain_v is not None and rain_v >= 5:
                rain_label = "⑨5mm 이상"
            else:
                rain_label = "-" if rain_v is None else f"{rain_v:g}mm 이상"
        else:
            rain_label = "-"

        if weight.snowfall_threshold_enabled:
            if snow_v is not None and snow_v >= 20:
                snow_label = "⑬20cm 이상"
            elif snow_v is not None and snow_v >= 5:
                snow_label = "⑫5cm 이상"
            else:
                snow_label = "-" if snow_v is None else f"{snow_v:g}cm 이상"
        else:
            snow_label = "-"

        if wind_v is not None:
            if wind_v >= 15:
                wind_label = "⑮15m/s 이상"
            elif wind_v >= 10:
                wind_label = "⑭10m/s 이상"
            else:
                wind_label = f"{wind_v:g}m/s 이상"
        else:
            wind_label = "-"

        dust_label = "경보" if weight.dust_alert_level == "ALERT" else ("주의" if weight.dust_alert_level == "WARNING" else "-")

        rows.append({
            "category": weight.main_category or "-",
            "avg_temp": avg_label,
            "max_temp": max_label,
            "rain": rain_label,
            "snow": snow_label,
            "wind": wind_label,
            "dust": dust_label,
        })
    return rows


def _build_monthly_condition_rows(station_id, analysis_years):
    if not station_id or not analysis_years:
        return [], ""

    records = _load_weather_records(station_id, analysis_years)
    if not records:
        return [], ""

    year_count = len(analysis_years)
    rows = []
    for label, predicate in MONTHLY_CONDITION_DEFS:
        monthly_counts = [0] * 12
        for record in records:
            if predicate(record):
                month_idx = record["date"].month - 1
                monthly_counts[month_idx] += 1
        monthly_avg = [round(value / year_count, 1) for value in monthly_counts]
        rows.append({"label": label, "monthly": monthly_avg})

    year_label = f"{min(analysis_years)} ~ {max(analysis_years)}"
    return rows, year_label


def _extract_condition_code(text):
    if not text:
        return None
    code = str(text).strip()[:1]
    if code in "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯":
        return code
    return None


def _load_weather_records(station_id, analysis_years):
    if not station_id or not analysis_years:
        return []
    return list(
        WeatherDailyRecord.objects.filter(
            station_id=station_id,
            date__year__in=analysis_years,
        ).values(
            "date",
            "avgTa",
            "maxTa",
            "minTa",
            "sumRn",
            "ddMes",
            "maxInsWs",
        )
    )


def _ordered_weight_labels(weight_by_category, ordered_categories):
    ordered_labels = []
    for label in OPERATING_RATE_PREFERRED_ORDER:
        if label in weight_by_category:
            ordered_labels.append(label)
    for category in (ordered_categories or []):
        label = _normalize_main_category(category)
        if label in weight_by_category and label not in ordered_labels:
            ordered_labels.append(label)
    for label in weight_by_category.keys():
        if label not in ordered_labels:
            ordered_labels.append(label)
    return ordered_labels


def _pick_threshold_codes(weight, annual_days_by_code=None):
    annual_days_by_code = annual_days_by_code or {}

    def _num_text(value):
        number = to_number(value)
        if number is None:
            return "-"
        return str(int(number)) if float(number).is_integer() else f"{number:g}"

    winter_value = _to_float(weight.winter_threshold_value)
    summer_value = _to_float(weight.summer_threshold_value)
    rain_value = _to_float(weight.rainfall_threshold_value)
    snow_value = _to_float(weight.snowfall_threshold_value)
    wind_value = _extract_number(weight.wind_threshold)

    winter_max_text = "-"
    winter_avg_text = "-"
    winter_max_code = None
    winter_avg_code = None
    winter_code = None
    if weight.winter_threshold_enabled:
        if weight.winter_criteria == "MAX":
            winter_max_code = "④" if winter_value is not None and winter_value <= 0 else None
            winter_code = winter_max_code
            winter_max_text = (
                f"{winter_max_code} 0℃"
                if winter_max_code
                else (f"{_num_text(winter_value)}℃" if winter_value is not None else "-")
            )
        elif weight.winter_criteria == "AVG":
            if winter_value is not None and winter_value <= -12:
                winter_avg_code = "③"
            elif winter_value is not None and winter_value <= -5:
                winter_avg_code = "②"
            elif winter_value is not None and winter_value <= 0:
                winter_avg_code = "①"
            winter_code = winter_avg_code
            winter_avg_text = (
                f"{winter_avg_code} {_num_text(winter_value)}℃"
                if winter_avg_code and winter_value is not None
                else (f"{_num_text(winter_value)}℃" if winter_value is not None else "-")
            )
        else:
            if winter_value is not None and winter_value <= -12:
                winter_avg_code = "⑥"
            elif winter_value is not None and winter_value <= -10:
                winter_avg_code = "⑤"
            winter_code = winter_avg_code
            winter_avg_text = (
                f"{winter_avg_code} {_num_text(winter_value)}℃"
                if winter_avg_code and winter_value is not None
                else (f"{_num_text(winter_value)}℃" if winter_value is not None else "-")
            )

    summer_code = None
    if weight.summer_threshold_enabled:
        if summer_value is not None and summer_value >= 35:
            summer_code = "⑧"
        elif summer_value is not None and summer_value >= 33:
            summer_code = "⑦"
    summer_text = (
        f"{summer_code} {_num_text(summer_value)}℃"
        if summer_code and summer_value is not None
        else (f"{_num_text(summer_value)}℃" if summer_value is not None and weight.summer_threshold_enabled else "-")
    )

    rain_code = None
    if weight.rainfall_threshold_enabled:
        if rain_value is not None and rain_value >= 20:
            rain_code = "⑪"
        elif rain_value is not None and rain_value >= 10:
            rain_code = "⑩"
        elif rain_value is not None and rain_value >= 5:
            rain_code = "⑨"
    rain_text = (
        f"{rain_code} {_num_text(rain_value)}mm"
        if rain_code and rain_value is not None
        else (f"{_num_text(rain_value)}mm" if rain_value is not None and weight.rainfall_threshold_enabled else "-")
    )

    snow_code = None
    if weight.snowfall_threshold_enabled:
        if snow_value is not None and snow_value >= 20:
            snow_code = "⑬"
        elif snow_value is not None and snow_value >= 5:
            snow_code = "⑫"
    snow_text = (
        f"{snow_code} {_num_text(snow_value)}cm"
        if snow_code and snow_value is not None
        else (f"{_num_text(snow_value)}cm" if snow_value is not None and weight.snowfall_threshold_enabled else "-")
    )

    wind_code = None
    if wind_value is not None:
        if wind_value >= 15:
            wind_code = "⑮"
        elif wind_value >= 10:
            wind_code = "⑭"
    wind_text = (
        f"{wind_code} {_num_text(wind_value)}m/s"
        if wind_code and wind_value is not None
        else (f"{_num_text(wind_value)}m/s" if wind_value is not None else "-")
    )

    dust_code = "⑯" if weight.dust_alert_level == "ALERT" else None
    dust_text = "⑯ 경보" if dust_code else ("주의" if weight.dust_alert_level == "WARNING" else "-")

    return {
        "winter_code": winter_code,
        "summer_code": summer_code,
        "rain_code": rain_code,
        "snow_code": snow_code,
        "wind_code": wind_code,
        "dust_code": dust_code,
        "winter_max_text": winter_max_text,
        "winter_avg_text": winter_avg_text,
        "summer_text": summer_text,
        "rain_text": rain_text,
        "snow_text": snow_text,
        "wind_text": wind_text,
        "dust_text": dust_text,
        "winter_max_days": annual_days_by_code.get(winter_max_code),
        "winter_avg_days": annual_days_by_code.get(winter_avg_code),
        "summer_days": annual_days_by_code.get(summer_code),
        "rain_days": annual_days_by_code.get(rain_code),
        "snow_days": annual_days_by_code.get(snow_code),
        "wind_days": annual_days_by_code.get(wind_code),
        "dust_days": annual_days_by_code.get(dust_code),
    }


def _round_half_up(value):
    number = to_number(value)
    if number is None:
        return None
    if number >= 0:
        return int(number + 0.5)
    return int(number - 0.5)


def _normalize_main_category(name):
    text = str(name or "")
    text = re.sub(r"^\s*\d+\s*[\.\)]\s*", "", text).strip()
    compact = re.sub(r"\s+", "", text)
    if "골조타설" in compact or "타설" in compact:
        return "골조타설"
    if "토공" in compact:
        return "토공사"
    if "골조공" in compact:
        return "골조공사"
    if "내부" in compact and "마감" in compact:
        return "내부마감공사"
    if "외부" in compact and "마감" in compact:
        return "외부마감공사"
    if "골조" in compact and "마감" not in compact:
        return "골조공사"
    return text or "-"


def _build_operating_rate_calc_data(
    weights,
    ordered_categories,
    monthly_condition_rows,
    public_holiday_rows,
    monthly_year_range,
    project_start_date=None,
    region="",
):
    monthly_rows = monthly_condition_rows or []
    monthly_by_code = {}
    annual_days_by_code = {}
    for entry in monthly_rows:
        code = _extract_condition_code(entry.get("label"))
        if not code:
            continue
        monthly_values = []
        total = 0.0
        for value in (entry.get("monthly") or []):
            number = to_number(value)
            if number is None:
                number = 0.0
            monthly_values.append(float(number))
            total += number
        monthly_by_code[code] = monthly_values
        annual_days_by_code[code] = round(total, 1)

    weight_by_category = {}
    for weight in (weights or []):
        key = _normalize_main_category(weight.main_category)
        if key not in weight_by_category:
            weight_by_category[key] = weight

    ordered_labels = _ordered_weight_labels(weight_by_category, ordered_categories)

    columns = []
    for label in ordered_labels:
        weight = weight_by_category.get(label)
        if not weight:
            continue

        thresholds = _pick_threshold_codes(weight, annual_days_by_code=annual_days_by_code)
        subtotal = 0.0
        for day_key in (
            "winter_max_days",
            "winter_avg_days",
            "summer_days",
            "rain_days",
            "snow_days",
            "wind_days",
            "dust_days",
        ):
            day_value = to_number(thresholds.get(day_key))
            if day_value is not None:
                subtotal += day_value
        subtotal = round(subtotal, 1)

        legal_holidays = to_number(weight.legal_holidays) or 0
        columns.append({
            "label": label,
            "thresholds": thresholds,
            "subtotal_days": subtotal,
            "legal_holidays": legal_holidays,
        })

    base_year = project_start_date.year if project_start_date else date_cls.today().year
    calendar_days = 366 if monthrange(base_year, 2)[1] == 29 else 365

    # Monthly holiday profile follows public holiday data (first 4-year average).
    holiday_rows = list(public_holiday_rows or [])
    if holiday_rows:
        sample = holiday_rows[:4]
        holiday_monthly = []
        for month_idx in range(12):
            values = []
            for row in sample:
                monthly = row.get("monthly") or []
                if month_idx < len(monthly):
                    number = to_number(monthly[month_idx])
                    values.append(number if number is not None else 0.0)
            if values:
                holiday_monthly.append(round(sum(values) / len(values), 1))
            else:
                holiday_monthly.append(0.0)
    else:
        holiday_monthly = [0.0] * 12

    month_days = [monthrange(base_year, month)[1] for month in range(1, 13)]

    for col in columns:
        overlap = _round_half_up(col["subtotal_days"] * col["legal_holidays"] / calendar_days)
        non_working = _round_half_up(col["subtotal_days"] + col["legal_holidays"] - overlap)
        working = calendar_days - (non_working or 0)
        operating_rate = round((working / calendar_days) * 100, 1) if calendar_days else 0.0
        col["overlap_days"] = overlap
        col["non_working_days"] = non_working
        col["working_days"] = working
        col["operating_rate"] = operating_rate

    calendars = []
    for idx, col in enumerate(columns, start=1):
        thresholds = col.get("thresholds") or {}
        winter_code = thresholds.get("winter_code")
        summer_code = thresholds.get("summer_code")
        rain_code = thresholds.get("rain_code")
        snow_code = thresholds.get("snow_code")
        wind_code = thresholds.get("wind_code")
        dust_code = thresholds.get("dust_code")

        winter_monthly = monthly_by_code.get(winter_code, [0.0] * 12) if winter_code else [0.0] * 12
        summer_monthly = monthly_by_code.get(summer_code, [0.0] * 12) if summer_code else [0.0] * 12
        rain_monthly = monthly_by_code.get(rain_code, [0.0] * 12) if rain_code else [0.0] * 12
        snow_monthly = monthly_by_code.get(snow_code, [0.0] * 12) if snow_code else [0.0] * 12
        wind_monthly = monthly_by_code.get(wind_code, [0.0] * 12) if wind_code else [0.0] * 12
        dust_monthly = monthly_by_code.get(dust_code, [0.0] * 12) if dust_code else [0.0] * 12

        month_rows = []
        for month_idx in range(12):
            weather_subtotal = round(
                winter_monthly[month_idx]
                + summer_monthly[month_idx]
                + rain_monthly[month_idx]
                + snow_monthly[month_idx]
                + wind_monthly[month_idx]
                + dust_monthly[month_idx],
                1,
            )
            holiday = holiday_monthly[month_idx]
            days = month_days[month_idx]
            overlap = round((weather_subtotal * holiday) / days, 1) if days else 0.0
            non_working = round(weather_subtotal + holiday - overlap, 1)
            workable = round(days - non_working, 1)
            month_rate = round((workable / days) * 100, 1) if days else 0.0
            month_rows.append({
                "month": month_idx + 1,
                "winter": winter_monthly[month_idx],
                "summer": summer_monthly[month_idx],
                "rain": rain_monthly[month_idx],
                "snow": snow_monthly[month_idx],
                "wind": wind_monthly[month_idx],
                "dust": dust_monthly[month_idx],
                "subtotal": weather_subtotal,
                "holiday": holiday,
                "overlap": overlap,
                "non_working": non_working,
                "workable": workable,
                "rate": month_rate,
            })

        annual = {
            "winter": round(sum(row["winter"] for row in month_rows), 1),
            "summer": round(sum(row["summer"] for row in month_rows), 1),
            "rain": round(sum(row["rain"] for row in month_rows), 1),
            "snow": round(sum(row["snow"] for row in month_rows), 1),
            "wind": round(sum(row["wind"] for row in month_rows), 1),
            "dust": round(sum(row["dust"] for row in month_rows), 1),
            "subtotal": round(sum(row["subtotal"] for row in month_rows), 1),
            "holiday": round(sum(row["holiday"] for row in month_rows), 1),
            "overlap": round(sum(row["overlap"] for row in month_rows), 1),
            "non_working": round(sum(row["non_working"] for row in month_rows), 1),
            "workable": round(sum(row["workable"] for row in month_rows), 1),
        }
        annual_days = sum(month_days)
        annual["rate"] = round((annual["workable"] / annual_days) * 100, 1) if annual_days else 0.0

        calendars.append({
            "index": idx,
            "calendar_name": f"Calendar {idx:02d}",
            "category": col.get("label", "-"),
            "criteria_codes": {
                "winter": winter_code or "-",
                "summer": summer_code or "-",
                "rain": rain_code or "-",
                "snow": snow_code or "-",
                "wind": wind_code or "-",
                "dust": dust_code or "-",
            },
            "rows": month_rows,
            "annual": annual,
        })

    year_count = None
    if monthly_year_range and "~" in monthly_year_range:
        parts = [part.strip() for part in monthly_year_range.split("~")]
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            year_count = int(parts[1]) - int(parts[0]) + 1

    region_label = (region or "가동률 지역").strip()
    if year_count:
        note = f"※ 최근 {year_count}년간({region_label}) 기상정보 분석을 통한 공사 가동률"
    else:
        note = f"※ {region_label} 기상정보 분석을 통한 공사 가동률"

    return {
        "note": note,
        "base_year": base_year,
        "calendar_days": calendar_days,
        "columns": columns,
        "calendars": calendars,
    }


def _build_weather_appendix_data(
    weights,
    ordered_categories,
    station_id,
    analysis_years,
    region="",
    monthly_year_range="",
):
    region_label = (region or "").strip()
    if not region_label:
        station_name = (
            WeatherStation.objects.filter(station_id=station_id).values_list("name", flat=True).first()
            if station_id
            else None
        )
        region_label = (station_name or "가동률 지역").strip()

    if monthly_year_range:
        period_label = monthly_year_range
    elif analysis_years:
        period_label = f"{min(analysis_years)} ~ {max(analysis_years)}"
    else:
        period_label = "-"

    records = _load_weather_records(station_id, analysis_years)
    if not records or not analysis_years:
        return {
            "region_label": region_label,
            "period_label": period_label,
            "appendices": [],
        }

    condition_defs = []
    label_by_code = {}
    for label, predicate in MONTHLY_CONDITION_DEFS:
        code = _extract_condition_code(label)
        if not code:
            continue
        detail = str(label).replace(code, "", 1).strip()
        condition_defs.append((code, detail, predicate))
        label_by_code[code] = detail

    code_year_month_counts = {}
    for code, _detail, predicate in condition_defs:
        year_map = {year: [0.0] * 12 for year in analysis_years}
        for record in records:
            if not predicate(record):
                continue
            year = record["date"].year
            month_idx = record["date"].month - 1
            if year in year_map:
                year_map[year][month_idx] += 1.0
        code_year_month_counts[code] = year_map

    weight_by_category = {}
    for weight in (weights or []):
        key = _normalize_main_category(weight.main_category)
        if key not in weight_by_category:
            weight_by_category[key] = weight
    ordered_labels = _ordered_weight_labels(weight_by_category, ordered_categories)

    categories_by_code = {}
    for category_label in ordered_labels:
        weight = weight_by_category.get(category_label)
        if not weight:
            continue
        thresholds = _pick_threshold_codes(weight)
        for code in (
            thresholds.get("winter_code"),
            thresholds.get("summer_code"),
            thresholds.get("rain_code"),
            thresholds.get("snow_code"),
            thresholds.get("wind_code"),
            thresholds.get("dust_code"),
        ):
            if not code:
                continue
            bucket = categories_by_code.setdefault(code, [])
            if category_label not in bucket:
                bucket.append(category_label)

    appendix_defs = [
        {"number": 1, "title": "기온에 따른 휴지일수 년도별 집계표", "codes": ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"], "avg_digits": 1},
        {"number": 2, "title": "강우량에 따른 휴지일수 년도별 집계표", "codes": ["⑨", "⑩", "⑪"], "avg_digits": 1},
        {"number": 3, "title": "적설량에 따른 휴지일수 년도별 집계표", "codes": ["⑫", "⑬"], "avg_digits": 1},
        {"number": 4, "title": "순간최대 풍속에 따른 휴지일수 년도별 집계표", "codes": ["⑭", "⑮"], "avg_digits": 1},
        {"number": 6, "title": "미세먼지 경보에 따른 휴지일수 년도별 집계표", "codes": ["⑯"], "avg_digits": 2},
    ]

    def _compact_case_label(number, code, detail):
        text = detail
        if number == 1:
            text = text.replace("일 ", "")
        elif number == 2:
            text = text.replace("일 강수량 ", "")
        elif number == 3:
            text = text.replace("신적설 ", "")
        elif number == 4:
            text = text.replace("일 최대풍속 ", "").replace("순간최대풍속 ", "")
        elif number == 6:
            text = text.replace("일 ", "")
        return f"{code} {text}".strip()

    appendices = []
    year_count = len(analysis_years)
    sorted_years_desc = sorted(analysis_years, reverse=True)

    for appendix_def in appendix_defs:
        cases = []
        for code in appendix_def["codes"]:
            applied_categories = categories_by_code.get(code) or []
            if not applied_categories:
                continue

            yearly = []
            for year in sorted_years_desc:
                monthly = list((code_year_month_counts.get(code) or {}).get(year, [0.0] * 12))
                yearly.append({"year": year, "monthly": monthly})

            average_monthly = []
            for month_idx in range(12):
                month_total = sum(row["monthly"][month_idx] for row in yearly)
                average_monthly.append(round(month_total / year_count, 1))

            detail = label_by_code.get(code, "")
            cases.append({
                "code": code,
                "case_label": _compact_case_label(appendix_def["number"], code, detail),
                "applied_categories": applied_categories,
                "rows": yearly,
                "average": average_monthly,
            })

        if not cases:
            continue

        appendices.append({
            "number": appendix_def["number"],
            "title": appendix_def["title"],
            "avg_digits": appendix_def.get("avg_digits", 1),
            "cases": cases,
        })

    status_source_specs = {
        "①": {"field": "avgTa", "label": "일평균기온(℃)"},
        "②": {"field": "avgTa", "label": "일평균기온(℃)"},
        "③": {"field": "avgTa", "label": "일평균기온(℃)"},
        "④": {"field": "maxTa", "label": "일최고기온(℃)"},
        "⑤": {"field": "minTa", "label": "일최저기온(℃)"},
        "⑥": {"field": "minTa", "label": "일최저기온(℃)"},
        "⑦": {"field": "maxTa", "label": "일최고기온(℃)"},
        "⑧": {"field": "maxTa", "label": "일최고기온(℃)"},
        "⑨": {"field": "sumRn", "label": "일강수량(mm)"},
        "⑩": {"field": "sumRn", "label": "일강수량(mm)"},
        "⑪": {"field": "sumRn", "label": "일강수량(mm)"},
        "⑫": {"field": "ddMes", "label": "신적설(cm)"},
        "⑬": {"field": "ddMes", "label": "신적설(cm)"},
        "⑭": {"field": "maxInsWs", "label": "순간최대풍속(m/s)"},
        "⑮": {"field": "maxInsWs", "label": "순간최대풍속(m/s)"},
    }
    records_by_date = {
        (record["date"].year, record["date"].month, record["date"].day): record
        for record in records
    }
    yearly_status_tables = []
    applied_sources = {}
    ordered_source_fields = []
    for appendix_def in appendix_defs:
        for code in appendix_def["codes"]:
            if not (categories_by_code.get(code) or []):
                continue
            source_spec = status_source_specs.get(code)
            if not source_spec:
                continue
            field_name = source_spec["field"]
            if field_name not in applied_sources:
                applied_sources[field_name] = {
                    "source_label": source_spec["label"],
                    "codes": [],
                }
                ordered_source_fields.append(field_name)
            if code not in applied_sources[field_name]["codes"]:
                applied_sources[field_name]["codes"].append(code)

    for field_name in ordered_source_fields:
        source_label = applied_sources[field_name]["source_label"]
        applied_codes = applied_sources[field_name]["codes"]
        for year in sorted(analysis_years):
            day_rows = []
            for day in range(1, 32):
                monthly = []
                for month in range(1, 13):
                    if day > monthrange(year, month)[1]:
                        monthly.append(None)
                        continue
                    record = records_by_date.get((year, month, day))
                    value = to_number(record.get(field_name)) if record else None
                    monthly.append(round(value, 1) if value is not None else None)
                day_rows.append({"day": day, "monthly": monthly})

            monthly_avg = []
            for month_idx in range(12):
                values = []
                for row in day_rows:
                    value = row["monthly"][month_idx]
                    if value is not None:
                        values.append(value)
                if values:
                    monthly_avg.append(round(sum(values) / len(values), 1))
                else:
                    monthly_avg.append(None)

            yearly_status_tables.append({
                "case_label": ", ".join(applied_codes),
                "source_label": source_label,
                "station_id": station_id,
                "region_label": region_label,
                "year": year,
                "rows": day_rows,
                "average": monthly_avg,
            })

    return {
        "region_label": region_label,
        "period_label": period_label,
        "appendices": appendices,
        "yearly_status": {
            "title": "년도별 기상 휴지일수 현황",
            "tables": yearly_status_tables,
        },
    }


def build_schedule_report_aux_data(
    project_id,
    ordered_categories,
    region="",
    project_start_date=None,
    work_condition_years=10,
):
    overview = ConstructionOverview.objects.filter(project_id=project_id).first()
    project_overview = {
        "total_floor_area": float(overview.total_floor_area) if overview and overview.total_floor_area is not None else None,
        "ground_floors": int(overview.ground_floors) if overview and overview.ground_floors is not None else None,
        "basement_floors": int(overview.basement_floors) if overview and overview.basement_floors is not None else None,
    }

    project_weights = list(
        WorkScheduleWeight.objects.filter(project_id=project_id).order_by("main_category")
    )

    public_holiday_rows = _build_public_legal_holiday_rows(
        project_start_date=project_start_date,
        max_years=7,
    )
    climate_criteria_rows = _build_climate_criteria_rows(
        weights=project_weights,
        ordered_categories=ordered_categories,
        region=region,
    )

    station_id = _resolve_station_id_for_region(region)
    analysis_years = _pick_analysis_years(station_id, work_condition_years)
    climate_category_rows = _build_category_climate_rows(
        project_weights,
        ordered_categories=ordered_categories,
    )
    monthly_condition_rows, monthly_year_range = _build_monthly_condition_rows(
        station_id,
        analysis_years,
    )
    operating_rate_calc_data = _build_operating_rate_calc_data(
        weights=project_weights,
        ordered_categories=ordered_categories,
        monthly_condition_rows=monthly_condition_rows,
        public_holiday_rows=public_holiday_rows,
        monthly_year_range=monthly_year_range,
        project_start_date=project_start_date,
        region=region,
    )
    weather_appendix_data = _build_weather_appendix_data(
        weights=project_weights,
        ordered_categories=ordered_categories,
        station_id=station_id,
        analysis_years=analysis_years,
        region=region,
        monthly_year_range=monthly_year_range,
    )

    return {
        "project_overview": project_overview,
        "public_holiday_rows": public_holiday_rows,
        "climate_criteria_rows": climate_criteria_rows,
        "climate_category_rows": climate_category_rows,
        "monthly_condition_rows": monthly_condition_rows,
        "monthly_year_range": monthly_year_range,
        "operating_rate_calc_data": operating_rate_calc_data,
        "weather_appendix_data": weather_appendix_data,
    }
