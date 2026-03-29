"""Root-level entrypoint — re-exports the FastAPI app for Nixpacks/Railway detection."""
from backend.main import app  # noqa: F401

__all__ = ["app"]
