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
| FD-008 | Hide the embedded noVNC viewer controls. | Sentinel owns the recording workflow and Chromium policy; the noVNC toolbar adds no required tester action and reduces the browser stage available for the approved journey. |

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
| `/dashboard` | Real-data workspace metrics and a five-Product maximum Test Case distribution chart; no management forms or Test Case inventory. |
| `/products` | Accessible Product list with a heading-level **New product** action, sized to match **New recording**, that opens a named Product-creation modal. Each Product can be renamed or used to open a pre-filtered Test Case inventory. |
| `/test-cases` | Searchable and product-filterable Test Case inventory with a header count of visible versus accessible Test Cases. |
| `/test-cases/[id]` | Saved Test Case metadata, current-version badge, and read-only Step Timeline. |
| `/test-cases/[id]/edit` | Focused saved-Test-Case editor for labels, descriptions, expected outcomes, non-secret variable markers, checkpoint controls, and immutable next-version save feedback. Recorded target metadata and captured values are visibly read-only; a changed action starts with a new recording. |
| `/recordings/new` | Legacy entry URL that safely returns to Dashboard; creation is initiated from the persistent **New recording** action. |
| `/recordings/[id]` | Focused, chrome-free Recording Workspace for the active draft. |
| `/runs` | Product-authorized Run inventory with outcome and Product filters. |
| `/runs/[id]` | Focused guided Run workspace while active, then a Run Detail timeline with evidence panels when completed. |

### Future route specifications

The following are documented design targets only. Phase 1.5 must not create placeholder pages or backend behavior for them.

| Future route | Intended experience |
|---|---|
| `/runs` and `/runs/[id]` | Phase 3 adds Auto Run queue/running/paused states, attempt history, checkpoint screenshot review, Continue/Cancel controls, selector-failure reasons, and duration comparison beside the existing guided Run detail. Phase 4 adds a pre-run variable-binding dialog and masked binding source summary; later work adds database context and release grouping. |
| `/test-data` | Phase 4 product-scoped Test Data Sets. The list shows name, field names, reuse policy, lifecycle, and audit context without raw values; a creation/replacement dialog defaults to reusable data and offers an intentional single-use policy for values that must not be reused after a passed Run. |
| `/releases` | Phase 5 Release inventory and creation. Each row shows a name, Product scope, tagged Test Case count, latest batch state, and derived readiness without implying a result is manually editable. |
| `/releases/[id]` | Phase 5 Release Detail: tagged Test Cases, version-snapshot batch history, explicit ineligible-item reasons, linked Auto Run status, and consolidated readiness. Editing tags is visually separate from starting a batch so a completed batch remains understandable. |
| `/review` | Change proposals, negative-test suggestions, checkpoint decisions, and owner approvals. |
| `/settings` | Product access, integration health, notification configuration, and safe connection state. |

The desktop shell has a persistent, user-toggleable sidebar. Its compact state displays the Sentinel mark and navigation icons only; each icon keeps an accessible link name. Following a sidebar link preserves that compact state; only the top-bar navigation control may change it. Phase 5 navigation exposes Dashboard, Products, Test Cases, Test Data, Runs, and Releases; New recording is the single explicit primary action in the top bar’s right-hand corner, not a permanent destination or repeated page-level button. On narrow screens the same control opens and closes the full navigation drawer. Review and Settings remain future navigation.

## 5. Page experience decisions

### Sign-in

Use a branded full-height entry screen with a concise development-access card, clear inline errors, labelled fields, and keyboard-first submission. The development-only nature of the identity path is visually stated without making it the dominant product message.

### Dashboard, Products, and Test Case inventory

Use the shared App Shell and keep responsibilities separate: Dashboard is a clean operational overview with real Product/Test Case metrics and a distribution chart capped at the five highest-coverage Products; Products owns creation and name management through a heading-level modal action, with rename validation matching creation validation and a direct **View Test Cases** link that applies the Product filter; Test Cases owns searchable inventory, leaves clear separation between its search field and results, and shows its visible/total count beside the heading. The top-bar **New recording** action opens a compact, labelled creation dialog over the current page rather than a standalone creation screen. Empty states explain the next useful action. Do not invent activity, pass-rate, Run, or coverage data before Phase 2 and later data models exist.

### Saved Test Case detail

Use breadcrumbs, product and owner metadata, a version badge, and a vertical ordered Step Timeline. Saved annotations appear as readable metadata chips or labelled content, while redacted values remain visibly redacted. Editing a saved version is not implied by its appearance. Phase 4 adds a Variables panel: show canonical names, affected step numbers, and masked static-default status; never display a stored raw value. Both **Run test** and **Auto Run** open the same pre-run binding dialog when variables exist. Each row selects static, a compatible Test Data Set, or a manual entry, and inline errors explain unavailable/consumed data or rejected secret-like input. The Test Data screen labels reusable and single-use sets clearly; reusable means sequential reuse only, because an active Run reserves the set until it ends.

### Run inventory and Run Detail

Use the shared App Shell for `/runs`, with compact Product, outcome, and Run-mode filters and a list whose status always communicates outcome and evidence completeness together. Guided `/runs/[id]` retains its distraction-reduced browser workspace. An active Auto Run uses an operational detail view rather than a live browser: show queue/running state, current step, attempt number, retry reason when applicable, and an explicit Cancel action. At a checkpoint, replace progress with the captured screenshot, expected-outcome context, the ten-minute review-window deadline, and Continue/Cancel controls. Once completed, either mode becomes a readable Run Detail with ordered result timeline, duration comparison, attempts, and Screenshots, Network, Console, and Storage evidence panels. Evidence failures are explicit text/status items, not hidden behind a successful test outcome. No browser-video player is designed or displayed.

### Recording Workspace

Use an isolated, distraction-reduced 100vh workspace with no App Shell sidebar or global top bar. A compact workspace header takes approximately 10% of the height: **Back to dashboard** and the Test Case name sit on the left; **Save Test** and **Discard** sit on the right. Back opens a decision modal and never navigates away until the tester explicitly saves or discards. The remaining workspace is a 30% editable Live Timeline and 70% live remote-browser stage. The browser launch control lives only in its empty browser stage, never in the workspace header. The browser surface is the visual priority. On narrow screens, show a guidance state that asks the tester to use a desktop-sized viewport.

## 6. Component and interaction rules

Implement reusable App Shell, Sidebar, Top Bar, Page Header, Card, Button, Icon Button, Status Badge, Form Field, Empty State, feedback/toast region, Step Timeline, and confirmation-modal pattern primitives.

- Buttons use clear primary, secondary, ghost, and destructive variants; hover elevation and pressed-state scale are subtle and never change layout.
- Forms retain inline validation and add an accessible status region for asynchronous success or failure feedback.
- Focus rings are visible on every interactive control and meet contrast requirements.
- Status always combines text, icon/shape, and colour.
- Cards and timeline items use consistent surface, border, radius, and elevation tokens.
- On desktop, the top-bar navigation control collapses the sidebar to icons only while retaining accessible link names. At or below 1024 px it opens and closes the full-width navigation drawer instead. Dashboard content stacks below 768 px. Recording uses a narrow-screen guidance state below 1024 px.

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
