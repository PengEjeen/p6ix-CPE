from __future__ import annotations

import json
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def _read_http_error(err: HTTPError) -> str:
    try:
        body = err.read().decode("utf-8", errors="replace")
    except Exception:
        body = ""
    return body


def chat_completion(
    prompt: str,
    *,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    timeout_s: int = 30,
) -> str:
    """
    Minimal OpenAI Chat Completions client (no third-party dependency).

    Env:
      - OPENAI_API_KEY (required)
      - OPENAI_BASE_URL (optional, default: https://api.openai.com/v1)
      - OPENAI_CHAT_MODEL (optional, default: gpt-4o-mini)
    """
    messages: list[dict[str, Any]] = [{"role": "user", "content": prompt}]
    return chat_completion_messages(
        messages,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout_s=timeout_s,
    )


def chat_completion_messages(
    messages: list[dict[str, Any]],
    *,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    timeout_s: int = 30,
    response_format: dict[str, Any] | None = None,
) -> str:
    """
    OpenAI Chat Completions client that supports structured/multimodal messages.

    `messages` follows the Chat Completions schema.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    base_url = (os.getenv("OPENAI_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
    model = model or os.getenv("OPENAI_CHAT_MODEL") or "gpt-4o-mini"
    if temperature is None:
        try:
            temperature = float(os.getenv("OPENAI_TEMPERATURE") or "0.2")
        except ValueError:
            temperature = 0.2

    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if max_tokens is not None:
        payload["max_tokens"] = int(max_tokens)
    if response_format is not None:
        payload["response_format"] = response_format

    req = Request(
        f"{base_url}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urlopen(req, timeout=timeout_s) as resp:
            raw = resp.read().decode("utf-8")
        body = json.loads(raw)
    except HTTPError as e:
        details = _read_http_error(e)
        raise RuntimeError(f"OpenAI HTTPError {e.code}: {details}") from e
    except (URLError, TimeoutError) as e:
        raise RuntimeError(f"OpenAI request failed: {e}") from e
    except ValueError as e:
        raise RuntimeError("OpenAI response JSON parse failed") from e

    try:
        content = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"Unexpected OpenAI response shape: {body}") from e

    if isinstance(content, str):
        return content
    # Extremely defensive: some gateways may return a structured content.
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, dict) and "text" in part:
                parts.append(str(part["text"]))
        if parts:
            return "\n".join(parts)
    return str(content)
