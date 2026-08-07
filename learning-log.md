# Sentinel Learning Log

This file records what the project owner learns while building features with AI assistance. Add one entry for every completed feature or meaningful technical change.

## Documentation-stage baseline

- **Date:** 2026-08-05
- **Status:** Project documents prepared; no product feature is complete yet.
- **Related documents:** [`problem-brief.md`](problem-brief.md), [`srd.md`](srd.md), [`architecture.md`](architecture.md), [`phases.md`](phases.md), [`techstack.md`](techstack.md), [`decisions-log.md`](decisions-log.md)

The documentation stage established the problem, requirements, provisional architecture, technology choices, implementation order, and explicit open decisions before code. The owner should use the ten-question checks below for every later feature. Unanswered questions are follow-up learning tasks, not evidence that the feature is understood.

The documentation files themselves are governance artifacts rather than completed product features, so no feature-learning entry is marked complete here.

## Feature: [feature name]

- Date:
- Phase:
- Status: Not started / In progress / Understanding checked
- Relevant files:
- Related tests:
- Related decisions:

### What this feature does

[Explain the user problem and the feature’s behavior in plain language.]

### End-to-end flow

[Describe what happens from the user action to the final result. Include data movement, important system boundaries, and failure paths.]

### Technologies and patterns

| Technology / pattern | Why it is used | How it helps | Important limitation |
|---|---|---|---|
| [name] | [reason] | [benefit] | [tradeoff or limitation] |

### Key implementation details

[Explain the important files, functions, data structures, API contracts, and behavior a human maintainer needs to understand.]

### Tradeoffs and alternatives

- Tradeoff taken:
- Why this tradeoff was acceptable:
- Alternative considered:
- Why the alternative was not chosen:

### Risks and future improvements

- Known limitation or risk:
- Security or reliability consideration:
- Possible future improvement:

### Ten-question understanding check

Answer all 10 questions before marking this feature as understood. If an answer is incomplete, record the correction and revisit the relevant code or documentation.

1. What user problem does this feature solve, and what is its expected behavior?
2. What is the complete end-to-end flow from user action to result?
3. Which files and symbols are responsible for the feature, and what does each one do?
4. What data structures, database fields, or API contracts does the feature rely on?
5. How does the feature handle invalid input, errors, and important edge cases?
6. What security, privacy, performance, or reliability concerns apply?
7. What tests verify the feature, and what important behavior is not yet tested?
8. What is the most important technical tradeoff in this implementation?
9. What alternative implementation was considered, and why was it rejected?
10. If the feature had to change, where would you make the change and what could break?

#### Answers

1. **Answer:**
2. **Answer:**
3. **Answer:**
4. **Answer:**
5. **Answer:**
6. **Answer:**
7. **Answer:**
8. **Answer:**
9. **Answer:**
10. **Answer:**

### Priority-based diff review

| Priority | File | What changed | Why it needs attention | Review action |
|---|---|---|---|---|
| Highest / Medium / Lower | `[path]` | [plain-language summary] | [risk or complexity] | Read now / Skim / Defer |

#### Highest-priority concepts to understand

- [Concept, file, function, or question]

#### Follow-up learning tasks

- [Unresolved question or topic]

---

## Feature: Phase 1 guided recording slice

- Date: 2026-08-05
- Phase: 1
- Status: Implemented; understanding review pending owner answers.
- Relevant files: `app/page.tsx`, `app/api/[[...route]]/route.ts`, `lib/browser.ts`, `prisma/schema.prisma`, `docker-compose.yml`, `demo-target/index.html`.
- Related tests: `tests/auth.test.ts`, lint, type-check, production build, and Docker startup checks.
- Related decisions: D-009, D-010, D-011 in `decisions-log.md`.

### What this feature does

It lets a named tester create a recording draft, open one remote Chromium browser inside Sentinel, interact with the local Demo CRM, edit the captured steps, mark variables, and save the journey as version 1 of a Test Case. It solves the first part of the manual-regression problem: teaching a repeatable web journey without writing test code.

### End-to-end flow

The tester signs in with a seeded development account. Sentinel checks product membership, creates a draft recording with an opaque token, and starts Chromium in the Docker browser service. The browser displays inside the workspace through noVNC. Sentinel injects a recorder into the Demo CRM page; clicks, navigation, and completed field changes are posted to an internal API with the recording token. The API redacts password values, saves ordered draft steps in PostgreSQL, and the Step Log polls for updates. Saving copies those steps into immutable Test Case version 1 and records an audit event; discarding deletes only the unsaved draft.

### Technologies and patterns

| Technology / pattern | Why it is used | How it helps | Important limitation |
|---|---|---|---|
| Next.js | Web UI and API in one app | Keeps Phase 1 simple and type-aligned | Not yet split into workers for replay. |
| PostgreSQL + Prisma | Relational persistence and migrations | Stores ownership, drafts, steps, versions, and audit events | No production access controls or backups yet. |
| Selenium Chromium + noVNC | Remote browser-in-browser session | Matches the requested Reflect-style interaction model | One local session only. |
| Docker Compose | Reproducible local services | Starts app, database, browser, and demo target together | QA-network access is unresolved. |

### Key implementation details

- `RecordingSession` is a draft; it is not a Test Case until save succeeds.
- Browser events use a hashed short-lived recording token, while user actions use the signed development session cookie.
- Text input is captured on `change`; password fields become `[REDACTED]` before persistence.
- A Test Case keeps a product, owner, and immutable initial version so later Runs can identify exactly what was saved.

### Tradeoffs and alternatives

- Tradeoff taken: use a local Docker browser and demo target instead of a cloud browser or real QA application.
- Why acceptable: it proves the complete recording shape without secrets, network dependencies, or a browser extension.
- Alternative considered: a Chrome extension.
- Why not chosen: the intended experience is a browser session embedded in Sentinel, like Reflect.

### Risks and future improvements

- The recorder currently observes the controlled demo target only; cross-origin frames and private QA networks need later runner work.
- Development credentials are seeded only for local use and must be replaced with organization identity before any real deployment.
- The Phase 1 browser does not yet capture video, network logs, storage, or replay actions.

### Ten-question understanding check

1. Why is the recording browser hosted in Docker instead of being a Chrome extension?
2. What distinguishes a `RecordingSession` from a saved `TestCase`?
3. How does Sentinel prove which named user owns a saved test in Phase 1?
4. What services run in Docker Compose and what does each one do?
5. How do actions in the noVNC browser reach Sentinel’s Step Log?
6. Why are password inputs stored as `[REDACTED]`, and what information is retained instead?
7. How does product membership prevent one seeded user from accessing another user’s work?
8. What happens atomically when a recording is saved?
9. What can go wrong if the future QA target is private or uses cross-origin iframes?
10. Which files would you change to add replay of a saved Test Case safely?

#### Answers

1. **Answer:**
2. **Answer:**
3. **Answer:**
4. **Answer:**
5. **Answer:**
6. **Answer:**
7. **Answer:**
8. **Answer:**
9. **Answer:**
10. **Answer:**

### Priority-based diff review

| Priority | File | What changed | Why it needs attention | Review action |
|---|---|---|---|---|
| Highest | `app/api/[[...route]]/route.ts` | Authentication, authorization, recording, save, and discard API | Owns data safety and access control | Read now |
| Highest | `lib/browser.ts` | Creates and instruments the remote Chromium session | External browser boundary and recorder security | Read now |
| Highest | `prisma/schema.prisma` | Ownership, draft, version, step, and audit schema | Persistent data and migration contract | Read now |
| Medium | `app/page.tsx` | Recording Workspace and editable Step Log | Main user flow | Read next |
| Medium | `docker-compose.yml` | Local service topology | Affects every developer environment | Read next |
| Lower | `demo-target/index.html` | Deterministic local demo workflow | Test fixture rather than production logic | Skim |

#### Highest-priority concepts to understand

- Session cookie versus recording token authorization.
- The save transaction and immutable Test Case versioning.
- Event capture limits and secret redaction.

#### Follow-up learning tasks

- Owner must answer all ten questions before Phase 1 is marked understood.
- Add database/API integration tests and full remote-browser end-to-end coverage before Phase 1 is marked complete.

---

## Feature: Saved Test Case navigation

- Date: 2026-08-07
- Phase: 1
- Status: Implemented; understanding review pending owner answers.
- Relevant files: `app/api/[[...route]]/route.ts`, `app/page.tsx`.
- Related tests: live authorized list/detail API checks, lint, type-check, and unit-test suite.
- Related decisions: D-003 (human ownership) and D-008 (single-file commits).

### What this feature does

After a recording is saved, Sentinel opens its saved Test Case view. The dashboard also lists every Test Case available to the signed-in user, and the user can reopen one after signing in again or refreshing the browser.

### End-to-end flow

Saving returns a Test Case ID. The web app fetches its detail, shows its current version and saved steps, then offers a Back to dashboard button. On a later visit, sign-in loads the authorized Test Case list; opening an item fetches the same persisted version and annotations from PostgreSQL.

### Technologies and patterns

| Technology / pattern | Why it is used | How it helps | Important limitation |
|---|---|---|---|
| Authorized API list/detail routes | Product membership is checked server-side | Prevents a user from reading another product’s tests | Automated authorization coverage is still pending. |
| Immutable Test Case versions | Saved steps are copied from the recording draft | Past test definitions remain inspectable | Editing saved versions is deferred. |
| Client-side detail state | Keeps Phase 1 navigation simple | Adds dashboard/back/open flows without a routing framework | Direct deep links are deferred. |

### Key implementation details

- `GET /api/test-cases` filters through the signed-in user’s product memberships.
- `GET /api/test-cases/:id` checks product membership again before returning versions and ordered steps.
- The detail view selects `currentVersion` and renders persisted descriptions, outcomes, and variables read-only.

### Tradeoffs and alternatives

- Tradeoff taken: one-page dashboard/detail state instead of separate URL routes.
- Why acceptable: it is the smallest way to satisfy Phase 1 persistence verification.
- Alternative considered: a dedicated `/test-cases/:id` page.
- Why not chosen: deep-linking is useful, but not required for the first teach-and-save slice.

### Risks and future improvements

- A saved test with no recorded steps correctly shows an empty list; the UI should later make that state clearer.
- Add automated integration tests covering product authorization and saved-step persistence.
- Add direct detail URLs and a Test Case edit flow in a later phase.

### Ten-question understanding check

1. Why does the saved-test list filter by product membership instead of Test Case owner alone?
2. What is returned by the saved-test detail endpoint that the list endpoint does not return?
3. Why does the detail view select the current version rather than always render the newest array item?
4. What happens after saving a recording in the UI?
5. How can a user verify persistence after a browser refresh?
6. Which server-side check prevents cross-product Test Case access?
7. Why are saved steps read-only in this feature?
8. What does an empty saved-step list mean?
9. Which files must change to add a direct URL for a Test Case?
10. Which tests are still needed before this feature is fully verified?

#### Answers

1. **Answer:**
2. **Answer:**
3. **Answer:**
4. **Answer:**
5. **Answer:**
6. **Answer:**
7. **Answer:**
8. **Answer:**
9. **Answer:**
10. **Answer:**

### Priority-based diff review

| Priority | File | What changed | Why it needs attention | Review action |
|---|---|---|---|---|
| Highest | `app/api/[[...route]]/route.ts` | Authorized saved Test Case list and detail API | Access control and persisted data exposure | Read now |
| Medium | `app/page.tsx` | Dashboard list, detail view, and post-save navigation | Main user path and persistence visibility | Read next |

#### Highest-priority concepts to understand

- Product-membership authorization on both list and detail endpoints.
- Current-version selection and immutable saved steps.

#### Follow-up learning tasks

- Owner answers the ten questions above.
- Add automated list/detail authorization and persistence tests.

---

## Feature: Phase 1 Product creation

- Date: 2026-08-07
- Phase: 1
- Status: Implemented; understanding review pending owner answers.
- Relevant files: `app/api/[[...route]]/route.ts`, `app/page.tsx`, `tests/product-creation.spec.ts`, `vitest.config.ts`.
- Related tests: Docker lint, type-check, unit-test suite, and Product creation Playwright acceptance test.
- Related decision: D-012 (Phase 1 Product creation behavior).

### What this feature does

An authenticated named user can create a Product from the dashboard without leaving the Test Case workflow. The Product is stored in PostgreSQL, the creator becomes a member, and the new Product is immediately selected for the next recording.

### End-to-end flow

The user enters a Product name in the inline form. The browser sends it to `POST /api/products` with the session cookie. The API trims and validates the name, creates the Product and membership through Prisma, and returns the Product. The dashboard adds it to the sorted selector and selects its ID. Later dashboard loads call `GET /api/products`, so the Product remains available after refresh and sign-in. A different named user sees only Products for which they have membership.

### Technologies and patterns

| Technology / pattern | Why it is used | How it helps | Important limitation |
|---|---|---|---|
| Next.js client form | Matches the existing dashboard interaction | Provides immediate success/error feedback and selection | Product management is currently dashboard-local rather than a dedicated route. |
| Next.js API route | Keeps authentication and writes server-side | Prevents the browser from choosing its own owner or membership | The route handler still serves multiple domain endpoints. |
| Prisma nested create | Creates Product and creator membership in one database operation | Avoids a Product that its creator cannot access | Broader product sharing is deferred. |
| PostgreSQL unique constraint | Enforces one same-named Product per owner | Prevents duplicate owner-scoped names even under concurrent requests | Names are compared using the database’s existing exact-match behavior. |
| Playwright Test and Vitest configuration | Separates browser acceptance tests from unit tests | Keeps `npm test` focused while the portal path is tested explicitly | Browser dependencies must be installed in a fresh test container. |

### Key implementation details

- Blank or non-string names return HTTP 400 with `Product name is required.`.
- A duplicate owner-scoped name returns HTTP 409 with `You already have a Product with this name.`.
- The API continues to require the named-user session and creates creator membership atomically.
- The UI disables Test Case creation if no Product is available and shows a first-create prompt.
- The Playwright test verifies creation, selector selection, recording-draft use, persistence, validation, duplicate handling, and cross-user visibility.

### Tradeoffs and alternatives

- Tradeoff taken: an inline dashboard form instead of a dedicated Product management page.
- Why acceptable: Product creation is currently only a prerequisite for Test Case recording.
- Alternative considered: reuse an existing Product when the same name is submitted.
- Why not chosen: silently reusing a Product could hide an accidental duplicate and weaken ownership clarity.

### Risks and future improvements

- Product names have no richer metadata, descriptions, archival state, or sharing controls yet.
- The current development identity flow is seeded and is not production authentication.
- The Docker image does not bundle Playwright’s test browser libraries; the test setup currently installs them in the running container.
- Add a dedicated Product management experience and explicit membership administration when team collaboration is implemented.

### Ten-question understanding check

1. Which server-side identity determines the owner of a newly created Product?
2. Why does Product creation create a membership at the same time as the Product?
3. What does the API do when the submitted Product name contains leading or trailing spaces?
4. Which HTTP statuses represent blank-name validation and duplicate-name rejection?
5. What database rule prevents two same-named Products for one owner?
6. Why does the UI update and select the returned Product instead of only appending the typed name locally?
7. How does a later `GET /api/products` call enforce Product visibility?
8. What prevents a user from creating a Test Case without a Product selected?
9. Which acceptance test proves that another seeded user cannot see the new Product?
10. Why is `vitest.config.ts` needed after adding the Playwright `.spec.ts` file?

#### Answers

1. **Answer:**
2. **Answer:**
3. **Answer:**
4. **Answer:**
5. **Answer:**
6. **Answer:**
7. **Answer:**
8. **Answer:**
9. **Answer:**
10. **Answer:**

### Priority-based diff review

| Priority | File | What changed | Why it needs attention | Review action |
|---|---|---|---|---|
| Highest | `app/api/[[...route]]/route.ts` | Validates Product names and maps Prisma uniqueness errors to API responses | Owns authentication, ownership, membership, and duplicate behavior | Read now |
| Highest | `app/page.tsx` | Adds the inline creation form and selector state updates | Controls the user’s Product-to-Test Case path | Read now |
| Medium | `tests/product-creation.spec.ts` | Exercises the real portal and cross-user visibility | Encodes the Product acceptance contract | Read next |
| Lower | `vitest.config.ts` | Restricts Vitest to unit-test naming patterns | Prevents Playwright tests from being collected by the unit runner | Skim |

#### Highest-priority concepts to understand

- Server-side ownership and membership creation cannot be trusted to client-submitted IDs.
- Database uniqueness errors must become intentional user-facing API responses.
- The UI’s selected Product ID is what associates the next recording with the new Product.

#### Follow-up learning tasks

- Owner answers the ten questions above.
- Add direct API integration tests for Product authorization and database transaction behavior.
- Bake Playwright browser dependencies into the reproducible test image instead of installing them interactively.

---

## Feature: Phase 1 automated verification and recorder hardening

- Date: 2026-08-07
- Phase: 1
- Status: Verification implemented and passed; understanding review pending owner answers.
- Relevant files: `lib/browser.ts`, `app/api/[[...route]]/route.ts`, `prisma/migrations/20260807155500_redact_password_metadata/migration.sql`, `Dockerfile`, `tests/recording-api.test.ts`, `tests/phase-1-recording.spec.ts`.
- Related tests: `npm run lint`, `npm run typecheck`, `npm test`, and `npx playwright test tests/phase-1-recording.spec.ts` inside the Sentinel Docker service.
- Related decisions: D-013 in `decisions-log.md`.

### What this feature does

It proves the Phase 1 recording workflow with automated tests and closes two recorder safety gaps. Password text is redacted both as a recorded value and as target metadata, while event delivery survives a browser navigation. The full browser journey also proves that a saved Test Case can be reopened after a page refresh without losing any recorded step or its annotations.

### End-to-end flow

The API/database suite creates signed-in users, Products, and draft recordings in PostgreSQL, then verifies event intake, redaction, step editing, save, discard, and cross-user authorization. The Playwright journey signs in through the Sentinel UI, creates a draft, uses one instrumented remote Chromium session against the demo target, waits for meaningful recorded steps, annotates the redacted password step, saves it, returns to the dashboard, reopens it, reloads the page, signs in again, and verifies the same saved data.

The recorder script in the remote page posts events to Sentinel's internal endpoint with the draft token. `keepalive` asks the browser to finish sending an in-flight event during navigation. The server stores only `[REDACTED]` for password values, and the database migration overwrites any old password target metadata that was stored before this hardening.

### Technologies and patterns

| Technology / pattern | Why it is used | How it helps | Important limitation |
|---|---|---|---|
| Vitest + Prisma | API and persistence contract testing | Exercises real database records without a browser UI | The test controls draft status directly to avoid consuming the one remote browser session. |
| Playwright | Full browser acceptance test | Verifies Sentinel UI, remote Chromium, demo app, recording API, and persistence together | It uses the controlled local demo target only. |
| Playwright Chromium in Docker | Reproducible test runtime | A fresh Sentinel image contains the browser required for the E2E test | It increases image size and build time. |
| `keepalive` fetch + redaction migration | Reliable, private recorder events | Preserves navigation-time events and removes legacy secret metadata | It does not provide a complete sensitive-data classification policy. |

### Key implementation details

- `lib/browser.ts` is the recorder boundary. Its page script identifies password fields and substitutes `[REDACTED]` before posting a text-entry event or target description.
- `app/api/[[...route]]/route.ts` updates only annotation fields supplied by the client, so changing a variable marker cannot unintentionally erase the description or expected outcome.
- The migration updates both `RecordedStep` and immutable `TestStep` JSON targets, which protects legacy drafts and already saved Test Cases.
- `tests/phase-1-recording.spec.ts` asserts ordered meaningful event categories, annotation persistence, page-reload persistence, and absence of the real password text.

### Tradeoffs and alternatives

- Tradeoff taken: use a direct controlled remote-browser driver inside the E2E test after creating the draft through the UI.
- Why this tradeoff was acceptable: the browser service allows one active Selenium session; this still verifies the production recorder path without competing with the noVNC launch session.
- Alternative considered: drive the noVNC canvas entirely through Playwright.
- Why the alternative was not chosen: canvas-level VNC interaction is less deterministic and would make the acceptance test fragile without improving product coverage.

### Risks and future improvements

- The current redaction rule recognizes password fields; future evidence capture needs broader rules for tokens, payment data, and user-defined sensitive fields.
- `keepalive` improves best-effort delivery but cannot guarantee every event in abrupt browser or network failures; a later runner may need acknowledgement and retry semantics.
- The test operates against Docker-local services. Private QA targets, cross-origin frames, and concurrent recordings remain later work.

### Ten-question understanding check

1. Why does the recorder redact password target metadata as well as the recorded field value?
2. What problem does `keepalive: true` solve for a recorder event posted during navigation, and what does it not guarantee?
3. Which API behavior ensures that updating only a variable marker preserves a step's description and expected outcome?
4. Why does the migration update both `RecordedStep` and `TestStep` records?
5. How do the API/database tests prove that saving creates the correct durable records and audit event?
6. Why does the browser E2E test use one instrumented driver rather than launch the noVNC session and another driver simultaneously?
7. What exact persistence facts are checked after the test page reloads and the user signs in again?
8. What sensitive information could still require redaction in future phases even after password protection is in place?
9. What would need to change if recorder delivery required guaranteed acknowledgement rather than best-effort posting?
10. Which files and tests should be reviewed first before changing event normalization or saved-step annotations?

#### Answers

1. **Answer:**
2. **Answer:**
3. **Answer:**
4. **Answer:**
5. **Answer:**
6. **Answer:**
7. **Answer:**
8. **Answer:**
9. **Answer:**
10. **Answer:**

### Priority-based diff review

| Priority | File | What changed | Why it needs attention | Review action |
|---|---|---|---|---|
| Highest | `lib/browser.ts` | Redacts password target metadata, keeps event posts alive during navigation, and exposes the launched driver for verification | It crosses the remote-browser, recorder, privacy, and reliability boundaries | Read now |
| Highest | `app/api/[[...route]]/route.ts` | Makes step annotation updates partial instead of destructive | A subtle API update could otherwise erase saved user data | Read now |
| Highest | `prisma/migrations/20260807155500_redact_password_metadata/migration.sql` | Removes legacy password metadata from draft and saved steps | It mutates persisted sensitive data and must stay safe on production-sized databases | Read now |
| Medium | `tests/recording-api.test.ts` | Covers recording, save, discard, redaction, and authorization | It documents the server-side Phase 1 contract | Read next |
| Medium | `tests/phase-1-recording.spec.ts` | Covers the remote-browser journey and reload persistence | It coordinates several services and is the main user-journey proof | Read next |
| Medium | `Dockerfile` | Installs Chromium with Playwright dependencies in the test image | Affects every image build and verification environment | Read next |
| Lower | `phases.md`, `decisions-log.md`, `README.md` | Records status, choices, and commands | Important operational context but no runtime behavior | Skim |

#### Highest-priority concepts to understand

- Password protection must apply to every persisted representation, not only the visible field value.
- Recorder events can be lost when a page leaves; `keepalive` is a targeted reliability improvement, not a delivery guarantee.
- Partial API updates must distinguish omitted fields from fields intentionally cleared by the user.

#### Follow-up learning tasks

- Owner answers all ten questions above before this work is considered understood.
- Define a broader sensitive-data policy before collecting evidence, console, storage, or network details.
- Decide whether later replay and evidence phases need acknowledged event delivery or event retry.
