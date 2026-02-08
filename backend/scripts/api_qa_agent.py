#!/usr/bin/env python
"""
API QA Test Agent for p6ix-CPE.

Two execution modes:
- drf: call DRF views directly with APIRequestFactory (no DB migrations required)
- http: call running server endpoints with requests

This script focuses on AI-related APIs and auth guards:
- /api/cpe/kg/*
- /api/cpe/schedule-ai/summary/
- /api/cpe/vision/safety/ (optional)
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


@dataclass
class AttemptResult:
    status_code: int
    passed: bool
    latency_ms: float
    error: str = ""


@dataclass
class CaseResult:
    case_id: str
    description: str
    endpoint: str
    method: str
    expected: str
    attempts: list[AttemptResult] = field(default_factory=list)

    @property
    def pass_count(self) -> int:
        return sum(1 for x in self.attempts if x.passed)

    @property
    def total_count(self) -> int:
        return len(self.attempts)

    @property
    def passed(self) -> bool:
        return self.total_count > 0 and self.pass_count == self.total_count

    @property
    def avg_latency_ms(self) -> float:
        values = [x.latency_ms for x in self.attempts]
        return round(statistics.fmean(values), 2) if values else 0.0

    @property
    def max_latency_ms(self) -> float:
        values = [x.latency_ms for x in self.attempts]
        return round(max(values), 2) if values else 0.0

    @property
    def statuses(self) -> list[int]:
        return [x.status_code for x in self.attempts]

    @property
    def errors(self) -> list[str]:
        return [x.error for x in self.attempts if x.error]


class ApiQaAgent:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.root_dir = Path(__file__).resolve().parents[2]
        self.backend_dir = self.root_dir / "backend"
        self.enriched_items: list[dict[str, Any]] = []
        self.latest_enrich_job_id: str = ""

        self.factory = None
        self.force_authenticate = None
        self.dev_user = None
        self.views: dict[str, Callable[..., Any]] = {}

        self.http = None

    def run(self) -> dict[str, Any]:
        if self.args.mode == "drf":
            self._setup_drf_mode()
        else:
            self._setup_http_mode()

        cases = self._run_suite()
        report = self._build_report(cases)
        violations = self._evaluate_gates(report)
        report["gates"] = {
            "passed": len(violations) == 0,
            "violations": violations,
        }

        self._print_summary(report)
        self._write_outputs(report)
        return report

    def _setup_drf_mode(self) -> None:
        if str(self.backend_dir) not in sys.path:
            sys.path.insert(0, str(self.backend_dir))

        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

        import django  # pylint: disable=import-outside-toplevel

        django.setup()

        from rest_framework.test import APIRequestFactory, force_authenticate  # pylint: disable=import-outside-toplevel
        from user.models import User  # pylint: disable=import-outside-toplevel
        import cpe_module.views.kg as kg_view_module  # pylint: disable=import-outside-toplevel
        import cpe_module.views.vision as vision_view_module  # pylint: disable=import-outside-toplevel
        import cpe_module.views.schedule_ai as schedule_ai_view_module  # pylint: disable=import-outside-toplevel

        self.factory = APIRequestFactory()
        self.force_authenticate = force_authenticate
        self.dev_user = User(username=os.getenv("CPE_DEV_AUTH_USER", "dev"))

        if self.args.stub_external:
            self._apply_stub_external(
                kg_view_module=kg_view_module,
                vision_view_module=vision_view_module,
                schedule_ai_view_module=schedule_ai_view_module,
            )

        self.views = {
            "kg_search": kg_view_module.kg_search,
            "kg_answer": kg_view_module.kg_answer,
            "kg_card": kg_view_module.kg_card,
            "kg_enrich_schedule": kg_view_module.kg_enrich_schedule,
            "kg_enrich_schedule_job": kg_view_module.kg_enrich_schedule_job,
            "kg_evidence_pack": kg_view_module.kg_evidence_pack,
            "kg_duration_agent": kg_view_module.kg_duration_agent,
            "safety_check": vision_view_module.safety_check,
            "schedule_ai_summary": schedule_ai_view_module.summarize_schedule_ai_log,
        }

    def _setup_http_mode(self) -> None:
        import requests  # pylint: disable=import-outside-toplevel

        self.http = requests.Session()

    def _apply_stub_external(
        self,
        *,
        kg_view_module: Any,
        vision_view_module: Any,
        schedule_ai_view_module: Any,
    ) -> None:
        """
        Replace external integrations with deterministic stubs for CI.
        Keeps API schema/flow intact while removing Neo4j/OpenAI dependency.
        """
        def _stub_search_kg(query: str, *, limit: int = 8, mode: str = "hybrid", **_: Any) -> dict[str, Any]:
            safe_query = str(query or "").strip()
            standards = [
                {
                    "key": "STD-001",
                    "path": "Construction/Safety/Scaffold",
                    "title": "Scaffold Safety Checklist",
                    "doc_no": "STD-2026-001",
                    "retrieval": "stub",
                    "score": 1.0,
                    "evidence_score": 1.0,
                    "excerpt": f"Stub standard evidence for query: {safe_query}",
                }
            ]
            laws = [
                {
                    "key": "LAW-001",
                    "law_name": "Industrial Safety Law",
                    "name": "Article on fall prevention",
                    "article_number": 12,
                    "retrieval": "stub",
                    "score": 1.0,
                    "evidence_score": 1.0,
                    "excerpt": f"Stub legal evidence for query: {safe_query}",
                }
            ]
            return {
                "mode": mode,
                "standards": standards[: max(1, min(limit, len(standards)))],
                "laws": laws[: max(1, min(limit, len(laws)))],
                "trust": {
                    "evidence_score": 1.0,
                    "source_consistency_score": 1.0,
                    "source_coverage": 1.0,
                    "overall_confidence": 1.0,
                    "conflicts": [],
                },
                "cache": {"hit": False, "scope": "query", "ttl_s": 300},
            }

        def _stub_grounded_answer(query: str, standards: list[dict[str, Any]], laws: list[dict[str, Any]]) -> str:
            return (
                f"Stub grounded answer: {str(query)[:120]}. "
                f"standards={len(standards)}, laws={len(laws)}"
            )

        def _stub_grounded_answer_cached(
            query: str,
            standards: list[dict[str, Any]],
            laws: list[dict[str, Any]],
        ) -> tuple[str, bool]:
            return _stub_grounded_answer(query, standards, laws), False

        def _stub_execution_card(query: str, standards: list[dict[str, Any]], laws: list[dict[str, Any]]) -> dict[str, Any]:
            return {
                "one_liner": f"Stub execution card for: {str(query)[:80]}",
                "checklist": [
                    {
                        "item": "Confirm scaffold stability",
                        "category": "safety",
                        "severity": "high",
                        "how_to_verify": "Visual + torque check",
                        "evidence": [f"S:{standards[0]['key']}"] if standards else [],
                    }
                ],
                "risks": ["Fall hazard", "Dropped objects"],
                "required_documents": ["Work permit", "Safety checklist"],
            }

        def _stub_execution_card_cached(
            query: str,
            standards: list[dict[str, Any]],
            laws: list[dict[str, Any]],
        ) -> tuple[dict[str, Any], bool]:
            return _stub_execution_card(query, standards, laws), False

        def _stub_chat_completion_messages(*_: Any, **__: Any) -> str:
            return json.dumps(
                {
                    "summary": "Stub visual inspection result.",
                    "findings": [
                        {
                            "area": "scaffold",
                            "issue": "missing toe board",
                            "severity": "medium",
                            "confidence": 0.82,
                            "evidence_refs": ["S:STD-001", "L:LAW-001"],
                        }
                    ],
                    "risks": ["trip/fall"],
                    "actions": ["Install toe board", "Re-inspect before work"],
                    "uncertainty": [],
                    "evidence_refs": ["S:STD-001", "L:LAW-001"],
                }
            )

        kg_view_module.search_kg = _stub_search_kg
        kg_view_module.generate_grounded_answer_cached = _stub_grounded_answer_cached
        kg_view_module.generate_execution_card_cached = _stub_execution_card_cached

        vision_view_module.search_kg = _stub_search_kg
        vision_view_module.chat_completion_messages = _stub_chat_completion_messages

        schedule_ai_view_module.gantt_ai_log_runner = lambda payload: (
            f"Stub schedule summary. tasks={len((payload or {}).get('critical_tasks', []))}"
        )

    def _run_suite(self) -> list[CaseResult]:
        repeat = max(1, self.args.repeat)
        cases: list[CaseResult] = []

        cases.append(
            self._run_case(
                case_id="auth_guard_kg_search",
                description="KG search must reject unauthenticated request",
                endpoint="/api/cpe/kg/search/",
                method="POST",
                expected="401 or 403",
                runner=self._call_auth_guard_kg_search,
                validator=lambda status, body: (
                    status in {401, 403},
                    self._short_body(body),
                ),
                repeat=1,
            )
        )

        cases.append(
            self._run_case(
                case_id="kg_search_basic",
                description="KG search basic retrieval",
                endpoint="/api/cpe/kg/search/",
                method="POST",
                expected="200 + standards/laws keys",
                runner=lambda: self._call_json(
                    "/api/cpe/kg/search/",
                    {"query": "concrete curing quality checklist", "limit": 5, "mode": "hybrid"},
                    view_key="kg_search",
                ),
                validator=self._validate_kg_search,
                repeat=repeat,
            )
        )

        cases.append(
            self._run_case(
                case_id="kg_search_trust_layer",
                description="KG search must include trust layer metadata",
                endpoint="/api/cpe/kg/search/",
                method="POST",
                expected="200 + trust/conflicts/cache keys",
                runner=lambda: self._call_json(
                    "/api/cpe/kg/search/",
                    {"query": "scaffold legal requirement and prohibition", "limit": 5, "mode": "hybrid"},
                    view_key="kg_search",
                ),
                validator=self._validate_kg_search,
                repeat=repeat,
            )
        )

        cases.append(
            self._run_case(
                case_id="kg_answer_basic",
                description="KG grounded answer",
                endpoint="/api/cpe/kg/answer/",
                method="POST",
                expected="200 + non-empty answer",
                runner=lambda: self._call_json(
                    "/api/cpe/kg/answer/",
                    {
                        "query": "site scaffold safety checklist with legal references",
                        "limit": 5,
                        "mode": "hybrid",
                    },
                    view_key="kg_answer",
                ),
                validator=self._validate_kg_answer,
                repeat=repeat,
            )
        )

        cases.append(
            self._run_case(
                case_id="kg_card_basic",
                description="KG execution card generation",
                endpoint="/api/cpe/kg/card/",
                method="POST",
                expected="200 + card/checklist",
                runner=lambda: self._call_json(
                    "/api/cpe/kg/card/",
                    {
                        "query": "pile drilling pre-check and execution control",
                        "limit": 5,
                        "mode": "hybrid",
                    },
                    view_key="kg_card",
                ),
                validator=self._validate_kg_card,
                repeat=repeat,
            )
        )

        enrich_case = self._run_case(
            case_id="kg_enrich_schedule",
            description="Batch KG enrichment for schedule items",
            endpoint="/api/cpe/kg/enrich-schedule/",
            method="POST",
            expected="200 + processed items with kg",
            runner=lambda: self._call_json(
                "/api/cpe/kg/enrich-schedule/",
                {
                    "items": [
                        {
                            "id": "task-1",
                            "main_category": "EARTH",
                            "process": "excavation",
                            "work_type": "soil excavation",
                            "quantity": 120,
                            "unit": "m3",
                        },
                        {
                            "id": "task-2",
                            "main_category": "FRAME",
                            "process": "formwork",
                            "work_type": "slab formwork",
                            "quantity": 300,
                            "unit": "m2",
                        },
                    ],
                    "mode": "hybrid",
                    "limit": 4,
                    "max_items": 2,
                    "include_card": True,
                },
                view_key="kg_enrich_schedule",
            ),
            validator=self._validate_enrich,
            repeat=repeat,
        )
        cases.append(enrich_case)

        cases.append(
            self._run_case(
                case_id="kg_enrich_schedule_async_submit",
                description="Async KG enrichment submit",
                endpoint="/api/cpe/kg/enrich-schedule/",
                method="POST",
                expected="202 + job_id",
                runner=self._call_enrich_async_submit,
                validator=self._validate_enrich_async_submit,
                repeat=1,
            )
        )

        cases.append(
            self._run_case(
                case_id="kg_enrich_schedule_async_poll",
                description="Async KG enrichment poll until completed",
                endpoint="/api/cpe/kg/enrich-schedule/jobs/<job_id>/",
                method="GET",
                expected="200 + completed result",
                runner=self._call_enrich_async_poll,
                validator=self._validate_enrich_async_poll,
                repeat=1,
            )
        )

        evidence_payload_items = self.enriched_items or self._fallback_evidence_items()
        cases.append(
            self._run_case(
                case_id="kg_evidence_pack",
                description="Evidence pack generation",
                endpoint="/api/cpe/kg/evidence-pack/",
                method="POST",
                expected="200 + markdown/items",
                runner=lambda: self._call_json(
                    "/api/cpe/kg/evidence-pack/",
                    {"items": evidence_payload_items, "max_evidence_per_kind": 5, "excerpt_limit": 400},
                    view_key="kg_evidence_pack",
                ),
                validator=lambda status, body: (
                    status == 200
                    and bool(str((body or {}).get("markdown") or "").strip())
                    and isinstance((body or {}).get("items"), list),
                    self._short_body(body),
                ),
                repeat=repeat,
            )
        )

        cases.append(
            self._run_case(
                case_id="kg_duration_agent",
                description="Duration adequacy agent scenarios with evidence links",
                endpoint="/api/cpe/kg/duration-agent/",
                method="POST",
                expected="200 + scenarios + trust + links",
                runner=lambda: self._call_json(
                    "/api/cpe/kg/duration-agent/",
                    {
                        "project_name": "CPE Air Adequacy Review",
                        "current_duration_days": 150,
                        "target_duration_days": 120,
                        "tasks": [
                            {
                                "name": "Earthwork package A",
                                "duration_days": 28,
                                "critical": True,
                                "parallelizable": True,
                            },
                            {
                                "name": "Frame package B",
                                "duration_days": 42,
                                "critical": True,
                                "parallelizable": False,
                            },
                            {
                                "name": "Finishing package C",
                                "duration_days": 24,
                                "critical": False,
                                "parallelizable": True,
                            },
                        ],
                        "mode": "hybrid",
                        "limit": 6,
                    },
                    view_key="kg_duration_agent",
                ),
                validator=self._validate_duration_agent,
                repeat=repeat,
            )
        )

        cases.append(
            self._run_case(
                case_id="schedule_ai_summary",
                description="Schedule AI summary API",
                endpoint="/api/cpe/schedule-ai/summary/",
                method="POST",
                expected="200 + summary string",
                runner=lambda: self._call_json(
                    "/api/cpe/schedule-ai/summary/",
                    {
                        "total_days": 120,
                        "target_days": 100,
                        "critical_tasks": ["earthwork", "frame"],
                        "actions": [{"task": "earthwork", "delta": -5}],
                    },
                    view_key="schedule_ai_summary",
                ),
                validator=self._validate_schedule_ai_summary,
                repeat=repeat,
            )
        )

        if self.args.with_vision:
            image_path = self._resolve_image_path()
            if image_path:
                cases.append(
                    self._run_case(
                        case_id="vision_safety_check",
                        description="Vision safety inspection",
                        endpoint="/api/cpe/vision/safety/",
                        method="POST multipart",
                        expected="200 + analysis",
                        runner=lambda: self._call_vision(image_path),
                        validator=lambda status, body: (
                            status == 200 and isinstance((body or {}).get("analysis"), dict),
                            self._short_body(body),
                        ),
                        repeat=1,
                    )
                )
            else:
                cases.append(
                    self._skip_case(
                        case_id="vision_safety_check",
                        description="Vision safety inspection",
                        endpoint="/api/cpe/vision/safety/",
                        method="POST multipart",
                        expected="200 + analysis",
                        reason="image file not found; pass --image-path",
                    )
                )

        return cases

    def _run_case(
        self,
        *,
        case_id: str,
        description: str,
        endpoint: str,
        method: str,
        expected: str,
        runner: Callable[[], tuple[int, Any, float]],
        validator: Callable[[int, Any], tuple[bool, str]],
        repeat: int,
    ) -> CaseResult:
        case = CaseResult(
            case_id=case_id,
            description=description,
            endpoint=endpoint,
            method=method,
            expected=expected,
        )
        for _ in range(repeat):
            try:
                status_code, body, latency_ms = runner()
                passed, note = validator(status_code, body)
                case.attempts.append(
                    AttemptResult(
                        status_code=status_code,
                        passed=passed,
                        latency_ms=latency_ms,
                        error="" if passed else note,
                    )
                )
            except Exception as exc:  # pylint: disable=broad-except
                case.attempts.append(
                    AttemptResult(
                        status_code=0,
                        passed=False,
                        latency_ms=0.0,
                        error=f"exception: {exc}",
                    )
                )
        return case

    def _skip_case(
        self,
        *,
        case_id: str,
        description: str,
        endpoint: str,
        method: str,
        expected: str,
        reason: str,
    ) -> CaseResult:
        case = CaseResult(
            case_id=case_id,
            description=description,
            endpoint=endpoint,
            method=method,
            expected=expected,
        )
        case.attempts.append(AttemptResult(status_code=-1, passed=False, latency_ms=0.0, error=f"skipped: {reason}"))
        return case

    def _call_auth_guard_kg_search(self) -> tuple[int, Any, float]:
        if self.args.mode == "drf":
            req = self.factory.post("/api/cpe/kg/search/", {"query": "test"}, format="json")
            started = time.perf_counter()
            resp = self.views["kg_search"](req)
            latency_ms = (time.perf_counter() - started) * 1000
            return int(resp.status_code), getattr(resp, "data", {}), latency_ms

        import requests  # pylint: disable=import-outside-toplevel

        url = self._full_url("/api/cpe/kg/search/")
        started = time.perf_counter()
        resp = requests.post(url, json={"query": "test"}, timeout=self.args.timeout_s)
        latency_ms = (time.perf_counter() - started) * 1000
        return int(resp.status_code), self._safe_json(resp), latency_ms

    def _call_json(self, path: str, payload: dict[str, Any], *, view_key: str) -> tuple[int, Any, float]:
        if self.args.mode == "drf":
            req = self.factory.post(path, payload, format="json")
            self.force_authenticate(req, user=self.dev_user)
            started = time.perf_counter()
            resp = self.views[view_key](req)
            latency_ms = (time.perf_counter() - started) * 1000
            return int(resp.status_code), getattr(resp, "data", {}), latency_ms

        headers = {}
        if self.args.dev_token:
            headers["X-Dev-Auth"] = self.args.dev_token

        url = self._full_url(path)
        started = time.perf_counter()
        resp = self.http.post(url, json=payload, headers=headers, timeout=self.args.timeout_s)
        latency_ms = (time.perf_counter() - started) * 1000
        return int(resp.status_code), self._safe_json(resp), latency_ms

    def _call_get(
        self,
        path: str,
        *,
        view_key: str,
        view_kwargs: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
    ) -> tuple[int, Any, float]:
        if self.args.mode == "drf":
            req = self.factory.get(path, data=params or {}, format="json")
            self.force_authenticate(req, user=self.dev_user)
            started = time.perf_counter()
            resp = self.views[view_key](req, **(view_kwargs or {}))
            latency_ms = (time.perf_counter() - started) * 1000
            return int(resp.status_code), getattr(resp, "data", {}), latency_ms

        headers = {}
        if self.args.dev_token:
            headers["X-Dev-Auth"] = self.args.dev_token

        url = self._full_url(path)
        started = time.perf_counter()
        resp = self.http.get(url, params=params or {}, headers=headers, timeout=self.args.timeout_s)
        latency_ms = (time.perf_counter() - started) * 1000
        return int(resp.status_code), self._safe_json(resp), latency_ms

    def _call_enrich_async_submit(self) -> tuple[int, Any, float]:
        status_code, body, latency_ms = self._call_json(
            "/api/cpe/kg/enrich-schedule/",
            {
                "items": [
                    {
                        "id": "async-task-1",
                        "main_category": "EARTH",
                        "process": "excavation",
                        "work_type": "soil excavation",
                        "quantity": 100,
                        "unit": "m3",
                    },
                    {
                        "id": "async-task-2",
                        "main_category": "FRAME",
                        "process": "reinforcement",
                        "work_type": "rebar installation",
                        "quantity": 250,
                        "unit": "kg",
                    },
                ],
                "mode": "hybrid",
                "limit": 4,
                "max_items": 2,
                "include_card": True,
                "async": True,
            },
            view_key="kg_enrich_schedule",
        )
        if status_code == 202 and isinstance(body, dict):
            self.latest_enrich_job_id = str(body.get("job_id") or "").strip()
        return status_code, body, latency_ms

    def _call_enrich_async_poll(self) -> tuple[int, Any, float]:
        job_id = str(self.latest_enrich_job_id or "").strip()
        if not job_id:
            return 0, {"detail": "missing async job id"}, 0.0

        start = time.perf_counter()
        final_status = 0
        final_body: Any = {}
        for _ in range(30):
            path = f"/api/cpe/kg/enrich-schedule/jobs/{job_id}/"
            status_code, body, _ = self._call_get(
                path,
                view_key="kg_enrich_schedule_job",
                view_kwargs={"job_id": job_id},
                params={"include_result": "true"},
            )
            final_status, final_body = status_code, body
            if status_code != 200:
                break
            current_status = str((body or {}).get("status") or "").strip().lower()
            if current_status in {"completed", "failed"}:
                break
            time.sleep(0.2)

        latency_ms = (time.perf_counter() - start) * 1000
        return final_status, final_body, latency_ms

    def _call_vision(self, image_path: Path) -> tuple[int, Any, float]:
        if self.args.mode == "drf":
            from django.core.files.uploadedfile import SimpleUploadedFile  # pylint: disable=import-outside-toplevel

            upload = SimpleUploadedFile(
                image_path.name,
                image_path.read_bytes(),
                content_type="image/png",
            )
            req = self.factory.post(
                "/api/cpe/vision/safety/",
                {"context": "scaffold safety", "mode": "hybrid", "images": [upload]},
                format="multipart",
            )
            self.force_authenticate(req, user=self.dev_user)
            started = time.perf_counter()
            resp = self.views["safety_check"](req)
            latency_ms = (time.perf_counter() - started) * 1000
            return int(resp.status_code), getattr(resp, "data", {}), latency_ms

        headers = {}
        if self.args.dev_token:
            headers["X-Dev-Auth"] = self.args.dev_token

        url = self._full_url("/api/cpe/vision/safety/")
        files = [
            (
                "images",
                (
                    image_path.name,
                    image_path.read_bytes(),
                    "image/png",
                ),
            )
        ]
        data = {"context": "scaffold safety", "mode": "hybrid"}
        started = time.perf_counter()
        resp = self.http.post(url, data=data, files=files, headers=headers, timeout=self.args.timeout_s)
        latency_ms = (time.perf_counter() - started) * 1000
        return int(resp.status_code), self._safe_json(resp), latency_ms

    def _validate_kg_search(self, status: int, body: Any) -> tuple[bool, str]:
        if status != 200:
            return False, self._short_body(body)
        standards = (body or {}).get("standards")
        laws = (body or {}).get("laws")
        trust = (body or {}).get("trust")
        cache = (body or {}).get("cache")
        if not isinstance(standards, list) or not isinstance(laws, list):
            return False, self._short_body(body)
        if not isinstance(trust, dict):
            return False, self._short_body(body)
        if "source_consistency_score" not in trust or "conflicts" not in trust:
            return False, self._short_body(body)
        if not isinstance(cache, dict):
            return False, self._short_body(body)
        return True, ""

    def _is_ai_error_text(self, value: Any) -> bool:
        text = str(value or "").strip().lower()
        if not text:
            return False
        markers = (
            "(ai error",
            "(ai is disabled",
            "openai_api_key is not set",
            "temporarily unavailable",
        )
        return any(marker in text for marker in markers)

    def _is_ai_error_payload(self, payload: Any) -> bool:
        if self._is_ai_error_text(payload):
            return True
        if not isinstance(payload, dict):
            return False
        card_keys = ("one_liner", "checklist", "risks", "required_documents")
        has_card_payload = any(key in payload for key in card_keys)
        if str(payload.get("detail") or "").strip() and not has_card_payload:
            return True
        if str(payload.get("raw") or "").strip() and not has_card_payload:
            return True
        return False

    def _validate_kg_answer(self, status: int, body: Any) -> tuple[bool, str]:
        if status != 200:
            return False, self._short_body(body)
        answer = str((body or {}).get("answer") or "").strip()
        if not answer:
            return False, self._short_body(body)
        if self._is_ai_error_text(answer):
            return False, self._short_body(body)
        return True, ""

    def _validate_kg_card(self, status: int, body: Any) -> tuple[bool, str]:
        if status != 200:
            return False, self._short_body(body)
        card = (body or {}).get("card")
        if not isinstance(card, dict):
            return False, self._short_body(body)
        if self._is_ai_error_payload(card):
            return False, self._short_body(body)
        checklist = card.get("checklist")
        if not isinstance(checklist, list):
            return False, self._short_body(body)
        return True, ""

    def _validate_schedule_ai_summary(self, status: int, body: Any) -> tuple[bool, str]:
        if status != 200:
            return False, self._short_body(body)
        summary = str((body or {}).get("summary") or "").strip()
        if not summary:
            return False, self._short_body(body)
        if self._is_ai_error_text(summary):
            return False, self._short_body(body)
        return True, ""

    def _validate_enrich(self, status: int, body: Any) -> tuple[bool, str]:
        if status != 200:
            return False, self._short_body(body)

        items = (body or {}).get("items")
        stats = (body or {}).get("stats")
        if not isinstance(items, list) or not isinstance(stats, dict):
            return False, self._short_body(body)

        self.enriched_items = [x for x in items if isinstance(x, dict)]
        valid_kg_count = 0
        for item in self.enriched_items:
            kg_obj = item.get("kg")
            if not isinstance(kg_obj, dict):
                continue
            answer = kg_obj.get("answer")
            card = kg_obj.get("card")
            answer_ok = (
                isinstance(answer, str)
                and bool(answer.strip())
                and not self._is_ai_error_text(answer)
            )
            card_ok = (
                isinstance(card, dict)
                and isinstance(card.get("checklist"), list)
                and not self._is_ai_error_payload(card)
            )
            if answer_ok or card_ok:
                valid_kg_count += 1

        if valid_kg_count == 0:
            return False, self._short_body(body)
        return True, ""

    def _validate_enrich_async_submit(self, status: int, body: Any) -> tuple[bool, str]:
        if status != 202:
            return False, self._short_body(body)
        if not isinstance(body, dict):
            return False, self._short_body(body)
        job_id = str(body.get("job_id") or "").strip()
        status_text = str(body.get("status") or "").strip().lower()
        if not job_id:
            return False, self._short_body(body)
        if status_text != "queued":
            return False, self._short_body(body)
        return True, ""

    def _validate_enrich_async_poll(self, status: int, body: Any) -> tuple[bool, str]:
        if status != 200:
            return False, self._short_body(body)
        if not isinstance(body, dict):
            return False, self._short_body(body)
        status_text = str(body.get("status") or "").strip().lower()
        if status_text != "completed":
            return False, self._short_body(body)
        result = body.get("result")
        if not isinstance(result, dict):
            return False, self._short_body(body)
        items = result.get("items")
        if not isinstance(items, list):
            return False, self._short_body(body)
        self.enriched_items = [item for item in items if isinstance(item, dict)]
        return True, ""

    def _validate_duration_agent(self, status: int, body: Any) -> tuple[bool, str]:
        if status != 200:
            return False, self._short_body(body)
        if not isinstance(body, dict):
            return False, self._short_body(body)

        baseline = body.get("baseline")
        scenarios = body.get("scenarios")
        evidence = body.get("evidence")
        if not isinstance(baseline, dict):
            return False, self._short_body(body)
        if not isinstance(scenarios, list) or len(scenarios) < 3:
            return False, self._short_body(body)
        if not isinstance(evidence, dict):
            return False, self._short_body(body)

        trust = evidence.get("trust")
        links = evidence.get("links")
        if not isinstance(trust, dict):
            return False, self._short_body(body)
        if "source_consistency_score" not in trust or "conflicts" not in trust:
            return False, self._short_body(body)
        if not isinstance(links, list):
            return False, self._short_body(body)
        if links and not isinstance(links[0].get("link"), str):
            return False, self._short_body(body)
        return True, ""

    def _fallback_evidence_items(self) -> list[dict[str, Any]]:
        return [
            {
                "id": "fallback-1",
                "main_category": "EARTH",
                "process": "excavation",
                "work_type": "soil excavation",
                "kg": {
                    "answer": "Ensure excavation slope and edge protection.",
                    "standards": [],
                    "laws": [],
                },
            }
        ]

    def _resolve_image_path(self) -> Path | None:
        if self.args.image_path:
            p = Path(self.args.image_path).expanduser().resolve()
            return p if p.exists() else None

        candidates = [
            self.root_dir / "frontend" / "public" / "cpe_favicon.png",
            self.root_dir / "frontend" / "public" / "logo192.png",
            self.root_dir / "frontend" / "build" / "logo192.png",
        ]
        for p in candidates:
            if p.exists():
                return p
        return None

    def _build_report(self, cases: list[CaseResult]) -> dict[str, Any]:
        total_cases = len(cases)
        passed_cases = sum(1 for c in cases if c.passed)

        attempts = [a for c in cases for a in c.attempts if a.status_code >= 0]
        total_attempts = len(attempts)
        passed_attempts = sum(1 for a in attempts if a.passed)
        latencies = [a.latency_ms for a in attempts if a.latency_ms > 0]

        pass_rate = round((passed_cases / total_cases) * 100, 2) if total_cases else 0.0
        consistency = round((passed_attempts / total_attempts) * 100, 2) if total_attempts else 0.0

        p95_latency = self._p95(latencies)
        avg_latency = round(statistics.fmean(latencies), 2) if latencies else 0.0
        speed_score = self._speed_score(p95_latency)

        overall_score = round(pass_rate * 0.7 + consistency * 0.2 + speed_score * 0.1, 2)
        grade = self._grade(overall_score)

        return {
            "meta": {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "mode": self.args.mode,
                "base_url": self.args.base_url,
                "repeat": self.args.repeat,
                "with_vision": self.args.with_vision,
                "stub_external": self.args.stub_external,
                "max_p95_ms": self.args.max_p95_ms,
                "min_pass_rate": self.args.min_pass_rate,
                "min_overall_score": self.args.min_overall_score,
            },
            "score": {
                "overall": overall_score,
                "grade": grade,
                "pass_rate": pass_rate,
                "consistency": consistency,
                "speed_score": speed_score,
            },
            "latency_ms": {
                "avg": avg_latency,
                "p95": p95_latency,
            },
            "counts": {
                "cases_total": total_cases,
                "cases_passed": passed_cases,
                "attempts_total": total_attempts,
                "attempts_passed": passed_attempts,
            },
            "cases": [self._case_dict(c) for c in cases],
        }

    def _evaluate_gates(self, report: dict[str, Any]) -> list[str]:
        violations: list[str] = []
        p95 = float(report["latency_ms"]["p95"])
        pass_rate = float(report["score"]["pass_rate"])
        overall = float(report["score"]["overall"])

        if self.args.max_p95_ms > 0 and p95 > self.args.max_p95_ms:
            violations.append(f"p95 latency {p95} ms exceeds max {self.args.max_p95_ms} ms")
        if self.args.min_pass_rate > 0 and pass_rate < self.args.min_pass_rate:
            violations.append(f"pass_rate {pass_rate}% is below min {self.args.min_pass_rate}%")
        if self.args.min_overall_score > 0 and overall < self.args.min_overall_score:
            violations.append(f"overall score {overall} is below min {self.args.min_overall_score}")
        return violations

    def _case_dict(self, case: CaseResult) -> dict[str, Any]:
        return {
            "case_id": case.case_id,
            "description": case.description,
            "endpoint": case.endpoint,
            "method": case.method,
            "expected": case.expected,
            "passed": case.passed,
            "pass_count": case.pass_count,
            "total_count": case.total_count,
            "avg_latency_ms": case.avg_latency_ms,
            "max_latency_ms": case.max_latency_ms,
            "statuses": case.statuses,
            "errors": case.errors,
            "attempts": [asdict(a) for a in case.attempts],
        }

    def _print_summary(self, report: dict[str, Any]) -> None:
        score = report["score"]
        counts = report["counts"]
        lat = report["latency_ms"]

        print("\n=== API QA Agent Report ===")
        print(f"mode: {report['meta']['mode']}")
        print(f"overall: {score['overall']} ({score['grade']})")
        print(f"pass_rate: {score['pass_rate']}%")
        print(f"consistency: {score['consistency']}%")
        print(f"speed_score: {score['speed_score']}")
        print(f"cases: {counts['cases_passed']}/{counts['cases_total']}")
        print(f"latency avg/p95: {lat['avg']} ms / {lat['p95']} ms")
        if report.get("gates", {}).get("passed") is False:
            print("gates: FAIL")
            for violation in report.get("gates", {}).get("violations", []):
                print(f"- gate violation: {violation}")
        else:
            print("gates: PASS")

        for c in report["cases"]:
            mark = "PASS" if c["passed"] else "FAIL"
            print(
                f"- [{mark}] {c['case_id']} "
                f"({c['pass_count']}/{c['total_count']}, {c['avg_latency_ms']} ms avg)"
            )
            if c["errors"]:
                print(f"  errors: {c['errors'][:2]}")

    def _write_outputs(self, report: dict[str, Any]) -> None:
        out_json = Path(self.args.output_json).expanduser()
        out_json.parent.mkdir(parents=True, exist_ok=True)
        out_json.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

        out_md = Path(self.args.output_md).expanduser()
        out_md.parent.mkdir(parents=True, exist_ok=True)
        out_md.write_text(self._render_markdown(report), encoding="utf-8")

        print(f"json report: {out_json}")
        print(f"markdown report: {out_md}")

    def _render_markdown(self, report: dict[str, Any]) -> str:
        score = report["score"]
        counts = report["counts"]
        lat = report["latency_ms"]

        lines = [
            "# API QA Agent Report",
            "",
            f"- generated_at: {report['meta']['generated_at']}",
            f"- mode: {report['meta']['mode']}",
            f"- repeat: {report['meta']['repeat']}",
            f"- with_vision: {report['meta']['with_vision']}",
            f"- stub_external: {report['meta']['stub_external']}",
            f"- max_p95_ms: {report['meta']['max_p95_ms']}",
            f"- min_pass_rate: {report['meta']['min_pass_rate']}",
            f"- min_overall_score: {report['meta']['min_overall_score']}",
            "",
            "## Score",
            "",
            f"- overall: **{score['overall']} ({score['grade']})**",
            f"- pass_rate: {score['pass_rate']}%",
            f"- consistency: {score['consistency']}%",
            f"- speed_score: {score['speed_score']}",
            "",
            "## Counts",
            "",
            f"- cases: {counts['cases_passed']}/{counts['cases_total']}",
            f"- attempts: {counts['attempts_passed']}/{counts['attempts_total']}",
            f"- latency avg/p95: {lat['avg']} ms / {lat['p95']} ms",
            "",
            "## Gates",
            "",
            f"- passed: {report.get('gates', {}).get('passed', True)}",
        ]
        for violation in report.get("gates", {}).get("violations", []):
            lines.append(f"- violation: {violation}")
        lines.extend(
            [
                "",
            "## Case Details",
            "",
            ]
        )

        for c in report["cases"]:
            status = "PASS" if c["passed"] else "FAIL"
            lines.extend(
                [
                    f"### {c['case_id']} - {status}",
                    f"- endpoint: `{c['method']} {c['endpoint']}`",
                    f"- expected: {c['expected']}",
                    f"- attempts: {c['pass_count']}/{c['total_count']}",
                    f"- latency avg/max: {c['avg_latency_ms']} / {c['max_latency_ms']} ms",
                    f"- statuses: {c['statuses']}",
                ]
            )
            if c["errors"]:
                lines.append(f"- errors: {c['errors']}")
            lines.append("")

        return "\n".join(lines).strip() + "\n"

    def _full_url(self, path: str) -> str:
        base = self.args.base_url.rstrip("/")
        suffix = path if path.startswith("/") else f"/{path}"
        return f"{base}{suffix}"

    def _safe_json(self, response: Any) -> Any:
        try:
            return response.json()
        except Exception:  # pylint: disable=broad-except
            return {"raw": response.text[:500]}

    def _short_body(self, body: Any, limit: int = 220) -> str:
        try:
            text = json.dumps(body, ensure_ascii=False)
        except Exception:  # pylint: disable=broad-except
            text = str(body)
        text = text.replace("\n", " ").strip()
        return text if len(text) <= limit else text[: limit - 20] + " ...[truncated]"

    def _p95(self, values: list[float]) -> float:
        if not values:
            return 0.0
        if len(values) == 1:
            return round(values[0], 2)
        ordered = sorted(values)
        idx = int(round(0.95 * (len(ordered) - 1)))
        return round(ordered[idx], 2)

    def _speed_score(self, p95_ms: float) -> float:
        if p95_ms <= 800:
            return 100.0
        if p95_ms <= 1500:
            return 90.0
        if p95_ms <= 2500:
            return 80.0
        if p95_ms <= 4000:
            return 70.0
        if p95_ms <= 6000:
            return 60.0
        if p95_ms <= 8000:
            return 50.0
        return 40.0

    def _grade(self, score: float) -> str:
        if score >= 90:
            return "A"
        if score >= 80:
            return "B"
        if score >= 70:
            return "C"
        if score >= 60:
            return "D"
        return "F"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="API QA test agent")
    parser.add_argument("--mode", choices=["drf", "http"], default="drf")
    parser.add_argument("--repeat", type=int, default=1)
    parser.add_argument("--timeout-s", type=int, default=60)
    parser.add_argument(
        "--max-p95-ms",
        type=float,
        default=0.0,
        help="Fail with non-zero exit when report p95 latency exceeds this threshold. 0 disables gate.",
    )
    parser.add_argument(
        "--min-pass-rate",
        type=float,
        default=0.0,
        help="Fail with non-zero exit when pass_rate is below this threshold. 0 disables gate.",
    )
    parser.add_argument(
        "--min-overall-score",
        type=float,
        default=0.0,
        help="Fail with non-zero exit when overall score is below this threshold. 0 disables gate.",
    )

    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--dev-token", default=os.getenv("CPE_DEV_AUTH_TOKEN", "dev"))
    parser.add_argument(
        "--stub-external",
        action="store_true",
        help="Use deterministic stubs for Neo4j/OpenAI/Gemini dependencies (DRF mode only).",
    )

    parser.add_argument("--with-vision", action="store_true")
    parser.add_argument("--image-path", default="")

    parser.add_argument("--output-json", default="docs/reports/api_qa_report.json")
    parser.add_argument("--output-md", default="docs/reports/api_qa_report.md")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    agent = ApiQaAgent(args)
    report = agent.run()
    return 0 if report.get("gates", {}).get("passed", True) else 1


if __name__ == "__main__":
    raise SystemExit(main())
