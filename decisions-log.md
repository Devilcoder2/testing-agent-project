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
- **Impact:** Browser chrome, tabs, and address-bar controls are not exposed to the tester; attempted off-target navigation is blocked by Chromium policy and has regression coverage. Sentinel closes its one controlled browser session when the draft is saved or discarded, preventing it from leaking into the next recording. Chrome’s developer-tools policy is intentionally not set because it prevents ChromeDriver from creating the browser session; kiosk mode and URL enforcement remain the Phase 1 boundary. A production multi-user runner will additionally need authenticated noVNC access and network egress controls.
- **Status:** Confirmed by project owner; verified with the dedicated browser-lock and remote-recording tests.

## D-020 — Recover the single local browser session before launch

- **Date:** 2026-08-09
- **Decision:** Phase 1 treats the Docker Chromium service as one global, replaceable recording session. Before launching a draft, Sentinel closes its tracked driver and asks Selenium to terminate any session occupying its only slot, including one left behind by a Sentinel restart. Browser startup is time-bounded, and the workspace returns to an actionable retry state when launch cannot complete.
- **Reason:** The Selenium service intentionally allows one session. Its session can outlive Sentinel’s in-memory driver reference, causing later launch requests to queue indefinitely and leaving the tester with disabled controls.
- **Impact:** Launching a new draft ends another active local recording browser; Phase 1 does not support concurrent recordings. A production runner must allocate sessions by owner/job instead of globally reclaiming them.
- **Status:** Confirmed by the owner’s request to fix the stuck launch flow.

## D-021 — Hide noVNC viewer controls in the Recording Workspace

- **Date:** 2026-08-09
- **Decision:** Hide noVNC’s control bar, its reveal handle, and viewer hints in the embedded Phase 1 Recording Workspace.
- **Reason:** Sentinel already owns launch, save, discard, and browser security. The noVNC controls provide clipboard, settings, fullscreen, and connection actions that are unnecessary for the restricted Demo CRM journey and take valuable recording width.
- **Impact:** Testers can still send mouse and keyboard input directly to the approved remote page, but cannot use noVNC viewer controls. Browser interaction policy remains enforced by kiosk mode and Chromium URL allowlisting.
- **Status:** Confirmed by project owner.

## D-022 — Phase 2 guided Runs and private evidence

- **Date:** 2026-08-09
- **Decision:** Phase 2 introduces an explicitly tester-guided Run of the current immutable Test Case version, limited to the Docker-local Demo CRM and the existing single isolated browser. The tester completes saved steps strictly in order; pass advances, fail ends the Run safely, and refresh resumes the existing Run. Full browser video remains prohibited. Screenshots are stored in a private Docker-local MinIO bucket, while redacted network, console, and storage metadata remains in PostgreSQL. Evidence links require product authorization and expire after 15 minutes.
- **Reason:** This supplies a useful, inspectable Run and evidence baseline without falsely claiming autonomous replay, prematurely introducing queue infrastructure, or storing a sensitive browser recording.
- **Impact:** Run outcome (`passed`, `failed`, `interrupted`) is distinct from capture status (`complete`, `partial`), so unavailable evidence cannot alter the factual test result. Phase 2 adds no Redis/BullMQ, skip/pause/cancel flow, external targets, retention automation, or stored video. Only one browser-backed recording or Run may exist locally at a time.
- **Status:** Confirmed by project owner; implementation in progress.

## D-023 — Keep guided Run browser sessions alive and make Demo CRM evidence observable

- **Date:** 2026-08-10
- **Decision:** Give the local Selenium browser a 30-minute guided-Run session limit and make the Demo CRM issue same-origin activity requests plus store minimal session state during successful sign-in and customer creation. Sentinel continues to capture only warning/error console output, not ordinary log noise.
- **Reason:** Selenium’s five-minute inactivity limit expires while a tester interacts through noVNC because noVNC input is not a WebDriver command. The original static demo performed no network request and stored no browser state, so its empty Network and Storage evidence was accurate but could not demonstrate the Phase 2 evidence contract.
- **Impact:** A normal guided Run has enough time for manual testing and produces START/END screenshots, request metadata, and redacted storage-key metadata. The Demo CRM remains a local fixture; production targets are not expected to add synthetic activity merely for Sentinel. A quiet Console panel on a successful journey remains correct unless the target emits a warning or error.
- **Status:** Confirmed by observed Phase 2 verification failure; implementation in progress.

## D-024 — Phase 3 autonomous replay safety model

- **Date:** 2026-08-10
- **Decision:** Keep Guided Run and Auto Run separate. Auto Run uses a Redis/BullMQ Playwright worker with two isolated local contexts, server-only Demo CRM credentials, ordered exact unique selector fallbacks, and one retry only for transient startup/navigation failures. Checkpoints are marked during new recordings, pause after the marked action for screenshot review up to ten minutes, and can resume or cancel. Free-text outcomes remain context; non-password variable-marked steps block Auto Run until Phase 4.
- **Reason:** Autonomous replay must add useful speed without guessing at ambiguous pages, persisting credentials, changing the established guided workflow, or prematurely implementing variable management.
- **Impact:** Auto Runs preserve attempt history, evidence, cancellation, checkpoint, and benchmark state in PostgreSQL. A missing/multiple selector fails safely; cancellation and checkpoint timeout interrupt without retry. Successful Auto Runs compare active duration with the median of three successful guided Runs of the same version when available.
- **Status:** Confirmed by project owner; implementation in progress.

## D-025 — Phase 4 local encrypted test-data lifecycle

- **Date:** 2026-08-12
- **Decision:** Phase 4 uses a product-scoped PostgreSQL Test Data Set pool with AES-256-GCM-encrypted fields, encrypted static defaults and Run bindings, and a pre-run form for both Guided and Auto Runs. Pool data is `SAFE`, atomically `RESERVED`, `CONSUMED` only after a passed Run, or manually `INVALID`; non-passing terminal Runs release reservations. Consumed and invalid data is replaced, never reset.
- **Reason:** This delivers all required static, pooled, and manual variable modes safely in local Docker without assuming an external data source or widening Sentinel’s database permissions.
- **Impact:** Product members can manage data-set metadata but cannot retrieve persisted raw values. Variable-marked steps store placeholders, secret-like values are rejected, and existing server-only password substitution remains outside the variable store. External test-data adapters and QA PostgreSQL state checks stay deferred to Phase 10.
- **Status:** Implemented and automated-acceptance verified on 2026-08-13; owner learning review remains pending.

## D-026 — Defer recording variable-name suggestions

- **Date:** 2026-08-13
- **Decision:** Remove Phase 4 automated variable-name suggestions. Testers enter safe canonical variable names manually.
- **Reason:** Capturing browser `input` events made a suggestion available earlier but created a recorded step for each keystroke. The existing `change`-event recorder preserves the required single meaningful text-entry step.
- **Impact:** The encrypted variable, Test Data, and binding workflows remain unchanged. Revisit suggestions only with a settled-value capture design that preserves event normalization and duplicate suppression.
- **Status:** Confirmed by project owner.

## D-027 — Reusable Test Data Sets with intentional single-use option

- **Date:** 2026-08-14
- **Decision:** Test Data Sets default to `REUSABLE`. A product member may deliberately create a `SINGLE_USE` set for unique values that must not be reused after a successful Run. A selected set is reserved to one active Run at a time. Reusable sets return to `SAFE` after every terminal outcome; single-use sets become `CONSUMED` only after a passed Run and otherwise return to `SAFE`. Existing consumed sets migrate to safe reusable sets.
- **Reason:** The previous policy consumed every passed data set, which prevented standard test fixtures from being reused even though reusable data is the main purpose of the Test Data feature. Some target-mutating values still need one-time protection.
- **Impact:** The local lifecycle continues to prevent concurrent reuse but does not clean up records in the Demo CRM or any future external target. Values remain encrypted and unreadable after creation. Testers choose single-use where target state makes sequential reuse unsafe.
- **Status:** Implemented and automated-acceptance verified on 2026-08-14; owner learning review pending.

## D-028 — Phase 5 immutable versions and safe Release batches

- **Date:** 2026-08-15
- **Decision:** Feature labels are reusable and product-local. A saved Test Case editor creates a new immutable version instead of changing the current version in place. Releases may span Products only for members of every included Product. Each batch snapshots current version IDs at start and submits only Auto-eligible items through the existing two-concurrency worker.
- **Reason:** Testers need practical organization and controlled maintenance, while old Runs and evidence must continue to describe exactly the historical Test Case that produced them. Reusing the proven Auto Run queue avoids a competing batch-execution system.
- **Impact:** Checkpoints and variables without encrypted static defaults are visible Release exclusions rather than hidden skips. Release readiness is derived from persisted item outcomes: only all-pass is Ready; failures, interruptions, and exclusions are Not ready. Guided Runs, schedules, manual/pool batch bindings, notifications, JIRA, and external targets stay outside Phase 5.
- **Status:** Implemented and automated-acceptance verified on 2026-08-15; owner learning review pending.

## D-029 — Recorded browser actions are read-only in the Test Case editor

- **Date:** 2026-08-19
- **Decision:** The saved-Test-Case editor may change labels, descriptions, expected outcomes, checkpoints, and non-secret text-entry variable marker names, but not recorded target metadata or literal/redacted input values. Marking a captured non-secret text step as a variable stores its default only in encrypted variable storage; removing a marker is not offered because the original plaintext is deliberately not retained.
- **Reason:** Target metadata and captured input values define the replayed browser action. Free-form edits could create a version that appears valid but clicks the wrong element or uses unreviewed test data. A purpose-based editor keeps annotations and execution settings maintainable without allowing an accidental action rewrite.
- **Impact:** To change a selector, URL, or literal browser input, testers create a new recording. Static defaults continue to be replaced in the dedicated Variables section, and existing historical versions remain unchanged.
- **Status:** Implemented and verified on 2026-08-19 with lint, type-check, focused API regression tests, and a live read-only browser-field check; owner learning review pending.

## D-030 — Phase 6 local health reporting and durable notification delivery

- **Date:** 2026-08-20
- **Decision:** Derive Dashboard health from existing currently authorized Test Case, Run, Release, and evidence records in a fixed rolling 30-day UTC window. Use a durable per-recipient Notification record and a dedicated BullMQ notification queue in the existing worker. Deliver local Phase 6 email through Mailpit, retry a transient SMTP failure exactly once, and keep delivery state independent of factual Run outcomes, Release readiness, and evidence capture.
- **Reason:** The product needs trustworthy, inspectable operational health and actionable notices before adopting a real provider or a second operational service. Persisting before queueing prevents a delivery failure from losing the in-app notification and makes the audit trail visible.
- **Impact:** Only failures, Auto Run checkpoints, and Release completion create new notifications. Recipients are de-duplicated owners/initiators, Release completion is one summary per Release owner/batch initiator, and Product authorization is re-checked on inbox links. Email contains only safe labels, state, time, safe reason, and a Sentinel link. Historic backfill, Slack, digests, user preferences, real provider credentials, approval notices, and user time zones remain deferred.
- **Status:** Implemented and automated-acceptance verified on 2026-08-20; owner manual and learning reviews pending.

## D-031 — Phase 7 deterministic, review-first negative-Test drafts

- **Date:** 2026-08-20
- **Decision:** Phase 7 generates suggestions only through explicit user action and deterministic rules over the current immutable Test Case version's captured validation metadata. It supports blank required-field, invalid-email, and one-character-outside boundary drafts for eligible non-secret, non-variable text entries. The Demo CRM adds 2–50 character first/last-name constraints solely as a local boundary fixture. The Review queue supports Draft, Approved, and Dismissed history; dismissed drafts can be reopened, but re-generation never duplicates a source-version/step/rule.
- **Reason:** This gives testers useful negative coverage that is explainable, reproducible, and safe without pretending an LLM understands arbitrary applications or creating reviewer fatigue from speculative cases.
- **Impact:** Passwords, variables, redacted or unsupported fields, and unknown validation constraints are skipped with a reason. A reviewer may edit only the draft's title, rationale, and safe proposed value. Approving atomically creates a separately owned Version 1 Test Case while retaining the source version, historical Runs, labels, and safe variable configuration. Suggestions never run, update a baseline, notify, file JIRA work, or reach an external target in Phase 7.
- **Status:** Implemented and automated-acceptance verified on 2026-08-20; owner manual and learning reviews pending.

## D-032 — Phase 8 reviewed Jira Cloud filing

- **Date:** 2026-08-20
- **Decision:** Phase 8 uses an optional server-side Jira Cloud adapter, one project-key mapping per Product, and an explicit failed-Run review-and-file workflow. Product creators manage the mapping; Product members file reviewed Bugs. Jira receives only safe summary/reproduction text and protected Sentinel Run Detail links. Each Test Case tracks one open Jira issue; later failed Runs comment on it, while a Done issue allows a replacement Bug.
- **Reason:** Human review prevents noisy or unsafe external tickets, Product mapping prevents cross-project mistakes, and protected links preserve Sentinel's evidence authorization instead of copying sensitive evidence into Jira.
- **Impact:** Jira Cloud credentials stay in environment configuration, filing is durable and idempotent per Run through the worker queue, and one transient delivery failure retries once. Jira side effects never alter Run, evidence, Release, or notification truth. Attachments, automatic filing, arbitrary Jira fields, Slack, and Jira Server/Data Center remain deferred.
- **Status:** Implemented on 2026-08-20. Lint, type-check, migration status, focused Jira adapter tests, and Phase 7 suggestion regression passed; real Jira Cloud and owner manual verification remain pending.

## D-033 — Phase 9 manual, owner-approved baseline changes

- **Date:** 2026-08-20
- **Decision:** A known QA deployment is recorded manually as context on a completed failed Run. The proposal can change only descriptions and expected outcomes; it is reviewed only by the Test Case's original owner. Approval creates a new immutable version only when the source remains current. Rejection creates an editable Jira draft if the Product is mapped, never an automatic Jira filing.
- **Reason:** Deployment/Git signals and automatic intent classification are not yet trustworthy enough to alter a replay baseline. Narrow annotation-only proposals make the operational difference visible while protecting browser action semantics and history.
- **Impact:** Submitted and decided proposals use the existing safe notification path. Stale proposals stop rather than merge with newer Test Case work. GitHub correlation, automatic classification, action/selector changes, and automatic ticket filing remain deferred.
- **Status:** Implemented and focused Docker API/database verified on 2026-08-20; owner manual and learning review pending.

## D-034 — Phase 10 explicit, fixture-scoped database diagnosis

- **Date:** 2026-08-20
- **Decision:** Phase 10 uses a separate Docker-local QA PostgreSQL fixture plus a Demo CRM customer-write API. Sentinel receives only a different `qa_diagnostic` role that can connect, use the public schema, and select from the one `qa_customers` table. The only diagnostic is an explicit completed-failed-Run `customer_lookup_by_email`; it derives the final eligible customer email transiently from immutable steps and encrypted bindings, rather than accepting an email or SQL from the user.
- **Reason:** A scoped fixture proves the least-privilege, parameterization, timeout, redaction, evidence, and authorization boundaries without accidentally granting Sentinel write access to its own application database or a future production QA system.
- **Impact:** The query runs in a read-only transaction with a 1.5-second timeout and a one-row limit. It persists and displays only found/not-found state, status, and timestamps, or a safe incomplete/unavailable error code. The email, raw row, SQL, credentials, and connection string are excluded from UI, API responses, evidence, audit data, logs, email, and Jira. A completed safe summary may enrich a later human-reviewed Jira draft; no diagnosis or Jira action is automatic.
- **Status:** Implemented with focused Docker fixture/role/adapter tests on 2026-08-20; full regression, owner manual review, and learning review remain pending.

## D-035 — Phase 11 controlled local-pilot boundary

- **Date:** 2026-08-20
- **Decision:** Treat Phase 11 as a Docker-local internal pilot only. Keep seeded named users, bind Sentinel, Demo CRM, and noVNC to localhost, retain Mailpit, and leave Jira optional. Product creators may transfer Product, Test Case, and Release ownership independently to eligible existing members; Test Case transfer reroutes submitted proposals to the new owner. Retain completed-Run detailed evidence and completed database diagnostics for 30 days, then remove them through worker maintenance while retaining safe history.
- **Reason:** The project needs a recoverable pilot operating boundary before adding the separately proposed organization roles, external identity, provider credentials, and production deployment model. Ownership continuity and bounded evidence storage address concrete pilot risks without broadening scope into administration.
- **Impact:** A Dashboard readiness panel checks local services, worker heartbeat, QA read-only access, retention state, and optional Jira configuration without exposing secrets. Jira HTTP 429 retries once after a validated `Retry-After` delay capped at 60 seconds. Real email, production Jira, external access, retention/legal policy, and role-based access remain future decisions.
- **Status:** Implemented with focused Docker verification on 2026-08-20; full regression, adversarial review, owner manual check, and learning review remain pending.

## D-036 — Phase 12 built-in multi-organization roles

- **Date:** 2026-08-22
- **Decision:** Use built-in local accounts, controlled organization bootstrap, PostgreSQL-backed eight-hour sessions, and Admin/Manager/Tester organization roles. Admins manage membership, Product access, and ownership; Managers manage QA work in assigned Products; Testers manage only their own Tests/Test Data while running any assigned Product Test. Invite/reset links are one-time and expire after 24 hours.
- **Reason:** The local pilot needs a real, immediately revocable authorization boundary before GitHub triggers or conversational controls can request Runs. An external provider, public signup, and custom roles would expand the first administration phase beyond its approved scope.
- **Impact:** Existing seeded data migrates into one demo organization. Product creators remain historical attribution, while role policy replaces creator-only Jira, ownership, and change-approval authority. Disabled users preserve history but lose effective access and sessions immediately.
- **Status:** Confirmed by project owner; implementation pending.

## D-037 — Phase 13 multi-repository, source-aware failure analysis

- **Date:** 2026-08-24
- **Decision:** Extend optional Phase 13 so a Product can connect more than one GitHub repository, such as separate frontend and backend repositories. Associate every source-triggered Run and any diagnosis with one exact repository, branch, and commit. After a completed failed Run, an authorized user may request an advisory source-aware analysis. Use Repomix only in an isolated worker to package a selected read-only checkout with remote configuration disabled; persist safe findings and source references, never raw packed code.
- **Reason:** A realistic Product often spans frontend and backend codebases. A Run failure is more useful when Sentinel can relate redacted Run evidence to the exact source revision that triggered it, but indiscriminately packaging or retaining whole repositories would create an unacceptable secret, privacy, and cost boundary.
- **Impact:** GitHub App read-only repository access, webhook verification, commit pinning, explicit analysis requests, bounded context selection, secret scanning, and provider/retention decisions become Phase 13 requirements. Findings may provide an explained likely cause, recommended fix, file path, and line range, but never automatically alter code, Tests, Jira, or pull requests. Full source code, Repomix output, provider prompts/responses, and GitHub tokens remain ephemeral.
- **Status:** Confirmed on 2026-08-24: GitHub App authentication, Cloudflare Tunnel for optional local webhook ingress, explicit Test Case-to-repository routing, automatic analysis only for GitHub-triggered failed Auto Runs, manual repository/SHA choice for other failed Runs, and OpenAI Responses structured output with `store: false`. Implementation in progress.

## D-038 — Begin the product-wide UI/UX revamp on the delivered Phase 12 surface

- **Date:** 2026-08-24
- **Decision:** Begin Phase 15 against every currently implemented Phase 12 route before the optional GitHub and conversational-integration phases. Retain the dark operations identity, local system typography, semantic status palette, and custom React/CSS approach; add an internal SVG icon set and reusable accessible interaction primitives without adding a frontend framework or changing API contracts.
- **Reason:** The repository and live-interface audit found immediate usability and accessibility debt in delivered workflows: health information is buried below readiness detail, large Test Case and Run inventories are unbounded, Run evidence is raw-JSON-first, Review combines distinct queues, Test Case actions compete, and Administration uses inconsistent native multi-select and immediate-save behavior. Waiting for optional future integrations would prolong those problems without improving the redesign inputs.
- **Impact:** `frontend.md` is the approved Phase 15 design source of truth. The redesign may change layout, client-side paging, URL-backed filters, dialogs, and when Administration sends its existing PATCH request, but it must not change authorization, persistence, queueing, Run/evidence semantics, privacy boundaries, or API shapes. Phases 13–14 remain optional and must adopt the resulting design system if later approved.
- **Status:** Implemented and focused browser/build verified on 2026-08-24. Full learning/usability review and two Guided Run assertions remain pending because an existing user-owned Guided Run is still active.
