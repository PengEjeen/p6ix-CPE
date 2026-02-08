from __future__ import annotations

import time
from collections import OrderedDict
from copy import deepcopy
from dataclasses import dataclass
from threading import Lock
from typing import Any


@dataclass
class _CacheEntry:
    value: Any
    expires_at: float


class TTLCache:
    """
    Small thread-safe in-memory TTL + LRU cache.

    This cache is process-local by design. It is used to reduce repeated
    KG/OpenAI calls for identical requests within the same API worker.
    """

    def __init__(self, *, max_size: int = 256, ttl_s: int = 180) -> None:
        self.max_size = max(1, int(max_size))
        self.ttl_s = max(1, int(ttl_s))
        self._lock = Lock()
        self._store: OrderedDict[str, _CacheEntry] = OrderedDict()

    def get(self, key: str) -> tuple[bool, Any]:
        now = time.time()
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return False, None
            if entry.expires_at <= now:
                self._store.pop(key, None)
                return False, None
            # LRU touch
            self._store.move_to_end(key)
            return True, deepcopy(entry.value)

    def set(self, key: str, value: Any) -> None:
        now = time.time()
        expires_at = now + self.ttl_s
        with self._lock:
            self._store[key] = _CacheEntry(value=deepcopy(value), expires_at=expires_at)
            self._store.move_to_end(key)
            self._prune_locked(now)

    def _prune_locked(self, now: float) -> None:
        expired = [k for k, v in self._store.items() if v.expires_at <= now]
        for key in expired:
            self._store.pop(key, None)

        while len(self._store) > self.max_size:
            self._store.popitem(last=False)

