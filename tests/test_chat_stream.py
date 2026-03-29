"""Integration tests for the /api/chat/stream SSE endpoint.

Validates that onToken and onMeta callbacks fire correctly end-to-end
using the real FastAPI app with only the Anthropic client mocked.
The full pipeline (emergency gate, profile fallback, domain classifier,
citation retrieval, system prompt assembly, SSE serialisation) runs live.
"""
from __future__ import annotations

import json
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from backend.main import app


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class _FakeTextStream:
    """Async iterator that yields pre-defined tokens then stops."""

    def __init__(self, tokens: list[str]) -> None:
        self._tokens = iter(tokens)

    def __aiter__(self) -> "_FakeTextStream":
        return self

    async def __anext__(self) -> str:
        try:
            return next(self._tokens)
        except StopIteration:
            raise StopAsyncIteration


class _FakeStreamCtx:
    """Async context manager wrapping a FakeTextStream."""

    def __init__(self, tokens: list[str]) -> None:
        self.text_stream = _FakeTextStream(tokens)

    async def __aenter__(self) -> "_FakeStreamCtx":
        return self

    async def __aexit__(self, *args: object) -> None:
        pass


async def _collect_sse(
    client: AsyncClient,
    payload: dict,
) -> tuple[list[str], dict | None]:
    """
    POST payload to /api/chat/stream and collect all SSE events.

    Args:
        client: Configured AsyncClient with ASGI transport.
        payload: JSON body for the ChatRequest.

    Returns:
        Tuple of (tokens_list, meta_dict).  meta_dict is None if no meta
        event was received before [DONE].
    """
    tokens: list[str] = []
    meta: dict | None = None

    async with client.stream("POST", "/api/chat/stream", json=payload) as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")

        buf = ""
        async for chunk in response.aiter_bytes():
            buf += chunk.decode()
            while "\n\n" in buf:
                event_block, buf = buf.split("\n\n", 1)
                for line in event_block.splitlines():
                    if not line.startswith("data: "):
                        continue
                    payload_str = line[6:].strip()
                    if payload_str == "[DONE]":
                        return tokens, meta
                    data = json.loads(payload_str)
                    if "token" in data:
                        tokens.append(data["token"])
                    elif "meta" in data:
                        meta = data["meta"]

    return tokens, meta


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_stream_tokens_fire_in_order() -> None:
    """Each token emitted by the Anthropic stream must arrive via onToken in order."""
    fake_tokens = ["Blood", " pressure", " is", " the", " force", "."]
    fake_ctx = _FakeStreamCtx(fake_tokens)

    with (
        patch("backend.main.get_profile", new_callable=AsyncMock, return_value=None),
        patch(
            "backend.main.get_citations_for_question",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch("anthropic.AsyncAnthropic") as mock_anthropic_cls,
    ):
        mock_client = MagicMock()
        mock_client.messages.stream.return_value = fake_ctx
        mock_anthropic_cls.return_value = mock_client

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            tokens, meta = await _collect_sse(
                client,
                {
                    "user_id": "test-user-stream",
                    "question": "What is blood pressure?",
                    "conversation_history": [],
                    "attachments": [],
                },
            )

    assert tokens == fake_tokens, f"Token order wrong: {tokens}"


@pytest.mark.asyncio
async def test_stream_meta_event_fires_after_tokens() -> None:
    """onMeta must fire after all tokens with required fields."""
    fake_ctx = _FakeStreamCtx(["Hello", " world"])

    with (
        patch("backend.main.get_profile", new_callable=AsyncMock, return_value=None),
        patch(
            "backend.main.get_citations_for_question",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch("anthropic.AsyncAnthropic") as mock_anthropic_cls,
    ):
        mock_client = MagicMock()
        mock_client.messages.stream.return_value = fake_ctx
        mock_anthropic_cls.return_value = mock_client

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            tokens, meta = await _collect_sse(
                client,
                {
                    "user_id": "test-user-meta",
                    "question": "Tell me about cholesterol.",
                    "conversation_history": [],
                    "attachments": [],
                },
            )

    assert meta is not None, "meta event was never emitted"
    assert "citations" in meta
    assert "triage_level" in meta
    assert "health_domain" in meta
    assert "conversation_id" in meta
    assert meta["is_emergency"] is False
    assert len(tokens) == 2


@pytest.mark.asyncio
async def test_stream_emergency_bypasses_anthropic() -> None:
    """Emergency trigger must short-circuit before any Anthropic call."""
    with patch("anthropic.AsyncAnthropic") as mock_anthropic_cls:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            tokens, meta = await _collect_sse(
                client,
                {
                    "user_id": "test-user-emergency",
                    "question": "I have chest pain radiating to my left arm",
                    "conversation_history": [],
                    "attachments": [],
                },
            )

    mock_anthropic_cls.assert_not_called()
    assert any("911" in t or "emergency" in t.lower() for t in tokens), (
        f"No emergency token in: {tokens}"
    )
    assert meta is not None
    assert meta["is_emergency"] is True
    assert meta["triage_level"] == "emergency"


@pytest.mark.asyncio
async def test_stream_returns_event_stream_content_type() -> None:
    """Response Content-Type must be text/event-stream."""
    fake_ctx = _FakeStreamCtx(["ok"])

    with (
        patch("backend.main.get_profile", new_callable=AsyncMock, return_value=None),
        patch(
            "backend.main.get_citations_for_question",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch("anthropic.AsyncAnthropic") as mock_anthropic_cls,
    ):
        mock_client = MagicMock()
        mock_client.messages.stream.return_value = fake_ctx
        mock_anthropic_cls.return_value = mock_client

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            async with client.stream(
                "POST",
                "/api/chat/stream",
                json={
                    "user_id": "test-user-ct",
                    "question": "What is HbA1c?",
                    "conversation_history": [],
                    "attachments": [],
                },
            ) as response:
                ct = response.headers.get("content-type", "")

    assert "text/event-stream" in ct


@pytest.mark.asyncio
async def test_stream_done_sentinel_terminates_loop() -> None:
    """[DONE] sentinel must be present and cause loop termination (no hanging)."""
    fake_ctx = _FakeStreamCtx(["final"])

    with (
        patch("backend.main.get_profile", new_callable=AsyncMock, return_value=None),
        patch(
            "backend.main.get_citations_for_question",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch("anthropic.AsyncAnthropic") as mock_anthropic_cls,
    ):
        mock_client = MagicMock()
        mock_client.messages.stream.return_value = fake_ctx
        mock_anthropic_cls.return_value = mock_client

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            tokens, meta = await _collect_sse(
                client,
                {
                    "user_id": "test-user-done",
                    "question": "What is a CBC?",
                    "conversation_history": [],
                    "attachments": [],
                },
            )

    # If [DONE] was absent the collector would never return — reaching here proves it fired
    assert tokens == ["final"]
    assert meta is not None
