"""Health RAG package — multi-source academic evidence retrieval for Pulse.

Public API:
    retrieve_health_evidence(question, patient_context, max_results) -> HealthRAGResult
    inject_evidence_into_system_prompt(base_system_prompt, rag_result) -> str
    build_evidence_block(papers) -> str
    rank_papers(papers, max_results) -> list[RankedPaper]
    expand_query(question, patient_context) -> list[str]
"""
from backend.rag.health_rag import HealthRAGResult, inject_evidence_into_system_prompt, retrieve_health_evidence
from backend.rag.context_builder import build_evidence_block
from backend.rag.reranker import RankedPaper, rank_papers
from backend.rag.query_expander import expand_query

__all__ = [
    "retrieve_health_evidence",
    "inject_evidence_into_system_prompt",
    "HealthRAGResult",
    "build_evidence_block",
    "rank_papers",
    "RankedPaper",
    "expand_query",
]
