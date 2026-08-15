# Sentinel Technology Stack

**Status:** Provisional MVP baseline  
**Date:** 2026-08-05  
**Compatibility rule:** Pin exact versions during Phase 1 after installing the selected toolchain and running the smoke test. The ranges below are planning defaults, not a claim that dependencies are already installed.

## 1. Application stack

| Area | Provisional choice | Planning version/range | Why |
|---|---|---|---|
| Language | TypeScript | 5.x | Shared types across web UI, API, workers, and tests. |
| Runtime | Node.js | 22 LTS or later supported LTS | Compatible with modern TypeScript tooling and browser automation. |
| Web UI/API | Next.js with React | Next.js 15.x, React 19.x | A modular web application with server routes and a productive UI layer. |
| Styling | Custom CSS token system and component styles | Native CSS; no external styling library | Provides fixed semantic design tokens, responsive behavior, and reusable Sentinel-specific primitives without a framework migration. |
| Validation | Zod | 3.x or compatible stable major | Runtime validation at API and job boundaries. |
| Testing | Vitest and Playwright Test | Current compatible majors pinned in Phase 1 | Fast unit tests plus real-browser acceptance tests. |

## 2. Persistence and execution

| Area | Provisional choice | Planning version/range | Why |
|---|---|---|---|
| Application database | PostgreSQL | 16.x or compatible managed version | Relational ownership, versioning, audit, release, and Run data. |
| ORM/query layer | Prisma | Compatible stable major pinned in the lockfile | Provides migrations, typed access, and a clear relational model for the first slice. |
| Job queue | Redis plus BullMQ | Redis 7.x and compatible BullMQ major | Phase 3 persists Auto Run jobs, retries, pause/cancel state, and two-context worker concurrency. |
| Evidence storage | Docker-local MinIO with AWS SDK v3 | MinIO RELEASE image; `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` compatible majors | Provides a private S3-compatible evidence boundary and short-lived signed URLs during Phase 2. |
| Browser automation | Selenium for guided Runs; Playwright for Auto Runs | Selenium 4.x and Playwright Chromium pinned together | Headless Playwright contexts isolate two autonomous replays, while Selenium/noVNC retains the guided browser boundary. |
| Variable encryption | Node.js `crypto` AES-256-GCM | Node 22 built-in API | Encrypts static defaults, local Test Data Set fields, and Run bindings without adding a key-management dependency to the Docker-local MVP. |
| Release batches | Existing Prisma, Redis, and BullMQ stack | Existing pinned compatible versions | Phase 5 snapshots Test Case versions and enqueues eligible Auto Runs without adding a second scheduler or worker technology. |

## 3. Integrations

- **Authentication:** Organization-approved OIDC/SAML provider when confirmed; a development-only local identity adapter may be used before the provider is available. Shared login must resolve to a named actor.
- **JIRA:** REST API through a server-side adapter; credentials stay server-side and issue creation uses idempotency and duplicate checks.
- **Notifications:** Email provider through an adapter; Slack remains optional.
- **QA PostgreSQL:** Separate connection and read-only role from Sentinel’s application database. Use allowlisted parameterized queries, timeouts, row limits, and audit logs.

## 4. Development and operations

- Git and GitHub `origin` on `main`.
- `.env.example` for configuration names only; never commit secrets.
- Docker Compose provides local PostgreSQL, private MinIO, Redis, Sentinel, and a two-concurrency Phase 3 worker.
- Docker Desktop is required for Phases 1–2: Compose runs PostgreSQL, MinIO, Sentinel, the isolated demo target, and the browser-in-browser session.
- The local Selenium node uses a 30-minute idle session limit for guided Runs because noVNC input does not reset Selenium’s WebDriver activity timer.
- Auto Run Demo CRM credentials are worker-only environment configuration. They are never stored in PostgreSQL, MinIO metadata, browser logs, or API responses.
- `VARIABLE_ENCRYPTION_KEY` is a required base64-encoded 32-byte local secret available only to the Sentinel API and worker. It encrypts Phase 4 variable values; missing or invalid configuration blocks variable setup and affected Runs rather than falling back to plaintext.
- The worker uses a five-second default action/navigation timeout for the local Demo CRM; `AUTO_RUN_ACTION_TIMEOUT_MS` may tune that worker-only limit without changing saved Test Cases.
- Phase 5 adds no new service or dependency: immutable Test Case versions, product-local feature labels, Releases, Release Runs, and derived readiness use PostgreSQL transactions plus the existing two-concurrency BullMQ worker. Release batch work does not use the guided browser or a scheduler.
- Phase 1.5 uses local system typography, CSS custom properties, and custom React/CSS primitives; it does not add external fonts, icon packs, Tailwind, shadcn, or a component library.
- CI should run formatting/lint checks, unit tests, type checks, and browser smoke tests.
- Structured logs should include correlation IDs for a Test Case, Run, job, evidence event, and external integration request.

## 5. Security requirements for the stack

- Pin dependencies and review transitive vulnerabilities before deployment.
- Do not capture or persist secrets without configured redaction.
- Store Phase 4 static, pooled, and manual variable values only as authenticated encryption ciphertext. Do not return stored pool values, decrypted bindings, or encryption material through APIs, logs, evidence, queues, or audit text.
- Use least-privilege service accounts and separate credentials per environment.
- Enforce target URL allowlists so replay cannot accidentally reach production.
- Verify the QA database role cannot write by an automated permission check.
- Apply authorization before serving evidence URLs; use short-lived signed object URLs if supported.
- Phase 2 stores no browser video. Screenshot objects receive SHA-256 checksums, while network, console, and storage metadata is redacted before persistence.

## 6. Compatibility checks before coding

Phase 1 must confirm:

1. The selected Node, Next.js, TypeScript, ORM, and Playwright versions install together.
2. A minimal web page can create and persist a Product and Test Case.
3. Playwright can record basic navigation, click, and text-entry events against a local or approved QA target.
4. The test runner can execute unit, type, and browser tests without modifying tracked files.
5. Local development configuration is reproducible from `README.md` and `.env.example`.

## 7. Deliberately deferred choices

- Final Next.js deployment target.
- Redis/BullMQ versus an equivalent managed queue.
- Production object-storage provider and automatic evidence-retention period; Phase 2 retains local MinIO data until Docker volumes are deliberately removed.
- Identity provider and named identity mapping for shared login.
- JIRA project configuration, email provider, and optional Slack provider.
- Observability platform and production alert thresholds.
- Production key management, rotation, and an external reusable-test-data adapter. Phase 4 deliberately uses a local PostgreSQL pool and local lifecycle checks only; reusable and single-use policies control only Sentinel's local reservation state, not cleanup in the target application.
