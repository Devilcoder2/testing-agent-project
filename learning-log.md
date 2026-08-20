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
