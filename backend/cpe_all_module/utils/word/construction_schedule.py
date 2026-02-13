"""Compatibility entrypoint for construction schedule Word report.

Actual implementation is split across:
- cs_template.py (static report template constants)
- cs_common.py (word/table helpers)
- cs_data.py (report data assembly)
- cs_section_duration.py (section renderer)
- cs_report.py (docx builder)
"""

from .cs_data import build_schedule_report_aux_data
from .cs_report import build_schedule_report_docx

__all__ = [
    "build_schedule_report_aux_data",
    "build_schedule_report_docx",
]
