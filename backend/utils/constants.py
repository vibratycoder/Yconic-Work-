"""Centralised constants for the Pulse backend.

Import from here instead of hard-coding model names, token limits, or
timeout values inline.  A single change here propagates everywhere.
"""
from __future__ import annotations

# ---------------------------------------------------------------------------
# Anthropic model identifiers
# ---------------------------------------------------------------------------

CLAUDE_SONNET: str = "claude-sonnet-4-6"
"""Production reasoning model used for chat, visit prep, and OCR tasks."""

CLAUDE_HAIKU: str = "claude-haiku-4-5-20251001"
"""Fast / cheap model used for lightweight tasks such as query expansion."""

# ---------------------------------------------------------------------------
# Token budgets
# ---------------------------------------------------------------------------

MAX_TOKENS_DEFAULT: int = 1024
"""Default max_tokens for standard chat responses."""

MAX_TOKENS_VISIT_PREP: int = 1024
"""Max tokens for visit-prep summaries (kept at one printed page)."""

MAX_TOKENS_QUERY_EXPAND: int = 256
"""Max tokens for the 3-query expansion call (short output expected)."""

# ---------------------------------------------------------------------------
# HTTP / retry configuration
# ---------------------------------------------------------------------------

TIMEOUT_SECONDS: int = 12
"""Default aiohttp request timeout in seconds for all RAG source clients."""

MAX_RETRIES: int = 3
"""Maximum retry attempts (tenacity) for external HTTP calls."""

# ---------------------------------------------------------------------------
# RAG pipeline
# ---------------------------------------------------------------------------

RAG_TOP_K: int = 10
"""Maximum number of ranked papers passed to the context builder."""

PAPERS_PER_SOURCE: int = 10
"""Candidate papers fetched per source per expanded query."""
