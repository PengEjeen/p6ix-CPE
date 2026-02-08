from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from neo4j import GraphDatabase

from .kg_cache import TTLCache


@dataclass(frozen=True)
class Neo4jConfig:
    uri: str
    username: str
    password: str
    database: str


_driver_lock = Lock()
_driver = None

_SEARCH_CACHE_TTL_S = max(30, int(os.getenv("KG_SEARCH_CACHE_TTL_S") or "300"))
_SEARCH_CACHE_MAX_SIZE = max(50, int(os.getenv("KG_SEARCH_CACHE_MAX_SIZE") or "500"))
_SEARCH_CACHE = TTLCache(max_size=_SEARCH_CACHE_MAX_SIZE, ttl_s=_SEARCH_CACHE_TTL_S)

_LUCENE_RESERVED_CHARS = re.compile(r'[+\-!(){}\[\]^"~*?:\\\\/]')
_TOKEN_RE = re.compile(r"[A-Za-z0-9가-힣]{2,}")
_NUMBER_UNIT_RE = re.compile(r"(?P<num>\d+(?:\.\d+)?)\s*(?P<unit>%|mm|cm|m|m2|m3|kg|t|day|days|일)", flags=re.IGNORECASE)

_MANDATORY_CUES = (
    "must",
    "shall",
    "required",
    "의무",
    "필수",
    "반드시",
    "이상",
    "at least",
    "minimum",
)
_PROHIBITIVE_CUES = (
    "must not",
    "prohibited",
    "forbidden",
    "금지",
    "불가",
    "허용되지",
)
_MIN_CUES = ("이상", "at least", "minimum", "min")
_MAX_CUES = ("이하", "at most", "maximum", "max")


def _lucene_sanitize(query: str) -> str:
    """
    Make user text safe for Neo4j fulltext (Lucene) query parsing.

    We replace Lucene-reserved characters with whitespace (instead of escaping them),
    so natural-language punctuation like "?" doesn't become a literal term and hurt recall.
    """
    cleaned = _LUCENE_RESERVED_CHARS.sub(" ", query or "")
    return " ".join(cleaned.split())


def _parse_kv_file(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key.strip()] = value.strip()
    return data


def _resolve_neo4j_config() -> Neo4jConfig:
    uri = os.getenv("NEO4J_URI")
    username = os.getenv("NEO4J_USERNAME")
    password = os.getenv("NEO4J_PASSWORD")
    database = os.getenv("NEO4J_DATABASE") or "neo4j"

    if uri and username and password:
        return Neo4jConfig(uri=uri, username=username, password=password, database=database)

    config_path = os.getenv("NEO4J_CONFIG_PATH")
    candidates: list[Path] = []
    if config_path:
        candidates.append(Path(config_path))

    # Local dev convenience: allow repo-root `neo4j.txt`.
    candidates.append(Path.cwd() / "neo4j.txt")
    try:
        # backend/cpe_module/utils/neo4j_kg.py -> repo root is 3 parents up
        candidates.append(Path(__file__).resolve().parents[3] / "neo4j.txt")
    except Exception:
        pass

    for candidate in candidates:
        if not candidate.exists():
            continue
        kv = _parse_kv_file(candidate)
        uri = kv.get("NEO4J_URI")
        username = kv.get("NEO4J_USERNAME")
        password = kv.get("NEO4J_PASSWORD")
        database = kv.get("NEO4J_DATABASE") or database
        if uri and username and password:
            return Neo4jConfig(uri=uri, username=username, password=password, database=database)

    raise RuntimeError(
        "Neo4j connection is not configured. Set NEO4J_URI/NEO4J_USERNAME/NEO4J_PASSWORD "
        "(and optionally NEO4J_DATABASE) in the environment, or provide neo4j.txt locally."
    )


def get_neo4j_driver():
    global _driver
    if _driver is not None:
        return _driver
    with _driver_lock:
        if _driver is not None:
            return _driver
        cfg = _resolve_neo4j_config()
        _driver = GraphDatabase.driver(
            cfg.uri,
            auth=(cfg.username, cfg.password),
            connection_timeout=10,
            max_connection_pool_size=int(os.getenv("NEO4J_POOL_SIZE") or "20"),
        )
        return _driver


def _openai_embed_query(text: str) -> list[float] | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    model = os.getenv("OPENAI_EMBED_MODEL") or "text-embedding-3-large"
    payload = {"model": model, "input": text}

    req = Request(
        "https://api.openai.com/v1/embeddings",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        embedding = body["data"][0]["embedding"]
        if not isinstance(embedding, list):
            return None
        return embedding
    except (HTTPError, URLError, TimeoutError, ValueError, KeyError):
        return None


def _fulltext_search_spec(session, query: str, limit: int, excerpt_chars: int) -> list[dict[str, Any]]:
    q = _lucene_sanitize(query)
    if not q:
        return []
    cypher = """
    CALL db.index.fulltext.queryNodes('spec_fulltext', $q) YIELD node, score
    RETURN
      node.key AS key,
      node.title AS title,
      node.path AS path,
      node.full_code AS full_code,
      node.standard_key AS standard_key,
      node.standard_code AS standard_code,
      node.doc_no AS doc_no,
      node.doc_type AS doc_type,
      node.source AS source,
      substring(coalesce(node.content, ''), 0, $excerpt_chars) AS excerpt,
      score AS score
    ORDER BY score DESC
    LIMIT $limit
    """
    return [r.data() for r in session.run(cypher, {"q": q, "limit": limit, "excerpt_chars": excerpt_chars})]


def _fulltext_search_legal(session, query: str, limit: int, excerpt_chars: int) -> list[dict[str, Any]]:
    q = _lucene_sanitize(query)
    if not q:
        return []
    cypher = """
    CALL db.index.fulltext.queryNodes('legal_fulltext', $q) YIELD node, score
    RETURN
      node.key AS key,
      node.law_name AS law_name,
      node.name AS name,
      node.status AS status,
      node.article_number AS article_number,
      node.paragraph_number AS paragraph_number,
      node.item_number AS item_number,
      substring(coalesce(node.text, ''), 0, $excerpt_chars) AS excerpt,
      score AS score
    ORDER BY score DESC
    LIMIT $limit
    """
    return [r.data() for r in session.run(cypher, {"q": q, "limit": limit, "excerpt_chars": excerpt_chars})]


def _vector_search_spec(session, embedding: list[float], limit: int, excerpt_chars: int) -> list[dict[str, Any]]:
    cypher = """
    CALL db.index.vector.queryNodes('spec_vector', $limit, $embedding) YIELD node, score
    RETURN
      node.key AS key,
      node.title AS title,
      node.path AS path,
      node.full_code AS full_code,
      node.standard_key AS standard_key,
      node.standard_code AS standard_code,
      node.doc_no AS doc_no,
      node.doc_type AS doc_type,
      node.source AS source,
      substring(coalesce(node.content, ''), 0, $excerpt_chars) AS excerpt,
      score AS score
    ORDER BY score DESC
    """
    return [r.data() for r in session.run(cypher, {"limit": limit, "embedding": embedding, "excerpt_chars": excerpt_chars})]


def _vector_search_legal(session, embedding: list[float], limit: int, excerpt_chars: int) -> list[dict[str, Any]]:
    cypher = """
    CALL db.index.vector.queryNodes('legal_vector', $limit, $embedding) YIELD node, score
    RETURN
      node.key AS key,
      node.law_name AS law_name,
      node.name AS name,
      node.status AS status,
      node.article_number AS article_number,
      node.paragraph_number AS paragraph_number,
      node.item_number AS item_number,
      substring(coalesce(node.text, ''), 0, $excerpt_chars) AS excerpt,
      score AS score
    ORDER BY score DESC
    """
    return [r.data() for r in session.run(cypher, {"limit": limit, "embedding": embedding, "excerpt_chars": excerpt_chars})]


def _merge_hybrid(fulltext: list[dict[str, Any]], vector: list[dict[str, Any]], limit: int, alpha: float) -> list[dict[str, Any]]:
    # Combine rankings with a normalized weighted sum.
    merged: dict[str, dict[str, Any]] = {}

    ft_max = max((float(r.get("score") or 0) for r in fulltext), default=0.0) or 1.0
    vec_max = max((float(r.get("score") or 0) for r in vector), default=0.0) or 1.0

    for row in fulltext:
        key = str(row.get("key") or "")
        if not key:
            continue
        ft_norm = float(row.get("score") or 0) / ft_max
        merged[key] = {
            **row,
            "retrieval": "fulltext",
            "fulltext_score": ft_norm,
            "vector_score": 0.0,
            "score": (1 - alpha) * ft_norm,
        }

    for row in vector:
        key = str(row.get("key") or "")
        if not key:
            continue
        vec_norm = float(row.get("score") or 0) / vec_max
        if key in merged:
            merged[key]["retrieval"] = "hybrid"
            merged[key]["vector_score"] = vec_norm
            merged[key]["score"] = float(merged[key]["score"] or 0) + alpha * vec_norm
        else:
            merged[key] = {
                **row,
                "retrieval": "vector",
                "fulltext_score": 0.0,
                "vector_score": vec_norm,
                "score": alpha * vec_norm,
            }

    results = list(merged.values())
    results.sort(key=lambda item: float(item.get("score") or 0), reverse=True)
    return results[:limit]


def _attach_evidence_scores(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    max_score = max((float(item.get("score") or 0) for item in items), default=0.0) or 1.0
    out: list[dict[str, Any]] = []
    for item in items:
        copied = dict(item)
        score = max(0.0, float(copied.get("score") or 0.0))
        copied["evidence_score"] = round(min(1.0, score / max_score), 4)
        out.append(copied)
    return out


def _safe_text(value: Any) -> str:
    return str(value or "").strip()


def _extract_text_blob(evidence: dict[str, Any]) -> str:
    parts = [
        _safe_text(evidence.get("excerpt")),
        _safe_text(evidence.get("title")),
        _safe_text(evidence.get("path")),
        _safe_text(evidence.get("law_name")),
        _safe_text(evidence.get("name")),
        _safe_text(evidence.get("doc_no")),
    ]
    return " ".join([p for p in parts if p]).lower()


def _source_label(evidence: dict[str, Any], *, kind: str) -> str:
    if kind == "law":
        name = _safe_text(evidence.get("law_name"))
        article = evidence.get("article_number")
        article_part = f":{article}" if article is not None else ""
        return name + article_part if name else _safe_text(evidence.get("key"))

    doc_no = _safe_text(evidence.get("doc_no"))
    if doc_no:
        return doc_no
    path = _safe_text(evidence.get("path"))
    if path:
        return path
    return _safe_text(evidence.get("key"))


def _detect_polarity(text_blob: str) -> int:
    mandatory = any(token in text_blob for token in _MANDATORY_CUES)
    prohibitive = any(token in text_blob for token in _PROHIBITIVE_CUES)
    if mandatory and not prohibitive:
        return 1
    if prohibitive and not mandatory:
        return -1
    return 0


def _extract_thresholds(text_blob: str) -> list[dict[str, Any]]:
    values: list[dict[str, Any]] = []
    lower = text_blob.lower()
    for match in _NUMBER_UNIT_RE.finditer(lower):
        try:
            num = float(match.group("num"))
        except (TypeError, ValueError):
            continue
        unit = match.group("unit").lower()
        window = lower[max(0, match.start() - 20): min(len(lower), match.end() + 20)]
        threshold_type = "exact"
        if any(token in window for token in _MIN_CUES):
            threshold_type = "min"
        elif any(token in window for token in _MAX_CUES):
            threshold_type = "max"
        values.append({"value": num, "unit": unit, "type": threshold_type})
    return values


def _make_conflict_entries(evidence_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    conflicts: list[dict[str, Any]] = []

    positives = [row for row in evidence_rows if int(row.get("polarity") or 0) > 0]
    negatives = [row for row in evidence_rows if int(row.get("polarity") or 0) < 0]
    if positives and negatives:
        conflicts.append(
            {
                "type": "directive_conflict",
                "reason": "Mixed mandatory vs prohibited directives detected in retrieved evidence.",
                "evidence_refs": sorted({*(row["ref"] for row in positives[:2]), *(row["ref"] for row in negatives[:2])}),
            }
        )

    thresholds_by_unit: dict[str, list[dict[str, Any]]] = {}
    for row in evidence_rows:
        for threshold in row.get("thresholds") or []:
            unit = _safe_text(threshold.get("unit")).lower()
            if not unit:
                continue
            thresholds_by_unit.setdefault(unit, []).append({**threshold, "ref": row["ref"]})

    for unit, values in thresholds_by_unit.items():
        mins = [v for v in values if v.get("type") == "min"]
        maxs = [v for v in values if v.get("type") == "max"]
        if not mins or not maxs:
            continue
        max_min = max(mins, key=lambda item: float(item.get("value") or 0))
        min_max = min(maxs, key=lambda item: float(item.get("value") or 0))
        if float(max_min.get("value") or 0) > float(min_max.get("value") or 0):
            conflicts.append(
                {
                    "type": "threshold_conflict",
                    "reason": (
                        f"Detected inconsistent min/max threshold for unit '{unit}': "
                        f"min {max_min.get('value')} > max {min_max.get('value')}"
                    ),
                    "evidence_refs": sorted({_safe_text(max_min.get("ref")), _safe_text(min_max.get("ref"))}),
                }
            )

    return conflicts[:6]


def _extract_query_tokens(query: str) -> list[str]:
    tokens = [token.lower() for token in _TOKEN_RE.findall(_safe_text(query))]
    # Keep intent words and remove short/very common connector terms.
    stop = {"and", "the", "with", "for", "of", "및", "관련", "공사", "검토", "체크"}
    uniq: list[str] = []
    for token in tokens:
        if token in stop:
            continue
        if token not in uniq:
            uniq.append(token)
    return uniq[:12]


def _compute_consistency_score(tokens: list[str], evidence_rows: list[dict[str, Any]], conflicts: list[dict[str, Any]]) -> float:
    if not evidence_rows:
        return 0.0

    texts = [row["text"] for row in evidence_rows]
    if tokens:
        supported = 0
        for token in tokens:
            hits = sum(1 for text in texts if token in text)
            if hits >= 2:
                supported += 1
        token_agreement = supported / len(tokens)
    else:
        token_agreement = 0.5

    unique_sources = len({_safe_text(row.get("source")) for row in evidence_rows if _safe_text(row.get("source"))})
    source_diversity = unique_sources / max(1, len(evidence_rows))

    avg_evidence_score = sum(float(row.get("evidence_score") or 0.0) for row in evidence_rows) / max(1, len(evidence_rows))
    conflict_penalty = min(0.45, 0.15 * len(conflicts))

    score = (0.45 * token_agreement) + (0.25 * source_diversity) + (0.30 * avg_evidence_score)
    score = max(0.0, min(1.0, score - conflict_penalty))
    return round(score, 4)


def _build_trust_layer(query: str, standards: list[dict[str, Any]], laws: list[dict[str, Any]]) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []

    for item in laws:
        ref = f"L:{_safe_text(item.get('key'))}"
        rows.append(
            {
                "kind": "law",
                "ref": ref,
                "source": _source_label(item, kind="law"),
                "text": _extract_text_blob(item),
                "evidence_score": float(item.get("evidence_score") or 0.0),
                "polarity": _detect_polarity(_extract_text_blob(item)),
                "thresholds": _extract_thresholds(_extract_text_blob(item)),
            }
        )

    for item in standards:
        ref = f"S:{_safe_text(item.get('key'))}"
        rows.append(
            {
                "kind": "standard",
                "ref": ref,
                "source": _source_label(item, kind="standard"),
                "text": _extract_text_blob(item),
                "evidence_score": float(item.get("evidence_score") or 0.0),
                "polarity": _detect_polarity(_extract_text_blob(item)),
                "thresholds": _extract_thresholds(_extract_text_blob(item)),
            }
        )

    if not rows:
        return {
            "evidence_score": 0.0,
            "source_consistency_score": 0.0,
            "source_coverage": 0.0,
            "overall_confidence": 0.0,
            "conflicts": [],
        }

    conflicts = _make_conflict_entries(rows)
    query_tokens = _extract_query_tokens(query)
    consistency = _compute_consistency_score(query_tokens, rows, conflicts)

    evidence_score = round(
        sum(float(row.get("evidence_score") or 0.0) for row in rows) / max(1, len(rows)),
        4,
    )
    unique_sources = len({_safe_text(row.get("source")) for row in rows if _safe_text(row.get("source"))})
    source_coverage = round(unique_sources / max(1, len(rows)), 4)

    overall = (0.45 * evidence_score) + (0.40 * consistency) + (0.15 * source_coverage)
    overall = max(0.0, min(1.0, overall - min(0.30, 0.10 * len(conflicts))))

    return {
        "evidence_score": evidence_score,
        "source_consistency_score": consistency,
        "source_coverage": source_coverage,
        "overall_confidence": round(overall, 4),
        "conflicts": conflicts,
    }


def _cache_key(query: str, *, limit: int, mode: str, alpha: float, excerpt_chars: int) -> str:
    payload = {
        "query": _safe_text(query).lower(),
        "limit": int(limit),
        "mode": _safe_text(mode).lower(),
        "alpha": round(float(alpha), 4),
        "excerpt_chars": int(excerpt_chars),
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _finalize_result(
    *,
    mode: str,
    query: str,
    standards: list[dict[str, Any]],
    laws: list[dict[str, Any]],
    warning: str | None = None,
) -> dict[str, Any]:
    standards_scored = _attach_evidence_scores(standards)
    laws_scored = _attach_evidence_scores(laws)
    result = {
        "mode": mode,
        "standards": standards_scored,
        "laws": laws_scored,
        "trust": _build_trust_layer(query, standards_scored, laws_scored),
    }
    if warning:
        result["warning"] = warning
    return result


def search_kg(
    query: str,
    *,
    limit: int = 8,
    mode: str = "hybrid",
    alpha: float = 0.6,
    excerpt_chars: int = 360,
) -> dict[str, Any]:
    """
    Search Neo4j knowledge graph for standards/specs and laws.

    mode:
      - "fulltext": use Neo4j fulltext indexes only
      - "vector": use Neo4j vector indexes only (requires OPENAI_API_KEY)
      - "hybrid": merge fulltext + vector (falls back to fulltext if embedding unavailable)

    Response includes trust metadata:
      - trust.evidence_score
      - trust.source_consistency_score
      - trust.conflicts
      - trust.overall_confidence
    """
    query = _safe_text(query)
    if not query:
        return {
            "mode": mode,
            "standards": [],
            "laws": [],
            "trust": {
                "evidence_score": 0.0,
                "source_consistency_score": 0.0,
                "source_coverage": 0.0,
                "overall_confidence": 0.0,
                "conflicts": [],
            },
            "cache": {"hit": False, "scope": "query", "ttl_s": _SEARCH_CACHE_TTL_S},
        }

    mode = (mode or "hybrid").strip().lower()
    if mode not in {"fulltext", "vector", "hybrid"}:
        mode = "hybrid"

    key = _cache_key(query, limit=limit, mode=mode, alpha=alpha, excerpt_chars=excerpt_chars)
    hit, cached = _SEARCH_CACHE.get(key)
    if hit and isinstance(cached, dict):
        cached["cache"] = {"hit": True, "scope": "query", "ttl_s": _SEARCH_CACHE_TTL_S}
        return cached

    driver = get_neo4j_driver()

    embedding = None
    if mode in {"vector", "hybrid"}:
        embedding = _openai_embed_query(query)
        if embedding is None and mode == "vector":
            result = _finalize_result(
                mode="vector",
                query=query,
                standards=[],
                laws=[],
                warning="OPENAI_API_KEY not configured or embedding failed",
            )
            result["cache"] = {"hit": False, "scope": "query", "ttl_s": _SEARCH_CACHE_TTL_S}
            _SEARCH_CACHE.set(key, result)
            return result

    with driver.session(database=_resolve_neo4j_config().database) as session:
        standards_ft = _fulltext_search_spec(session, query, limit=limit * 2, excerpt_chars=excerpt_chars) if mode in {"fulltext", "hybrid"} else []
        laws_ft = _fulltext_search_legal(session, query, limit=limit * 2, excerpt_chars=excerpt_chars) if mode in {"fulltext", "hybrid"} else []

        standards_vec: list[dict[str, Any]] = []
        laws_vec: list[dict[str, Any]] = []
        if embedding is not None and mode in {"vector", "hybrid"}:
            standards_vec = _vector_search_spec(session, embedding, limit=limit * 2, excerpt_chars=excerpt_chars)
            laws_vec = _vector_search_legal(session, embedding, limit=limit * 2, excerpt_chars=excerpt_chars)

        if mode == "fulltext" or embedding is None:
            for row in standards_ft:
                row.setdefault("retrieval", "fulltext")
            for row in laws_ft:
                row.setdefault("retrieval", "fulltext")
            base = _finalize_result(
                mode="fulltext",
                query=query,
                standards=standards_ft[:limit],
                laws=laws_ft[:limit],
            )
        elif mode == "vector":
            for row in standards_vec:
                row.setdefault("retrieval", "vector")
            for row in laws_vec:
                row.setdefault("retrieval", "vector")
            base = _finalize_result(
                mode="vector",
                query=query,
                standards=standards_vec[:limit],
                laws=laws_vec[:limit],
            )
        else:
            standards = _merge_hybrid(standards_ft, standards_vec, limit=limit, alpha=alpha)
            laws = _merge_hybrid(laws_ft, laws_vec, limit=limit, alpha=alpha)
            base = _finalize_result(mode="hybrid", query=query, standards=standards, laws=laws)

    _SEARCH_CACHE.set(key, base)
    base["cache"] = {"hit": False, "scope": "query", "ttl_s": _SEARCH_CACHE_TTL_S}
    return base
