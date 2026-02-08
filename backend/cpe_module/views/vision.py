from __future__ import annotations

import base64
import json
import logging
import os
from typing import Any

from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..utils.neo4j_kg import search_kg
from ..utils.openai_llm import chat_completion_messages

logger = logging.getLogger(__name__)
ALLOWED_VISION_MODES = {"hybrid", "fulltext", "vector"}


def _truncate_text(value: Any, limit: int = 2000) -> str:
    text = str(value or "")
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 20)] + " ...[truncated]"


def _format_evidence_short(standards: list[dict[str, Any]], laws: list[dict[str, Any]], max_items: int = 6) -> str:
    lines: list[str] = []
    for item in (laws or [])[:max_items]:
        key = str(item.get("key") or "").strip()
        law_name = str(item.get("law_name") or "").strip()
        name = str(item.get("name") or "").strip()
        article = item.get("article_number")
        article_str = f" Article {article}" if article is not None else ""
        if key:
            lines.append(f"- (L:{key}) {law_name} {name}{article_str}".strip())
        else:
            lines.append(f"- {law_name} {name}{article_str}".strip())

    for item in (standards or [])[:max_items]:
        key = str(item.get("key") or "").strip()
        title = str(item.get("path") or item.get("title") or "").strip()
        doc_no_raw = item.get("doc_no")
        doc_no = str(doc_no_raw).strip() if doc_no_raw is not None else ""
        if key:
            lines.append(f"- (S:{key}) {title} {doc_no}".strip())
        else:
            lines.append(f"- {title} {doc_no}".strip())

    return "\n".join(lines) if lines else "(no evidence found)"


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def safety_check(request):
    """
    Analyze site photos for safety/quality issues (multimodal).

    multipart/form-data:
      - images: file (repeatable, up to 3)
      - context: str (optional)
      - mode: hybrid|fulltext|vector (optional, for KG evidence)
    """
    context = (request.data.get("context") or "").strip()
    mode = (request.data.get("mode") or "hybrid").strip().lower() or "hybrid"
    if mode not in ALLOWED_VISION_MODES:
        return Response(
            {"detail": f"mode must be one of: {', '.join(sorted(ALLOWED_VISION_MODES))}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    max_context_chars = int(os.getenv("OPENAI_VISION_MAX_CONTEXT_CHARS") or "2000")
    if len(context) > max_context_chars:
        return Response(
            {"detail": f"context is too long (max {max_context_chars} chars)"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    images = request.FILES.getlist("images") or request.FILES.getlist("files") or []
    if not images:
        return Response({"detail": "images are required"}, status=status.HTTP_400_BAD_REQUEST)
    if len(images) > 3:
        images = images[:3]

    max_each = int(os.getenv("OPENAI_VISION_MAX_IMAGE_BYTES") or str(6 * 1024 * 1024))
    max_total = int(os.getenv("OPENAI_VISION_MAX_TOTAL_BYTES") or str(12 * 1024 * 1024))

    blobs: list[dict[str, str]] = []
    total = 0
    for f in images:
        data = f.read()
        total += len(data)
        if len(data) > max_each:
            return Response(
                {"detail": f"image too large (>{max_each} bytes): {getattr(f, 'name', 'image')}"},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )
        if total > max_total:
            return Response(
                {"detail": f"total images too large (>{max_total} bytes)"},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        mime = getattr(f, "content_type", None) or "image/jpeg"
        b64 = base64.b64encode(data).decode("ascii")
        blobs.append({"mime": mime, "b64": b64})

    # Optional KG grounding (best-effort).
    standards: list[dict[str, Any]] = []
    laws: list[dict[str, Any]] = []
    used_mode: str | None = None
    if context:
        try:
            kg_res = search_kg(f"{context} 안전 safety", limit=6, mode=mode)
            used_mode = kg_res.get("mode") or None
            standards = kg_res.get("standards") or []
            laws = kg_res.get("laws") or []
        except Exception:
            logger.exception("vision safety_check KG lookup failed")
            standards = []
            laws = []

    evidence_text = _format_evidence_short(standards, laws)
    instruction = (
        "You are a careful construction site safety & quality inspector.\n"
        "Analyze the provided photos. Identify hazards, quality issues, and compliance risks.\n"
        "Do not hallucinate: if unsure, say so and add it under uncertainty.\n"
        "When possible, ground findings using evidence_refs from the Evidence section.\n\n"
        f"[Context]\n{context or '(none)'}\n\n"
        f"[Evidence]\n{evidence_text}\n\n"
        "Return ONLY a JSON object with keys:\n"
        "- summary: string\n"
        "- findings: array of {area, issue, severity, confidence, evidence_refs}\n"
        "- risks: array of string\n"
        "- actions: array of string\n"
        "- uncertainty: array of string\n"
        "- evidence_refs: array of string (e.g., \"L:...\", \"S:...\")\n"
    )

    user_content: list[dict[str, Any]] = [{"type": "text", "text": instruction}]
    for blob in blobs:
        user_content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:{blob['mime']};base64,{blob['b64']}"},
            }
        )

    model = os.getenv("OPENAI_VISION_MODEL") or os.getenv("OPENAI_CHAT_MODEL") or "gpt-4o-mini"
    max_tokens = int(os.getenv("OPENAI_VISION_MAX_TOKENS") or "900")

    try:
        raw = chat_completion_messages(
            [
                {"role": "system", "content": "Output JSON only. Never fabricate details."},
                {"role": "user", "content": user_content},
            ],
            model=model,
            temperature=0.2,
            max_tokens=max_tokens,
            timeout_s=60,
            response_format={"type": "json_object"},
        )
    except Exception:
        logger.exception("vision safety_check LLM call failed")
        return Response({"detail": "Vision service is temporarily unavailable"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    try:
        analysis = json.loads(raw) if raw else {}
    except Exception:
        logger.warning("vision safety_check returned non-JSON output")
        analysis = {"raw": _truncate_text(raw)}

    return Response(
        {
            "context": context,
            "mode": used_mode or mode,
            "analysis": analysis,
            "standards": standards,
            "laws": laws,
        },
        status=status.HTTP_200_OK,
    )
