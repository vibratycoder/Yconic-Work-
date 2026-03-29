"""PubMed query building and health domain classification."""
from __future__ import annotations

DOMAIN_KEYWORDS: dict[str, list[str]] = {
    "cardiology": ["heart", "cardiac", "chest pain", "blood pressure", "hypertension",
                   "cholesterol", "ldl", "hdl", "triglyceride", "arrhythmia", "afib",
                   "ecg", "ekg", "coronary", "atherosclerosis", "lipid"],
    "endocrinology": ["diabetes", "glucose", "insulin", "hba1c", "thyroid", "tsh",
                      "t3", "t4", "prediabetes", "metabolic", "hormone", "cortisol",
                      "adrenal", "pituitary"],
    "gastroenterology": ["stomach", "gut", "bowel", "ibs", "crohn", "colitis",
                          "gerd", "acid reflux", "liver", "hepatitis", "gallbladder",
                          "pancreas", "nausea", "diarrhea", "constipation"],
    "neurology": ["headache", "migraine", "dizzy", "dizziness", "memory", "cognitive",
                   "seizure", "tremor", "numbness", "tingling", "multiple sclerosis",
                   "parkinson", "stroke", "tia"],
    "pulmonology": ["lung", "breathing", "asthma", "copd", "bronchitis", "pneumonia",
                     "oxygen", "inhaler", "spirometry", "sleep apnea", "respiratory"],
    "nephrology": ["kidney", "renal", "creatinine", "egfr", "protein urine",
                    "dialysis", "ckd", "chronic kidney"],
    "hematology": ["blood count", "cbc", "anemia", "hemoglobin", "platelet",
                    "white blood cell", "wbc", "rbc", "iron", "ferritin"],
    "mental_health": ["anxiety", "depression", "mental health", "sleep", "insomnia",
                      "mood", "panic", "stress", "adhd", "bipolar", "ssri", "antidepressant"],
    "oncology": ["cancer", "tumor", "tumour", "chemotherapy", "radiation", "biopsy",
                 "oncology", "lymphoma", "leukemia", "carcinoma", "melanoma", "metastasis",
                 "mastectomy", "immunotherapy"],
    "orthopedics": ["joint", "knee", "hip", "back pain", "spine", "arthritis",
                     "bone", "fracture", "tendon", "ligament"],
    "general": [],
}

DOMAIN_MESH_TERMS: dict[str, str] = {
    "cardiology": "cardiovascular diseases[MeSH]",
    "endocrinology": "endocrine system diseases[MeSH]",
    "gastroenterology": "gastrointestinal diseases[MeSH]",
    "neurology": "nervous system diseases[MeSH]",
    "pulmonology": "respiratory tract diseases[MeSH]",
    "nephrology": "kidney diseases[MeSH]",
    "hematology": "hematologic diseases[MeSH]",
    "mental_health": "mental disorders[MeSH]",
    "oncology": "neoplasms[MeSH]",
    "orthopedics": "musculoskeletal diseases[MeSH]",
    "general": "medicine[MeSH]",
}


def classify_health_domain(question: str) -> str:
    """
    Classify a health question into a medical domain for query optimization.

    Uses keyword matching against domain-specific term lists.
    Falls back to 'general' if no domain matches.

    Args:
        question: User's health question in natural language

    Returns:
        Domain string (e.g. 'cardiology', 'endocrinology', 'general').
    """
    question_lower = question.lower()
    scores: dict[str, int] = {}
    for domain, keywords in DOMAIN_KEYWORDS.items():
        if domain == "general":
            continue
        scores[domain] = sum(1 for kw in keywords if kw in question_lower)
    best = max(scores, key=lambda d: scores[d], default="general")
    return best if scores.get(best, 0) > 0 else "general"


def build_pubmed_query(question: str, health_domain: str) -> str:
    """
    Build an optimized PubMed search query for a health question.

    Extracts key medical terms from the question, combines with
    domain MeSH terms, and adds recency filter for relevance.

    Args:
        question: User's health question in natural language
        health_domain: Classified domain from classify_health_domain

    Returns:
        Optimized PubMed query string ready for esearch API.
    """
    # Extract meaningful terms (4+ chars, skip common words)
    stop_words = {
        "what", "when", "where", "which", "while", "with", "your", "this",
        "that", "have", "from", "they", "will", "been", "does", "some",
        "about", "should", "could", "would", "their", "there", "were",
        "more", "also", "into", "than", "just", "like", "know", "mean",
    }
    words = [
        w.strip("?.,!;:\"'()[]")
        for w in question.lower().split()
        if len(w) > 3 and w not in stop_words
    ]
    # Keep top 5 terms to avoid over-constraining the query
    key_terms = words[:5]
    mesh_term = DOMAIN_MESH_TERMS.get(health_domain, "medicine[MeSH]")
    term_str = " AND ".join(f'"{t}"' for t in key_terms) if key_terms else question[:50]
    return f"({term_str}) AND {mesh_term} AND humans[MeSH] AND (\"last 5 years\"[PDat])"
