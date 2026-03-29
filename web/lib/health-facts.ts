/**
 * Lifestyle fact categories — shared between EditProfileModal and HealthProfileSidebar.
 * Mirrors the sign-up questionnaire (onboarding/page.tsx step 5).
 */

export interface FactCategory {
  id: string;
  label: string;
  options: string[];
  /** If true, only one option in this group can be active at a time. */
  exclusive: boolean;
}

export const FACT_CATEGORIES: FactCategory[] = [
  {
    id: 'exercise',
    label: 'Exercise frequency',
    exclusive: true,
    options: [
      'Sedentary (little to no exercise)',
      'Light (1–2 days/week)',
      'Moderate (3–4 days/week)',
      'Active (5+ days/week)',
      'Very active (athlete / physical job)',
    ],
  },
  {
    id: 'sleep',
    label: 'Average sleep',
    exclusive: true,
    options: [
      'Less than 5 hours',
      '5–6 hours',
      '6–7 hours',
      '7–8 hours',
      '8+ hours',
    ],
  },
  {
    id: 'smoking',
    label: 'Smoking status',
    exclusive: true,
    options: [
      'Never smoked',
      'Former smoker (quit)',
      'Current smoker',
      'Vape / e-cigarette',
    ],
  },
  {
    id: 'alcohol',
    label: 'Alcohol use',
    exclusive: true,
    options: [
      'None',
      'Occasionally (1–2x/month)',
      'Socially (1–2x/week)',
      'Regularly (3–5x/week)',
      'Daily',
    ],
  },
  {
    id: 'goals',
    label: 'Health goals',
    exclusive: false,
    options: [
      'Understand my lab results',
      'Manage a chronic condition better',
      'Prepare for doctor visits',
      'Track medications and side effects',
      'Improve sleep quality',
      'Lose weight / improve fitness',
      'Reduce stress and anxiety',
      'Monitor heart health',
      'Control blood sugar',
      'Improve diet and nutrition',
    ],
  },
];

/** Flat array of all known baseline option strings (for membership checks). */
export const ALL_BASELINE_FACTS: readonly string[] = FACT_CATEGORIES.flatMap((c) => c.options);
