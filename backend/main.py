"""Pulse FastAPI backend — all routes."""
from __future__ import annotations
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator
import anthropic
from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from backend.health.injector import check_emergency, build_health_system_prompt
from backend.health.profile import get_profile, upsert_profile
from backend.health.updater import update_profile_from_conversation
from backend.evidence.pubmed import get_citations_for_question
from backend.evidence.query_builder import classify_health_domain
from backend.evidence.citation_formatter import format_citation_list
from backend.intake.lab_ocr import extract_lab_results_from_image
from backend.intake.document_classifier import classify_document
from backend.intake.healthkit_sync import process_healthkit_payload
from backend.features.lab_rater import rate_lab_results
from backend.features.visit_prep import generate_visit_summary
from backend.features.drug_interactions import check_drug_interactions
from backend.models.health_profile import HealthProfile, Medication
from backend.utils.logger import get_logger

load_dotenv()
log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    FastAPI lifespan handler — startup and shutdown logic.

    Args:
        app: The FastAPI application instance

    Yields:
        None during application lifetime.
    """
    log.info("pulse_startup", version="0.1.0")
    yield
    log.info("pulse_shutdown")


app = FastAPI(
    title="Pulse API",
    version="0.1.0",
    description="AI health co-pilot backend",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class AttachmentPayload(BaseModel):
    """
    Base64-encoded image attachment from the client.

    Attributes:
        media_type: MIME type, e.g. 'image/jpeg'
        data: Base64-encoded image bytes
    """
    media_type: str
    data: str


class ChatRequest(BaseModel):
    """
    Incoming chat request from the client.

    Attributes:
        user_id: Supabase auth user ID
        message: User's current message
        attachments: Optional base64-encoded images for vision
        conversation_history: Prior messages in this session
    """
    user_id: str
    question: str = ""
    message: str = ""
    conversation_id: str | None = None
    conversation_history: list[dict[str, str]] = Field(default_factory=list)
    attachments: list[AttachmentPayload] = Field(default_factory=list)

    def get_text(self) -> str:
        """Return whichever of question/message was provided."""
        return self.question or self.message


class ChatResponse(BaseModel):
    """
    Chat response returned to the client.

    Attributes:
        answer: Claude's response text
        citations: PubMed citations used in the response
        health_domain: Classified medical domain
        is_emergency: True if emergency was detected
        triage_level: Urgency classification string
    """
    conversation_id: str = ""
    answer: str
    citations: list[dict] = Field(default_factory=list)
    health_domain: str = "general"
    is_emergency: bool = False
    triage_level: str = "informational"


class HealthkitPayload(BaseModel):
    """Raw HealthKit payload from mobile app."""
    user_id: str
    data: dict


class DrugCheckRequest(BaseModel):
    """
    Drug interaction check request.

    Attributes:
        user_id: Supabase auth user ID
        new_drug: Name of drug to check against current medications
    """
    user_id: str
    new_drug: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_attachment_prompt(user_text: str, attachments: list[AttachmentPayload]) -> str:
    """
    Build a directive text prompt that connects attached files to the user's question.

    Instead of forwarding the raw question alongside the files, this frames the
    request so Claude knows exactly what to extract from each attachment and how
    to relate those findings back to the user's question.

    Args:
        user_text: The user's question or message (may be empty).
        attachments: List of attached files included in this message.

    Returns:
        A structured prompt string to append as the final content block.
    """
    pdf_count = sum(1 for a in attachments if a.media_type == "application/pdf")
    image_count = len(attachments) - pdf_count

    if pdf_count and image_count:
        doc_desc = (
            f"{pdf_count} PDF document{'s' if pdf_count > 1 else ''} "
            f"and {image_count} image{'s' if image_count > 1 else ''}"
        )
    elif pdf_count:
        doc_desc = f"{pdf_count} PDF document{'s' if pdf_count > 1 else ''}"
    else:
        doc_desc = f"{image_count} image{'s' if image_count > 1 else ''}"

    if user_text:
        return (
            f"I have attached {doc_desc}.\n\n"
            f"My question: {user_text}\n\n"
            "Please examine every attached file thoroughly, extract all health-relevant "
            "findings, and answer my question using the specific data in the attachments — "
            "cross-referenced against my health profile."
        )
    return (
        f"I have attached {doc_desc}.\n\n"
        "Please examine every attached file thoroughly, extract all health-relevant "
        "findings (values, dates, reference ranges, flags), and provide a detailed "
        "analysis cross-referenced against my health profile."
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check() -> dict[str, str]:
    """
    Health check endpoint for load balancer and CI verification.

    Returns:
        Status dict with 'status' key set to 'ok'.
    """
    return {"status": "ok"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
) -> ChatResponse:
    """
    Main chat endpoint — the core Pulse interaction loop.

    Flow:
    1. check_emergency() — deterministic safety gate, no LLM
    2. Load HealthProfile from Supabase
    3. Classify health domain
    4. Fetch PubMed citations
    5. Build system prompt with profile + citations
    6. Call Claude claude-sonnet-4-6
    7. Return answer + citations
    8. Background: update profile facts

    Args:
        request: ChatRequest with user_id, message, and conversation history
        background_tasks: FastAPI background task runner

    Returns:
        ChatResponse with answer, citations, and triage metadata.

    Raises:
        HTTPException: 500 on Anthropic API or Supabase failure.
    """
    # Step 1: Emergency gate — no LLM, no exceptions
    emergency_response = check_emergency(request.get_text())
    if emergency_response:
        log.info("chat_emergency_escalated", user_id=request.user_id)
        return ChatResponse(
            answer=emergency_response,
            is_emergency=True,
            triage_level="emergency",
        )

    # Step 2: Load health profile
    try:
        profile = await get_profile(request.user_id)
    except Exception as exc:
        log.error("chat_profile_load_failed", user_id=request.user_id, error=str(exc))
        profile = None

    if profile is None:
        profile = HealthProfile(user_id=request.user_id, display_name="")

    # Step 3: Classify domain
    health_domain = classify_health_domain(request.get_text())
    log.info("chat_domain_classified", user_id=request.user_id, domain=health_domain)

    # Step 4: Fetch PubMed citations
    citations = await get_citations_for_question(request.get_text(), health_domain)

    # Step 5: Build system prompt — pass attachment count so Claude gets file-specific guidance
    system_prompt = build_health_system_prompt(profile, citations, len(request.attachments))

    # Step 6: Build messages for Claude
    # If files are attached, build a multi-modal content block
    messages: list[dict] = list(request.conversation_history)
    if request.attachments:
        content: list[dict] = []
        for att in request.attachments:
            if att.media_type == "application/pdf":
                content.append({
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": att.data,
                    },
                })
            else:
                content.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": att.media_type,
                        "data": att.data,
                    },
                })
        content.append({"type": "text", "text": _build_attachment_prompt(request.get_text(), request.attachments)})
        messages.append({"role": "user", "content": content})
    else:
        messages.append({"role": "user", "content": request.get_text()})

    # Step 7: Call Claude
    try:
        client = anthropic.AsyncAnthropic()
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=system_prompt,
            messages=messages,
        )
        answer = response.content[0].text
    except anthropic.AuthenticationError as exc:
        log.error("chat_anthropic_auth_failed", user_id=request.user_id, error=str(exc))
        raise HTTPException(status_code=500, detail="AI service authentication error — check ANTHROPIC_API_KEY")
    except (anthropic.APIError, Exception) as exc:
        log.error("chat_anthropic_failed", user_id=request.user_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Please try again momentarily")

    # Build citation dicts for response
    citation_dicts = [
        {
            "pmid": c.pmid,
            "title": c.title,
            "journal": c.journal,
            "year": c.year,
            "authors": c.authors,
            "pubmed_url": c.pubmed_url,
            "display_summary": c.display_summary,
        }
        for c in citations
    ]

    # Step 8: Background profile update
    full_conversation = list(request.conversation_history) + [
        {"role": "user", "content": request.get_text()},
        {"role": "assistant", "content": answer},
    ]
    background_tasks.add_task(
        update_profile_from_conversation,
        request.user_id,
        full_conversation,
    )

    # Determine triage level for UI
    from backend.features.triage import classify_triage_level
    triage = classify_triage_level(request.get_text())

    log.info("chat_complete", user_id=request.user_id, domain=health_domain,
             citations=len(citations), triage=triage.value)

    import uuid as _uuid
    return ChatResponse(
        conversation_id=request.conversation_id or str(_uuid.uuid4()),
        answer=answer,
        citations=citation_dicts,
        health_domain=health_domain,
        is_emergency=False,
        triage_level=triage.value,
    )


@app.get("/api/profile/{user_id}", response_model=HealthProfile)
async def get_health_profile(user_id: str) -> HealthProfile:
    """
    Retrieve a user's health profile.

    Args:
        user_id: Supabase auth user ID

    Returns:
        HealthProfile for the user.

    Raises:
        HTTPException: 404 if profile not found, 500 on DB error.
    """
    try:
        profile = await get_profile(user_id)
    except Exception as exc:
        log.error("profile_get_failed", user_id=user_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to retrieve profile")
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@app.post("/api/profile", response_model=HealthProfile)
async def create_health_profile(profile: HealthProfile) -> HealthProfile:
    """
    Create or update a user's health profile (upsert).

    Used by sign-up and onboarding flows where user_id is in the request body.

    Args:
        profile: HealthProfile with user_id in body

    Returns:
        Saved HealthProfile.

    Raises:
        HTTPException: 500 on DB error.
    """
    try:
        saved = await upsert_profile(profile)
    except Exception as exc:
        log.error("profile_create_failed", user_id=profile.user_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to save profile")
    return saved


@app.put("/api/profile/{user_id}", response_model=HealthProfile)
async def update_health_profile(user_id: str, profile: HealthProfile) -> HealthProfile:
    """
    Create or update a user's health profile.

    Args:
        user_id: Supabase auth user ID (must match profile.user_id)
        profile: Updated HealthProfile data

    Returns:
        Saved HealthProfile.

    Raises:
        HTTPException: 400 if user_id mismatch, 500 on DB error.
    """
    if profile.user_id != user_id:
        raise HTTPException(status_code=400, detail="user_id mismatch")
    try:
        saved = await upsert_profile(profile)
    except Exception as exc:
        log.error("profile_update_failed", user_id=user_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to update profile")
    return saved


@app.post("/api/labs/scan")
async def upload_lab_image(
    user_id: str = Form(...),
    file: UploadFile = File(...),
) -> dict:
    """
    Upload a lab result image for OCR extraction with personalized ratings.

    Extracts lab values using Claude Vision, then rates each result as
    High / Normal / Low against demographic-adjusted reference ranges
    sourced from the user's health profile.

    Args:
        user_id: Supabase auth user ID
        file: Uploaded image file (JPEG, PNG)

    Returns:
        Dict with 'results' (raw LabResult dicts), 'rated_results'
        (RatedLabResult dicts with High/Normal/Low), 'extracted_results'
        (alias for results), 'abnormal_count', 'total_count', and
        'import_summary' string.

    Raises:
        HTTPException: 400 on unsupported file type, 500 on extraction failure.
    """
    supported_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in supported_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Use JPEG or PNG.",
        )
    try:
        image_bytes = await file.read()
        results = await extract_lab_results_from_image(image_bytes, file.content_type or "image/jpeg")

        # Load user profile for personalized range computation
        profile = None
        try:
            profile = await get_profile(user_id)
        except Exception as exc:
            log.warning("lab_scan_profile_load_failed", user_id=user_id, error=str(exc))

        rated = rate_lab_results(
            results,
            age=profile.age if profile else None,
            sex=profile.sex if profile else None,
            weight_kg=profile.weight_kg if profile else None,
            height_cm=profile.height_cm if profile else None,
        )

        abnormal_count = sum(1 for r in rated if r.rating.value in ("High", "Low"))
        total_count = len(rated)
        import_summary = (
            f"Imported {total_count} lab result{'s' if total_count != 1 else ''}. "
            f"{abnormal_count} outside normal range."
        )

        log.info("lab_upload_complete", user_id=user_id, results_count=total_count,
                 abnormal_count=abnormal_count)
        return {
            "results": [r.model_dump() for r in results],
            "extracted_results": [r.model_dump() for r in results],
            "rated_results": [r.model_dump() for r in rated],
            "abnormal_count": abnormal_count,
            "total_count": total_count,
            "import_summary": import_summary,
        }
    except anthropic.APIError as exc:
        log.error("lab_ocr_api_failed", user_id=user_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Lab extraction service temporarily unavailable")


@app.post("/api/documents/analyze")
async def analyze_document(
    user_id: str = Form(...),
    file: UploadFile = File(...),
) -> dict:
    """
    Analyze an uploaded document, classify its type, and extract bloodwork if present.

    Pipeline:
    1. classify_document() — determines whether the file contains blood lab results
    2. If not bloodwork — returns classification only (is_bloodwork: False)
    3. If bloodwork — extract lab results via Claude Vision OCR
    4. Load user profile for demographic-adjusted reference ranges
    5. Rate each result as High / Normal / Low using personalized ranges
    6. Return full structured response for routing to the bloodwork tab

    Supports JPEG, PNG, WebP, GIF, and PDF uploads.

    Args:
        user_id: Supabase auth user ID
        file: Uploaded document file

    Returns:
        Dict with:
          - is_bloodwork (bool)
          - document_type (str)
          - confidence (float)
          - detected_panels (list[str])
          - rated_results (list[RatedLabResult] — only if bloodwork)
          - abnormal_count (int — only if bloodwork)
          - total_count (int — only if bloodwork)
          - import_summary (str — only if bloodwork)

    Raises:
        HTTPException: 400 on unsupported file type, 500 on extraction failure.
    """
    supported_types = {
        "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf",
    }
    if file.content_type not in supported_types:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type: {file.content_type}. "
                "Use JPEG, PNG, WebP, GIF, or PDF."
            ),
        )

    try:
        file_bytes = await file.read()
    except Exception as exc:
        log.error("document_analyze_read_failed", user_id=user_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to read uploaded file")

    # Step 1 — classify
    try:
        classification = await classify_document(
            file_bytes,
            media_type=file.content_type or "application/octet-stream",
            filename=file.filename or "",
        )
    except anthropic.APIError as exc:
        log.error("document_classify_api_failed", user_id=user_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Document classification service temporarily unavailable")

    base_response: dict = {
        "is_bloodwork": classification.is_bloodwork,
        "document_type": classification.document_type.value,
        "confidence": classification.confidence,
        "detected_panels": classification.detected_panels,
    }

    if not classification.is_bloodwork:
        log.info(
            "document_analyze_not_bloodwork",
            user_id=user_id,
            document_type=classification.document_type.value,
        )
        return base_response

    # Step 2 — OCR extraction (only for image types; skip for PDFs without image content)
    image_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in image_types:
        log.info("document_analyze_pdf_no_ocr", user_id=user_id)
        return {**base_response, "rated_results": [], "abnormal_count": 0,
                "total_count": 0, "import_summary": "PDF classified as bloodwork — scan as image for result extraction."}

    try:
        raw_results = await extract_lab_results_from_image(
            file_bytes, file.content_type or "image/jpeg",
        )
    except anthropic.APIError as exc:
        log.error("document_analyze_ocr_failed", user_id=user_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Lab extraction service temporarily unavailable")

    # Step 3 — load profile for personalized ranges
    profile = None
    try:
        profile = await get_profile(user_id)
    except Exception as exc:
        log.warning("document_analyze_profile_load_failed", user_id=user_id, error=str(exc))

    # Step 4 — rate with personalized ranges
    rated = rate_lab_results(
        raw_results,
        age=profile.age if profile else None,
        sex=profile.sex if profile else None,
        weight_kg=profile.weight_kg if profile else None,
        height_cm=profile.height_cm if profile else None,
    )

    abnormal_count = sum(1 for r in rated if r.rating.value in ("High", "Low"))
    total_count = len(rated)
    import_summary = (
        f"Imported {total_count} lab result{'s' if total_count != 1 else ''} "
        f"({', '.join(classification.detected_panels) or 'bloodwork'}). "
        f"{abnormal_count} outside your personalized normal range."
    )

    log.info(
        "document_analyze_complete",
        user_id=user_id,
        document_type=classification.document_type.value,
        panels=classification.detected_panels,
        total=total_count,
        abnormal=abnormal_count,
    )

    return {
        **base_response,
        "rated_results": [r.model_dump() for r in rated],
        "abnormal_count": abnormal_count,
        "total_count": total_count,
        "import_summary": import_summary,
    }


@app.post("/api/healthkit/sync")
async def sync_healthkit(payload: HealthkitPayload) -> dict:
    """
    Sync HealthKit data from the mobile app.

    Processes the payload, computes 7-day averages, and updates the
    user's wearable summary in Supabase.

    Args:
        payload: HealthkitPayload with user_id and raw HealthKit data dict

    Returns:
        Dict with computed WearableSummary.

    Raises:
        HTTPException: 500 on processing or Supabase failure.
    """
    try:
        summary = await process_healthkit_payload(payload.user_id, payload.data)
        return {"summary": summary.model_dump()}
    except Exception as exc:
        log.error("healthkit_sync_failed", user_id=payload.user_id, error=str(exc))
        raise HTTPException(status_code=500, detail="HealthKit sync failed")


@app.get("/api/visit-prep/{user_id}")
async def visit_prep(user_id: str) -> dict:
    """
    Generate a doctor visit preparation summary for the user.

    Args:
        user_id: Supabase auth user ID

    Returns:
        Dict with VisitSummary fields and full_text.

    Raises:
        HTTPException: 404 if profile not found, 500 on generation failure.
    """
    try:
        profile = await get_profile(user_id)
    except Exception as exc:
        log.error("visit_prep_profile_failed", user_id=user_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to load profile")
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    try:
        summary = await generate_visit_summary(profile)
        return summary.model_dump()
    except anthropic.APIError as exc:
        log.error("visit_prep_api_failed", user_id=user_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Visit prep generation failed")


@app.post("/api/drug-check")
async def drug_interaction_check(request: DrugCheckRequest) -> dict:
    """
    Check a new drug for interactions with the user's current medications.

    Args:
        request: DrugCheckRequest with user_id and new_drug name

    Returns:
        Dict with 'warnings' list of interaction strings.

    Raises:
        HTTPException: 404 if profile not found, 500 on DB error.
    """
    try:
        profile = await get_profile(request.user_id)
    except Exception as exc:
        log.error("drug_check_profile_failed", user_id=request.user_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to load profile")
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    warnings = check_drug_interactions(profile.current_medications, request.new_drug)
    return {"warnings": warnings, "new_drug": request.new_drug}
