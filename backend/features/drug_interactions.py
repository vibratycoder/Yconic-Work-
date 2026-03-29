"""Drug interaction checking utilities."""
from __future__ import annotations
from backend.models.health_profile import Medication
from backend.utils.logger import get_logger

log = get_logger(__name__)

# Known high-risk interaction pairs (drug name fragments, lowercased)
KNOWN_INTERACTIONS: list[tuple[str, str, str]] = [
    ("warfarin", "aspirin", "Increased bleeding risk"),
    ("warfarin", "ibuprofen", "Increased bleeding risk"),
    ("warfarin", "naproxen", "Increased bleeding risk"),
    ("metformin", "alcohol", "Risk of lactic acidosis"),
    ("ssri", "tramadol", "Risk of serotonin syndrome"),
    ("maoi", "ssri", "Risk of serotonin syndrome — potentially fatal"),
    ("lithium", "ibuprofen", "NSAIDs may elevate lithium levels"),
    ("lithium", "naproxen", "NSAIDs may elevate lithium levels"),
    ("digoxin", "amiodarone", "Amiodarone increases digoxin toxicity risk"),
    ("methotrexate", "ibuprofen", "NSAIDs reduce methotrexate clearance — toxicity risk"),
    ("methotrexate", "naproxen", "NSAIDs reduce methotrexate clearance — toxicity risk"),
    ("lisinopril", "spironolactone", "ACE inhibitor + potassium-sparing diuretic — hyperkalemia risk"),
    ("enalapril", "spironolactone", "ACE inhibitor + potassium-sparing diuretic — hyperkalemia risk"),
    ("ramipril", "spironolactone", "ACE inhibitor + potassium-sparing diuretic — hyperkalemia risk"),
    ("ciprofloxacin", "antacid", "Antacids reduce fluoroquinolone absorption"),
    ("levofloxacin", "antacid", "Antacids reduce fluoroquinolone absorption"),
    ("atorvastatin", "fenofibrate", "Statin + fibrate — increased rhabdomyolysis risk"),
    ("simvastatin", "gemfibrozil", "Statin + fibrate — increased rhabdomyolysis risk"),
    ("rosuvastatin", "fenofibrate", "Statin + fibrate — increased rhabdomyolysis risk"),
]


def check_drug_interactions(
    medications: list[Medication],
    new_drug: str,
) -> list[str]:
    """
    Check for known interactions between a new drug and current medications.

    Performs simple substring matching against known interaction pairs.
    Not a substitute for clinical pharmacist review.

    Args:
        medications: User's current medication list
        new_drug: Name of new drug to check (case-insensitive)

    Returns:
        List of interaction warning strings. Empty if no interactions found.
    """
    warnings: list[str] = []
    new_lower = new_drug.lower()
    current_names = [m.name.lower() for m in medications]

    for drug_a, drug_b, description in KNOWN_INTERACTIONS:
        new_matches_a = drug_a in new_lower
        new_matches_b = drug_b in new_lower
        current_has_a = any(drug_a in name for name in current_names)
        current_has_b = any(drug_b in name for name in current_names)

        if (new_matches_a and current_has_b) or (new_matches_b and current_has_a):
            warnings.append(f"Potential interaction: {drug_a} + {drug_b} — {description}")

    if warnings:
        log.info("drug_interactions_found", new_drug=new_drug, count=len(warnings))
    return warnings
