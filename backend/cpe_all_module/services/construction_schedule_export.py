import math
from datetime import timedelta

from cpe_module.models.operating_rate_models import WorkScheduleWeight

from .construction_schedule_gantt import (
    build_items_with_timing,
    build_subtask_list,
    build_cp_meta,
    is_parallel,
    arrow_dir_by_vector,
    category_color_hex,
    inject_gantt_drawing,
)


def extract_schedule_payload(raw_data):
    items = raw_data if isinstance(raw_data, list) else raw_data.get("items", [])
    sub_tasks = [] if isinstance(raw_data, list) else raw_data.get("sub_tasks", []) or raw_data.get("subTasks", [])
    links = [] if isinstance(raw_data, list) else raw_data.get("links", [])
    return items, sub_tasks, links


def group_items_by_category(items):
    grouped = {}
    ordered_categories = []
    for item in items:
        category = item.get("main_category") or "기타"
        if category not in grouped:
            grouped[category] = []
            ordered_categories.append(category)
        grouped[category].append(item)
    return grouped, ordered_categories


def build_rate_summary(project_id, ordered_categories, rate_map, region):
    rate_texts = []
    work_week_days = None
    for idx, category in enumerate(ordered_categories, start=1):
        rate_value = rate_map.get(category)
        if rate_value is None:
            continue
        if work_week_days is None:
            weight = WorkScheduleWeight.objects.filter(project_id=project_id, main_category=category).first()
            if weight:
                work_week_days = weight.work_week_days
        try:
            rate_value = float(rate_value)
            rate_texts.append(f"Cal-{idx}({category}) - {rate_value:.1f}%")
        except (TypeError, ValueError):
            rate_texts.append(f"Cal-{idx}({category}) - {rate_value}")

    work_week_label = f"주{work_week_days}일" if work_week_days else "주6일"
    region_label = f"{region} / " if region else ""
    if rate_texts:
        return f"가동율({region_label}{work_week_label}) : " + ", ".join(rate_texts)
    return f"가동율({region_label}{work_week_label}) : -"


def write_table_sheet(wb, items, ordered_categories, grouped, rate_summary, rate_map, project_name):
    ws = wb.add_worksheet("공사기간 산정 기준")
    header = [
        "구분",
        "공정",
        "공종",
        "수량산출(개산)",
        "단위",
        "내역수량",
        "생산성",
        "투입조",
        "생산량/일",
        "작업기간(W.D)",
        "가동율",
        "Calender Day",
        "비고"
    ]

    fmt_title = wb.add_format({'bold': True, 'font_size': 13, 'align': 'left', 'valign': 'vcenter', 'border': 1})
    fmt_title_red = wb.add_format({'bold': True, 'font_color': '#C00000', 'align': 'left', 'valign': 'vcenter', 'border': 1})
    fmt_header = wb.add_format({'bold': True, 'bg_color': '#D9D9D9', 'align': 'center', 'valign': 'vcenter', 'border': 1})
    fmt_category = wb.add_format({'bold': True, 'bg_color': '#FFF7C7', 'align': 'left', 'valign': 'vcenter', 'border': 1})
    fmt_left = wb.add_format({'align': 'left', 'valign': 'vcenter', 'border': 1})
    fmt_right = wb.add_format({'align': 'right', 'valign': 'vcenter', 'border': 1, 'num_format': '#,##0.00'})
    fmt_rate = wb.add_format({'align': 'right', 'valign': 'vcenter', 'border': 1, 'num_format': '0.0"%"'})

    header_cols = len(header)
    ws.merge_range(0, 0, 0, header_cols - 1, "공사기간 산정 기준", fmt_title)
    ws.merge_range(1, 0, 1, 3, f"공사명 : {project_name}", fmt_title)
    ws.merge_range(1, 4, 1, header_cols - 1, rate_summary, fmt_title_red)
    ws.write_row(2, 0, header, fmt_header)

    row_idx = 3
    for category in ordered_categories:
        category_items = grouped[category]
        ws.merge_range(row_idx, 0, row_idx, header_cols - 1, category, fmt_category)
        row_idx += 1

        for item in category_items:
            rate_value = rate_map.get(item.get("main_category"))
            if rate_value is None:
                rate_value = item.get("operating_rate_value", "")
            if rate_value not in ("", None):
                try:
                    rate_value = float(rate_value)
                except (TypeError, ValueError):
                    pass

            row = [
                item.get("main_category", ""),
                item.get("process", ""),
                item.get("work_type", ""),
                item.get("quantity_formula", ""),
                item.get("unit", ""),
                item.get("quantity", ""),
                item.get("productivity", ""),
                item.get("crew_size", ""),
                item.get("daily_production", ""),
                item.get("working_days", ""),
                rate_value,
                item.get("calendar_days", ""),
                item.get("remarks", "")
            ]
            for col_idx, value in enumerate(row):
                if col_idx in (5, 6, 7, 8, 9, 11):
                    ws.write(row_idx, col_idx, value, fmt_right)
                elif col_idx == 10:
                    ws.write(row_idx, col_idx, value, fmt_rate)
                else:
                    ws.write(row_idx, col_idx, value, fmt_left)
            row_idx += 1

    ws.set_column(0, 0, 18)
    ws.set_column(1, 1, 18)
    ws.set_column(2, 2, 30)
    ws.set_column(3, 3, 38)
    ws.set_column(4, 4, 8)
    ws.set_column(5, 5, 12)
    ws.set_column(6, 6, 12)
    ws.set_column(7, 7, 8)
    ws.set_column(8, 8, 12)
    ws.set_column(9, 9, 14)
    ws.set_column(10, 10, 10)
    ws.set_column(11, 11, 14)
    ws.set_column(12, 12, 28)
    ws.set_row(0, 22)
    ws.set_row(1, 18)
    ws.set_row(2, 20)


def write_gantt_sheet(wb, items, sub_tasks, links, project_name, start_date):
    # ---- Sheet 2: Gantt (shape-based, Excel-editable) ----
    gantt_ws = wb.add_worksheet("공사예정공정표")

    items_with_timing = build_items_with_timing(items)
    subtask_list = build_subtask_list(sub_tasks)

    total_days = math.ceil(max((it["start_day"] + it["duration"] for it in items_with_timing), default=0))
    total_days = max(total_days, 1)

    # Force 10-day scale for chart timeline.
    date_scale = 10
    total_units = math.ceil(total_days / date_scale)

    # Layout similar to sample sheet: A-D data, E spacer, F.. timeline
    timeline_start_col = 5
    last_col = timeline_start_col - 1 + total_units

    # Formats
    gantt_title_fmt = wb.add_format({'bold': True, 'font_size': 14, 'align': 'center', 'valign': 'vcenter'})
    gantt_header_fmt = wb.add_format({'bold': True, 'bg_color': '#D9D9D9', 'align': 'center', 'valign': 'vcenter', 'border': 1})
    gantt_left_fmt = wb.add_format({'align': 'left', 'valign': 'vcenter', 'border': 1})
    gantt_right_fmt = wb.add_format({'align': 'right', 'valign': 'vcenter', 'border': 1, 'num_format': '#,##0.0'})
    gantt_grid_fmt = wb.add_format({
        'top': 3,
        'bottom': 3,
        'left': 3,
        'right': 3,
        'border_color': '#000000'
    })

    # Title and headers
    gantt_ws.merge_range(0, 0, 0, last_col, "공 사 예 정 공 정 표", gantt_title_fmt)
    gantt_ws.merge_range(1, 0, 1, timeline_start_col - 1, f"공사명 : {project_name}", gantt_left_fmt)
    gantt_ws.merge_range(1, timeline_start_col, 1, last_col, "", gantt_left_fmt)

    gantt_ws.merge_range(2, 0, 3, 0, "구분", gantt_header_fmt)
    gantt_ws.merge_range(2, 1, 3, 1, "공정", gantt_header_fmt)
    gantt_ws.merge_range(2, 2, 3, 2, "공종", gantt_header_fmt)
    gantt_ws.merge_range(2, 3, 3, 3, "Calendar Day", gantt_header_fmt)
    gantt_ws.merge_range(2, 4, 3, 4, "", gantt_header_fmt)

    # Timeline headers (year/month + day)
    timeline_months = []
    timeline_days = []
    current_month_key = None
    for unit in range(total_units):
        day_number = unit * date_scale
        unit_date = start_date + timedelta(days=day_number)
        month_key = f"{unit_date.year}-{unit_date.month}"
        if month_key != current_month_key:
            timeline_months.append({
                "label": f"{unit_date.year}.{unit_date.month:02d}",
                "count": 1
            })
            current_month_key = month_key
        else:
            timeline_months[-1]["count"] += 1

        if date_scale == 1:
            label = str(unit_date.day)
        elif date_scale == 5:
            label = f"{math.floor(unit / (7 / date_scale)) + 1}주"
        elif date_scale == 10:
            dekad = math.floor((unit_date.day - 1) / 10)
            label = ["상순", "중순", "하순"][dekad] if dekad < 3 else f"{day_number + 1}일~"
        elif date_scale == 30:
            label = f"{unit_date.month}월"
        else:
            label = f"{day_number + 1}일"
        timeline_days.append(label)

    month_col = timeline_start_col
    last_year_label = None
    for month in timeline_months:
        label = month["label"]
        if date_scale >= 30:
            year = label.split(".")[0]
            label = year if year != last_year_label else ""
            last_year_label = year
        end_col = month_col + month["count"] - 1
        if end_col > month_col:
            gantt_ws.merge_range(2, month_col, 2, end_col, label, gantt_header_fmt)
        else:
            gantt_ws.write(2, month_col, label, gantt_header_fmt)
        month_col = end_col + 1

    for idx, label in enumerate(timeline_days):
        col = timeline_start_col + idx
        gantt_ws.write(3, col, str(label).replace("일", ""), gantt_header_fmt)

    # Sub-header row (row 4): "적정공기 계획" and "총간관리일"
    subheader_fmt = wb.add_format({'align': 'center', 'valign': 'vcenter', 'border': 1})
    gantt_ws.merge_range(4, 0, 4, 2, "적정공기 계획", subheader_fmt)
    gantt_ws.write(4, 3, "총간관리일", subheader_fmt)
    gantt_ws.write(4, 4, "", subheader_fmt)
    for col in range(timeline_start_col, last_col + 1):
        gantt_ws.write(4, col, "", subheader_fmt)

    # Column sizing (needed before shape positioning)
    gantt_ws.set_column(0, 0, 10.625)
    gantt_ws.set_column(1, 1, 13.375)
    gantt_ws.set_column(2, 2, 26.875)
    gantt_ws.set_column(3, 3, 11.375)
    gantt_ws.set_column(4, 4, 9.625)
    for col in range(timeline_start_col, last_col + 1):
        gantt_ws.set_column(col, col, 5.625)
    gantt_ws.set_row(0, 39.95)
    gantt_ws.set_row(1, 30)
    gantt_ws.set_row(2, 30)
    gantt_ws.set_row(3, 30)
    gantt_ws.set_row(4, 60)

    data_start_row = 5
    gantt_row = data_start_row
    item_positions = {}

    def _day_to_px(day):
        unit_px = gantt_ws._size_col(timeline_start_col)
        return max(0, (day / date_scale) * unit_px)

    shapes = []

    row_tops = {}
    running_y = 0
    for r in range(data_start_row, data_start_row + len(items_with_timing) + 5):
        gantt_ws.set_row(r, 30)
        row_tops[r] = running_y
        running_y += gantt_ws._size_row(r)

    cp_meta = build_cp_meta(items_with_timing)

    for item_meta in items_with_timing:
        item = item_meta["item"]
        start_day = float(item_meta["start_day"])
        duration = max(1.0, float(item_meta["duration"] or 0))

        gantt_ws.write(gantt_row, 0, item.get("main_category", ""), gantt_left_fmt)
        gantt_ws.write(gantt_row, 1, item.get("process", ""), gantt_left_fmt)
        gantt_ws.write(gantt_row, 2, item.get("work_type", ""), gantt_left_fmt)
        gantt_ws.write(gantt_row, 3, item.get("calendar_days", ""), gantt_right_fmt)
        gantt_ws.write(gantt_row, 4, "", gantt_grid_fmt)
        for col in range(timeline_start_col, last_col + 1):
            gantt_ws.write(gantt_row, col, "", gantt_grid_fmt)

        item_positions[item.get("id")] = {
            "row": gantt_row,
            "start_day": start_day,
            "end_day": start_day + duration
        }

        meta = cp_meta.get(item.get("id")) or {}
        red_start = meta.get("red_start", 0)
        red_end = meta.get("red_end", 0)
        is_cp = meta.get("is_cp", False)
        front_parallel = float(item.get("front_parallel_days") or 0)
        back_parallel = float(item.get("back_parallel_days") or 0)
        contained = []
        if is_cp:
            for other in items_with_timing:
                other_id = other["item"].get("id")
                if other_id == item.get("id"):
                    continue
                other_meta = cp_meta.get(other_id)
                if not other_meta or not other_meta.get("is_cp"):
                    continue
                if other_meta["red_start"] >= red_start and other_meta["red_end"] <= red_end:
                    contained.append(other_meta)

        row_height = gantt_ws._size_row(gantt_row)
        row_top = row_tops.get(gantt_row, 0)
        label_top_y = max(0, row_top - 4)
        bar_height = 6
        bar_y = row_top + 16
        bar_start_px = _day_to_px(start_day)
        bar_width_px = max(6, int((_day_to_px(start_day + duration) - bar_start_px)))

        # Base bar - line (match sample)
        parallel_color = "64748B"
        bar_color = category_color_hex(item.get("main_category"))
        if is_parallel(item):
            bar_color = parallel_color
        bar_mid_y = bar_y + (bar_height / 2)
        shapes.append({
            'type': 'line',
            'x1': bar_start_px,
            'y1': bar_mid_y,
            'x2': bar_start_px + bar_width_px,
            'y2': bar_mid_y,
            'line': {'color': bar_color, 'width': 4.0}
        })
        shapes.append({
            'type': 'text',
            'x': max(0, bar_start_px),
            'y': max(0, label_top_y),
            'w': max(80, min(bar_width_px + 60, 220)),
            'h': 9,
            'text': (item.get('work_type') or "").strip(),
            'font': {'size': 8, 'color': '000000', 'bold': True}
        })

        # Precompute contained parallel segments for overlay
        contained_parallel = []
        for other in items_with_timing:
            other_id = other["item"].get("id")
            if other_id == item.get("id"):
                continue
            other_meta = cp_meta.get(other_id)
            if not other_meta or not other_meta.get("is_cp"):
                continue
            if other_meta["red_start"] >= red_start and other_meta["red_end"] <= red_end:
                contained_parallel.append(other_meta)

        # Critical path segment (red)
        if is_cp and red_end > red_start:
            red_start_px = _day_to_px(max(start_day, red_start))
            red_end_px = _day_to_px(min(start_day + duration, red_end))
            red_width = max(2, int(red_end_px - red_start_px))
            shapes.append({
                'type': 'line',
                'x1': red_start_px,
                'y1': bar_mid_y,
                'x2': red_start_px + red_width,
                'y2': bar_mid_y,
                'line': {'color': 'EF4444', 'width': 4.0}
            })

        # Parallel segments (grey) for front/back parallel days
        if not is_parallel(item):
            if front_parallel > 0:
                seg_start_px = _day_to_px(start_day)
                seg_end_px = _day_to_px(min(start_day + duration, start_day + front_parallel))
                if seg_end_px > seg_start_px:
                    shapes.append({
                        'type': 'line',
                        'x1': seg_start_px,
                        'y1': bar_mid_y,
                        'x2': seg_end_px,
                        'y2': bar_mid_y,
                        'line': {'color': parallel_color, 'width': 4.0}
                    })
            if back_parallel > 0:
                seg_start_px = _day_to_px(max(start_day, start_day + duration - back_parallel))
                seg_end_px = _day_to_px(start_day + duration)
                if seg_end_px > seg_start_px:
                    shapes.append({
                        'type': 'line',
                        'x1': seg_start_px,
                        'y1': bar_mid_y,
                        'x2': seg_end_px,
                        'y2': bar_mid_y,
                        'line': {'color': parallel_color, 'width': 4.0}
                    })

        # Overlay base color where parallel tasks are contained (ensure last to override)
        for seg in contained_parallel:
            seg_start_px = _day_to_px(seg["red_start"])
            seg_end_px = _day_to_px(seg["red_end"])
            shapes.append({
                'type': 'line',
                'x1': seg_start_px,
                'y1': bar_mid_y,
                'x2': seg_end_px,
                'y2': bar_mid_y,
                'line': {'color': parallel_color, 'width': 4.0}
            })

        item_positions[item.get("id")]["y_px"] = bar_mid_y

        # Subtasks as thin blue bar near bottom of row
        if subtask_list:
            for sub in [s for s in subtask_list if s["item_id"] == item.get("id")]:
                sub_start = float(sub["start_day"])
                sub_duration = max(1.0, float(sub["duration"] or 0))
                sub_start_px = _day_to_px(sub_start)
                sub_width_px = max(4, int(_day_to_px(sub_start + sub_duration) - sub_start_px))
                sub_height = 4
                sub_y = bar_y + (bar_height / 2) - (sub_height / 2)
                sub_mid_y = sub_y + (sub_height / 2)
                shapes.append({
                    'type': 'line',
                    'x1': sub_start_px,
                    'y1': sub_mid_y,
                    'x2': sub_start_px + sub_width_px,
                    'y2': sub_mid_y,
                    'line': {'color': '64748B', 'width': 3.0}
                })
                shapes.append({
                    'type': 'text',
                    'x': max(0, sub_start_px),
                    'y': max(0, row_top + row_height - 15),
                    'w': max(40, min(sub_width_px, 120)),
                    'h': 9,
                    'text': sub.get("label") or "부공종",
                    'font': {'size': 8, 'color': '111827', 'bold': True}
                })
                node_size = 8
                node_y = sub_y - int((node_size - sub_height) / 2)
                shapes.append({
                    'type': 'ellipse',
                    'x': sub_start_px - int(node_size / 2),
                    'y': node_y,
                    'w': node_size,
                    'h': node_size,
                    'fill': 'FFFFFF',
                    'line': {'color': '111827', 'width': 1.5}
                })
                shapes.append({
                    'type': 'ellipse',
                    'x': sub_start_px + sub_width_px - int(node_size / 2),
                    'y': node_y,
                    'w': node_size,
                    'h': node_size,
                    'fill': 'FFFFFF',
                    'line': {'color': '111827', 'width': 1.5}
                })
                sub_id = sub.get("subtask", {}).get("id") or sub.get("subtask", {}).get("pk") or sub.get("id")
                if sub_id is not None:
                    item_positions[sub_id] = {
                        "row": gantt_row,
                        "start_day": sub_start,
                        "end_day": sub_start + sub_duration,
                        "y_px": sub_mid_y
                    }

        # Node circles at start/end (draw last so they stay on top)
        node_size = 8
        node_y = bar_y - int((node_size - bar_height) / 2)
        shapes.append({
            'type': 'ellipse',
            'x': bar_start_px - int(node_size / 2),
            'y': node_y,
            'w': node_size,
            'h': node_size,
            'fill': 'FFFFFF',
            'line': {'color': '111827', 'width': 1.5}
        })
        shapes.append({
            'type': 'ellipse',
            'x': bar_start_px + bar_width_px - int(node_size / 2),
            'y': node_y,
            'w': node_size,
            'h': node_size,
            'fill': 'FFFFFF',
            'line': {'color': '111827', 'width': 1.5}
        })

        gantt_row += 1

    # Link lines (shape-based)
    if isinstance(links, list):
        for link in links:
            from_id = link.get("from")
            to_id = link.get("to")
            link_type = link.get("type") or "FS"
            if from_id not in item_positions or to_id not in item_positions:
                continue
            from_pos = item_positions[from_id]
            to_pos = item_positions[to_id]
            if link_type == "SS":
                x1 = from_pos["start_day"]
                x2 = to_pos["start_day"]
                from_anchor = "start"
            elif link_type == "FF":
                x1 = from_pos["end_day"]
                x2 = to_pos["end_day"]
                from_anchor = "end"
            elif link_type == "SF":
                x1 = from_pos["start_day"]
                x2 = to_pos["end_day"]
                from_anchor = "start"
            else:
                x1 = from_pos["end_day"]
                x2 = to_pos["start_day"]
                from_anchor = "end"

            row_y1 = from_pos["row"]
            row_y2 = to_pos["row"]

            lag = float(link.get("lag") or 0)
            x1_px = _day_to_px(x1)
            x2_px = _day_to_px(x2 + lag)
            y1_px = from_pos.get("y_px", row_tops.get(row_y1, 0) + int(gantt_ws._size_row(row_y1) / 2))
            y2_px = to_pos.get("y_px", row_tops.get(row_y2, 0) + int(gantt_ws._size_row(row_y2) / 2))
            node_radius = 2
            dy = y2_px - y1_px
            dx = x2_px - x1_px
            y1_adj = y1_px + (node_radius if dy > 0 else -node_radius if dy < 0 else 0)
            y2_adj = y2_px - (node_radius if dy > 0 else -node_radius if dy < 0 else 0)
            if abs(dy) < node_radius * 2:
                y1_adj, y2_adj = y1_px, y2_px
            if dx >= 0:
                x1_adj = x1_px + node_radius
                x2_adj = x2_px - node_radius
            else:
                x1_adj = x1_px - node_radius
                x2_adj = x2_px + node_radius
            if abs(dx) < node_radius * 2:
                x1_adj, x2_adj = x1_px, x2_px

            if from_anchor == "start":
                # vertical first, then horizontal to target (arrow on horizontal)
                shapes.append({
                    'type': 'line',
                    'x1': x1_px, 'y1': y1_adj,
                    'x2': x1_px, 'y2': y2_adj,
                    'line': {'color': '94A3B8', 'width': 2.5, 'dash': 'sysDash'}
                })
                shapes.append({
                    'type': 'line',
                    'x1': x1_adj, 'y1': y2_px,
                    'x2': x2_adj, 'y2': y2_px,
                    'line': {
                        'color': '94A3B8',
                        'width': 2.5,
                        'dash': 'sysDash',
                        'arrow': 'triangle',
                        'arrow_dir': 'tail' if arrow_dir_by_vector(x1_adj, y2_px, x2_adj, y2_px) == 'head' else 'head'
                    }
                })
            else:
                # horizontal first, then vertical to target (arrow on vertical)
                shapes.append({
                    'type': 'line',
                    'x1': x1_adj, 'y1': y1_px,
                    'x2': x2_adj, 'y2': y1_px,
                    'line': {'color': '94A3B8', 'width': 2.5, 'dash': 'sysDash'}
                })
                shapes.append({
                    'type': 'line',
                    'x1': x2_px, 'y1': y1_adj,
                    'x2': x2_px, 'y2': y2_adj,
                    'line': {
                        'color': '94A3B8',
                        'width': 2.5,
                        'dash': 'sysDash',
                        'arrow': 'triangle',
                        'arrow_dir': 'tail' if arrow_dir_by_vector(x2_px, y1_adj, x2_px, y2_adj) == 'head' else 'head'
                    }
                })

    # Critical path links (match frontend CriticalPathLayer)
    for i, item_meta in enumerate(items_with_timing):
        item = item_meta["item"]
        front_parallel = float(item.get("front_parallel_days") or 0)
        back_parallel = float(item.get("back_parallel_days") or 0)
        task_start = item_meta["start_day"]
        task_end = item_meta["start_day"] + item_meta["duration"]
        red_start = task_start + front_parallel
        red_end = task_end - back_parallel
        has_critical = red_end > red_start
        if item.get("remarks") == "병행작업" or not has_critical:
            continue

        prev_item = items_with_timing[i - 1]["item"] if i > 0 else None
        if prev_item:
            prev_end = (items_with_timing[i - 1]["start_day"] + items_with_timing[i - 1]["duration"])
            if prev_end > task_end:
                continue

        target_index = i + 1
        target_item_meta = items_with_timing[target_index] if target_index < len(items_with_timing) else None
        while target_item_meta:
            t_item = target_item_meta["item"]
            t_front = float(t_item.get("front_parallel_days") or 0)
            t_back = float(t_item.get("back_parallel_days") or 0)
            t_red_start = target_item_meta["start_day"] + t_front
            t_red_end = target_item_meta["start_day"] + target_item_meta["duration"] - t_back
            t_has_critical = t_red_end > t_red_start
            if (
                red_end <= (target_item_meta["start_day"] + target_item_meta["duration"]) and
                t_item.get("remarks") != "병행작업" and
                t_has_critical
            ):
                break
            target_index += 1
            target_item_meta = items_with_timing[target_index] if target_index < len(items_with_timing) else None

        if not target_item_meta:
            continue

        target_item = target_item_meta["item"]
        target_front = float(target_item.get("front_parallel_days") or 0)
        target_red_start = target_item_meta["start_day"] + target_front

        from_pos = item_positions.get(item.get("id"))
        to_pos = item_positions.get(target_item.get("id"))
        if not from_pos or not to_pos:
            continue

        start_x = _day_to_px(red_end)
        end_x = _day_to_px(target_red_start)
        start_y = from_pos.get("y_px", row_tops.get(from_pos["row"], 0) + int(gantt_ws._size_row(from_pos["row"]) / 2))
        end_y = to_pos.get("y_px", row_tops.get(to_pos["row"], 0) + int(gantt_ws._size_row(to_pos["row"]) / 2))

        shapes.append({
            'type': 'line',
            'x1': start_x, 'y1': start_y,
            'x2': end_x, 'y2': end_y,
            'line': {'color': 'EF4444', 'width': 2.5, 'dash': 'sysDash', 'arrow': 'triangle',
                     'arrow_dir': arrow_dir_by_vector(start_x, start_y, end_x, end_y)}
        })

        # Contained CP detours
        contained = []
        for other in items_with_timing:
            other_id = other["item"].get("id")
            if other_id == item.get("id"):
                continue
            other_meta = cp_meta.get(other_id)
            if not other_meta or not other_meta.get("is_cp"):
                continue
            if other_meta["red_start"] >= red_start and other_meta["red_end"] <= red_end:
                contained.append((other, other_meta))

        if contained:
            contained.sort(key=lambda x: x[1]["red_start"])
            for other, other_meta in contained:
                inner_pos = item_positions.get(other["item"].get("id"))
                if not inner_pos:
                    continue
                down_x = _day_to_px(other_meta["red_start"])
                up_x = _day_to_px(other_meta["red_end"])
                outer_y = start_y
                inner_y = inner_pos.get("y_px", row_tops.get(inner_pos["row"], 0) + int(gantt_ws._size_row(inner_pos["row"]) / 2))
                shapes.append({
                    'type': 'line',
                    'x1': down_x, 'y1': outer_y,
                    'x2': down_x, 'y2': inner_y,
                    'line': {'color': 'EF4444', 'width': 2.5, 'dash': 'sysDash', 'arrow': 'triangle',
                             'arrow_dir': arrow_dir_by_vector(down_x, outer_y, down_x, inner_y)}
                })
                shapes.append({
                    'type': 'line',
                    'x1': up_x, 'y1': inner_y,
                    'x2': up_x, 'y2': outer_y,
                    'line': {'color': 'EF4444', 'width': 2.5, 'dash': 'sysDash', 'arrow': 'triangle',
                             'arrow_dir': arrow_dir_by_vector(up_x, inner_y, up_x, outer_y)}
                })

    # Vertical reference line at Day 0 (solid)
    ref_x_px = 0
    for r in range(data_start_row, gantt_row):
        y = row_tops.get(r, 0)
        shapes.append({
            'type': 'cxn',
            'x': ref_x_px,
            'y': y,
            'w': 2,
            'h': gantt_ws._size_row(r),
            'line': {'color': 'FF0000', 'width': 1}
        })

    # Add milestone markers to Row 4 timeline area (착공/준공)
    # Row 4 is the sub-header row ("적정공기 계획" and "총간관리일")
    # CRITICAL: inject_gantt_drawing uses timeline_origin_y = sum(row_pixels[:data_start_row])
    # This means shape Y coordinates are relative to Row 5 (data_start_row) top edge
    # Row 4 is ABOVE the origin, so it needs NEGATIVE Y coordinate
    row4_height = 60
    
    # 착공 milestone at Day 0
    start_x = _day_to_px(0)
    start_date_str = start_date.strftime('%y.%m.%d')
    
    triangle_size = 12
    # Position triangle at the BOTTOM border of Row 4
    # Row 4 bottom edge is at Y=0 (which is the top of data_start_row/Row 5)
    # To attach triangle to bottom border, position it just above Y=0
    triangle_y = -triangle_size
    
    shapes.append({
        'type': 'triangle',
        'x': start_x - (triangle_size / 2),
        'y': triangle_y,
        'w': triangle_size,
        'h': triangle_size,
        'fill': 'EF4444',
        'line': {'color': 'EF4444', 'width': 1},
        'rotation': 180
    })
    
    shapes.append({
        'type': 'text',
        'x': max(0, start_x - 25),
        'y': -(triangle_size + 14),  # Position text just above the triangle
        'w': 50,
        'h': 12,
        'text': f'착공({start_date_str})',
        'font': {'size': 8, 'color': '000000', 'bold': True}
    })
    
    # 준공 milestone at end
    end_x = _day_to_px(total_days)
    end_date = start_date + timedelta(days=total_days)
    end_date_str = end_date.strftime('%y.%m.%d')
    
    shapes.append({
        'type': 'triangle',
        'x': end_x - (triangle_size / 2),
        'y': triangle_y,
        'w': triangle_size,
        'h': triangle_size,
        'fill': 'EF4444',
        'line': {'color': 'EF4444', 'width': 1},
        'rotation': 180
    })
    
    shapes.append({
        'type': 'text',
        'x': max(0, end_x - 25),
        'y': -(triangle_size + 14),  # Position text just above the triangle
        'w': 50,
        'h': 12,
        'text': f'준공({end_date_str})',
        'font': {'size': 8, 'color': '000000', 'bold': True}
    })
    
    # Major category completion milestones (대공종 완료)
    # Find the end point of each major category
    category_end_points = {}
    for item_meta in items_with_timing:
        item = item_meta["item"]
        category = item.get("main_category", "")
        if not category:
            continue
        end_day = item_meta["start_day"] + item_meta["duration"]
        if category not in category_end_points or end_day > category_end_points[category]["end_day"]:
            category_end_points[category] = {
                "end_day": end_day,
                "end_date": start_date + timedelta(days=int(end_day))
            }
    
    # Add milestone for each major category
    for category, data in category_end_points.items():
        milestone_x = _day_to_px(data["end_day"])
        milestone_date_str = data["end_date"].strftime('%y.%m.%d')
        
        # Sky blue triangle marker
        shapes.append({
            'type': 'triangle',
            'x': milestone_x - (triangle_size / 2),
            'y': triangle_y,
            'w': triangle_size,
            'h': triangle_size,
            'fill': '38BDF8',  # Sky blue
            'line': {'color': '38BDF8', 'width': 1},
            'rotation': 180
        })
        
        # Text label above triangle
        shapes.append({
            'type': 'text',
            'x': max(0, milestone_x - 30),
            'y': -(triangle_size + 14),
            'w': 60,
            'h': 12,
            'text': f'{category} 완료({milestone_date_str})',
            'font': {'size': 8, 'color': '000000', 'bold': True}
        })

    return {
        "shapes": shapes,
        "last_col": last_col,
        "gantt_row": gantt_row,
        "timeline_start_col": timeline_start_col,
        "data_start_row": data_start_row
    }
