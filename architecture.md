# Sentinel Architecture

**Status:** Provisional MVP baseline  
**Date:** 2026-08-05  
**Related requirements:** [`srd.md`](srd.md)

## 1. Architectural goals

- Make recording, replay, evidence, and human approval reliable before adding advanced intelligence.
- Keep product data, evidence, integrations, and job execution isolated behind clear boundaries.
- Treat uncertainty as a safety stop rather than an automatic guess.
- Enforce read-only database access technically, not only through application convention.
- Support multiple products and 10 concurrent users without prematurely building a distributed platform.

## 2. Provisional system shape

```mermaid
flowchart LR
    U["Named user"] --> W["Sentinel web app"]
    W --> API["Application API"]
    API --> DB["Sentinel PostgreSQL"]
    API --> Q["Run job queue"]
    Q --> Worker["Browser worker"]
    Worker --> Target["Product QA website"]
    Worker --> Capture["Evidence capture"]
    Capture --> Store["S3-compatible object storage"]
    Worker --> API
    API --> JIRA["JIRA adapter"]
    API --> Notify["Email / optional Slack adapter"]
    API --> RO["Read-only DB adapter"]
    RO --> QA[("QA PostgreSQL")]
```

## 3. Components and responsibilities

### Web application

Provides authentication, a product-authorized health dashboard, product and Test Case management, Recording Workspace, Run Detail, Releases, notification inbox, a Phase 7 review queue, approvals, and manual actions. Its route-based App Shell uses the clean-sheet Sentinel system documented in [`DESIGN.md`](DESIGN.md) and [`frontend.md`](frontend.md): a command masthead, grouped section navigation, accessible semantic controls, equal light/dark themes, and a desktop-first focused Recording Workspace. It never directly owns browser automation or external integration credentials.

Phase 15 keeps this frontend inside the modular monolith and adds no client state service or backend-for-frontend layer. Shared React primitives own presentation concerns such as navigation, dialogs, tables, tabs, pagination, status, loading, and responsive disclosure. Feature views continue to call the existing authorized API routes and retain their current polling and mutation boundaries. Client-side inventory pagination operates only on already-authorized complete responses; it does not change record visibility or server authorization. Structured evidence views format existing protected payloads and keep raw evidence available without copying it into a new store.

Phase 16 replaces the rendered frontend without changing that boundary. Theme selection is a presentation-only client preference: an inline pre-render bootstrap reads `sentinel-theme` or the system color preference and sets the root `data-theme` attribute before paint; a React control updates that attribute and local storage. Theme state never enters an API request, database record, authorization decision, or server cache. The existing feature views keep their request/state logic while their composition and shared primitives adopt the new system.

Phase 22 adds an Admin-only Product-retirement interaction without moving destructive work into React. The Product row exposes Edit and Delete as labelled icon controls and keeps secondary integrations, ownership transfer, and the filtered Test Case link in one keyboard-dismissible overflow menu. The client requests a server-derived impact summary, requires exact `DELETE` confirmation, receives HTTP 202 with a durable deletion-request ID, and polls that safe status while the Products page remains open. Returning later reloads the request state from PostgreSQL.

### Application API

Validates user permissions, persists domain state, starts jobs, derives dashboard health metrics using a rolling UTC window, exposes Run/evidence/notification metadata, generates deterministic Phase 7 suggestion drafts, records audit events, and coordinates approval and integration workflows. Phase 11 adds explicit creator-authorized ownership transfer endpoints and an authenticated, read-only pilot-readiness projection. API operations are the authorization boundary for all writes.

### Sentinel PostgreSQL

Stores users, product membership, Test Cases, versioned steps, variables, Releases, Runs, step results, Notifications, Phase 7 suggestion drafts, proposals, approvals, integration references, and audit records. Large evidence files are stored outside the relational database.

### Run queue and browser workers

Phase 2 retains one explicitly user-started guided Run directly in the existing noVNC browser. Phase 3 adds Redis/BullMQ and one worker service: the API atomically persists an Auto Run and attempt before enqueueing its ID, while the worker owns a headless Playwright context for that attempt. Phase 6 uses a separate BullMQ notification queue in that same worker service: the API persists each Notification before queueing its delivery, and the worker retries only one transient SMTP delivery failure. Phase 11 adds a short-lived Redis worker heartbeat and startup/daily evidence-retention maintenance. Maintenance records safe outcome counts in PostgreSQL, deletes old MinIO objects before matching detailed evidence rows, and skips active Runs. Worker concurrency is fixed at two for browser jobs in local Docker. Jobs, attempts, and database state make enqueue/retry idempotent; the worker never shares the guided Selenium/noVNC browser.

Phase 22 adds a single-concurrency Product-deletion queue to the same worker service. The API authorizes the Admin, snapshots safe impact counts, persists one request per live Product, and enqueues only its ID. The worker claims the request idempotently, interrupts active Product Runs and recordings, removes queued Auto Run jobs where possible, deletes every Product evidence object from MinIO with bounded parallelism, and only then executes the ordered PostgreSQL deletion transaction. Release and Release Run parents remain; their Product-linked join/items are removed and remaining readiness is recalculated. Product-owned records, integration links, Test Data, suggestions, proposals, notifications, recordings, Tests, Runs, and the Product are deleted. Audit events plus the completed/failed deletion request remain. A failed object deletion prevents the relational delete and is retried, avoiding unreachable evidence objects.

### Browser recording and replay

Playwright is the autonomous replay boundary for Chromium-based web testing. Each Phase 3 Auto Run uses a fresh headless Chromium context. It executes only the allowlisted Demo CRM, resolves selectors through ordered exact unique matches, and stops on missing or ambiguous matches. The first navigation uses the immutable Run target inherited from the allowlisted recording; later navigation records verify URL state after the preceding action. Password values come from worker-only configuration and free-text expected outcomes remain context rather than inferred assertions.

Phase 4 adds a server/worker-only variable boundary. AES-256-GCM encrypts reusable static values, local Test Data Set fields, and immutable per-Run bindings using a required deployment key. Recorded and saved steps contain placeholders, not variable values. A pre-run transaction validates product membership and local pool eligibility, creates encrypted bindings, reserves any selected pool data set, and then creates the Guided or Auto Run. Every set has an explicit reuse policy: reusable sets return to safe after any terminal Run outcome, while single-use sets become consumed only after a passed Run. The reservation remains exclusive while a Run is active, preventing concurrent use of the same values. Guided replay and the worker decrypt only the binding required to perform a text action. Evidence, audit text, API detail responses, queues, and browser logs receive only variable names, source metadata, and masked placeholders. Existing consumed sets are migrated to safe reusable sets. External pool adapters and read-only QA-database verification remain Phase 10 work.

Phase 5 adds feature-label and Release aggregates to the same modular monolith. A product-local feature-label record is joined to a Test Case, while a Test Case edit transaction clones the current version's ordered steps and variable configuration into the next immutable version. Existing versions and Runs are never altered. A Release owns a set of Test Case tags and a Release Run snapshots their exact current version IDs before submitting eligible items to the existing Auto Run queue. Each Release Run item keeps its own status, exclusion reason, and linked Auto Run. A shared completion helper projects linked Run terminal outcomes into the Release Run and derives readiness; it does not alter an individual Run's existing evidence, attempt, retry, or authorization boundary.

Phase 7 adds a deterministic rule module and a `TestSuggestion` aggregate without a new service or third-party model. The API takes a snapshot of the source Test Case's current immutable version, then considers only captured non-secret, non-variable text-entry validation metadata. It persists at most one suggestion for each source version, source step, and rule, so repeat generation is idempotent and historical dismissals are retained. Draft edits are limited to title, rationale, and a safe proposed value. Approval is a single PostgreSQL transaction: it creates an independent saved recording fixture and a new owner-approved Test Case with a new immutable Version 1, copies labels and safe variable configuration, applies only the proposed step value, links the suggestion, and writes audit events. It never schedules or starts a Run. Product membership is rechecked for every generation, queue query, draft action, and derived Test Case link.

For Phases 1–2, Sentinel hosts one local Chromium session in Docker and exposes its noVNC viewer inside a focused workspace. The embedded viewer hides noVNC's own clipboard, settings, fullscreen, and connection controls so it acts only as the remote display and input surface. Chromium runs in kiosk app mode, and managed browser policies block every URL except the allowlisted demo target and the exact internal recorder-event endpoint. Kiosk app mode removes the browser chrome and the host does not expose the WebDriver port. Developer Tools policy cannot be disabled in this Selenium design because ChromeDriver requires the same browser debugging protocol; URL policy remains the enforced navigation boundary. Before a new launch, Sentinel closes the browser it knows about and reclaims any Selenium session occupying the single slot, including a session that outlived a Sentinel restart. Each startup operation is time-bounded; a failed launch returns a retryable error rather than holding the workspace in a disabled state. The local Selenium node allows a guided session to remain idle for 30 minutes because noVNC input does not itself reset Selenium's idle timer. This replacement behavior is global to Phase 2: a browser-backed recording and a browser-backed Run cannot coexist. The Sentinel server attaches to that session through WebDriver, injects the Phase 1 recorder when teaching, and injects Phase 2 in-page fetch and warning/error-console instrumentation when guiding a Run. Password values are redacted before they leave the browser page.

### Evidence capture

Phase 2's API-led guided Run captures screenshots at start, end, and failure; network metadata and redacted allowlisted text/JSON snippets; warning/error console messages; and redacted cookie, local-storage, and session-storage metadata at step boundaries. Phase 3 reuses that persistence boundary for Playwright evidence, adding checkpoint screenshots. It never captures or retains browser video. The local Demo CRM deliberately issues same-origin activity requests and records minimal session state after its successful journey, so the evidence fixture demonstrates these capture paths; a quiet Console panel remains correct for a target that emits no warning or error. Screenshot binaries live in a private Docker-local MinIO bucket; PostgreSQL stores searchable metadata, checksums, object keys, timeline links, attempt links, and capture errors. In local development, MinIO's S3 endpoint is bound only to the host loopback interface so a browser can follow a Sentinel-authorized 15-minute signed `localhost` URL without making the bucket reachable from the wider network. The bucket remains private and Sentinel verifies product membership before issuing the URL. The Run outcome (`passed`, `failed`, or `interrupted`) is independent from evidence status (`complete` or `partial`), so missing evidence does not misrepresent the test result.

### Read-only database adapter

Phase 10 makes this boundary concrete with a separate Docker-local `qa-postgres` fixture and `qa-fixture` write API. The Demo CRM writes created customers to that fixture using its own writer role; Sentinel's `QA_DATABASE_URL` uses a separate `qa_diagnostic` role with only `CONNECT`, schema `USAGE`, and `SELECT` over the one allowlisted `qa_customers` table. Startup SQL grants neither DML nor schema creation, and an automated privilege check verifies that boundary.

The API exposes no SQL input. For a completed failed Run, a Product member explicitly requests `customer_lookup_by_email`. The adapter derives the last eligible email field transiently from immutable steps and encrypted bindings, then uses a parameterized, one-row query in a read-only transaction with a 1.5-second timeout. It returns only found/not-found state, status, and timestamps. A `DatabaseDiagnostic` plus `DATABASE` evidence stores that safe summary or a safe incomplete/unavailable error code; no raw email, row, query, credential, or connection string crosses the API/evidence/Jira boundary. Jira draft generation may read this safe summary, but nothing is automatically filed. Sentinel has no generic SQL editor in v1.

### Integration adapters

Jira Cloud, email, and optional Slack calls are isolated behind adapters. Phase 8 adds one server-configured Jira Cloud connection and a Product-scoped project-key mapping that only the Product creator can change. A failed-Run filing is first persisted as a safe reviewer-editable draft, then a BullMQ job creates a fixed Bug or comments on the Test Case's linked open issue. A unique filing record per Run, an open-issue check, and adapter-level retry make external side effects idempotent. The adapter transfers only a safe summary, immutable reproduction steps, and a protected Sentinel Run Detail link; it never transfers evidence binaries, signed object URLs, raw operational evidence, variables, or credentials. Jira delivery state cannot alter factual Run/Release/evidence state. Phase 6 provides a local SMTP email adapter pointed at the Docker-local Mailpit service. Slack stays deferred until the email path and audit behavior are proven.

Phase 11 keeps Jira optional for the local pilot. HTTP 429 becomes a transient adapter error carrying only a validated retry delay; BullMQ performs one retry after that delay, capped at 60 seconds. Local Docker remains a non-production boundary: public ports bind only to localhost and seeded development identities are not an Internet-facing authentication design.

## 4. Core data relationships

```mermaid
erDiagram
    USER ||--o{ TEST_CASE : owns
    PRODUCT ||--o{ TEST_CASE : contains
    TEST_CASE ||--o{ TEST_VERSION : has
    TEST_VERSION ||--o{ STEP : contains
    TEST_CASE ||--o{ RUN : executes
    TEST_VERSION ||--o{ TEST_VARIABLE : configures
    PRODUCT ||--o{ FEATURE_LABEL : defines
    TEST_CASE ||--o{ TEST_CASE_FEATURE_LABEL : organizes
    FEATURE_LABEL ||--o{ TEST_CASE_FEATURE_LABEL : applies
    PRODUCT ||--o{ TEST_DATA_SET : owns
    RUN ||--o{ STEP_RESULT : records
    RUN ||--o{ RUN_VARIABLE_BINDING : resolves
    RUN ||--o{ DATABASE_DIAGNOSTIC : explains
    RUN ||--o| EVIDENCE_BUNDLE : produces
    RELEASE ||--o{ RELEASE_TEST : includes
    TEST_CASE ||--o{ RELEASE_TEST : tagged
    RELEASE ||--o{ RELEASE_RUN : batches
    RELEASE_RUN ||--o{ RELEASE_RUN_ITEM : snapshots
    RUN ||--o| RELEASE_RUN_ITEM : executes
    USER ||--o{ NOTIFICATION : receives
    PRODUCT ||--o{ NOTIFICATION : scopes
    RUN ||--o{ NOTIFICATION : concerns
    RELEASE_RUN ||--o{ NOTIFICATION : summarizes
    PRODUCT ||--o{ TEST_SUGGESTION : scopes
    TEST_CASE ||--o{ TEST_SUGGESTION : sources
    TEST_VERSION ||--o{ TEST_SUGGESTION : snapshots
    STEP ||--o{ TEST_SUGGESTION : varies
    TEST_SUGGESTION ||--o| TEST_CASE : approves_into
    TEST_CASE ||--o{ CHANGE_PROPOSAL : receives
    USER ||--o{ CHANGE_PROPOSAL : approves
```

Important invariants:

- A Test Case has exactly one current owner and one product.
- A saved Test Case references an immutable version; edits create a new version or proposal rather than mutating historical Runs.
- A Run points to the exact Test Case version used.
- A Test Case version and its ordered step kinds are immutable after save; an edit creates the next version in one transaction.
- A Release Run snapshots versions at batch start, so later Release tag edits cannot change an already-started batch.
- Release readiness is derived from every persisted item; a checkpoint, missing static variable default, or other ineligible item is visible as excluded rather than skipped.
- Evidence belongs to one Run and is access-controlled through the Run’s Test Case and product.
- A Notification belongs to one recipient and references the Product, Run, or Release Run that caused it; opening the notification or its link rechecks the recipient’s current authorization.
- A Test Suggestion belongs to one Product, source Test Case, immutable source version, source step, and deterministic rule. It never mutates that source or runs before an authorized product member approves it.
- Approving a Test Suggestion atomically creates a separately owned Test Case and immutable Version 1; the proposal changes one safe text value only and keeps its source relationship for auditability.
- An approval is tied to the owner identity at the time of the decision and is auditable.
- A Change Proposal belongs to one failed Run, immutable source Test Case version, original owner, and creator. Its child rows identify source steps and proposed description/expected-outcome replacements only; they never carry changed replay actions or secret values.
- Approving a Change Proposal checks that the Test Case still points to its source version, then atomically creates the next immutable version. A changed current version makes the proposal stale instead of merging or overwriting it.
- Rejection may create a Phase 8 JiraFiling in `DRAFT` state when a Product mapping exists. It is not a queue side effect and requires the usual explicit filing review.

## 5. Security boundaries

- Use server-side sessions or short-lived tokens; never expose provider secrets to the browser.
- Isolate each replay in a fresh browser context and redact configured secrets before persistence.
- Treat network payloads, cookies, storage, videos, and database results as sensitive data.
- Encrypt transport and stored evidence; use object-storage lifecycle and access policies.
- Validate target URLs against an approved QA environment policy to avoid unintended production access.
- Apply product-level authorization to Test Cases, Runs, evidence, releases, and approvals.
- Use a separate read-only QA database role and verify permissions in deployment checks.
- Record who created, edited, ran, approved, rejected, or externally filed an item.

## 6. Failure and consistency model

- Phase 3 Auto Run lifecycle adds `paused` and `cancelling` around the existing queued/running/completed state. A marked checkpoint pauses after the action and expires after 10 minutes; cancellation captures final available evidence then completes as interrupted. A technical failure can create exactly one linked retry attempt; unsafe selectors and user-visible action failures never retry.
- The API persists step and evidence events incrementally so a browser or capture failure leaves useful partial evidence and an actionable error.
- Retries create a new Run attempt record or a clearly linked retry, never silently overwrite the original.
- JIRA creation uses an idempotency key derived from the tracked failure; duplicate detection is checked before create.
- Notification delivery is asynchronous and retryable; notification failure must not change the Run result.
- Change Proposal submission and owner decisions create the existing durable notifications after their database transaction. Delivery failure cannot alter proposal status, Test Case version history, or Jira draft state.
- Dashboard statistics are read-model calculations over only currently authorized Products and fixed UTC 30-day boundaries; they never mutate Run or Test Case history.
- Database insight is best-effort diagnostic context. A query timeout or denied query is visible as incomplete context, not a test pass.

## 7. Why this is appropriately simple for the MVP

For 10 concurrent users, one web application, one relational database, one job queue, and isolated browser workers are sufficient. A modular monolith keeps transactions and ownership logic easy to understand. Evidence storage and workers are separate because browser execution and binary retention have different resource profiles.

The design avoids Kubernetes, microservices per feature, a general-purpose AI agent, and generic SQL execution. Those alternatives add operational and security complexity before the core teach-and-replay workflow is proven.

## 8. Major alternatives considered

| Decision | Provisional choice | Simpler or competing alternative | Reason |
|---|---|---|---|
| Browser control | Playwright | Raw browser protocol or Selenium | Strong event, network, video, context, and multi-browser support with a TypeScript API. |
| Application shape | Modular monolith | Feature microservices | Lower operational cost and clearer transactions at the initial scale. |
| Evidence | Object storage plus metadata | Store all evidence in PostgreSQL | Better for large video and logs; database remains queryable. |
| Work execution | Durable queue and workers | Run browsers inside web requests | Prevents request timeouts and isolates concurrency. |
| Change handling | Human approval workflow | Silent self-healing | Safety and auditability are more important than eliminating review. |
| Database insight | Allowlisted read-only queries | Generic SQL endpoint | Limits data exposure and prevents write capability. |

## 9. Deferred architecture decisions

- Identity provider and shared-login identity mapping.
- Final frontend deployment platform; the UI foundation is custom React components and CSS tokens as documented in `frontend.md`.
- Evidence storage provider, retention, redaction, and budget.
- Queue implementation and concurrency limits.
- JIRA authentication, project, fields, and duplicate key.
- Email/Slack provider and delivery policy.
- Database schema discovery and approved diagnostic query catalog.
- Ownership reassignment workflow.

## 10. Phase 12 identity and organization boundary

Phase 12 keeps Sentinel as a modular monolith but replaces the signed identity-only development cookie with persistent server-side sessions. PostgreSQL stores organizations, organization memberships/roles, active/disabled account state, password hashes, one-time invitation/reset token hashes, and sessions. The browser receives only an opaque, HttpOnly, same-site session identifier; every request resolves the active user and organization membership from PostgreSQL, so disablement, role changes, and Product-access removal revoke access immediately. Protected client requests share one authentication-failure boundary: the first HTTP 401 coalesces concurrent failures, sends a best-effort logout request that clears the HttpOnly cookie, and replaces browser history with the sign-in route. HTTP 403 and other failures continue through feature-level error handling. Public authentication requests do not use the protected-request redirect behavior, so invalid credentials remain visible on the sign-in form.

Products gain an organization boundary; their existing Product memberships scope Managers and Testers, while an active organization Admin has full access within that organization. Product-linked records inherit organization isolation through their Product. Existing queued work must re-check active authorization before sensitive worker actions; evidence links, notifications, Jira, diagnostics, and ownership transfers use the same policy layer. Local Mailpit delivers invitation and reset links only; no production identity provider or email service is introduced in this phase.

## 11. Phase 13 GitHub trigger and source-analysis boundary

Phase 13 adds two durable BullMQ work streams to the existing modular monolith: a GitHub-delivery processor and a source-analysis processor. The public webhook endpoint receives a raw GitHub delivery, validates its HMAC signature before parsing it, stores only safe routing metadata, and creates a deduplicated delivery record. The delivery processor looks up every active Product repository connection for the exact installation/repository/branch, evaluates explicit Test Case links and existing Auto Run eligibility, atomically creates linked Auto Runs, and queues them through the existing two-concurrency browser worker. A GitHub delivery may safely route one repository push to several independently configured Product connections without mixing their authorization or Run history.

GitHub access uses a server-only GitHub App. The API and worker obtain short-lived installation tokens only when needed; the browser never receives App keys, webhook secrets, installation tokens, clone URLs, or source content. Repository connections persist only safe identifiers, labels, branch allowlists, and installation references. Admins and assigned Managers configure them; workers re-check the connected Product and active organization boundary before triggering or analyzing work.

After an Auto Run linked to a GitHub commit completes as failed, the worker creates one `SourceAnalysis` request. A manual failed Run can create the same request only after an authorized member explicitly chooses a permitted connection and commit. In an isolated temporary directory the analysis worker checks out exactly that commit read-only, gets changed-file metadata relative to the supplied parent commit, filters source through the context policy, and invokes Repomix in local-checkout mode with remote configuration disabled. It scans before and after packing, blocks rather than sends suspicious material, enforces bounded files/bytes/tokens/time, and deletes the checkout, packed context, prompt, response, and short-lived token on completion or failure.

The remaining safe context flows to the OpenAI Responses API from the worker only. `store: false` and a strict JSON-schema response contract constrain the result to evidence-backed observations, clearly separated hypotheses, confidence, remediation, optional review-only patch text, validated source references, and limitations. The database retains this safe structured diagnosis for 30 days; it never retains raw source, prompt, provider response, webhook body, or credentials. A diagnosis is an advisory overlay on a factual Run: it cannot change outcomes, evidence status, Test Cases, Releases, Jira state, repository source, or GitHub workflows.

## 12. Global search boundary

The authenticated App Shell owns one debounced search combobox. It calls one read-only `GET /api/search` route with the normalized query and current section. A dedicated server module performs capped PostgreSQL prefix queries in parallel, projects every match into a small shared result contract, and orders the current section first. The client cancels stale requests and owns only transient query, loading, open, and active-result state.

Search reuses the existing organization and Product authorization predicates rather than loading unrestricted records and filtering them in the browser. Products, Test Cases, Test Data, Runs, Releases, Review items, and notifications inherit their current protected relations. Organization-member results execute only for Admins. Returned fields are limited to result ID, section, safe title, safe context label, protected destination, and optional safe status; raw values and evidence never cross the boundary.

PostgreSQL case-insensitive `startsWith` filters and five-result category caps are appropriately simple for the controlled ten-user pilot. No new index, search engine, cache, queue, persisted search history, or analytics stream is introduced. If measured volume later makes these queries unsuitable, a search index may replace the server module only after retaining the same authorization and response contract.

## 13. Recording workspace focus layout

`RecordingWorkspaceView` owns two transient, client-only layout states: whether its Step Log rail is collapsed and whether its browser stage is in application full-screen mode. They are not API fields, session data, recording metadata, or browser-automation controls. The collapsed class changes the CSS grid from the normal 30/70 split to a narrow Step Log rail plus a flexible browser stage. The rail keeps a labelled expand control so keyboard users can restore the log.

Full-screen mode is a CSS layout state on the focused Recording Workspace, not the browser Fullscreen API. It removes the recording session bar and Step Log from layout, gives the stage the full viewport, and leaves an overlay minimize control in Sentinel's own document. Exiting restores the prior collapsed/expanded Step Log state. Because the noVNC iframe, Chromium kiosk policy, and existing server launch path are untouched, this layout control cannot reveal the remote viewer toolbar, obtain a new permission, navigate to another target, or affect recording events and redaction.

The same desktop-width guidance remains the outer guard. Below the supported breakpoint, neither the workspace grid nor focus controls replace the explicit desktop guidance state. CSS transition rules use the established reduced-motion override, while visible focus and native button semantics preserve keyboard access.

## 14. Persistent workspace navigation boundary

The authenticated command masthead, section navigation, global search, theme control, and New Recording entry point form one client-side shell owned by the root application layout. The shell persists while its workspace child route changes, rather than being recreated independently by Dashboard, Products, Test Cases, Test Data, Runs, Releases, Review, Notifications, and Administration pages. Existing page-level `AppShell` wrappers remain temporarily compatible but collapse to their children when the persistent boundary is already present.

The shell treats the most recent workspace-link click as the pending destination immediately, keeps navigation interactive while Next.js prepares the route, and clears pending state when the pathname commits. It also prefetches the finite primary-section route list after mount. This improves perceived and actual repeat navigation without creating another router, cache, state library, API, or authorization path.

Authentication and task-focused layouts remain outside this boundary. Sign-in, invitation, and password-reset pages retain their standalone account composition. Recording Workspace and Run Workspace keep their intentional full-stage layouts. The New Recording dialog is loaded on demand because it is not required for ordinary section navigation. No API request, permission predicate, evidence boundary, browser session, or persisted record changes as part of this navigation architecture.

## 15. Phase 14 Telegram assistant boundary

Phase 14 adds a provider adapter inside the existing modular monolith, not a public Sentinel deployment. A dedicated `telegram-webhook-gateway` reverse proxy accepts exactly `/api/internal/telegram/webhook` and returns 404 for every other path. A separate optional `telegram-tunnel` Cloudflare Tunnel profile points only to that gateway. The normal Sentinel, noVNC, Demo CRM, and GitHub tunnel profiles remain unchanged and localhost-bound; no Telegram configuration can make an application page public.

The public webhook route validates Telegram's secret header before it accepts a compact private-chat update. It writes only safe metadata to PostgreSQL, creates a deduplicated inbound-update record, acknowledges callback queries without waiting for work, and hands processing to a dedicated BullMQ messaging queue. The provider adapter uses native `fetch` for webhook configuration, callback acknowledgement, and `sendMessage`; the token and secret live only in server/worker environment configuration. An encrypted `MessagingIdentity` holds a private chat identifier ciphertext plus a deterministic lookup hash. It is linked from a short-lived, hashed `TELEGRAM_LINK` token issued only to an authenticated Sentinel user.

Messaging command state, selected Test references, update metadata, and outbound-delivery state are durable records rather than message text. A five-minute selection confirmation and its opaque callback action references resolve to server-side state. On confirmation, the service re-evaluates the active user, organization, role, Product membership, current Test version, target policy, checkpoint policy, and static-only variable eligibility in one transaction. It delegates eligible work to the existing Auto Run creation path, so run version binding, evidence capture, retry behavior, browser concurrency, audit history, and authorization remain canonical. It never creates a Release Run or shares a visible guided browser.

When an attributed Telegram Auto Run reaches a terminal state, the worker writes one requester-only durable outbound delivery. The delivery processor decrypts the chat ID only long enough to render and send a safe fixed-template result, with per-chat pacing and one retry for a transient provider failure. It never serializes a Run URL, screenshot, evidence body, variable value, credential, provider payload, raw message, or source-analysis data. A daily worker maintenance task removes terminal messaging command and delivery metadata after thirty days; unlinking revokes the usable endpoint immediately while safe audit events remain.

## 16. Tabular Test Data and row-reservation boundary

`TestDataSet` becomes the Product-scoped named table and `TestDataRow` owns ordered encrypted cells plus `SAFE`, `RESERVED`, `CONSUMED`, or `INVALID` state. `RunVariableBinding` retains the parent data-set reference for filtering/history and adds the exact row reference used for the immutable encrypted binding. The migration converts every existing single-record set into row 1 and links historical bindings where possible; it never decrypts data in migration SQL.

Create and update APIs accept structured columns and rows, canonicalize and validate every field/cell, and encrypt each complete row independently with the existing AES-256-GCM boundary. List/detail responses expose only field names, row identity/order/status, counts, and masked cell presence. During an edit transaction the server may decrypt an existing row solely to merge explicitly replaced cells with retained masked cells; plaintext is never returned, logged, audited, queued, or written outside the new ciphertext. Structural updates require every existing row to be safe, preventing a reserved or historical single-use row from changing underneath a Run.

The browser owns only table composition and `.xlsx` parsing. `read-excel-file/browser` is loaded on demand after file selection, reads the first worksheet locally, and produces the same structured payload as manual entry. The workbook binary is never sent to Sentinel. Client checks improve feedback, while the API repeats all limits and secret-like validation as the authoritative boundary.

Guided execution reserves one explicitly selected safe row because the Selenium/noVNC service permits one live session. Auto execution with pooled variables accepts one compatible data-set identity and snapshots all currently safe row IDs inside one PostgreSQL transaction. It creates one Run/attempt/binding set per row and atomically changes every selected row to reserved; any validation or reservation conflict rolls back the complete database batch. Each created Run is then submitted independently to the existing BullMQ queue, so queue delivery failures use the existing per-Run terminal-failure path without undoing successfully delivered siblings. Static/manual bindings may be repeated across the row batch; choosing multiple pooled data sets in one Auto batch is rejected to avoid undefined Cartesian or positional joins.

## 17. Public marketing and pilot-waitlist boundary

Phase 26 adds a separate deployable marketing application under `marketing/` while preserving the authenticated Sentinel application, its root sign-in route, and its organization session boundary. The marketing application is a narrative React surface with no direct database access, authentication cookie, product API token, or shared client state. It reads public build-time configuration for the product sign-in URL, public waitlist endpoint, Turnstile site key, managed video identifier, canonical origin, and public legal/contact content.

The interactive product proof is not an iframe or a deployment of the authenticated product. It is a purpose-built React component inside `marketing/` backed by immutable local fixtures and ephemeral view-selection state. It may display representative Product, Test Case, Test Data, Run, Release, Review, and evidence records and may change the selected view, tab, or evidence item. It must not import authenticated product bundles, call product routes, persist visitor state, set cookies, accept credentials, or render mutation controls. The preview remains useful when the product origin and public waitlist API are unavailable.

The marketing application initially renders only the sanitized walkthrough poster. A visitor action creates the managed Stream player inside an accessible dialog; closing it destroys the player and restores focus. Supporting screenshots, when used, come from development fixture data only and must pass full-resolution and theme-consistency review. The feature gallery uses native horizontal overflow and CSS snap points; previous/next controls move one card group, and a native dialog provides focus containment, Escape dismissal, focus restoration, and a blurred visual backdrop. Motion is presentation-only, lazy-loaded, bounded to small opacity/transform changes, and disabled through the reduced-motion preference. A privacy route, sitemap, robots response, canonical metadata, structured data, and one branded social card share the same public content source.

The authenticated application owns the public `POST /api/public/pilot-waitlist` boundary. It does not read a Sentinel session and never sets or accepts credentials. The handler rejects non-JSON or oversized requests, non-empty honeypots, origins other than the exact configured marketing origin, and invalid or expired Turnstile tokens verified server-side. Infrastructure rate limiting runs before persistence. Email normalization and a PostgreSQL composite uniqueness constraint make a submission idempotent within the configured owner organization. Both create and duplicate-update paths return the same HTTP 202 response, so callers cannot enumerate stored addresses.

`PilotWaitlistLead` is linked to exactly one configured owner organization rather than becoming a global record visible to every organization Admin. It stores only name, normalized email, company, QA-team-size band, lifecycle status, and timestamps. An organization Admin may list and filter leads for their active organization, update one status, or delete one lead. API predicates always include the active organization ID, and public configuration cannot redirect a request into an organization that does not exist. Status and deletion actions write audit events containing the lead ID and transition only, never copied name, email, or company data.

The public form sends no email, creates no user, joins no Product, and queues no background product work. Cloudflare Stream and Turnstile are external availability and privacy dependencies recorded in `risk-log.md`; a failure produces a bounded form or media fallback rather than weakening validation. Production rollout deploys the database migration and API first, verifies the configured owner organization and origin, then publishes the marketing application. The landing surface can be public while pilot access remains invitation-only, but it does not resolve the product's deferred production identity, retention, or shipping decisions.
