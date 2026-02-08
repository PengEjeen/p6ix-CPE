from __future__ import annotations

import json
import os
import re
import hashlib
from pathlib import Path
from typing import Any

import yaml

from cpe_module.utils.openai_llm import chat_completion, chat_completion_messages
from cpe_module.utils.kg_cache import TTLCache


_ANSWER_CACHE_TTL_S = max(30, int(os.getenv("KG_ANSWER_CACHE_TTL_S") or "300"))
_ANSWER_CACHE_MAX_SIZE = max(50, int(os.getenv("KG_ANSWER_CACHE_MAX_SIZE") or "500"))
_ANSWER_CACHE = TTLCache(max_size=_ANSWER_CACHE_MAX_SIZE, ttl_s=_ANSWER_CACHE_TTL_S)

_CARD_CACHE_TTL_S = max(30, int(os.getenv("KG_CARD_CACHE_TTL_S") or "300"))
_CARD_CACHE_MAX_SIZE = max(50, int(os.getenv("KG_CARD_CACHE_MAX_SIZE") or "500"))
_CARD_CACHE = TTLCache(max_size=_CARD_CACHE_MAX_SIZE, ttl_s=_CARD_CACHE_TTL_S)


def _escape_braces(text: str) -> str:
    # Protect `str.format()` from evidence that may contain braces.
    return (text or "").replace("{", "{{").replace("}", "}}")


def _format_standard_evidence(items: list[dict[str, Any]], max_items: int = 8) -> str:
    lines: list[str] = []
    for item in (items or [])[:max_items]:
        key = item.get("key") or ""
        path = item.get("path") or item.get("title") or ""
        doc_no = item.get("doc_no") or ""
        full_code = item.get("full_code") or ""
        retrieval = item.get("retrieval") or "fulltext"
        excerpt = item.get("excerpt") or ""
        lines.append(f"- (S:{key}) {path} | {doc_no} {full_code} | {retrieval}".strip())
        if excerpt:
            lines.append(f"  {_escape_braces(str(excerpt))}")
    return "\n".join(lines) if lines else "(no evidence found)"


def _format_law_evidence(items: list[dict[str, Any]], max_items: int = 8) -> str:
    lines: list[str] = []
    for item in (items or [])[:max_items]:
        key = item.get("key") or ""
        law_name = item.get("law_name") or ""
        name = item.get("name") or ""
        article = item.get("article_number")
        paragraph = item.get("paragraph_number")
        item_no = item.get("item_number")
        retrieval = item.get("retrieval") or "fulltext"
        excerpt = item.get("excerpt") or ""

        nums: list[str] = []
        if article is not None:
            nums.append(f"Article {article}")
        if paragraph is not None:
            nums.append(f"Paragraph {paragraph}")
        if item_no is not None:
            nums.append(f"Item {item_no}")
        num_str = (" (" + ", ".join(nums) + ")") if nums else ""

        title = " ".join([p for p in [law_name, name] if p]).strip()
        lines.append(f"- (L:{key}) {title}{num_str} | {retrieval}".strip())
        if excerpt:
            lines.append(f"  {_escape_braces(str(excerpt))}")
    return "\n".join(lines) if lines else "(no evidence found)"


def _load_prompt_template() -> str:
    template_path = Path(__file__).resolve().parent / "templates" / "kg_qa_prompt.yaml"
    with open(template_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
    return str(config["prompt"])


def _load_execution_card_template() -> str:
    template_path = Path(__file__).resolve().parent / "templates" / "kg_execution_card_prompt.yaml"
    with open(template_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
    return str(config["prompt"])


def _cache_key(prefix: str, payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"{prefix}:{digest}"


def _extract_json_object(text: str) -> dict[str, Any] | None:
    if not text:
        return None

    cleaned = str(text).strip()
    cleaned = re.sub(r"^```(?:json)?\\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\\s*```\\s*$", "", cleaned)

    try:
        obj = json.loads(cleaned)
        return obj if isinstance(obj, dict) else None
    except Exception:
        pass

    match = re.search(r"\\{.*\\}", cleaned, flags=re.DOTALL)
    if not match:
        return None

    try:
        obj = json.loads(match.group(0))
        return obj if isinstance(obj, dict) else None
    except Exception:
        return None


def generate_execution_card(query: str, standards: list[dict[str, Any]], laws: list[dict[str, Any]]) -> dict[str, Any]:
    if not os.getenv("OPENAI_API_KEY"):
        return {"detail": "OPENAI_API_KEY is not set"}

    base_prompt = _load_execution_card_template()
    # Avoid str.format() here because the prompt contains JSON braces.
    prompt_filled = base_prompt
    prompt_filled = prompt_filled.replace("{query}", _escape_braces(query))
    prompt_filled = prompt_filled.replace("{standard_evidence}", _format_standard_evidence(standards))
    prompt_filled = prompt_filled.replace("{law_evidence}", _format_law_evidence(laws))

    try:
        model = (
            os.getenv("OPENAI_KG_CARD_MODEL")
            or os.getenv("OPENAI_KG_MODEL")
            or os.getenv("OPENAI_CHAT_MODEL")
            or None
        )
        max_tokens = int(os.getenv("OPENAI_KG_CARD_MAX_TOKENS") or os.getenv("OPENAI_KG_MAX_TOKENS") or "900")
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": "You write grounded construction checklists. Output STRICT JSON only."},
            {"role": "user", "content": prompt_filled},
        ]
        raw = chat_completion_messages(
            messages,
            model=model,
            temperature=0.2,
            max_tokens=max_tokens,
            timeout_s=45,
            response_format={"type": "json_object"},
        )
        obj = _extract_json_object(raw)
        return obj if obj is not None else {"raw": raw}
    except Exception as e:
        return {"detail": str(e)}


def generate_grounded_answer(query: str, standards: list[dict[str, Any]], laws: list[dict[str, Any]]) -> str:
    if not os.getenv("OPENAI_API_KEY"):
        return "(AI is disabled: OPENAI_API_KEY is not set.)"

    base_prompt = _load_prompt_template()
    prompt_filled = base_prompt.format(
        query=_escape_braces(query),
        standard_evidence=_format_standard_evidence(standards),
        law_evidence=_format_law_evidence(laws),
    )

    try:
        model = os.getenv("OPENAI_KG_MODEL") or os.getenv("OPENAI_CHAT_MODEL") or None
        max_tokens = int(os.getenv("OPENAI_KG_MAX_TOKENS") or "900")
        text = chat_completion(prompt_filled, model=model, temperature=0.2, max_tokens=max_tokens)
        return text or "(AI error: empty response)"
    except Exception as e:
        return f"(AI error: {e})"


def generate_grounded_answer_cached(query: str, standards: list[dict[str, Any]], laws: list[dict[str, Any]]) -> tuple[str, bool]:
    key = _cache_key(
        "answer",
        {
            "query": query,
            "standards": standards,
            "laws": laws,
        },
    )
    hit, cached = _ANSWER_CACHE.get(key)
    if hit and isinstance(cached, str):
        return cached, True

    answer = generate_grounded_answer(query, standards, laws)
    answer_text = str(answer or "")
    if answer_text and "(ai error" not in answer_text.lower() and "temporarily unavailable" not in answer_text.lower():
        _ANSWER_CACHE.set(key, answer_text)
    return answer_text, False


def generate_execution_card_cached(
    query: str,
    standards: list[dict[str, Any]],
    laws: list[dict[str, Any]],
) -> tuple[dict[str, Any], bool]:
    key = _cache_key(
        "card",
        {
            "query": query,
            "standards": standards,
            "laws": laws,
        },
    )
    hit, cached = _CARD_CACHE.get(key)
    if hit and isinstance(cached, dict):
        return cached, True

    card = generate_execution_card(query, standards, laws)
    if isinstance(card, dict) and card and "detail" not in card and "raw" not in card:
        _CARD_CACHE.set(key, card)
    return card if isinstance(card, dict) else {"raw": str(card)}, False
