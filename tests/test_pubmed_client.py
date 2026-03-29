"""Tests for PubMed evidence pipeline."""
from __future__ import annotations
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from backend.evidence.pubmed import (
    Citation, search_pubmed, fetch_abstracts, get_citations_for_question,
    _parse_pubmed_xml,
)
from backend.evidence.query_builder import classify_health_domain, build_pubmed_query


class TestCitation:
    """Test Citation dataclass properties."""

    def test_display_summary_truncates_long_title(self) -> None:
        """Titles over 80 chars must be truncated with ellipsis."""
        long_title = "A" * 100
        c = Citation(pmid="123", title=long_title, journal="JAMA",
                     year="2023", abstract="Abstract text")
        assert len(c.display_summary) < len(long_title) + 50
        assert "..." in c.display_summary

    def test_pubmed_url_format(self) -> None:
        """PubMed URL must include the PMID."""
        c = Citation(pmid="12345678", title="Title", journal="JAMA",
                     year="2023", abstract="Abstract")
        assert "12345678" in c.pubmed_url
        assert c.pubmed_url.startswith("https://pubmed")

    def test_to_prompt_block_contains_pmid(self) -> None:
        """Prompt block must include PMID for citation tracking."""
        c = Citation(pmid="99887766", title="Test Study", journal="NEJM",
                     year="2022", abstract="Key findings here.")
        block = c.to_prompt_block()
        assert "99887766" in block
        assert "Test Study" in block

    def test_abstract_truncated_in_prompt_block(self) -> None:
        """Abstract must be truncated at 1200 chars in prompt block."""
        long_abstract = "X" * 2000
        c = Citation(pmid="111", title="T", journal="J", year="2023",
                     abstract=long_abstract)
        block = c.to_prompt_block()
        assert len(block) < 2000


class TestDomainClassification:
    """Test health domain classification."""

    def test_cholesterol_classified_as_cardiology(self) -> None:
        """Cholesterol questions must map to cardiology domain."""
        domain = classify_health_domain("my LDL cholesterol is high")
        assert domain == "cardiology"

    def test_glucose_classified_as_endocrinology(self) -> None:
        """Blood glucose questions must map to endocrinology."""
        domain = classify_health_domain("my blood glucose keeps spiking")
        assert domain == "endocrinology"

    def test_headache_classified_as_neurology(self) -> None:
        """Headache questions must map to neurology."""
        domain = classify_health_domain("I've been getting bad headaches")
        assert domain == "neurology"

    def test_unknown_domain_falls_back_to_general(self) -> None:
        """Unrecognized topics must fall back to general."""
        domain = classify_health_domain("how much water should I drink")
        assert domain == "general"


class TestQueryBuilder:
    """Test PubMed query construction."""

    def test_query_contains_mesh_term(self) -> None:
        """Built query must include domain MeSH term."""
        query = build_pubmed_query("high LDL cholesterol risk", "cardiology")
        assert "MeSH" in query or "cardiovascular" in query

    def test_query_contains_humans_filter(self) -> None:
        """Query must filter to human studies."""
        query = build_pubmed_query("metformin prediabetes", "endocrinology")
        assert "humans" in query.lower()


class TestParseXml:
    """Test PubMed XML parsing."""

    def test_empty_xml_returns_empty_list(self) -> None:
        """Malformed or empty XML must return empty list gracefully."""
        result = _parse_pubmed_xml("<PubmedArticleSet></PubmedArticleSet>")
        assert result == []

    def test_invalid_xml_returns_empty_list(self) -> None:
        """Invalid XML must return empty list without raising."""
        result = _parse_pubmed_xml("not xml at all <<<")
        assert result == []
