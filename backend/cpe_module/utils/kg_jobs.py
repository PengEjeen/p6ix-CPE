from __future__ import annotations

import os
import time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Callable
from uuid import uuid4


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class _JobRecord:
    job_id: str
    status: str
    submitted_at: str
    started_at: str | None = None
    finished_at: str | None = None
    result: dict[str, Any] | None = None
    error: str | None = None


_JOB_TTL_S = max(60, int(os.getenv("KG_ENRICH_JOB_TTL_S") or "3600"))
_JOB_MAX_RECORDS = max(20, int(os.getenv("KG_ENRICH_JOB_MAX_RECORDS") or "300"))
_JOB_WORKERS = max(1, int(os.getenv("KG_ENRICH_WORKERS") or "4"))

_executor = ThreadPoolExecutor(max_workers=_JOB_WORKERS, thread_name_prefix="kg-enrich")
_jobs_lock = Lock()
_jobs: OrderedDict[str, tuple[_JobRecord, float]] = OrderedDict()


def _prune_jobs_locked(now_ts: float) -> None:
    expired: list[str] = []
    for key, (_, finished_ts) in _jobs.items():
        if finished_ts <= 0:
            continue
        if (now_ts - finished_ts) > _JOB_TTL_S:
            expired.append(key)
    for key in expired:
        _jobs.pop(key, None)

    while len(_jobs) > _JOB_MAX_RECORDS:
        _jobs.popitem(last=False)


def _store_job_locked(record: _JobRecord, *, finished_ts: float) -> None:
    _jobs[record.job_id] = (record, finished_ts)
    _jobs.move_to_end(record.job_id)


def _snapshot(record: _JobRecord, *, include_result: bool) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "job_id": record.job_id,
        "status": record.status,
        "submitted_at": record.submitted_at,
        "started_at": record.started_at,
        "finished_at": record.finished_at,
        "error": record.error,
    }
    if include_result and record.result is not None:
        payload["result"] = deepcopy(record.result)
    return payload


def _set_status(job_id: str, *, status: str, started: bool = False, finished: bool = False, error: str | None = None) -> None:
    now_ts = time.time()
    with _jobs_lock:
        current = _jobs.get(job_id)
        if not current:
            return
        record, finished_ts = current
        record.status = status
        if started and record.started_at is None:
            record.started_at = _utc_now_iso()
        if finished:
            record.finished_at = _utc_now_iso()
            finished_ts = now_ts
        if error:
            record.error = error
        _store_job_locked(record, finished_ts=finished_ts)
        _prune_jobs_locked(now_ts)


def _set_result(job_id: str, *, result: dict[str, Any]) -> None:
    now_ts = time.time()
    with _jobs_lock:
        current = _jobs.get(job_id)
        if not current:
            return
        record, _ = current
        record.result = deepcopy(result)
        record.status = "completed"
        record.finished_at = _utc_now_iso()
        _store_job_locked(record, finished_ts=now_ts)
        _prune_jobs_locked(now_ts)


def submit_job(worker: Callable[[dict[str, Any]], dict[str, Any]], payload: dict[str, Any]) -> dict[str, Any]:
    """
    Submit async job. Returns queued job snapshot.
    """
    job_id = uuid4().hex
    record = _JobRecord(job_id=job_id, status="queued", submitted_at=_utc_now_iso())
    now_ts = time.time()
    with _jobs_lock:
        _store_job_locked(record, finished_ts=0.0)
        _prune_jobs_locked(now_ts)

    def _runner() -> None:
        _set_status(job_id, status="running", started=True)
        try:
            result = worker(payload)
            _set_result(job_id, result=result)
        except Exception as exc:  # pylint: disable=broad-except
            _set_status(
                job_id,
                status="failed",
                finished=True,
                error=str(exc)[:240] or "unknown",
            )

    _executor.submit(_runner)
    return {"job_id": job_id, "status": "queued", "submitted_at": record.submitted_at}


def get_job(job_id: str, *, include_result: bool = True) -> dict[str, Any] | None:
    now_ts = time.time()
    with _jobs_lock:
        _prune_jobs_locked(now_ts)
        current = _jobs.get(str(job_id or "").strip())
        if not current:
            return None
        record, _ = current
        return _snapshot(record, include_result=include_result)

