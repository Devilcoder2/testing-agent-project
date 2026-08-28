# Sentinel Frontend Design System and UX Decisions

**Status:** Phase 15 implementation complete for the currently delivered Phase 12 product; owner usability/learning review pending
**Date:** 2026-08-24
**Scope:** Product-wide visual, interaction, responsive, and accessibility system for every currently implemented Sentinel route.

**Verification:** On 2026-08-24, lint and type-check passed; the production build compiled and generated all 18 routes; focused browser coverage passed for the shell/recording, readiness, Auto Run, variables/Test Data, Release/version editing, and Review workflows. Serial Vitest passed 43/45 assertions. The two remaining Guided Run assertions are blocked by the correct single-browser guard because an existing user-owned Guided Run remains active; see `phases.md` and `learning-log.md`.

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
| `/notifications` | Phase 6 product-authorized inbox with unread/all filtering, delivery state, protected Run or Release links, and individual or bulk read actions. |
| `/review` | Phase 7 product-authorized suggestion queue plus Phase 9 change-proposal queue. Change proposals show source/proposed description and expected-outcome text side by side, preserve failed-Run evidence links, and expose decision controls only to the original Test Case owner. |
| `/products` Jira panel | Phase 8 creator-only Jira Cloud project mapping, with connected, unavailable, and validation-error states; credentials never appear in the UI. |
| `/admin` | Phase 12 Admin-only organization workspace for members, invitations, roles, account state, Product access, and safe audit context. Managers and Testers never see this navigation destination. |

### Future route specifications

The following are documented design targets only. Phase 1.5 must not create placeholder pages or backend behavior for them.

| Future route | Intended experience |
|---|---|
| `/runs` and `/runs/[id]` | Phase 3 adds Auto Run queue/running/paused states, attempt history, checkpoint screenshot review, Continue/Cancel controls, selector-failure reasons, and duration comparison beside the existing guided Run detail. Phase 4 adds a pre-run variable-binding dialog and masked binding source summary. Phase 10 adds an explicit failed-Run-only Database insight action and a compact safe result/error panel; it never shows a lookup value, raw row, SQL, or credentials. |
| `/dashboard` | Phase 11 adds a read-only Pilot readiness panel with concise safe service states, local-only guidance, optional Jira state, and actionable remediation text. It does not expose infrastructure details or become a settings screen. |
| Product, Test Case, and Release detail | Phase 11 adds a creator-only ownership-transfer confirmation modal. It lists only eligible existing members and explains that historical records are unchanged; unavailable transfer controls stay hidden rather than becoming disabled clutter. |
| `/test-data` | Phase 4 product-scoped Test Data Sets. The list shows name, field names, reuse policy, lifecycle, and audit context without raw values; a creation/replacement dialog defaults to reusable data and offers an intentional single-use policy for values that must not be reused after a passed Run. |
| `/releases` | Phase 5 Release inventory and creation. Each row shows a name, Product scope, tagged Test Case count, latest batch state, and derived readiness without implying a result is manually editable. |
| `/releases/[id]` | Phase 5 Release Detail: tagged Test Cases, version-snapshot batch history, explicit ineligible-item reasons, linked Auto Run status, and consolidated readiness. Editing tags is visually separate from starting a batch so a completed batch remains understandable. |
| `/review` | Phase 9 change proposals extend the Phase 7 queue without mixing their semantics: a failed Run can propose only annotations, and owner approval creates a new immutable version. Checkpoint decisions remain on Run Detail. |
| `/settings` | Product access, integration health, notification configuration, and safe connection state. |

Phase 8 extends completed failed Run Detail with a secondary **Create Jira issue** action. It opens a review modal—not an automatic side effect—with a fixed Bug type, editable summary/reproduction text/priority, an explicit file action, and clear queued, filed, updated-existing, or delivery-failed feedback. The issue preview must state that evidence remains private in Sentinel and show only a protected Run Detail link. Passing and interrupted Runs omit the action. Product configuration keeps Jira mapping in the existing Product experience but shows it only to that Product's creator; all other members see integration state without connection controls.

The desktop shell has a persistent, user-toggleable sidebar. Its compact state displays the Sentinel mark and navigation icons only; each icon keeps an accessible link name. Following a sidebar link preserves that compact state; only the top-bar navigation control may change it. Phase 7 navigation exposes Dashboard, Products, Test Cases, Test Data, Runs, Releases, Notifications, and Review; New recording is the single explicit primary action in the top bar’s right-hand corner, not a permanent destination or repeated page-level button. On narrow screens the same control opens and closes the full navigation drawer. Settings remains future navigation.

## 5. Page experience decisions

### Sign-in

Use a branded full-height entry screen with a concise development-access card, clear inline errors, labelled fields, and keyboard-first submission. The development-only nature of the identity path is visually stated without making it the dominant product message.

### Dashboard, Products, and Test Case inventory

Use the shared App Shell and keep responsibilities separate. Phase 6 Dashboard is a clean operational overview, not an inventory: a Product selector changes the authorized 30-day UTC health view; compact metric cards show saved Tests, completed Runs, pass rate, failures, flakiness, and coverage growth; a custom CSS daily result trend and latest-Run list communicate state without a chart dependency; and a clear **Needs attention** region links only the current user's unread failure/checkpoint items. The **Health overview** is a four-column Product ledger: Product, saved Tests, pass rate, and latest status share identical desktop tracks across every row. Long Product names remain one line and truncate visually without changing the complete accessible button name; compact mobile rows retain their existing reduced information density. Empty metrics explain that there is no recent activity rather than implying a zero-quality result.

Products owns creation and name management through a heading-level modal action, with rename validation matching creation validation. Each Product row keeps identity and Test count visually dominant; a labelled Edit icon and Admin-only Delete icon are the only always-visible row actions. A three-dot button opens a keyboard-dismissible menu containing **View Test Cases**, GitHub repositories, Jira configuration, and eligible ownership transfer. Delete opens a destructive confirmation dialog with server-derived impact counts, explicit Release-preservation copy, and an exact `DELETE` field. Confirmed deletion immediately changes the row to a non-interactive queued/processing state; a persistent status banner and polling report completion or safe failure without blocking navigation. Test Cases owns searchable inventory, leaves clear separation between its search field and results, and shows its visible/total count beside the heading. The top-bar **New recording** action opens a compact, labelled creation dialog over the current page rather than a standalone creation screen.

### Phase 12 identity and administration

Use dedicated sign-in, password-reset, and invitation-acceptance screens with labelled fields, neutral reset feedback, clear expiry/error states, and no organization/user enumeration. If a protected request returns HTTP 401 after the session expires or is revoked, clear the browser session and replace the stale protected route with `/`; never show `Sign in required.` as page feedback. Invalid credentials remain inline on the sign-in form, while authenticated HTTP 403 responses remain safe in-context permission feedback. The Admin workspace shows role and account-state text beside every member, Product access through explicit controls, and confirmation before disablement or access removal. It never shows passwords, invitation/reset tokens, evidence, variable values, or Test Data values. Navigation and action visibility follow the effective active organization role; a denied deep link returns a safe access message without rendering administration data.

### Notifications inbox

Use the shared App Shell with a concise chronological inbox. A segmented **Unread / All** filter, a visible unread count, clear delivery-state badge, and disabled bulk-read action when no unread items exist make the state understandable without relying on colour. Every row states the safe event summary, its timestamp, and a protected contextual link; it never renders evidence previews, raw failure logs, variable values, or email body content. Marking one item or all items read updates the list with an announced status message. A no-notifications state should be calm and specific rather than suggest a missing integration.

### Saved Test Case detail

Use breadcrumbs, product and owner metadata, a version badge, and a vertical ordered Step Timeline. Saved annotations appear as readable metadata chips or labelled content, while redacted values remain visibly redacted. Editing a saved version is not implied by its appearance. Phase 4 adds a Variables panel: show canonical names, affected step numbers, and masked static-default status; never display a stored raw value. Both **Run test** and **Auto Run** open the same pre-run binding dialog when variables exist. Each row selects static, a compatible Test Data Set, or a manual entry, and inline errors explain unavailable/consumed data or rejected secret-like input. The Test Data screen labels reusable and single-use sets clearly; reusable means sequential reuse only, because an active Run reserves the set until it ends. Phase 7 adds a secondary **Generate suggestions** action and a Review link: generation reports created, already-known, and skipped items without leaving the source Test Case or implying an automatic run.

### Review queue

Use the shared App Shell for a calm, review-first queue rather than a Test Case editor. Product and status filters sit with the queue heading. Each suggestion card identifies its source Test Case/version/step, deterministic rule, safe proposed value, rationale, and expected validation/no-success result. Draft controls use an edit dialog limited to name, rationale, and proposed safe text; the source target and step structure remain visible but read-only. **Approve**, **Dismiss**, and **Reopen** are explicit state-changing actions with announced feedback and confirmation where destructive intent could be unclear. Approved cards link to their separately owned Test Case; dismissed cards remain discoverable under the status filter. No row presents Run controls, evidence, or a baseline-update action.

### Run inventory and Run Detail

Use the shared App Shell for `/runs`, with compact Product, outcome, and Run-mode filters and a list whose status always communicates outcome and evidence completeness together. Guided `/runs/[id]` retains its distraction-reduced browser workspace. An active Auto Run uses an operational detail view rather than a live browser: show queue/running state, current step, attempt number, retry reason when applicable, and an explicit Cancel action. At a checkpoint, replace progress with the captured screenshot, expected-outcome context, the ten-minute review-window deadline, and Continue/Cancel controls. Once completed, either mode becomes a readable Run Detail with ordered result timeline, duration comparison, attempts, and Screenshots, Network, Console, Storage, and Database evidence panels. For a failed completed Run only, Database insight offers an explicit “Run customer lookup” action; its result shows only Found/Not found, status, timestamps, or a safe incomplete/unavailable state. Evidence failures are explicit text/status items, not hidden behind a successful test outcome. No browser-video player is designed or displayed.

Phase 13 adds an advisory **Source analysis** panel only to a completed failed Run. It first states the linked repository, short commit SHA, branch, analysis state, and confidence. A clear **Analyze failure** action appears only when the current user can request a manual analysis and must open a repository/commit picker rather than guessing source. Completed analysis separates evidence-backed observations, hypotheses, likely cause, remediation, safe review-only patch fragment, source references, and limitations. Source links open the exact GitHub commit/path when allowed; Sentinel never renders a complete source file, prompt, token, raw code package, or provider response. A blocked/unavailable state is explicit and non-alarming, with a safe reason and no retry button for sensitive-context blocks.

### GitHub repository connections and activity

Add a **GitHub** Product settings surface for Admins and assigned Managers. It uses a compact connection table with repository label, repository name, default branch, allowed branches, state, last safe delivery, and action menu. **Connect repository** opens a focused dialog; server-side configuration state is explained without placing an App private key, webhook secret, installation token, or clone URL in the form. Pause, edit, and disconnect use confirmation dialogs. Test Case Detail includes a small **Repository routing** section where Product members link the Test Case to one or more existing connections; it explains that only those links may start source-triggered Auto Runs.

The GitHub activity view uses the shared inventory pattern, not a log dump. Each row displays a repository label, branch, short SHA, received time, trigger decision, queued/excluded Test counts, and protected Run/analysis links. It never exposes a webhook payload, raw source, credentials, or provider error body. A missing GitHub App configuration has a calm empty/integration-not-configured state; unconnected Products continue to show their existing workflows normally.

### Recording Workspace

Use an isolated, distraction-reduced 100vh workspace with no App Shell sidebar or global top bar. A compact workspace header takes approximately 10% of the height: **Back to dashboard** and the Test Case name sit on the left; **Save Test**, **Discard**, and **Full screen** sit on the right. Back opens a decision modal and never navigates away until the tester explicitly saves or discards. The remaining workspace is a 30% editable Live Timeline and 70% live remote-browser stage. The expanded Step Log header keeps the **Live timeline / Step Log** title block, a non-wrapping step count, and a circular left-facing collapse chevron in one horizontal row. Collapse leaves a clean narrow restore rail with the matching right-facing chevron; the rail contains no rotated text or count badge and gives its width to the browser. Both controls retain accessible names and tooltips. Full screen hides the session header and Step Log, gives the remote-browser stage the full visible workspace, and leaves a labelled **Exit full screen** control over the stage. Exiting restores the user’s prior Step Log state. These are client-only layout controls and must not expose noVNC controls or change the locked browser/session behavior. The browser launch control lives only in its empty browser stage, never in the workspace header. The browser surface is the visual priority. On narrow screens, show a guidance state that asks the tester to use a desktop-sized viewport.

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

- New API endpoints, data models, browser recording semantics, replay, Run execution, evidence capture, JIRA, approvals, or placeholder future screens beyond the documented Phase 6 dashboard and Notifications inbox.
- External fonts, icon libraries, design-system dependencies, and visual assets.

### Acceptance criteria

- Existing Phase 1 flows remain functionally unchanged and pass their automated checks.
- All implemented UI colours come from semantic tokens.
- The Recording Workspace is visually and structurally distinct from dashboard forms.
- Keyboard focus, labels, error feedback, contrast, and reduced-motion behavior satisfy the documented WCAG 2.2 AA checks.
- Playwright verifies routing, keyboard navigation, Product validation feedback, saved-test persistence, recording-layout behavior, and narrow-screen recording guidance.
- Future product screens are documented here without premature implementation.

## 8. Approved Phase 15 product-wide redesign

The owner approved a product-wide redesign on 2026-08-24 after a repository and live-UI audit. This work may start before the optional Phase 13 GitHub and Phase 14 conversational integrations because it changes only the delivered Phase 12 interface. Those future integrations must adopt this system when implemented; Phase 15 must not create placeholder screens or invent their workflows now.

### Design direction

- Retain Sentinel's dark, low-glare operations identity and semantic blue, teal, amber, and rose status language.
- Refine the canvas and surface hierarchy, use sentence-case labels, reserve monospace for operational data, and keep local system typography.
- Replace text glyphs with a small internal SVG icon set; do not add an icon library, external font, Tailwind, or component framework.
- Use one primary action per region. Move secondary, ownership, configuration, and destructive actions into explicit menus or dialogs without changing authorization.
- Prefer compact tables and responsive labelled rows for inventories. Cards remain for metrics, summaries, empty states, and focused decision surfaces.
- Keep dark mode as the only shipped theme. Tokens must remain semantic so a light palette can be added later without component rewrites.

### Layout and responsive policy

- Use a 15.5rem expanded and 4.5rem collapsed desktop sidebar, a 4rem sticky top bar, and a 90rem maximum operational content width.
- At widths below 64rem, use an overlay navigation drawer. At widths below 48rem, tables become labelled cards and filters stack or move into compact disclosures.
- Preserve the explicit desktop-only policy for the live Recording Workspace and browser-backed Guided Run below 64rem. Completed and autonomous Run details remain responsive.
- Render large Test Case, Run, Notification, and Review collections in client-side pages of 25 while retaining the existing complete API response. Persist inventory filter and page state in the URL when practical.

### Interaction and accessibility policy

- Standardize 120ms control feedback, 180ms menus/tabs, and 240ms overlays using the existing ease-out curve. Dense rows change surface or border instead of lifting.
- Replace browser-native prompts and confirmations with a reusable dialog that traps focus, closes with Escape where safe, restores focus, and labels consequences.
- Provide shared skeleton, empty, error, inline-feedback, saved-state, tab, pagination, overflow-menu, structured evidence, and responsive-row patterns.
- Maintain WCAG 2.2 AA: visible focus, 44px touch targets, semantic headings/tables/tabs/dialogs, non-colour status cues, live announcements, 200% zoom support, and reduced-motion behavior.

### Screen hierarchy

- Dashboard: show health metrics and personal attention items before the collapsible pilot-readiness detail.
- Products, Test Cases, Test Data, Runs, Releases, Notifications, and Administration: use scannable inventory structures with compact actions and responsive cards.
- Test Case Detail: keep Auto Run primary, Guided Run secondary, and group maintenance actions separately; organize Steps, Variables, and Versions without changing immutable data.
- Recording: preserve the focused 30/70 timeline/browser workspace, collapse older steps, and expose annotation save state.
- Run Detail: keep progress and outcome prominent; organize Screenshots, Network, Console, Storage, diagnostics, Jira, and proposals into readable sections with raw JSON available only as a disclosure.
- Review: separate deterministic suggestions from baseline-change proposals and use an explicit before/after comparison.
- Administration: replace native Product multi-selects and immediate field mutation with an accessible member editor and explicit save using the existing PATCH contract.

### Phase 15 acceptance baseline

- No API route, persisted schema, authorization rule, queue, evidence boundary, Run behavior, or redaction rule changes.
- Existing critical Playwright workflows continue to pass after selector updates.
- All implemented routes have usable loading, empty, error, populated, narrow-screen, keyboard, and reduced-motion states.
- Inventory paging never changes the visible total or makes a matching record undiscoverable.
- Raw evidence remains available, but common diagnosis does not require reading JSON.

## 9. Phase 16 clean-sheet replacement direction

The owner rejected Phase 15's incremental visual refinement on 2026-08-24 because it retained too much of the existing interface. Phase 16 therefore supersedes the Phase 15 visual, layout, navigation, and theme decisions. Phase 15 remains documented only as implementation history.

The authoritative interface specification is now `DESIGN.md`. Existing frontend behavior is a functional reference only: API calls, authorization checks, validation, data redaction, persisted state, route behavior, and workflow outcomes stay intact, while the rendered interface is rebuilt from a blank visual foundation.

### Required replacement scope

- Replace the persistent dark sidebar and top bar with the clean-sheet command masthead and grouped section navigator.
- Replace the dark-only palette with equally supported light and dark semantic token sets. Follow the system preference until a user explicitly chooses a theme, then persist that choice locally.
- Replace the previous surface, card, typography, spacing, radius, elevation, icon, and motion language across every implemented route.
- Recompose screens around attention, decisions, and operational causality instead of retaining the existing page arrangements and merely restyling them.
- Include all Phase 13 GitHub repository, webhook activity, routing, and source-analysis interfaces in the replacement system.
- Preserve the standalone desktop-only Recording Workspace and live Guided Run boundary, but redesign their visual structure as an instrument workspace.

### Functional preservation boundary

Phase 16 must not change API paths, request or response contracts, database schema, authentication, role and Product authorization, Run and Release execution, GitHub or Jira behavior, redaction, evidence retention, or workflow semantics. DOM structure and selectors may change when necessary for accessibility or the new composition; tests must be updated to verify outcomes rather than obsolete presentation details.

### Required verification

- Every implemented route renders in both themes with no unreadable, unthemed, or theme-flashing primary surface.
- The explicit theme control is keyboard accessible, announced, and persists across navigation and reload.
- Desktop, tablet, and mobile navigation expose the same authorized routes and preserve active-route feedback.
- Existing critical sign-in, Product, Test Case, recording, Run, Release, Review, Administration, Jira, GitHub, and source-analysis workflows still pass.
- Both themes meet the documented WCAG 2.2 AA contrast, focus, zoom, reduced-motion, and non-colour-status requirements.

## 10. Phase 17 global search extension

Add one global command-search combobox to the Phase 16 masthead rather than separate page-level search fields. It searches only server-authorized, safe display metadata across Products, Test Cases, Test Data, Runs, Releases, Review, notifications, and Administration. Results follow the grouped section-navigation order, except the current route's group moves first.

The desktop field occupies the flexible center of the masthead. At narrower widths it becomes a full-width second masthead row while retaining the identity, New recording, and theme controls. The result panel uses the Signal Canvas flat ledger language, five rows per category, clear section headings, a cobalt active trace, explicit loading/no-result/error states, and equal light/dark treatment.

Interaction follows the accessible combobox pattern: `Ctrl+K`/`Cmd+K` focuses search, input is debounced by 250 milliseconds, stale requests are cancelled, Arrow keys move the active result, Enter follows it, Escape closes the panel, and pointer/touch input remains equivalent. Query state is transient and clears when a result is selected or the user signs out.

## 11. Test Case detail focus refinement

The saved Test Case header replaces the generic read-only sentence with one compact metadata line: Product, owner, and recorded-step count. Feature labels remain secondary metadata. Version stays a status badge, while Guided Run and Auto Run use the internal SVG system inside 44px labelled icon buttons. The overflow trigger is the shared horizontal three-dot icon; its panel contains text-only Edit Test, Generate suggestions, Open Review, and eligible Transfer Test Case ownership actions with identical full-width, left-aligned rows.

The overflow is a controlled disclosure rather than a permanently open native details block. Pointer or focus movement outside its boundary and Escape close it, focus remains recoverable, and opening ownership transfer closes the menu without hiding the modal. No action availability, permission, destination, or Run-start behavior changes.

`RepositoryRouting` renders nothing while loading or when no active Product repository exists. Once at least one active connection exists, the current routing card, selected state, authorization feedback, and save behavior render unchanged. This avoids advertising optional GitHub automation where it cannot be used.

Recorded steps use compact native disclosures. The summary is a full-width row with the numbered timeline rail, normalized action label, target/value preview, chevron, and an explicit Checkpoint label where applicable. The expanded region contains only optional annotations and a plain fallback when no additional annotation was captured. Checkpoint disclosures use the warning token, dashed border, and label in both themes; ordinary steps retain the neutral border. The timeline introduction has no redundant explanatory sentence.

## 12. Phase 14 Telegram integration surfaces

Phase 14 adds two small protected surfaces to the Phase 16 dual-theme system. They expose only connection state and safe operational metadata; neither page renders a bot token, webhook URL, chat ID, message text, evidence, or a Telegram conversation transcript.

### Account integrations

The Account menu exposes **Integrations** for every signed-in user. Its Telegram card explains the private-chat-only boundary, shows either **Not linked** or a neutral **Linked** state, and offers one deliberate primary action: **Get Telegram link**. Generating the link presents a short-lived deep-link dialog with its ten-minute expiry, a copy action, and a clear note that it binds the next private Telegram chat only. A linked state replaces it with an explicit destructive-style **Unlink Telegram** action using the shared confirmation dialog. Status feedback must be plain-language, keyboard reachable, announced, and never show a chat identifier or provider payload.

### Administration integration status

Only Admins see the Telegram status card in Administration. It uses the existing compact operational-row pattern to show disabled/configuration-needed/webhook-active/degraded state, safe counts for linked identities and recent delivery outcomes, and last safe activity timestamp/reason. **Activate webhook** and **Deactivate webhook** are explicit confirmed actions; they must visibly distinguish missing server configuration from provider communication failure. Managers and Testers receive no control or inferred integration metadata, including by direct route navigation.

The Telegram provider itself remains button-driven outside the web UI. Sentinel pages never attempt to recreate a chat interface, show evidence in a preview, or promise a browser-free administrative workflow. These cards inherit both theme palettes, tokenized status colors plus text labels, 44px controls, reduced motion, visible focus, and responsive dialog behavior from the established primitives.
