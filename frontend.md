# Sentinel Frontend Design System and UX Decisions

**Status:** Implemented and acceptance-verified; owner learning review pending
**Date:** 2026-08-08
**Scope:** Frontend foundation, Phase 1 redesign, and documented direction for future Sentinel product areas.

**Verification:** Docker lint, type-check, API/database tests, Product creation browser test, remote-recording browser test, Phase 1.5 browser test, and production build passed on 2026-08-08. Desktop visual inspection confirmed the sign-in, App Shell, and recording-creation views.

## 1. Purpose

Sentinel is an operational quality-assurance workspace, not a generic form application. Its interface must help a tester confidently create, inspect, run, and review browser tests without hiding ownership, state, evidence, or consequential actions.

Phase 1.5 modernizes the delivered Phase 1 experience without changing its API contracts, authorization rules, recording behavior, or persisted data. Later capabilities use the same visual and interaction foundation.

## 2. Approved visual decisions

| ID | Decision | Rationale |
|---|---|---|
| FD-001 | Use a dark operations-focused visual system. | Browser recording, evidence, timelines, and status monitoring are easier to scan in a low-glare workspace. |
| FD-002 | Use a CSS-rendered Sentinel shield/radar mark plus a wordmark. | Establishes an intentional product identity without external assets, font licensing, or network dependencies. |
| FD-003 | Use local system typography only. | Keeps Docker-local startup private and fast while maintaining legibility across supported operating systems. |
| FD-004 | Use a custom CSS-token and React-primitive system. | Sentinel needs product-specific workspace components without the migration cost or visual constraints of Tailwind, shadcn, or a full component library. |
| FD-005 | Use subtle, purposeful motion only. | Hover, press, panel, and feedback transitions clarify interaction without distracting from QA work. All non-essential motion respects `prefers-reduced-motion`. |
| FD-006 | Meet WCAG 2.2 AA for the implemented screens. | Keyboard use, visible focus, semantic controls, contrast, labels, and non-colour status cues are required product behavior. |
| FD-007 | Make dashboards and lists responsive, but treat live recording as desktop-first. | A remote browser plus editable Step Timeline needs a usable desktop viewport; narrow screens receive a clear guidance state rather than a broken compressed workspace. |

## 3. Token system

The implementation defines these values in one token stylesheet. Other component styles consume semantic variables and do not introduce literal UI colour values.

| Role | Token | Value |
|---|---|---|
| Application canvas | `--color-canvas` | `#0B1020` |
| Primary surface | `--color-surface` | `#121A2B` |
| Raised surface | `--color-surface-raised` | `#18233A` |
| Primary action | `--color-primary` | `#3B82F6` |
| Successful/pass state | `--color-success` | `#2DD4BF` |
| Attention/paused state | `--color-warning` | `#FBBF24` |
| Destructive/failed state | `--color-danger` | `#FB7185` |

The token layer also defines derived text, border, focus-ring, disabled, hover, overlay, spacing, radius, shadow, z-index, typography, and motion roles. It uses a local system stack: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.

Motion defaults are 150 ms for press and hover feedback and 220 ms for surface transitions, using a standard ease-out curve. A reduced-motion media query removes transforms and non-essential animation.

## 4. Information architecture

### Implemented Phase 1.5 routes

| Route | Purpose |
|---|---|
| `/` | Development sign-in entry. Authenticated users continue to `/dashboard`. |
| `/dashboard` | Product context, Product creation, saved Test Case overview, and the primary New recording action. |
| `/test-cases` | Test Case inventory for the selected product context. |
| `/test-cases/[id]` | Saved Test Case metadata, current-version badge, and read-only Step Timeline. |
| `/recordings/new` | Product-aware Test Case creation form. |
| `/recordings/[id]` | Focused Recording Workspace for the active draft. |

### Future route specifications

The following are documented design targets only. Phase 1.5 must not create placeholder pages or backend behavior for them.

| Future route | Intended experience |
|---|---|
| `/runs` and `/runs/[id]` | Run inventory and timeline-linked evidence tabs for status, screenshots, network, console, storage, and database context. |
| `/releases` | Release health, grouped Test Cases, batch status, and readiness reporting. |
| `/review` | Change proposals, negative-test suggestions, checkpoint decisions, and owner approvals. |
| `/settings` | Product access, integration health, notification configuration, and safe connection state. |

The desktop shell has a persistent sidebar. Phase 1 navigation exposes Dashboard and Test Cases; New recording is an explicit primary action, not a permanent destination. Future navigation adds Runs, Releases, Review, and Settings when the relevant product capabilities exist.

## 5. Page experience decisions

### Sign-in

Use a branded full-height entry screen with a concise development-access card, clear inline errors, labelled fields, and keyboard-first submission. The development-only nature of the identity path is visually stated without making it the dominant product message.

### Dashboard and Test Case inventory

Use the shared App Shell, product context, real-data summary cards, a prominent New recording action, an inline Product-creation panel, and a Test Case inventory. Empty states explain the next useful action. Do not invent activity, pass-rate, Run, or coverage data before Phase 2 and later data models exist.

### Saved Test Case detail

Use breadcrumbs, product and owner metadata, a version badge, and a vertical ordered Step Timeline. Saved annotations appear as readable metadata chips or labelled content, while redacted values remain visibly redacted. Editing a saved version is not implied by its appearance.

### Recording Workspace

Use a focused desktop workspace: an action header with draft state, save, discard, and browser-launch controls; an editable Step Timeline on the left; and a raised browser stage on the right. The active recording state uses a text label and status icon in addition to the teal accent. On narrow screens, show a guidance state that asks the tester to use a desktop-sized viewport.

## 6. Component and interaction rules

Implement reusable App Shell, Sidebar, Top Bar, Page Header, Card, Button, Icon Button, Status Badge, Form Field, Empty State, feedback/toast region, Step Timeline, and confirmation-modal pattern primitives.

- Buttons use clear primary, secondary, ghost, and destructive variants; hover elevation and pressed-state scale are subtle and never change layout.
- Forms retain inline validation and add an accessible status region for asynchronous success or failure feedback.
- Focus rings are visible on every interactive control and meet contrast requirements.
- Status always combines text, icon/shape, and colour.
- Cards and timeline items use consistent surface, border, radius, and elevation tokens.
- Desktop sidebar collapses into a compact navigation control below 1024 px. Dashboard content stacks below 768 px. Recording uses a narrow-screen guidance state below 1024 px.

## 7. Phase 1.5 boundaries and verification

### In scope

- The token-based design system and reusable frontend primitives.
- Route-based redesign of the existing sign-in, dashboard, Product creation, Test Case list/detail, creation form, and Recording Workspace.
- Preservation and extension of existing recording, save, discard, authorization, redaction, and persistence coverage.
- Accessibility, reduced-motion, navigation, and responsive-layout verification.

### Out of scope

- New API endpoints, data models, browser recording semantics, replay, Run execution, evidence capture, notifications, JIRA, releases, approvals, or placeholder future screens.
- External fonts, icon libraries, design-system dependencies, and visual assets.

### Acceptance criteria

- Existing Phase 1 flows remain functionally unchanged and pass their automated checks.
- All implemented UI colours come from semantic tokens.
- The Recording Workspace is visually and structurally distinct from dashboard forms.
- Keyboard focus, labels, error feedback, contrast, and reduced-motion behavior satisfy the documented WCAG 2.2 AA checks.
- Playwright verifies routing, keyboard navigation, Product validation feedback, saved-test persistence, recording-layout behavior, and narrow-screen recording guidance.
- Future product screens are documented here without premature implementation.
