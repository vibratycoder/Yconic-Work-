/**
 * Shared health option lists used by both onboarding and the edit-profile modal.
 *
 * Single source of truth — avoids duplicate arrays drifting apart.
 */

export const COMMON_CONDITIONS: string[] = [
  'Type 2 Diabetes', 'Prediabetes', 'Hypertension', 'High Cholesterol',
  'Asthma', 'COPD', 'Heart Disease', 'Atrial Fibrillation',
  'Hypothyroidism', 'Hyperthyroidism', 'Chronic Kidney Disease',
  'Anxiety', 'Depression', 'ADHD', 'Migraine',
  'Osteoarthritis', 'Rheumatoid Arthritis', 'Osteoporosis',
  'GERD / Acid Reflux', 'IBS', "Crohn's Disease", 'Ulcerative Colitis',
  'Sleep Apnea', 'Obesity', 'PCOS', 'Endometriosis',
];

export const COMMON_ALLERGIES: string[] = [
  'Penicillin', 'Amoxicillin', 'Sulfa drugs', 'Aspirin',
  'NSAIDs (ibuprofen/naproxen)', 'Codeine', 'Morphine',
  'Latex', 'Shellfish', 'Peanuts', 'Tree nuts',
  'Dairy', 'Eggs', 'Soy', 'Wheat / Gluten',
];
