"""Structured logging configuration for Pulse backend."""
from __future__ import annotations
import structlog


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """
    Return a structured logger bound to the given module name.

    Args:
        name: Module name, typically __name__

    Returns:
        Configured structlog BoundLogger instance.
    """
    return structlog.get_logger(name)
