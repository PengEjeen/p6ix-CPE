from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from datetime import date as date_cls, timedelta
import io
import math
import xlsxwriter
import traceback
from ..models.construction_schedule_models import ConstructionScheduleItem
from ..serializers.construction_schedule_serializers import ConstructionScheduleItemSerializer
from cpe_module.models.operating_rate_models import WorkScheduleWeight
from cpe_module.models.calc_models import WorkCondition
from cpe_module.models.project_models import Project

class ConstructionScheduleItemViewSet(viewsets.ModelViewSet):
    queryset = ConstructionScheduleItem.objects.all()
    serializer_class = ConstructionScheduleItemSerializer
    pagination_class = None

    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        project_id = self.request.query_params.get('project_id')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset
        
    def update(self, request, *args, **kwargs):
        # Log update request for debugging
        print("Update Request Data keys:", request.data.keys())
        if 'data' in request.data:
            print("Items count:", len(request.data['data']))
        return super().update(request, *args, **kwargs)

    @action(detail=False, methods=['post'])
    def initialize_default(self, request):
        project_id = request.data.get('project_id')
        if not project_id:
            return Response({"error": "project_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Cleanup legacy multiple rows if they exist
        existing = ConstructionScheduleItem.objects.filter(project_id=project_id)
        if existing.count() > 1:
            existing.delete()
        
        # Get or Create Single Container
        container, created = ConstructionScheduleItem.objects.get_or_create(project_id=project_id)
        
        # If it exists but has no data, or we just created it -> Populate Defaults
        if not container.data:
            from cpe_all_module.initial_data import get_default_schedule_data
            container.data = get_default_schedule_data()
            container.save()
            return Response({"message": "Initialized default items"}, status=status.HTTP_201_CREATED)
            
        return Response({"message": "Already initialized"}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='export-excel')
    def export_excel(self, request):
        return self._export_excel_impl(request)

    def _export_excel_impl(self, request):
        try:
            project_id = request.query_params.get('project_id')
            if not project_id:
                return Response({"error": "project_id is required"}, status=status.HTTP_400_BAD_REQUEST)

            container = ConstructionScheduleItem.objects.filter(project_id=project_id).first()
            if not container or not container.data:
                return Response({"error": "schedule data not found"}, status=status.HTTP_404_NOT_FOUND)

            print(f"[export-excel] project_id={project_id}")
            print(f"[export-excel] xlsxwriter_version={getattr(xlsxwriter, '__version__', 'unknown')}")
            print(f"[export-excel] xlsxwriter_path={getattr(xlsxwriter, '__file__', 'unknown')}")

            raw_data = container.data
            items = raw_data if isinstance(raw_data, list) else raw_data.get("items", [])
            sub_tasks = [] if isinstance(raw_data, list) else raw_data.get("sub_tasks", []) or raw_data.get("subTasks", [])
            links = [] if isinstance(raw_data, list) else raw_data.get("links", [])

            if not isinstance(items, list):
                return Response({"error": "invalid schedule data"}, status=status.HTTP_400_BAD_REQUEST)

            project = Project.objects.filter(id=project_id).first()
            project_name = project.title if project else "프로젝트"

            rate_qs = WorkScheduleWeight.objects.filter(project_id=project_id).values("main_category", "operating_rate")
            rate_map = {row["main_category"]: row["operating_rate"] for row in rate_qs}

            grouped = {}
            ordered_categories = []
            for item in items:
                category = item.get("main_category") or "기타"
                if category not in grouped:
                    grouped[category] = []
                    ordered_categories.append(category)
                grouped[category].append(item)

            work_condition = WorkCondition.objects.filter(project_id=project_id).first()
            region = work_condition.region if work_condition and work_condition.region else ""

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
            rate_summary = (
                f"가동율({region_label}{work_week_label}) : " + ", ".join(rate_texts)
                if rate_texts
                else f"가동율({region_label}{work_week_label}) : -"
            )

            output = io.BytesIO()
            wb = xlsxwriter.Workbook(output, {'in_memory': True})

            # ---- Sheet 1: Table ----
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
            fmt_rate = wb.add_format({'align': 'right', 'valign': 'vcenter', 'border': 1, 'num_format': '0.0\"%\"'})

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

            # ---- Sheet 2: Gantt (shape-based, Excel-editable) ----
            gantt_ws = wb.add_worksheet("공사예정공정표")

            items_with_timing = []
            cumulative_cp_end = 0.0
            for idx, item in enumerate(items):
                duration = float(item.get("calendar_days") or 0)
                start_override = item.get("_startDay")
                if start_override is not None:
                    start_day = float(start_override)
                else:
                    start_day = 0.0 if idx == 0 else cumulative_cp_end
                back_parallel = float(item.get("back_parallel_days") or 0)
                cp_end = start_day + duration - back_parallel
                cumulative_cp_end = max(cumulative_cp_end, cp_end)
                items_with_timing.append({
                    "item": item,
                    "start_day": start_day,
                    "duration": duration
                })

            subtask_list = []
            if isinstance(sub_tasks, list):
                for sub in sub_tasks:
                    try:
                        subtask_list.append({
                            "subtask": sub,
                            "item_id": sub.get("itemId"),
                            "start_day": float(sub.get("startDay") or 0),
                            "duration": float(sub.get("durationDays") or 0),
                            "label": sub.get("label") or "부공종"
                        })
                    except (TypeError, ValueError):
                        continue

            total_days = math.ceil(max((it["start_day"] + it["duration"] for it in items_with_timing), default=0))
            total_days = max(total_days, 1)

            start_date = project.start_date if project and project.start_date else date_cls.today()
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

            data_start_row = 4
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

            def _arrow_dir_by_vector(x1, y1, x2, y2):
                dx = x2 - x1
                dy = y2 - y1
                if abs(dx) >= abs(dy):
                    return 'head' if dx >= 0 else 'tail'
                # Invert vertical direction to match expected up/down arrows.
                return 'tail' if dy >= 0 else 'head'

            cp_meta = {}
            for item_meta in items_with_timing:
                item = item_meta["item"]
                front_parallel = float(item.get("front_parallel_days") or 0)
                back_parallel = float(item.get("back_parallel_days") or 0)
                red_start = item_meta["start_day"] + front_parallel
                red_end = (item_meta["start_day"] + item_meta["duration"]) - back_parallel
                has_segment = red_end > red_start
                remarks_text = (item.get("remarks") or "").strip()
                is_parallel = (
                    remarks_text == "병행작업"
                    or bool(item.get("_parallelGroup"))
                    or bool(item.get("parallelGroup"))
                    or bool(item.get("parallel_group"))
                    or bool(item.get("is_parallelism"))
                )
                is_cp = not is_parallel and has_segment
                cp_meta[item.get("id")] = {
                    "red_start": red_start,
                    "red_end": red_end,
                    "is_cp": is_cp
                }

            def _category_color_hex(main_category):
                lower = (main_category or "").lower()
                if "토공" in lower or "준비" in lower:
                    return "64748B"  # slate-500
                if "골조" in lower:
                    return "2563EB"  # blue-600
                if "마감" in lower:
                    return "10B981"  # emerald-500
                if "mep" in lower:
                    return "8B5CF6"  # violet-500
                if "조경" in lower:
                    return "F59E0B"  # amber-500
                return "60A5FA"      # blue-400

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
                label_top_y = max(0, row_top + 2)
                bar_height = 6
                bar_y = row_top + 16
                bar_start_px = _day_to_px(start_day)
                bar_width_px = max(6, int((_day_to_px(start_day + duration) - bar_start_px)))

                # Base bar - line (match sample)
                parallel_color = "64748B"
                bar_color = _category_color_hex(item.get("main_category"))
                remarks_text = (item.get("remarks") or "").strip()
                if (
                    remarks_text == "병행작업"
                    or bool(item.get("_parallelGroup"))
                    or bool(item.get("parallelGroup"))
                    or bool(item.get("parallel_group"))
                    or bool(item.get("is_parallelism"))
                ):
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
                    'h': 8,
                    'text': (item.get('work_type') or "").strip(),
                    'font': {'size': 7, 'color': '000000'}
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
                if not (
                    remarks_text == "병행작업"
                    or bool(item.get("_parallelGroup"))
                    or bool(item.get("parallelGroup"))
                    or bool(item.get("parallel_group"))
                    or bool(item.get("is_parallelism"))
                ):
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

                # Node circles at start/end
                node_size = 8
                node_y = bar_y - int((node_size - bar_height) / 2)
                shapes.append({
                    'type': 'ellipse',
                    'x': bar_start_px - int(node_size / 2),
                    'y': node_y,
                    'w': node_size,
                    'h': node_size,
                    'fill': None,
                    'line': {'color': '111827', 'width': 0.5}
                })
                shapes.append({
                    'type': 'ellipse',
                    'x': bar_start_px + bar_width_px - int(node_size / 2),
                    'y': node_y,
                    'w': node_size,
                    'h': node_size,
                    'fill': None,
                    'line': {'color': '111827', 'width': 0.5}
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
                            'y': max(0, row_top + row_height - 11),
                            'w': max(40, min(sub_width_px, 120)),
                            'h': 8,
                            'text': sub.get("label") or "부공종",
                            'font': {'size': 7, 'color': '111827'}
                        })
                        node_size = 8
                        node_y = sub_y - int((node_size - sub_height) / 2)
                        shapes.append({
                            'type': 'ellipse',
                            'x': sub_start_px - int(node_size / 2),
                            'y': node_y,
                            'w': node_size,
                            'h': node_size,
                            'fill': None,
                            'line': {'color': '111827', 'width': 0.5}
                        })
                        shapes.append({
                            'type': 'ellipse',
                            'x': sub_start_px + sub_width_px - int(node_size / 2),
                            'y': node_y,
                            'w': node_size,
                            'h': node_size,
                            'fill': None,
                            'line': {'color': '111827', 'width': 0.5}
                        })
                        sub_id = sub.get("subtask", {}).get("id") or sub.get("subtask", {}).get("pk") or sub.get("id")
                        if sub_id is not None:
                            item_positions[sub_id] = {
                                "row": gantt_row,
                                "start_day": sub_start,
                                "end_day": sub_start + sub_duration,
                                "y_px": sub_mid_y
                            }

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
                                'arrow_dir': 'tail' if _arrow_dir_by_vector(x1_adj, y2_px, x2_adj, y2_px) == 'head' else 'head'
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
                                'arrow_dir': 'tail' if _arrow_dir_by_vector(x2_px, y1_adj, x2_px, y2_adj) == 'head' else 'head'
                            }
                        })

            def _arrow_dir_by_vector(x1, y1, x2, y2):
                dx = x2 - x1
                dy = y2 - y1
                if abs(dx) >= abs(dy):
                    return 'head' if dx >= 0 else 'tail'
                # Invert vertical direction to match expected up/down arrows.
                return 'tail' if dy >= 0 else 'head'

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
                             'arrow_dir': _arrow_dir_by_vector(start_x, start_y, end_x, end_y)}
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
                                     'arrow_dir': _arrow_dir_by_vector(down_x, outer_y, down_x, inner_y)}
                        })
                        shapes.append({
                            'type': 'line',
                            'x1': up_x, 'y1': inner_y,
                            'x2': up_x, 'y2': outer_y,
                            'line': {'color': 'EF4444', 'width': 2.5, 'dash': 'sysDash', 'arrow': 'triangle',
                                     'arrow_dir': _arrow_dir_by_vector(up_x, inner_y, up_x, outer_y)}
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

            print(f"[export-excel] gantt_shapes_count={len(shapes)}")
            wb.close()
            output.seek(0)

            def _inject_gantt_drawing(xlsx_bytes):
                import zipfile
                import xml.etree.ElementTree as ET
                from io import BytesIO

                NS = {
                    'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
                    'rel': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
                    'xdr': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
                    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'
                }
                for k, v in NS.items():
                    ET.register_namespace('' if k == 'main' else k, v)

                def col_width_to_px(width):
                    max_digit_width = 7.0
                    padding = 5.0
                    if width <= 0:
                        return 0
                    if width < 1:
                        return int(width * (max_digit_width + padding) + 0.5)
                    return int(width * max_digit_width + 0.5) + int(padding)

                def row_height_to_px(height_pt):
                    return int(height_pt * 4 / 3 + 0.5)

                def px_to_col_off(x_px, col_pixels):
                    col = 0
                    remaining = max(0, x_px)
                    while col < len(col_pixels) - 1 and remaining >= col_pixels[col]:
                        remaining -= col_pixels[col]
                        col += 1
                    remaining = min(remaining, col_pixels[col] - 1 if col_pixels[col] > 0 else 0)
                    return col, int(remaining)

                def px_to_row_off(y_px, row_pixels):
                    row = 0
                    remaining = max(0, y_px)
                    while row < len(row_pixels) - 1 and remaining >= row_pixels[row]:
                        remaining -= row_pixels[row]
                        row += 1
                    remaining = min(remaining, row_pixels[row] - 1 if row_pixels[row] > 0 else 0)
                    return row, int(remaining)

                def px_to_emu(px):
                    return int(px * 9525)

                # Build column/row pixel maps
                col_pixels = []
                for c in range(0, last_col + 1):
                    if c == 0:
                        w = 10.625
                    elif c == 1:
                        w = 13.375
                    elif c == 2:
                        w = 26.875
                    elif c == 3:
                        w = 11.375
                    elif c == 4:
                        w = 9.625
                    else:
                        w = 5.625
                    col_pixels.append(col_width_to_px(w))
                row_pixels = []
                for r in range(0, gantt_row + 5):
                    if r == 0:
                        h = 39.95
                    else:
                        h = 30
                    row_pixels.append(row_height_to_px(h))

                timeline_origin_x = sum(col_pixels[:timeline_start_col])
                timeline_origin_y = sum(row_pixels[:data_start_row])

                # Create drawing XML
                wsdr = ET.Element(ET.QName(NS['xdr'], 'wsDr'))
                shape_id = 1

                def add_shape(shape):
                    nonlocal shape_id
                    if shape['type'] == 'line':
                        abs_x1 = timeline_origin_x + shape['x1']
                        abs_y1 = timeline_origin_y + shape['y1']
                        abs_x2 = timeline_origin_x + shape['x2']
                        abs_y2 = timeline_origin_y + shape['y2']
                        col1, x1 = px_to_col_off(abs_x1, col_pixels)
                        row1, y1 = px_to_row_off(abs_y1, row_pixels)
                        col2, x2 = px_to_col_off(abs_x2, col_pixels)
                        row2, y2 = px_to_row_off(abs_y2, row_pixels)
                    else:
                        abs_x = timeline_origin_x + shape['x']
                        abs_y = timeline_origin_y + shape['y']
                        abs_w = max(1, shape['w'])
                        abs_h = max(1, shape['h'])

                        col1, x1 = px_to_col_off(abs_x, col_pixels)
                        row1, y1 = px_to_row_off(abs_y, row_pixels)
                        col2, x2 = px_to_col_off(abs_x + abs_w, col_pixels)
                        row2, y2 = px_to_row_off(abs_y + abs_h, row_pixels)

                    anchor = ET.SubElement(wsdr, ET.QName(NS['xdr'], 'twoCellAnchor'))
                    frm = ET.SubElement(anchor, ET.QName(NS['xdr'], 'from'))
                    ET.SubElement(frm, ET.QName(NS['xdr'], 'col')).text = str(col1)
                    ET.SubElement(frm, ET.QName(NS['xdr'], 'colOff')).text = str(px_to_emu(x1))
                    ET.SubElement(frm, ET.QName(NS['xdr'], 'row')).text = str(row1)
                    ET.SubElement(frm, ET.QName(NS['xdr'], 'rowOff')).text = str(px_to_emu(y1))
                    to = ET.SubElement(anchor, ET.QName(NS['xdr'], 'to'))
                    ET.SubElement(to, ET.QName(NS['xdr'], 'col')).text = str(col2)
                    ET.SubElement(to, ET.QName(NS['xdr'], 'colOff')).text = str(px_to_emu(x2))
                    ET.SubElement(to, ET.QName(NS['xdr'], 'row')).text = str(row2)
                    ET.SubElement(to, ET.QName(NS['xdr'], 'rowOff')).text = str(px_to_emu(y2))

                    if shape['type'] in ('cxn', 'cxn_bend'):
                        sp = ET.SubElement(anchor, ET.QName(NS['xdr'], 'cxnSp'))
                        nv = ET.SubElement(sp, ET.QName(NS['xdr'], 'nvCxnSpPr'))
                        ET.SubElement(nv, ET.QName(NS['xdr'], 'cNvPr'), id=str(shape_id), name=f"Connector {shape_id}")
                        ET.SubElement(nv, ET.QName(NS['xdr'], 'cNvCxnSpPr'))
                        ET.SubElement(nv, ET.QName(NS['xdr'], 'nvPr'))
                        sppr = ET.SubElement(sp, ET.QName(NS['xdr'], 'spPr'))
                        xfrm = ET.SubElement(sppr, ET.QName(NS['a'], 'xfrm'))
                        ET.SubElement(xfrm, ET.QName(NS['a'], 'off'), x="0", y="0")
                        ET.SubElement(xfrm, ET.QName(NS['a'], 'ext'),
                                      cx=str(px_to_emu(abs_w)), cy=str(px_to_emu(abs_h)))
                        prst_type = "bentConnector2" if shape['type'] == 'cxn_bend' else "straightConnector1"
                        prst = ET.SubElement(sppr, ET.QName(NS['a'], 'prstGeom'), prst=prst_type)
                        ET.SubElement(prst, ET.QName(NS['a'], 'avLst'))
                        line = shape.get('line')
                        if line:
                            width_pt = float(line.get('width', 1))
                            ln = ET.SubElement(sppr, ET.QName(NS['a'], 'ln'), w=str(int(width_pt * 12700)))
                            lsolid = ET.SubElement(ln, ET.QName(NS['a'], 'solidFill'))
                            ET.SubElement(lsolid, ET.QName(NS['a'], 'srgbClr'), val=line.get('color', 'FF0000'))
                            dash = line.get('dash')
                            if dash:
                                ET.SubElement(ln, ET.QName(NS['a'], 'prstDash'), val=dash)
                            if line.get('arrow') == 'triangle':
                                arrow_dir = line.get('arrow_dir', 'head')
                                if arrow_dir == 'tail':
                                    ET.SubElement(ln, ET.QName(NS['a'], 'tailEnd'), type="triangle", w="sm", len="sm")
                                else:
                                    ET.SubElement(ln, ET.QName(NS['a'], 'headEnd'), type="triangle", w="sm", len="sm")
                        ET.SubElement(anchor, ET.QName(NS['xdr'], 'clientData'))
                    elif shape['type'] == 'line':
                        sp = ET.SubElement(anchor, ET.QName(NS['xdr'], 'sp'))
                        nv = ET.SubElement(sp, ET.QName(NS['xdr'], 'nvSpPr'))
                        ET.SubElement(nv, ET.QName(NS['xdr'], 'cNvPr'), id=str(shape_id), name=f"Line {shape_id}")
                        ET.SubElement(nv, ET.QName(NS['xdr'], 'cNvSpPr'))
                        ET.SubElement(nv, ET.QName(NS['xdr'], 'nvPr'))
                        sppr = ET.SubElement(sp, ET.QName(NS['xdr'], 'spPr'))
                        xfrm = ET.SubElement(sppr, ET.QName(NS['a'], 'xfrm'))
                        ET.SubElement(xfrm, ET.QName(NS['a'], 'off'), x="0", y="0")
                        ET.SubElement(xfrm, ET.QName(NS['a'], 'ext'), cx="0", cy="0")
                        prst = ET.SubElement(sppr, ET.QName(NS['a'], 'prstGeom'), prst="line")
                        ET.SubElement(prst, ET.QName(NS['a'], 'avLst'))
                        line = shape.get('line')
                        if line:
                            ln = ET.SubElement(sppr, ET.QName(NS['a'], 'ln'), w=str(int(line.get('width', 1) * 12700)))
                            lsolid = ET.SubElement(ln, ET.QName(NS['a'], 'solidFill'))
                            ET.SubElement(lsolid, ET.QName(NS['a'], 'srgbClr'), val=line.get('color', '94A3B8'))
                            dash = line.get('dash')
                            if dash:
                                ET.SubElement(ln, ET.QName(NS['a'], 'prstDash'), val=dash)
                            if line.get('arrow') == 'triangle':
                                arrow_dir = line.get('arrow_dir', 'head')
                                if arrow_dir == 'tail':
                                    ET.SubElement(ln, ET.QName(NS['a'], 'tailEnd'), type="triangle", w="sm", len="sm")
                                else:
                                    ET.SubElement(ln, ET.QName(NS['a'], 'headEnd'), type="triangle", w="sm", len="sm")
                        ET.SubElement(anchor, ET.QName(NS['xdr'], 'clientData'))
                    else:
                        sp = ET.SubElement(anchor, ET.QName(NS['xdr'], 'sp'))
                        nv = ET.SubElement(sp, ET.QName(NS['xdr'], 'nvSpPr'))
                        ET.SubElement(nv, ET.QName(NS['xdr'], 'cNvPr'), id=str(shape_id), name=f"Shape {shape_id}")
                        ET.SubElement(nv, ET.QName(NS['xdr'], 'cNvSpPr'))
                        ET.SubElement(nv, ET.QName(NS['xdr'], 'nvPr'))

                        sppr = ET.SubElement(sp, ET.QName(NS['xdr'], 'spPr'))
                        xfrm = ET.SubElement(sppr, ET.QName(NS['a'], 'xfrm'))
                        ET.SubElement(xfrm, ET.QName(NS['a'], 'off'), x="0", y="0")
                        ET.SubElement(xfrm, ET.QName(NS['a'], 'ext'),
                                      cx=str(px_to_emu(abs_w)), cy=str(px_to_emu(abs_h)))

                        prst_type = "rect" if shape['type'] == 'text' else shape['type']
                        prst = ET.SubElement(sppr, ET.QName(NS['a'], 'prstGeom'), prst=prst_type)
                        ET.SubElement(prst, ET.QName(NS['a'], 'avLst'))

                        fill = shape.get('fill')
                        if shape['type'] == 'text':
                            ET.SubElement(sppr, ET.QName(NS['a'], 'noFill'))
                        elif fill:
                            solid = ET.SubElement(sppr, ET.QName(NS['a'], 'solidFill'))
                            ET.SubElement(solid, ET.QName(NS['a'], 'srgbClr'), val=fill)
                        else:
                            ET.SubElement(sppr, ET.QName(NS['a'], 'noFill'))

                        line = shape.get('line')
                        if line and shape['type'] != 'text':
                            ln = ET.SubElement(sppr, ET.QName(NS['a'], 'ln'), w=str(int(line.get('width', 1) * 12700)))
                            lsolid = ET.SubElement(ln, ET.QName(NS['a'], 'solidFill'))
                            ET.SubElement(lsolid, ET.QName(NS['a'], 'srgbClr'), val=line.get('color', '000000'))
                            dash = line.get('dash')
                            if dash:
                                ET.SubElement(ln, ET.QName(NS['a'], 'prstDash'), val=dash)

                        if shape['type'] == 'text':
                            tx = ET.SubElement(sp, ET.QName(NS['xdr'], 'txBody'))
                            ET.SubElement(tx, ET.QName(NS['a'], 'bodyPr'), wrap="none")
                            ET.SubElement(tx, ET.QName(NS['a'], 'lstStyle'))
                            p = ET.SubElement(tx, ET.QName(NS['a'], 'p'))
                            r = ET.SubElement(p, ET.QName(NS['a'], 'r'))
                            rpr = ET.SubElement(r, ET.QName(NS['a'], 'rPr'), lang="ko-KR", sz=str(int(shape.get('font', {}).get('size', 8) * 100)))
                            color = shape.get('font', {}).get('color')
                            if color:
                                solid = ET.SubElement(rpr, ET.QName(NS['a'], 'solidFill'))
                                ET.SubElement(solid, ET.QName(NS['a'], 'srgbClr'), val=color)
                            ET.SubElement(r, ET.QName(NS['a'], 't')).text = shape.get('text', '')
                            ET.SubElement(p, ET.QName(NS['a'], 'endParaRPr'), lang="ko-KR")

                        ET.SubElement(anchor, ET.QName(NS['xdr'], 'clientData'))
                    shape_id += 1

                for shape in shapes:
                    add_shape(shape)

                drawing_xml = ET.tostring(wsdr, encoding='utf-8', xml_declaration=True)

                with zipfile.ZipFile(BytesIO(xlsx_bytes), 'r') as zin:
                    names = zin.namelist()

                # Resolve sheet path for gantt
                with zipfile.ZipFile(BytesIO(xlsx_bytes), 'r') as zin:
                    wb_xml = zin.read('xl/workbook.xml')
                    wb_root = ET.fromstring(wb_xml)
                    sheets = wb_root.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet')
                    sheet_rid = None
                    for s in sheets:
                        if s.get('name') == '공사예정공정표':
                            sheet_rid = s.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                            break
                    rels_root = ET.fromstring(zin.read('xl/_rels/workbook.xml.rels'))
                    sheet_target = None
                    for rel in rels_root:
                        if rel.get('Id') == sheet_rid:
                            sheet_target = rel.get('Target')
                            break

                if not sheet_target:
                    print("[export-excel] gantt_inject: sheet_target not found")
                    return xlsx_bytes

                sheet_path = 'xl/' + sheet_target
                sheet_rels_path = 'xl/worksheets/_rels/' + sheet_target.split('/')[-1] + '.rels'

                # New drawing id
                drawing_numbers = []
                for name in names:
                    if name.startswith('xl/drawings/drawing') and name.endswith('.xml'):
                        try:
                            drawing_numbers.append(int(name.replace('xl/drawings/drawing', '').replace('.xml', '')))
                        except ValueError:
                            pass
                drawing_id = max(drawing_numbers) + 1 if drawing_numbers else 1
                drawing_name = f'xl/drawings/drawing{drawing_id}.xml'
                print(f"[export-excel] gantt_inject: drawing_id={drawing_id} sheet={sheet_path}")

                # Update sheet XML to reference drawing
                with zipfile.ZipFile(BytesIO(xlsx_bytes), 'r') as zin:
                    sheet_xml = zin.read(sheet_path)
                sheet_root = ET.fromstring(sheet_xml)
                drawing_tag = sheet_root.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}drawing')
                if drawing_tag is not None:
                    sheet_root.remove(drawing_tag)
                drawing_tag = ET.Element(ET.QName(NS['main'], 'drawing'))
                # Place drawing tag at end (after pageSetup if present) to match schema order.
                page_setup = sheet_root.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}pageSetup')
                if page_setup is not None:
                    parent = sheet_root
                    idx = list(parent).index(page_setup)
                    parent.insert(idx + 1, drawing_tag)
                else:
                    sheet_root.append(drawing_tag)
                # Update rels to point to drawing
                ns_rels = 'http://schemas.openxmlformats.org/package/2006/relationships'
                try:
                    with zipfile.ZipFile(BytesIO(xlsx_bytes), 'r') as zin:
                        sheet_rels_xml = zin.read(sheet_rels_path)
                    rels_root = ET.fromstring(sheet_rels_xml)
                except KeyError:
                    rels_root = ET.Element(ET.QName(ns_rels, 'Relationships'))

                existing_ids = {rel.get('Id') for rel in rels_root.findall(f'{{{ns_rels}}}Relationship')}
                rid_num = 1
                new_rid = f"rId{rid_num}"
                while new_rid in existing_ids:
                    rid_num += 1
                    new_rid = f"rId{rid_num}"

                drawing_tag.set(ET.QName(NS['rel'], 'id'), new_rid)
                ET.SubElement(rels_root, ET.QName(ns_rels, 'Relationship'), Id=new_rid,
                              Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing',
                              Target=f"../drawings/drawing{drawing_id}.xml")

                sheet_xml_out = ET.tostring(sheet_root, encoding='utf-8', xml_declaration=True)
                rels_xml_out = ET.tostring(rels_root, encoding='utf-8', xml_declaration=True)

                # Update [Content_Types].xml
                with zipfile.ZipFile(BytesIO(xlsx_bytes), 'r') as zin:
                    content_xml = zin.read('[Content_Types].xml')
                ct_root = ET.fromstring(content_xml)
                override_exists = False
                for ov in ct_root.findall('{http://schemas.openxmlformats.org/package/2006/content-types}Override'):
                    if ov.get('PartName') == f"/xl/drawings/drawing{drawing_id}.xml":
                        override_exists = True
                        break
                if not override_exists:
                    ct_ns = 'http://schemas.openxmlformats.org/package/2006/content-types'
                    ET.SubElement(ct_root, ET.QName(ct_ns, 'Override'),
                                  PartName=f"/xl/drawings/drawing{drawing_id}.xml",
                                  ContentType="application/vnd.openxmlformats-officedocument.drawing+xml")
                content_xml_out = ET.tostring(ct_root, encoding='utf-8', xml_declaration=True)

                # Write new zip
                out_buf = BytesIO()
                with zipfile.ZipFile(BytesIO(xlsx_bytes), 'r') as zin, zipfile.ZipFile(out_buf, 'w', zipfile.ZIP_DEFLATED) as zout:
                    for item in zin.infolist():
                        name = item.filename
                        if name == sheet_path:
                            zout.writestr(name, sheet_xml_out)
                        elif name == sheet_rels_path:
                            zout.writestr(name, rels_xml_out)
                        elif name == '[Content_Types].xml':
                            zout.writestr(name, content_xml_out)
                        else:
                            zout.writestr(name, zin.read(name))
                    # Add drawing part if not already in archive
                    if drawing_name not in names:
                        zout.writestr(drawing_name, drawing_xml)
                    # Add sheet rels if it didn't exist
                    if sheet_rels_path not in names:
                        zout.writestr(sheet_rels_path, rels_xml_out)

                return out_buf.getvalue()

            output_bytes = _inject_gantt_drawing(output.read())
            output = io.BytesIO(output_bytes)

            safe_name = "".join(ch if ch not in '\\/:*?\"<>|' else "_" for ch in project_name)
            filename = f"공사기간_산정_기준_{safe_name}.xlsx"
            response = HttpResponse(
                output.read(),
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
            response["Content-Disposition"] = f'attachment; filename=\"{filename}\"'
            return response
        except Exception as exc:
            traceback.print_exc()
            return Response(
                {"error": f"export-excel failed: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
