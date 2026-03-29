# Onboarding Flow

## Overview

The onboarding flow collects the user's initial health profile across 5 steps. It runs once after account creation before the user reaches the main application screens. The completed profile is submitted to `POST /api/profile` and powers all subsequent personalised responses.

The flow is implemented in two platforms:

| Platform | File |
|----------|------|
| Web | `web/app/onboarding/page.tsx` |
| Mobile | `mobile/app/(auth)/onboarding.tsx` |

---

## Step Structure

| Step | Title | Content Collected |
|------|-------|-----------------|
| 0 | Welcome | Name, age, sex, height, weight |
| 1 | Health background | Conditions, allergies |
| 2 | Current medications | Medication name, dose, frequency |
| 3 | Lifestyle & habits | FACT_CATEGORIES toggle pills |
| 4 | Review / Almost done | Confirmation before submit |

---

## Step 0 — Welcome / Demographics

**Web title:** Welcome screen with app intro + `OnboardingData` form fields

**Mobile title:** "Welcome to Sana Health"

### Fields Collected

| Field | Type | Notes |
|-------|------|-------|
| `display_name` | Text | User's preferred first name |
| `age` | Number | Stored as `int` in profile |
| `sex` | Select | `"male"` or `"female"` |
| `height_ft` + `height_in` | Numbers | Converted to `height_cm` on submit |
| `weight_lbs` | Number | Converted to `weight_kg` on submit |

Height conversion: `height_cm = (feet × 12 + inches) × 2.54`
Weight conversion: `weight_kg = lbs / 2.205`

---

## Step 1 — Health Background

### Conditions

The web onboarding shows `COMMON_CONDITIONS` as a grid of toggle chips:

```
Type 2 Diabetes, Prediabetes, Hypertension, High Cholesterol,
Asthma, COPD, Heart Disease, Atrial Fibrillation,
Hypothyroidism, Hyperthyroidism, Chronic Kidney Disease,
Anxiety, Depression, ADHD, Migraine,
Osteoarthritis, Rheumatoid Arthritis, Osteoporosis,
GERD / Acid Reflux, IBS, Crohn's Disease, Ulcerative Colitis,
Sleep Apnea, Obesity, PCOS, Endometriosis
```

A free-text "Add other condition" input allows custom entries. Selected conditions are stored as `conditions: string[]`.

The mobile onboarding uses a plain text input (`conditions: string`) which is split on commas at submit time.

### Allergies

The web onboarding shows `COMMON_ALLERGIES` as toggle chips:

```
Penicillin, Amoxicillin, Sulfa drugs, Aspirin,
NSAIDs (ibuprofen/naproxen), Codeine, Morphine,
Latex, Shellfish, Peanuts, Tree nuts,
Dairy, Eggs, Soy, Wheat / Gluten
```

A free-text "Add other allergy" input allows custom entries. The mobile onboarding uses a plain text input.

---

## Step 2 — Current Medications

The user adds medications one at a time using an inline form:

| Field | Description |
|-------|-------------|
| `med_name` | Generic or brand drug name |
| `med_dose` + `med_dose_unit` | Dose amount and unit (`mg`, `mcg`, `g`, `mL`, `units`, `IU`) |
| `med_frequency_times` | How often taken (`once daily`, `twice daily`, etc.) |

Tapping "Add medication" appends a `Medication` object to `medications[]` and clears the form. Added medications are displayed as a list with a remove button. The user may add 0 or more medications before proceeding.

---

## Step 3 — Lifestyle & Habits (FACT_CATEGORIES)

This step renders toggle pills organised by category. The categories and their options are defined identically in both web and mobile.

### FACT_CATEGORIES Source of Truth

The canonical definition lives in **`web/lib/health-facts.ts`**. The mobile app defines the same categories inline in `mobile/app/(auth)/onboarding.tsx`. Both must remain in sync.

### Categories

| Category | Exclusive | Options |
|----------|-----------|---------|
| Exercise frequency | Yes (pick one) | Sedentary (little to no exercise), Light (1–2 days/week), Moderate (3–4 days/week), Active (5+ days/week), Very active (athlete / physical job) |
| Average sleep | Yes (pick one) | Less than 5 hours, 5–6 hours, 6–7 hours, 7–8 hours, 8+ hours |
| Smoking status | Yes (pick one) | Never smoked, Former smoker (quit), Current smoker, Vape / e-cigarette |
| Alcohol use | Yes (pick one) | None, Occasionally (1–2x/month), Socially (1–2x/week), Regularly (3–5x/week), Daily |
| Health goals | No (multi-select) | Understand my lab results, Manage a chronic condition better, Prepare for doctor visits, Track medications and side effects, Improve sleep quality, Lose weight / improve fitness, Reduce stress and anxiety, Monitor heart health, Control blood sugar, Improve diet and nutrition |

### Toggle Logic

For **exclusive** categories: tapping an option deselects all other options in the same category, then selects the tapped one. Tapping the already-selected option deselects it (toggle off).

For **non-exclusive** categories (Health goals): each pill toggles independently.

Selected values are accumulated in `selectedFacts: string[]` — a flat list of selected option strings, regardless of category.

---

## Step 4 — Review / Confirmation

**Web:** "Almost done" — shows a summary of entered data before the final submit button.

**Mobile:** "Almost done" — confirms the user is ready to create their profile.

Tapping the final "Create my profile" / "Get started" button triggers `handleSubmit()`.

---

## Submit — `POST /api/profile`

On completion, the collected data is assembled into a `HealthProfile` object and submitted:

```typescript
const profile = {
  user_id: currentUser.id,          // From Supabase auth
  display_name: data.display_name,
  age: parseInt(data.age),
  sex: data.sex,
  height_cm: (feet * 12 + inches) * 2.54,
  weight_kg: lbs / 2.205,
  primary_conditions: data.conditions,
  current_medications: data.medications,   // Medication[]
  allergies: data.allergies,
  health_facts: selectedFacts,             // string[] from FACT_CATEGORIES
};

await fetch('/api/profile', {
  method: 'POST',
  body: JSON.stringify(profile),
});
```

The `health_facts` array (lifestyle selections) is stored in `health_profiles.health_facts` in Supabase and injected into every Claude system prompt via `HealthProfile.to_context_string()`.

On success, the user is redirected to the main application. The upsert pattern (`on_conflict="user_id"`) means re-running onboarding updates the existing profile rather than creating a duplicate.

---

## Navigation

**Web:** `useRouter()` from `next/navigation`; on success → `router.push('/')` or the authenticated home route.

**Mobile:** `expo-router`; on success → `router.replace('/(app)/home')`.

Both platforms call `getCurrentUser()` / `supabase.auth.getUser()` at the start of the onboarding page to populate `user_id`. If no authenticated user is found, the page redirects to the login screen.
