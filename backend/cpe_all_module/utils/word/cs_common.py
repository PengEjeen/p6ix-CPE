"""Common helpers for Word report rendering."""

from decimal import Decimal


def set_cell_shading(cell, fill="EDEDED"):
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    tc_pr = cell._tc.get_or_add_tcPr()
    for child in list(tc_pr):
        if child.tag == qn("w:shd"):
            tc_pr.remove(child)
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def shade_header_row(table, row_idx=0, fill="BFBFBF"):
    if row_idx < 0 or row_idx >= len(table.rows):
        return
    for cell in table.rows[row_idx].cells:
        set_cell_shading(cell, fill)


def merge_same_text_cells(table, col_idx, start_row=1):
    row_count = len(table.rows)
    row = start_row
    while row < row_count:
        current_text = (table.cell(row, col_idx).text or "").strip()
        end = row
        while end + 1 < row_count:
            next_text = (table.cell(end + 1, col_idx).text or "").strip()
            if next_text != current_text:
                break
            end += 1
        if end > row and current_text:
            merged_cell = table.cell(row, col_idx).merge(table.cell(end, col_idx))
            merged_cell.text = current_text
        row = end + 1


def to_number(value):
    if value is None or value == "":
        return None
    if isinstance(value, (int, float, Decimal)):
        return float(value)
    try:
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None


def format_number(value, digits=1):
    number = to_number(value)
    if number is None:
        return "-"
    if digits == 0:
        return f"{number:,.0f}"
    return f"{number:,.{digits}f}"


def setup_document_defaults(document):
    style = document.styles["Normal"]
    style.font.size = document.styles["Normal"].font.size
    try:
        from docx.enum.section import WD_ORIENTATION
    except ImportError:
        return
    for section in document.sections:
        section.orientation = WD_ORIENTATION.LANDSCAPE
        if section.page_width < section.page_height:
            section.page_width, section.page_height = section.page_height, section.page_width
