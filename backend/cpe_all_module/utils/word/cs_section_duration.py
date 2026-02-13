"""Section renderer: 1. 공사기간 분석."""

from io import BytesIO
import re

from .cs_common import (
    format_number,
    merge_same_text_cells,
    shade_header_row,
    to_number,
)
from .cs_template import (
    GUIDELINE_TEXT,
    HOLIDAY_PUBLIC_BULLETS,
    LABOR50_TEXT,
    LABOR53_TEXT,
    NON_WORK_EXAMPLE_TEXTS,
    OPERATING_RATE_THRESHOLD_TASKS,
    PREP_REF_ROWS,
)


def add_duration_analysis_section(
    document,
    ordered_categories=None,
    grouped_items=None,
    rate_map=None,
    project_name="",
    gantt_image_bytes=None,
    project_overview=None,
    public_holiday_rows=None,
    climate_criteria_rows=None,
    climate_category_rows=None,
    monthly_condition_rows=None,
    monthly_year_range="",
    operating_rate_calc_data=None,
    weather_appendix_data=None,
):
    document.add_heading("1. 공사기간 분석", level=1)
    document.add_heading("1.1 공사기간 산정 (국토교통부 공사기간 산정 기준)", level=2)
    document.add_heading("1.1.1 공사기간의 정의", level=3)

    document.add_paragraph(
        "• 공사기간은 건설공사 계약의 착수일로부터 완료일까지의 기간을 의미하며, "
        "준비기간과 비작업일수, 작업일수, 정리기간을 포함하여 산정한다."
    )

    p_formula = document.add_paragraph()
    p_formula.add_run("공사기간 = ①준비기간 + ②비작업일수 + ③작업일수 + ④정리기간").bold = True

    document.add_paragraph(
        "① 준비기간: 설계도서 검토, 안전관리계획서 작성·승인, 하도급업체 선정, 측량, "
        "현장사무소·세륜시설·가설건물 설치, 주요 자재·장비 조달 등 공사 착공 준비에 필요한 기간"
    )
    document.add_paragraph(
        "② 비작업일수: 법정공휴일 및 기상조건 등으로 작업이 불가능한 일수를 고려하여 산정한 기간"
    )
    document.add_paragraph(
        "③ 작업일수: 해당 공사의 공종별 수량을 실제 시공하는 데 필요한 총 작업일수"
    )
    document.add_paragraph(
        "④ 정리기간: 준공검사 준비, 시설물 인수 및 청소 등 현장 정리에 필요한 기간"
    )

    document.add_heading("1.1.2 ①준비기간과 ④정리기간", level=3)
    document.add_paragraph("• 준비기간 및 정리기간은 비작업일수를 별도로 계산하지 않는다.")
    document.add_paragraph(
        "• 공사 유형별 준비기간 예시를 참고하고 본 공사의 특성을 고려하여 산정한다 "
        "(예: 준비기간 45일 적용)."
    )

    document.add_paragraph("<참고> 건설공사 유형별 준비기간")
    ref_table = document.add_table(rows=1, cols=4)
    ref_table.style = "Table Grid"
    ref_headers = ref_table.rows[0].cells
    ref_headers[0].text = "공종"
    ref_headers[1].text = "준비기간"
    ref_headers[2].text = "공종"
    ref_headers[3].text = "준비기간"
    shade_header_row(ref_table)
    for left_type, left_days, right_type, right_days in PREP_REF_ROWS:
        row = ref_table.add_row().cells
        row[0].text = left_type
        row[1].text = left_days
        row[2].text = right_type
        row[3].text = right_days

    document.add_paragraph(
        "• 정리기간은 공정상 여유기간(buffer)과는 다르며, 공사 규모 및 난이도 등을 고려하여 산정한다."
    )
    document.add_paragraph(
        "• 일반적으로 주요 공종이 마무리된 이후 준공 전 1개월 범위에서 계산하며 "
        "(예: 정리기간 30일 적용)."
    )

    document.add_heading("1.2 근로시간 적용 기준", level=2)
    document.add_heading("1.2.1 근로시간 정의", level=3)
    document.add_paragraph("• 2021년 개정된 「근로기준법」상의 기준시간의 정의는 다음과 같다.")

    document.add_paragraph("<참고> 근로기준법 제50조 근로시간")
    labor50_table = document.add_table(rows=2, cols=2)
    labor50_table.style = "Table Grid"
    labor50_table.rows[0].cells[0].text = "조항"
    labor50_table.rows[0].cells[1].text = "조문"
    shade_header_row(labor50_table)
    labor50_table.rows[1].cells[0].text = "제50조\n(근로시간)"
    labor50_table.rows[1].cells[1].text = LABOR50_TEXT

    document.add_paragraph(
        "• 국토교통부 고시 「공공 건설공사의 공사기간 산정기준」상의 기준시간은 다음과 같다."
    )
    document.add_paragraph("<참고> 국토교통부 고시 공공 건설공사의 공사기간 산정기준 제11조 3항")
    guideline_table = document.add_table(rows=2, cols=2)
    guideline_table.style = "Table Grid"
    guideline_table.rows[0].cells[0].text = "조항"
    guideline_table.rows[0].cells[1].text = "조문"
    shade_header_row(guideline_table)
    guideline_table.rows[1].cells[0].text = "제11조\n(작업일수)"
    guideline_table.rows[1].cells[1].text = GUIDELINE_TEXT

    document.add_paragraph(
        "• 상기 법령의 정의를 기준으로 작업일수 산정 시 반영 → "
        "주 6일(일 8시간 작업) 적용"
    )
    document.add_paragraph(
        "• 단, 터널은 레미콘 주5일제/시험 발파 → "
        "주 5일(일 8시간 작업) 적용"
    )

    document.add_paragraph("<참고> 근로기준법 제53조 연장 근로의 제한")
    labor53_table = document.add_table(rows=2, cols=2)
    labor53_table.style = "Table Grid"
    labor53_table.rows[0].cells[0].text = "조항"
    labor53_table.rows[0].cells[1].text = "조문"
    shade_header_row(labor53_table)
    labor53_table.rows[1].cells[0].text = "제53조\n(연장 근로의 제한)"
    labor53_table.rows[1].cells[1].text = LABOR53_TEXT

    document.add_paragraph("• 상기 개정 법령의 연장근로는 주당 최대 12시간 그대로 유지")
    document.add_heading("1.2.2 근로시간 적용", level=3)
    document.add_paragraph(
        "• 근로기준법 및 국토교통부 고시의 기준을 바탕으로 개정 전/후를 아래와 같이 비교한다."
    )

    document.add_paragraph("<개정 전·후 주 최대 근로시간 비교표>")
    compare_table = document.add_table(rows=3, cols=5)
    compare_table.style = "Table Grid"
    compare_table.rows[0].cells[0].text = "기준(개정 전)"
    compare_table.rows[0].cells[1].text = "법정근로\n주 40시간"
    compare_table.rows[0].cells[2].text = "휴일근로\n16시간"
    compare_table.rows[0].cells[3].text = "주 최대 근로시간\n56시간"
    compare_table.rows[0].cells[4].text = "연장근로량\n12시간"
    shade_header_row(compare_table)

    compare_table.rows[1].cells[0].text = "개정(2018.7.1.)"
    compare_table.rows[1].cells[1].text = "법정근로\n주 40시간"
    compare_table.rows[1].cells[2].text = "-"
    compare_table.rows[1].cells[3].text = "주 최대 근로시간\n40시간"
    compare_table.rows[1].cells[4].text = "-"

    compare_table.rows[2].cells[0].text = "변경사항"
    compare_table.rows[2].cells[1].text = "<상동>"
    compare_table.rows[2].cells[2].text = "<감소>\n<16시간 감소>"
    compare_table.rows[2].cells[3].text = "<감소>"
    compare_table.rows[2].cells[4].text = "<상동>"

    document.add_paragraph(
        "• 기존 근로시간과의 차이로 휴일근로 16시간 감소에 따라 연장근로 12시간은 "
        "시공사가 필요 시 법령에 따라 실시하며, 근로시간은 간주하여 공기산정 "
        "근로시간에서는 제외한다."
    )
    document.add_paragraph("• 근로시간 적용방안의 예시는 아래와 같다.")

    document.add_paragraph("<참고> 근로시간 적용 방안 예시")
    policy_table = document.add_table(rows=2, cols=3)
    policy_table.style = "Table Grid"
    policy_table.rows[0].cells[0].text = "법정 근로시간(주 5일, 40시간)에 따른\n1달 공휴일 수 8일"
    policy_table.rows[0].cells[1].text = "기후여건으로 인한\n불능일 < 8일 적용 경우"
    policy_table.rows[0].cells[2].text = "기후여건으로 인한\n불능일 > 8일 적용 경우"
    shade_header_row(policy_table)

    policy_table.rows[1].cells[0].text = (
        "• 1주 공휴일 수 = 2일 (주7일 - 주5일 = 2일)\n"
        "• 1달 = 4주\n"
        "➡ 1달 공휴일수 = 4주×2일 = 8일"
    )
    policy_table.rows[1].cells[1].text = (
        "• 기후여건 불능일 7일\n"
        "• 법정 근로시간 휴일 8일\n"
        "➡ 비작업일수 8일 적용"
    )
    policy_table.rows[1].cells[2].text = (
        "• 기후여건 불능일 9일\n"
        "• 법정 근로시간 휴일 8일\n"
        "➡ 비작업일수 9일 적용"
    )

    document.add_heading("1.2.3 법정공휴일 수", level=3)
    document.add_paragraph(
        "• 비작업일수 산출을 위한 요소 중 법정공휴일은 공공 기준의 공휴일 데이터를 기준으로 산정하고, "
        "비작업일수에 포함하여 계산한다."
    )

    month_labels = [f"{month}월" for month in range(1, 13)]
    document.add_paragraph("월간 법정공휴일")
    holiday_table = document.add_table(rows=1, cols=14)
    holiday_table.style = "Table Grid"
    header = holiday_table.rows[0].cells
    header[0].text = "년도"
    for idx, label in enumerate(month_labels, start=1):
        header[idx].text = label
    header[13].text = "소계"
    shade_header_row(holiday_table)

    rows = public_holiday_rows or []
    if rows:
        for entry in rows:
            row = holiday_table.add_row().cells
            row[0].text = str(entry.get("year", "-"))
            monthly = entry.get("monthly", [])
            for idx in range(12):
                value = monthly[idx] if idx < len(monthly) else 0
                row[idx + 1].text = str(value)
            row[13].text = str(entry.get("total", sum(monthly[:12] if monthly else [])))
    else:
        row = holiday_table.add_row().cells
        row[0].text = "데이터 없음"
        for idx in range(1, 14):
            row[idx].text = "-"

    if rows:
        start_year = rows[0]["year"]
        end_year = rows[min(3, len(rows) - 1)]["year"]
        document.add_paragraph(
            f"• 부록 1의 법정 공휴일수 중 당해 공사에 포함되는 {start_year}~{end_year}년 데이터를 적용"
        )
    else:
        document.add_paragraph("• 법정 공휴일 데이터가 없어 표를 산정하지 못함")

    document.add_paragraph(
        "• 당해 공사의 개시일부터 종료일 사이에 포함된 일수를 모두 계산하며, "
        "해당 프로젝트의 조건에 따라 적용범위를 조정한다."
    )
    document.add_paragraph(
        "• 주6일(일요일 휴무) + 필수공휴일(신정, 구정, 근로자의날, 추석, 크리스마스, 선거, 일요일) "
        "기준으로 적용한다."
    )

    document.add_paragraph("※ 공공의 공휴일")
    for bullet in HOLIDAY_PUBLIC_BULLETS:
        document.add_paragraph(bullet)

    document.add_heading("1.3 비작업일수 산정", level=2)
    document.add_heading("1.3.1 개요", level=3)
    document.add_paragraph(
        "• 비작업일수(공사불능일수)의 산정기준은 국토부 고시에 명시된 산출방식에 따라 도출한다."
    )

    p_formula2 = document.add_paragraph()
    p_formula2.add_run(
        "비작업일수 = 기후여건 비작업일수(A) + 해당 월 법정공휴일(B) - 월별 중복일수(C)"
    ).bold = True
    document.add_paragraph("(소수점 첫째자리에서 반올림)")

    document.add_paragraph("• 주 40시간제에 따른 비작업일수 검토")
    document.add_paragraph(
        "- 월간 비작업일수가 주 40시간 근무제에 따른 일수보다 작을 경우에는 "
        "주 40시간 근무제에 따른 비작업일수를 적용한다."
    )
    document.add_paragraph("- 주 40시간제에 따른 비작업일수는 월 8일로 계산한다.")
    document.add_paragraph(
        "- 비작업일수(공사불능일수)는 기후여건과 법정 공휴일이 중복된 경우 1일로 산정한다."
    )

    abc_table = document.add_table(rows=2, cols=3)
    abc_table.style = "Table Grid"
    abc_table.rows[0].cells[0].text = "기후여건으로 인한 비작업일수(A)"
    abc_table.rows[0].cells[1].text = "법정공휴일수(B)"
    abc_table.rows[0].cells[2].text = "중복일수(C)"
    shade_header_row(abc_table)
    abc_table.rows[1].cells[0].text = (
        "• 기후여건: 기온, 강우, 바람, 적설\n"
        "• 주공정에 영향을 미치는 기상조건 반영\n"
        "• 해당지역 최근 10년간의 기상정보(기상청 기상관측 데이터 적용)\n"
        "• 관계법령과 기준에 공통되는 작업을 제한하는 기상조건 반영"
    )
    abc_table.rows[1].cells[1].text = (
        "• 일요일\n"
        "• 명절: 설연휴, 추석연휴\n"
        "• 국경일: 삼일절, 현충일, 광복절, 개천절, 한글날 등\n"
        "• 기타: 신정, 성탄절, 석가탄신일, 어린이날, 대체휴무 포함"
    )
    abc_table.rows[1].cells[2].text = "• A×B÷달력일수"

    document.add_paragraph("• 아래의 예시와 같이 비작업일수를 산정")
    document.add_paragraph("<예시> 토목공사 비작업일수 산정 (01월 기준)")

    example_table = document.add_table(rows=3, cols=9)
    example_table.style = "Table Grid"
    example_table.rows[0].cells[0].text = "구분"
    example_table.rows[0].cells[1].text = "평균기온"
    example_table.rows[0].cells[2].text = "최고기온"
    example_table.rows[0].cells[3].text = "강우"
    example_table.rows[0].cells[4].text = "미세먼지"
    example_table.rows[0].cells[5].text = "계(A)"
    example_table.rows[0].cells[6].text = "법정공휴일(B)"
    example_table.rows[0].cells[7].text = "중복일수(C)"
    example_table.rows[0].cells[8].text = "비작업일수(A+B-C)"
    shade_header_row(example_table)

    example_table.rows[1].cells[0].text = "토목공사"
    example_table.rows[1].cells[1].text = "-5℃ 이하"
    example_table.rows[1].cells[2].text = "35℃ 이상"
    example_table.rows[1].cells[3].text = "10mm 이상"
    example_table.rows[1].cells[4].text = "경보 발령시"

    example_table.rows[2].cells[1].text = "1.6일"
    example_table.rows[2].cells[2].text = "0.0일"
    example_table.rows[2].cells[3].text = "0.3일"
    example_table.rows[2].cells[4].text = "0.1일"
    example_table.rows[2].cells[5].text = "2.0일"
    example_table.rows[2].cells[6].text = "6.7일"
    example_table.rows[2].cells[7].text = "0.4일"
    example_table.rows[2].cells[8].text = "8.3일"

    for line in NON_WORK_EXAMPLE_TEXTS:
        document.add_paragraph(line)

    document.add_heading("1.3.2 기후 여건으로 인한 비작업일수", level=3)
    document.add_paragraph(
        "• 국토부 고시 부록 3에 제시된 기상 조건별·지역별 비작업일수 조건을 기준으로 검토한다."
    )
    document.add_paragraph(
        "- 해당 공사 지역의 최근 10년 기상관측자료를 반영하며, 당해 공사지역과 가장 인접한 "
        "기상관측자료(예: 인천 기상청 관측자료)를 적용한다."
    )
    document.add_paragraph("- 미세먼지: 미세먼지 경보 발령일 자료를 적용한다.")
    document.add_paragraph(
        "- 관계 법령 및 표준시방서를 검토한 기준으로 적용기준을 검토하고, "
        "주 공정(Critical Path)에 영향을 미치는 기상조건을 반영한다."
    )

    document.add_paragraph("기후 여건으로 인한 비작업일수 적용기준")
    criteria_table = document.add_table(rows=1, cols=4)
    criteria_table.style = "Table Grid"
    criteria_table.rows[0].cells[0].text = "데이터"
    criteria_table.rows[0].cells[1].text = "구분"
    criteria_table.rows[0].cells[2].text = "세부기준"
    criteria_table.rows[0].cells[3].text = "적용여부"
    shade_header_row(criteria_table)

    rows = climate_criteria_rows or []
    if rows:
        for entry in rows:
            row = criteria_table.add_row().cells
            row[0].text = entry.get("data_source", "경기도 인천시 기상관측 자료")
            row[1].text = entry.get("group", "-")
            row[2].text = entry.get("detail", "-")
            row[3].text = entry.get("apply_text", "-")
    else:
        row = criteria_table.add_row().cells
        row[0].text = "경기도 인천시 기상관측 자료"
        row[1].text = "-"
        row[2].text = "적용기준 데이터 없음"
        row[3].text = "-"

    merge_same_text_cells(criteria_table, col_idx=0, start_row=1)
    merge_same_text_cells(criteria_table, col_idx=1, start_row=1)

    document.add_paragraph("공종별 기후여건으로 인한 비작업일수 적용기준")
    category_table = document.add_table(rows=1, cols=7)
    category_table.style = "Table Grid"
    category_table.rows[0].cells[0].text = "구분"
    category_table.rows[0].cells[1].text = "평균기온"
    category_table.rows[0].cells[2].text = "최고기온"
    category_table.rows[0].cells[3].text = "강우"
    category_table.rows[0].cells[4].text = "적설"
    category_table.rows[0].cells[5].text = "최대순간풍속"
    category_table.rows[0].cells[6].text = "미세먼지"
    shade_header_row(category_table)

    if climate_category_rows:
        for entry in climate_category_rows:
            row = category_table.add_row().cells
            row[0].text = entry.get("category", "-")
            row[1].text = entry.get("avg_temp", "-")
            row[2].text = entry.get("max_temp", "-")
            row[3].text = entry.get("rain", "-")
            row[4].text = entry.get("snow", "-")
            row[5].text = entry.get("wind", "-")
            row[6].text = entry.get("dust", "-")
    else:
        row = category_table.add_row().cells
        row[0].text = "데이터 없음"
        for idx in range(1, 7):
            row[idx].text = "-"

    year_text = monthly_year_range or "-"
    document.add_paragraph(f"조건별 월평균 기상일수 ({year_text})")
    monthly_table = document.add_table(rows=1, cols=13)
    monthly_table.style = "Table Grid"
    monthly_table.rows[0].cells[0].text = "기상 기준"
    for month in range(1, 13):
        monthly_table.rows[0].cells[month].text = f"{month}월"
    shade_header_row(monthly_table)

    if monthly_condition_rows:
        for entry in monthly_condition_rows:
            row = monthly_table.add_row().cells
            row[0].text = entry.get("label", "-")
            monthly = entry.get("monthly", [])
            for month_idx in range(12):
                value = monthly[month_idx] if month_idx < len(monthly) else None
                row[month_idx + 1].text = format_number(value, digits=1)
    else:
        row = monthly_table.add_row().cells
        row[0].text = "데이터 없음"
        for idx in range(1, 13):
            row[idx].text = "-"

    _add_operating_rate_section(document, operating_rate_calc_data)
    _add_calendar_section(document, operating_rate_calc_data)
    _add_standard_productivity_section(
        document,
        ordered_categories=ordered_categories,
        grouped_items=grouped_items,
    )
    _add_calendar_day_output_section(
        document,
        ordered_categories=ordered_categories,
        grouped_items=grouped_items,
        rate_map=rate_map,
    )
    _add_schedule_write_criteria_section(
        document,
        ordered_categories=ordered_categories,
        grouped_items=grouped_items,
        operating_rate_calc_data=operating_rate_calc_data,
        project_overview=project_overview,
    )
    _add_schedule_chart_section(
        document,
        project_name=project_name,
        gantt_image_bytes=gantt_image_bytes,
    )
    _add_weather_appendix_section(
        document,
        weather_appendix_data=weather_appendix_data,
    )
    document.add_paragraph("")


def _add_operating_rate_section(document, operating_rate_calc_data):
    document.add_heading("1.3.3 공사가동률 산정", level=3)
    calc_data = operating_rate_calc_data or {}
    document.add_paragraph(calc_data.get("note", "※ 프로젝트 데이터 기준 공사 가동률"))

    columns = calc_data.get("columns") or []
    if not columns:
        document.add_paragraph("가동률 산정 데이터 없음")
        return

    rate_table = document.add_table(rows=1, cols=3 + len(columns))
    rate_table.style = "Table Grid"
    rate_table.rows[0].cells[0].text = "구분"
    rate_table.rows[0].cells[1].text = "작업명"
    for idx, col in enumerate(columns, start=2):
        rate_table.rows[0].cells[idx].text = col.get("label", "-")
    rate_table.rows[0].cells[2 + len(columns)].text = "비고"
    shade_header_row(rate_table)

    def _add_row(group, task_name, key, digits=1, percent=False, note=""):
        row = rate_table.add_row().cells
        row[0].text = group
        row[1].text = task_name
        for idx, col in enumerate(columns, start=2):
            value = calc_data.get("calendar_days") if key == "calendar_days" else col.get(key)
            if key == "thresholds":
                value = (value or {}).get(task_name)
                row[idx].text = value or "-"
            elif percent:
                number = to_number(value)
                row[idx].text = f"{number:.1f}%" if number is not None else "-"
            else:
                number = to_number(value)
                row[idx].text = format_number(number, digits=digits) if number is not None else "-"
        row[2 + len(columns)].text = note

    for col in columns:
        thresholds = col.get("thresholds") or {}
        col["thresholds"] = {
            "동절기 최고기온(℃이하)": thresholds.get("winter_max_text", "-"),
            "동절기 평균기온(℃이하)": thresholds.get("winter_avg_text", "-"),
            "혹서기 최고기온(℃이상)": thresholds.get("summer_text", "-"),
            "일 강수량(mm이상)": thresholds.get("rain_text", "-"),
            "신적설(cm이상)": thresholds.get("snow_text", "-"),
            "최대순간풍속(m/s이상)": thresholds.get("wind_text", "-"),
            "미세먼지": thresholds.get("dust_text", "-"),
        }
        col["winter_max_days"] = thresholds.get("winter_max_days")
        col["winter_avg_days"] = thresholds.get("winter_avg_days")
        col["summer_days"] = thresholds.get("summer_days")
        col["rain_days"] = thresholds.get("rain_days")
        col["snow_days"] = thresholds.get("snow_days")
        col["wind_days"] = thresholds.get("wind_days")
        col["dust_days"] = thresholds.get("dust_days")

    for task_name in OPERATING_RATE_THRESHOLD_TASKS:
        _add_row("기후조건", task_name, "thresholds", digits=1)

    _add_row("조건별 기상여건 일수", "동절기 최고기온(℃이하)", "winter_max_days")
    _add_row("조건별 기상여건 일수", "동절기 평균기온(℃이하)", "winter_avg_days")
    _add_row("조건별 기상여건 일수", "혹서기 최고기온(℃이상)", "summer_days")
    _add_row("조건별 기상여건 일수", "일 강수량(mm이상)", "rain_days")
    _add_row("조건별 기상여건 일수", "신적설(cm이상)", "snow_days")
    _add_row("조건별 기상여건 일수", "최대순간풍속(m/s이상)", "wind_days")
    _add_row("조건별 기상여건 일수", "미세먼지", "dust_days")

    _add_row("", "소계", "subtotal_days")
    _add_row("법정공휴일", "공휴일", "legal_holidays", digits=0)
    _add_row(f"{calc_data.get('base_year', '-')}년", "달력일수", "calendar_days", digits=0)
    _add_row("연간", "중복일수", "overlap_days", digits=0)
    _add_row("연간", "공사불능일", "non_working_days", digits=0)
    _add_row("연간", "작업가능일", "working_days", digits=0)
    _add_row("연간", "가동률", "operating_rate", percent=True)

    merge_same_text_cells(rate_table, col_idx=0, start_row=1)


def _add_calendar_section(document, operating_rate_calc_data):
    document.add_heading("1.3.4 공사별 적용 캘린더", level=3)
    calc_data = operating_rate_calc_data or {}
    calendars = calc_data.get("calendars") or []
    if not calendars:
        document.add_paragraph("공종별 캘린더 데이터 없음")
        return

    def _circled_number(number):
        if 1 <= number <= 20:
            return chr(0x245F + number)
        return str(number)

    for calendar in calendars:
        idx = calendar.get("index", 0)
        category = calendar.get("category", "-")
        calendar_name = calendar.get("calendar_name", f"Calendar {idx:02d}")
        document.add_paragraph(f"{_circled_number(idx)} {category} - {calendar_name}")

        table = document.add_table(rows=2, cols=13)
        table.style = "Table Grid"

        # Header row 1 (group headers)
        table.rows[0].cells[0].text = "구분"
        table.rows[0].cells[1].text = "기후여건으로 인한 비작업일수"
        table.rows[0].cells[7].text = "월간"
        table.cell(0, 1).merge(table.cell(0, 6))
        table.cell(0, 7).merge(table.cell(0, 12))
        table.cell(0, 0).merge(table.cell(1, 0))

        criteria_codes = calendar.get("criteria_codes") or {}
        # Header row 2 (column headers)
        table.rows[1].cells[1].text = f"동절기\n{criteria_codes.get('winter', '-')}"
        table.rows[1].cells[2].text = f"혹서기\n{criteria_codes.get('summer', '-')}"
        table.rows[1].cells[3].text = f"강수량\n{criteria_codes.get('rain', '-')}"
        table.rows[1].cells[4].text = f"적설량\n{criteria_codes.get('snow', '-')}"
        table.rows[1].cells[5].text = f"풍속\n{criteria_codes.get('wind', '-')}"
        table.rows[1].cells[6].text = f"미세먼지\n{criteria_codes.get('dust', '-')}"
        table.rows[1].cells[7].text = "소계"
        table.rows[1].cells[8].text = "공휴일"
        table.rows[1].cells[9].text = "중복일"
        table.rows[1].cells[10].text = "공사불능일"
        table.rows[1].cells[11].text = "작업가능일"
        table.rows[1].cells[12].text = "작업가동률"

        shade_header_row(table, row_idx=0)
        shade_header_row(table, row_idx=1)

        for row_data in (calendar.get("rows") or []):
            row = table.add_row().cells
            row[0].text = f"{row_data.get('month', '-')}월"
            row[1].text = format_number(row_data.get("winter"), digits=1)
            row[2].text = format_number(row_data.get("summer"), digits=1)
            row[3].text = format_number(row_data.get("rain"), digits=1)
            row[4].text = format_number(row_data.get("snow"), digits=1)
            row[5].text = format_number(row_data.get("wind"), digits=1)
            row[6].text = format_number(row_data.get("dust"), digits=1)
            row[7].text = format_number(row_data.get("subtotal"), digits=1)
            row[8].text = format_number(row_data.get("holiday"), digits=1)
            row[9].text = format_number(row_data.get("overlap"), digits=1)
            row[10].text = format_number(row_data.get("non_working"), digits=1)
            row[11].text = format_number(row_data.get("workable"), digits=1)
            rate = to_number(row_data.get("rate"))
            row[12].text = f"{rate:.1f}%" if rate is not None else "-"

        annual = calendar.get("annual") or {}
        row = table.add_row().cells
        row[0].text = "계"
        row[1].text = format_number(annual.get("winter"), digits=1)
        row[2].text = format_number(annual.get("summer"), digits=1)
        row[3].text = format_number(annual.get("rain"), digits=1)
        row[4].text = format_number(annual.get("snow"), digits=1)
        row[5].text = format_number(annual.get("wind"), digits=1)
        row[6].text = format_number(annual.get("dust"), digits=1)
        row[7].text = format_number(annual.get("subtotal"), digits=1)
        row[8].text = format_number(annual.get("holiday"), digits=1)
        row[9].text = format_number(annual.get("overlap"), digits=1)
        row[10].text = format_number(annual.get("non_working"), digits=1)
        row[11].text = format_number(annual.get("workable"), digits=1)
        annual_rate = to_number(annual.get("rate"))
        row[12].text = f"{annual_rate:.1f}%" if annual_rate is not None else "-"

        document.add_paragraph("")


def _add_standard_productivity_section(document, ordered_categories=None, grouped_items=None):
    def _num_or_none(value):
        number = to_number(value)
        return number if number is not None else None

    def _remarks_text(item):
        return str(item.get("remarks") or "").strip().upper()

    def _code_text(item):
        return str(item.get("standard_code") or "").strip().upper()

    def _is_standard_applied(item):
        if _code_text(item):
            return True
        if _num_or_none(item.get("pumsam_workload")) not in (None, 0):
            return True
        if _num_or_none(item.get("molit_workload")) not in (None, 0):
            return True
        remarks = _remarks_text(item)
        if "표준품셈" in remarks or "가이드라인" in remarks:
            return True
        return False

    def _basis_text(item):
        remarks = _remarks_text(item)
        if "가이드라인" in remarks:
            return "가이드라인\n기준"
        if "표준품셈" in remarks:
            return "품셈\n기준"

        pumsam = _num_or_none(item.get("pumsam_workload"))
        molit = _num_or_none(item.get("molit_workload"))
        if pumsam not in (None, 0) and molit not in (None, 0):
            return "품셈/가이드라인\n기준"
        if pumsam not in (None, 0):
            return "품셈\n기준"
        if molit not in (None, 0):
            return "가이드라인\n기준"
        code = _code_text(item)
        if any(token in code for token in ("MOLIT", "GUIDE", "GL")):
            return "가이드라인\n기준"
        if code:
            return "품셈\n기준"
        return "적용"

    def _production_text(item):
        productivity = _num_or_none(item.get("productivity"))
        daily = _num_or_none(item.get("daily_production"))
        unit = str(item.get("unit") or "").strip()
        if productivity not in (None, 0):
            value = f"{productivity:g}"
        elif daily not in (None, 0):
            value = f"{daily:g}"
        else:
            return "-"
        unit_part = f"{unit}" if unit else ""
        return f"{value}{unit_part}/일"

    ordered_categories = list(ordered_categories or [])
    grouped_items = grouped_items or {}

    document.add_heading("1.4 공종별 표준작업량 산정", level=2)
    section_index = 1
    any_rows = False

    for main_category in ordered_categories:
        items = grouped_items.get(main_category) or []
        rows = []
        dedupe = set()
        for item in items:
            if not _is_standard_applied(item):
                continue
            work_name = (
                str(item.get("work_type") or "").strip()
                or str(item.get("process") or "").strip()
                or "작업"
            )
            row_tuple = (work_name, _production_text(item), _basis_text(item))
            if row_tuple in dedupe:
                continue
            dedupe.add(row_tuple)
            rows.append(row_tuple)

        if not rows:
            continue

        any_rows = True
        document.add_heading(
            f"1.4.{section_index} {main_category}: 표준품셈 및 가이드 라인 기준 적용",
            level=3,
        )
        section_index += 1

        table = document.add_table(rows=1, cols=3)
        table.style = "Table Grid"
        table.rows[0].cells[0].text = "구분"
        table.rows[0].cells[1].text = "일생산량"
        table.rows[0].cells[2].text = "비고"
        shade_header_row(table)

        for work_name, production, note in rows:
            row = table.add_row().cells
            row[0].text = work_name
            row[1].text = production
            row[2].text = note

        document.add_paragraph("")

    if not any_rows:
        document.add_paragraph("대공종별 표준품셈 적용 데이터 없음")


def _add_calendar_day_output_section(document, ordered_categories=None, grouped_items=None, rate_map=None):
    def _num_or_dash(value, digits=1):
        number = to_number(value)
        if number is None:
            return "-"
        if digits == 0:
            return format_number(number, digits=0)
        return format_number(number, digits=digits)

    def _rate_text(rate_value, visible=True):
        if not visible:
            return "-"
        number = to_number(rate_value)
        return f"{number:.1f}%" if number is not None else "-"

    def _create_category_table(category, items, show_rate):
        document.add_paragraph(category)
        table = document.add_table(rows=1, cols=13)
        table.style = "Table Grid"
        headers = [
            "구분",
            "공정",
            "단위",
            "수량",
            "단위 작업량",
            "인원/장비",
            "작업조 생산성",
            "투입조",
            "생산량/일",
            "W/D",
            "가동율",
            "C/D",
            "비고",
        ]
        for idx, title in enumerate(headers):
            table.rows[0].cells[idx].text = title
        shade_header_row(table)

        rate_value = (rate_map or {}).get(category)
        for item in items:
            productivity = to_number(item.get("productivity"))
            unit_manpower = to_number(item.get("unit_manpower")) or 1.0
            crew_size = to_number(item.get("crew_size"))
            daily_production = to_number(item.get("daily_production"))

            if daily_production is None and productivity is not None and crew_size is not None:
                daily_production = productivity * crew_size

            team_productivity = (
                productivity * unit_manpower if productivity is not None else None
            )

            note_text = str(item.get("note") or "").strip() or str(item.get("remarks") or "").strip() or "-"
            row = table.add_row().cells
            row[0].text = str(item.get("process") or "-")
            row[1].text = str(item.get("work_type") or "-")
            row[2].text = str(item.get("unit") or "-")
            row[3].text = _num_or_dash(item.get("quantity"), digits=1)
            row[4].text = _num_or_dash(productivity, digits=3)
            row[5].text = _num_or_dash(unit_manpower, digits=0)
            row[6].text = _num_or_dash(team_productivity, digits=3)
            row[7].text = _num_or_dash(crew_size, digits=1)
            row[8].text = _num_or_dash(daily_production, digits=3)
            row[9].text = _num_or_dash(item.get("working_days"), digits=1)
            row[10].text = _rate_text(rate_value, visible=show_rate)
            row[11].text = _num_or_dash(item.get("calendar_days"), digits=1)
            row[12].text = note_text

        merge_same_text_cells(table, col_idx=0, start_row=1)
        document.add_paragraph("")

    ordered_categories = list(ordered_categories or [])
    grouped_items = grouped_items or {}
    rate_map = rate_map or {}

    document.add_heading("1.5 실공사기간 Calendar Day 산출", level=2)

    prep_categories = [c for c in ordered_categories if "준비" in str(c)]
    civil_categories = [c for c in ordered_categories if c not in prep_categories]

    if prep_categories:
        document.add_heading("1.5.1 공사준비", level=3)
        document.add_paragraph("※ 준비기간은 비작업일수를 계상하지 않음.")
        for category in prep_categories:
            items = grouped_items.get(category) or []
            if not items:
                continue
            _create_category_table(category, items, show_rate=False)

    document.add_heading("1.5.2 토목공사", level=3)
    if not civil_categories:
        document.add_paragraph("토목공사 데이터 없음")
        return

    first_category = civil_categories[0]
    first_rate = to_number(rate_map.get(first_category))
    if first_rate is not None:
        document.add_paragraph(f"※ 가동율 : Cal1({first_category}) - {first_rate:.1f}%")
    else:
        document.add_paragraph("※ 가동율 : -")

    for idx, category in enumerate(civil_categories):
        items = grouped_items.get(category) or []
        if not items:
            continue
        _create_category_table(category, items, show_rate=(idx == 0))


def _add_schedule_write_criteria_section(
    document,
    ordered_categories=None,
    grouped_items=None,
    operating_rate_calc_data=None,
    project_overview=None,
):
    def _round_day(value):
        number = to_number(value)
        if number is None:
            return None
        return int(number + 0.5) if number >= 0 else int(number - 0.5)

    def _month_text(day_value):
        if day_value is None:
            return "-"
        return f"{(day_value / 30.4):.1f}"

    def _clean_category_text(text):
        cleaned = re.sub(r"^\s*\d+\s*[\.\)]\s*", "", str(text or "").strip())
        return cleaned or "-"

    def _normalized_key(text):
        compact = re.sub(r"\s+", "", _clean_category_text(text))
        if "정리" in compact or "준공준비" in compact:
            return "cleanup"
        if "준비" in compact:
            return "preparation"
        if "토공" in compact:
            return "토공사"
        if "골조공" in compact:
            return "골조공사"
        if "내부" in compact and "마감" in compact:
            return "내부마감공사"
        if "외부" in compact and "마감" in compact:
            return "외부마감공사"
        if "골조타설" in compact or "타설" in compact:
            return "골조타설"
        return compact or "-"

    ordered_categories = list(ordered_categories or [])
    grouped_items = grouped_items or {}
    calc_data = operating_rate_calc_data or {}
    overview = project_overview or {}

    non_work_map = {}
    for col in (calc_data.get("columns") or []):
        label = col.get("label")
        if not label:
            continue
        non_work_map[_normalized_key(label)] = _round_day(col.get("non_working_days")) or 0

    rows = []
    prep_total = 0
    cleanup_total = 0
    non_work_total = 0
    working_total = 0
    applied_total = 0

    prep_rows = []
    main_rows = []
    cleanup_rows = []

    for category in ordered_categories:
        items = grouped_items.get(category) or []
        if not items:
            continue
        key = _normalized_key(category)
        working_days = sum(to_number(item.get("working_days")) or 0 for item in items)
        working_days_round = _round_day(working_days) or 0

        if key == "preparation":
            non_work_days = None
            prep_total += working_days_round
        elif key == "cleanup":
            non_work_days = None
            cleanup_total += working_days_round
        else:
            non_work_days = non_work_map.get(key, 0)
            non_work_total += non_work_days

        applied_days = working_days_round + (non_work_days or 0)
        working_total += working_days_round
        applied_total += applied_days

        row_data = {
            "name": _clean_category_text(category),
            "non_work": non_work_days,
            "working": working_days_round,
            "applied": applied_days,
        }
        if key == "preparation":
            prep_rows.append(row_data)
        elif key == "cleanup":
            cleanup_rows.append(row_data)
        else:
            main_rows.append(row_data)

    rows.extend(prep_rows)
    rows.extend(main_rows)
    rows.extend(cleanup_rows)

    pure_work_days = max(working_total - prep_total - cleanup_total, 0)
    total_project_days = prep_total + non_work_total + pure_work_days + cleanup_total

    document.add_heading("1.6 공사예정공정표 작성기준", level=2)
    document.add_heading(
        "1.6.1 공사기간 산출 [국토교통부 고시 제 2021-1080호 제6조(공사기간 산정) 준용]",
        level=3,
    )

    document.add_paragraph("① 비작업일수 · 작업일수 산정 : 공종별로 산정 (주공정 선상에 있는 대공종 기준)")
    table_main = document.add_table(rows=1, cols=4)
    table_main.style = "Table Grid"
    table_main.rows[0].cells[0].text = "주공정"
    table_main.rows[0].cells[1].text = "비작업일수"
    table_main.rows[0].cells[2].text = "작업일수"
    table_main.rows[0].cells[3].text = "적용일수"
    shade_header_row(table_main)

    if rows:
        for row_data in rows:
            row = table_main.add_row().cells
            row[0].text = row_data["name"]
            row[1].text = "-" if row_data["non_work"] is None else f"{row_data['non_work']}일"
            row[2].text = f"{row_data['working']}일"
            row[3].text = f"{row_data['applied']}일"
    else:
        row = table_main.add_row().cells
        row[0].text = "데이터 없음"
        row[1].text = "-"
        row[2].text = "-"
        row[3].text = "-"

    total_row = table_main.add_row().cells
    total_row[0].text = "합 계"
    total_row[1].text = f"{non_work_total}일"
    total_row[2].text = f"{working_total}일"
    total_row[3].text = f"{applied_total}일"

    document.add_paragraph("② 공사기간 산정")
    table_period = document.add_table(rows=1, cols=4)
    table_period.style = "Table Grid"
    table_period.rows[0].cells[0].text = "구 분"
    table_period.rows[0].cells[1].text = "일 수"
    table_period.rows[0].cells[2].text = "개 월"
    table_period.rows[0].cells[3].text = "기준"
    shade_header_row(table_period)

    period_rows = [
        ("총공사기간", total_project_days, _month_text(total_project_days), "-"),
        ("준비기간", prep_total, _month_text(prep_total), "제7조(준비기간 산정)"),
        (
            "비작업일수",
            non_work_total,
            _month_text(non_work_total),
            "제8조(비작업일수), 제9조(법정공휴일 수 계산), 제10조(기후조건으로 인한 비작업일수)",
        ),
        ("작업일수", pure_work_days, _month_text(pure_work_days), "제11조(작업일수)"),
        ("정리기간", cleanup_total, _month_text(cleanup_total), "제12조(정리기간 산정)"),
    ]
    for name, day_value, month_value, ref_text in period_rows:
        row = table_period.add_row().cells
        row[0].text = name
        row[1].text = f"{day_value:,}일"
        row[2].text = f"{month_value}개월" if month_value != "-" else "-"
        row[3].text = ref_text

    document.add_paragraph("③ 표준공기 산정공식을 활용한 비교·검증")
    table_formula = document.add_table(rows=1, cols=4)
    table_formula.style = "Table Grid"
    table_formula.rows[0].cells[0].text = "구분"
    table_formula.rows[0].cells[1].text = "변수"
    table_formula.rows[0].cells[2].text = "값"
    table_formula.rows[0].cells[3].text = "기준"
    shade_header_row(table_formula)

    total_floor_area = to_number(overview.get("total_floor_area"))
    area_100m2 = (total_floor_area / 100.0) if total_floor_area is not None else None
    ground_floors = overview.get("ground_floors")
    basement_floors = overview.get("basement_floors")

    formula_rows = [
        ("총공기", "Y", f"{total_project_days:,}", "실공사기간"),
        ("총공사비(억원)", "C", "-", "프로젝트 공사비 입력값"),
        ("연면적(100㎡)", "A", f"{area_100m2:,.1f}" if area_100m2 is not None else "-", "연면적 ÷ 100"),
        ("지상층수(층)", "G", str(ground_floors) if ground_floors is not None else "-", "지상층수"),
        ("지하층수(층)", "B", str(basement_floors) if basement_floors is not None else "-", "지하층수"),
    ]
    for label, var_name, value_text, ref_text in formula_rows:
        row = table_formula.add_row().cells
        row[0].text = label
        row[1].text = var_name
        row[2].text = value_text
        row[3].text = ref_text


def _add_schedule_chart_section(document, project_name="", gantt_image_bytes=None):
    document.add_heading("1.7 공사예정 공정표", level=2)
    title_name = str(project_name or "프로젝트").strip()
    document.add_heading(f"1.7.1 공사예정공정표({title_name})", level=3)

    if not gantt_image_bytes:
        document.add_paragraph("공정표 이미지 생성 데이터가 없어 삽입하지 못했습니다.")
        return

    try:
        image_stream = BytesIO(gantt_image_bytes)
        section = document.sections[-1]
        max_width = section.page_width - section.left_margin - section.right_margin
        paragraph = document.add_paragraph()
        paragraph.alignment = 1
        paragraph.add_run().add_picture(image_stream, width=max_width)
    except Exception:
        document.add_paragraph("공정표 이미지 삽입에 실패했습니다.")


def _add_weather_appendix_section(document, weather_appendix_data=None):
    def _format_trimmed(value, digits=1):
        number = to_number(value)
        if number is None:
            return "-"
        text = f"{number:.{digits}f}"
        if "." in text:
            text = text.rstrip("0").rstrip(".")
        return text

    appendix_data = weather_appendix_data or {}
    appendices = appendix_data.get("appendices") or []
    region_label = appendix_data.get("region_label", "가동률 지역")
    period_label = appendix_data.get("period_label", "-")

    if not appendices:
        return

    document.add_heading("1.8 별첨", level=2)

    for appendix in appendices:
        number = appendix.get("number")
        title = appendix.get("title", "휴지일수 년도별 집계표")
        avg_digits = int(appendix.get("avg_digits", 1))
        heading = (
            f"별첨.{number} {title}(현장 최근거리 {region_label}관측소 "
            f"{period_label} 평균)"
        )
        document.add_heading(heading, level=3)

        for case in (appendix.get("cases") or []):
            case_label = case.get("case_label", "-")
            applied_categories = case.get("applied_categories") or []
            applied_text = ", ".join(applied_categories) if applied_categories else "-"
            document.add_paragraph(f"{case_label} ({applied_text} 적용)")

            table = document.add_table(rows=1, cols=13)
            table.style = "Table Grid"
            table.rows[0].cells[0].text = "년도"
            for month in range(1, 13):
                table.rows[0].cells[month].text = f"{month}월"
            shade_header_row(table)

            for row_data in (case.get("rows") or []):
                row = table.add_row().cells
                row[0].text = str(row_data.get("year", "-"))
                monthly = row_data.get("monthly") or []
                for month_idx in range(12):
                    value = monthly[month_idx] if month_idx < len(monthly) else 0
                    row[month_idx + 1].text = format_number(value, digits=1)

            avg_row = table.add_row().cells
            avg_row[0].text = "평균"
            avg_monthly = case.get("average") or []
            for month_idx in range(12):
                value = avg_monthly[month_idx] if month_idx < len(avg_monthly) else 0
                avg_row[month_idx + 1].text = _format_trimmed(value, digits=avg_digits)

            if number == 6:
                document.add_paragraph("- ※ 소수점 둘째자리는 반올림하여 산정함.")
            document.add_paragraph("")

    yearly_status = appendix_data.get("yearly_status") or {}
    yearly_tables = yearly_status.get("tables") or []
    if yearly_tables:
        document.add_heading("<별첨> 년도별 기상 휴지일수 현황", level=3)
        for status_table in yearly_tables:
            source_label = status_table.get("source_label", "-")
            station_id = status_table.get("station_id", "-")
            table_region = status_table.get("region_label", region_label)
            year = status_table.get("year", "-")
            document.add_paragraph(f"[ {source_label} | {station_id} {table_region} / {year}년 ]")

            table = document.add_table(rows=1, cols=13)
            table.style = "Table Grid"
            table.rows[0].cells[0].text = ""
            for month in range(1, 13):
                table.rows[0].cells[month].text = f"{month}월"
            shade_header_row(table)

            for day_row in (status_table.get("rows") or []):
                row = table.add_row().cells
                row[0].text = f"{day_row.get('day', '-')}일"
                monthly = day_row.get("monthly") or []
                for month_idx in range(12):
                    value = monthly[month_idx] if month_idx < len(monthly) else None
                    row[month_idx + 1].text = format_number(value, digits=1) if value is not None else "-"

            avg_row = table.add_row().cells
            avg_row[0].text = "평균"
            avg_monthly = status_table.get("average") or []
            for month_idx in range(12):
                value = avg_monthly[month_idx] if month_idx < len(avg_monthly) else None
                avg_row[month_idx + 1].text = format_number(value, digits=1) if value is not None else "-"

            document.add_paragraph("")
