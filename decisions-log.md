# Sentinel Decisions Log

This log records non-obvious decisions, their reason, and their status. New decisions are appended; superseded decisions remain for auditability.

## D-001 — Web-only v1

- **Date:** 2026-08-05
- **Decision:** Limit v1 to browser-based web applications in the QA environment.
- **Reason:** This is the confirmed product scope and keeps the first platform focused.
- **Impact:** Mobile automation is deferred and must not shape Phase 1 interfaces.
- **Status:** Confirmed by requirements.

## D-002 — QA database access is read-only

- **Date:** 2026-08-05
- **Decision:** Sentinel may query QA PostgreSQL for diagnosis and state verification but may never create, update, or delete records.
- **Reason:** This is an explicit safety boundary in the requirements.
- **Impact:** Fresh data must come from application workflows or existing pools. The architecture requires a technically read-only database role and allowlisted queries.
- **Status:** Confirmed by requirements.

## D-003 — Human approval remains the baseline authority

- **Date:** 2026-08-05
- **Decision:** A Test Case’s original creator approves or rejects proposed expected-behavior changes; Sentinel never silently updates the baseline.
- **Reason:** A system cannot safely distinguish every intentional change from a defect without human context.
- **Impact:** The Test Case version history, notifications, and JIRA routing must preserve the old baseline until approval.
- **Status:** Confirmed by requirements.

## D-004 — Conservative edge-case suggestions

- **Date:** 2026-08-05
- **Decision:** Begin with fewer, higher-confidence negative-test suggestions.
- **Reason:** The requirements leave suggestion aggressiveness open; over-suggesting can create tester fatigue.
- **Impact:** Suggestions remain drafts and require individual approval.
- **Status:** Provisional assumption from requirements.

## D-005 — Modular monolith for the MVP

- **Date:** 2026-08-05
- **Decision:** Start with one modular web application/API, a relational database, a durable job queue, and isolated browser workers.
- **Reason:** Ten concurrent users do not justify feature-level microservices, and a single application keeps ownership and approval transactions understandable.
- **Impact:** Browser execution and evidence storage remain separate resource boundaries while domain logic stays centralized.
- **Status:** Provisional architecture choice.

## D-006 — Playwright as the browser boundary

- **Date:** 2026-08-05
- **Decision:** Use Playwright as the provisional browser automation and evidence-capture library.
- **Reason:** It supports web contexts, event observation, network and console capture, screenshots, video, and TypeScript.
- **Impact:** Phase 1 must prove the recording event model and target-site constraints before advanced replay is designed.
- **Status:** Provisional technology choice.

## D-007 — Evidence binaries live outside PostgreSQL

- **Date:** 2026-08-05
- **Decision:** Store videos, screenshots, and large logs in S3-compatible object storage; store metadata and references in PostgreSQL.
- **Reason:** Large binary retention and relational querying have different storage characteristics.
- **Impact:** Access control, checksums, redaction, retention, and signed URLs become explicit platform concerns.
- **Status:** Provisional architecture choice.

## D-008 — One-file commits and immediate pushes

- **Date:** 2026-08-05
- **Decision:** Every project change must be independently reviewed, committed as exactly one changed file, and pushed immediately to `origin`.
- **Reason:** The project owner explicitly requested a single-file learning and synchronization boundary.
- **Impact:** Documentation and future implementation work must be sequenced file by file; multi-file commits are prohibited.
- **Status:** Project governance rule, recorded in `AGENTS.md`.

## D-009 — Phase 1 uses a local browser-in-browser session

- **Date:** 2026-08-05
- **Decision:** Phase 1 will use Docker Compose to run one Chromium session in a Selenium container with noVNC, embedded inside Sentinel’s Recording Workspace.
- **Reason:** This matches the cloud-browser recording experience requested for Sentinel without a browser extension and keeps the first target fully reproducible.
- **Impact:** Phase 1 supports one active local recording session. Browser concurrency, remote runner allocation, and private-network access are deferred.
- **Status:** Confirmed by project owner.

## D-010 — Phase 1 persistence and development environment

- **Date:** 2026-08-05
- **Decision:** Use PostgreSQL 16 through Docker Compose and Prisma for Phase 1 persistence. Docker Desktop is a required development dependency.
- **Reason:** This validates the production-aligned relational model while keeping setup repeatable.
- **Impact:** The repository will include a Compose stack, Prisma migrations, seeded development users, and no dependency on the host Node runtime.
- **Status:** Confirmed by project owner.

## D-011 — Phase 1 demo target

- **Date:** 2026-08-05
- **Decision:** Build an isolated local demo application with sign-in and customer creation as the only allowlisted recording target.
- **Reason:** It gives recording tests deterministic behavior and avoids real credentials or QA-environment dependencies.
- **Impact:** Connections to organization QA websites remain a later, explicit runner-network decision.
- **Status:** Confirmed by project owner.

## Open decisions before production

- Identity provider and mapping from shared login to a named actor.
- Ownership reassignment when a creator leaves or changes teams.
- Evidence retention, sensitive-data redaction policy, and storage budget.
- Replay-speed benchmark and acceptable flake-rate targets.
- JIRA project, issue type, fields, duplicate-matching policy, and attachment limits.
- Email/Slack provider, deployment signal, and schedule configuration.
- Existing pooled test-data interfaces and invalidation signals.
- Approved database diagnostic queries and QA database connection policy.
- Success metrics for the first three months.

## D-012 — Phase 1 Product creation behavior

- **Date:** 2026-08-07
- **Decision:** Products created in the Phase 1 portal use a required name-only form. The form is inline on the dashboard, a newly created Product is immediately selected, and duplicate names for the same owner are rejected with a clear conflict message.
- **Reason:** This completes the existing Phase 1 Product creation checklist without adding fields or a separate management area to the MVP.
- **Impact:** The API trims names, rejects blank input, preserves the per-owner uniqueness constraint, and creates the creator’s Product membership atomically. Product sharing and richer metadata remain future decisions.
- **Status:** Confirmed by project owner.

## D-013 — Phase 1 recorder verification and secret handling

- **Date:** 2026-08-07
- **Decision:** Bundle Playwright Chromium and its Linux dependencies in the Sentinel Docker image for reproducible verification. Recorder event posts use `keepalive`, and password-field values and metadata are stored as `[REDACTED]`.
- **Reason:** The Phase 1 remote-browser journey must be testable from a fresh Docker build, and navigation must not lose pending recording events or expose password content through element metadata.
- **Impact:** The test image is larger, while browser lifecycle reliability and secret protection improve. A migration redacts existing password metadata in both draft and saved steps.
- **Status:** Verified by the Phase 1 API/database tests, remote-browser journey test, and live UI check.

## D-014 — Phase 1.5 frontend foundation

- **Date:** 2026-08-08
- **Decision:** Add Phase 1.5 before Phase 2 to establish a route-based, dark operations UI using custom CSS tokens and React primitives. The fixed palette is midnight canvas and surfaces with blue primary actions, teal success, amber attention, and rose danger. The system uses local typography, a CSS Sentinel mark, purposeful reduced-motion-safe animation, WCAG 2.2 AA requirements, and a desktop-first Recording Workspace.
- **Reason:** The delivered Phase 1 workflow is functionally verified but its one-page presentation does not scale to the dashboard, recording, Run Detail, release, approval, and integration experiences required by Sentinel.
- **Impact:** `frontend.md` becomes the frontend source of truth. The existing Phase 1 screens migrate to separate routes and an App Shell without changing their API, authorization, recording, or persistence behavior. Future areas are documented, not implemented.
- **Status:** Confirmed by project owner; Phase 1.5 acceptance verified.

## D-015 — Separate operational pages and a single recording action

- **Date:** 2026-08-08
- **Decision:** Keep Dashboard as a metrics-and-distribution overview, move Product creation and Product context to `/products`, and keep the sole New recording action in the authenticated top bar’s right-hand corner. Add a user-toggleable desktop sidebar that becomes a full navigation drawer on narrow screens.
- **Reason:** Test Case inventory and Product management already have dedicated navigation destinations; repeating them on Dashboard obscures operational status and makes the interface feel like one large form.
- **Impact:** The existing Product API and membership behavior remain unchanged. A newly created Product is retained as the selection for the next recording, so the new route does not remove the Phase 1 creation convenience. Test Case filtering receives dedicated spacing and a custom select affordance for consistent alignment.
- **Status:** Confirmed by project owner; verified with updated Product, recording, and frontend browser tests.

## D-016 — Compact navigation, modal Product creation, and Test Case count placement

- **Date:** 2026-08-08
- **Decision:** The collapsed desktop sidebar displays navigation icons only, with accessible link names retained. Product creation is initiated by a right-aligned page-header button and completed in a modal. The Test Cases page displays the filtered and total Test Case counts together in its page header.
- **Reason:** These changes keep navigation visually compact, remove the always-visible Product form from a management page, and put the Test Case count where users establish the page’s context.
- **Impact:** Product creation validation and success feedback remain unchanged; a new Product remains selected for the next recording. The modal exposes a labelled dialog and explicit Close/Cancel controls. The Test Case count updates as filters change.
- **Status:** Confirmed by project owner; verified by Product creation and frontend browser tests.

## D-017 — Product rename and filtered Test Case navigation

- **Date:** 2026-08-08
- **Decision:** Replace the Product availability label with **Edit** and **View Test Cases** actions. Only the Product creator may rename its required, trimmed name; blank and duplicate names receive the same clear validation as creation. **View Test Cases** navigates to the Test Case inventory with that Product preselected. The Product header action is named **New product** and matches the New recording action dimensions.
- **Reason:** Product rows should lead to useful management tasks rather than restate availability. Keeping rename authorization with the creator preserves the current ownership model, while the pre-filtered inventory makes the Product-to-Test Case relationship immediately inspectable.
- **Impact:** The authenticated API exposes a creator-authorized Product rename endpoint. The sidebar’s compact state persists when users navigate through its links and changes only through the top-bar toggle. Test Case search results have intentional visual separation from their search input.
- **Status:** Confirmed by project owner; verified by Product and frontend browser tests.

## D-018 — Chrome-free recording workspace and safe exit

- **Date:** 2026-08-08
- **Decision:** New recording opens a labelled modal from the authenticated top bar instead of a standalone form page. An active recording is rendered outside the App Shell: its header contains only Back to dashboard and the Test Case name on the left, with Save Test and Discard on the right. The Live Timeline receives 30% of the workspace and the remote browser 70%. Browser launch remains inside the empty browser stage.
- **Reason:** Recording is an attention-intensive task; the global sidebar and secondary top bar take useful browser width without helping the tester complete the active journey.
- **Impact:** Back never discards or navigates implicitly. It opens a decision dialog where Save Test Case or Discard Test Case are the only routes back to Dashboard; Continue recording only closes the dialog. The compact-sidebar preference now hydrates after the initial render, preventing server/client markup mismatch warnings.
- **Status:** Confirmed by project owner; verified through the frontend, Product, and remote-recording browser tests.

## D-019 — Locked live-browser boundary

- **Date:** 2026-08-08
- **Decision:** The Phase 1 remote Chromium session runs in kiosk app mode and uses a managed URL block-all policy. Only `http://demo-target` (and its paths) plus the exact internal recorder-event endpoint are allowlisted. Docker no longer publishes the Selenium WebDriver port to the host.
- **Reason:** The embedded browser is a controlled test surface, not a general-purpose browser. Testers need only interact with the approved demo journey, and direct host access to WebDriver would undermine that boundary.
- **Impact:** Browser chrome, tabs, and address-bar controls are not exposed to the tester; attempted off-target navigation is blocked by Chromium policy and has regression coverage. Chrome’s developer-tools policy is intentionally not set because it prevents ChromeDriver from creating the browser session; kiosk mode and URL enforcement remain the Phase 1 boundary. A production multi-user runner will additionally need authenticated noVNC access and network egress controls.
- **Status:** Confirmed by project owner; verified with the dedicated browser-lock and remote-recording tests.
