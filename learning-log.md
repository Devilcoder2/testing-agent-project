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

1. Because we intended to make this browser in browser experience just like reflect.
2. `RecordingSession` is a draft, it is not considered `TestCase` until saved.
3. Maybe through token based auth (but not sure)
4. Total 4 services, one for postgress databse, one for our demo-target app which is used for testing, one for browser inside our application using selenium, and last one is for Sentinel application
5. user actions use the signed development session cookie
6. Because passwords are senstive information and you do not want anyone to know what the password is.
7. Through token type of authentication
8. `RecordingSession` gets converted to `TestCase`, and all the related information like the clicks, navigations etc get stored in the postgres db.
9. Then the in browser will not have accesss to that website, due to which tester will not be able to load that website inside our broswer.
10. `app/api/[[...route]]/route.ts`, `lib/browser.ts`

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

1. Because there can be different products under the same organization, so it is important to filter out both using product and owner
2. Unique Test case id
3. **Owner answer:** don't know. **Reference answer:** `currentVersion` is an explicit field on the Test Case that identifies the version intended to be shown. Choosing it avoids assuming that the final array item is current when versions may later be filtered, reordered, or loaded differently.
4. when the save button is clicked, the recording (not the video, but the clicks, descriptions etc.) gets saved in the db and a unique test case id is returned.
5. once the test case is saved, it does not gets saved in the session storage, rather it gets saved in the posgtress db so that if the user refreshes the page, we can fetch the data from the db.
6. Product membership
7. Because when somethings gets changed in the already recorded feature then our app does not assume things on its own, rather a human is required to confirm the changes.
8. that means the tester just opened the broswer but performed no steps and clicked the saved button
9. `app/api/[[...route]]/route.ts`
10. **Owner answer:** Me to answer these questions. **Reference answer:** `tests/phase-1-recording.spec.ts` now verifies the save, dashboard return, reopen, refresh, and saved-step annotation path. Direct API integration coverage for the Test Case list/detail endpoints and their cross-product authorization remains a useful additional test.

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

1. Product membership
2. Because a product should be owned by someone, product cannot exisits without the ownwer
3. it removes the spaces, and checks at the server side whether that same products exists and if yes then returns error otherwise creates that product
4. 400
5. A duplicate owner scoped name
6. Becuase firstly we need to persist that in the db so that upon refresh that newly created product stays there, and secondly the product gets selected automatically on the UI
7. **Answer:** The route first obtains the signed-in named user, then queries Products whose `memberships` relation has an entry with that user’s ID. It therefore returns only Products the user is a member of; the browser cannot choose which Products to reveal.
8. Server side or database validations or if the product field is empty then the frontend can restrict the user
9. **Answer:** `tests/product-creation.spec.ts`, specifically its scenario that signs in as Ava to create the Product and then signs in as Ben to confirm the Product is absent.
10. **Answer:** It restricts Vitest’s discovery to `tests/**/*.test.ts`, so the Playwright browser file named `*.spec.ts` is run only by Playwright and is not mistakenly executed by `npm test`.

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

1. **Answer:** The element target can itself reveal a password when it includes the input’s value or visible text. Redacting both the recorded value and the target metadata ensures neither draft nor saved steps leak the secret through a second stored representation.
2. **Answer:** It gives the browser a chance to continue sending an already-started event when the page navigates or unloads. It is still best effort: a crash, network failure, or browser limit can lose the event, and Sentinel does not yet acknowledge and retry it.
3. **Answer:** The step PATCH route updates `description`, `expectedOutcome`, and `variableName` only when each corresponding request property is not `undefined`. An omitted property is left unchanged; an explicitly supplied empty value clears that one property.
4. **Answer:** `RecordedStep` holds mutable draft steps, while `TestStep` holds copied immutable steps in saved Test Case versions. Both can contain JSON target metadata, so both tables need the cleanup to remove existing password text everywhere it may have been stored.
5. **Answer:** The tests post ordered events, edit a step, call save, and then inspect PostgreSQL through Prisma. They assert the saved Test Case owner, version 1, copied steps and annotations, redacted value, and exactly one `TEST_CASE_SAVED` audit event. A separate test discards a draft and asserts that no Test Case exists.
6. **Answer:** The browser service supports one active Selenium session. The test creates the recording through the Sentinel UI, then uses one instrumented remote driver to perform the demo journey so it exercises the recorder without conflicting with a simultaneous noVNC-launched driver.
7. **Answer:** After reload and signing in again, the test reopens the saved Test Case and checks that the saved-step count is unchanged; the password step still shows its description, expected outcome, variable name, and `[REDACTED]` value; and the real password text is absent.
8. **Answer:** Access tokens, API keys, payment-card data, personal data, session/local-storage values, request headers and bodies, console output, and user-defined sensitive fields may all need redaction before future evidence capture persists them.
9. **Answer:** Sentinel would need an event identifier, a server acknowledgement, durable pending-event storage or a retry queue in the browser/runner, idempotent server-side ingestion, and a policy for retry limits and failed delivery. `keepalive` alone would no longer be enough.
10. **Answer:** Review `lib/browser.ts` first for event capture, redaction, and delivery; then `app/api/[[...route]]/route.ts` for event intake and partial annotation updates; then `tests/recording-api.test.ts` and `tests/phase-1-recording.spec.ts` because they define the expected persistence and browser behavior.

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

---

## Feature: Phase 1.5 frontend foundation and routed experience

- Date: 2026-08-08
- Phase: 1.5
- Status: Implemented and acceptance-verified; understanding review pending owner answers.
- Relevant files: `frontend.md`, `app/styles/tokens.css`, `app/globals.css`, `components/ui.tsx`, `components/app-shell.tsx`, `components/sentinel-views.tsx`, and the `app/` route files.
- Related tests: `tests/frontend-phase-1-5.spec.ts`, `tests/product-creation.spec.ts`, `tests/phase-1-recording.spec.ts`, lint, type-check, unit suite, and production build.
- Related decision: D-014 in `decisions-log.md`.

### What this feature does

It gives Sentinel a consistent operations interface instead of a single page of loosely related forms. A tester signs in at a dedicated entry screen, uses a persistent sidebar and route-based pages to find Products and Test Cases, creates a recording in a focused flow, and uses a desktop-first Step Timeline beside the live browser. The change makes the delivered Phase 1 workflow easier to scan and leaves a documented visual foundation for Runs, releases, evidence, approvals, and settings.

### End-to-end flow

The sign-in page sends the same development-login request as before, then routes the browser to `/dashboard`. Dashboard and Test Case pages fetch the same authorized API data as the old one-page app. Creating a recording stores the short-lived launch token in browser session storage only long enough to move into `/recordings/:id`; the workspace uses that token to call the existing launch endpoint and polls the existing steps endpoint. Saving routes to `/test-cases/:id`; discarding removes the draft and returns to the dashboard.

Every implemented screen uses semantic CSS variables from the token stylesheet. CSS provides the App Shell, card, form, timeline, button, status, responsive, focus, and reduced-motion behavior. The frontend browser test verifies the route flow, focusability, validation feedback, narrow-screen guidance, and reduced-motion token behavior; the existing Product and remote-recording tests prove that the redesign did not alter the underlying workflow.

### Technologies and patterns

| Technology / pattern | Why it is used | How it helps | Important limitation |
|---|---|---|---|
| CSS custom properties | Fixed visual tokens without a styling dependency | Keeps colours, spacing, motion, elevation, and typography consistent | The design system remains local to this repository and needs disciplined token use. |
| Next.js App Router | Separate URLs for distinct tasks | Lets pages be bookmarked and prevents the dashboard, detail, and recording states from competing in one component | Draft recording context still needs client-side handoff because the launch token must not appear in the URL. |
| Small React primitives | Product-specific Buttons, Fields, Cards, feedback, and status badges | Reduces duplicated markup and makes accessibility behavior reusable | It is intentionally smaller than a complete external design system. |
| Playwright responsive checks | Browser-level verification of visible behavior | Proves focusability, narrow-workspace guidance, and reduced motion alongside real routes | It does not replace a formal assistive-technology audit. |

### Key implementation details

- `app/styles/tokens.css` is the only stylesheet that defines the Sentinel colour palette. Components use semantic variables such as `--color-primary` and `--color-danger` rather than introducing their own palette values.
- `components/app-shell.tsx` owns the persistent sidebar, responsive navigation control, and shared top bar; it only exposes current Phase 1 destinations.
- `components/sentinel-views.tsx` centralizes the client data flow so the route files remain small. It preserves existing API paths and explicit product authorization.
- The recording token is kept in `sessionStorage` under a recording-specific key so it can survive navigation to the workspace without being placed in a shareable URL. It is removed after save or discard.
- The Recording Workspace hides the browser/Step Timeline below 1024 px and shows desktop guidance. Its Back action discards the draft, matching the prior Phase 1 behavior and preventing an unreachable draft.

### Tradeoffs and alternatives

- Tradeoff taken: custom CSS tokens and local components instead of Tailwind, shadcn, or a component library.
- Why this tradeoff was acceptable: Sentinel needs a focused operations UI and only a small set of components today; adding a framework would not improve the delivered recording behavior.
- Alternative considered: retain the original one-page stateful application.
- Why the alternative was not chosen: the dashboard, Test Case detail, Recording Workspace, Run Detail, releases, and approval experiences need independent navigation and visual hierarchy.

### Risks and future improvements

- The current session-storage handoff is appropriate for a short-lived local development token, but a production identity and secure draft-resume design need review before external deployment.
- The UI currently has no formal screen-reader audit, localization, or user-configurable light theme.
- Future Runs, evidence, releases, review, and settings must follow `frontend.md`; they should not add placeholder routes before their underlying capabilities exist.

### Ten-question understanding check

1. Why does the Recording Workspace need its own route and focused layout instead of appearing beside dashboard forms?
2. Which file is the authoritative source for Sentinel colours, motion, spacing, and typography, and why does that matter?
3. How does the frontend preserve the existing Product, save, discard, authorization, and recorder API contracts during the route migration?
4. Why is the recording launch token stored in session storage rather than in the recording URL, and when is it removed?
5. What do the App Shell and the feature-view component each own?
6. Which WCAG 2.2 AA behaviors are intentionally implemented in this phase, and how are status messages made understandable without colour alone?
7. What happens below the Recording Workspace desktop breakpoint, and why is that safer than compressing the live browser into a phone layout?
8. How does `prefers-reduced-motion` affect the token system and global CSS behavior?
9. Which Playwright tests protect the unchanged business flow, and which test specifically protects the frontend redesign behavior?
10. If Phase 2 adds Run Detail, where should its visual decisions and route behavior be defined before implementation?

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
| Highest | `components/sentinel-views.tsx` | Moves the existing data and recording flow into route-ready client views | It controls API calls, token handoff, discard behavior, and user-visible error states | Read now |
| Highest | `app/styles/tokens.css` | Defines the fixed visual system | Every screen depends on these semantic colours, spacing, and motion values | Read now |
| Highest | `app/globals.css` | Implements the App Shell, responsive layout, focus, reduced motion, and Recording Workspace | A CSS regression can affect accessibility or hide the live workspace | Read now |
| Medium | `components/ui.tsx`, `components/app-shell.tsx`, and `app/` routes | Supplies reusable primitives, navigation, and individual page entry points | These files encode the information architecture and reusable interaction rules | Read next |
| Medium | Playwright browser tests | Updates existing journeys and adds frontend acceptance coverage | They define which functional and visual behavior must remain stable | Read next |
| Lower | `app/icon.svg` and documentation files | Adds a browser icon and records the design decisions | Important for polish and maintainability but not business logic | Skim |

#### Highest-priority concepts to understand

- Tokens are semantic contracts: components ask for a role such as primary action or danger, rather than choosing an arbitrary colour.
- Route migration must not put a short-lived launch token into a shareable URL or change server-side authorization.
- Responsive guidance is a deliberate product decision for a browser-heavy workflow, not a missing mobile layout.

#### Follow-up learning tasks

- Owner answers all ten questions above before Phase 1.5 is marked understood.
- Define production-grade draft resume and identity behavior before relying on browser session storage outside local development.
- Perform a screen-reader and contrast audit with representative users before an internal pilot.

---

## Feature: Phase 1 single-browser launch recovery

- Date: 2026-08-09
- Phase: 1
- Status: Implemented and regression-verified; understanding review pending owner answers.
- Relevant files: `lib/browser.ts`, `app/api/[[...route]]/route.ts`, `components/sentinel-views.tsx`, `tests/browser-lock.spec.ts`, `tests/phase-1-recording.spec.ts`.
- Related decision: D-020 in `decisions-log.md`.
- Related verification: `docker compose exec sentinel npm run lint`, `docker compose exec sentinel npm run typecheck`, `docker compose exec sentinel npm test`, `docker compose exec sentinel npx playwright test tests/browser-lock.spec.ts --workers=1`, `docker compose exec sentinel npx playwright test tests/phase-1-recording.spec.ts --workers=1`, and `docker compose exec sentinel npx playwright test tests/frontend-phase-1-5.spec.ts --workers=1`.

### What this feature does

It prevents the Phase 1 Recording Workspace from becoming permanently disabled when Selenium's one local Chromium slot is occupied by a session Sentinel no longer knows about. This happens, for example, when the Sentinel application restarts while the separate browser container keeps running. A new launch now replaces that stale global browser, starts a fresh locked Demo CRM session, and either shows the embedded browser or returns a clear retryable error.

### End-to-end flow

The tester clicks **Launch live browser**. The workspace shows an accessible “Launching secure browser” status while its existing `working` state prevents duplicate clicks. The launch API validates the tester and draft token. `lib/browser.ts` closes any driver held in Sentinel memory, reads Selenium's internal `/status` endpoint, and sends a WebDriver `DELETE /session/:id` request for every occupied slot. It then creates one kiosk-mode Chromium session, navigates only to the allowlisted Demo CRM, and injects the recorder script.

If the browser service is unavailable, the session cannot close, another launch is in progress, or any startup operation exceeds 15 seconds, the server returns a `409` or `503` response. The client catches that response, stops the disabled state, and exposes the error plus the launch button for retry. Save and discard attempt browser cleanup but do not report failure after their database operation has already succeeded.

### Technologies and patterns

| Technology / pattern | Why it is used | How it helps | Important limitation |
|---|---|---|---|
| Selenium Grid `/status` and WebDriver session deletion | Detect and clear a browser service session that is not represented in Sentinel memory | Restores the one available browser slot after an app restart | This is safe only because Phase 1 has one global browser; it would interrupt another user in a concurrent system. |
| Promise time bounds | Prevent slow WebDriver, navigation, or recorder setup from holding an HTTP request forever | Lets the API return a retryable failure | A late WebDriver creation still has to be explicitly closed, which the implementation does. |
| React launch state with an ARIA live message | Make an expected short startup visible to all testers, including screen-reader users | Avoids a disabled button that looks like a frozen UI | It does not provide cancellation; the bounded server operation eventually resolves or fails. |
| Playwright + raw Selenium setup in a regression test | Reproduce the exact orphaned-session condition | Proves Sentinel can reclaim an untracked browser before launch | It exercises only the local Docker Selenium topology. |

### Key implementation details

- `lib/browser.ts` treats every session returned in Selenium's node slots as stale for a new Phase 1 launch. The service is intentionally single-session, so replacement is the documented behavior.
- `withTimeout` bounds browser-service requests, WebDriver creation, navigation, and recorder injection. If WebDriver resolves after its timeout, its driver is immediately quit to prevent a later slot leak.
- `launchInFlight` rejects a second launch started in the same Sentinel process while the first is still preparing Chromium.
- `app/api/[[...route]]/route.ts` maps browser lifecycle failures to actionable `409` or `503` JSON responses. Its cleanup wrapper logs cleanup failures but does not invalidate an already saved Test Case or prevent draft deletion.
- `tests/browser-lock.spec.ts` creates a standalone Selenium session outside Sentinel's module state, then proves `launchBrowser` reclaims it and reaches the Demo CRM sign-in form. `tests/phase-1-recording.spec.ts` treats the remote driver as already closed after Save, because cleanup through the Sentinel API is now the expected lifecycle owner.

### Tradeoffs and alternatives

- Tradeoff taken: a new Phase 1 launch always replaces the existing browser session.
- Why this tradeoff was acceptable: Phase 1 explicitly has one local browser session, and an unusable stale session blocks every tester.
- Alternative considered: wait for Selenium's five-minute session timeout.
- Why it was not chosen: the UI appeared frozen and a tester had no meaningful way to recover promptly.
- Alternative considered: add multiple Selenium slots.
- Why it was not chosen: that would conflict with the agreed Phase 1 one-session scope and would need session ownership, isolated noVNC viewers, and concurrency rules.

### Risks and future improvements

- A second tester launching a recording in Phase 1 will intentionally replace the first tester’s remote browser. Do not use this topology for shared testing.
- Selenium's internal status shape is an infrastructure dependency; upgrade checks must keep the session-discovery test.
- Production needs a per-job browser allocation model, authenticated viewer access, cancellation, queueing, and ownership-aware cleanup instead of global replacement.

### Ten-question understanding check

1. Why can a Selenium browser session remain active after Sentinel loses its `driver` variable?
2. Why is it correct for Phase 1 to terminate every occupied Selenium slot before a new launch, and why would that be unsafe in a multi-user runner?
3. What does the `/status` request provide that `closeExistingDriver()` alone cannot provide?
4. Which browser operations are time-bounded, and what user-visible behavior follows when one times out?
5. How does the late-driver cleanup avoid creating a new stale browser session after a timed-out WebDriver build?
6. Why does `launchInFlight` reject a concurrent request instead of queueing it?
7. Which API status codes represent “another launch is starting” and “browser startup failed,” and why are they retryable?
8. Why must save/discard tolerate a browser-cleanup failure after the database operation completes?
9. How does the regression test recreate the real restart/orphan scenario without restarting Docker?
10. Which files should be reviewed first before changing Phase 1 browser concurrency or launch-timeout behavior?

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
| Highest | `lib/browser.ts` | Discovers and terminates stale Selenium sessions, bounds launch operations, and prevents duplicate starts | It controls the single remote browser and can interrupt a recording if changed incorrectly | Read now |
| Highest | `app/api/[[...route]]/route.ts` | Returns retryable browser errors and makes post-save/discard cleanup non-fatal | It governs user-visible failure semantics and durable write behavior | Read now |
| Medium | `components/sentinel-views.tsx` | Displays live launch progress and restores the retry action after an error | It controls whether a tester can understand and recover from a browser startup failure | Read next |
| Medium | `tests/browser-lock.spec.ts` and `tests/phase-1-recording.spec.ts` | Reproduces stale-session recovery and accepts the intended post-save driver closure | They encode the infrastructure failure mode and lifecycle contract | Read next |
| Lower | `architecture.md`, `decisions-log.md`, `learning-log.md` | Records scope, architecture, and learning context | No runtime behavior, but documents the single-session limitation | Skim |

#### Follow-up learning tasks

- Owner answers all ten questions above before this reliability change is considered understood.
- Define per-user browser allocation, queueing, and viewer authorization before introducing concurrent recording.

---

## Feature: Minimal noVNC recording surface

- Date: 2026-08-09
- Phase: 1 / 1.5
- Status: Implemented and browser-verified; understanding review pending owner answers.
- Relevant files: `browser/Dockerfile`, `tests/frontend-phase-1-5.spec.ts`, `frontend.md`, `architecture.md`.
- Related decision: D-021 in `decisions-log.md`.
- Related verification: `docker compose up --build -d browser` and `docker compose exec sentinel npx playwright test tests/frontend-phase-1-5.spec.ts --workers=1`.

### What this feature does

It removes noVNC’s floating viewer sidebar from Sentinel’s embedded recording browser. The user sees only the remote Demo CRM and can still click, type, and use the normal Sentinel recording controls. This gives the remote page more usable width and prevents access to redundant noVNC controls such as clipboard, settings, fullscreen, and connection actions.

### End-to-end flow

Sentinel launches Chromium in the browser Docker container and embeds its noVNC page in the Recording Workspace iframe. The browser image appends a narrow CSS override to noVNC’s own stylesheet during its build. That override hides the control-bar and hint anchors only; it does not change the VNC canvas or the browser’s kiosk and URL policy. When the workspace loads the iframe, noVNC connects normally and forwards the tester’s pointer and keyboard input to Chromium, but its viewer controls no longer occupy the left side of the stage.

The frontend Playwright regression creates a recording, launches the live iframe, and asserts that `#noVNC_control_bar_anchor` is hidden. It continues checking that the iframe fills the browser stage, so the visual cleanup cannot accidentally remove the remote browser itself.

### Technologies and patterns

| Technology / pattern | Why it is used | How it helps | Important limitation |
|---|---|---|---|
| Custom Selenium browser image | Own configuration outside the upstream noVNC package | Applies the same viewer policy on every Docker rebuild | The selector depends on noVNC's DOM structure and needs review on image upgrades. |
| CSS `display: none !important` override | Hide only the redundant noVNC UI | Keeps the VNC canvas and input plumbing unchanged | It intentionally removes access to noVNC troubleshooting controls. |
| Cross-origin iframe Playwright assertion | Test the embedded viewer rather than only a static stylesheet | Proves the bar is hidden in the actual Sentinel workspace | It remains specific to the Docker-local viewer. |

### Key implementation details

- `browser/Dockerfile` switches to `root` only long enough to append the override to the root-owned noVNC stylesheet, then restores the image’s normal `seluser` runtime.
- The hidden selectors are `#noVNC_control_bar_anchor` and `#noVNC_hint_anchor`; hiding the anchor also removes the control-bar reveal handle.
- The browser policy, kiosk mode, and Selenium lifecycle are unchanged. This is a presentation and interaction-surface reduction, not the security control itself.
- `tests/frontend-phase-1-5.spec.ts` uses a Playwright `frameLocator` to assert the control anchor is hidden inside the live noVNC iframe.

### Tradeoffs and alternatives

- Tradeoff taken: remove all noVNC viewer controls from the recording experience.
- Why this tradeoff was acceptable: Sentinel provides the task controls the tester needs, while the remote target needs maximum visible area.
- Alternative considered: keep the sidebar collapsed behind its small reveal handle.
- Why it was not chosen: it still consumes space and exposes actions outside the agreed test workflow.
- Alternative considered: style the cross-origin iframe from the Sentinel page.
- Why it was not chosen: browser cross-origin rules prevent Sentinel CSS from reliably reaching noVNC; the browser image is the correct owner.

### Risks and future improvements

- Viewer-level clipboard and connection troubleshooting are unavailable to a tester; local diagnosis should use Docker logs instead.
- A noVNC upstream DOM or stylesheet change can invalidate the selector, so the iframe regression test must run after browser-image upgrades.
- A future multi-user viewer may need a deliberate, authenticated support mode rather than exposing controls in the normal recording workspace.

### Ten-question understanding check

1. Why is the visible sidebar in the screenshot part of noVNC rather than Sentinel’s Step Log or App Shell?
2. Which noVNC selectors are hidden, and why does hiding the anchor remove the reveal handle too?
3. Why is the CSS override applied in the browser Docker image instead of Sentinel’s application stylesheet?
4. What input capabilities remain available after the noVNC controls are hidden?
5. Which controls are intentionally removed, and why are they unnecessary in the normal Phase 1 recording flow?
6. Why does the Dockerfile temporarily switch to `root` and then return to `seluser`?
7. How does the `frameLocator` regression test prove both the absence of the bar and the presence of a live embedded browser?
8. Why is hiding the control bar not, by itself, the security boundary for the remote browser?
9. What would need review if the upstream Selenium/noVNC image changes version?
10. How could a future support workflow provide diagnostics without restoring these controls for every tester?

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
| Highest | `browser/Dockerfile` | Adds a root-scoped noVNC CSS override and restores the unprivileged runtime user | Container permissions and an upstream UI selector affect the remote-browser boundary | Read now |
| Medium | `tests/frontend-phase-1-5.spec.ts` | Asserts the noVNC control anchor is hidden inside the live iframe | It protects the visible interaction contract against browser-image changes | Read next |
| Lower | `frontend.md`, `architecture.md`, `decisions-log.md`, `learning-log.md` | Documents the intended minimal viewer surface | Explains product scope but does not change runtime behavior | Skim |

#### Follow-up learning tasks

- Owner answers all ten questions above before this viewer-surface change is considered understood.
- Define an authenticated support and diagnostics mode before exposing any viewer-level controls in a multi-user environment.

---

## Feature: Phase 2 guided Runs and privacy-safe evidence

- Date: 2026-08-09
- Phase: 2
- Status: Implemented and automated-verified; evidence recovery re-verified; manual owner check and understanding review pending.
- Relevant files: `prisma/schema.prisma`, `lib/browser.ts`, `lib/evidence.ts`, `app/api/[[...route]]/route.ts`, `components/sentinel-views.tsx`, `docker-compose.yml`, `demo-target/index.html`, `tests/run-api.test.ts`, `tests/phase-2-runs.spec.ts`, `tests/evidence.test.ts`.
- Related decisions: D-022 and D-023 in `decisions-log.md`.
- Related verification: `docker compose exec sentinel npm run lint`, `docker compose exec sentinel npm run typecheck`, `docker compose exec sentinel npm test`, `docker compose exec sentinel npx playwright test tests/phase-2-runs.spec.ts`, plus the Phase 1 browser regressions.

### What this feature does

It lets an authorized tester start a Run from a saved Test Case and follow its immutable saved steps in strict order inside the existing restricted browser. Sentinel saves the factual result—Passed, Failed, or Interrupted—separately from whether all evidence was captured. It stores screenshots privately in local MinIO, keeps redacted network/console/storage metadata in PostgreSQL, and never saves full browser video.

### End-to-end flow

The tester chooses **Run test** on a saved Test Case. The API verifies Product membership, selects the current immutable Test Case version, creates one pending result for each saved step, and starts the one local browser. It captures initial evidence before returning the focused Run workspace.

The workspace makes only the active step actionable. Passing it persists the step result, collects a storage/network/console boundary snapshot, and activates the next step. Failing captures a failure screenshot and ends the Run safely. Interrupt captures final available evidence and ends with an Interrupted outcome. Refreshing `/runs/[id]` reloads the persisted active step and the noVNC viewer URL, so the browser session can continue. The local Selenium session allows 30 minutes of idle time because noVNC input does not reset Selenium's WebDriver timer. The Demo CRM's successful sign-in and customer creation make same-origin activity requests and set minimal session state, allowing the evidence fixture to show meaningful Network and redacted Storage entries.

`lib/evidence.ts` redacts values before database persistence. Cookie and storage values become `[REDACTED]`; network JSON/text snippets are limited to 4 KiB after key-based redaction. Screenshot bytes are uploaded to the private `sentinel-evidence` MinIO bucket, hashed with SHA-256, and exposed only after another Product-membership check creates a 15-minute signed link.

### Technologies, choices, and tradeoffs

| Technology / pattern | Why it is used | Tradeoff |
|---|---|---|
| Prisma Run, RunStepResult, and EvidenceItem models | Preserve the exact saved version, ordered manual progress, evidence references, and audit history | The initial model is deliberately local and does not yet represent retries or concurrent workers. |
| Selenium plus in-page browser instrumentation | Extends the existing locked browser instead of replacing it | Fetch and warning/error-console interception is appropriate for the Demo CRM baseline; richer protocol coverage belongs with the replay worker. |
| MinIO plus AWS SDK v3 | Reproduces private S3-style evidence storage in Docker | Local development credentials and manual volume cleanup are not production retention controls. |
| Separate outcome and capture status | A missing artifact must not turn a passed test into a failed test | Users need to read both statuses when assessing trust in a Run. |
| Strict guided checklist | Makes a Phase 2 Run demonstrable without pretending saved steps replay automatically | Skip, pause, flexible ordering, queues, and autonomous replay remain deferred to Phase 3. |

### Risks and future improvements

- There is one global browser session. A Run and a recording cannot safely coexist, and this is not a multi-user runner design.
- Screenshot-object cleanup is manual in local Docker. Production needs retention, encryption, bucket policy, monitoring, and lifecycle rules.
- The browser instrumentation captures application fetches after setup and warning/error console output. It does not capture an intentionally quiet happy-path console, every browser protocol event, or pre-injection activity; Phase 3 should move evidence collection into a dedicated automation worker with broader protocol coverage.
- The Run UI shows persisted redacted metadata. It must never be changed to display raw cookie, token, or payload values merely for debugging convenience.

### Ten-question understanding check

1. Why does a Run store both `testCaseVersionId` and one `RunStepResult` for every saved step?
2. Why is `evidenceStatus` separate from the final `outcome`, and what result should a passed Run with one failed screenshot upload show?
3. Which API operations enforce strict step order, and what response should a client receive when it tries to complete step two before step one?
4. How does the UI restore an active Run after a page refresh without recreating the browser session?
5. Which evidence artifacts are stored in MinIO, which are stored in PostgreSQL, and why are they split that way?
6. How do `redactedBodySnippet` and `redactedStorageSnapshot` prevent sensitive values from reaching the database?
7. Why must Product membership be checked again before creating a signed evidence URL?
8. What happens when evidence capture fails after a tester has passed or failed a step, and why is that safer than changing the test outcome?
9. Why is the Phase 2 browser instrumented rather than automatically executing the saved selectors itself?
10. Which files should be reviewed first before introducing concurrent Runs, automatic replay, or a production object-storage provider?

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

| Priority | File | What changed | Review action |
|---|---|---|---|
| Highest | `app/api/[[...route]]/route.ts` | Product authorization, Run lifecycle transitions, browser ownership, and signed-evidence authorization | Read now; this is the principal security and business-behavior boundary. |
| Highest | `lib/evidence.ts` and `lib/browser.ts` | Redaction, MinIO writes/signing, screenshot checksums, browser evidence collection, and global session handling | Read now; these files control sensitive data and browser isolation. |
| Highest | `prisma/schema.prisma` and its migration | Immutable version binding, Run/step/evidence relationships, cascading behavior, and enums | Read now before evolving persistence or retention. |
| Medium | `components/sentinel-views.tsx`, `app/runs/*`, and `app/globals.css` | Guided Run controls, refresh recovery, evidence display, navigation, and focused workspace layout | Read next; confirms the UI cannot bypass strict server behavior. |
| Medium | `tests/run-api.test.ts`, `tests/phase-2-runs.spec.ts`, and `tests/evidence.test.ts` | Authorization, ordering, START/END capture, network/console/storage redaction, refresh, and failure-path expectations | Read next; these tests document the Phase 2 contract. |
| Medium | `docker-compose.yml` and `demo-target/index.html` | Extends local browser lifetime and produces observable fixture activity | Read next; these settings prevent incomplete manual evidence and must not be copied blindly to production targets. |
| Lower | Docker, package, and documentation files | Local MinIO configuration and recorded decisions | Skim after the behavior-critical code; keep them aligned with production choices. |

#### Follow-up learning tasks

- Owner completes the ten answers above; any incorrect answer should be revisited against the referenced code and tests.
- Owner manually starts a saved Test Case Run, refreshes while it is active, completes the Demo CRM journey, passes every step, and confirms START/END screenshots, Network entries, and redacted Storage entries. A quiet Console panel is correct for the happy path; use an incorrect Demo CRM password to verify warning capture.
- Before Phase 3, decide how worker-owned browser allocation, retries, evidence retention, and production object-storage credentials will replace the single local session.

---

## Feature: Phase 3 autonomous replay engine

- Date: 2026-08-10
- Phase: 3
- Status: Implementation and automated acceptance verified; owner understanding review pending.
- Relevant files: `worker.ts`, `lib/replay.ts`, `lib/queue.ts`, `lib/evidence.ts`, `app/api/[[...route]]/route.ts`, `prisma/schema.prisma`, `docker-compose.yml`, `tests/auto-run-api.test.ts`, and `tests/phase-3-auto-runs.spec.ts`.
- Related decisions: D-024 in `decisions-log.md`.

### What this feature does

It adds an Auto Run alongside the existing tester-guided Run. Sentinel queues a saved Test Case, opens an isolated headless browser, performs safe recorded actions, pauses only at recorded checkpoints, and records outcome plus privacy-safe evidence without storing video.

### End-to-end flow

A product-authorized tester chooses Auto Run. Sentinel validates that the current immutable version has no unsupported variable-marked steps, creates the Run and first attempt in PostgreSQL, and queues it in Redis. A two-concurrency worker opens a fresh Playwright context, uses worker-only Demo CRM credentials for password fields, replays each deterministic action, and saves step/evidence boundaries. It pauses after a checkpoint until Continue or Cancel, retries one transient technical failure as a linked second attempt, and otherwise completes safely with a clear reason. Run Detail shows progress, attempts, evidence, checkpoint review, and duration comparison.

### Technologies and patterns

| Technology / pattern | Why it is used | Important limitation |
|---|---|---|
| Redis + BullMQ | Durable queued work, retry control, and bounded worker concurrency | Local Docker reliability is not a production queue deployment. |
| Playwright contexts | Fresh headless browser isolation for two autonomous Runs | The Phase 3 target remains the local Demo CRM only. |
| Exact unique selector fallbacks | Tolerate supported cosmetic change without choosing an uncertain element | Missing or multiple matches stop rather than recover automatically. |
| Run Attempt records | Preserve retry history without overwriting the original Run | Phase 3 supports only one technical retry. |

### Tradeoffs and alternatives

- Keep Guided Run separate from Auto Run so manual verification behavior does not change.
- Use server-only Demo CRM credentials rather than Phase 4 variable input.
- Treat free-text expected outcomes as review context instead of unsafe executable assertions.
- Hold a worker context during a ten-minute checkpoint pause; this is simple locally but consumes one of two worker slots.

### Risks and future improvements

- Non-password variables block Auto Run until Phase 4.
- External targets, production credentials, larger concurrency, schedules, and worker recovery across a process restart remain later work.
- The owner must answer the questions below before this feature is considered understood.

### Ten-question understanding check

1. Why are Guided Run and Auto Run separate modes instead of one action?
2. What transaction must complete before the worker receives an Auto Run job?
3. How do Redis, BullMQ, and the worker’s concurrency setting prevent more than two local Auto Runs at once?
4. Why does each Auto Run need a fresh Playwright browser context?
5. Which selector fallbacks are allowed, and why must each resolve to exactly one element?
6. Why is a later navigation record verified instead of executed with a page reload?
7. How are password steps replayed without persisting the secret, and why do non-password variables block Auto Run?
8. What happens at a checkpoint, timeout, and explicit cancel action?
9. Which failures receive one retry, and why are ambiguity and action failures excluded?
10. How is the manual-duration benchmark calculated, and what happens when three guided Runs do not exist?

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

| Priority | File group | Why it needs attention | Review action |
|---|---|---|---|
| Highest | `worker.ts`, `lib/replay.ts`, `lib/queue.ts`, `app/api/[[...route]]/route.ts`, `prisma/schema.prisma`, and the Phase 3 migration | Browser automation, durable state, credentials, cancellation, retry history, and authorization are behavior-critical | Read now |
| Medium | `components/sentinel-views.tsx`, `tests/auto-run-api.test.ts`, and `tests/phase-3-auto-runs.spec.ts` | Exposes state and encodes the replay, checkpoint, concurrency, retry, benchmark, and UI safety contract | Read next |
| Lower | Docker and documentation | Local service wiring and learning context | Skim after behavior is understood |

#### Follow-up learning tasks

- Owner answers all ten Phase 3 questions after implementation.
- Before production, define external target policy, worker deployment, credential provider, retention, and concurrency limits.
- Owner manually records and saves the Demo CRM journey, starts an Auto Run, reviews a checkpoint, and checks attempts, redacted evidence, and duration comparison in Run Detail.

---

## Feature: Phase 4 variables and test-data lifecycle

- Date: 2026-08-12
- Phase: 4
- Status: Implementation and automated acceptance verified on 2026-08-13; owner understanding review pending.
- Relevant files: `lib/variables.ts`, `prisma/schema.prisma`, `prisma/migrations/20260812100000_add_variable_lifecycle/migration.sql`, `app/api/[[...route]]/route.ts`, `lib/browser.ts`, `lib/replay.ts`, `worker.ts`, `components/sentinel-views.tsx`, `app/test-data/page.tsx`, and Phase 4 tests.
- Related decision: D-025 in `decisions-log.md`.

### What this feature does

It lets a tester replace a recorded changing value with one safe reusable value, a field from a product-owned Test Data Set, or a value entered for one Run. It solves the Phase 3 limitation where Auto Run stopped whenever a non-password text step had a variable marker.

### Intended end-to-end flow

While recording, a tester explicitly enters a canonical variable name. The browser step keeps a placeholder and Sentinel encrypts the original non-secret value instead of leaving it in the step. Saving copies the variable definition to the immutable Test Case version. Automated variable-name suggestions are deferred because the current safe recorder boundary must not create one step for each keystroke.

Before either Run mode begins, a binding dialog collects one source for each canonical variable name. The API re-checks Product membership, validates secret-like input, encrypts the resolved values into Run bindings, and reserves any selected safe Test Data Set in one transaction. Guided replay and the Auto Run worker decrypt only the current binding long enough to fill the matching browser field. Evidence and Run Detail expose variable names and source status, not raw values. Passing consumes selected test data; all other terminal outcomes release it.

### Technologies, choices, and tradeoffs

| Technology / pattern | Why it is used | Tradeoff |
|---|---|---|
| Node.js AES-256-GCM | Encrypts local variable data with authentication and no new service | Local Docker still needs a carefully protected environment key; production rotation is deferred. |
| Prisma transactions | Make Run creation and pool reservation atomic | The local pool is intentionally simpler than an external data-provider adapter. |
| Per-Run encrypted bindings | Refreshes and Auto retries use the same values without asking again | Sentinel retains encrypted values for the Run lifecycle, so response and log redaction must remain strict. |
| Local Test Data Sets | Gives the Demo CRM a reproducible safe pool now | It does not prove external-system freshness or QA PostgreSQL state. |

### Important implementation and safety details

- Variable names are canonical and case-insensitive. The same name on several steps means one shared value, not several accidental values.
- Passwords and secret-like values remain outside this system. Existing server-only Demo CRM credentials continue to fill password fields.
- Test Data Set lists disclose only name, field names, lifecycle, and audit context. Persisted values cannot be read back through Sentinel after creation.
- A Test Data Set moves from `SAFE` to `RESERVED` only during a successful Run-start transaction. It becomes `CONSUMED` only after a passed Run and can otherwise return to `SAFE`; `INVALID` and `CONSUMED` states require a replacement record rather than a reset.

### Alternatives and limitations

- Sentinel chose a local pool over an external adapter because no existing provider contract was supplied and Phase 4 must remain Docker-local.
- Sentinel chose explicit binding selection over automatic value choice so a tester can review consequential test data before a Run.
- Sentinel does not query a QA database in this phase. Phase 10 will define separately credentialed, allowlisted, read-only diagnostic/state checks.
- The encryption key is environment configuration, not production key management. Rotation, external pools, retention, and per-field data classification remain future work.

### Verification and priority-based diff review

Docker lint and TypeScript checks passed. The Vitest suite covered encryption, Test Data reservation/release, one-off-value redaction, Auto replay, and Guided manual substitution. Browser checks passed for the Phase 1 recording flow, Phase 2 guided Runs, Phase 3 Auto Runs, and the Phase 4 masked Test Data/checkpoint/consumption journey.

| Priority | Files and areas | Why review them | Owner action |
|---|---|---|---|
| Highest | `lib/variables.ts`; `app/api/[[...route]]/route.ts`; `worker.ts`; `lib/browser.ts`; `lib/replay.ts`; `prisma/schema.prisma`; Phase 4 migrations | Encryption, authorization, atomic reservation, lifecycle state transitions, browser substitution, and migration of prior plaintext step values are security- and behavior-critical. Pay particular attention to `encryptVariableValue`, `createRunBindings`, `migrateLegacyVariables`, `updateReservedDataSet`, and Auto Run cancellation/state claims. | Read now. |
| Medium | `components/sentinel-views.tsx`; `app/test-data/page.tsx`; `tests/variables-api.test.ts`; `tests/run-api.test.ts`; `tests/phase-4-variables.spec.ts` | These files define the masked user experience and preserve the contracts for sources, suggestion acceptance, lifecycle, and non-serialization. | Read next. |
| Lower | `.env.example`, `docker-compose.yml`, README and phase documents | They explain required local configuration and the chosen boundary; they do not contain the variable values themselves. | Skim after the behavior-critical code. |

### Ten-question understanding check

1. Why do saved browser steps use a variable placeholder instead of retaining the variable’s original value?
2. Which data crosses the pre-run form, which data is encrypted at rest, and which data must never appear in Run Detail or evidence?
3. Why is AES-GCM preferable here to plaintext local PostgreSQL fields, and what does it not solve by itself?
4. Why does the Run-start transaction reserve a Test Data Set at the same time it creates encrypted bindings?
5. What is the lifecycle difference between `SAFE`, `RESERVED`, `CONSUMED`, and `INVALID`, and which Run outcome causes each transition?
6. Why does one canonical variable name resolve to one shared value across several steps?
7. How do Guided replay, Auto replay, page refresh, and an Auto retry obtain the same resolved value without exposing it?
8. Why are passwords, tokens, cookies, authorization values, and API-key variants rejected as Phase 4 variables?
9. Why do Test Data Set pages show field names and lifecycle but not stored values, even to Product members?
10. Which important validity check is deliberately deferred to Phase 10, and why is a local pool-state check not equivalent?

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

#### Follow-up learning tasks

- Owner answers all ten Phase 4 questions after implementation and reviews any answer against the final source and tests.
- Before production, choose managed key storage/rotation, an external test-data provider contract, and approved read-only QA database checks.
- Revisit non-blocking variable-name suggestions after designing recorder-level settled-value capture that cannot produce per-keystroke recorded steps.

---

## Feature: Phase 4 Test Data reuse policies

- Date: 2026-08-14
- Phase: 4 adjustment
- Status: Implementation and automated acceptance verified; owner understanding review pending.
- Relevant files: `prisma/schema.prisma`, `prisma/migrations/20260814100000_add_test_data_reuse_policy/migration.sql`, `app/api/[[...route]]/route.ts`, `worker.ts`, `components/sentinel-views.tsx`, `docker-compose.yml`, `tests/variables-api.test.ts`, and `tests/phase-4-variables.spec.ts`.
- Related decision: D-027 in `decisions-log.md`.

### What this feature does

Test Data Sets now default to reusable instead of being permanently consumed after every passed Run. A tester can choose single-use only when a data value, such as a unique customer or order, should not be used again after it has produced a successful result.

### Intended end-to-end flow

When creating a Test Data Set, a product member selects `REUSABLE` or `SINGLE_USE`; the default is reusable. Sentinel encrypts the values as before and returns only the name, field names, status, and policy. Starting a Guided or Auto Run reserves a safe selected set atomically, so another active Run cannot bind the same set. At terminal completion, reusable data returns to safe regardless of outcome. A single-use set returns to safe for Failed, Interrupted, Cancelled, and rejected Runs, but becomes consumed after Passed. The migration reactivates prior consumed data as safe reusable data without exposing or rewriting its encrypted values.

### Technologies, choices, and tradeoffs

| Technology or approach | Why it is used | Tradeoff |
|---|---|---|
| Prisma enum and migration | Persists an explicit policy and safely changes existing local data | The database remains local-only and cannot determine whether an external target record is reusable. |
| Atomic `updateMany` reservations | Retains one-active-Run protection for both policies | Reusable means sequential reuse, not simultaneous reuse. |
| Shared API and worker lifecycle rules | Keeps Guided and Auto terminal behavior equivalent | The same policy logic exists at two execution boundaries and needs matching tests. |
| Worker-side Prisma generation | Prevents a worker from using a stale generated client after a schema change | Startup takes a small additional amount of time. |

### Important implementation and safety details

- Values remain AES-256-GCM encrypted and are not returned by Test Data APIs, lists, binding dialogs, evidence, logs, or audit text.
- Omitting the policy in an API request remains backward-compatible and creates a reusable set. Invalid policy values are rejected.
- `RESERVED` is not a usage count. It is an exclusive lease that lasts only for one active Run and is cleared at a terminal transition.
- `CONSUMED` is now meaningful only for a passed single-use Run. Product members can still invalidate an eligible safe set deliberately.
- The migration changes old consumed records to safe reusable records, preserving their encrypted fields rather than requiring people to enter those values again.

### Alternatives and limitations

- Always-reusable data was rejected because it would allow accidental reuse of successful unique target data.
- Always-single-use data was rejected because it defeated the main value of reusable test fixtures.
- Sentinel does not clean up Demo CRM or future QA-target records. The tester selects single-use when external state makes reuse unsafe.
- External data providers, target-state checking, and automated cleanup remain future work.

### Verification and priority-based diff review

Docker validation passed: `docker compose exec sentinel npm run lint`, `docker compose exec sentinel npm run typecheck`, `docker compose exec sentinel npx vitest run tests/variables-api.test.ts`, and `docker compose exec sentinel npx playwright test tests/phase-4-variables.spec.ts`. The migration applied successfully through `prisma migrate deploy` when the stack started.

| Priority | Files and areas | Why review them | Owner action |
|---|---|---|---|
| Highest | `prisma/schema.prisma`; `prisma/migrations/20260814100000_add_test_data_reuse_policy/migration.sql`; `app/api/[[...route]]/route.ts`; `worker.ts`; `docker-compose.yml` | They define persisted lifecycle behavior, migrate existing records, preserve exclusive reservation, and prevent stale generated database clients in the worker. Review `TestDataReusePolicy`, `updateReservedDataSet`, `completeRun`, and the worker command. | Read now. |
| Medium | `components/sentinel-views.tsx`; `tests/variables-api.test.ts`; `tests/phase-4-variables.spec.ts` | They expose the deliberate policy choice and encode the expected reusable/single-use behavior. | Read next. |
| Lower | Phase 4 documentation | It records the product intent, manual test path, and limitation around external cleanup. | Skim after the behavior-critical code. |

### Ten-question understanding check

1. Why does Sentinel distinguish a reusable Test Data Set from a single-use Test Data Set?
2. What does `RESERVED` protect against, and why is a reusable set not available to another active Run?
3. Which terminal outcomes return reusable data to `SAFE`, and which outcome consumes single-use data?
4. Why does the migration change old `CONSUMED` records to reusable `SAFE` records instead of asking the tester to enter the values again?
5. What is the difference between Sentinel marking a set consumed and deleting or cleaning up a record in the Demo CRM?
6. Where is the reuse policy validated when a Test Data Set is created, and what happens when an older client omits it?
7. Why must the API and the Auto Run worker implement matching terminal lifecycle behavior?
8. How do the API integration test and browser test jointly prove that data is safe, hidden, exclusive while active, reusable when intended, and consumed only when intended?
9. Why does the worker run Prisma Client generation before starting, and what failure can occur if it uses a stale generated client after a schema migration?
10. If Sentinel later adds external QA-state cleanup, which policy and lifecycle guarantees must remain unchanged?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- Owner answers all ten questions and compares the answers with D-027, the migration, the API lifecycle helper, and the worker completion path.
- Before production, define an approved external test-data provider or cleanup contract rather than assuming local lifecycle state reflects external target state.

---

## Feature: Phase 5 Test Case versioning and Release management

- Date: 2026-08-15
- Phase: 5
- Status: Implementation and automated acceptance verified; owner understanding review pending.
- Relevant files: `prisma/schema.prisma`, `prisma/migrations/20260815090000_add_test_case_versions_and_releases/migration.sql`, `app/api/[[...route]]/route.ts`, `lib/releases.ts`, `worker.ts`, `components/test-case-editor.tsx`, `components/release-views.tsx`, `components/sentinel-views.tsx`, `tests/release-api.test.ts`, and `tests/phase-5-release.spec.ts`.
- Related decision: D-028 in `decisions-log.md`.

### What this feature does

Phase 5 lets a product member organize a Test Case with product-local feature labels, make a safe edit without rewriting history, and group Tests into a Release. Saving an edit produces Version 2 (or a later version) rather than changing Version 1. A Release Run snapshots the exact current version of every tagged Test Case, queues only Auto-eligible items, and derives one honest readiness result for the entire batch.

### Intended end-to-end flow

On the Test Case editor, the member starts with the current immutable version. They may adjust safe target metadata, non-secret text values, variable markers, checkpoints, descriptions, expected outcomes, and labels, but cannot reorder steps or change their kind. The API validates this input, clones the ordered steps into a new `TestCaseVersion`, updates `currentVersion`, replaces label associations, and writes an audit event. The older version and every Run pointing to it stay unchanged.

When a member creates or changes a Release, Sentinel verifies membership in every represented Product before saving the Test Case tags. Starting a Release Run loads the Release inside a database transaction, obtains each Test Case's current version, and creates a persisted item for every tag. A checkpoint, or a variable that lacks an encrypted static default, becomes a visible excluded item. For every eligible item, the transaction creates an Auto Run, first Run Attempt, ordered Run Step Results, and encrypted static bindings, then records the Release Run item linked to that Run. After the transaction, the existing BullMQ queue receives each attempt. The worker changes linked items from queued to running and finally to passed, failed, or interrupted. `lib/releases.ts` recalculates readiness after each material change: outstanding work is In progress; every pass is Ready; any failure, interruption, or exclusion is Not ready.

### Technologies, choices, and tradeoffs

| Technology or approach | Why it is used | Tradeoff |
|---|---|---|
| Prisma version and Release relations | Keeps immutable history, authorization, batch snapshots, and audit writes in PostgreSQL transactions. | The schema has more join records than a mutable Test Case table, but historical meaning stays clear. |
| Product-local labels and a join table | Allows the same label name to be meaningful only within its Product and supports multiple labels per Test Case. | There is no standalone label-cleanup screen yet; unused labels may remain. |
| Existing BullMQ worker | Reuses Phase 3 retries, two-context concurrency, evidence, and credential boundaries for Release items. | Phase 5 does not add schedules or separate Release-specific workers. |
| Derived readiness helper | One small shared rule projects Auto Run outcomes into Release state without duplicating the calculation in API and worker code. | Every terminal Run path must call the helper; tests are important to prevent a stale Release display. |

### Important implementation and safety details

- Test Case version saves preserve order and `StepKind`; target metadata accepts only a narrow set of Demo CRM fields and same-origin URLs.
- Redacted password steps cannot become variables or expose a replacement value. New secret-like values are rejected before encryption or persistence.
- Test Case ownership does not change when another authorized Product member creates a later version; the audit event records who edited it.
- Releases are hidden from a user unless they belong to every Product currently represented in the Release. The same membership check protects Release details and changes.
- A Release Run is reproducible: later edits to tags or Test Cases cannot alter its stored version IDs.
- Exclusions are data, not a UI-only warning. They count toward `Not ready` and retain a clear reason.
- Release batches never use the guided noVNC browser. Existing individual Guided and Auto Run routes keep their contracts.
- The Docker API and worker now use separate dependency volumes. This prevents concurrent `prisma generate` executions from overwriting the same generated native client during startup.

### Alternatives and limitations

- Mutating the current Test Case rows was rejected because a previous Run would then appear to have used steps that did not exist when it ran.
- A separate batch queue was rejected because it would duplicate retry, evidence, and concurrency behavior already implemented for Auto Runs.
- Running all tagged Tests regardless of safety was rejected. Phase 5 deliberately excludes checkpoints and variables requiring manual or pooled data rather than guessing at a binding.
- Release readiness is a test-execution signal, not a deployment approval. Notifications, schedules, JIRA, approvals, and release deployment integration remain future work.
- Feature labels cannot yet be renamed or retired independently, and cross-product Release access uses the current membership set rather than a historical access snapshot.

### Verification and priority-based diff review

Docker applied `20260815090000_add_test_case_versions_and_releases`. `docker compose exec sentinel npm run lint`, `docker compose exec sentinel npm run typecheck`, and the full `docker compose exec sentinel npm test` suite passed. `docker compose exec sentinel npx playwright test` passed all 10 browser specs. The focused API test covers labels, immutable history, cross-product denial, explicit exclusions, a successful linked Auto Run batch, and derived readiness. The focused browser test covers editing Version 2, label filtering, Release creation, and a visible excluded Release item.

| Priority | Files and areas | Why review them | Owner action |
|---|---|---|---|
| Highest | `prisma/schema.prisma`; `prisma/migrations/20260815090000_add_test_case_versions_and_releases/migration.sql`; `app/api/[[...route]]/route.ts`; `lib/releases.ts`; `worker.ts`; `docker-compose.yml` | They define immutable data, access boundaries, batch creation, Run-to-Release state projection, and safe generated-client startup. Focus on the version-save transaction, Release membership checks, exclusion calculation, `refreshReleaseRun`, and worker completion hooks. | Read now. |
| Medium | `components/test-case-editor.tsx`; `components/release-views.tsx`; `components/sentinel-views.tsx`; `tests/release-api.test.ts`; `tests/phase-5-release.spec.ts` | They make safe edits and Release state understandable, and encode the product behavior users rely on. | Read next. |
| Lower | Route wrapper pages, sidebar link, CSS, and Phase 5 documentation | They expose the feature and record its intended behavior, but do not define its core security or data consistency rules. | Skim after the behavior-critical code. |

### Ten-question understanding check

1. Why does Sentinel create a new `TestCaseVersion` instead of updating the saved steps in place?
2. Which fields may the Phase 5 editor change, and which two step properties must it preserve?
3. How do feature labels stay local to a Product while allowing more than one label on a Test Case?
4. What exact membership rule controls whether someone may view or change a cross-product Release?
5. At what moment are Test Case versions fixed for a Release Run, and why does that make a batch reproducible?
6. Which Test Cases are excluded from a Release batch, and why is an exclusion counted as `Not ready` rather than silently ignored?
7. What records are created for an eligible Release item before it is sent to BullMQ?
8. How does `lib/releases.ts` keep Release readiness synchronized when the worker starts, passes, fails, or interrupts an Auto Run?
9. Why were API/worker dependency volumes separated in Docker, and what failure did that prevent?
10. If Phase 6 adds Release notifications or scheduling, which immutable-version, authorization, and readiness guarantees must remain unchanged?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- Owner answers all ten Phase 5 questions and compares the answers with D-028, the migration, the version-save route, `lib/releases.ts`, and `worker.ts`.
- Before production, decide whether Release access should be historically snapshotted, how unused labels are retired, and what external deployment signal may change a Release's broader approval state.

## Feature: Phase 5 adjustment — locked recorded browser actions

**Date:** 2026-08-19
**Status:** Implemented and verified; owner learning answers pending.

### What this feature does

The saved-Test-Case editor is now a controlled maintenance screen, not a way to rewrite a captured browser journey. A tester may edit labels, descriptions, expected outcomes, checkpoints, and a non-secret text-entry variable marker. The browser target (the information Sentinel uses to locate an element), literal captured input, password redaction, step type, and step order stay read-only. To change what the browser actually does, the tester records a new journey.

This solves a practical reliability problem: changing JSON target metadata by hand can make an Auto Run click a different element even though the edited Test Case appears reasonable. It also makes the old term “Safe text value” unnecessary. The screen now calls it **Recorded input** and explains whether it is a fixed captured value, a variable-backed action, or a redacted password.

### End-to-end flow

1. Sentinel loads the current immutable Test Case version into `components/test-case-editor.tsx`.
2. The page shows recorded target and input fields as read-only context, while the allowed annotation and checkpoint controls remain editable.
3. On save, the client sends only the editable information for each step; it does not send target or value replacements.
4. `app/api/[[...route]]/route.ts` independently protects the boundary. If a request supplies a changed target or value, it returns a clear validation error instead of creating a version.
5. When a tester newly marks a non-secret text-entry step as a variable, the server encrypts the already-captured value as its default and saves a placeholder in the new version. Existing variable defaults remain encrypted. Removing a marker is deliberately unavailable because Sentinel no longer keeps its original plaintext value.
6. A valid edit creates the next immutable version and preserves all previous versions and their linked Runs.

### Technologies, choices, and tradeoffs

- **React read-only controls** in `components/test-case-editor.tsx` communicate the boundary before a save attempt. `app/globals.css` gives these fields a subdued token-based appearance without introducing new literal colours.
- **Server-side validation** in the Next.js route is the real protection. A browser user can alter client-side code or send an API request directly, so a read-only HTML field alone would not be enough.
- **JSON comparison** detects a submitted target that is different from the stored target. It favors a strict, conservative rule over accepting a possibly changed selector representation.
- **Phase 4 encryption utilities** in `lib/variables.ts` still encrypt a captured non-secret input when it becomes a variable. The raw value is not carried forward in a variable-marked saved step.

The simpler alternative was to keep the JSON editor and only validate its shape. It was rejected because a syntactically valid target can still point at the wrong browser element. Allowing edited literal input was also rejected: it quietly changes the behavior of a saved test and is confusing alongside the dedicated encrypted Variables section.

### Limitations and safe future changes

- A tester cannot correct a bad selector, URL, or captured literal from this page; they must create a new recording. A future controlled “re-record one step” workflow could address that without exposing arbitrary JSON.
- A variable marker cannot be removed here, because reconstructing a literal would require retaining or re-entering sensitive-prone data. A future dedicated conversion flow would need explicit confirmation and the same secret checks.
- The server comparison is intentionally strict. Any future selector-normalization rule must be tested carefully so it does not turn into a way to change replay behavior invisibly.

Relevant files: `components/test-case-editor.tsx`, `app/api/[[...route]]/route.ts`, `app/globals.css`, `tests/release-api.test.ts`, `srd.md`, and decision D-029 in `decisions-log.md`.

### Verification and priority-based diff review

`npm run lint` and `npm run typecheck` passed. `docker compose exec sentinel npx vitest run tests/release-api.test.ts` passed 3 tests: a changed target is rejected, a changed literal input is rejected, and converting a captured text step to a variable succeeds. A live Playwright CLI check attempted to fill **Recorded browser target** and received “element is not editable.”

| Priority | Files and areas | Why review them | Owner action |
|---|---|---|---|
| Highest | `app/api/[[...route]]/route.ts` | The version-save transaction now decides which Test Case fields are immutable and protects against crafted API requests. Review the `STEP_TARGET_IMMUTABLE`, `STEP_VALUE_IMMUTABLE`, and variable-marker paths. | Read now. |
| Medium | `components/test-case-editor.tsx`; `tests/release-api.test.ts` | The editor must communicate the boundary accurately, and the test captures the rejection/allowed-marker contract. | Read next. |
| Lower | `app/globals.css`; `srd.md`; `phases.md`; `frontend.md`; `README.md`; `decisions-log.md` | These make the visual state and product decision understandable but do not enforce it. | Skim. |

### Ten-question understanding check

1. Why is target metadata treated as a browser action rather than ordinary editable Test Case text?
2. Why must the API reject a changed target or value even though the React field is read-only?
3. Which fields can a tester still change in the saved-Test-Case editor, and why are those changes safe?
4. What does **Recorded input** mean, and how is it different from a variable’s static default?
5. What happens to the captured value when a non-secret text-entry step is newly marked as a variable?
6. Why cannot this editor remove a variable marker after a Test Case has been saved?
7. Which route and error code protect a changed target, and what should a client show to the tester?
8. Why is allowing structurally valid JSON not sufficient protection for a selector or URL change?
9. How do immutable Test Case versions and this restriction together protect the meaning of historical Runs?
10. If a future feature allows changing one recorded action, what security and review safeguards should it provide?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- Owner answers all ten questions above and compares the answers with D-029, `components/test-case-editor.tsx`, the version-save route, and `tests/release-api.test.ts`.

---

## Feature: Phase 6 Health Dashboard and reliable notifications

- Date: 2026-08-20
- Phase: 6
- Status: Implementation and automated acceptance verified; owner manual and understanding reviews pending.
- Relevant files: `prisma/schema.prisma`, `prisma/migrations/20260820110000_add_notifications/migration.sql`, `prisma/migrations/20260820110500_deduplicate_notifications/migration.sql`, `lib/dashboard.ts`, `lib/notifications.ts`, `lib/queue.ts`, `worker.ts`, `app/api/[[...route]]/route.ts`, `components/sentinel-views.tsx`, `components/notification-views.tsx`, `docker-compose.yml`, `tests/dashboard-notifications.test.ts`, `tests/dashboard-notifications-api.test.ts`, and `tests/phase-6-dashboard-notifications.spec.ts`.
- Related decision: D-030 in `decisions-log.md`.

### What this feature does

Phase 6 gives a product member a trustworthy 30-day health view and an in-app notification inbox. The Dashboard answers: how many saved Test Cases exist, how many Runs completed, whether they are passing, what is flaky, whether coverage grew, and what happened most recently. The inbox makes new failed Runs, Auto Run checkpoint pauses, and completed Release batches actionable. Mailpit receives only a short local email summary; evidence, screenshots, raw logs, variable values, cookies, and credentials stay inside Sentinel.

### Intended end-to-end flow

- A signed-in member requests `/api/dashboard`. Sentinel first finds the Products they currently belong to, then calculates the fixed UTC window and derives per-Product metrics from saved Test Cases and completed Runs. It uses the current Test Case version when deciding whether a Test is flaky, so an old failure cannot make a newer version look flaky by itself.
- A failure, checkpoint, or completed Release calls a notification helper. The helper de-duplicates owner and initiator IDs, writes one `Notification` record and one audit event per recipient, then sends only the record ID to the BullMQ notification queue.
- The worker reads that durable record, renders a safe text-only summary, and sends it through local SMTP to Mailpit. It marks the notification sent or, after one transient retry, failed. A delivery problem never rewrites the factual Run outcome, evidence state, or Release readiness.
- The Notifications page filters unread or all notices, checks current Product membership before returning or marking a notice read, and offers links only to protected Sentinel Run or Release pages.

### Technologies, choices, and tradeoffs

| Technology or approach | Why it is used | Tradeoff |
|---|---|---|
| Prisma `Notification` records with unique recipient/event keys | Makes in-app notices durable, auditable, and idempotent before background delivery starts. | A local database retains notification history until the Docker data is deliberately removed; Phase 6 has no deletion or preference controls. |
| A pure dashboard projection in `lib/dashboard.ts` | Keeps health definitions testable without putting metric logic in React or raw API handlers. | Metrics are calculated from local data at request time; a future high-volume product may need a read model. |
| Existing Redis/BullMQ worker plus a separate notification queue | Prevents SMTP latency or retries from blocking the web request or Auto Run queue. | There is still one local worker process; production monitoring and a dead-letter policy are future work. |
| Mailpit and Nodemailer | Lets the owner inspect genuine SMTP messages locally without real credentials or external delivery. | Mailpit is a development sink, not a production email provider. |
| Safe email renderer and current-membership authorization | Preserves the evidence and variable privacy boundaries while ensuring an old link does not bypass current access. | The email is intentionally brief; a member must open Sentinel to inspect evidence. |

### Important implementation and safety details

- The window uses UTC calendar days: today plus the previous 29 days, ending at the next UTC midnight. Interrupted Runs contribute to completed count but not the pass-rate denominator or trend bars.
- A current Test Case version is flaky only when that exact version has at least one Passed and one Failed Run in the window.
- Notification events are created only when new Phase 6 runtime events occur. Existing historical Runs are not backfilled.
- Unique `(recipient, run, type)` and `(recipient, releaseRun, type)` keys protect against duplicate helper calls. If the owner and initiator are the same person, only one notice is created.
- SMTP errors are stored as a generic safe summary. Transient connection errors, including Nodemailer's `ESOCKET` wrapper, retry once; a second failure becomes `FAILED` with an audit event. The delivery code safely tolerates a notification being retired while a worker has already loaded it.
- Evidence access remains a separate signed-link path with Product checks. Neither the Dashboard nor email serializes evidence metadata or contents.

### Alternatives and limitations

- A chart library was rejected because the product already has a custom CSS token system and the small daily trend can remain accessible as semantic HTML without a new dependency.
- Synchronous email delivery was rejected because a local SMTP outage should not slow or change a Run result.
- Slack, external email providers, preferences, digests, deletion, historical backfill, user-specific time zones, and Phase 9 approval notices are intentionally deferred.
- The Dashboard is not a release-approval system. It surfaces current operational signals; Release readiness continues to come from its persisted batch items.

### Verification and priority-based diff review

Docker applied both notification migrations. `docker compose exec sentinel npm run lint` and `docker compose exec sentinel npm run typecheck` passed. All 11 Vitest files passed in serial groups (33 tests), including the Phase 6 metric, authorization, Mailpit, checkpoint, Release-summary, and retry/final-failure checks. All 11 Playwright checks passed in serial groups, including `tests/phase-6-dashboard-notifications.spec.ts`.

| Priority | Files and areas | Why review them | Owner action |
|---|---|---|---|
| Highest | `prisma/schema.prisma`; both notification migrations; `lib/notifications.ts`; `lib/queue.ts`; `worker.ts`; `app/api/[[...route]]/route.ts`; `docker-compose.yml` | These files define durable event identity, background delivery, SMTP retry, Product authorization, audit writes, and local infrastructure. Focus on the notification unique keys, `createNotifications`, `deliverNotification`, the notification worker, and `assertNotificationAccess`. | Read now. |
| Medium | `lib/dashboard.ts`; `lib/releases.ts`; `components/sentinel-views.tsx`; `components/notification-views.tsx`; Phase 6 tests | They define the metric formulas, one-time Release summary trigger, and what a user can see or mark read. | Read next. |
| Lower | `app/notifications/page.tsx`; navigation and CSS changes; README and planning documents | They expose the already-defined behavior and document local verification. | Skim after the data and delivery boundary. |

### Ten-question understanding check

1. Why is the Dashboard window defined in UTC calendar boundaries, and which Run outcomes are deliberately excluded from the pass-rate denominator?
2. What makes a Test Case version flaky, and why does Sentinel use the current version rather than all historical Runs of the Test Case?
3. Why must Sentinel persist a notification before adding its ID to BullMQ?
4. Which people receive a failed-Run notification, a checkpoint notification, and a completed Release summary, and how does de-duplication work when roles overlap?
5. What is the difference between a Run outcome, evidence status, and notification delivery status, and why must an SMTP failure never change the first two?
6. Which information is intentionally omitted from email, and how does the user safely reach the underlying Run or Release instead?
7. How does the inbox re-check authorization for a notification whose Product membership may have changed since it was created?
8. Why does a transient SMTP problem retry once, while a second or non-transient failure becomes an audited failed delivery?
9. Why is Nodemailer's `ESOCKET` treated as retryable in this local setup, and which file contains that classification?
10. If Sentinel later adds Slack or a real email provider, which persistence, de-duplication, authorization, and safe-content guarantees must remain unchanged?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- Owner answers all ten questions and compares the answers with D-030, the Notification model/migrations, `lib/dashboard.ts`, `lib/notifications.ts`, `worker.ts`, and the Phase 6 tests.
- Owner manually creates passed, failed, interrupted, and checkpointed Runs; compares the Dashboard with underlying Run data; then inspects Mailpit at `http://localhost:8025` for the safe email summaries and protected links.
- Before production, select an email provider, define retention/preferences/monitoring, and decide whether dashboard projections require a scalable read model.

---

## Feature: Phase 7 deterministic edge-case and negative-Test suggestions

- Date: 2026-08-20
- Phase: 7
- Status: Implementation and automated acceptance verified; owner manual and understanding reviews pending.
- Relevant files: `lib/suggestions.ts`, `lib/browser.ts`, `demo-target/index.html`, `prisma/schema.prisma`, `prisma/migrations/20260820130000_add_test_suggestions/migration.sql`, `app/api/[[...route]]/route.ts`, `components/review-views.tsx`, `components/sentinel-views.tsx`, `components/app-shell.tsx`, `app/review/page.tsx`, `tests/suggestions.test.ts`, and `tests/phase-7-suggestions.spec.ts`.
- Related decision: D-031 in `decisions-log.md`.

### What this feature does

Phase 7 helps a tester turn one happy-path Test Case into a small, conservative set of negative-Test drafts. The tester explicitly presses **Generate suggestions** on a saved Test Case; Sentinel does not generate anything silently and does not use an AI model. It creates only cases that it can explain from captured browser field rules: leave a required field blank, enter a malformed email, or use one fewer/more character than a known length boundary.

The drafts appear in the product-authorized **Review** queue. A tester may edit the draft name, rationale, and safe proposed value, dismiss it, reopen a dismissed draft, or approve it. Approval creates a new independent Test Case owned by the approving user. It never changes the original Test Case, starts a Guided/Auto Run, changes a baseline, sends a notification, or files a JIRA issue.

### Intended end-to-end flow

1. During recording, the browser recorder still waits for a settled `change` event, so it retains one meaningful text-entry step rather than one step per keystroke. It now also captures safe structural metadata for text controls: type, required flag, and explicit minimum/maximum lengths.
2. The Demo CRM supplies a local validation fixture: first and last names must contain 2–50 characters. This lets Sentinel demonstrate both a one-character and a 51-character boundary draft.
3. `POST /api/test-cases/:id/suggestions` loads the Test Case’s current immutable version, checks Product membership, passes its steps to `lib/suggestions.ts`, and records the deterministic candidates in PostgreSQL.
4. The `TestSuggestion` unique key contains the source version, source step, and rule kind. PostgreSQL’s `createMany(..., skipDuplicates: true)` makes repeated generation safe: existing drafts stay in history instead of multiplying.
5. `GET /api/suggestions` returns only suggestions from Products the signed-in user currently belongs to. Draft update, dismiss, reopen, and approve actions re-check the same membership boundary and write audit events.
6. Approval reads the saved source version rather than the source Test Case’s latest version. In one transaction it creates a saved synthetic recording record (because every Test Case is linked to a Recording Session), clones labels and encrypted variable configuration, creates a new Test Case and immutable Version 1, changes only the proposed safe input and its expected outcome, then links the suggestion to that new Test Case.
7. The Review page shows state, source Test Case/version/step, rule, safe proposal, rationale, expected outcome, and the approved-Test link. It deliberately contains no Run button.

### Technologies, choices, and tradeoffs

| Technology or approach | Why it is used | Tradeoff |
|---|---|---|
| Deterministic TypeScript rules in `lib/suggestions.ts` | Makes every suggestion reproducible, testable, and easy for a tester to understand without sending Test data to an external provider. | It recognizes only captured rules; it cannot reason about arbitrary application semantics. |
| Captured HTML validation metadata | Lets the generator make boundary suggestions based on the actual recorded field rather than guessing from its label. | Existing Test Cases without this newer metadata are safely skipped until re-recorded. |
| Prisma `TestSuggestion` model and unique compound key | Persists review state and prevents duplicate source-version/step/rule drafts across repeat generation. | Adds relationships and migration work to the database model. |
| PostgreSQL transaction on approval | Keeps the derived Test Case, Version 1, recording fixture, suggestion link, and audits all-or-nothing. | The transaction is more detailed than a simple copy operation, especially because the existing schema requires a Recording Session for every Test Case. |
| React Review queue and modal | Makes the small editable surface obvious while keeping execution controls absent. | The current queue is intentionally focused; future Phase 9 proposals need a separate decision model rather than expanding these drafts indiscriminately. |

### Important implementation and safety details

- `suggestionsForSteps` rejects non-text controls, redacted/password fields, variable-backed fields, secret-like names, and metadata-free fields. It returns human-readable skip reasons without returning the excluded value.
- The rule engine creates at most: missing required, invalid email, too-short boundary, and too-long boundary drafts. Every candidate changes one input only and uses the same expected statement: validation appears and success confirmation/navigation does not occur.
- A missing-required suggestion must keep an empty proposed value. Other draft values are capped at 256 characters and are checked for token, secret, authorization, cookie, password, and API-key patterns before saving or approval.
- Product membership is enforced server-side. A user cannot generate, list by source Test Case, edit, approve, dismiss, reopen, or follow a derived Test Case outside their current Product membership.
- The new Test Case is owned by the approving user, not necessarily the original Test owner. That relationship is retained by the `TestSuggestion` record, its source version/step fields, and audit events.
- Sensitive variable values remain encrypted exactly as in Phase 4. The derived Test Case copies configuration ciphertext and placeholders; a rule cannot target variable-backed steps.
- A failed first implementation attempted to catch a PostgreSQL unique-constraint error inside a transaction while looping over candidates. PostgreSQL marks that transaction aborted after the constraint error, so later operations fail. The final implementation uses `createMany` with `skipDuplicates`, which lets PostgreSQL handle duplicate rows without aborting the transaction.

### Alternatives and limitations

- An LLM-driven suggestion generator was rejected for Phase 7 because it would need a separate safe-data boundary and could create speculative, difficult-to-review tests. Deterministic rules are intentionally narrower.
- Automatic generation during recording/save was rejected. A manual button makes the tester choose when negative-Test work is useful and avoids fatigue.
- Editing selector metadata, step order, kind, passwords, or variables was rejected because those fields define the replayed browser action. A changed action needs a new recording.
- Suggestions do not execute automatically. The accepted Test becomes an ordinary independent Test Case, and a tester explicitly decides whether to run it.
- Only the local Demo CRM is in scope. External targets, more complex validations, multi-field rules, LLM inference, scheduling, notifications, JIRA, and baseline-change proposals remain later work.

### Verification and priority-based diff review

Docker applied `20260820130000_add_test_suggestions`. The following commands passed:

```text
docker compose exec sentinel npm run lint
docker compose exec sentinel npm run typecheck
docker compose exec sentinel npm test
docker compose exec sentinel npx playwright test tests/browser-lock.spec.ts tests/product-creation.spec.ts tests/phase-1-recording.spec.ts tests/frontend-phase-1-5.spec.ts tests/phase-2-runs.spec.ts
docker compose exec sentinel npx playwright test tests/phase-3-auto-runs.spec.ts tests/phase-4-variables.spec.ts tests/phase-5-release.spec.ts tests/phase-6-dashboard-notifications.spec.ts tests/phase-7-suggestions.spec.ts
```

Serial verification covered all 12 Vitest files and 35 tests, plus all 10 Playwright specs and 12 browser tests. `tests/suggestions.test.ts` verifies generation, sensitive skips, idempotency, authorization, safe draft validation, dismissal/reopen, immutable source preservation, labels, approval ownership, Version 1, audit records, and no pre-approval Run. `tests/phase-7-suggestions.spec.ts` verifies the visible Generate, Review, edit, approve, dismiss, and reopen workflow.

| Priority | Files and areas | Why review them | Owner action |
|---|---|---|---|
| Highest | `prisma/schema.prisma`; `prisma/migrations/20260820130000_add_test_suggestions/migration.sql`; `lib/suggestions.ts`; `app/api/[[...route]]/route.ts` | These define the rule boundary, source snapshot identity, Product authorization, idempotency, database constraints, approval transaction, audit events, and derived Test Case ownership. Review the compound unique key, `suggestionsForSteps`, `createMany(...skipDuplicates)`, and approval-cloning transaction. | Read now. |
| Medium | `lib/browser.ts`; `demo-target/index.html`; `components/review-views.tsx`; `components/sentinel-views.tsx`; `tests/suggestions.test.ts`; `tests/phase-7-suggestions.spec.ts` | They provide the validation metadata, local fixture, user controls, and behavior checks. | Read next. |
| Lower | `components/app-shell.tsx`; `app/review/page.tsx`; `app/globals.css`; Phase 7 documentation | They expose and explain the approved behavior but do not enforce database or security guarantees. | Skim. |

### Ten-question understanding check

1. Why does Phase 7 use deterministic rules instead of an LLM, and what source data is each rule allowed to inspect?
2. Which four suggestion rule kinds can Sentinel create, and what makes a text-entry step eligible for each one?
3. Why are password, redacted, variable-backed, unsupported, and metadata-free steps skipped rather than converted into drafts?
4. What three source identifiers form the duplicate-prevention boundary, and why did the implementation use `createMany` with `skipDuplicates` instead of catching a uniqueness error in a transaction?
5. Which draft fields may a reviewer edit, and why are target metadata, order, kind, password behavior, and variable behavior read-only?
6. What exact expected outcome does every Phase 7 negative-Test draft use, and why is it deliberately not a precise assertion of the UI message?
7. When a suggestion is approved, which records are created in the transaction, why is a saved Recording Session fixture needed, and who owns the new Test Case?
8. How does approval preserve the source Test Case’s historical versions and Runs even if the source later receives a new version?
9. Which Product authorization checks protect the Review lifecycle, and why must they happen on the server rather than only in the sidebar/UI?
10. If Phase 9 later adds owner-approved baseline-change proposals, which Phase 7 guarantees—review state, source snapshot, auditability, no automatic execution, and sensitive-data handling—must remain separate or be preserved?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- Owner manually records and saves a fresh Demo CRM journey, generates its suggestions, edits/approves one, dismisses/reopens another, and checks that the source Test Case and its Run history do not change.
- Owner answers all ten questions above and compares the answers with D-031, the `TestSuggestion` schema/migration, `lib/suggestions.ts`, the suggestion API routes, and both Phase 7 tests.
- Before extending suggestions, define whether richer application-specific rule metadata, external-target validation, or an LLM can meet the same privacy, approval, idempotency, and no-auto-run guarantees.

## Phase 8 — Reviewed Jira Cloud Bug Workflow

Phase 8 lets a current Product member turn a completed failed Run into a reviewed Jira Cloud Bug. The member explicitly creates a draft, may edit only its safe summary, reproduction description, and priority, then explicitly files it. Sentinel does not file automatically. It sends no evidence files or raw operational data to Jira; the report links back to the Product-authorized Sentinel Run Detail instead.

The Product creator maps each Product to one Jira project key. Jira Cloud URL, service-account email, and API token are server/worker-only environment values. A filing is unique per Run, so refreshing or clicking twice cannot create two tickets. For a later failure of the same Test Case, Sentinel checks the tracked Jira issue: it comments on an open issue, or creates a new Bug only when Jira reports the old issue Done. The existing worker retries one transient failure and records final failure without changing the Run result.

### Important implementation and safety details

- `JiraProjectConfig`, `JiraIssue`, and `JiraFiling` are persisted in PostgreSQL. The filing's unique `runId` is the local idempotency boundary; a PostgreSQL advisory lock by Test Case serializes the external create-or-comment decision.
- `lib/jira.ts` is the adapter boundary. It validates an HTTPS `*.atlassian.net` endpoint, uses Jira REST API v3 with server-only basic authentication, creates the fixed Bug type, checks status category, and converts only safe text to Jira's document format.
- The generated reproduction list contains ordered action kinds, not captured field values, selectors, variables, screenshots, network/console/storage evidence, credentials, tokens, cookies, or signed evidence URLs.
- `JIRA_FILING_QUEUE` uses BullMQ with two attempts. The worker records queued, filed, or failed state and safe error text. Jira delivery never modifies Run outcome, evidence status, Release readiness, or notification state.
- Product membership is checked on every mapping, draft, edit, filing, status, and Run access operation. Only `Product.createdById` may write the mapping.

### Tradeoffs and limitations

- Jira Cloud is supported first; Jira Server/Data Center and arbitrary Jira custom fields are deferred.
- The Product mapping is one Jira project key, while credentials are deployment-wide. This keeps local setup understandable but will need an organization-level credentials model when roles arrive.
- Protected Sentinel links preserve current authorization. Jira users who are not Sentinel Product members cannot use the linked Run Detail to obtain evidence.
- Phase 8 does not attach screenshots, file automatically, classify bugs with an LLM, send Slack notices, or handle Phase 9 change-approval routing.

## Phase 9 — Change-aware approval

### What this feature does

Phase 9 lets a Product member explain a known QA deployment after a completed failed Run and propose a narrow baseline annotation update. The proposal contains deployment context plus replacement descriptions and/or expected outcomes for saved steps. It cannot edit the recorded browser action. This prevents a failure from silently becoming the new expected behavior while still giving the original Test Case owner a practical review path.

### End-to-end flow and implementation choices

The failed Run is the entry point. The API checks current Product membership and verifies that the Run is completed with a `FAILED` outcome. It stores a `ChangeProposal` bound to the exact immutable Test Case version used by that Run and child `ChangeProposalStep` rows keyed to saved source steps. The creator submits it, which creates a safe notification for the original Test Case owner. Review renders the source and proposed description/expected-outcome text side by side.

Only the original owner can decide. Approval rechecks that the Test Case still points at the proposal's source version, clones that version's ordered steps and encrypted variable configuration into the next version in one Prisma transaction, then applies only the reviewed annotation changes. If another version became current first, Sentinel marks the proposal `STALE` and refuses to merge. Rejection records the decision and, when the Product already has a Jira mapping, creates the existing Phase 8 `JiraFiling` as `DRAFT`; a person must still review and explicitly file it. Existing BullMQ/Mailpit notification delivery reports submission and resolution without affecting proposal truth.

This uses PostgreSQL/Prisma transactions because source-version binding, version creation, and audit events must agree atomically. It reuses the notification and Jira-draft mechanisms rather than inventing an approval worker. The tradeoff is that deployment intent is manual in this phase: there is no Git or deployment signal, no automatic classifier, and no merge/conflict-resolution engine. The critical source files are `prisma/schema.prisma`, `app/api/[[...route]]/route.ts`, `lib/notifications.ts`, `components/sentinel-views.tsx`, `components/review-views.tsx`, and `tests/change-proposals.test.ts`.

### Owner understanding check — pending follow-up

1. Why is a Change Proposal allowed only from a completed failed Run, and what unsafe behavior would a passed-Run proposal enable?
   **Owner answer:** Pending follow-up.
2. Which fields may Phase 9 change, and why are selector metadata, values, variables, checkpoints, and order deliberately excluded?
   **Owner answer:** Pending follow-up.
3. What exact version does a proposal reference, and how does that preserve historical Run meaning?
   **Owner answer:** Pending follow-up.
4. Why does approval create a new immutable Test Case version instead of editing the current one?
   **Owner answer:** Pending follow-up.
5. What check marks a proposal stale, and why is stopping safer than attempting an automatic merge?
   **Owner answer:** Pending follow-up.
6. Which user may approve or reject, and how is that enforced independently of the UI?
   **Owner answer:** Pending follow-up.
7. What happens on rejection when a Product has a Jira mapping, and what intentional human action is still required?
   **Owner answer:** Pending follow-up.
8. What information is safe for a proposal notification/email, and what must remain only in protected Sentinel evidence?
   **Owner answer:** Pending follow-up.
9. Which transaction boundaries and audit events are most important to review before changing this feature?
   **Owner answer:** Pending follow-up.
10. How would GitHub/deployment correlation change the trigger safely without allowing automatic baseline updates?
    **Owner answer:** Pending follow-up.

**Learning status:** Pending. The owner explicitly deferred Phase 9 answers; revisit these ten questions before treating the feature as fully understood.

### Ten-question understanding check

1. Why is Jira filing manual in Phase 8, and which Run states are eligible?
2. Which Jira values are server-only environment configuration, and which non-secret value is stored per Product?
3. Why is a Jira filing unique per Run, and how does the Test Case advisory lock prevent duplicate open Bugs across concurrent failed Runs?
4. What exact content is allowed in Jira's generated reproduction description, and which evidence or secret categories are prohibited?
5. Why does Sentinel use a protected Run Detail link rather than a MinIO signed screenshot URL or attachment?
6. Which user can change a Product's Jira mapping, and which users may review/file a failed Run?
7. How does Sentinel decide whether to create a Bug or add a comment to an existing Jira issue?
8. What makes a Jira delivery retryable, how many attempts occur, and what state is stored after the final failure?
9. Why must Jira delivery never alter Run outcome, evidence status, Release readiness, or notification truth?
10. Which files should a maintainer inspect before changing Jira payload content, authentication, duplicate behavior, or queue retries?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- Configure an untracked Jira Cloud test connection, map a Product, file one failed Run, then fail the same Test Case again and confirm the open Jira Bug receives a comment rather than a duplicate.
- Answer all ten questions using D-032, the Jira schema/migration, `lib/jira.ts`, `worker.ts`, API route, and Jira tests.

## Phase 10 — Read-only database insight

Phase 10 helps a tester investigate a completed failed Run without turning Sentinel into a database administration tool. The tester explicitly chooses **Run customer lookup** from failed Run Detail. Sentinel finds the final eligible non-secret email field in the immutable Run version, decrypting a saved Run binding only when the field is variable-backed. That lookup value exists only while the server performs the query. It is not displayed, returned from the API, stored in a diagnostic/evidence record, included in a Jira draft, or logged.

The local Demo CRM now sends completed customer creation to the isolated `qa-fixture` service. That service writes to `qa-postgres` with its own writer account. Sentinel has a different `qa_diagnostic` PostgreSQL role. Startup SQL gives that role only database connection, schema usage, and table selection rights; it has no insert, update, delete, or schema-create grant. `lib/database-diagnostics.ts` verifies those permissions before using its only catalog entry: a parameterized `qa_customers` lookup limited to one result, inside `BEGIN READ ONLY`, with a 1.5-second statement timeout. It returns only whether a customer was found, the safe status, and creation/update timestamps. A missing key, unavailable database, denied role, or timeout becomes a safe incomplete/unavailable code instead of a false claim.

The API checks current Product membership and requires the Run to be completed and failed. It saves a `DatabaseDiagnostic`, `DATABASE` Evidence item, and audit event in one transaction; a unique Run/kind constraint makes duplicate clicks idempotent. Run Detail renders only the safe result. The Phase 8 Jira-draft builder may add that same safe summary to a human-reviewed draft, but it cannot file an issue and it never receives the raw lookup input or row.

| Technology or pattern | Why it is used | Maintainer concern |
|---|---|---|
| Separate PostgreSQL service and roles | Demonstrates least privilege independently from Sentinel's application database. | Replace Docker-local passwords with managed, rotated deployment secrets before any real QA connection. |
| `pg` parameterized query | Keeps the diagnostic adapter narrow and prevents query-value interpolation. | Add a catalog entry deliberately; never introduce user-supplied SQL. |
| Read-only transaction, timeout, and one-row limit | Limits impact if the fixture/database is slow or unexpectedly large. | Keep these controls for every future diagnostic and test denial/timeout paths. |
| Prisma diagnostic/evidence records | Preserves an authorized, auditable safe result on Run Detail. | Do not add raw values to `safeMetadata`; JSON is not automatically safe. |
| Explicit UI action | Lets a tester decide when diagnosis is relevant and avoids automatic database reads on every failure. | Do not make it automatic without a consent, cost, and audit decision. |

The main tradeoff is deliberately narrow usefulness: Sentinel can only answer one customer existence/state question against a local fixture, not inspect arbitrary tables or diagnose external QA environments. A generic SQL editor or a broad database integration would be simpler for a developer but would undermine authorization, privacy, reliability, and least-privilege guarantees. Future external QA adapters need a separately approved query catalog, environment-specific role verification, credential management/rotation, retention policy, and a review of whether the safe metadata is still appropriate.

Relevant implementation references: `qa-fixture/init.sql`, `qa-fixture/server.ts`, `qa-fixture/Dockerfile`, `demo-target/index.html`, `docker-compose.yml`, `prisma/schema.prisma`, `prisma/migrations/20260820170000_add_database_diagnostics/migration.sql`, `lib/database-diagnostics.ts`, `app/api/[[...route]]/route.ts`, `components/sentinel-views.tsx`, `lib/jira.ts`, and `tests/database-diagnostics.test.ts`. See D-034, `srd.md`, `architecture.md`, `techstack.md`, and `phases.md` for the accepted boundary.

### Ten-question understanding check

1. Why does Phase 10 require a completed failed Run and an explicit user action instead of automatically querying the database for every Run?
   **Owner answer:** Pending follow-up.
2. Which database role writes Demo CRM fixture customers, which role Sentinel uses for diagnosis, and why must these credentials be separate?
   **Owner answer:** Pending follow-up.
3. How does `customerEmailForDiagnostic` choose the lookup value while ensuring the value is not persisted in Run Detail or evidence?
   **Owner answer:** Pending follow-up.
4. Which precise query safeguards prevent SQL injection, unbounded results, slow execution, and accidental writes?
   **Owner answer:** Pending follow-up.
5. What information may the `DatabaseDiagnostic` and `DATABASE` evidence records contain, and which categories must never be stored there?
   **Owner answer:** Pending follow-up.
6. How does the API enforce Product authorization and duplicate-click idempotency independently of the frontend button?
   **Owner answer:** Pending follow-up.
7. What should Sentinel show if no usable customer email exists, if the fixture is down, or if the query times out—and why is that safer than guessing?
   **Owner answer:** Pending follow-up.
8. Under what condition may a Jira draft include database context, and why must it remain a safe summary and a manual human-reviewed filing?
   **Owner answer:** Pending follow-up.
9. Which test proves the diagnostic role cannot write, and which test proves the result does not serialize the lookup email?
   **Owner answer:** Pending follow-up.
10. Before connecting a real QA database, which parts of this design need a new security and operational approval?
    **Owner answer:** Pending follow-up.

**Learning status:** Pending. The owner explicitly deferred Phase 10 answers; revisit these ten questions before treating the feature as fully understood.

## Phase 11 — Controlled internal-pilot hardening

Phase 11 turns the existing Docker prototype into a bounded internal-pilot environment rather than a production deployment. It keeps the seeded named users but binds Sentinel, Demo CRM, and the noVNC browser only to localhost. The Dashboard Pilot readiness panel lets an authenticated user see whether the local database, Redis queues, worker heartbeat, evidence bucket, guided browser, Mailpit, QA read-only role, and evidence cleanup are ready. Jira remains optional; an unconfigured Jira connection is expected for this pilot.

Ownership no longer becomes a dead end when a person is unavailable. The Product creator can transfer a Product, Test Case, or Release to an existing eligible member through a confirmation dialog. A Test Case recipient must already belong to its Product. A Release recipient must belong to every Product it contains, and a cross-product Release can be transferred only by a user who created every represented Product. A Test Case transfer also changes the designated owner of submitted Change Proposals, so the new owner can decide them. Historical Runs, recordings, and existing notification recipients do not change.

The worker runs evidence retention at startup and every 24 hours. It selects only evidence from completed Runs older than `EVIDENCE_RETENTION_DAYS` (30 by default), removes a MinIO screenshot object first, then removes the matching detailed Evidence row. If object deletion fails, it retains the metadata so the next maintenance pass can retry. Completed database diagnostics are deleted at the same boundary. A `MaintenanceRun` record retains safe counts and failure code, while safe Run summaries, Test Cases, versions, notifications, Jira drafts, and audit events remain available.

| Technology or pattern | Why it is used | Tradeoff |
|---|---|---|
| Product creator as temporary transfer authority | Preserves a simple pilot authorization model without adding roles. | It is not a replacement for organization admins, manager roles, or deprovisioning. |
| Redis heartbeat | Detects a recently active worker without a new external monitoring system. | It proves process activity, not full job capacity or production observability. |
| MinIO-first retention deletion | Avoids leaving binary evidence behind after its database metadata is removed. | A failed deletion deliberately leaves metadata for retry, which can temporarily exceed the retention target. |
| `MaintenanceRun` persistence | Makes cleanup results visible and testable without pretending a background task is a user action. | It is operational history, not a comprehensive audit/monitoring platform. |
| BullMQ custom Jira backoff | Honors one provider-requested 429 delay safely. | The retry remains limited to one attempt and the local pilot does not validate a live Jira tenant. |

The relevant files are `prisma/schema.prisma`, `prisma/migrations/20260820180000_add_maintenance_runs/migration.sql`, `lib/maintenance.ts`, `lib/pilot-readiness.ts`, `lib/evidence.ts`, `lib/jira.ts`, `lib/queue.ts`, `worker.ts`, `docker-compose.yml`, `app/api/[[...route]]/route.ts`, `components/ownership-transfer.tsx`, `components/sentinel-views.tsx`, `components/release-views.tsx`, and `tests/pilot-hardening.test.ts`. See D-035 and `adversarial-review.md` for the pilot boundary and deferred deployment risks.

### Ten-question understanding check

1. Why is Phase 11 explicitly local-only even though a named user can sign in?
   **Owner answer:** Pending follow-up.
2. Which person can transfer a Product, Test Case, or Release, and what membership checks apply to each transfer?
   **Owner answer:** Pending follow-up.
3. Why does Test Case transfer reroute submitted Change Proposals, while historic Runs and recordings stay unchanged?
   **Owner answer:** Pending follow-up.
4. Which evidence categories expire after 30 days, and which durable records intentionally remain?
   **Owner answer:** Pending follow-up.
5. Why does retention remove a MinIO object before deleting its Evidence metadata, and what happens on object-delete failure?
   **Owner answer:** Pending follow-up.
6. What does the Redis worker heartbeat prove, and what does it not prove about production readiness?
   **Owner answer:** Pending follow-up.
7. Which Pilot readiness checks are required, and why is unconfigured Jira not an attention state for this pilot?
   **Owner answer:** Pending follow-up.
8. How does the Jira retry logic safely interpret a 429 `Retry-After` value, and what is the maximum delay and retry count?
   **Owner answer:** Pending follow-up.
9. Which failures must never change a factual Run outcome, evidence status, Release readiness, or notification truth?
   **Owner answer:** Pending follow-up.
10. Which findings in `adversarial-review.md` block deployment beyond the localhost pilot?
    **Owner answer:** Pending follow-up.

**Learning status:** Pending. The owner explicitly deferred Phase 11 answers; revisit these ten questions and the earlier outstanding phase questions before calling Sentinel fully understood.

## Phase 12 — Organization roles and administration

Phase 12 replaces the earlier seeded-password browser identity with local organization accounts. A successful login checks an scrypt password hash, creates a random opaque session token, stores only its SHA-256 hash in PostgreSQL, and sets an eight-hour HTTP-only cookie. Each request resolves that stored session, active account state, organization membership, and role again; this lets an Admin disable a person or remove access and make their existing sessions stop working immediately.

The controlled Docker bootstrap creates one `Sentinel Demo` organization, migrates the existing pilot Products and their history into it, gives the configured bootstrap account the Admin role, and gives remaining pilot users Tester access. Admins can use **Administration** to invite a new person, assign their role and Product access, alter those permissions, or disable/reactivate them. New invitations and password resets use a 24-hour, one-time hashed token and are sent only to local Mailpit. Admins see every Product in their organization; Managers and Testers must have an explicit Product membership. Managers manage QA work in their assigned Products; Testers contribute their own Tests/Test Data and can run shared Tests, but cannot manage organization access, Releases, Jira, approvals, or ownership.

The important implementation files are `prisma/schema.prisma`, `prisma/seed.ts`, `lib/auth.ts`, `lib/account-email.ts`, `app/api/[[...route]]/route.ts`, `components/admin-views.tsx`, `components/account-views.tsx`, and `docker-compose.yml`. The main tradeoff is intentional: this is secure enough for a local controlled pilot, but it is not a production identity service. SSO, real email, rate-limit persistence, custom roles, and a complete browser permission-matrix suite remain future hardening work.

### Ten-question understanding check

1. Why does Sentinel store a hash of the opaque session token rather than the token itself, and how does that help when the database is inspected?
   **Owner answer:** Pending follow-up.
2. What information is checked again on every authenticated request, and why does that make disable or access removal take effect immediately?
   **Owner answer:** Pending follow-up.
3. What is the difference between organization membership and Product membership, and which role can bypass the Product-membership requirement?
   **Owner answer:** Pending follow-up.
4. Which actions can a Manager perform that a Tester cannot, and why are both still restricted to assigned Products?
   **Owner answer:** Pending follow-up.
5. Why are invitation and password-reset tokens hashed, single-use, and limited to 24 hours?
   **Owner answer:** Pending follow-up.
6. What happens to historic Test Cases, Runs, evidence, and audit records when their owner is disabled?
   **Owner answer:** Pending follow-up.
7. What guard prevents an organization from losing its final active Admin, and why is that guard important?
   **Owner answer:** Pending follow-up.
8. Which files perform password hashing, session lookup, and local Mailpit delivery respectively?
   **Owner answer:** Pending follow-up.
9. How does the controlled bootstrap preserve the existing pilot history while placing it under one organization?
   **Owner answer:** Pending follow-up.
10. What additional safeguards would be required before replacing this local account system with a production identity service?
    **Owner answer:** Pending follow-up.

**Learning status:** Pending owner review. The Phase 12 account and role flow is ready for manual testing, but the ten answers and the broader browser permission-matrix hardening remain follow-up work.


## Phase 15 — Product-wide UI/UX redesign

### What changed and why

Phase 15 turns the delivered Phase 12 interface into one coherent operations workspace without changing its APIs, authorization rules, queues, evidence model, or immutable-version behavior. The redesign introduces a restrained dark visual system, a responsive/collapsible application shell, internal SVG icons, a skip link, consistent hierarchy and density, reusable dialogs with focus trapping and Escape handling, pagination and skeleton states, searchable inventories, and reduced-motion-safe transitions. The practical user problems it addresses are unbounded lists, competing actions, raw-JSON-first evidence, mixed review queues, immediate-save administration controls, and long Test Case editing forms.

The end-to-end flow remains the same: a signed-in organization member chooses an authorized Product, records or opens a Test Case, starts the existing Guided/Auto Run API, reviews the existing persisted outcome/evidence, and uses the existing Release, Review, notification, or administration operations. The client now organizes those results more clearly. Test Case and Run filtering/pagination are client-side over the existing authorized API response, so the server remains the source of truth. Run Detail presents structured network evidence and moves raw payloads into disclosures. Administration stages role/Product changes in a modal and sends the same PATCH only after explicit Save. Review separates suggestions from change proposals and uses explicit confirmation dialogs. Saving Test Case edits still creates the next immutable version.

The implementation deliberately uses the existing React 19, Next.js App Router, TypeScript, and CSS token infrastructure. No component framework, icon package, animation package, or state library was added. This keeps the dependency and security surface stable, but means the project owns its dialog behavior, responsive CSS, and visual regression upkeep. The shared `Dialog` handles initial focus, Tab containment, Escape, body scroll locking, and focus restoration. Motion uses three duration tokens and becomes zero under `prefers-reduced-motion`.

### Tradeoffs, alternatives, limitations, and risks

- A third-party design system was rejected because the existing primitives were sufficient and adopting one would create a large migration surface unrelated to business behavior.
- Server pagination was not introduced because that would change API contracts. Current paging is intentionally client-side and should move server-side only when data scale justifies an approved API change.
- Browser-heavy Recording and Guided Run workspaces remain desktop-only below the supported viewport; they show explicit guidance instead of pretending the two-pane workflow is usable on a phone.
- GitHub settings/activity and conversational-integration screens were not invented because optional Phases 13–14 are not implemented. They must adopt these tokens/primitives if approved later.
- Owner usability testing and the ten-question learning review remain open. Phase 15 must not be considered fully learned until those are completed.
- Production build succeeds with one pre-existing Autoprefixer compatibility warning for legacy `align-items: end` CSS and an existing ESLint Next-plugin configuration warning. Neither changes runtime behavior, but both should be cleaned up with a separately reviewed stylesheet/configuration formatting change.
- The full integration suite is state-sensitive. A pre-existing Guided Run created on 2026-08-22 remains `RUNNING`, so the correct single-browser guard rejects another Guided Run with HTTP 409. The redesign did not alter or clear that user-owned state.

### Verification evidence and priority-based diff review

The final implementation checks produced these outcomes:

```text
npm run lint -- --quiet
> eslint . --quiet
exit 0

npm run typecheck
> tsc --noEmit
exit 0

npm run build
✓ Compiled successfully
✓ Generating static pages (18/18)
exit 0

docker compose exec -T sentinel env SENTINEL_BASE_URL=http://localhost:3000 npx playwright test tests/frontend-phase-1-5.spec.ts tests/phase-1-recording.spec.ts tests/phase-11-pilot-hardening.spec.ts --reporter=line --workers=1
3 passed

docker compose exec -T sentinel env SENTINEL_BASE_URL=http://localhost:3000 npx playwright test tests/phase-5-release.spec.ts tests/phase-7-suggestions.spec.ts --reporter=line --workers=1
2 passed

docker compose exec -T sentinel env SENTINEL_BASE_URL=http://localhost:3000 npx playwright test tests/phase-3-auto-runs.spec.ts tests/phase-4-variables.spec.ts --reporter=line --workers=1
3 passed
```

The serial Vitest run passed 43 of 45 tests. Both remaining assertions are the Guided Run API attempting to start while the pre-existing user-owned Guided Run is active; focused Playwright confirms the UI displays “Another local browser session is active. Finish it before starting a Run.” No database record was changed to bypass that protection.

| Priority | Files and symbols | Why and owner action |
|---|---|---|
| Highest — understand now | `components/ui.tsx` (`Dialog`, `Pagination`, `Skeleton`, `Icon`); `components/app-shell.tsx`; `components/sentinel-views.tsx` (inventory, Test Case actions, Run evidence, recording dialog); `components/admin-views.tsx`; `components/review-views.tsx`; `components/test-case-editor.tsx` | These files control focus, protected-action presentation, navigation, evidence interpretation, access-edit timing, review decisions, and immutable version editing. Read now, especially the Dialog focus lifecycle and editor toggle state. |
| Medium — understand next | `components/release-views.tsx`; `components/notification-views.tsx`; `components/ownership-transfer.tsx`; `app/globals.css`; `app/styles/tokens.css`; invite/reset/review/test-case route Suspense boundaries | These define high-impact layout/state presentation and responsive behavior but reuse existing server contracts. Review responsive breakpoints, client paging, raw-evidence disclosures, and release selection. |
| Lower — skim or defer | Updated Playwright specs and design/project documents | Tests were aligned with organization-scoped fixtures, pagination, action menus, confirmations, and readiness disclosure. Documents record the approved boundary and implementation evidence. Skim now; use them during later regressions. |

### Ten-question understanding check

1. Which business, authorization, persistence, and queue behaviors did Phase 15 intentionally leave unchanged, and how can a maintainer verify that boundary?
2. How does the shared `Dialog` manage initial focus, Tab/Shift+Tab containment, Escape, body scroll, and focus restoration?
3. Why are Test Case, Run, and notification pages paginated on the client today, and what dependency would require an approved server-pagination change?
4. How do the desktop sidebar, tablet/mobile navigation drawer, and browser-heavy Recording/Guided Run viewport policy differ?
5. Why is raw Run evidence behind a disclosure while structured network/status information is shown first, and what privacy guarantees must remain intact?
6. How does the redesigned Test Case editor preserve immutable versioning while making long step lists easier to use?
7. What changed in Administration’s save interaction, and why does the server remain responsible for role, Product access, final-Admin, and session-revocation enforcement?
8. Why are suggestions and change proposals separate tabs, and which confirmation steps prevent accidental approval, dismissal, or baseline decisions?
9. Which motion tokens and CSS accessibility rule implement reduced-motion support, and which interactions must still work when every duration is zero?
10. Why did the Guided Run regression remain blocked, what existing record causes it, and why would deleting or completing that record solely to make tests green be unsafe?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- The owner answers all ten questions and reviews the highest-priority files before Phase 15 is considered fully understood.
- Conduct representative owner usability checks on Dashboard, Test Case search/edit, Run evidence, Release creation, Review confirmation, Administration access editing, tablet navigation, and the explicit narrow-screen recording boundary.
- Resolve the existing active Guided Run through the normal product workflow, then rerun the two blocked Guided Run integration assertions and the complete serial suite.

## Phase 13 — Optional multi-repository GitHub automation and source-aware failure analysis

Phase 13 lets an organization optionally connect more than one GitHub repository to a Product—for example, separate frontend and backend repositories. It solves two related problems: a team can automatically start the right existing Auto Runs after an approved branch push, and a failed GitHub-triggered Run can receive a bounded source-aware explanation instead of leaving a tester to search an entire codebase manually. The feature remains optional: a Product with no GitHub connection retains the exact existing Sentinel workflow.

### End-to-end flow and system boundary

1. An Admin or assigned Manager opens a Product’s **GitHub** settings, provides a repository identifier, installation reference, branch rules, optional role label, and analysis-enabled choice. The API re-checks organization role and Product access, uses the server-only GitHub App to verify read access, and persists only safe connection metadata. No App private key, installation token, clone URL, or source content reaches the browser or database response.
2. An authorized Product member links a saved Test Case to one or more active Product repository connections. This explicit routing prevents an unrelated repository push from starting every Test Case in the Product.
3. GitHub sends a `push` event to Sentinel’s raw webhook route. Sentinel verifies the HMAC signature before parsing it, records a deduplicated safe delivery, and queues a delivery processor. The processor matches only an active connection with the exact installation, repository, and allowed branch. It creates a GitHub-linked Auto Run only when the linked Test Case still satisfies existing Auto Run rules; checkpoints, unsafe variables, Test Data requirements, authorization, target allowlists, and worker limits are not bypassed. Exclusions remain visible with a safe reason.
4. A GitHub-triggered Auto Run stores its repository, branch, full commit SHA, parent SHA, and delivery relationship. It keeps normal Auto Run retries, evidence redaction, notifications, and factual Run outcome. If the Auto Run fails, the worker creates one source-analysis request. A manually started failed Run instead needs an authorized person to select a connected repository and a full immutable SHA explicitly.
5. The source-analysis worker obtains a short-lived installation token only for the requested job, checks out that exact commit into a unique temporary directory, and removes the directory in `finally`. It derives bounded changed-file metadata, excludes unsafe paths and binary/dependency/build content, screens file content for secret-like material, and invokes Repomix only against the local checkout with an explicit empty configuration. Remote repository Repomix configuration is never trusted.
6. When the safe context passes all limits, the worker sends the bounded package plus redacted Run/evidence context to the OpenAI Responses API with `store: false` and a strict JSON-schema response format. It deletes checkout files, packed content, prompt, provider response, and installation token after processing. PostgreSQL keeps only a safe structured diagnosis: state, model/provider metadata, observations, hypotheses, confidence, remediation, optional review-only patch fragment, file/line references, limitations, and a 30-day expiry. The Run Detail displays that safe result as advisory information only; it cannot alter source code, GitHub, Test Cases, Jira, evidence truth, Release readiness, or a Run outcome.

### Technologies, patterns, and why they were chosen

| Technology or pattern | Responsibility | Why it helps / tradeoff |
| --- | --- | --- |
| GitHub App with `@octokit/auth-app` and `@octokit/rest` | Creates short-lived installation tokens and verifies a repository connection. | It scopes read access to an installation and avoids a long-lived personal token. It needs one-time App setup and a public webhook route for live testing. |
| Signed raw webhook and timing-safe HMAC check | Authenticates `push` deliveries before parsing their payload. | It prevents arbitrary callers from queuing Runs. It requires retaining the raw request only briefly and correctly configuring the shared webhook secret. |
| Prisma delivery, routing, Run-link, and analysis records | Provides durable idempotency, commit pinning, audit relationships, and 30-day safe-result retention. | It makes a retry/reload inspectable, but requires migration and cleanup maintenance. |
| BullMQ delivery and source-analysis queues | Separates webhook receipt and bounded source work from the web request. | The UI stays responsive and jobs can retry once; it adds Redis/worker operational dependencies. |
| Git local checkout plus Repomix local mode | Builds line-numbered, compact source context only from a selected commit. | It is more useful than passing a Run alone, but requires strict path/content/size/time restrictions and never trusts remote configuration. |
| OpenAI Responses API structured output with `store: false` | Produces a schema-constrained, advisory diagnosis. | The result is easier to render safely than unstructured prose, but it depends on optional provider configuration and may correctly return unavailable/blocked instead of guessing. |

### Important implementation details

- `lib/github.ts` validates repository names, full 40-character commit SHAs, exact or global-wildcard branch rules, GitHub App configuration, installation access, and webhook signatures. A pattern such as `release/*` is intentionally rejected; use a literal branch or `*`.
- `lib/github-runs.ts` owns delivery routing, durable exclusion recording, Run creation, commit linkage, and explicit manual-analysis requests. It finds a currently authorized Admin or Manager only to initiate the existing server-side Auto Run path; the worker re-checks access before doing sensitive work.
- `lib/source-analysis.ts` enforces bounded checkout, path, byte, token, and command-time policies. It blocks on secret-like content rather than trying to redact arbitrary source and potentially missing a secret. Its `finally` cleanup is a security requirement, not merely housekeeping.
- `worker.ts` runs delivery processing and source analysis in dedicated queues alongside, not instead of, the existing two-concurrency Auto Run worker. `lib/maintenance.ts` removes expired safe analysis metadata after 30 days.
- `app/api/[[...route]]/route.ts` keeps the webhook route raw until signature verification, exposes only protected Product/Test Case/Run interfaces, and serializes no raw source. `components/sentinel-views.tsx` presents connection settings, Test Case routing, activity, and the advisory Run Detail panel.

### Tradeoffs, alternatives, limitations, and risks

- A GitHub App was selected over a personal access token because it can be installed per repository with short-lived access tokens and least-privilege permissions. OAuth was rejected because it would create a more complex interactive identity/token lifecycle without helping the server-to-server webhook workflow.
- Automatic diagnosis is limited to GitHub-triggered failed Auto Runs. Manual failures require a human-selected repository and full SHA, because automatically choosing “latest source” would make the diagnosis non-reproducible and potentially misleading.
- A review-only patch fragment may appear in the diagnosis, but no auto-apply, commit, pull request, Test change, Jira filing, or workflow control is permitted. A diagnosis is a hypothesis overlay, not a source-of-truth deployment tool.
- Real GitHub App and OpenAI sandbox credentials are intentionally not part of the repository. Until they are configured, the feature fails closed with a clear unavailable state. The complete external sandbox test remains required even though the local interface, routing, safety, and worker tests pass.
- Secret detection is deliberately conservative. It can block a legitimate analysis rather than risk sending a possible credential to a provider. It also cannot prove that all proprietary source is safe to share; an organization must approve its provider/data policy before enabling analysis for real repositories.

Relevant implementation and verification files: `prisma/schema.prisma`, `prisma/migrations/20260824090000_add_github_source_analysis/migration.sql`, `lib/github.ts`, `lib/github-runs.ts`, `lib/source-analysis.ts`, `lib/queue.ts`, `lib/maintenance.ts`, `worker.ts`, `app/api/[[...route]]/route.ts`, `components/sentinel-views.tsx`, `Dockerfile`, `docker-compose.yml`, `.env.example`, `tests/github-source-analysis.test.ts`, and `tests/phase-13-github.spec.ts`. See `srd.md` F13, `architecture.md` section 11, `techstack.md` sections 3–5, `phases.md` Phase 13, and D-037 in `decisions-log.md`.

### Ten-question understanding check

1. Why is a GitHub App safer for this feature than a personal access token, and which permissions must the App never receive?
   **Owner answer:** Pending follow-up.
2. What makes a GitHub webhook delivery authentic and idempotent before it can create any Run?
   **Owner answer:** Pending follow-up.
3. How do Product repository connections and explicit Test Case routing prevent a frontend push from accidentally running backend-only Tests?
   **Owner answer:** Pending follow-up.
4. Which existing Auto Run restrictions still apply to a GitHub-triggered Run, and why is retaining visible exclusion reasons important?
   **Owner answer:** Pending follow-up.
5. Why must a manual failed Run require an explicit connected repository and full immutable commit SHA rather than using the newest repository revision?
   **Owner answer:** Pending follow-up.
6. Which raw data is deliberately ephemeral during source analysis, which safe fields are retained, and when do those fields expire?
   **Owner answer:** Pending follow-up.
7. How do the checkout, path filtering, secret screening, Repomix configuration, and token/byte/time caps work together to reduce source-data risk?
   **Owner answer:** Pending follow-up.
8. Why does the OpenAI request use `store: false` and a strict JSON schema, and what should Sentinel do when the provider is unavailable or source screening blocks the request?
   **Owner answer:** Pending follow-up.
9. What distinguishes an evidence-backed observation from a source-analysis hypothesis, and why must the patch fragment stay review-only?
   **Owner answer:** Pending follow-up.
10. Which disposable GitHub sandbox checks are still needed before treating the external integration as accepted, and why is the user-owned active Guided Run not safe to clear just to make a regression test pass?
    **Owner answer:** Pending follow-up.

**Learning status:** Pending owner review. The implementation and focused local verification are ready, but the owner must answer these ten questions and complete a disposable two-repository GitHub App/OpenAI sandbox check before Phase 13 is treated as fully understood or externally accepted.

## Phase 16 — Clean-sheet dual-theme frontend rebuild

### What changed and what problem it solves

Phase 16 replaces the previous sidebar-led dark interface with the new Signal Canvas design system while preserving Sentinel's delivered workflows. The user now enters through a split editorial sign-in screen, works within a compact command masthead and grouped section navigator, and can switch between equally supported light and dark themes. Warm paper-like surfaces, restrained cobalt actions, hairline ledgers, trace-inspired identity marks, consistent typography, and denser information hierarchy make the product feel like one purpose-built QA workspace rather than a collection of independently styled screens.

The functional flow did not change. Authentication still creates the same server session. Navigation still opens the same protected routes. New recording still invokes the existing recording dialog and API. Dashboard, Product, Test Case, Test Data, Run, Release, Review, notification, administration, repository, webhook, and source-analysis interactions still use their existing React state, server endpoints, authorization rules, persistence, queues, and safety boundaries. Phase 16 changes presentation composition, semantic tokens, responsive navigation, theme state, and presentation-facing browser selectors only.

### End-to-end theme and shell flow

1. Before React paints the page, `app/layout.tsx` reads the locally saved `sentinel-theme` value. If there is no explicit choice, it uses the operating-system colour preference; if browser storage is unavailable, it safely uses light mode. Applying `data-theme` before paint avoids a bright or dark flash during hydration.
2. `app/styles/tokens.css` supplies complete light and dark values through the same semantic roles, including canvas, surface, text, borders, focus, actions, and status colours. Components consume roles rather than choosing theme-specific colours themselves.
3. `components/theme-control.tsx` updates the root theme, persists the explicit choice, and exposes the next action and current state to assistive technology. It is available on authentication/account screens, in the desktop masthead, and in the mobile navigation sheet.
4. `components/app-shell.tsx` derives the current section from the URL, groups routes as Overview, Build, Operate, Decide, and Manage, and retains the existing notification, New recording, and sign-out actions. On narrower screens the same links move into an Escape-dismissible sheet; recording and live Guided Run keep their explicit desktop-only policy.
5. Route components retain their existing data and event logic. The rebuilt `app/globals.css` recomposes their shared class vocabulary into flat ledgers, metric strips, responsive grids, viewport-safe dialogs, evidence treatments, and dedicated recording/Run workspaces in both themes.

### Technologies, choices, alternatives, and tradeoffs

- The implementation keeps React 19, Next.js App Router, TypeScript, existing internal SVG icons, and plain CSS variables. A UI framework, theme package, font dependency, and animation library were considered unnecessary because they would add migration and supply-chain cost without improving the preserved workflows.
- Theme selection is local to the browser rather than tied to a user database record. This makes the preference immediate and avoids changing account/API schemas, but it does not synchronize between browsers or devices.
- A small inline bootstrap script is intentionally used before hydration. It prevents theme flash and keeps the server render generic, but it means a future strict Content Security Policy must provide an approved nonce or move the bootstrap to an allowed early-loading strategy.
- The shell uses semantic route groups rather than retaining the old collapsible sidebar. This improves orientation and returns horizontal space to content on wide screens; smaller screens use a navigation sheet because all groups cannot remain legible in one row.
- The stylesheet was rebuilt as one coherent compatibility layer over existing route class names. This avoids rewriting business-heavy components solely for styling, but the large global file should be split by primitive and workspace only in a separately reviewed refactor that preserves cascade order.
- Motion remains CSS-only and purposeful. Focus, hover, sheet, dialog, disclosure, and status transitions use shared timing tokens, while `prefers-reduced-motion` removes non-essential duration.

### Limitations, risks, and future improvements

- Automated browser acceptance covers route navigation, mobile navigation, persisted themes, reduced motion, recording viewport policy, and the major functional workflows. Owner review at 200% zoom and representative tablet/mobile devices is still required before the visual acceptance gate is closed.
- The existing active user-owned Guided Run continues to block attempts to create another live browser session. This is expected safety behavior, not a redesign regression; it must be resolved through the normal product workflow before the two affected integration assertions can pass.
- Theme persistence currently follows an explicit preference forever. A future approved control could add a third “System” choice, but doing so was not required and would change the simple two-state control.
- The clean-sheet CSS continues to style existing semantic class names so route functionality remains isolated from visual work. Future components should follow `DESIGN.md` rather than copying route-specific selectors.
- No business logic, API route, database schema, queue, evidence retention, GitHub/Jira behavior, or authorization policy changed in this phase.

Relevant files: `DESIGN.md`, `frontend.md`, `app/styles/tokens.css`, `app/layout.tsx`, `app/globals.css`, `components/theme-control.tsx`, `components/app-shell.tsx`, `components/ui.tsx`, `components/sentinel-views.tsx`, `components/account-views.tsx`, and the updated Playwright specifications. See `phases.md` Phase 16 and `decisions-log.md` D-039.

### Verification evidence and priority-based diff review

```text
npm run lint
> eslint .
exit 0

npm run typecheck
> tsc --noEmit
exit 0

npm run build
✓ Compiled successfully
✓ Generating static pages (18/18)
exit 0

docker compose exec -T sentinel npx playwright test --reporter=line --grep-invert "starts, refreshes, and completes a strict guided Run"
13 passed (59.7s)

docker compose exec -T sentinel npm test
Test Files  1 failed | 16 passed (17)
Tests  2 failed | 48 passed (50)
Both failures expected HTTP 201 but received HTTP 409 because the existing user-owned Guided Run still holds the single live-browser boundary.
```

| Priority | Files and symbols | Why and owner action |
|---|---|---|
| Highest — understand now | `components/app-shell.tsx` (`navigationGroups`, `isActive`, responsive sheet, recording/sign-out actions); `app/layout.tsx` (`themeBootstrap`); `components/theme-control.tsx` (`currentTheme`, `toggleTheme`); `app/globals.css` | These define global route access presentation, pre-paint theme behavior, persistent client preference, focus/navigation behavior, and the responsive appearance of every workflow. Read now, especially the boundary between presentation actions and unchanged APIs. |
| Medium — understand next | `app/styles/tokens.css`; `components/ui.tsx` (`SentinelMark`, shared page/empty structure); `components/sentinel-views.tsx` and `components/account-views.tsx` theme/identity integration; Playwright specifications | These encode the semantic palette, shared identity, authentication composition, and acceptance contract. Review how both themes share roles and how selectors now follow semantic navigation. |
| Lower — skim or defer | `DESIGN.md`, `frontend.md`, `architecture.md`, `techstack.md`, `phases.md`, and `decisions-log.md` | These contain no runtime behavior. They are the design rationale and project control record and should be used to prevent future visual drift. |

### Ten-question understanding check

1. Which application behaviors were deliberately preserved during Phase 16, and which changed files provide evidence that the work stayed presentation-focused?
2. How does the pre-paint theme bootstrap choose among a saved preference, the operating-system preference, and the safe fallback, and what visual problem does it prevent?
3. Why do components consume semantic colour roles from `tokens.css` instead of selecting separate hard-coded light and dark colours?
4. How does `ThemeControl` persist a choice and communicate both its current state and next action to a screen-reader user?
5. How does `AppShell` determine the active route, and what changes when the grouped desktop section navigator becomes the mobile navigation sheet?
6. Which recording and Guided Run responsive restriction remains intentionally unchanged, and why would forcing those workspaces into a narrow mobile layout be misleading?
7. Why was a new component/theme/animation library not introduced, and what maintenance tradeoff follows from owning the CSS and accessible interactions locally?
8. What does the reduced-motion rule remove, and which navigation, dialog, disclosure, and theme interactions must remain fully operable with zero-duration transitions?
9. Why do the two Guided Run unit assertions receive HTTP 409, and why must a maintainer not delete or mutate the existing Run merely to produce a green test report?
10. If a future strict Content Security Policy blocks inline scripts, how could the no-flash theme bootstrap be adapted without regressing first paint or changing application functionality?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- The owner answers all ten questions and reviews the highest-priority files before Phase 16 is considered fully understood.
- Complete owner visual/usability checks in both themes at desktop, tablet, mobile, 200% zoom, keyboard-only, and reduced-motion settings.
- Resolve the existing active Guided Run through the normal application workflow, then rerun all 50 Vitest assertions and the complete 14-test browser suite.

**Learning status:** Implementation and automated redesign verification are recorded. Owner answers, final viewport/usability acceptance, and the state-blocked Guided Run regression remain open.

## Phase 16 runtime repair — Isolated Next.js build output

### What changed and why

The running Sentinel development server returned HTTP 500 because it could no longer find a generated server chunk, `./331.js`. The source code was valid. The failure came from two different Next.js compilers writing into the same bind-mounted `/app/.next` directory: the container was running `next dev`, while a host `next build` replaced its chunks and manifests. The still-running development process then held references to files produced by its earlier compilation.

`docker-compose.yml` now overlays `/app/.next` with separate named volumes for the Sentinel server and worker. The repository source remains bind-mounted for live updates, but host production output and container-generated output no longer share a directory. Recreating only the Sentinel web container initialized its isolated volume without deleting or changing PostgreSQL, Redis, MinIO, evidence, or the existing user-owned Guided Run.

This uses Docker's normal nested-volume precedence: the repository mount supplies `/app`, and the more specific `/app/.next` mount supplies disposable generated output. A simpler one-time cache deletion would have restored the current server but allowed the next host build to corrupt it again. Removing the repository bind mount would also prevent the intended local live-development workflow. Separate generated-output volumes solve the root cause while preserving both development and host verification.

### Verification and limitations

```text
docker compose config --quiet
exit 0

docker compose up -d --force-recreate --no-deps sentinel
Volume "testingagentproject_sentinel-next-api" Created
Container testingagentproject-sentinel-1 Started

npm run lint && npm run typecheck && npm run build
✓ Compiled successfully
✓ Generating static pages (18/18)
exit 0

post_build_http=200
recent_chunk_or_manifest_errors=0

docker compose exec -T sentinel npx playwright test tests/frontend-phase-1-5.spec.ts --reporter=line
1 passed (12.7s)
```

The first focused browser attempt began while the fresh development server was cold-compiling its API route. Login completed successfully in 5.031 seconds, just beyond the test's five-second URL assertion, so that attempt timed out without a runtime error. The unchanged test passed after the one-time compilation. The worker will adopt its own isolated `.next` volume the next time it is normally recreated; it was not restarted during this repair to avoid disturbing queued work.

Relevant files: `docker-compose.yml`, `decisions-log.md` D-040, and this learning entry.

### Ten-question understanding check

1. Why could a valid Next.js source tree still produce a missing `./331.js` runtime error?
2. Which two compiler processes were writing incompatible artifacts into the same `.next` directory?
3. Why would deleting `.next` and restarting the server fix only the immediate symptom rather than the root cause?
4. How does the more-specific `/app/.next` volume interact with the broader repository bind mount at `/app`?
5. Why are separate generated-output volumes used for the Sentinel server and worker instead of sharing one new volume?
6. Which persistent application data was deliberately left untouched while the Sentinel container was recreated?
7. What recurrence test proves that a host production build can no longer corrupt the running container development server?
8. Why did the first focused browser rerun time out even though the login endpoint returned HTTP 200?
9. Why was the worker not forcibly restarted as part of the immediate web-runtime repair?
10. If another generated directory becomes process-specific in the future, what evidence should be collected before isolating it with a nested volume?

#### Answers

- Owner answers pending.

**Learning status:** The runtime repair and recurrence verification are complete. Owner answers remain required before this repair is considered fully understood.

## Phase 17 — Global authorized command search

### What changed and what problem it solves

Phase 17 adds one search field to Sentinel's authenticated command masthead. A user can type the beginning of a remembered name and see authorized Products, Test Cases, Test Data Sets, Runs, Releases, Review items, notifications, and—only for an Admin—organization members together. The current route's category appears first, so searching from Products favors Product results while searching from Runs favors Runs. This avoids eight separate search implementations and gives every protected page one consistent discovery path.

The feature uses case-insensitive prefix matching after trimming the query. The browser waits 250 milliseconds before requesting results and aborts an older request when the query changes. Results are capped at five per category, grouped by section, and selectable by pointer, Arrow Up/Down plus Enter, or `Ctrl+K`/`Cmd+K` followed by typing. Escape closes the panel. Loading, no-result, error, result-count, focus, reduced-motion, mobile-width, light-theme, and dark-theme states are explicit.

### End-to-end flow and safety boundary

1. `components/global-search.tsx` derives the current section from the route, normalizes local input, waits 250 milliseconds, and requests `/api/search` with the query and current section. An `AbortController` and monotonically increasing request sequence prevent stale responses from replacing newer results.
2. `app/api/[[...route]]/route.ts` requires a valid signed-in user, rejects blank queries and queries longer than 80 characters, validates the optional section, and delegates to `lib/global-search.ts`.
3. `lib/global-search.ts` runs capped Prisma queries in parallel. Every category applies its normal organization, Product membership, Release-Test, notification-recipient, or Admin-role boundary. It selects only approved display fields. Test Data values, encrypted fields, variables, evidence, source, payloads, secrets, and logs are neither searched nor serialized.
4. The server returns non-empty groups with the current category first and the remaining categories in a stable order. A result contains only its category, identifier, safe title/context, icon name, and protected destination.
5. Selecting a result uses the existing route and existing page behavior. Test Data honors the Product identifier in its destination, and Review honors the Suggestions or Change Proposals queue. No search action changes records, starts Runs, marks notifications read, approves work, or bypasses destination authorization.

### Technologies, choices, alternatives, and tradeoffs

- The existing Next.js route handler, Prisma client, React state, internal icon set, and CSS token system were reused. No search service, UI package, debounce package, or animation dependency was introduced.
- Server-side authorization was chosen over fetching all page inventories into the browser. This keeps inaccessible titles out of client memory and centralizes the security boundary, but each new searchable category must deliberately add its own safe select and access predicate.
- Prefix matching was chosen because the requested behavior is predictable and can use bounded database queries. Fuzzy or semantic ranking was deferred because it introduces ambiguous ordering, more infrastructure, and a broader privacy/cost surface.
- Results are capped per category rather than globally. This prevents a large Product set from hiding every Test Case or Run, but the panel is a discovery shortcut rather than an exhaustive inventory.
- Current-section priority reorders groups, not individual authorization or persisted relevance. This is simple and explainable; future usage-based ranking would require separately approved analytics and privacy decisions.
- The Test Data Product and Review queue URL handoffs were added to existing views. They only select the relevant existing context and do not change API contracts or business behavior.

Relevant files: `lib/global-search.ts`, `app/api/[[...route]]/route.ts`, `components/global-search.tsx`, `components/app-shell.tsx`, `components/ui.tsx`, `app/globals.css`, `components/review-views.tsx`, `components/sentinel-views.tsx`, `app/test-data/page.tsx`, `tests/global-search.test.ts`, and `tests/global-search.spec.ts`. The approved behavior is recorded in `problem-brief.md`, `srd.md` F14, `architecture.md` section 12, `phases.md` Phase 17, `techstack.md`, `DESIGN.md`, `frontend.md`, and `decisions-log.md` D-041.

### Verification evidence

```text
npm run lint && npm run typecheck && npm run build
> eslint .
> tsc --noEmit
✓ Compiled successfully
✓ Generating static pages (18/18)
exit 0

docker compose exec -T sentinel npx vitest run tests/global-search.test.ts
Test Files  1 passed (1)
Tests  2 passed (2)

docker compose exec -T sentinel npx playwright test tests/global-search.spec.ts --reporter=line
1 passed (11.1s)

docker compose exec -T sentinel npx playwright test --reporter=line --grep-invert "starts, refreshes, and completes a strict guided Run"
14 passed (1.3m)

docker compose exec -T sentinel npm test
Test Files  1 failed | 17 passed (18)
Tests  2 failed | 50 passed (52)
The two existing Guided Run assertions expected HTTP 201 and received HTTP 409 because a user-owned Guided Run still holds the single live-browser boundary.
```

The live browser review confirmed a grouped cross-section result panel in dark mode, stable query text after switching to light mode, clear focus treatment, result-count announcement, safe context labels, and no secret Test Data values. The automated browser test separately verified the 390-pixel viewport bounds.

### Priority-based diff learning review

| Priority | Files and symbols | What changed, risk, and owner action |
|---|---|---|
| Highest — understand now | `lib/global-search.ts` (`searchWorkspace`, category queries, access predicates, safe selects); `app/api/[[...route]]/route.ts` (`GET /api/search`); `components/global-search.tsx` (debounce, cancellation, keyboard state, navigation) | These files define the data-exposure boundary and the complete interaction state machine. Read now. A missing predicate or unsafe selected field could expose metadata, while stale-response or active-index mistakes could navigate to the wrong result. |
| Medium — understand next | `components/app-shell.tsx`; `components/review-views.tsx`; `components/sentinel-views.tsx` (`TestDataView` URL selection); `app/test-data/page.tsx`; `app/globals.css`; `tests/global-search.test.ts`; `tests/global-search.spec.ts` | These integrate search into every protected page, preserve the intended destination context, establish responsive presentation, and encode the security/interaction regression contract. Review the URL-to-existing-state handoffs and both authorization tests. |
| Lower — skim or defer | `components/ui.tsx` search icon and the Phase 17 project/design document updates | These are a small visual primitive and documentation-only changes. Skim now and use the documents to prevent later search-scope drift. |

### Ten-question understanding check

1. Why does Sentinel search through one protected server endpoint instead of downloading every page inventory and filtering it in the browser?
2. Which fields may represent a Test Data result, and which stored Test Data information must never be searched or returned?
3. How do organization role, Product membership, Release contents, notification recipient, and Admin status affect the eight result categories?
4. How do the 250-millisecond timer, `AbortController`, and request sequence work together when a user types quickly?
5. What exactly does current-section priority change, and what security or database behavior does it not change?
6. Why is the five-result limit applied per category rather than once across the whole response?
7. How do `Ctrl+K` or `Cmd+K`, Arrow Up/Down, Enter, Escape, focus visibility, and live status text make the combobox usable without a pointer?
8. Why do Test Data and Change Proposal results carry Product or queue context in their URLs, and how do their existing views apply it safely?
9. Which focused tests prove prefix behavior, result caps, authorization isolation, safe serialization, debounce, mobile bounds, and destination navigation?
10. What changes would be required to add fuzzy or semantic search safely, and why is that outside the current approved scope?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- The owner answers all ten questions and reviews the highest-priority files before Phase 17 is considered fully understood.
- Resolve the existing active Guided Run through the normal application workflow, then rerun the two state-blocked Guided Run assertions.

**Learning status:** Implementation, production build, focused search verification, applicable browser regression, visual review, and priority diff review are complete. Owner answers and the unrelated state-blocked Guided Run assertions remain open.

## Phase 18 — Recording workspace focus controls

### What changed and what problem it solves

The standalone Recording Workspace now gives the browser stage two ways to reclaim attention. **Collapse Step Log** reduces the editable timeline to a narrow restore rail, giving its horizontal space to the approved remote browser. **Full screen** hides Sentinel's recording session bar and Step Log so the browser stage fills the visible workspace. **Exit full screen** and Escape restore the regular workspace, including the Step Log's prior collapsed or expanded state.

This is a layout-only improvement for a browser-first recording task. It does not create another Selenium session, invoke browser-native fullscreen permission, change the noVNC iframe, expose noVNC controls, modify locked Chromium target policy, persist a user preference, change a recorded step, or bypass Save Test and Discard.

### End-to-end flow and implementation details

1. `RecordingWorkspaceView` holds `isStepLogCollapsed` and `isBrowserFullscreen` as transient React state. The states begin in the normal expanded workspace and disappear on route exit or refresh, matching the decision not to persist layout preferences.
2. The expanded Step Log remains mounted while hidden so its recorded items and local DOM scroll position are not discarded solely by toggling the rail. The collapsed rail retains one labelled **Expand Step Log** button and a safe recorded-step count.
3. Full screen adds CSS classes to the existing Recording Workspace. The session bar is not rendered, the Step Log is removed from layout, and the browser stage becomes the only grid column. A Sentinel-owned **Exit full screen** button is positioned over the stage, so the user always has a visible way back before Save/Discard controls return.
4. A document-level Escape listener is active only while this application-level fullscreen state is active. It exits the layout mode; it does not attempt to intercept keyboard events within the cross-document noVNC iframe or change browser policy.
5. CSS reuses the existing workspace breakpoint and `prefers-reduced-motion` behavior. Below the supported desktop width, the existing guidance remains the only Recording Workspace presentation.

### Choices, tradeoffs, and limitations

- Application-level full screen was chosen instead of the browser Fullscreen API. It is deterministic in an embedded testing product, requires no permission prompt, keeps an obvious Sentinel exit control, and does not risk changing iframe/noVNC behavior. It is not operating-system or browser-chrome fullscreen.
- The Step Log's collapsed state is preserved when entering and leaving full screen. This respects the user's temporary focus choice, though it intentionally does not survive a page refresh or another recording.
- The rail uses a compact vertical labelled button rather than an unlabelled icon. It consumes very little width while retaining an accessible name and visible focus treatment.
- Save, discard, browser launch, recording polling, API calls, and all security boundaries remain unchanged. A tester must exit full screen to reach Save/Discard, which keeps the focused browser state visually simple rather than duplicating consequential actions over the remote stage.
- The user-requested change applies only to active Recording Workspace. Guided Run remains unchanged because it has its own progress/evidence controls and was not in scope.

Relevant files: `components/sentinel-views.tsx`, `app/globals.css`, `tests/phase-1-recording.spec.ts`, `tests/frontend-phase-1-5.spec.ts`, `srd.md` F15, `architecture.md` section 13, `DESIGN.md`, `frontend.md`, `phases.md` Phase 18, and D-042 in `decisions-log.md`.

### Verification evidence and priority-based diff review

```text
npm run lint && npm run typecheck && npm run build
> eslint .
> tsc --noEmit
✓ Compiled successfully
✓ Generating static pages (18/18)
exit 0

docker compose exec -T sentinel npx playwright test tests/phase-1-recording.spec.ts --reporter=line
1 passed (11.0s)

docker compose exec -T sentinel npx playwright test --reporter=line --grep-invert "starts, refreshes, and completes a strict guided Run"
14 passed (1.4m)

docker compose exec -T sentinel npm test
Test Files  1 failed | 17 passed (18)
Tests  2 failed | 50 passed (52)
The two existing Guided Run assertions expected HTTP 201 and received HTTP 409 because a user-owned Guided Run still holds the single live-browser boundary.
```

Live browser review created an empty disposable Recording Workspace, collapsed the Step Log, entered full screen, confirmed that only the browser stage and Exit full screen button remained, minimized back to the preserved rail, then discarded the disposable draft through the normal workflow.

| Priority | Files and symbols | Why and owner action |
|---|---|---|
| Highest — understand now | `components/sentinel-views.tsx` (`RecordingWorkspaceView`, `isStepLogCollapsed`, `isBrowserFullscreen`, Escape listener) | This is the complete client state machine. Read now to understand why it is safe, transient, and isolated from recording APIs. |
| Medium — understand next | `app/globals.css` (collapsed grid, fullscreen grid, rail, persistent exit control); `tests/phase-1-recording.spec.ts`; `tests/frontend-phase-1-5.spec.ts` | These define the layout geometry and prove the control sequence alongside the existing remote-browser launch flow. Review the desktop breakpoint and launch wait. |
| Lower — skim or defer | `srd.md`, `architecture.md`, `DESIGN.md`, `frontend.md`, `phases.md`, and `decisions-log.md` | These record the interaction and safety boundary without adding runtime behavior. Use them before extending the workspace. |

### Ten-question understanding check

1. Why are Step Log collapse and recording full screen stored only in React state instead of being saved to the database or session?
2. What remains mounted when the Step Log is collapsed, and why does that matter for recorded steps and local scroll position?
3. How does application-level full screen differ from the browser Fullscreen API and from the noVNC fullscreen control that Sentinel intentionally hides?
4. Which visible controls disappear in full screen, which control remains available, and why is Save or Discard not duplicated over the remote browser?
5. How does the implementation restore the user's previous collapsed or expanded Step Log state after full screen is minimized?
6. What does Escape do in this feature, and what does it deliberately not control inside the remote iframe?
7. Which existing browser, Chromium, noVNC, recording, authorization, and redaction boundaries remain unchanged by these controls?
8. Why does the existing narrow-screen desktop guidance remain instead of making full screen a mobile recording solution?
9. Which tests prove the collapsed rail, button-driven exit, Escape exit, saved-recording flow, launch geometry, and broader browser regression?
10. If persistent workspace preferences were requested later, what privacy, synchronization, and schema decisions would need approval before adding them?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- The owner answers all ten questions and reviews the highest-priority component and CSS files before Phase 18 is considered fully understood.
- Resolve the existing active Guided Run through the normal workflow, then rerun the two state-blocked Guided Run assertions.

**Learning status:** Implementation, production build, focused Recording Workspace regression, broader browser regression, visual review, and priority diff review are complete. Owner answers and the unrelated state-blocked Guided Run assertions remain open.

## Phase 18 refinement — Compact Step Log rail icons

The collapsed Recording Workspace rail originally rotated the visible **Expand Step Log** text vertically and showed a step-count badge. That used unnecessary visual space and made the browser-focused mode feel unfinished. The rail now uses a compact directional chevron icon, and the expanded Step Log uses the matching opposite-direction icon. The existing button text remains the accessible name and tooltip, while CSS reduces only its visual font size. No recording state, browser session, API, noVNC behavior, or authorization rule changed.

`app/globals.css` overrides the original rail dimensions, writing mode, text size, count badge, and chevron direction. `tests/frontend-phase-1-5.spec.ts` creates and discards a lightweight recording draft, asserts that both controls are icon-sized, confirms normal horizontal writing mode, and verifies the count badge is hidden. `DESIGN.md`, `frontend.md`, and D-042 record the icon-only interaction rule.

```text
npm run lint
> eslint .
exit 0

docker compose exec -T sentinel npx playwright test tests/frontend-phase-1-5.spec.ts --grep "compact icon controls" --reporter=line
1 passed (5.2s)

npm run typecheck && npm run build
> tsc --noEmit
✓ Compiled successfully
✓ Generating static pages (18/18)
exit 0
```

Priority review: read `app/globals.css` now because its later override must continue to win over the original collapsed-rail declarations. Read `tests/frontend-phase-1-5.spec.ts` next because it captures the accessible-name and visual-layout contract. The design and decision documents are lower priority reference material.

### Ten-question understanding check

1. Why was rotated visible text a poor fit for the collapsed Step Log rail?
2. How can a button keep an accessible name when its visible text is visually hidden?
3. Why does the compact rail override writing mode rather than relying on the original vertical declaration?
4. Which pseudo-elements create the two directional chevrons, and how do their rotations differ?
5. Why is the step-count badge hidden in the collapsed rail?
6. Which existing interaction state still determines whether the rail is collapsed or expanded?
7. Why does this CSS-only refinement not affect recording API calls or the remote browser session?
8. What does the lightweight Playwright test create and how does it clean that data up safely?
9. Which selector-order property makes the later compact-control rules override the earlier rail rules?
10. If a future icon asset replaces the CSS chevron, which accessible behavior must remain unchanged?

#### Answers

- Owner answers pending.

**Learning status:** Compact-control implementation and focused verification are complete. Owner answers remain pending.

## Phase 19 — Responsive workspace navigation

### What changed and what problem it solves

Workspace sections previously rendered their own `AppShell`. Moving from Products to Runs or Releases therefore recreated the masthead, section navigation, global search, theme controls, and New Recording entry point. While Next.js prepared the next route, the previous page remained visible, so a rapid sequence of clicks looked stuck and competing route transitions could leave the browser on an older destination.

The root layout now owns one persistent workspace shell. Existing page wrappers detect that boundary and render only their content, which avoids a risky all-at-once route-file rewrite. The shell highlights the latest clicked section immediately, keeps navigation available, and reasserts that destination until its pathname commits. It prefetches the finite primary route set during browser idle time and loads the New Recording dialog module only when the user requests it.

### End-to-end flow and implementation details

1. `app/layout.tsx` keeps `WorkspaceShell` mounted above route content.
2. `WorkspaceShell` applies the shared shell only to authenticated inventory and management routes. Sign-in, account-link, Recording Workspace, and Run Workspace routes keep their established standalone compositions.
3. A workspace link click prevents the competing default transition, records the latest destination, and updates the active navigation label plus an accessible loading status immediately.
4. An effect compares that pending destination with the current pathname. If they differ, it calls the existing Next.js router. If an older route commits first, the changed pathname causes the effect to request the latest destination again. Pending state clears only when that destination is active.
5. The shell prefetches Dashboard, Products, Test Cases, Test Data, Runs, Releases, Review, Notifications, and Administration after the browser becomes idle. No API data is fetched by this prefetch.
6. The New Recording dialog uses a dynamic client import. Ordinary routes no longer eagerly include that dialog through the shell; production first-load JavaScript for Releases fell from 136 kB to 117 kB and Administration from 135 kB to 116 kB.

### Technologies, choices, alternatives, and tradeoffs

- The existing Next.js App Router, `usePathname`, `useRouter`, and `router.prefetch` remain the only routing tools. A second router or navigation state library would add ownership and synchronization problems without helping this finite route set.
- A React context marks the persistent shell boundary. This compatibility layer avoids editing every page wrapper in the same change, though those wrappers are now redundant and may be removed gradually in later one-file changes.
- Latest-destination state is transient. It is not stored in local storage, a cookie, session data, or PostgreSQL because it has meaning only while one navigation is pending.
- The first timer-based coalescing attempt was rejected after the global-search regression showed that a responsive navigation lifecycle could clear the timer. Pathname-driven idempotent routing is slightly more explicit and covers older-route completion reliably.
- This change improves route preparation and perceived responsiveness. It does not cache Product, Run, or Release API responses; server-query performance remains a separate concern if measurements later show an API bottleneck.

### Verification evidence and priority-based diff review

```text
npm run lint
> sentinel@0.1.0 lint
> eslint .
exit 0

npx tsc --noEmit --incremental false
exit 0

npm run build
✓ Compiled successfully in 1923ms
✓ Generating static pages (18/18)
exit 0

docker compose exec -T sentinel npx playwright test tests/frontend-phase-1-5.spec.ts tests/global-search.spec.ts --reporter=line
Running 4 tests using 1 worker
4 passed (22.3s)
exit 0
```

| Priority | Files and symbols | Why and owner action |
|---|---|---|
| Highest — understand now | `components/app-shell.tsx` (`WorkspaceShell`, `AppShellFrame`, `pendingHref`, pathname-routing effect) | This is the navigation state machine and the fix for the competing-transition race. Read now, especially the rule that pending state clears only when its own destination commits. |
| Medium — understand next | `app/layout.tsx` (`WorkspaceShell` boundary); `tests/frontend-phase-1-5.spec.ts` (rapid navigation regression) | These activate persistence and encode the Products → Runs → Releases contract. Review how the test proves the masthead DOM survives the route change. |
| Lower — skim or defer | `architecture.md`, `phases.md`, and `decisions-log.md` | These explain the approved boundary and acceptance state but do not execute runtime behavior. |

### Ten-question understanding check

1. Why did rendering `AppShell` independently inside every section page make navigation feel stuck even when the API was healthy?
2. Which routes receive the persistent workspace shell, and why do sign-in, Recording Workspace, and Run Workspace remain outside it?
3. How does the React context let existing page-level `AppShell` wrappers remain safe during this migration?
4. What changes in the interface immediately after a section click, before the new pathname has committed?
5. Why does the routing effect compare `pendingHref` with `pathname` instead of clearing pending state on every pathname change?
6. How does the implementation ensure Releases still wins if Products or Runs finishes navigating after the Releases click?
7. What does route prefetching load, and what Product, Test Case, Run, or Release data does it deliberately not cache?
8. Why is the New Recording dialog dynamically imported, and what production bundle evidence shows the effect?
9. Which browser assertions prove shell persistence, rapid-click behavior, responsive navigation, and compatibility with global search?
10. If a page still feels slow after this fix, how would you distinguish route preparation, client rendering, and API/database latency before changing code?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- The owner answers all ten questions and reviews `WorkspaceShell`, `AppShellFrame`, and the latest-destination effect before Phase 19 is considered fully understood.
- Measure protected API response times separately if users still observe slow data after the route lifecycle fix; do not add client caching without defining freshness and mutation invalidation rules.

**Learning status:** Implementation, production build, rapid-click verification, responsive/global-search regression, and priority diff review are complete. Owner answers remain pending.

## Phase 19 refinement — Fast local route compilation

### What changed and what problem it solves

The persistent workspace shell made clicks react immediately, but the Docker-local Next.js development server still used Webpack and compiled each unvisited route on demand. Live measurements showed that first visits to Products, Test Cases, Runs, and Test Data took about 4–6.6 seconds even though their protected API requests generally completed in 30–200 milliseconds. The local `dev` script now uses Next.js Turbopack. Production still uses the existing `next build` and `next start` paths.

From a clean Sentinel web-container restart, the shared Dashboard compiled in 3.16 seconds. Every other primary cold section completed in 0.31–0.47 seconds, and warmed visits completed in 0.085–0.102 seconds. The web container alone was recreated; PostgreSQL, Redis, MinIO, the QA fixture, the worker, stored evidence, and the active Guided Run were not reset.

### End-to-end flow, choices, tradeoffs, and limitations

1. Docker starts the Sentinel web service and runs the package `dev` script.
2. Next.js starts with its bundled Turbopack development compiler and preserves hot reload.
3. The first shared route prepares common application modules; later section clicks compile only their missing route modules.
4. The persistent shell from Phase 19 continues to show the newest click immediately while that smaller cold compilation finishes.
5. Page components then make the same protected API calls as before. No response is cached beyond existing behavior, so create/edit/delete freshness and authorization are unchanged.

Turbopack was chosen because it is bundled with the pinned Next.js runtime, needs no new dependency, and directly targets the measured compiler bottleneck. Running the production server for daily development was rejected because it removes the normal edit-and-hot-reload loop. Adding a client data cache was rejected because API timing was not the primary delay and no freshness or mutation-invalidation contract has been approved. Database indexing was also rejected without evidence of a slow query.

The main tradeoff is that local development and production use different compilers, so both the live browser regression and the production build must keep running. The initial shared Dashboard compile still takes about 3.16 seconds after a fresh compiler restart, but it is a one-time cost within the accepted 3.5-second budget. The existing dependency audit warning about eight high-severity packages remains unrelated and unresolved by this performance change.

### Verification evidence and priority-based diff review

```text
Fresh Docker-local Turbopack timing:
dashboard 3.157841s 200
products 0.361990s 200
test-cases 0.322821s 200
runs 0.334352s 200
releases 0.345726s 200
test-data 0.306975s 200
review 0.348900s 200
notifications 0.465875s 200
admin 0.380420s 200
dashboard warm 0.100093s 200
products warm 0.086925s 200
test-cases warm 0.090334s 200
runs warm 0.090877s 200
releases warm 0.085250s 200
test-data warm 0.102401s 200
review warm 0.092239s 200
notifications warm 0.089872s 200
admin warm 0.085254s 200

npm run lint && npx tsc --noEmit --incremental false && npm run build
> sentinel@0.1.0 lint
> eslint .
> sentinel@0.1.0 build
> next build
✓ Compiled successfully in 5.0s
✓ Generating static pages (18/18)
exit 0

docker compose exec -T sentinel npx playwright test tests/frontend-phase-1-5.spec.ts --reporter=dot
Running 3 tests using 1 worker
···
3 passed (17.4s)
exit 0
```

| Priority | Files and symbols | Why and owner action |
|---|---|---|
| Highest — understand now | `package.json` (`dev` script) | This switches the live local compiler and therefore affects every developer page visit. Read now and keep production `build`/`start` separate. |
| Medium — understand next | `tests/frontend-phase-1-5.spec.ts` (reduced-motion assertion and rapid navigation); `techstack.md`; `README.md` | The browser test protects the user flow and now treats `0s` and `0ms` as the same zero duration. The documents define how local and production execution differ. |
| Lower — skim or defer | `phases.md` and `decisions-log.md` | These preserve the measured budget, scope, and decision history without changing runtime behavior. |

### Ten-question understanding check

1. What evidence showed that cold development compilation, rather than the protected APIs, was the dominant remaining page delay?
2. Which package script changed, and which production scripts deliberately remain unchanged?
3. What happens during the first Dashboard visit after a fresh development compiler restart?
4. What cold and warm timing budgets were used, and did every primary workspace route meet them?
5. Why was only the Sentinel web container recreated, and which persistent services and user data stayed untouched?
6. Why was a client-side API cache not added as part of this optimization?
7. Why would using the production server for ordinary local development be a poor replacement for Turbopack?
8. What compatibility risk comes from using one compiler in development and another for production, and which checks reduce that risk?
9. Why should reduced-motion verification compare the numeric zero rather than require the exact string `0ms`?
10. If page lag returns, how would you separately measure compiler time, API time, and client rendering before choosing another fix?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- The owner answers all ten questions and reviews the `dev` script plus the cold/warm timing evidence before this refinement is considered fully understood.
- Revisit data caching only if measured API latency becomes the dominant delay and an explicit freshness and mutation-invalidation contract is approved.

**Learning status:** The local compiler change, clean-container timing, production build, and focused browser regression are complete. Owner answers remain pending.

## Phase 18 defect refinement — Step Log collapse visibility

### What changed and what problem it solves

The Recording Workspace collapse button changed React state and reduced the Step Log grid column to 4rem, but the expanded timeline content stayed visible inside that narrow column. This produced the clipped headings and paragraphs shown in the owner screenshots and made the collapse control appear broken.

React already applied `hidden` to `.step-panel__expanded`. The problem was CSS precedence: the authored `.step-panel__expanded { display: flex; }` rule overrode the browser's built-in `[hidden] { display: none; }` behavior. A component-scoped rule now makes both Step Log regions `display: none` whenever their `hidden` attribute is present.

### End-to-end flow, implementation details, and tradeoffs

1. The tester selects **Collapse Step Log**.
2. `RecordingWorkspaceView` keeps the existing `isStepLogCollapsed` state and sets `hidden` on the expanded region while revealing the collapsed region.
3. The workspace grid changes from its 30/70 split to `4rem` plus the remaining browser width.
4. The new CSS rule removes the hidden expanded region from layout, leaving only the labelled **Expand Step Log** chevron in the rail.
5. Selecting **Expand Step Log** reverses the two `hidden` attributes and restores the same mounted timeline DOM.

Keeping both regions mounted preserves the existing component and scroll/state boundary. Conditional React rendering was considered but rejected because the state was already correct and changing component structure would be broader than the presentation defect. A global `[hidden]` override was rejected because the failure is local and a global rule could affect unrelated components. No `!important` declaration is required because the scoped rule is placed after the competing display rules with sufficient specificity.

The fix does not persist the collapsed preference across refreshes and intentionally does not change the 4rem rail width. It also does not affect Guided Runs, remote browser/noVNC behavior, captured steps, APIs, save/discard, authorization, or full-screen state restoration.

### Verification evidence and priority-based diff review

```text
Before the CSS fix:
expandedHidden: true
expandedDisplay: flex
expandedWidth: 155.421875
panelWidth: 64

After the CSS fix:
expandedHidden: true
expandedDisplay: none
expandedWidth: 0
panelWidth: 64
workspaceColumns: 64px 1216px

npm run lint && npx tsc --noEmit --incremental false && npm run build
> sentinel@0.1.0 lint
> eslint .
✓ Compiled successfully in 3.3s
✓ Generating static pages (18/18)
exit 0

docker compose exec -T sentinel npx playwright test tests/frontend-phase-1-5.spec.ts --grep "compact icon controls" --reporter=line
Running 1 test using 1 worker
1 passed (9.5s)
exit 0

docker compose exec -T sentinel npx playwright test tests/frontend-phase-1-5.spec.ts tests/phase-1-recording.spec.ts --reporter=dot
Running 4 tests using 1 worker
····
4 passed (54.1s)
exit 0
```

The live visual check used an empty temporary draft at the screenshot-sized desktop layout. It confirmed a clean restore rail with no clipped content; that exact zero-step draft was then removed.

| Priority | Files and symbols | Why and owner action |
|---|---|---|
| Highest — understand now | `app/globals.css` (`.step-panel__expanded[hidden]`, `.step-panel__collapsed[hidden]`) | This is the behavior fix and demonstrates how authored display rules can override semantic hidden state. Read now. |
| Medium — understand next | `tests/frontend-phase-1-5.spec.ts` (`uses compact icon controls…`) | This now proves the expanded region is hidden, the rail is exactly 64px, and expansion restores the content. Review the three assertions. |
| Lower — skim or defer | `phases.md` and `decisions-log.md` | These preserve the defect boundary, evidence, and rationale without executing runtime behavior. |

### Ten-question understanding check

1. Why did the Step Log look collapsed at the grid level while its text remained visible and clipped?
2. Which React state and HTML attribute were already correct before this repair?
3. How can an authored `display: flex` rule override the browser's normal handling of the `hidden` attribute?
4. Why is the repair scoped to the two Step Log regions instead of adding a global `[hidden]` rule?
5. Why was `!important` unnecessary for this selector?
6. What remains visible in the intentional 4rem collapsed rail, and how can a screen-reader user identify it?
7. Why does keeping the regions mounted help preserve the existing timeline boundary when expanding again?
8. Which browser assertions prove that clipped content cannot return while the Step Log is collapsed?
9. Which recording, browser, persistence, authorization, and Guided Run behaviors remain unchanged?
10. If another component combines `hidden` with an authored display declaration, how would you diagnose and repair it without creating an overly broad CSS rule?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- The owner answers all ten questions and reviews the scoped hidden-state rule plus the focused browser assertions before this refinement is considered fully understood.

**Learning status:** Root-cause diagnosis, scoped CSS repair, visual geometry verification, static checks, production build, focused regression, broader recording regression, cleanup, and priority review are complete. Owner answers remain pending.

## Phase 18 UI refinement — Single-row Step Log controls

### What changed and what user problem it solves

The expanded Step Log header previously placed its step-count badge and collapse mark in a vertical stack. That made the count wrap onto another line and left the CSS-drawn corner mark looking inconsistent with the rest of Sentinel. The title block remains unchanged, while the count and collapse control now form one horizontal row beside it.

The collapse button uses the shared `chevronLeft` SVG and the 4rem restore rail uses the matching `chevronRight` SVG. Both sit in circular 42px controls, retain explicit accessible labels and tooltips, and use an 18px icon with a consistent 2.25 stroke. The count uses `white-space: nowrap`, so labels such as `0 steps` remain one line.

### Flow, technology, alternatives, and tradeoffs

1. `RecordingWorkspaceView` renders the existing title block, step badge, and labelled collapse button in that order.
2. The action container is a non-growing horizontal flex row, while the title block may shrink safely.
3. The shared `Icon` component supplies the same SVG geometry already used elsewhere in Sentinel instead of inventing another asset.
4. Collapse preserves the existing state transition and 64px rail; only the right-facing restore chevron remains visible.
5. Expansion restores the original title, single-line count, and left-facing control.

A new icon package or image asset was rejected because the repository already has a small accessible SVG system. Keeping the CSS pseudo-element and merely changing its border thickness was rejected because it would continue duplicating shared icon behavior. Moving the count into the title copy was rejected because the owner requested it as the middle element. The fixed 42px target is slightly larger than the 18px glyph, which improves pointer and keyboard usability without widening the Step Log.

### Verification evidence and priority review

```text
Live expanded-header geometry:
title right: 217.375px
count left/right: 233.375px / 313px
control left/right: 321px / 363px
count: 0 steps
count white-space: nowrap
control: 42px circle
SVG: 18px × 18px

Live collapsed geometry:
expanded display: none
rail width: 64px
control border radius: 999px
SVG: 18px × 18px

npm run lint && npx tsc --noEmit --incremental false && npm run build
> sentinel@0.1.0 lint
> eslint .
✓ Compiled successfully in 3.4s
✓ Generating static pages (18/18)
exit 0

docker compose exec -T sentinel npx playwright test tests/frontend-phase-1-5.spec.ts --grep "compact icon controls" --reporter=line
Running 1 test using 1 worker
1 passed (5.8s)
exit 0

docker compose exec -T sentinel npx playwright test tests/frontend-phase-1-5.spec.ts tests/phase-1-recording.spec.ts --reporter=dot
Running 4 tests using 1 worker
····
4 passed (56.2s)
exit 0
```

The first focused test attempt correctly reached the new UI but failed because the new test used DOMRect `left/right` names against Playwright's `x/width` geometry object. The assertion was corrected to calculate each right edge as `x + width`, then the focused and broader suites passed. The empty zero-step draft used for live visual review was removed afterward.

| Priority | Files and symbols | Why and owner action |
|---|---|---|
| Highest — understand now | `components/sentinel-views.tsx` (`RecordingWorkspaceView`, `Icon` usage); `app/globals.css` (`.step-panel__head-actions`, count nowrap, icon controls) | These files define the semantic labels, visual order, sizing, and shared chevron pair. Read now. |
| Medium — understand next | `tests/frontend-phase-1-5.spec.ts` (compact Step Log workflow) | This proves title → count → control ordering, one-line count behavior, SVG presence, 64px collapse, and restoration. Review its geometry calculation. |
| Lower — skim or defer | `frontend.md`, `DESIGN.md`, `phases.md`, and `decisions-log.md` | These synchronize the design and decision boundary without adding runtime behavior. |

### Ten-question understanding check

1. Why did the previous vertical action container make the step count look like a second line?
2. What is the required left-to-right order of the three expanded Step Log header regions?
3. Which CSS property guarantees that `0 steps` or a larger count remains on one line?
4. Why does the title block have `min-width: 0` while the controls use `flex: 0 0 auto`?
5. Why was the repository's shared `Icon` component preferred over another CSS-drawn mark or a new dependency?
6. Which chevron direction represents collapse, and which direction represents restore?
7. How do the icon-only buttons retain accessible names and pointer tooltips?
8. Why is the clickable control 42px while the SVG itself is only 18px?
9. Which test assertions prove horizontal ordering without depending on a screenshot comparison?
10. Which recording, full-screen, browser-session, data, API, and authorization behaviors remain unchanged?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- The owner answers all ten questions and reviews the shared SVG markup, single-row flex rules, and focused geometry assertions before this refinement is considered fully understood.

**Learning status:** Design synchronization, shared-icon implementation, live visual/geometry review, static checks, production build, focused regression, broader recording regression, cleanup, and priority review are complete. Owner answers remain pending.

## Phase 20 — Dashboard Health overview column alignment

### What changed and what problem it solves

The Health overview looked like a four-column ledger, but every Product button created its own CSS grid. Its final column used `auto`, so status labels of different widths—such as `Passed`, `Failed`, `Interrupted`, and `No Runs`—caused each row to divide the remaining width differently. Product-name length was visually distracting, but measured status width was the actual cause of the shifting Tests and pass-rate columns.

The parent `.health-overview` now owns one four-track grid, and every row inherits those exact tracks with CSS `subgrid`. Product names remain one line and use ellipsis only when they exceed their shared track. Tests, pass rate, and status labels remain non-wrapping and use identical horizontal starts across all rows.

### Flow, technology, alternatives, and tradeoffs

1. The Dashboard API returns the same authorized Product health items as before.
2. React renders the same four children in every row: Product name, saved-Test count, pass rate, and latest status.
3. The parent grid calculates the four desktop tracks once, including enough shared width for the widest status badge.
4. Each row spans the parent and uses `grid-template-columns: subgrid`, so every child lands on the same column start.
5. The existing mobile media rule replaces subgrid with its compact two-column presentation and continues hiding secondary metrics.

Hard-coding pixel starts was rejected because the panel width changes with viewport and zoom. Repeating a four-fraction template in every row would improve consistency only if no intrinsic content changed track sizing; the previous `auto` column demonstrated that risk. A semantic HTML table was not introduced because these rows are interactive Product-filter buttons and changing markup would broaden keyboard and selection behavior. CSS subgrid fixes the measured layout while preserving those interactions.

Subgrid requires the project's modern supported browsers. The complete Product name stays in the button's accessible text, but exceptionally long names visually truncate instead of increasing row height. No visible column headers were added because they were not requested; the existing content remains self-explanatory in this compact ledger.

### Verification evidence and priority review

```text
Before repair, status-dependent starts included:
Tests: 601.4375px to 618.3984375px
Pass rate: 836.046875px to 860.28125px
Status: 1107.765625px to 1140.484375px

After repair across 10 Product rows:
Product starts: [70]
Tests starts: [596.921875]
Pass-rate starts: [832.03125]
Status starts: [1105]
Row heights: [56]

npm run lint && npx tsc --noEmit --incremental false && npm run build
> sentinel@0.1.0 lint
> eslint .
✓ Compiled successfully in 2.4s
✓ Generating static pages (18/18)
exit 0

docker compose exec -T sentinel npx playwright test tests/phase-6-dashboard-notifications.spec.ts --reporter=line
Running 1 test using 1 worker
1 passed (15.2s)
exit 0

docker compose exec -T sentinel npx playwright test tests/frontend-phase-1-5.spec.ts --grep "workspace shell responsive" --reporter=line
Running 1 test using 1 worker
1 passed (8.6s)
exit 0
```

The combined dashboard/frontend run completed three of four workflows. Its only remaining failure was outside this CSS change: the recording workflow's five-second post-discard URL assertion expired even though service logs showed `DELETE /api/recordings/... 200`; that deletion took 5.292 seconds. A targeted repeat reached the same successful deletion but again exceeded the five-second redirect assertion. The focused dashboard workflow, its Product fixture cleanup, compact Step Log workflow, and rapid navigation workflow pass. The existing recording test timeout remains an explicit follow-up rather than being hidden by this dashboard change.

| Priority | Files and symbols | Why and owner action |
|---|---|---|
| Highest — understand now | `app/globals.css` (`.health-overview`, `.health-overview__row`, Product overflow) | This contains the shared-track behavior and mobile override interaction. Read now, especially why the parent owns sizing. |
| Medium — understand next | `tests/phase-6-dashboard-notifications.spec.ts` (`overviewGeometry`) | This proves all four starts and row heights are identical across real short/long Product and status labels. Review the geometry loop and bounded data wait. |
| Lower — skim or defer | `frontend.md`, `DESIGN.md`, `phases.md`, and `decisions-log.md` | These preserve the approved visual and technical boundary without changing runtime behavior. |

### Ten-question understanding check

1. Why could identical per-row grid declarations still produce different column starts?
2. Which content-width difference was measured as the primary cause of the shifting columns?
3. What does CSS subgrid inherit from the parent Health overview grid?
4. Why does defining the tracks once on the parent guarantee alignment across all Product rows?
5. How are very long Product names handled visually, and what complete information remains accessible?
6. Why are Tests, pass-rate, and status cells prevented from wrapping?
7. Why was a hard-coded pixel-column solution rejected?
8. How does the existing mobile media rule avoid being forced into the four-column desktop presentation?
9. Which browser assertions prove alignment without relying on screenshot comparison?
10. Which dashboard data, filtering, selection, API, database, and authorization behaviors remain unchanged?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- The owner answers all ten questions and reviews the parent/subgrid CSS plus the four-column geometry assertions before Phase 20 is considered fully understood.
- Investigate or harden the separate recording workflow's post-discard five-second navigation expectation if local API cleanup continues to exceed that budget.

**Learning status:** Root-cause measurement, shared-column repair, live visual review, design synchronization, static checks, production build, focused dashboard regression, cleanup, and priority review are complete. Owner answers and the unrelated recording timeout follow-up remain pending.

## Phase 21 — Expired-session return to sign-in

### What changed and what user problem it solves

Sentinel's server intentionally expires an authenticated session after eight hours. A tab left open beyond that point still displayed its old protected page, and the next API call returned HTTP 401 with `Sign in required.`. Each feature treated that response like an ordinary error, so the user stayed in a workspace that could no longer work.

Protected browser requests now pass through `lib/client-api.ts`. The first 401 starts one best-effort logout request, clears the stale protected history entry with `window.location.replace("/")`, and returns the browser to the sign-in page. Concurrent protected calls share the same exit state, so they cannot create a logout storm. Invalid credentials still render on the sign-in form because public login explicitly opts out, and an authenticated 403 remains feature-level feedback.

### Complete flow, technology, alternatives, and tradeoffs

1. A signed-in feature calls the shared `apiRequest` wrapper using its existing `/api/...` path, method, body, and optional cancellation signal.
2. The server continues to resolve the opaque HttpOnly cookie against PostgreSQL and returns 401 when the eight-hour session is missing, expired, revoked, or no longer active.
3. On the first protected 401, a module-level guard records that exit has started. A keepalive POST to `/api/auth/logout` asks the server to delete the matching session when present and expire the browser cookie.
4. The browser immediately replaces the current location with `/`. Replace is used instead of push or assign so the stale protected screen is not the immediate Back destination.
5. The failed feature promise stays pending while the document unloads, preventing its catch block from briefly rendering the raw API error.
6. Later simultaneous 401 handlers see the guard and wait for the same unload instead of sending another logout.
7. Public login uses `redirectOnUnauthorized: false`, so an invalid-password 401 throws its normal `Invalid email or password.` error to the form.
8. A 403 never enters the session-expiry branch. Older message-text heuristics were removed so wording such as “access” cannot accidentally redirect an authenticated user.

Changing the session to never expire was rejected because it weakens the approved authentication policy and does not handle role-change or account-disable revocation. A timer based on login time was rejected because the HttpOnly server session is authoritative and can be revoked earlier. Duplicating a status check in every component was rejected because the repository already had many independent request helpers and could drift again. A response interceptor library was unnecessary for one small fetch boundary. The pending promise is intentional during navigation; if browser navigation were prevented by a future host environment, the caller would not recover in place, so the redirect behavior must remain covered by a real browser test.

### Verification evidence and priority diff review

```text
npm run lint && npx tsc --noEmit --incremental false && npm run build
> sentinel@0.1.0 lint
> eslint .
✓ Compiled successfully in 2.4s
✓ Generating static pages (18/18)
exit 0

docker compose exec -T sentinel npx playwright test tests/session-expiry.spec.ts --reporter=line
Running 2 tests using 1 worker
2 passed (11.5s)
exit 0

docker compose exec -T sentinel npx playwright test tests/session-expiry.spec.ts tests/frontend-phase-1-5.spec.ts tests/global-search.spec.ts --grep "expired protected session|invalid credentials|workspace shell responsive|searches the authorized workspace" --reporter=line
Running 4 tests using 1 worker
3 passed (31.5s)
1 failed: global search reached Test Data before its Product options populated within 5 seconds
exit 1

docker compose exec -T sentinel npx playwright test tests/global-search.spec.ts --reporter=line
Running 1 test using 1 worker
1 passed (25.8s)
exit 0
```

| Priority | Files and symbols | Why and owner action |
|---|---|---|
| Highest — understand now | `lib/client-api.ts` (`apiRequest`, `beginExpiredSessionExit`, `signOutAndRedirect`) | This is the new global authentication transition and controls cookie cleanup, 401/403 separation, concurrency, and browser history. Read now. |
| Highest — understand now | `components/sentinel-views.tsx` (`request`, `useDashboardData`, `TestCaseDetailView`) | This file covers login plus most protected surfaces and removes unsafe error-text redirects. Review why login opts out and why permission errors now set feedback. |
| Medium — understand next | `components/app-shell.tsx`, `components/global-search.tsx`, `components/release-views.tsx`, `components/review-views.tsx`, `components/admin-views.tsx`, `components/notification-views.tsx`, `components/test-case-editor.tsx`, `components/ownership-transfer.tsx` | These consumers now preserve their feature behavior while delegating HTTP authentication status handling. Review the search AbortSignal and explicit sign-out paths first. |
| Medium — understand next | `tests/session-expiry.spec.ts` | The browser test distinguishes expired 401, invalid-login 401, and authenticated 403, checks one logout request, and proves the raw expiry message is absent. Read next. |
| Lower — skim or defer | `srd.md`, `architecture.md`, `frontend.md`, `phases.md`, and `decisions-log.md` | These synchronize the approved behavior, scope, and evidence without adding runtime behavior. |

The combined browser run's single global-search failure is recorded rather than hidden. It was a data-readiness timeout in an unrelated Test Data selector; the same complete global-search workflow passed immediately in isolation. No session-expiry assertion failed in either run.

### Ten-question understanding check

1. What server response tells the browser that the current authentication session is no longer valid?
2. Why does Sentinel keep the eight-hour server expiry instead of extending it to solve this UI problem?
3. What does the module-level session-exit guard prevent when several protected requests fail together?
4. Why is the logout request sent with `keepalive` during automatic expiry handling?
5. Why does the redirect use `window.location.replace("/")` instead of a normal client-side route push?
6. Why does the protected request promise remain pending after starting the redirect?
7. How does invalid-password feedback avoid triggering the global session-expiry behavior even though login also returns HTTP 401?
8. Why must HTTP 403 remain an in-context error rather than log the user out?
9. Which older text-based behaviors were unsafe, and what replaced them?
10. Which focused browser assertions prove logout coalescing, sign-in navigation, absence of raw expiry feedback, invalid-login feedback, and permission-denial preservation?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- The owner answers all ten questions and reviews `lib/client-api.ts`, the removed message-text heuristics, and the focused browser workflow before Phase 21 is considered fully understood.
- If the combined global-search data-readiness timeout recurs, replace its fixed five-second Product selector expectation with an explicit authorized-data readiness condition as a separate test-hardening change.

**Learning status:** Requirements, architecture, implementation, static checks, production build, focused session browser coverage, relevant navigation/search regression, decision record, and priority diff review are complete. Owner answers remain pending, so the learning review is not complete.

## Phase 22 — Compact Product actions and asynchronous deletion

### What changed and what user problem it solves

Product rows previously exposed every operation as a text button, so routine scanning was noisy and long labels consumed most of each row. Edit is now a labelled pencil icon, Delete is an Admin-only labelled trash icon, and View Test Cases, GitHub, Jira, and eligible ownership transfer live in a three-dot menu. Labels and titles keep the icon controls understandable to keyboard and assistive-technology users.

Permanent Product deletion is now a durable background workflow. The warning dialog retrieves current counts from the server, explains that Product-owned Test Cases, Runs, reviews, notifications, evidence, Test Data, recordings, and integrations are removed, explicitly says affected Releases are preserved, and enables confirmation only after exact `DELETE`. The page immediately reports queued/processing/completed/failed state and polls the persisted request, so navigation is never held open by the cascade.

### Complete flow, technology, alternatives, and tradeoffs

1. The protected Products API marks returned Products with the current Admin's delete capability. Non-Admins never receive a delete control, and every impact/status/delete endpoint independently rechecks the Admin role and organization.
2. Clicking Delete requests a fresh server-derived impact snapshot. The dialog renders those counts and requires exact case-sensitive confirmation.
3. The DELETE endpoint persists one `ProductDeletionRequest`, writes an audit event, and enqueues a BullMQ job with a stable request ID. It returns HTTP 202 immediately; repeated active submissions reuse that request/job.
4. A single-concurrency worker claims the request. Queued Auto Run jobs are removed, active recordings and Guided Runs are interrupted, and running Auto Runs receive a bounded cancellation window. Work that cannot stop safely fails and retries instead of forcing deletion.
5. Evidence object keys are loaded in bounded batches and deleted from MinIO first. If any object deletion fails, relational deletion does not begin.
6. One ordered PostgreSQL transaction removes Product-owned notifications, suggestions/change proposals, Runs, Test Cases, recordings, Test Data, memberships, integrations, and remaining cascaded relations. It removes only this Product's `ReleaseTest` and `ReleaseRunItem` records, recalculates affected Release Run readiness, and never deletes the Release.
7. The transaction deletes the Product, leaves the deletion request with a null Product relation, marks it completed, and writes a completion audit event. Failures retain a safe code for retry/status UI without exposing internal details.
8. The Products page polls only while work is queued or processing, reloads authorized inventories on completion, and tells the Admin that they may keep working or leave the page.

A direct synchronous DELETE was rejected because network interruption would make a long request look failed and invite duplicate submissions. Database cascading alone was rejected because it cannot remove MinIO objects first, cancel live work, preserve only selected Release records, or expose progress. Soft-delete/archive was not selected because the requirement is permanent removal and restore semantics would materially expand scope. A new worker service was unnecessary; the existing worker process can host a separate queue with isolated concurrency.

The durable request and safe ordering add schema, queue, worker, and retry complexity. Deletion is intentionally irreversible, and object deletion cannot be rolled back after MinIO succeeds but before a later database failure; retries remain safe because deleting a missing object is idempotent. Very large Products still process serial database phases, although object removal is batched by eight and normal representative deletion completed in about three seconds. Completion is shown persistently on the Products page; no new email/notification type was added.

### Verification evidence

```text
npm run lint && npx tsc --noEmit --incremental false && npm run build
> sentinel@0.1.0 lint
> eslint .
✓ Compiled successfully in 1135ms
✓ Generating static pages (18/18)
exit 0

docker compose exec -T -e SENTINEL_BASE_URL=http://127.0.0.1:3000 sentinel npx vitest run tests/product-deletion.test.ts tests/release-api.test.ts --reporter=verbose
✓ tests/release-api.test.ts (3 tests)
✓ tests/product-deletion.test.ts (1 test, 3113ms)
Test Files  2 passed (2)
Tests  4 passed (4)
Duration  10.38s
exit 0

docker compose exec -T -e SENTINEL_BASE_URL=http://127.0.0.1:3000 sentinel npx playwright test tests/product-creation.spec.ts --reporter=line
Running 2 tests using 1 worker
2 passed (18.7s)
exit 0

docker compose exec -T -e SENTINEL_BASE_URL=http://127.0.0.1:3000 sentinel npx playwright test tests/product-creation.spec.ts --grep "requires explicit" --reporter=line
Running 1 test using 1 worker
1 passed (7.5s)
exit 0
```

The database test proves Admin-only authorization, exact confirmation, server impact counts, one retained deletion request, real MinIO object removal, Product-owned Run/review/notification/Test Data deletion, cross-Product isolation, Release and retained Product-item preservation, and completion in ordinary seconds. The browser test proves the three labelled icon controls, overflow navigation, warning copy, exact confirmation gating, non-blocking progress, and final completion feedback.

### Priority-based diff learning review

| Priority | Files and symbols | Why and owner action |
|---|---|---|
| Highest — understand now | `lib/product-deletion.ts` (`productDeletionImpact`, `stopProductWork`, `deleteEvidenceObjects`, `deleteProductRecords`, `processProductDeletion`) | This is the irreversible orchestration boundary. Read the cancellation, MinIO-before-database ordering, transaction sequence, Release repair, and failure codes now. |
| Highest — understand now | `app/api/[[...route]]/route.ts` (Product deletion impact/status/DELETE routes) | This enforces Admin and organization boundaries, exact confirmation, impact snapshots, persistence, audit, idempotent acceptance, and safe HTTP responses. Read now. |
| Highest — understand now | `prisma/schema.prisma` (`ProductDeletionRequest`, `ProductDeletionStatus`) and `prisma/migrations/20260828120000_add_product_deletion_requests/migration.sql` | These make deletion durable across navigation/restarts and retain history after Product removal. Review the nullable unique Product relation and indexes now; most unrelated schema diff is formatter-only. |
| Highest — understand now | `lib/queue.ts` (`PRODUCT_DELETION_QUEUE`, `enqueueProductDeletion`) and `worker.ts` (`productDeletionWorker`) | These control duplicate jobs, retries, concurrency, and worker lifecycle. Review stable IDs and the one-job-at-a-time limit now. |
| Medium — understand next | `components/sentinel-views.tsx` (`ProductsView`, `ProductActions`) and `app/globals.css` (Product action/menu/delete styles) | These implement capability-driven controls, warning/progress state, polling, and responsive presentation. Review exact confirmation and why integration dialogs remain mounted inside the open menu. |
| Medium — understand next | `tests/product-deletion.test.ts` and `tests/product-creation.spec.ts` | These encode the destructive safety contract and visible behavior. Read the MinIO assertion, Release cross-Product fixture, and exact input/button checks next. |
| Lower — skim or defer | `components/ui.tsx` (edit/delete SVG paths) | Shared icons only; accessible names come from their callers. |
| Lower — skim or defer | `srd.md`, `architecture.md`, `frontend.md`, `phases.md`, and `decisions-log.md` | These preserve scope, design, acceptance criteria, and rationale without adding runtime behavior. |

### Ten-question understanding check

1. Why is Product deletion restricted to organization Admins in both the UI and every server endpoint?
2. What information does the impact endpoint calculate, and why must the server—not the browser—calculate it?
3. Why does the DELETE endpoint return HTTP 202 instead of waiting for every related record and evidence object to be removed?
4. How do the persistent deletion request and stable queue job ID prevent duplicate active deletion work?
5. What happens to draft recordings, Guided Runs, queued Auto Runs, and running Auto Runs before relational deletion begins?
6. Why are MinIO evidence objects deleted before the PostgreSQL transaction, and what happens when an object deletion fails?
7. Which Release records are removed, which Release records are preserved, and how is affected Release Run readiness repaired?
8. Why is the deletion request's Product relation nullable, and which history remains after the Product itself is gone?
9. Which automated assertions prove cross-Product isolation, evidence cleanup, exact confirmation, and non-blocking completion?
10. What are the main tradeoffs and limitations of permanent asynchronous deletion compared with synchronous cascade or soft-delete/archive?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- The owner answers all ten questions and reviews the highest-priority orchestration, API authorization, migration, and queue files before Phase 22 is considered fully understood.
- Run a representative high-volume benchmark before setting a production deletion service-level objective; the current evidence proves ordinary fixture completion, not an upper bound for very large Products.

**Learning status:** Requirements, architecture, migration, implementation, real MinIO/database/API coverage, Release regression, browser coverage, production build, decision record, and priority diff review are complete. Owner answers remain pending, so the learning review is not complete.

## Phase 23 — Focused Test Case detail interface

### What changed and why

The saved Test Case page now puts Product, owner, and recorded-step count directly below the Test Case name. It removes the generic read-only copy, replaces the two Run actions and overflow action with compact labelled icons, and keeps secondary actions in a left-aligned three-dot menu that closes on outside pointer/focus or Escape. Repository routing is absent when GitHub is unavailable or the Product has no active repository. Recorded steps are compact disclosures: the action and useful target/value stay visible, annotations expand on demand, and checkpoints use a warning label with a dashed visual boundary.

This solves a scanning problem without changing the underlying Test Case. A user can identify the Test Case, start its common workflows, and scan a long recording quickly; detail remains available when it is relevant.

### End-to-end flow and implementation

1. `TestCaseDetail` loads the same protected Test Case payload and derives the current immutable version, variables, and ordered steps.
2. `PageHeader` renders Product, owner, and step count. Shared `IconButton` and SVG `Icon` primitives provide compact controls while their accessible names and native `title` tooltips describe Guided Run, Auto Run, and More actions.
3. `TestCaseActionMenu` owns its open state. Document-level `pointerdown` and `focusin` listeners dismiss outside interaction; Escape closes the menu and restores focus to the trigger. Its secondary commands remain semantic menu items.
4. `OwnershipTransfer` accepts a menu-item trigger role and portals its modal to `document.body`. Closing the parent menu therefore cannot unmount an open ownership dialog.
5. `RepositoryRouting` reads the existing routing endpoint. It renders nothing during the initial request, when GitHub is unavailable, or when no active connection exists; the existing routing form remains unchanged for connected Products.
6. `StepTimelineItem` uses native `details`/`summary`, so pointer and keyboard expansion work without custom disclosure state. The summary normalizes the recorded action and retains target/value context. The expanded body contains description, expected outcome, variable, and checkpoint annotations, or an explicit no-annotations message.

No UI framework or icon package was added. Native disclosure/menu semantics, the existing shared SVG system, a React portal, and scoped CSS were sufficient. The tradeoff is that native `details` appearance needs deliberate CSS and the menu needs document listeners; in return, the solution stays small and keeps reliable keyboard behavior. The GitHub card is intentionally hidden rather than showing connection guidance on this page; Product settings remain the place to establish a repository. Long target/value text may still need wrapping, and owner visual feedback remains useful across uncommon viewport and content combinations.

### Verification evidence

```text
docker compose exec -T -e SENTINEL_BASE_URL=http://127.0.0.1:3000 sentinel npx playwright test tests/test-case-detail-ui.spec.ts tests/phase-5-release.spec.ts tests/phase-7-suggestions.spec.ts --reporter=line
Running 3 tests using 1 worker
3 passed (23.9s)
exit 0

docker compose exec -T -e SENTINEL_BASE_URL=http://127.0.0.1:3000 sentinel npx playwright test tests/phase-1-recording.spec.ts tests/phase-2-runs.spec.ts tests/phase-3-auto-runs.spec.ts tests/phase-13-github.spec.ts --reporter=line
Running 4 tests using 1 worker
2 passed (1.5m)
2 failed
phase-13-github: outdated Product-menu selector; corrected and re-run below.
phase-2-runs: Test Case displayed "Another local browser session is active. Finish it before starting a Run." and correctly remained on the Test Case page.
exit 1

docker compose exec -T -e SENTINEL_BASE_URL=http://127.0.0.1:3000 sentinel npx playwright test tests/phase-13-github.spec.ts --reporter=line
Running 1 test using 1 worker
1 passed (7.2s)
exit 0

npm run lint && npx tsc --noEmit --incremental false && npm run build
> sentinel@0.1.0 lint
> eslint .
> sentinel@0.1.0 build
> next build
✓ Compiled successfully in 3.1s
✓ Generating static pages (18/18)
exit 0
```

The focused browser test verifies header metadata, removed copy, absent unavailable GitHub routing, accessible icon labels/tooltips, four aligned overflow actions, outside and Escape dismissal, focus restoration, ownership-dialog persistence, compact annotations, target/value summaries, expanded annotations, and checkpoint styling. Release and Suggestions verify the changed overflow menu in real workflows. Recording verifies saved annotations after expansion; Auto Run verifies the new icon action still starts the existing workflow. The Guided Run behavior itself was not re-executed because the repository's single-live-browser guard found an existing user-owned session; this is an explicit environmental limitation, not a passing assertion.

### Priority-based diff learning review

| Priority | Files and symbols | Why and owner action |
|---|---|---|
| Highest — understand now | `components/sentinel-views.tsx` (`TestCaseDetail`, `TestCaseActionMenu`, `RepositoryRouting`, `StepTimelineItem`) | This contains the behavior-critical interaction flow, conditional GitHub visibility, action wiring, and disclosure content. Read the outside-dismiss listeners, Run callbacks, and routing condition now. |
| Highest — understand now | `components/ownership-transfer.tsx` (`OwnershipTransfer`) | The portal prevents the dialog from disappearing when its parent menu closes. Review trigger roles, portal mounting, and modal lifecycle now. |
| Medium — understand next | `tests/test-case-detail-ui.spec.ts` | This is the focused acceptance contract and covers both visible presentation and keyboard/menu behavior. Read every assertion next. |
| Medium — understand next | `app/globals.css` (Test Case action-menu, disclosure, and checkpoint selectors) | These rules control alignment, responsive menu placement, compact summaries, and the non-text checkpoint cue. Review hidden state and mobile positioning next. |
| Medium — understand next | `tests/phase-1-recording.spec.ts`, `tests/phase-5-release.spec.ts`, `tests/phase-7-suggestions.spec.ts`, `tests/phase-13-github.spec.ts` | These preserve existing workflows after action-menu and disclosure changes. Their direct navigation and Product filter avoid unrelated accumulated-state ambiguity. |
| Lower — skim or defer | `components/ui.tsx` (`autoRun`, `guidedRun`, `chevronDown`) | These are shared SVG additions with no business behavior; callers provide accessible names. |
| Lower — skim or defer | `srd.md`, `frontend.md`, `phases.md`, and `decisions-log.md` | These record scope, design, acceptance, evidence, and rationale but add no runtime behavior. |

### Ten-question understanding check

1. Which three pieces of Test Case metadata moved into the header, and what duplicate or generic content was removed?
2. Why do the Guided Run, Auto Run, and overflow controls remain accessible even though their visible text was replaced by icons?
3. Which events close the overflow menu, and what extra focus behavior occurs when Escape is pressed?
4. Why is the ownership-transfer dialog rendered through a portal instead of remaining inside the action menu?
5. Under exactly which GitHub states does the repository-routing section render nothing?
6. Why was native `details`/`summary` chosen for recorded steps, and what keyboard behavior does that provide?
7. Which step information remains visible while a step is collapsed, and which annotations require expansion?
8. How can a user recognize a checkpoint without reading all of its details, and why is the label retained in addition to color/border styling?
9. Which existing server contracts or business behaviors changed as part of this feature, and which were deliberately preserved?
10. What did the focused and regression tests prove, and why is the Guided Run result recorded as an environmental limitation rather than a pass?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- The owner answers all ten questions and reviews the two highest-priority component files before Phase 23 is considered fully understood.
- Re-run the Guided Run browser regression after the existing live browser session is intentionally finished by its owner; do not clear user-owned work merely to satisfy the test.

**Learning status:** Requirements, implementation, focused and applicable regression coverage, static/build verification, decision record, and priority diff review are complete. The existing single-live-browser session blocks only the second Guided Run exercise. Owner answers remain pending, so the learning review is not complete.

## Phase 14 — Secure Telegram Run Assistant

### What changed and why

Phase 14 adds a deliberately narrow Telegram assistant for people who need to launch an existing eligible Auto Run away from Sentinel. The bot does not become a general controller: it accepts only linked private chats, uses guided buttons instead of free-form commands, starts only individual eligible Auto Runs, and returns only a requester-safe terminal summary. This gives a tester a convenient remote entry point without weakening the existing organization, Product, variable, evidence, browser, and Run safeguards.

### End-to-end flow and implementation

1. An authenticated Sentinel user opens **Account → Integrations** and asks for a Telegram link. The server creates a one-time `TELEGRAM_LINK` token hash with a ten-minute expiry; the browser sees the deep link but the database never stores the plaintext token.
2. Telegram delivers the deep-link `/start` update to the route-restricted webhook gateway. Sentinel checks Telegram's secret header, rejects non-private chat types, stores no text/payload, deduplicates the provider update ID, encrypts the private chat identifier using the distinct messaging AES-256-GCM key, and queues safe processing.
3. The worker binds the chat to the active user and organization. Later `/start`/`/menu` and callback updates look up this identity through a deterministic hash and re-check that the account, organization role, and relevant Product membership are still active.
4. Server-side selection state drives opaque inline-button callbacks. The user can browse authorized Test Cases or the members of a Release, select eligible Tests, review the list, cancel before confirmation, or confirm within five minutes. No chat value is used as Test Data or a selector.
5. Confirmation re-evaluates the current Test version, target allowlist, checkpoint state, and static-only variable policy for every selected Test in one transaction. If any Test is ineligible, Sentinel queues none. Otherwise it delegates to the canonical Auto Run queueing path and attributes each Run to the linked user.
6. Existing worker execution, evidence, retries, and Run outcome remain authoritative. At terminal completion, a durable outbox records one requester-only result delivery. The delivery worker decrypts the chat ID only long enough to call Telegram's `sendMessage`, follows one-message-per-second pacing, retries one transient failure, and persists only safe status/reason metadata.
7. A daily maintenance task removes terminal messaging command and delivery metadata after thirty days. Unlinking immediately revokes the usable chat endpoint while retaining safe audit history.

The important technologies are PostgreSQL/Prisma for encrypted identity and durable command/outbox records; Node `crypto` AES-256-GCM for chat IDs; Redis/BullMQ for asynchronous inbound/outbound work, idempotency, retry, pacing, and rate limits; native `fetch` for Telegram's HTTPS API; and Nginx plus a dedicated Cloudflare Tunnel profile to make only the webhook route reachable. These choices reuse established Sentinel boundaries instead of adding a Telegram SDK, a second automation engine, or a public frontend deployment.

The main tradeoff is intentional capability reduction. The assistant cannot take free-form instructions, direct evidence, arbitrary values, Release batches, checkpoints, cancellation after confirmation, or administrative actions. That makes chat less flexible, but keeps it auditable, avoids sensitive-data leakage, and means every actual Run uses the existing proven Auto Run policy. A real production rollout would still need provider monitoring, key rotation, compliance review, stronger abuse controls, and possibly an approved second provider; those are outside this Docker-local phase.

### References

- `prisma/schema.prisma` — linked identity, safe update, selection, and delivery persistence.
- `lib/telegram.ts`, `lib/messaging-service.ts`, and `lib/queue.ts` — provider validation, safe command processing, and durable queues.
- `app/api/[[...route]]/route.ts` — public webhook plus protected Account/Admin APIs.
- `worker.ts` — inbound processing, terminal delivery, retry, pacing, and thirty-day cleanup.
- `telegram-gateway/nginx.conf` and `docker-compose.yml` — webhook-only exposure boundary.
- `tests/telegram*.test.ts` and `tests/phase-14-telegram.spec.ts` — provider, authorization, lifetime, and UI acceptance coverage.
- `srd.md`, `architecture.md`, `phases.md`, `techstack.md`, `frontend.md`, and `decisions-log.md` — approved scope and decisions.

### Ten-question understanding check

1. Why is a private Telegram chat ID encrypted and separately indexed by a deterministic hash instead of stored in plaintext?
2. Which exact conditions must a Telegram webhook update meet before Sentinel queues its processing, and why must callback acknowledgement happen quickly?
3. How does the one-time Telegram deep-link token differ from an ordinary session, and what expiry/single-use protections apply?
4. Why do callback buttons contain opaque action references rather than Test IDs, names, or user-controlled instructions?
5. Which authorization and eligibility checks are repeated at confirmation time, even if the user saw the Test earlier in chat?
6. Why does a multi-Test confirmation queue every selection or none of them, rather than silently skip Tests that became ineligible?
7. Which existing Auto Run capabilities and policies are reused, and which otherwise available Sentinel actions are intentionally unavailable through Telegram?
8. What data is retained for thirty days, what is deliberately never retained, and how does unlinking change the persisted identity state?
9. How do database uniqueness, BullMQ job IDs, inbound rate limits, outbound pacing, and one retry work together to make provider delivery safe?
10. Why is a dedicated Nginx gateway and Telegram-only tunnel safer than exposing the normal Sentinel service through a public tunnel?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- The owner answers all ten questions and reviews the highest-priority webhook, encryption, authorization/queueing, worker-delivery, schema migration, and gateway files before Phase 14 is considered fully understood.
- Complete the manual BotFather sandbox acceptance with a disposable private-chat bot and untracked credentials. Verify group rejection, stale/revoked link denial, multi-Test all-or-nothing confirmation, ineligible-Test explanations, terminal delivery retry, and absence of raw message data in the database/audit output.

**Learning status:** Implementation, Docker migration, provider-adapter tests, focused encrypted-link lifecycle tests, lint, strict TypeScript, and Account/Admin browser checks are complete. A complete live BotFather/tunnel acceptance remains pending because it requires the owner's untracked provider credentials and public HTTPS endpoint. The broader test runner currently stops after its Auto Run file in this long-lived local stack, so the Phase 14 provider/lifecycle/UI tests were run independently; the owner should rerun the complete suite after the existing Guided Run is intentionally finished. Owner answers remain pending, so the learning review is not complete.

## Phase 24 — Tabular Test Data and row-driven Runs

### What changed and why

Test Data is now a secure table instead of one form field per variable. An authorized user can see Test Data from all accessible Products, filter to one Product, create or edit a named table, add and remove rows or columns, and import the first worksheet of an `.xlsx` file. The inventory shows only its name, Product context, reusable/single-use tag, aggregate lifecycle, row count, and field names. Values remain masked after creation. Actions are compact labelled icons whose accessible names and native tooltips explain them.

Each complete row represents one possible Run input. An Auto Run can queue one independent Run for every currently safe row in one pooled table; Guided Run deliberately selects one safe row because the local pilot allows only one live guided browser. This solves the owner's preparation problem without revealing stored inputs or creating an undefined Cartesian product across multiple pooled tables.

### End-to-end flow and important boundaries

1. The Test Data page requests the authorized Product list and the new organization-scoped Test Data summary. Selecting **All accessible Products** applies no Product filter; selecting one Product filters the already loaded safe summaries.
2. The editor maintains a client-side draft of canonical column names and ordered rows. Manual add/remove controls and Excel import produce the same draft shape. `read-excel-file/browser` is loaded only after the upload icon is used, parses only the first worksheet in the browser, and never sends the workbook itself to Sentinel.
3. The server validates the Test Data name, reuse policy, canonical unique columns, complete rows, secret-like content, and hard limits: 50 columns, 1,000 rows, 500 characters per cell, and a 2 MiB workbook. A validation response stays inside the open dialog.
4. PostgreSQL stores table metadata in `TestDataSet` and each ordered encrypted record in `TestDataRow`. AES-256-GCM encryption remains the established value boundary. List and detail responses contain row IDs, order, state, and masked field presence but never ciphertext or plaintext.
5. Editing is allowed only when every row is safe. A blank masked cell sends `null`, which means “retain the existing value”; the API decrypts that row only inside the transaction, merges replacements, re-encrypts the complete row, and atomically reorders, adds, or removes rows. Renaming a column in the UI intentionally clears retained cells because the old field identity can no longer be assumed.
6. Run binding locks a specific safe row, decrypts the selected field only long enough to create the immutable encrypted `RunVariableBinding`, and records `dataSetRowId`. Reusable rows return to safe after a successful Run; single-use rows become consumed; cancellation/interruption releases reservations according to existing lifecycle policy.
7. Auto batch mode first resolves every safe row from exactly one pooled table, then creates and reserves all Runs in one database transaction. If any row lacks the requested variable or another binding fails, the transaction creates no Runs and leaves every row safe. Queue submission happens after the transaction; individual queue failures are completed as infrastructure failures and release their row.
8. The migration created one `TestDataRow` for every existing Test Data set, copied the encrypted payload and lifecycle without exposing or re-encrypting it, linked historical pooled bindings to that row, and then removed the obsolete parent-level value/lifecycle columns.

The main technologies are Prisma/PostgreSQL transactions for ordered rows and atomic reservation; Node crypto through the existing variable-encryption helper; React state for the spreadsheet draft; a dynamically imported browser-only Excel parser; BullMQ for existing Auto Run queueing; and native tables, inputs, buttons, SVG icons, and dialog semantics for an accessible UI. A separate `test-data-limits` module exists because client code must share numeric validation limits without importing the server helper that depends on Node encryption.

The principal tradeoffs are intentional. Stored cells cannot be viewed or exported, so users replace values rather than inspect them. A table with any reserved, consumed, or invalid row cannot be structurally edited, which is simpler and safer than partial history rewriting. Auto batch accepts only one pooled table; supporting multiple would need an explicit row-join or Cartesian-product specification. Excel support is `.xlsx`, first worksheet, values only: legacy `.xls`, formulas/macros, styles, and multi-sheet joins are outside scope. The current UI uses ordinary controlled inputs rather than Excel keyboard selection, paste-fill, formulas, or drag handles. Production dependency audit still reports eight high-severity advisories in existing Prisma, Nano ID, Nodemailer, Next/PostCSS, and Sharp paths; the new Excel parser is not in a reported path, and forced breaking upgrades were not mixed into this feature.

### Verification evidence

```text
docker compose exec -T sentinel npx prisma migrate deploy
Applying migration `20260829100000_add_test_data_rows`
All migrations have been successfully applied.

Post-migration database checks
data_sets: 10
data_rows: 10
represented_data_sets: 10
bindings_with_data_set: 6
bindings_with_row: 6

docker compose exec -T -e SENTINEL_BASE_URL=http://localhost:3000 sentinel npx vitest run tests/test-data-tables.test.ts --reporter=verbose
Test Files  1 passed (1)
Tests       2 passed (2)
Duration    7.58s

docker compose exec -T -e SENTINEL_BASE_URL=http://localhost:3000 sentinel npx playwright test tests/phase-4-variables.spec.ts --reporter=line
Running 2 tests using 1 worker
2 passed (28.2s)

docker compose exec -T -e SENTINEL_BASE_URL=http://localhost:3000 sentinel npx playwright test tests/test-data-tables.spec.ts --reporter=line
Running 1 test using 1 worker
1 passed

Live Playwright CLI Excel check
Imported 2 rows and 2 columns.
customer_email | region
excel-one@example.test | north
excel-two@example.test | south

npm run lint
> eslint .
exit 0

npx tsc --noEmit --incremental false --pretty false
exit 0

npm run build
✓ Compiled successfully in 4.0s
✓ Generating static pages (19/19)
exit 0

Complete service suite
Test Files  2 failed | 20 passed (22)
Tests       3 failed | 56 passed (59)
The two Guided Run assertions received the existing single-live-browser HTTP 409.
The Telegram identity assertion lacked the optional untracked MESSAGING_ENCRYPTION_KEY.
```

### Priority-based diff learning review

| Priority | Files and symbols | What changed, risk, and owner action |
|---|---|---|
| Highest — understand now | `prisma/schema.prisma` (`TestDataSet`, `TestDataRow`, `RunVariableBinding`) and `prisma/migrations/20260829100000_add_test_data_rows/migration.sql` | These define value ownership, row lifecycle, reservations, historical attribution, and irreversible migration order. Review the copy/link/drop sequence and cascade/set-null relations now. |
| Highest — understand now | `app/api/[[...route]]/route.ts` (Test Data routes, `createRunBindings`, Auto Run batch) | This is the authorization, masking, transaction, encryption, reservation, and rollback boundary. Review exact-path routing, retained-cell merge, one-table batch rule, and post-transaction queue-failure release now. |
| Highest — understand now | `lib/test-data.ts` and `lib/test-data-limits.ts` | These encode canonical fields, limits, secret rejection, masked public summaries, and the browser/server module boundary. Read why `null` is accepted only for an identified existing row and why limits are separated from encryption imports. |
| Highest — understand now | `worker.ts` (`updateReservedDataSet`) and `components/sentinel-views.tsx` (variable binding and batch feedback) | These decide what happens to rows after Run outcomes and how a user opts into all safe rows. Review reusable versus single-use transitions, single-row Guided behavior, and multiple-pooled-table rejection. |
| Medium — understand next | `components/test-data-view.tsx` (`TestDataEditor`, `importExcel`, `submit`) | This is the spreadsheet interaction and masked edit behavior. Review column-rename retention clearing, local first-sheet parsing, dialog-local errors, and all limits next. |
| Medium — understand next | `app/test-data/page.tsx`, `app/runs/page.tsx`, `components/ui.tsx`, and `app/globals.css` | These wire Suspense boundaries, icons, batch feedback, and responsive table/dialog presentation. The key hidden behavior is that query-param hooks require Suspense during production prerender. |
| Medium — understand next | `tests/test-data-tables.test.ts`, `tests/test-data-tables.spec.ts`, `tests/phase-4-variables.spec.ts`, and `tests/variables-api.test.ts` | These encode encryption/masking, authorization, retained edits, rollback, reservation locks, UI validation, and existing Run compatibility. Read the failed-batch zero-Run assertion and plaintext-negative assertions next. |
| Medium — understand next | `package.json` and `package-lock.json` | These add and pin `read-excel-file@9.3.10`. Review that it is dynamically client-loaded and note the separate existing audit advisories before dependency upgrades. |
| Lower — skim or defer | `lib/global-search.ts`, its two search fixtures, and `tests/product-deletion.test.ts` | These are mechanical adaptations from parent-level Test Data status/value fixtures to row-backed fixtures; they protect existing search and deletion behavior. |
| Lower — skim or defer | `srd.md`, `architecture.md`, `frontend.md`, `techstack.md`, `phases.md`, and `decisions-log.md` | These preserve requirements, architecture, UI rules, technology rationale, acceptance evidence, and D-053. They add no runtime behavior. |

### Ten-question understanding check

1. Why does each Test Data row own its encrypted payload, status, and Run reservation instead of keeping those fields on the parent set?
2. What exactly crosses the browser/server boundary when an `.xlsx` workbook is imported, and which workbook features are intentionally ignored?
3. How can a user edit an existing masked table without the API ever returning the stored plaintext values?
4. Why does renaming a column clear retained cells, and what must the user provide after that rename?
5. Which authorization and lifecycle conditions must be true before a Test Data table can be edited or invalidated?
6. How does one pooled Test Data row become bound to a Run, and which record proves the exact row used later?
7. Why can Auto Run create one Run per row while Guided Run uses only one row, and what deployment constraint drives the difference?
8. What makes a multi-row Auto batch atomic before queueing, and what did the failed-field test prove about rollback?
9. How did the migration preserve existing ciphertext, lifecycle, and historical Run bindings without revealing values?
10. What are the major current limitations and risks—including multiple pooled tables, consumed-row editing, Excel scope, and the existing dependency advisories—and how could each be changed safely?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- The owner answers all ten questions and reviews the highest-priority schema, migration, API transaction, validation, and worker lifecycle code before Phase 24 is considered fully understood.
- Add a checked-in deterministic `.xlsx` fixture and an explicit browser assertion for the multi-row Auto Run confirmation/redirect before closing the browser-coverage gate.
- Re-run the complete service suite after the existing Guided Run is intentionally finished and with the optional Telegram messaging key configured; do not clear user-owned work or expose a key only to force a green suite.
- Plan dependency upgrades separately, because the available audit fixes cross Prisma, Next, Nodemailer, and image-processing compatibility boundaries.

**Learning status:** Requirements, architecture, migration, implementation, focused API/browser coverage, live Excel import, build verification, D-053, and priority diff review are complete. Automated Excel/multi-row Run UI coverage, the three environmental full-suite checks, and owner answers remain open, so Phase 24's learning and complete verification gates are not complete.

## 2026-08-30 — Phase 25: interaction polish for Product, Members, and Test Data

### What changed and why

This refinement makes three busy management screens easier to use without changing the application’s business data. Product’s overflow menu is now React-controlled and conditionally rendered: opening it installs outside-pointer, focus, and Escape listeners, so a click anywhere else closes it immediately and removes the panel from the DOM. Administration cards keep the same Member response for editing but display only the scan-friendly identity, email, user type, and Product count. Test Data’s desktop editor occupies 80% of the viewport in both dimensions, labels structural actions as **Add column** and **Add row**, offers one compact/standard/wide selector per column, and asks for confirmation before invalidating safe rows.

The flow stays local until a user confirms an existing action. A Product menu click only changes component state; an outside interaction resets that state. Opening a member editor still initializes checkboxes from the complete `member.products` array, even though names are not printed on its card. Resizing a Test Data column only changes the draft column’s `width` property, which drives CSS classes and is never included in the create/update API payload. The invalidate icon now opens a dialog; Cancel closes it with no request, while Confirm calls the unchanged authorized invalidation endpoint.

React state/effects were chosen over native `<details>` because the feature needs reliable dismissal for pointer, keyboard, and focus interactions. Conditional rendering is also essential: the previous author-level `display: grid` rule overrode the browser’s `hidden` styling, leaving every closed menu visually present. Existing shared `Dialog`, `Button`, and `IconButton` components retain focus handling, accessible names, tooltip titles, and visual language. A single native width selector replaces three crowded header icons. CSS width classes remain temporary presentation state; persistence would require a user-preference data model and a new privacy/authorization surface. Live browser measurement confirmed the 80% viewport contract and all requested interactions; lint, strict TypeScript, and the production build pass.

### Priority-based diff learning review

| Priority | Files and symbols | What changed, risk, and owner action |
|---|---|---|
| Highest — understand now | `components/sentinel-views.tsx` (`ProductActionMenu`) | This controls outside dismissal and Escape behavior for Product actions. Review listener installation/cleanup and why the ownership modal asks the menu to close first. Read now. |
| Highest — understand now | `components/test-data-view.tsx` (`confirmingInvalidation`, `resizeColumn`, `TestDataEditor`) | This protects an irreversible lifecycle action and ensures layout state never enters encrypted Test Data payloads. Review now. |
| Medium — understand next | `components/admin-views.tsx` (`AdministrationView`, `MemberEditor`) | The display omits Product names while the editor keeps its complete assignment list. Verify no authorization or editing behavior moved into the card. |
| Medium — understand next | `app/globals.css` (Product menu and Test Data grid/dialog selectors) | These rules make the workspace dialog large and map local compact/wide state into grid dimensions. Check narrow-screen behavior next. |
| Medium — understand next | `tests/product-creation.spec.ts`, `tests/test-data-tables.spec.ts`, `tests/phase-14-telegram.spec.ts` | These assert dismissal, confirmation, local expansion, concise cards, and editor retention. Re-run after local fixture cleanup. |
| Lower — skim or defer | `srd.md`, `frontend.md`, `phases.md`, `decisions-log.md` | Requirement, visual-design, acceptance, and decision records only; they add no runtime behavior. |

### Ten-question understanding check

1. Why does a controlled React menu handle outside dismissal more reliably than the former native `<details>` element here?
2. Which events close `ProductActionMenu`, and why must its listeners be removed when the menu closes?
3. Why does Product ownership transfer close the menu before opening its dialog?
4. Which member details remain on a card, and where can an administrator still inspect and change individual Product assignments?
5. What happens when the user clicks **Cancel** in the Test Data invalidation dialog, including network behavior?
6. Which endpoint is called only after invalidation confirmation, and what authorization/lifecycle checks remain server-side?
7. How is a Test Data column’s compact, standard, or wide state represented, and why is it excluded from the API payload?
8. Why do visible **Add column** and **Add row** buttons improve this editor more than two identical plus-only controls?
9. What CSS selectors turn a column-width state into a smaller or larger visible grid column, and what happens on a narrow screen?
10. Which live-browser measurements and state counts prove the Product menu dismissal, member-card simplification, 80% dialog sizing, column resizing, and invalidation confirmation now behave as intended?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- The owner answers all ten questions and reviews the two highest-priority component files before this phase is fully understood.

**Learning status:** Corrected implementation, one-file commits, lint, strict TypeScript, production build, D-054, live browser verification, and priority review are complete. Owner answers remain open.

## 2026-08-31 — Phase 26: Quiet Flight marketing landing page revamp

### What changed and why

The Sentinel marketing page was rebuilt around a quieter “Product Cinema” structure after the earlier red editorial direction felt too loud, text-heavy, and generic. The new page uses a near-white canvas, near-black type, one restrained cobalt action color, generous whitespace, short copy, and large sanitized product surfaces. The design borrows principles—not layouts or assets—from Apple’s product focus, Google Antigravity’s concise statements, Codex’s immersive product reveal, PayPal and PhonePe’s immediate action clarity, and Reflect’s use of real interface evidence.

The page now leads with one promise, **Know before you ship**, and one primary action, **Join the pilot**. It then shows the real Sentinel loop in three scenes: teach a browser journey, replay it within explicit boundaries, and inspect the resulting evidence. A separate safety section explains checkpoints, safe failure, redaction, immutable history, and human approval without turning those safeguards into a dense feature wall. The walkthrough remains lazy: only the poster loads initially, and the dialog creates the Stream player after interaction when a video ID exists. The pilot form, privacy route, sign-in route, and existing public API contract remain intact.

React and Vinext provide the independently deployable marketing application. Motion for React supplies two small entrance transitions through lazy-loaded features; `MotionConfig` delegates reduced-motion behavior to the user’s system setting without producing server/client animation drift. `useSyncExternalStore` exposes a hydration-safe ready state so walkthrough controls cannot accept an early click before React has attached their handlers. The native dialog retains keyboard and focus behavior. Responsive CSS removes the previous minimum-width floor so the complete page reflows at 200% zoom on a narrow mobile viewport.

The major tradeoff is restraint. The landing page deliberately omits metric claims, customer logos, testimonials, pricing, a newsletter, and decorative animation because Sentinel does not yet have truthful material for them. Real product screenshots build trust but require a sanitization review whenever replaced. The current walkthrough fallback is intentional until the final video, captions, and Cloudflare Stream identifier arrive. Public launch also remains blocked on production domains, Turnstile keys, legal identity/contact details, and final privacy wording.

### Verification evidence

```text
npm run typecheck
> tsc --noEmit
exit 0

npm run lint
> oxlint
exit 0

npm run build
Route (app): / and /privacy
Build complete.
exit 0

npm run test:e2e
Running 6 tests using 5 workers
6 passed (8.1s)
exit 0
```

### Priority-based diff learning review

| Priority | Files and symbols | What changed, risk, and owner action |
|---|---|---|
| Highest — understand now | `marketing/app/page.tsx` (`Home`, product scenes, walkthrough state) | This is the conversion narrative and interactive boundary. Review the Stream lazy-load condition, native dialog lifecycle, hydration guard, and exact claims now. |
| Highest — understand now | `marketing/components/waitlist-form.tsx` (`Verification`, `submit`) | This is the public data and bot-protection boundary reused by the redesign. Review lazy Turnstile loading, credential omission, safe errors, and submitted fields now. |
| Medium — understand next | `marketing/app/globals.css` and `marketing/tokens.css` | These encode the Quiet Flight hierarchy, responsive reflow, focus states, reduced motion, and cobalt-only action language. Review mobile/zoom rules and contrast next. |
| Medium — understand next | `marketing/tests/landing.spec.ts` and `marketing/playwright.config.ts` | These verify desktop/mobile product narrative, deferred media, waitlist success, keyboard focus, reduced motion, 200% zoom, and privacy. The isolated port prevents another local app from being mistaken for Sentinel. |
| Medium — understand next | `marketing/app/layout.tsx` and `marketing/public/images/product-surface.png` | These carry metadata, fonts, and the primary sanitized proof image. Re-review screenshot contents before every public replacement. |
| Lower — skim or defer | `marketing/package.json`, `marketing/package-lock.json`, and the Phase 26 documentation updates | These pin Geist and record the approved direction, requirements, technology, phase, and decision history; they contain little runtime behavior. |

### Ten-question understanding check

1. Why does the new hero use one short promise and one dominant action instead of listing Sentinel’s complete feature set above the fold?
2. How do the three product scenes explain Sentinel’s end-to-end value without making unsupported AI or performance claims?
3. Which visual rules make the Quiet Flight direction feel calmer and more product-specific than the rejected red editorial version?
4. When does the walkthrough iframe enter the page, and what does a visitor receive when the production Stream video ID is absent?
5. Why are the walkthrough buttons temporarily disabled before hydration, and how does `useSyncExternalStore` avoid a lost early click?
6. How do `MotionConfig` and the CSS reduced-motion rules work together for a visitor who requests less motion?
7. Which fields and verification value cross from the pilot form to the public API, and which browser credentials are deliberately omitted?
8. What did the desktop/mobile Playwright suite prove about keyboard focus, 200% zoom, narrow layouts, lazy media, and waitlist confirmation?
9. Why must every replacement product screenshot be sanitized, and what kinds of data should be checked before publishing it?
10. Which production inputs still block public launch, and how can they be added without changing the landing page’s core information architecture?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- The owner answers all ten questions and reviews the highest-priority page and waitlist files before Phase 26 is considered fully understood.
- Replace the temporary walkthrough state with the final sanitized 16:9 video, reviewed poster, captions, and production Cloudflare Stream ID.
- Complete the final launch review with production domains, Turnstile keys, legal identity/contact details, privacy wording, and a fresh screenshot sanitization check.

**Learning status:** The Quiet Flight design, implementation, build, focused browser coverage, decision record, and priority review are complete. Final production media/configuration and owner answers remain open, so the public-launch and learning gates are not complete.

## 2026-09-01 — Phase 26: interactive marketing Workbench

### What changed and why

The screenshot-led proof was replaced with a code-native, read-only Sentinel workspace because the earlier captures were soft, visually inconsistent, and could not demonstrate how the product is organized. A visitor can now move through Dashboard, Products, Test Cases, Test Data, Runs, Releases, and Review using one clearly disclosed sample workspace. The preview is bundled entirely inside the marketing application: its immutable fixtures do not authenticate, call a product API, set a cookie, persist a change, or expose create, record, execute, edit, approve, or delete controls. This allows the landing page to deploy independently while still giving a visitor something meaningful to operate.

A native horizontal feature rail now presents Recording, Guided Runs, Autonomous Runs, Evidence timeline, Test Data, Release readiness, and Workflows without turning the page into seven full sections. Each card opens a native dialog with focus containment, Escape dismissal, focus restoration, and a blurred backdrop. Motion for React crossfades selected preview views and settles dialogs with small bounded movement; CSS and `MotionConfig` remove travel for reduced-motion visitors. `useSyncExternalStore` prevents preview and gallery buttons from accepting an early click before hydration. The old placeholder bars were replaced with an authored SVG signal path that connects checkpoints to a controlled finish and is reused in the favicon.

The main tradeoff is that the preview demonstrates information architecture and navigation rather than executing Sentinel. That keeps the acquisition surface fast, safe, and independently deployable, but sample fixtures must be kept synchronized when the real product changes. It is intentionally not a demo account or iframe: either would require deploying and securing the product, handling session lifecycle, and preventing mutation at every server route. Native overflow and dialog behavior were chosen over a carousel dependency because they preserve touch momentum, keyboard behavior, and a smaller bundle. The walkthrough remains poster-first until the final sanitized video and captions are supplied.

The independent finish review found four important edge cases before handoff. Hero content now renders visible in the server HTML, so failed or delayed hydration cannot produce a blank first viewport. On mobile, the preview changes into a labelled horizontal navigation strip and single-column data views instead of hiding labels beside a desktop-width canvas. Both native dialogs explicitly connect their titles and descriptions, and browser coverage confirms focus returns to the feature card that opened the dialog. Until a Stream ID exists, the action truthfully says **Read the walkthrough**; production configuration changes it to **Watch the walkthrough**. The seven feature cards also use different small diagrams rather than repeating one generic glyph.

### Verification evidence

```text
npm run lint
> oxlint
exit 0

npm run typecheck -- --pretty false
> tsc --noEmit --pretty false
exit 0

npm run build
Route (app): / and /privacy
Build complete.
exit 0

npm run test:e2e
Running 8 tests using 5 workers
8 passed (10.9s)
exit 0

Impeccable detector
[]
```

### Priority-based diff learning review

| Priority | Files and symbols | What changed, risk, and owner action |
|---|---|---|
| Highest — understand now | `marketing/components/interactive-product-demo.tsx` (`InteractiveProductDemo`, local fixtures, `ActiveView`) | This defines the public simulation boundary. Review that every interaction is view selection only, sample data is disclosed, no production import/request exists, and mobile navigation retains accessible names. Read now. |
| Highest — understand now | `marketing/components/feature-gallery.tsx` (`FeatureGallery`, native dialog lifecycle) | This controls horizontal discovery and modal focus. Review hydration gating, scroll-edge state, `showModal`, close behavior, and the absence of autoplay. Read now. |
| Medium — understand next | `marketing/app/page.tsx` and `marketing/app/globals.css` | These place the interactive proof in the narrative and encode the Workbench, feature rail, backdrop blur, poster surface, responsive layout, and reduced motion. Inspect the 1280×800 first fold and 320–414px rules next. |
| Medium — understand next | `marketing/components/sentinel-logo.tsx`, `marketing/public/favicon.svg`, and `marketing/tokens.css` | These provide the new signal-path identity and named color roles. The SVG is authored code, not a generated raster; review mark legibility at small sizes. |
| Medium — understand next | `marketing/tests/landing.spec.ts` | These tests prove desktop/mobile navigation, lack of mutation controls, deferred video, gallery dialog behavior, focus, reduced motion, zoom, waitlist confirmation, and removed sign-off copy. |
| Lower — skim or defer | Phase 26 requirements, architecture, technology, design, decisions, and Hallmark memory | These synchronize the approved deployment boundary and visual fingerprint; they add no runtime behavior. |

### Ten-question understanding check

1. Why is the interactive workspace part of the marketing bundle instead of an iframe or authenticated demo account?
2. Which visitor actions are intentionally possible in the preview, and which mutation classes are intentionally impossible?
3. How does the preview disclose that its records and counts are sample data rather than customer proof?
4. What makes the marketing deployment independent from the product application when the preview is visible?
5. Why does `useSyncExternalStore` temporarily disable preview and gallery controls, and what failure did the browser test expose before this guard?
6. How do the horizontal rail, previous/next controls, and CSS snap points work together across mouse, keyboard, and touch input?
7. Which native dialog behaviors protect keyboard and screen-reader users, and what does the custom code still need to manage?
8. How do Motion for React and the reduced-motion CSS change view transitions and feature-card movement?
9. What does the signal-path logo communicate, and why is it preferable to the old three-bar placeholder or a generic shield/robot mark?
10. If Sentinel adds a new product area or changes a Run contract, which fixtures, views, tests, and documentation should be updated safely?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- The owner answers all ten questions and reviews both highest-priority components before this revision is considered fully understood.
- Recheck local fixtures against the authenticated product before each public release; never copy real customer or credential data into the marketing bundle.
- Add the final sanitized walkthrough, captions, legal/contact content, production domains, Stream configuration, and Turnstile configuration before public launch.

**Learning status:** The standalone preview, feature rail, modal, motion, logo, responsive behavior, tests, decision record, and priority review are complete. Owner answers and final production media/configuration remain open, so the Phase 26 learning and launch gates remain incomplete.

## 2026-09-01 — Phase 26: landing motion and interaction-geometry polish

### What changed and why

The landing page now responds as a visitor moves through it instead of presenting every section as a static stack. A small `ScrollReveal` component observes each below-fold content group and runs one restrained entrance when that group reaches the viewport. The server-rendered HTML stays fully visible, and content is concealed only after React has hydrated, so slow or failed JavaScript cannot leave the page blank. Visitors who request reduced motion receive a short opacity change without translation or blur.

The header now separates identity into three stable tracks: the compact signal mark sits on the left, the Sentinel wordmark is mathematically centered in the same Geist display face used by the landing page, and sign-in/pilot actions sit on the right. The feature rail gained enough internal top space for its 4px hover lift, preventing the card border from being clipped. The native feature dialog now uses explicit fixed inset geometry and automatic margins, so its center matches the viewport center across desktop and mobile while retaining native focus containment, Escape behavior, backdrop, and focus restoration.

Motion for React was retained because it already powers the page and provides `useInView` and reduced-motion awareness without another dependency. The reveal uses `useSyncExternalStore` for a hydration-safe browser-ready signal. Native `dialog` remains preferable to a custom overlay because the browser supplies modal semantics and focus behavior; CSS now controls only placement and appearance. The unused local Cloudflare worker inspector was disabled so preview verification needs only the loopback website listener and does not expose a broad debugging surface.

The tradeoff is that entrance motion depends on JavaScript after the initial visible render; this is intentional progressive enhancement rather than required navigation behavior. Reveals are grouped by meaningful page regions rather than attached to every small element, which avoids visual noise but means not every card animates independently. Sample content, marketing claims, waitlist data, APIs, and the standalone deployment boundary did not change.

### Verification evidence

```text
npm run lint
> oxlint
exit 0

npm run typecheck -- --pretty false
> tsc --noEmit --pretty false
exit 0

npm run build
Route (app): / and /privacy
Build complete.
exit 0

npm run test:e2e
Running 10 tests using 5 workers
10 passed (18.9s)
exit 0
```

### Priority-based diff learning review

| Priority | Files and symbols | What changed, risk, and owner action |
|---|---|---|
| Highest — understand now | `marketing/components/scroll-reveal.tsx` (`ScrollReveal`) | This controls progressive concealment, intersection timing, reduced motion, and the no-JavaScript fallback. Review the hydrated/in-view state transition now. |
| Highest — understand now | `marketing/components/feature-gallery.tsx` (`FeatureGallery`) and `marketing/app/globals.css` (`.feature-rail`, `.feature-dialog`) | These control hover geometry and modal placement while relying on native dialog focus behavior. Review why the rail needs internal top space and why fixed inset centering does not replace `showModal()`. |
| Medium — understand next | `marketing/app/page.tsx` (`Home`, header, `ScrollReveal` groups) | This chooses which narrative regions move and in which direction. Check that the hero remains immediately visible and that reveals are grouped rather than applied to every child. |
| Medium — understand next | `marketing/tests/landing.spec.ts` | These measure wordmark and modal centers, hover-border visibility, focus restoration, and the concealed-to-visible scroll transition on desktop and mobile. Re-run after motion or header changes. |
| Medium — understand next | `marketing/vite.config.ts` (`inspectorPort`) | This disables an unused development inspector. The website preview remains available on its loopback port; revisit only if worker debugging becomes necessary. |
| Lower — skim or defer | `marketing-design.md` and `decisions-log.md` | These record the approved motion, header, rail, and dialog rules; they add no runtime behavior. |

### Ten-question understanding check

1. Why must below-fold content remain visible in the server-rendered HTML before the scroll-reveal enhancement runs?
2. Which two conditions make `ScrollReveal` temporarily conceal a group, and what makes it reveal only once?
3. How does reduced-motion mode change the reveal's translation, blur, and timing?
4. Why is the hero deliberately excluded from the scroll-reveal system?
5. How do three equal header grid tracks keep the Sentinel wordmark centered even when the left and right contents have different widths?
6. Why is the logo word hidden in the left header slot while an accessible name still remains available?
7. What caused the feature card's upper border to disappear on hover, and how does top padding inside the scrolling rail fix it?
8. Why does the feature dialog still call `showModal()` even though CSS now explicitly centers it?
9. Which browser-test measurements prove the header name and feature dialog are centered rather than merely looking centered in one screenshot?
10. Why was the Cloudflare worker inspector disabled, and what would need to be reconsidered before enabling it again?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- The owner answers all ten questions and reviews both highest-priority areas before this polish pass is considered fully understood.
- Re-run the geometry and reduced-motion browser checks after any future header, card-lift, dialog, or reveal-timing adjustment.

**Learning status:** Implementation, one-file pushes, decision record, lint, strict TypeScript, and ten desktop/mobile browser checks are complete. Owner answers remain open, so the learning gate is not complete.

## 2026-09-01 — Phase 26: attention-zone reveal and media alignment correction

### What changed and why

Scroll reveals now wait until content crosses into the part of the viewport where a visitor is likely to be looking. Motion's intersection observer ignores the bottom 20% of the viewport and requires 8% of the observed group inside the remaining area. This replaces the earlier full-viewport threshold that could finish a reveal while the content was still below the visitor's reading position. The reveal remains one-time, hydration-safe, visible without JavaScript, and non-spatial for reduced-motion visitors.

The walkthrough appeared smaller because `ScrollReveal` became the grid item and the nested native button retained intrinsic width instead of filling that item. Both the wrapper and poster now use the full track width, restoring the intended 16:9 media stage. The capability rail now owns a computed left inset equal to the larger of the responsive page gutter or centered maximum-canvas margin; its width ends at the right viewport edge. This aligns the first card with the heading without losing horizontal discovery space.

No library, route, copy, media contract, sample data, form behavior, or API changed. The main tradeoff is a more deliberate reveal trigger: very fast scrolling can still move past an animation, but content never remains hidden because the observer runs once and the server HTML is visible by default.

### Verification evidence

```text
npm run lint
> oxlint
exit 0

npm run typecheck -- --pretty false
> tsc --noEmit --pretty false
exit 0

npm run build
Route (app): / and /privacy
Build complete.
exit 0

npm run test:e2e
Running 10 tests using 5 workers
10 passed (13.6s)
exit 0

Impeccable detector
[]
```

### Priority-based diff learning review

| Priority | Files and symbols | What changed, risk, and owner action |
|---|---|---|
| Highest — understand now | `marketing/components/scroll-reveal.tsx` (`useInView`) | The `margin` and `amount` values determine exactly when content moves. Review how the negative bottom margin defines the attention zone and why the server-visible default remains important. |
| Highest — understand now | `marketing/app/globals.css` (`.walkthrough-section`, `.walkthrough-poster`, `.feature-gallery`, `.feature-rail`) | These rules restore the media width and establish the rail's shared-canvas start. Review why moving the rail box works while padding the scrolling grid did not. |
| Medium — understand next | `marketing/tests/landing.spec.ts` | The test positions content above and below the reveal gate, measures poster/wrapper width equality, and compares the heading/card x-coordinates on desktop and mobile. |
| Lower — skim or defer | `marketing-design.md` and `decisions-log.md` | These record the intended attention-zone and alignment contracts without runtime behavior. |

### Ten-question understanding check

1. Why did the previous full-viewport observer allow an animation to finish before the visitor reached the content?
2. What does a bottom root margin of `-20%` remove from the observer's effective viewport?
3. Why is the visible amount set to 8% instead of a much larger percentage for tall sections?
4. What keeps content visible if JavaScript loads slowly or fails entirely?
5. How does reduced-motion mode change the reveal while preserving the state transition?
6. Why did wrapping the walkthrough poster in `ScrollReveal` make the native button appear smaller?
7. Which two width rules restore the walkthrough poster to the complete media track?
8. Why did padding on the horizontal grid fail to reliably align the first feature card?
9. How does `max(page gutter, centered-canvas margin)` behave differently on narrow and very wide viewports?
10. Which test measurements prove the reveal timing, walkthrough width, and feature alignment rather than relying only on visual judgment?

#### Answers

- Owner answers pending.

#### Follow-up learning tasks

- The owner answers all ten questions and reviews both highest-priority files before this correction is considered fully understood.
- Re-run the same geometry checks if the viewport gate, page maximum, feature-card width, or walkthrough grid changes.

**Learning status:** The correction, one-file pushes, decision record, lint, strict TypeScript, production build, browser checks, and detector pass are complete. Owner answers remain open, so the learning gate is not complete.
