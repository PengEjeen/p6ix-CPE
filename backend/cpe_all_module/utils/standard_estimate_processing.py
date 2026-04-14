"""Utilities for standard-estimate cleanup and productivity merge.

This module contains two reusable pipelines:
1) Build cleaned standard-estimate CSV (v8 logic, abnormal 6 items rebuild)
2) Merge cleaned CSV into construction_productivity format with pum/count fields
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import OrderedDict
from copy import deepcopy
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

ITEM_PATTERN = re.compile(r"^\d+-\d+-\d+")
NUM_RE = re.compile(r"\d+(?:\.\d+)?")
COUNT_PATTERN = re.compile(
    r"([가-힣A-Za-z0-9()\-/·\s]+?)\s*([0-9]+(?:\.[0-9]+)?)\s*(인|명|조|대|기|set|Set)\b"
)
INT_EPS = 1e-6

ABNORMAL_ITEMS = [
    "13-10-1 OPEN BELT CONVEYOR 설치('92년 보완)",
    "13-6-8 Spiral Casing 설치",
    "13-6-9 Steel Penstock 제작",
    "13-7-14 혼선로 및 전로 본체 조립 설치",
    "7-1-2 예인선 조합회항시에 예인선의 조합은 다음을 표준으로 한다.",
    "9-5-4 수치지도 작성('21, '22, '24, '26년 보완)",
]

ROLE_ALIASES = [
    ("BeltConveyor설치공", "BeltConveyor설치공"),
    ("기계설비공", "기계설비공"),
    ("저압케이블전공", "저압케이블전공"),
    ("플랜트기계설치공", "플랜트기계설치공"),
    ("플랜트배관공", "플랜트배관공"),
    ("플랜트용접공", "플랜트용접공"),
    ("플랜트제관공", "플랜트제관공"),
    ("플랜트전공", "플랜트전공"),
    ("특수운전공", "특수운전공"),
    ("특수비계공", "특수비계공"),
    ("인력운반공", "인력운반공"),
    ("기계기사", "기계기사"),
    ("기계기술사", "기계기술사"),
    ("기계산업기사", "기계산업기사"),
    ("산소절단공", "산소절단공"),
    ("형틀목공", "형틀목공"),
    ("측량기사", "측량기사"),
    ("측량사", "측량사"),
    ("마킹공", "마킹공"),
    ("도장공", "도장공"),
    ("석공", "석공"),
    ("비계공", "비계공"),
    ("계장공", "계장공"),
    ("용접공", "용접공"),
    ("배관공", "배관공"),
    ("착암공", "착암공"),
    ("시험사1급", "시험사1급"),
    ("특별인부", "특별인부"),
    ("보통인부", "보통인부"),
    ("인부", "인부"),
]

OUT_COLUMNS = [
    "id",
    "main_category",
    "category",
    "sub_category",
    "item_name",
    "standard",
    "unit",
    "crew_composition_text",
    "productivity_type",
    "skill_worker_1_pum",
    "skill_worker_1_count",
    "skill_worker_2_pum",
    "skill_worker_2_count",
    "special_worker_pum",
    "special_worker_count",
    "common_worker_pum",
    "common_worker_count",
    "equipment_pum",
    "equipment_count",
    "pumsam_workload",
    "molit_workload",
]


def norm(v: object) -> str:
    return str(v or "").strip()


def nospace(v: object) -> str:
    return re.sub(r"\s+", "", norm(v))


def ffmt(v: float) -> str:
    s = f"{float(v):.4f}"
    return s.rstrip("0").rstrip(".") if "." in s else s


def parse_nums(text: object) -> List[float]:
    return [float(x) for x in NUM_RE.findall(norm(text).replace(",", ""))]


def as_float(v: object) -> float:
    t = norm(v).replace(",", "")
    if not t:
        return 0.0
    try:
        return float(t)
    except Exception:
        return 0.0


def fmt_num(v: float) -> str:
    s = f"{v:.4f}"
    return s.rstrip("0").rstrip(".") if "." in s else s


def fmt_int(v: int) -> str:
    return str(int(v)) if v else "0"


def read_csv_rows(path: Path) -> List[dict]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_csv_rows(path: Path, rows: Sequence[dict], fieldnames: Sequence[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


def cell_text(cell: dict) -> str:
    return " ".join(
        (k.get("content") or "").strip()
        for k in (cell.get("kids") or [])
        if (k.get("content") or "").strip()
    ).strip()


def load_source_tables(src_json: Path) -> Dict[str, List[dict]]:
    with src_json.open("r", encoding="utf-8") as f:
        root = json.load(f)

    kids = root.get("kids", [])
    out: Dict[str, List[dict]] = {}
    i = 0
    while i < len(kids):
        n = kids[i]
        if n.get("type") == "heading":
            h = norm(n.get("content"))
            if ITEM_PATTERN.match(h):
                arr: List[dict] = []
                j = i + 1
                while j < len(kids):
                    m = kids[j]
                    if m.get("type") == "heading" and ITEM_PATTERN.match(norm(m.get("content"))):
                        break
                    if m.get("type") == "table":
                        rows = []
                        for rr in (m.get("rows") or []):
                            rows.append([cell_text(c) for c in (rr.get("cells") or [])])
                        arr.append(
                            {
                                "page": m.get("page number"),
                                "ncols": m.get("number of columns"),
                                "rows": rows,
                            }
                        )
                    j += 1
                out[h] = arr
                i = j
                continue
        i += 1

    return out


def make_template(base: dict) -> dict:
    out = deepcopy(base)
    out["규격"] = ""
    out["단위(표준품셈 기준)"] = ""
    out["산근근거(작업조 1팀당 인원 및 장비구성)"] = ""
    for k in (
        "기능공1",
        "기능공2",
        "특별인부",
        "보통인부",
        "장비",
        "투입 품",
        "표준품셈",
        "국토부 가이드라인",
        "평균",
    ):
        out[k] = "0"
    return out


def add_labor_numbers(row: dict, skill: float = 0.0, special: float = 0.0, common: float = 0.0, equip: float = 0.0) -> None:
    total = skill + special + common + equip
    row["기능공1"] = ffmt(skill)
    row["특별인부"] = ffmt(special)
    row["보통인부"] = ffmt(common)
    row["장비"] = ffmt(equip)
    row["투입 품"] = ffmt(total)
    row["표준품셈"] = ffmt(total)
    row["평균"] = ffmt(total)


def extract_roles(text: object) -> List[str]:
    t = nospace(text)
    roles: List[str] = []
    aliases = sorted(ROLE_ALIASES, key=lambda x: len(x[0]), reverse=True)
    i = 0
    while i < len(t):
        matched = None
        for src, dst in aliases:
            if t.startswith(src, i):
                matched = (src, dst)
                break
        if matched:
            roles.append(matched[1])
            i += len(matched[0])
        else:
            i += 1
    return roles


def bucket_role(role: str) -> str:
    if role == "특별인부":
        return "special"
    if role in {"보통인부", "인부"}:
        return "common"
    return "skill"


def replace_item_rows(rows: List[dict], item: str, new_rows: Sequence[dict], removed_rows: List[dict], reason: str) -> Tuple[int, int]:
    idxs = [i for i, r in enumerate(rows) if norm(r.get("표준품셈 목차")) == item]
    if not idxs:
        return 0, 0

    first = idxs[0]
    removed = [rows[i] for i in idxs]
    for rr in removed:
        x = deepcopy(rr)
        x["_reason"] = reason
        removed_rows.append(x)

    idx_set = set(idxs)
    keep = [r for i, r in enumerate(rows) if i not in idx_set]
    rows[:] = keep[:first] + list(new_rows) + keep[first:]
    return len(removed), len(new_rows)


def rebuild_13_10_1(base: dict, tables: Sequence[dict]) -> List[dict]:
    out: List[dict] = []
    table_index = 0
    for t in tables:
        rows = t.get("rows") or []
        if len(rows) < 2:
            continue

        header = [nospace(x) for x in rows[0]]
        if len(header) < 6 or "BeltConveyor설치공" not in "".join(header):
            continue

        data = rows[1]
        if len(data) < 6:
            continue

        table_index += 1
        width_tokens = re.findall(r'\d+"(?:이하|이상)?', nospace(data[0]))
        role_names = [nospace(x) for x in rows[0][1:-1]]
        role_qty_lists = [parse_nums(data[i]) for i in range(1, min(len(data), len(rows[0]) - 1))]
        total_list = parse_nums(data[len(rows[0]) - 1]) if len(data) >= len(rows[0]) else []

        n = min(len(width_tokens), *(len(qs) for qs in role_qty_lists if qs)) if role_qty_lists else 0
        if n == 0:
            continue

        for i in range(n):
            row = make_template(base)
            std = width_tokens[i]
            if table_index > 1:
                std = f"{std} (표{table_index})"
            row["규격"] = std
            row["단위(표준품셈 기준)"] = "belt"

            skill = special = common = 0.0
            crew_parts = []
            for role, qlist in zip(role_names, role_qty_lists):
                if i >= len(qlist):
                    continue
                q = qlist[i]
                if q <= 0:
                    continue
                crew_parts.append(f"{role} {ffmt(q)}인")
                b = bucket_role(role)
                if b == "special":
                    special += q
                elif b == "common":
                    common += q
                else:
                    skill += q

            row["산근근거(작업조 1팀당 인원 및 장비구성)"] = ", ".join(crew_parts) + " 기준" if crew_parts else "기준"
            total = total_list[i] if i < len(total_list) else (skill + special + common)
            row["기능공1"] = ffmt(skill)
            row["특별인부"] = ffmt(special)
            row["보통인부"] = ffmt(common)
            row["장비"] = "0"
            row["투입 품"] = ffmt(total)
            row["표준품셈"] = ffmt(total)
            row["평균"] = ffmt(total)
            out.append(row)

    return out


def rebuild_7_1_2(base: dict) -> List[dict]:
    mapping = [
        ("펌프준설선 448이하", "예인선 119~336"),
        ("펌프준설선 746~1492", "예인선 373~746"),
        ("펌프준설선 1641~5968", "예인선 746~1790"),
        ("펌프준설선 8952이상", "예인선 1790이상"),
        ("그래브준설선 75~1492", "예인선 187~336"),
        ("토운선 60~300㎥", "예인선 119~187"),
        ("토운선 300㎥이상", "예인선 187~1790"),
    ]

    out: List[dict] = []
    for std, tug in mapping:
        row = make_template(base)
        row["규격"] = std
        row["단위(표준품셈 기준)"] = "조합"
        row["산근근거(작업조 1팀당 인원 및 장비구성)"] = f"{tug} 기준"
        add_labor_numbers(row)
        out.append(row)

    return out


def rebuild_9_5_4(base: dict, tables: Sequence[dict]) -> List[dict]:
    target = None
    for t in tables:
        rows = t.get("rows") or []
        if len(rows) >= 3 and "참여비율" in "".join(rows[2]):
            target = t
            break
    if not target:
        return []

    ratio_vals = parse_nums(" ".join(target["rows"][2]))
    if not ratio_vals:
        ratio_vals = [5, 10, 15, 10, 10, 30, 20, 100]

    standards = [
        "기술자-특급",
        "기술자-고급",
        "기술자-중급",
        "기술자-초급",
        "기능사(도화)-고급",
        "기능사(도화)-중급",
        "기능사(도화)-초급",
        "계",
    ]

    out: List[dict] = []
    for i, std in enumerate(standards):
        if i >= len(ratio_vals):
            break
        row = make_template(base)
        row["규격"] = std
        row["단위(표준품셈 기준)"] = "%"
        row["산근근거(작업조 1팀당 인원 및 장비구성)"] = f"참여비율 {ffmt(ratio_vals[i])}% 기준"
        add_labor_numbers(row)
        out.append(row)

    return out


def rebuild_compact_from_3col(base: dict, tables: Sequence[dict], item_label: str) -> List[dict]:
    out: List[dict] = []
    idx = 0
    for t in tables:
        rows = t.get("rows") or []
        if len(rows) < 2:
            continue

        header = "".join(nospace(x) for x in rows[0])
        if "공정별" not in header or "직종" not in header or "수량" not in header:
            continue

        data = rows[1]
        if len(data) < 3:
            continue

        roles = extract_roles(data[1])
        qtys = parse_nums(data[2])
        pairs = list(zip(roles[: len(qtys)], qtys[: len(roles)]))
        if not pairs:
            continue

        idx += 1
        skill = special = common = 0.0
        parts = []
        for role, q in pairs:
            parts.append(f"{role} {ffmt(q)}인")
            b = bucket_role(role)
            if b == "special":
                special += q
            elif b == "common":
                common += q
            else:
                skill += q

        row = make_template(base)
        row["규격"] = f"{item_label}-표{idx}공정종합"
        row["단위(표준품셈 기준)"] = "식"
        preview = ", ".join(parts[:8])
        if len(parts) > 8:
            preview += ", ..."
        row["산근근거(작업조 1팀당 인원 및 장비구성)"] = preview + " 기준"
        add_labor_numbers(row, skill=skill, special=special, common=common)
        out.append(row)

    return out


def rebuild_13_7_14(base: dict, tables: Sequence[dict]) -> List[dict]:
    target = None
    for t in tables:
        rows = t.get("rows") or []
        if len(rows) < 2:
            continue
        h = "".join(nospace(x) for x in rows[0])
        if "작업구분" in h and "직종" in h and "수량" in h:
            target = t
            break
    if not target:
        return []

    data = target["rows"][1]
    if len(data) < 4:
        return []

    roles = extract_roles(data[1])
    qtys = parse_nums(data[3])
    n = min(len(roles), len(qtys))
    if n == 0:
        return []

    labels = ["기술", "관리", "표면", "손질", "작업", "토의", "운반", "조작", "보조1", "보조2", "보조3", "보조4"]
    while len(labels) < n:
        labels.append(f"보조{len(labels)-7}")

    out: List[dict] = []
    for i in range(n):
        role = roles[i]
        q = qtys[i]
        row = make_template(base)
        row["규격"] = labels[i]
        row["단위(표준품셈 기준)"] = "식"
        row["산근근거(작업조 1팀당 인원 및 장비구성)"] = f"{role} {ffmt(q)}인 기준"
        b = bucket_role(role)
        skill = q if b == "skill" else 0.0
        special = q if b == "special" else 0.0
        common = q if b == "common" else 0.0
        add_labor_numbers(row, skill=skill, special=special, common=common)
        out.append(row)

    return out


def build_cleaned_v8(src_v7: Path, src_json: Path, out_v8: Path, out_removed: Path | None = None, report_path: Path | None = None) -> dict:
    rows = read_csv_rows(src_v7)
    if not rows:
        raise ValueError(f"empty csv: {src_v7}")
    fieldnames = list(rows[0].keys())

    src_tables = load_source_tables(src_json)
    removed_rows: List[dict] = []
    stats: List[Tuple[str, int, int, str]] = []

    for item in ABNORMAL_ITEMS:
        old_rows = [r for r in rows if norm(r.get("표준품셈 목차")) == item]
        if not old_rows:
            stats.append((item, 0, 0, "missing_item"))
            continue

        base = old_rows[0]
        tables = src_tables.get(item, [])
        if item == "13-10-1 OPEN BELT CONVEYOR 설치('92년 보완)":
            new_rows = rebuild_13_10_1(base, tables)
        elif item == "7-1-2 예인선 조합회항시에 예인선의 조합은 다음을 표준으로 한다.":
            new_rows = rebuild_7_1_2(base)
        elif item == "9-5-4 수치지도 작성('21, '22, '24, '26년 보완)":
            new_rows = rebuild_9_5_4(base, tables)
        elif item == "13-6-8 Spiral Casing 설치":
            new_rows = rebuild_compact_from_3col(base, tables, "SpiralCasing")
        elif item == "13-6-9 Steel Penstock 제작":
            new_rows = rebuild_compact_from_3col(base, tables, "SteelPenstock")
        elif item == "13-7-14 혼선로 및 전로 본체 조립 설치":
            new_rows = rebuild_13_7_14(base, tables)
        else:
            new_rows = []

        if not new_rows:
            stats.append((item, len(old_rows), len(old_rows), "builder_empty_keep_old"))
            continue

        removed, added = replace_item_rows(rows, item, new_rows, removed_rows, "v8_abnormal6_rebuild")
        stats.append((item, removed, added, "rebuilt"))

    write_csv_rows(out_v8, rows, fieldnames)

    if out_removed is not None:
        write_csv_rows(out_removed, removed_rows, fieldnames + ["_reason"])

    if report_path is not None:
        lines = [
            "# 2026 표준품셈 v8 정제 리포트 (확정 이상 6건 재구성)",
            "",
            f"- 입력: `{src_v7}`",
            f"- 원본 근거(JSON): `{src_json}`",
            f"- 출력: `{out_v8}`",
            f"- 제거행: `{out_removed}`",
            "",
            f"- 입력 행수: {len(read_csv_rows(src_v7))}",
            f"- 출력 행수: {len(rows)}",
            f"- 제거된 원본 행수: {len(removed_rows)}",
            "",
            "## 이상 6건 재구성 결과",
        ]
        for item, removed, added, status in stats:
            lines.append(f"- {item}: {status} (old={removed}, new={added})")
        report_path.write_text("\n".join(lines), encoding="utf-8")

    return {
        "rows_in": len(read_csv_rows(src_v7)),
        "rows_out": len(rows),
        "removed_rows": len(removed_rows),
        "stats": stats,
    }


def role_bucket_for_count(role_text: str) -> str:
    role = re.sub(r"\s+", "", role_text)
    if not role:
        return "unknown"
    if "특별인부" in role:
        return "special"
    if "보통인부" in role or role == "인부":
        return "common"
    return "skill"


def extract_counts(crew_text: str) -> dict:
    text = norm(crew_text)
    if not text:
        return {"skill_1": 0, "skill_2": 0, "special": 0, "common": 0, "equipment": 0}

    skill_by_role: OrderedDict[str, int] = OrderedDict()
    special = 0
    common = 0
    equipment = 0

    for m in COUNT_PATTERN.finditer(text):
        role = norm(m.group(1))
        qty = float(m.group(2))
        unit = m.group(3)

        if unit in {"인", "명", "조"}:
            if qty < 1 or abs(qty - round(qty)) > INT_EPS:
                continue
            c = int(round(qty))
            bucket = role_bucket_for_count(role)
            if bucket == "special":
                special += c
            elif bucket == "common":
                common += c
            else:
                skill_by_role[role] = skill_by_role.get(role, 0) + c
        elif unit in {"대", "기", "set", "Set"}:
            if qty >= 1 and abs(qty - round(qty)) <= INT_EPS:
                equipment += int(round(qty))
            elif qty > 0:
                equipment += 1

    skill_counts = list(skill_by_role.values())
    if len(skill_counts) == 0:
        skill_1 = 0
        skill_2 = 0
    elif len(skill_counts) == 1:
        skill_1 = skill_counts[0]
        skill_2 = 0
    else:
        skill_1 = skill_counts[0]
        skill_2 = sum(skill_counts[1:])

    return {
        "skill_1": skill_1,
        "skill_2": skill_2,
        "special": special,
        "common": common,
        "equipment": equipment,
    }


def merge_key_ko(row: dict) -> Tuple[str, str, str]:
    return (
        norm(row.get("표준품셈 목차")),
        norm(row.get("규격")),
        norm(row.get("산근근거(작업조 1팀당 인원 및 장비구성)")),
    )


def merge_key_en(row: dict) -> Tuple[str, str, str]:
    return (
        norm(row.get("item_name")),
        norm(row.get("standard")),
        norm(row.get("crew_composition_text")),
    )


def convert_row_ko_to_en(src_row: dict, new_id: int) -> dict:
    equipment_pum = as_float(src_row.get("장비"))
    crew = norm(src_row.get("산근근거(작업조 1팀당 인원 및 장비구성)"))
    counts = extract_counts(crew)

    return {
        "id": str(new_id),
        "main_category": norm(src_row.get("중공종")),
        "category": norm(src_row.get("공정")),
        "sub_category": norm(src_row.get("세부공종")),
        "item_name": norm(src_row.get("표준품셈 목차")),
        "standard": norm(src_row.get("규격")),
        "unit": norm(src_row.get("단위(표준품셈 기준)")),
        "crew_composition_text": crew,
        "productivity_type": "",
        "skill_worker_1_pum": norm(src_row.get("기능공1")),
        "skill_worker_1_count": fmt_int(counts["skill_1"]),
        "skill_worker_2_pum": norm(src_row.get("기능공2")),
        "skill_worker_2_count": fmt_int(counts["skill_2"]),
        "special_worker_pum": norm(src_row.get("특별인부")),
        "special_worker_count": fmt_int(counts["special"]),
        "common_worker_pum": norm(src_row.get("보통인부")),
        "common_worker_count": fmt_int(counts["common"]),
        "equipment_pum": fmt_num(equipment_pum),
        "equipment_count": fmt_int(counts["equipment"]),
        "pumsam_workload": norm(src_row.get("표준품셈")),
        "molit_workload": norm(src_row.get("국토부 가이드라인")),
    }


def merge_with_counts(base_csv: Path, new_csv: Path, out_merged: Path, report_path: Path | None = None) -> dict:
    base_rows = read_csv_rows(base_csv)
    new_rows = read_csv_rows(new_csv)

    base_keys = {merge_key_en(r) for r in base_rows}
    new_unique_keys = set()
    append_rows: List[dict] = []
    skipped_overlap = 0
    skipped_new_dup = 0

    max_id = 0
    for r in base_rows:
        try:
            max_id = max(max_id, int(norm(r.get("id"))))
        except Exception:
            continue

    parsed_count_rows = 0
    for src in new_rows:
        key = merge_key_ko(src)
        if key in base_keys:
            skipped_overlap += 1
            continue
        if key in new_unique_keys:
            skipped_new_dup += 1
            continue

        new_unique_keys.add(key)
        max_id += 1
        converted = convert_row_ko_to_en(src, max_id)

        has_any_count = any(
            norm(converted[k]) not in {"", "0", "0.0"}
            for k in (
                "skill_worker_1_count",
                "skill_worker_2_count",
                "special_worker_count",
                "common_worker_count",
                "equipment_count",
            )
        )
        if has_any_count:
            parsed_count_rows += 1

        append_rows.append(converted)

    merged_rows = base_rows + append_rows
    write_csv_rows(out_merged, merged_rows, OUT_COLUMNS)

    if report_path is not None:
        lines = [
            "# construction_productivity 병합(count 포함) 보고서",
            "",
            f"- base: `{base_csv}`",
            f"- 신규(cleaned): `{new_csv}`",
            "",
            "## 병합 기준",
            "- 키: `item_name + standard + crew_composition_text`",
            "- base 기존 중복은 유지, 신규 데이터는 키 중복 시 append 제외",
            "",
            "## 결과",
            f"- base 행 수: {len(base_rows)}",
            f"- 신규 입력 행 수: {len(new_rows)}",
            f"- 신규 append 행 수: {len(append_rows)}",
            f"- base와 키 충돌로 제외: {skipped_overlap}",
            f"- 신규 내부 키 중복으로 제외: {skipped_new_dup}",
            f"- 최종 merged 행 수: {len(merged_rows)}",
            "",
            "## count 파싱",
            f"- count 1개 이상 채워진 행: {parsed_count_rows}",
            "",
            "## 산출물",
            f"- merged csv: `{out_merged}`",
        ]
        report_path.write_text("\n".join(lines), encoding="utf-8")

    return {
        "base": len(base_rows),
        "new": len(new_rows),
        "appended": len(append_rows),
        "merged": len(merged_rows),
        "overlap": skipped_overlap,
        "new_dup": skipped_new_dup,
        "count_rows": parsed_count_rows,
    }


def _build_cli() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Standard estimate cleanup / merge utilities")
    sub = p.add_subparsers(dest="command", required=True)

    p_clean = sub.add_parser("clean-v8")
    p_clean.add_argument("--src-v7", type=Path, required=True)
    p_clean.add_argument("--src-json", type=Path, required=True)
    p_clean.add_argument("--out-v8", type=Path, required=True)
    p_clean.add_argument("--out-removed", type=Path, required=False)
    p_clean.add_argument("--report", type=Path, required=False)

    p_merge = sub.add_parser("merge-count")
    p_merge.add_argument("--base", type=Path, required=True)
    p_merge.add_argument("--new", type=Path, required=True)
    p_merge.add_argument("--out", type=Path, required=True)
    p_merge.add_argument("--report", type=Path, required=False)

    return p


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_cli()
    args = parser.parse_args(argv)

    if args.command == "clean-v8":
        result = build_cleaned_v8(args.src_v7, args.src_json, args.out_v8, args.out_removed, args.report)
        print(result)
        return 0

    if args.command == "merge-count":
        result = merge_with_counts(args.base, args.new, args.out, args.report)
        print(result)
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
