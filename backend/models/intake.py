"""Intake and document data models."""
from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, Field


class DocumentUpload(BaseModel):
    """
    Uploaded health document metadata.

    Attributes:
        user_id: Owner user ID
        filename: Original filename
        storage_path: Supabase Storage path
        document_type: Category (lab_result, imaging, etc.)
        extracted_facts: Facts parsed from the document
    """
    user_id: str
    filename: str
    storage_path: str
    document_type: str | None = None
    extracted_facts: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
