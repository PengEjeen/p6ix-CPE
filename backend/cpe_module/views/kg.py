from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import logging
import os
from typing import Any
from urllib.parse import quote_plus

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..utils.kg_assistant import generate_execution_card_cached, generate_grounded_answer_cached
from ..utils.kg_cache import TTLCache
from ..utils.kg_jobs import get_job, submit_job
from ..utils.neo4j_kg import search_kg

logger = logging.getLogger(__name__)
ALLOWED_KG_MODES = {"hybrid", "fulltext", "vector"}
CARD_CONTENT_KEYS = {"one_liner", "checklist", "risks", "required_documents"}
AI_ERROR_TEXT_MARKERS = (
    "(ai error",
    "(ai is disabled",
    "openai_api_key is not set",
    "kg service is temporarily unavailable",
)

_EVIDENCE_PACK_CACHE_TTL_S = max(30, int(os.getenv("KG_EVIDENCE_CACHE_TTL_S") or "300"))
_EVIDENCE_PACK_CACHE_MAX_SIZE = max(50, int(os.getenv("KG_EVIDENCE_CACHE_MAX_SIZE") or "400"))
_EVIDENCE_PACK_CACHE = TTLCache(max_size=_EVIDENCE_PACK_CACHE_MAX_SIZE, ttl_s=_EVIDENCE_PACK_CACHE_TTL_S)

_DURATION_AGENT_CACHE_TTL_S = max(30, int(os.getenv("KG_DURATION_AGENT_CACHE_TTL_S") or "300"))
_DURATION_AGENT_CACHE_MAX_SIZE = max(50, int(os.getenv("KG_DURATION_AGENT_CACHE_MAX_SIZE") or "300"))
_DURATION_AGENT_CACHE = TTLCache(max_size=_DURATION_AGENT_CACHE_MAX_SIZE, ttl_s=_DURATION_AGENT_CACHE_TTL_S)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _parse_int(value: Any, *, field: str, default: int, min_value: int, max_value: int) -> int:
    if value in (None, ""):
        parsed = default
    else:
        try:
            parsed = int(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{field} must be an integer") from exc
    return max(min_value, min(parsed, max_value))


def _parse_mode(value: Any) -> str:
    mode = _safe_str(value).lower() or "hybrid"
    if mode not in ALLOWED_KG_MODES:
        raise ValueError(f"mode must be one of: {', '.join(sorted(ALLOWED_KG_MODES))}")
    return mode


def _parse_bool(value: Any, *, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    text = _safe_str(value).lower()
    if not text:
        return default
    if text in {"1", "true", "y", "yes", "on"}:
        return True
    if text in {"0", "false", "n", "no", "off"}:
        return False
    return default


def _is_ai_error_text(value: Any) -> bool:
    text = _safe_str(value).lower()
    if not text:
        return False
    return any(marker in text for marker in AI_ERROR_TEXT_MARKERS)


def _is_ai_error_payload(payload: Any) -> bool:
    if _is_ai_error_text(payload):
        return True
    if not isinstance(payload, dict):
        return False

    has_card_payload = any(key in payload for key in CARD_CONTENT_KEYS)
    if _safe_str(payload.get("detail")) and not has_card_payload:
        return True
    if _safe_str(payload.get("raw")) and not has_card_payload:
        return True
    return False


def _build_schedule_retrieval_query(item: dict[str, Any]) -> str:
    parts = [
        _safe_str(item.get("process")),
        _safe_str(item.get("work_type")),
        _safe_str(item.get("main_category")),
    ]
    parts = [part for part in parts if part]
    return " ".join(parts) if parts else _safe_str(item.get("id") or "")


def _build_schedule_llm_query(item: dict[str, Any]) -> str:
    # Keep this short: it affects grounding prompt size.
    main_category = _safe_str(item.get("main_category"))
    process = _safe_str(item.get("process"))
    work_type = _safe_str(item.get("work_type"))
    quantity = _safe_str(item.get("quantity"))
    unit = _safe_str(item.get("unit"))
    remarks = _safe_str(item.get("remarks"))

    lines = [
        "Generate a field execution checklist and cautions grounded in legal/standard evidence.",
        "",
        f"- Category: {main_category}" if main_category else None,
        f"- Process: {process}" if process else None,
        f"- Work Type: {work_type}" if work_type else None,
        f"- Quantity: {quantity} {unit}".strip() if quantity else None,
        f"- Remarks: {remarks}" if remarks else None,
    ]
    return "\n".join([line for line in lines if line])


def _hash_payload(payload: Any) -> str:
    serialized = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _build_cache_meta(*, hit: bool, scope: str, ttl_s: int) -> dict[str, Any]:
    return {
        "hit": bool(hit),
        "scope": scope,
        "ttl_s": int(ttl_s),
    }


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def kg_search(request):
    payload = request.data or {}
    query = _safe_str(payload.get("query"))
    if not query:
        return Response({"detail": "query is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        limit = _parse_int(payload.get("limit"), field="limit", default=8, min_value=1, max_value=30)
        mode = _parse_mode(payload.get("mode"))
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    try:
        result = search_kg(query, limit=limit, mode=mode)
        return Response({"query": query, **result}, status=status.HTTP_200_OK)
    except Exception:
        logger.exception("kg_search failed")
        return Response({"detail": "KG service is temporarily unavailable"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def kg_answer(request):
    payload = request.data or {}
    query = _safe_str(payload.get("query"))
    if not query:
        return Response({"detail": "query is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        limit = _parse_int(payload.get("limit"), field="limit", default=8, min_value=1, max_value=20)
        mode = _parse_mode(payload.get("mode"))
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    try:
        result = search_kg(query, limit=limit, mode=mode)
        answer, answer_cache_hit = generate_grounded_answer_cached(
            query,
            result.get("standards") or [],
            result.get("laws") or [],
        )
        if _is_ai_error_text(answer):
            logger.warning("kg_answer unavailable: query=%s", query[:120])
            return Response(
                {"detail": "KG answer generation is temporarily unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        cache_meta = {
            "query": result.get("cache") or {},
            "answer": _build_cache_meta(
                hit=answer_cache_hit,
                scope="answer",
                ttl_s=int(os.getenv("KG_ANSWER_CACHE_TTL_S") or "300"),
            ),
        }
        return Response({"query": query, **result, "answer": answer, "cache": cache_meta}, status=status.HTTP_200_OK)
    except Exception:
        logger.exception("kg_answer failed")
        return Response({"detail": "KG service is temporarily unavailable"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def kg_card(request):
    payload = request.data or {}
    query = _safe_str(payload.get("query"))
    if not query:
        return Response({"detail": "query is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        limit = _parse_int(payload.get("limit"), field="limit", default=8, min_value=1, max_value=20)
        mode = _parse_mode(payload.get("mode"))
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    try:
        result = search_kg(query, limit=limit, mode=mode)
        card, card_cache_hit = generate_execution_card_cached(
            query,
            result.get("standards") or [],
            result.get("laws") or [],
        )
        if _is_ai_error_payload(card):
            logger.warning("kg_card unavailable: query=%s", query[:120])
            return Response(
                {"detail": "KG card generation is temporarily unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        cache_meta = {
            "query": result.get("cache") or {},
            "card": _build_cache_meta(
                hit=card_cache_hit,
                scope="card",
                ttl_s=int(os.getenv("KG_CARD_CACHE_TTL_S") or "300"),
            ),
        }
        return Response({"query": query, **result, "card": card, "cache": cache_meta}, status=status.HTTP_200_OK)
    except Exception:
        logger.exception("kg_card failed")
        return Response({"detail": "KG service is temporarily unavailable"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

def _parse_enrich_payload(payload: dict[str, Any]) -> dict[str, Any]:
    items = payload.get("items") or []
    if not isinstance(items, list):
        raise ValueError("items must be a list")
    if len(items) > 1000:
        raise ValueError("items list is too large (max 1000)")

    mode = _parse_mode(payload.get("mode"))
    limit = _parse_int(payload.get("limit"), field="limit", default=6, min_value=1, max_value=20)
    max_items = _parse_int(payload.get("max_items"), field="max_items", default=10, min_value=1, max_value=50)

    return {
        "items": items,
        "mode": mode,
        "limit": limit,
        "max_items": max_items,
        "overwrite": _parse_bool(payload.get("overwrite"), default=False),
        "include_answer": _parse_bool(payload.get("include_answer"), default=False),
        "include_card": _parse_bool(payload.get("include_card"), default=True),
    }


def _run_enrich_schedule_job(config: dict[str, Any]) -> dict[str, Any]:
    items = config["items"]
    mode = config["mode"]
    limit = config["limit"]
    max_items = config["max_items"]
    overwrite = bool(config["overwrite"])
    include_answer = bool(config["include_answer"])
    include_card = bool(config["include_card"])

    enriched: list[dict[str, Any]] = []
    processed = 0
    skipped_existing = 0
    errors: list[dict[str, Any]] = []
    query_cache_hits = 0
    answer_cache_hits = 0
    card_cache_hits = 0

    for item in items:
        if not isinstance(item, dict):
            enriched.append(item)
            continue

        existing_kg = item.get("kg")
        if existing_kg and not overwrite:
            skipped_existing += 1
            enriched.append(item)
            continue

        if processed >= max_items:
            enriched.append(item)
            continue

        try:
            retrieval_query = _build_schedule_retrieval_query(item)
            llm_query = _build_schedule_llm_query(item)

            result = search_kg(retrieval_query, limit=limit, mode=mode)
            used_mode = result.get("mode") or mode
            standards = result.get("standards") or []
            laws = result.get("laws") or []
            trust = result.get("trust") or {}

            query_cache = result.get("cache") or {}
            if bool(query_cache.get("hit")):
                query_cache_hits += 1

            answer = ""
            answer_cache_hit = False
            if include_answer:
                answer, answer_cache_hit = generate_grounded_answer_cached(llm_query, standards, laws)
                if _is_ai_error_text(answer):
                    raise RuntimeError("kg_answer_unavailable")
                if answer_cache_hit:
                    answer_cache_hits += 1

            card = None
            card_cache_hit = False
            if include_card:
                card, card_cache_hit = generate_execution_card_cached(llm_query, standards, laws)
                if _is_ai_error_payload(card):
                    raise RuntimeError("kg_card_unavailable")
                if card_cache_hit:
                    card_cache_hits += 1

            kg_obj = {
                "query": llm_query,
                "retrievalQuery": retrieval_query,
                "requestedMode": mode,
                "usedMode": used_mode,
                "limit": limit,
                "answer": answer,
                "card": card,
                "trust": trust,
                "standards": standards,
                "laws": laws,
                "cache": {
                    "query": query_cache,
                    "answer": _build_cache_meta(
                        hit=answer_cache_hit,
                        scope="answer",
                        ttl_s=int(os.getenv("KG_ANSWER_CACHE_TTL_S") or "300"),
                    ),
                    "card": _build_cache_meta(
                        hit=card_cache_hit,
                        scope="card",
                        ttl_s=int(os.getenv("KG_CARD_CACHE_TTL_S") or "300"),
                    ),
                },
                "generatedAt": _utc_now_iso(),
                "version": 2,
                "source": "batch",
            }

            new_item = dict(item)
            new_item["kg"] = kg_obj
            enriched.append(new_item)
            processed += 1
        except Exception as exc:
            logger.exception("kg_enrich_schedule item failed: id=%s", item.get("id"))
            errors.append(
                {
                    "id": item.get("id"),
                    "error": "processing_failed",
                    "reason": _safe_str(exc)[:120] or "unknown",
                }
            )
            enriched.append(item)

    return {
        "items": enriched,
        "stats": {
            "processed": processed,
            "max_items": max_items,
            "skipped_existing": skipped_existing,
            "errors": errors,
            "cache_hits": {
                "query": query_cache_hits,
                "answer": answer_cache_hits,
                "card": card_cache_hits,
            },
        },
    }


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def kg_enrich_schedule(request):
    """
    Stateless batch enrichment for schedule items (no SQL DB required).

    Supports sync and async modes.

    Input JSON:
      - items: array of schedule item dicts
      - mode: hybrid|fulltext|vector (default: hybrid)
      - limit: int (default: 6, max: 20)
      - max_items: int (default: 10, max: 50)
      - overwrite: bool (default: false) - if false, keeps existing item.kg as-is
      - include_answer: bool (default: false)
      - include_card: bool (default: true)
      - async: bool (default: false) - when true, returns job_id with 202
    """
    payload = request.data or {}

    try:
        config = _parse_enrich_payload(payload)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    is_async = _parse_bool(payload.get("async"), default=False)
    if is_async:
        job = submit_job(_run_enrich_schedule_job, config)
        return Response(
            {
                **job,
                "status_url": f"/api/cpe/kg/enrich-schedule/jobs/{job['job_id']}/",
            },
            status=status.HTTP_202_ACCEPTED,
        )

    try:
        result = _run_enrich_schedule_job(config)
        return Response(result, status=status.HTTP_200_OK)
    except Exception:
        logger.exception("kg_enrich_schedule failed")
        return Response({"detail": "KG service is temporarily unavailable"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def kg_enrich_schedule_job(request, job_id: str):
    include_result = _parse_bool(request.query_params.get("include_result"), default=True)
    job = get_job(job_id, include_result=include_result)
    if not job:
        return Response({"detail": "job not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response(job, status=status.HTTP_200_OK)


def _truncate(text: str, limit: int) -> str:
    s = _safe_str(text)
    if len(s) <= limit:
        return s
    return s[: max(0, limit - 20)] + " ...[truncated]"


def _format_item_title(item: dict[str, Any]) -> str:
    main_category = _safe_str(item.get("main_category"))
    process = _safe_str(item.get("process"))
    work_type = _safe_str(item.get("work_type"))

    parts = [part for part in [main_category, process, work_type] if part]
    return " / ".join(parts) if parts else _safe_str(item.get("id") or "item")


def _evidence_from_kg(kg_obj: dict[str, Any], *, max_per_kind: int, excerpt_limit: int) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []

    for item in (kg_obj.get("laws") or [])[:max_per_kind]:
        if not isinstance(item, dict):
            continue
        key = _safe_str(item.get("key"))
        if not key:
            continue
        law_name = _safe_str(item.get("law_name"))
        name = _safe_str(item.get("name"))
        article = item.get("article_number")
        article_str = f" Article {article}" if article is not None else ""
        title = " ".join([part for part in [law_name, name] if part]).strip() + article_str
        entries.append(
            {
                "kind": "law",
                "key": f"L:{key}",
                "title": title.strip(),
                "retrieval": _safe_str(item.get("retrieval") or ""),
                "score": item.get("score"),
                "evidence_score": item.get("evidence_score"),
                "excerpt": _truncate(item.get("excerpt") or "", excerpt_limit),
            }
        )

    for item in (kg_obj.get("standards") or [])[:max_per_kind]:
        if not isinstance(item, dict):
            continue
        key = _safe_str(item.get("key"))
        if not key:
            continue
        title = _safe_str(item.get("path") or item.get("title") or "")
        doc_no = _safe_str(item.get("doc_no") or "")
        meta = f" ({doc_no})" if doc_no else ""
        entries.append(
            {
                "kind": "standard",
                "key": f"S:{key}",
                "title": (title + meta).strip(),
                "retrieval": _safe_str(item.get("retrieval") or ""),
                "score": item.get("score"),
                "evidence_score": item.get("evidence_score"),
                "excerpt": _truncate(item.get("excerpt") or "", excerpt_limit),
            }
        )

    return entries

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def kg_evidence_pack(request):
    """
    Build an evidence pack (Markdown + structured JSON) from schedule items that already have `kg` attached.

    This is stateless and does NOT require SQL DB access.

    Input JSON:
      - items: array of schedule item dicts (each may have .kg)
      - max_evidence_per_kind: int (default: 8, max: 20)  # per item, per kind (laws/standards)
      - excerpt_limit: int (default: 600, max: 2000)

    Output JSON:
      - markdown: string
      - items: array of {id,title,kg_summary,evidence[]}
      - evidence_index: array of {key,kind,title,used_in[]}
    """
    payload = request.data or {}
    items = payload.get("items") or []
    if not isinstance(items, list):
        return Response({"detail": "items must be a list"}, status=status.HTTP_400_BAD_REQUEST)
    if len(items) > 1000:
        return Response({"detail": "items list is too large (max 1000)"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        max_per_kind = _parse_int(
            payload.get("max_evidence_per_kind"),
            field="max_evidence_per_kind",
            default=8,
            min_value=1,
            max_value=20,
        )
        excerpt_limit = _parse_int(
            payload.get("excerpt_limit"),
            field="excerpt_limit",
            default=600,
            min_value=50,
            max_value=2000,
        )
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    cache_key = _hash_payload(
        {
            "items": items,
            "max_per_kind": max_per_kind,
            "excerpt_limit": excerpt_limit,
        }
    )
    cache_hit, cached = _EVIDENCE_PACK_CACHE.get(cache_key)
    if cache_hit and isinstance(cached, dict):
        cached["cache"] = _build_cache_meta(hit=True, scope="evidence", ttl_s=_EVIDENCE_PACK_CACHE_TTL_S)
        return Response(cached, status=status.HTTP_200_OK)

    out_items: list[dict[str, Any]] = []
    index_map: dict[str, dict[str, Any]] = {}

    md_lines: list[str] = []
    md_lines.append("# Evidence Pack (KG)")
    md_lines.append(f"- generatedAt: {_utc_now_iso()}")

    for item in items:
        if not isinstance(item, dict):
            continue

        item_id = _safe_str(item.get("id") or "")
        title = _format_item_title(item)
        kg_obj = item.get("kg") if isinstance(item.get("kg"), dict) else {}

        answer = _safe_str(kg_obj.get("answer") or "")
        card = kg_obj.get("card") if isinstance(kg_obj.get("card"), dict) else {}
        one_liner = _safe_str(card.get("one_liner") or "")
        kg_summary = answer or one_liner

        evidence = _evidence_from_kg(kg_obj, max_per_kind=max_per_kind, excerpt_limit=excerpt_limit)

        out_items.append(
            {
                "id": item_id,
                "title": title,
                "kg_summary": kg_summary,
                "evidence": evidence,
            }
        )

        md_lines.append("")
        md_lines.append(f"## {title}" + (f" ({item_id})" if item_id else ""))
        if kg_summary:
            md_lines.append(f"- KG summary: {kg_summary}")
        else:
            md_lines.append("- KG summary: (none)")

        if not evidence:
            md_lines.append("- Evidence: (none)")
            continue

        md_lines.append("- Evidence:")
        for ev in evidence:
            ev_key = _safe_str(ev.get("key"))
            ev_title = _safe_str(ev.get("title"))
            ev_kind = _safe_str(ev.get("kind"))

            used = index_map.get(ev_key)
            if not used:
                index_map[ev_key] = {
                    "key": ev_key,
                    "kind": ev_kind,
                    "title": ev_title,
                    "used_in": [item_id] if item_id else [],
                }
            else:
                if item_id and item_id not in used.get("used_in", []):
                    used["used_in"].append(item_id)

            md_lines.append(f"  - {ev_key} {ev_title}".strip())
            excerpt = _safe_str(ev.get("excerpt") or "")
            if excerpt:
                md_lines.append(f"    - excerpt: {excerpt}")

    md_lines.append("")
    md_lines.append("## Evidence Index")
    if not index_map:
        md_lines.append("- (none)")
    else:
        for key in sorted(index_map.keys()):
            entry = index_map[key]
            used_in = entry.get("used_in") or []
            used_str = ", ".join([_safe_str(x) for x in used_in if x])
            suffix = f" | used_in: {used_str}" if used_str else ""
            md_lines.append(f"- {entry.get('key')} {entry.get('title')}{suffix}".strip())

    evidence_index = list(index_map.values())
    evidence_index.sort(key=lambda item: _safe_str(item.get("key")))

    response_payload = {
        "markdown": "\n".join(md_lines),
        "items": out_items,
        "evidence_index": evidence_index,
        "cache": _build_cache_meta(hit=False, scope="evidence", ttl_s=_EVIDENCE_PACK_CACHE_TTL_S),
    }
    _EVIDENCE_PACK_CACHE.set(cache_key, response_payload)
    return Response(response_payload, status=status.HTTP_200_OK)


def _parse_duration_tasks(payload: dict[str, Any]) -> list[dict[str, Any]]:
    raw_tasks = payload.get("tasks") or []
    if not isinstance(raw_tasks, list):
        raise ValueError("tasks must be a list")
    if len(raw_tasks) > 300:
        raise ValueError("tasks is too large (max 300)")

    tasks: list[dict[str, Any]] = []
    for raw in raw_tasks:
        if not isinstance(raw, dict):
            continue
        name = _safe_str(raw.get("name") or raw.get("task") or raw.get("process"))
        duration = _safe_float(
            raw.get("duration_days") if raw.get("duration_days") is not None else raw.get("duration"),
            0.0,
        )
        crew = _safe_float(raw.get("crew_count") if raw.get("crew_count") is not None else raw.get("crew"), 0.0)
        productivity = _safe_float(raw.get("productivity"), 0.0)
        critical = _parse_bool(
            raw.get("critical") if raw.get("critical") is not None else raw.get("is_critical"),
            default=False,
        )
        parallelizable = _parse_bool(
            raw.get("parallelizable") if raw.get("parallelizable") is not None else raw.get("can_parallelize"),
            default=False,
        )
        if duration <= 0:
            continue
        tasks.append(
            {
                "name": name or "task",
                "duration_days": duration,
                "crew_count": crew,
                "productivity": productivity,
                "critical": critical,
                "parallelizable": parallelizable,
            }
        )
    return tasks


def _estimate_days(current_days: int, gain_ratio: float) -> int:
    gain = max(0.0, min(0.45, gain_ratio))
    return max(1, int(round(current_days * (1 - gain))))


def _build_bottlenecks(tasks: list[dict[str, Any]], *, top_n: int = 5) -> list[dict[str, Any]]:
    ranked = sorted(tasks, key=lambda item: float(item.get("duration_days") or 0.0), reverse=True)
    out: list[dict[str, Any]] = []
    for task in ranked[:top_n]:
        out.append(
            {
                "name": task["name"],
                "duration_days": round(float(task.get("duration_days") or 0.0), 2),
                "critical": bool(task.get("critical")),
                "parallelizable": bool(task.get("parallelizable")),
            }
        )
    return out


def _reference_link(kind: str, item: dict[str, Any]) -> str:
    if kind == "law":
        law_name = _safe_str(item.get("law_name")) or _safe_str(item.get("name"))
        article = item.get("article_number")
        query = f"{law_name} {article}" if article is not None else law_name
        return f"https://www.law.go.kr/lsSc.do?query={quote_plus(query)}" if query else ""

    source = _safe_str(item.get("source"))
    if source.startswith("http://") or source.startswith("https://"):
        return source

    keyword = _safe_str(item.get("doc_no")) or _safe_str(item.get("path")) or _safe_str(item.get("title"))
    if not keyword:
        return ""
    return f"https://www.google.com/search?q={quote_plus(keyword)}"


def _build_evidence_links(kg_result: dict[str, Any], *, max_items: int = 6) -> list[dict[str, Any]]:
    links: list[dict[str, Any]] = []

    for item in (kg_result.get("laws") or [])[:max_items]:
        if not isinstance(item, dict):
            continue
        key = _safe_str(item.get("key"))
        if not key:
            continue
        title = " ".join(
            [part for part in [_safe_str(item.get("law_name")), _safe_str(item.get("name"))] if part]
        ).strip()
        links.append(
            {
                "ref": f"L:{key}",
                "kind": "law",
                "title": title,
                "score": item.get("evidence_score") if item.get("evidence_score") is not None else item.get("score"),
                "link": _reference_link("law", item),
            }
        )

    for item in (kg_result.get("standards") or [])[:max_items]:
        if not isinstance(item, dict):
            continue
        key = _safe_str(item.get("key"))
        if not key:
            continue
        title = _safe_str(item.get("path") or item.get("title"))
        links.append(
            {
                "ref": f"S:{key}",
                "kind": "standard",
                "title": title,
                "score": item.get("evidence_score") if item.get("evidence_score") is not None else item.get("score"),
                "link": _reference_link("standard", item),
            }
        )

    links.sort(key=lambda entry: _safe_float(entry.get("score"), 0.0), reverse=True)
    return links[: max(1, min(max_items, len(links)))]

def _scenario_plan(
    *,
    current_days: int,
    target_days: int,
    tasks: list[dict[str, Any]],
    evidence_refs: list[str],
) -> list[dict[str, Any]]:
    gap = max(0, current_days - target_days)
    gap_ratio = (gap / current_days) if current_days > 0 else 0.0

    critical_tasks = [task for task in tasks if task.get("critical")]
    critical_days = sum(float(task.get("duration_days") or 0.0) for task in critical_tasks)
    if critical_days <= 0:
        critical_days = sum(float(task.get("duration_days") or 0.0) for task in tasks)

    parallelizable_days = sum(
        float(task.get("duration_days") or 0.0) for task in critical_tasks if task.get("parallelizable")
    )
    parallel_ratio = (parallelizable_days / critical_days) if critical_days > 0 else 0.0

    manpower_gain = min(0.22, 0.06 + gap_ratio * 0.40)
    productivity_gain = min(0.28, 0.08 + gap_ratio * 0.50)
    parallel_gain = min(0.30, 0.05 + parallel_ratio * 0.35 + gap_ratio * 0.20)

    scenarios = [
        {
            "id": "manpower_boost",
            "type": "manpower",
            "title": "Critical-path manpower boost",
            "expected_days": _estimate_days(current_days, manpower_gain),
            "actions": [
                "Increase crew on critical tasks by 10-20% in two-week sprints.",
                "Deploy swing crew only to tasks with blocking dependencies.",
                "Add daily constraint review for labor/equipment handoff.",
            ],
            "assumptions": {
                "crew_increase_pct": round(manpower_gain * 100, 1),
                "critical_path_focus": True,
            },
            "evidence_refs": evidence_refs[:3],
        },
        {
            "id": "productivity_uplift",
            "type": "productivity",
            "title": "Productivity uplift via method optimization",
            "expected_days": _estimate_days(current_days, productivity_gain),
            "actions": [
                "Standardize repetitive work packages with pre-check templates.",
                "Use short-cycle quality gates to reduce rework loops.",
                "Shift high-variance work to experienced crews first.",
            ],
            "assumptions": {
                "productivity_uplift_pct": round(productivity_gain * 100, 1),
                "rework_reduction_target_pct": round((productivity_gain * 0.6) * 100, 1),
            },
            "evidence_refs": evidence_refs[:3],
        },
        {
            "id": "parallelization_plan",
            "type": "parallelization",
            "title": "Parallelize non-blocking work fronts",
            "expected_days": _estimate_days(current_days, parallel_gain),
            "actions": [
                "Split work fronts and parallelize tasks with low interface risk.",
                "Introduce shared buffer windows for cross-trade conflicts.",
                "Pin weekly integration review for merged handoff milestones.",
            ],
            "assumptions": {
                "parallelizable_ratio_pct": round(parallel_ratio * 100, 1),
                "parallel_gain_pct": round(parallel_gain * 100, 1),
            },
            "evidence_refs": evidence_refs[:4],
        },
    ]

    for scenario in scenarios:
        expected_days = int(scenario["expected_days"])
        scenario["delta_days"] = expected_days - current_days
        scenario["meets_target"] = expected_days <= target_days
        scenario["target_gap_days"] = expected_days - target_days

    return scenarios


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def kg_duration_agent(request):
    """
    Duration adequacy review agent for 2026 operations.

    Generates alternative scenarios against target duration:
      - manpower
      - productivity
      - parallelization

    Output includes grounding links + trust/conflict layer from GraphRAG.
    """
    payload = request.data or {}

    try:
        mode = _parse_mode(payload.get("mode"))
        limit = _parse_int(payload.get("limit"), field="limit", default=6, min_value=2, max_value=12)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    try:
        current_days = _parse_int(
            payload.get("current_duration_days") if payload.get("current_duration_days") is not None else payload.get("current_days"),
            field="current_duration_days",
            default=0,
            min_value=1,
            max_value=3650,
        )
        target_days = _parse_int(
            payload.get("target_duration_days") if payload.get("target_duration_days") is not None else payload.get("target_days"),
            field="target_duration_days",
            default=0,
            min_value=1,
            max_value=3650,
        )
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    try:
        tasks = _parse_duration_tasks(payload)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    project_name = _safe_str(payload.get("project_name") or payload.get("project") or "")
    top_tasks = _build_bottlenecks(tasks)
    bottleneck_tokens = [task["name"] for task in top_tasks if _safe_str(task.get("name"))]
    if not bottleneck_tokens:
        bottleneck_tokens = ["critical path", "construction schedule"]

    evidence_query = " ".join(bottleneck_tokens[:4]) + " manpower productivity parallelization safety standard"
    cache_key = _hash_payload(
        {
            "project_name": project_name,
            "current_days": current_days,
            "target_days": target_days,
            "tasks": tasks,
            "query": evidence_query,
            "mode": mode,
            "limit": limit,
        }
    )
    cache_hit, cached = _DURATION_AGENT_CACHE.get(cache_key)
    if cache_hit and isinstance(cached, dict):
        cached["cache"] = {
            "agent": _build_cache_meta(hit=True, scope="duration-agent", ttl_s=_DURATION_AGENT_CACHE_TTL_S),
            "query": cached.get("evidence", {}).get("cache") or {},
        }
        return Response(cached, status=status.HTTP_200_OK)

    try:
        kg_result = search_kg(evidence_query, mode=mode, limit=limit)
    except Exception:
        logger.exception("kg_duration_agent search failed")
        return Response({"detail": "KG service is temporarily unavailable"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    evidence_links = _build_evidence_links(kg_result, max_items=6)
    evidence_refs = [_safe_str(item.get("ref")) for item in evidence_links if _safe_str(item.get("ref"))]

    scenarios = _scenario_plan(
        current_days=current_days,
        target_days=target_days,
        tasks=tasks,
        evidence_refs=evidence_refs,
    )

    primary_id = ""
    if scenarios:
        primary_id = min(scenarios, key=lambda item: abs(int(item.get("target_gap_days") or 0))).get("id") or ""

    response_payload = {
        "agent": {
            "name": "duration_adequacy_agent",
            "version": "2026.1",
            "generated_at": _utc_now_iso(),
        },
        "project_name": project_name,
        "baseline": {
            "current_duration_days": current_days,
            "target_duration_days": target_days,
            "gap_days": current_days - target_days,
        },
        "bottlenecks": top_tasks,
        "scenarios": scenarios,
        "evidence": {
            "query": evidence_query,
            "mode": kg_result.get("mode") or mode,
            "trust": kg_result.get("trust") or {},
            "links": evidence_links,
            "cache": kg_result.get("cache") or {},
        },
        "recommendation": {
            "primary_scenario_id": primary_id,
            "notes": [
                "Use scenario as planning baseline, then validate resource feasibility by week.",
                "Review conflict flags in trust layer before final approval.",
            ],
        },
        "cache": {
            "agent": _build_cache_meta(hit=False, scope="duration-agent", ttl_s=_DURATION_AGENT_CACHE_TTL_S),
            "query": kg_result.get("cache") or {},
        },
    }

    _DURATION_AGENT_CACHE.set(cache_key, response_payload)
    return Response(response_payload, status=status.HTTP_200_OK)
