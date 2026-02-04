import math
from io import BytesIO
import zipfile
import xml.etree.ElementTree as ET


def is_parallel(item):
    remarks_text = (item.get("remarks") or "").strip()
    return (
        remarks_text == "병행작업"
        or bool(item.get("_parallelGroup"))
        or bool(item.get("parallelGroup"))
        or bool(item.get("parallel_group"))
        or bool(item.get("is_parallelism"))
    )


def arrow_dir_by_vector(x1, y1, x2, y2):
    dx = x2 - x1
    dy = y2 - y1
    if abs(dx) >= abs(dy):
        return 'head' if dx >= 0 else 'tail'
    # Invert vertical direction to match expected up/down arrows.
    return 'tail' if dy >= 0 else 'head'


def category_color_hex(main_category):
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


def build_items_with_timing(items):
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
    return items_with_timing


def build_subtask_list(sub_tasks):
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
    return subtask_list


def build_cp_meta(items_with_timing):
    cp_meta = {}
    for item_meta in items_with_timing:
        item = item_meta["item"]
        front_parallel = float(item.get("front_parallel_days") or 0)
        back_parallel = float(item.get("back_parallel_days") or 0)
        red_start = item_meta["start_day"] + front_parallel
        red_end = (item_meta["start_day"] + item_meta["duration"]) - back_parallel
        has_segment = red_end > red_start
        is_cp = not is_parallel(item) and has_segment
        cp_meta[item.get("id")] = {
            "red_start": red_start,
            "red_end": red_end,
            "is_cp": is_cp
        }
    return cp_meta


def inject_gantt_drawing(xlsx_bytes, *, shapes, last_col, gantt_row, timeline_start_col, data_start_row):
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
        is_ellipse = shape['type'] == 'ellipse'
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
            if is_ellipse:
                size = max(abs_w, abs_h)
                abs_w = size
                abs_h = size

            col1, x1 = px_to_col_off(abs_x, col_pixels)
            row1, y1 = px_to_row_off(abs_y, row_pixels)
            if not is_ellipse:
                col2, x2 = px_to_col_off(abs_x + abs_w, col_pixels)
                row2, y2 = px_to_row_off(abs_y + abs_h, row_pixels)

        if is_ellipse:
            anchor = ET.SubElement(wsdr, ET.QName(NS['xdr'], 'oneCellAnchor'))
            frm = ET.SubElement(anchor, ET.QName(NS['xdr'], 'from'))
            ET.SubElement(frm, ET.QName(NS['xdr'], 'col')).text = str(col1)
            ET.SubElement(frm, ET.QName(NS['xdr'], 'colOff')).text = str(px_to_emu(x1))
            ET.SubElement(frm, ET.QName(NS['xdr'], 'row')).text = str(row1)
            ET.SubElement(frm, ET.QName(NS['xdr'], 'rowOff')).text = str(px_to_emu(y1))
            ET.SubElement(
                anchor,
                ET.QName(NS['xdr'], 'ext'),
                cx=str(px_to_emu(abs_w)),
                cy=str(px_to_emu(abs_h))
            )
        else:
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
                        ET.SubElement(ln, ET.QName(NS['a'], 'tailEnd'), type="triangle", w="lg", len="lg")
                    else:
                        ET.SubElement(ln, ET.QName(NS['a'], 'headEnd'), type="triangle", w="lg", len="lg")
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
                        ET.SubElement(ln, ET.QName(NS['a'], 'tailEnd'), type="triangle", w="lg", len="lg")
                    else:
                        ET.SubElement(ln, ET.QName(NS['a'], 'headEnd'), type="triangle", w="lg", len="lg")
            ET.SubElement(anchor, ET.QName(NS['xdr'], 'clientData'))
        else:
            sp = ET.SubElement(anchor, ET.QName(NS['xdr'], 'sp'))
            nv = ET.SubElement(sp, ET.QName(NS['xdr'], 'nvSpPr'))
            ET.SubElement(nv, ET.QName(NS['xdr'], 'cNvPr'), id=str(shape_id), name=f"Shape {shape_id}")
            ET.SubElement(nv, ET.QName(NS['xdr'], 'cNvSpPr'))
            ET.SubElement(nv, ET.QName(NS['xdr'], 'nvPr'))

            sppr = ET.SubElement(sp, ET.QName(NS['xdr'], 'spPr'))
            xfrm = ET.SubElement(sppr, ET.QName(NS['a'], 'xfrm'))
            # Add rotation if specified (in degrees, converted to 60000ths of a degree)
            rotation = shape.get('rotation')
            if rotation is not None:
                # Excel uses 60000ths of a degree for rotation (e.g., 180° = 10800000)
                xfrm.set('rot', str(int(rotation * 60000)))
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
                rpr = ET.SubElement(
                    r,
                    ET.QName(NS['a'], 'rPr'),
                    lang="ko-KR",
                    sz=str(int(shape.get('font', {}).get('size', 8) * 100))
                )
                if shape.get('font', {}).get('bold'):
                    rpr.set('b', '1')
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
