"""Word report document builder."""

from io import BytesIO

from .cs_common import setup_document_defaults
from .cs_section_duration import add_duration_analysis_section


def build_schedule_report_docx(
    project_name,
    rate_summary,
    ordered_categories,
    grouped_items,
    rate_map,
    region="",
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
    try:
        from docx import Document
    except ImportError as exc:
        raise RuntimeError(
            "python-docx is required for report export. Install 'python-docx' in backend requirements."
        ) from exc

    # Keep signature for compatibility with current view calls.
    _ = (project_name, rate_summary, ordered_categories, grouped_items, rate_map, region)

    document = Document()
    setup_document_defaults(document)

    title = document.add_heading("공사기간 산정 보고서", level=0)
    title.alignment = 1

    add_duration_analysis_section(
        document,
        ordered_categories=ordered_categories,
        grouped_items=grouped_items,
        rate_map=rate_map,
        project_name=project_name,
        gantt_image_bytes=gantt_image_bytes,
        project_overview=project_overview,
        public_holiday_rows=public_holiday_rows,
        climate_criteria_rows=climate_criteria_rows,
        climate_category_rows=climate_category_rows,
        monthly_condition_rows=monthly_condition_rows,
        monthly_year_range=monthly_year_range,
        operating_rate_calc_data=operating_rate_calc_data,
        weather_appendix_data=weather_appendix_data,
    )

    output = BytesIO()
    document.save(output)
    output.seek(0)
    return output.read()
