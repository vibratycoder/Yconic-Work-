# Mobile Screens

## Overview

The Sana Health mobile app is built with Expo SDK 51 and React Native. Routing is handled by `expo-router` using a file-based layout. All screens use a consistent dark theme matching the web application.

**Directory structure:**

```
mobile/app/
├── _layout.tsx              Root layout (navigation container)
├── (app)/                   Authenticated tab screens
│   ├── _layout.tsx          Bottom tab navigator
│   ├── home.tsx             Home screen
│   ├── chat.tsx             Chat screen
│   ├── labs.tsx             Labs screen
│   └── profile.tsx          Profile screen
└── (auth)/                  Unauthenticated screens
    └── onboarding.tsx       5-step onboarding flow
```

**Design tokens:**

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#04090f` | Screen and card backgrounds |
| Primary | `#38bdf8` | Buttons, active states, links |
| High | `#ff9f0a` | Lab values above range, warnings |
| Low | `#0a84ff` | Lab values below range |
| Normal | `#30d158` | Lab values within range |

---

## Home Screen

**File:** `mobile/app/(app)/home.tsx`

### Purpose

Health summary hub showing the user's current status at a glance, with quick navigation into the chat and a preview of any abnormal lab results.

### Key State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `profile` | `HealthProfile \| null` | Loaded from backend on mount |
| `loading` | `boolean` | Shows `ActivityIndicator` while fetching |
| `refreshing` | `boolean` | Drives pull-to-refresh indicator |

### API Calls

| Call | Trigger | Description |
|------|---------|-------------|
| `fetchHealthProfile(DEMO_USER_ID)` | Mount + pull-to-refresh | Loads the `HealthProfile` from `GET /api/profile/{user_id}` |

### UI Sections

1. **Greeting** — Time-of-day greeting (`Good morning/afternoon/evening`) with the user's `display_name`
2. **HealthSummaryCard** — Reusable component showing conditions count and medications count from the profile
3. **Ask Sana Health button** — Primary CTA that navigates to `/(app)/chat`
4. **Abnormal Labs section** — Shows up to 3 `LabCard` components for results with `status === 'high' | 'low' | 'critical'`; a "See all N abnormal results" link navigates to `/(app)/labs` when there are more than 3

### Design Tokens Used

- Primary `#0EA5E9` — ask button background and shadow
- `#111827` — section headings and greeting text

### Navigation

- Tapping the Ask button: `router.push('/(app)/chat')`
- Tapping "See all": `router.push('/(app)/labs')`

---

## Chat Screen

**File:** `mobile/app/(app)/chat.tsx`

### Purpose

Full conversational interface with Sana Health. Supports multi-turn conversation, displays citations, and shows a triage-level indicator.

### Key State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `messages` | `Message[]` | Full conversation history |
| `input` | `string` | Current text input value |
| `loading` | `boolean` | True while awaiting Claude response |
| `conversationId` | `string \| null` | Persisted across turns for continuity |

### API Calls

| Call | Trigger | Description |
|------|---------|-------------|
| `POST /api/chat` | Send message | Sends `user_id`, `message`, `conversation_history`, `conversation_id` |

### Request Body

```typescript
{
  user_id: string,
  message: string,
  conversation_id: string | null,
  conversation_history: Array<{ role: 'user' | 'assistant', content: string }>
}
```

### Response Handling

- `answer` — rendered as assistant message bubble
- `citations` — displayed as a collapsible citation list below the response
- `triage_level` — drives a colour-coded urgency badge (`emergency` = red, `urgent` = orange, `routine` = yellow, `informational` = no badge)
- `is_emergency` — when true, the response is rendered with a red urgent-alert style

### Design Tokens Used

- Primary `#38bdf8` — send button and user message bubble
- High `#ff9f0a` — urgent triage badge
- Background `#04090f` — screen and message list

---

## Labs Screen

**File:** `mobile/app/(app)/labs.tsx`

### Purpose

Displays the user's lab results with colour-coded status indicators. Includes a simulated reference panel and a bullet-chart visualisation for each result.

### Key State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `labs` | `RatedLabResult[]` | Lab results with High/Normal/Low ratings |
| `profile` | `HealthProfile \| null` | User profile for demographic-adjusted ranges |
| `activePanel` | `string` | Currently selected panel filter |
| `loading` | `boolean` | Loading state |

### SIMULATED_LABS Demo Data

The screen includes a `SIMULATED_LABS` constant containing realistic demo lab data used when no real results have been imported. This allows the screen to be useful immediately after onboarding.

### API Calls

| Call | Trigger | Description |
|------|---------|-------------|
| `fetchHealthProfile(DEMO_USER_ID)` | Mount | Loads profile for demographic context |
| `GET /api/profile/{user_id}` | Indirect via fetchHealthProfile | Returns `recent_labs` array |

### Bullet Chart Visualisation

Each lab result is displayed with a horizontal bullet chart showing:
- The result value as a marker dot
- The reference range as a shaded band
- The status colour (`#ff9f0a` for High, `#0a84ff` for Low, `#30d158` for Normal)

### Design Tokens Used

- High `#ff9f0a` — high-result markers and badges
- Low `#0a84ff` — low-result markers and badges
- Normal `#30d158` — normal-result markers and badges
- Background `#04090f` — screen background

---

## Profile Screen

**File:** `mobile/app/(app)/profile.tsx`

### Purpose

Full health-profile editor with a 5-tab layout matching the web `EditProfileModal`. Also shows a read-only wearable summary card below the tabbed editor.

### Key State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `profile` | `HealthProfile \| null` | Loaded profile |
| `activeTab` | `TabId` | Currently visible tab |
| `editMode` | `boolean` | Whether the current tab is in edit mode |
| `loading` | `boolean` | Initial load indicator |
| `refreshing` | `boolean` | Pull-to-refresh indicator |

### 5-Tab Profile Structure

| Tab ID | Label | Fields |
|--------|-------|--------|
| `demographics` | Demographics | `display_name`, `age`, `sex`, `height_cm`, `weight_kg` |
| `conditions` | Conditions | `primary_conditions` (list of strings) |
| `medications` | Medications | `current_medications` (list of `Medication`) |
| `allergies` | Allergies | `allergies` (list of strings) |
| `lifestyle` | Lifestyle | `health_facts` via FACT_CATEGORIES toggle pills |

### FACT_CATEGORIES (Lifestyle Tab)

The Lifestyle tab renders the same FACT_CATEGORIES toggle-pill UI as the web onboarding. Categories and their mutual-exclusivity rules:

| Category | Exclusive | Example Options |
|----------|-----------|----------------|
| Exercise frequency | Yes | Sedentary, Light, Moderate, Active, Very active |
| Average sleep | Yes | Less than 5h, 5–6h, 6–7h, 7–8h, 8+ hours |
| Smoking status | Yes | Never smoked, Former smoker, Current smoker, Vape |
| Alcohol use | Yes | None, Occasionally, Socially, Regularly, Daily |
| Health goals | No | Understand labs, Manage condition, Prepare for visits, … |

### API Calls

| Call | Trigger | Description |
|------|---------|-------------|
| `fetchHealthProfile(DEMO_USER_ID)` | Mount + pull-to-refresh | Loads full `HealthProfile` |
| `updateHealthProfile(user_id, profile)` | "Save" tap | `PUT /api/profile/{user_id}` |

### Design Tokens Used

- Primary `#38bdf8` — active tab indicator, save button, toggle-pill active state
- Background `#04090f` — screen background
- `#1c2b3a` — card and tab container backgrounds

---

## Auth / Onboarding Flow

**File:** `mobile/app/(auth)/onboarding.tsx`

Documented in full in [ONBOARDING_FLOW.md](ONBOARDING_FLOW.md).

### Summary

The 5-step onboarding (`OnboardingStep` type: `0 | 1 | 2 | 3 | 4`) collects the initial health profile. On the final step it calls `POST /api/profile` with the assembled `HealthProfile` payload including `health_facts: selectedFacts`. On success it navigates to `/(app)/home`.

---

## Shared Components

| Component | File | Description |
|-----------|------|-------------|
| `HealthSummaryCard` | `mobile/components/HealthSummaryCard.tsx` | Conditions + medications count card |
| `LabCard` | `mobile/components/LabCard.tsx` | Single lab result with status colour |

## Shared API Library

**File:** `mobile/lib/api.ts`

Exports `fetchHealthProfile(userId)` and `updateHealthProfile(userId, profile)` which call the backend REST API. The base URL should be configured via an environment variable pointing to the FastAPI backend.

## TypeScript Types

**File:** `mobile/lib/types.ts`

Exports `HealthProfile`, `LabResult`, `Medication`, `WearableSummary` matching the Pydantic models in `backend/models/health_profile.py`.
