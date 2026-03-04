from datetime import timedelta
from io import BytesIO
import math

from PIL import Image, ImageDraw, ImageFont
import xlsxwriter

from .construction_schedule import write_gantt_sheet
from .construction_schedule_gantt import build_items_with_timing


def _col_width_to_px(width):
    max_digit_width = 7.0
    padding = 5.0
    if width <= 0:
        return 0
    if width < 1:
        return int(width * (max_digit_width + padding) + 0.5)
    return int(width * max_digit_width + 0.5) + int(padding)


def _row_height_to_px(height_pt):
    return int(height_pt * 4 / 3 + 0.5)


def _hex_to_rgb(hex_color, default=(0, 0, 0)):
    text = str(hex_color or "").strip().lstrip("#")
    if len(text) == 6:
        try:
            return tuple(int(text[i:i + 2], 16) for i in (0, 2, 4))
        except ValueError:
            return default
    return default


def _load_font(size=12, bold=False):
    candidates = [
        "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf" if bold else "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size=size)
        except Exception:
            continue
    return ImageFont.load_default()


def _draw_dashed_line(draw, xy1, xy2, color, width=1, dash=6, gap=4):
    x1, y1 = xy1
    x2, y2 = xy2
    dx = x2 - x1
    dy = y2 - y1
    distance = math.hypot(dx, dy)
    if distance <= 0:
        return
    vx = dx / distance
    vy = dy / distance
    start = 0
    while start < distance:
        end = min(start + dash, distance)
        sx = x1 + vx * start
        sy = y1 + vy * start
        ex = x1 + vx * end
        ey = y1 + vy * end
        draw.line((sx, sy, ex, ey), fill=color, width=max(1, int(width)))
        start += dash + gap


def _draw_arrow(draw, from_xy, to_xy, color, size=8):
    x1, y1 = from_xy
    x2, y2 = to_xy
    angle = math.atan2(y2 - y1, x2 - x1)
    left = (x2 - size * math.cos(angle - math.pi / 6), y2 - size * math.sin(angle - math.pi / 6))
    right = (x2 - size * math.cos(angle + math.pi / 6), y2 - size * math.sin(angle + math.pi / 6))
    draw.polygon([to_xy, left, right], fill=color)


def _draw_text(draw, x, y, text, size=11, color=(0, 0, 0), bold=False):
    if not text:
        return
    font = _load_font(size=size, bold=bold)
    draw.text((x, y), str(text), font=font, fill=color)


def build_gantt_preview_png(items, sub_tasks, links, project_name, start_date):
    output = BytesIO()
    wb = xlsxwriter.Workbook(output, {"in_memory": True})
    meta = write_gantt_sheet(wb, items, sub_tasks, links, project_name, start_date)
    wb.close()

    last_col = int(meta.get("last_col", 10))
    gantt_row = int(meta.get("gantt_row", 10))
    timeline_start_col = int(meta.get("timeline_start_col", 5))
    data_start_row = int(meta.get("data_start_row", 5))
    shapes = list(meta.get("shapes") or [])

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
        col_pixels.append(_col_width_to_px(w))

    row_pixels = []
    for r in range(0, max(gantt_row + 4, data_start_row + len(items) + 2)):
        if r == 0:
            h = 39.95
        elif r == 4:
            h = 60
        else:
            h = 30
        row_pixels.append(_row_height_to_px(h))

    x_offsets = [0]
    for w in col_pixels:
        x_offsets.append(x_offsets[-1] + w)
    y_offsets = [0]
    for h in row_pixels:
        y_offsets.append(y_offsets[-1] + h)

    width = x_offsets[-1] + 20
    height = y_offsets[min(len(row_pixels), gantt_row + 1)] + 20
    image = Image.new("RGB", (max(1, int(width)), max(1, int(height))), (255, 255, 255))
    draw = ImageDraw.Draw(image)

    header_bg = (217, 217, 217)
    grid_color = (210, 210, 210)
    border_color = (0, 0, 0)

    for row in [2, 3, 4]:
        y1 = y_offsets[row]
        y2 = y_offsets[row + 1]
        draw.rectangle((0, y1, x_offsets[-1], y2), fill=header_bg)

    for x in x_offsets:
        draw.line((x, y_offsets[2], x, y_offsets[gantt_row]), fill=grid_color, width=1)
    for y in y_offsets[2:gantt_row + 1]:
        draw.line((0, y, x_offsets[-1], y), fill=grid_color, width=1)
    draw.rectangle((0, y_offsets[2], x_offsets[-1], y_offsets[gantt_row]), outline=border_color, width=2)

    _draw_text(draw, x_offsets[-1] // 2 - 90, y_offsets[0] + 8, "공 사 예 정 공 정 표", size=20, bold=True)
    _draw_text(draw, 10, y_offsets[1] + 7, f"공사명 : {project_name}", size=12, bold=True)

    # Left headers
    _draw_text(draw, x_offsets[0] + 8, y_offsets[2] + 18, "구분", size=11, bold=True)
    _draw_text(draw, x_offsets[1] + 8, y_offsets[2] + 18, "공정", size=11, bold=True)
    _draw_text(draw, x_offsets[2] + 8, y_offsets[2] + 18, "공종", size=11, bold=True)
    _draw_text(draw, x_offsets[3] + 2, y_offsets[2] + 18, "Calendar Day", size=10, bold=True)
    _draw_text(draw, x_offsets[0] + 12, y_offsets[4] + 20, "적정공기 계획", size=12, bold=True)
    _draw_text(draw, x_offsets[3] + 10, y_offsets[4] + 20, "총간관리일", size=11, bold=True)

    # Timeline headers (10d fixed)
    total_units = max(1, last_col - timeline_start_col + 1)
    timeline_days = []
    timeline_months = []
    current_month_key = None
    for unit in range(total_units):
        day_number = unit * 10
        unit_date = start_date + timedelta(days=day_number)
        month_key = f"{unit_date.year}-{unit_date.month}"
        if month_key != current_month_key:
            timeline_months.append({"label": f"{unit_date.year}.{unit_date.month:02d}", "count": 1})
            current_month_key = month_key
        else:
            timeline_months[-1]["count"] += 1
        dekad = math.floor((unit_date.day - 1) / 10)
        timeline_days.append(["상순", "중순", "하순"][dekad] if dekad < 3 else f"{day_number + 1}")

    month_col = timeline_start_col
    for month in timeline_months:
        end_col = month_col + month["count"] - 1
        x1 = x_offsets[month_col]
        x2 = x_offsets[min(end_col + 1, len(x_offsets) - 1)]
        _draw_text(draw, (x1 + x2) // 2 - 28, y_offsets[2] + 6, month["label"], size=10, bold=True)
        month_col = end_col + 1

    for idx, label in enumerate(timeline_days):
        col = timeline_start_col + idx
        if col + 1 >= len(x_offsets):
            break
        _draw_text(draw, x_offsets[col] + 6, y_offsets[3] + 8, str(label).replace("일", ""), size=9)

    items_with_timing = build_items_with_timing(items)
    for idx, item_meta in enumerate(items_with_timing):
        item = item_meta["item"]
        row = data_start_row + idx
        if row + 1 >= len(y_offsets):
            break
        y_text = y_offsets[row] + 8
        _draw_text(draw, x_offsets[0] + 4, y_text, item.get("main_category", ""), size=10)
        _draw_text(draw, x_offsets[1] + 4, y_text, item.get("process", ""), size=10)
        _draw_text(draw, x_offsets[2] + 4, y_text, item.get("work_type", ""), size=10)
        _draw_text(draw, x_offsets[3] + 4, y_text, item.get("calendar_days", ""), size=10)

    timeline_origin_x = x_offsets[timeline_start_col]
    timeline_origin_y = y_offsets[data_start_row]

    for shape in shapes:
        s_type = shape.get("type")
        if s_type in ("line", "cxn", "cxn_bend"):
            if s_type == "line":
                x1 = timeline_origin_x + float(shape.get("x1", 0))
                y1 = timeline_origin_y + float(shape.get("y1", 0))
                x2 = timeline_origin_x + float(shape.get("x2", 0))
                y2 = timeline_origin_y + float(shape.get("y2", 0))
            else:
                x = timeline_origin_x + float(shape.get("x", 0))
                y = timeline_origin_y + float(shape.get("y", 0))
                w = float(shape.get("w", 1))
                h = float(shape.get("h", 1))
                x1, y1, x2, y2 = (x + w / 2, y, x + w / 2, y + h)
            line = shape.get("line") or {}
            color = _hex_to_rgb(line.get("color", "000000"), default=(0, 0, 0))
            width_px = max(1, int(round(float(line.get("width", 1)))))
            if line.get("dash"):
                _draw_dashed_line(draw, (x1, y1), (x2, y2), color, width=width_px, dash=8, gap=5)
            else:
                draw.line((x1, y1, x2, y2), fill=color, width=width_px)
            if line.get("arrow") == "triangle":
                direction = line.get("arrow_dir", "head")
                if direction == "tail":
                    _draw_arrow(draw, (x2, y2), (x1, y1), color, size=8)
                else:
                    _draw_arrow(draw, (x1, y1), (x2, y2), color, size=8)
            continue

        x = timeline_origin_x + float(shape.get("x", 0))
        y = timeline_origin_y + float(shape.get("y", 0))
        w = float(shape.get("w", 1))
        h = float(shape.get("h", 1))

        if s_type == "rect":
            fill = _hex_to_rgb(shape.get("fill", "FFFFFF"), default=(255, 255, 255))
            line = shape.get("line") or {}
            outline = _hex_to_rgb(line.get("color", "000000"), default=(0, 0, 0))
            draw.rectangle((x, y, x + w, y + h), fill=fill, outline=outline, width=max(1, int(line.get("width", 1))))
        elif s_type == "ellipse":
            fill = _hex_to_rgb(shape.get("fill", "FFFFFF"), default=(255, 255, 255))
            line = shape.get("line") or {}
            outline = _hex_to_rgb(line.get("color", "000000"), default=(0, 0, 0))
            draw.ellipse((x, y, x + w, y + h), fill=fill, outline=outline, width=max(1, int(line.get("width", 1))))
        elif s_type == "triangle":
            fill = _hex_to_rgb(shape.get("fill", "EF4444"), default=(239, 68, 68))
            rotation = int(shape.get("rotation") or 0)
            if rotation == 180:
                points = [(x + w / 2, y + h), (x, y), (x + w, y)]
            else:
                points = [(x + w / 2, y), (x, y + h), (x + w, y + h)]
            draw.polygon(points, fill=fill)
        elif s_type == "text":
            font = shape.get("font") or {}
            color = _hex_to_rgb(font.get("color", "000000"), default=(0, 0, 0))
            _draw_text(
                draw,
                x + 2,
                y + 1,
                shape.get("text", ""),
                size=max(8, int(font.get("size", 8))),
                color=color,
                bold=bool(font.get("bold")),
            )

    # keep output size reasonable for docx
    max_w = 2600
    if image.width > max_w:
        ratio = max_w / float(image.width)
        resample = getattr(Image, "Resampling", Image).LANCZOS
        image = image.resize((int(image.width * ratio), int(image.height * ratio)), resample)

    png_output = BytesIO()
    image.save(png_output, format="PNG", optimize=True)
    png_output.seek(0)
    return png_output.read()
