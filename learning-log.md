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
