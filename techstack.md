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
| Local email inspection | Mailpit SMTP sink | Pinned Docker image | Phase 6 proves durable notification delivery locally without real provider credentials or sending email outside Docker. |
| Negative-test suggestions | Deterministic TypeScript rule module | Node 22 built-in runtime; no model/API dependency | Phase 7 derives conservative drafts from recorded validation metadata in a repeatable, reviewable way without sending Test data to an LLM or external provider. |
| Jira Cloud integration | Jira REST API v3 through a server/worker adapter | Native `fetch`; no browser-side Jira SDK | Phase 8 creates or comments on reviewed Bugs asynchronously without exposing Jira credentials or operational evidence to the client. |
| QA diagnostic adapter | `pg` with a dedicated PostgreSQL role | `pg` 8.x | Phase 10 performs one parameterized, read-only customer-state lookup against an isolated QA fixture without sharing Sentinel application-database credentials. |

## 3. Integrations

- **Authentication:** Organization-approved OIDC/SAML provider when confirmed; a development-only local identity adapter may be used before the provider is available. Shared login must resolve to a named actor.
- **Jira Cloud:** REST API v3 through a server/worker adapter. `JIRA_CLOUD_URL`, `JIRA_SERVICE_EMAIL`, and `JIRA_API_TOKEN` are server-only configuration. Each Product stores only its non-secret Jira project key; the adapter queues reviewed requests, retries one transient failure, checks whether the Test Case's linked issue is still open, and sends only safe text plus protected Sentinel links.
- **Notifications:** A Nodemailer SMTP adapter sends Phase 6 local messages to Mailpit. It persists notification delivery state before queueing through BullMQ, retries one transient SMTP failure, and never makes delivery outcome part of Run or Release truth. Slack remains deferred.
- **QA PostgreSQL:** Phase 10 Docker development uses a distinct `qa-postgres` PostgreSQL 16 service and a small `qa-fixture` Node API that receives Demo CRM customer writes. Sentinel uses `QA_DATABASE_URL` only with the separate `qa_diagnostic` role. The adapter has one parameterized customer lookup with a 1.5-second timeout, one-row limit, read-only transaction, safe result/error metadata, and audit logging.

## 4. Development and operations

- Git and GitHub `origin` on `main`.
- `.env.example` for configuration names only; never commit secrets.
- Docker Compose provides local PostgreSQL, separate QA-fixture PostgreSQL/API, private MinIO, Redis, Mailpit, Sentinel, and a two-concurrency browser worker with a separate notification queue.
- Docker Desktop is required for Phases 1–2: Compose runs PostgreSQL, MinIO, Sentinel, the isolated demo target, and the browser-in-browser session.
- The local Selenium node uses a 30-minute idle session limit for guided Runs because noVNC input does not reset Selenium’s WebDriver activity timer.
- Auto Run Demo CRM credentials are worker-only environment configuration. They are never stored in PostgreSQL, MinIO metadata, browser logs, or API responses.
- `VARIABLE_ENCRYPTION_KEY` is a required base64-encoded 32-byte local secret available only to the Sentinel API and worker. It encrypts Phase 4 variable values; missing or invalid configuration blocks variable setup and affected Runs rather than falling back to plaintext.
- The worker uses a five-second default action/navigation timeout for the local Demo CRM; `AUTO_RUN_ACTION_TIMEOUT_MS` may tune that worker-only limit without changing saved Test Cases.
- Phase 5 adds no new service or dependency: immutable Test Case versions, product-local feature labels, Releases, Release Runs, and derived readiness use PostgreSQL transactions plus the existing two-concurrency BullMQ worker. Release batch work does not use the guided browser or a scheduler.
- Phase 6 requires `SMTP_HOST`, `SMTP_PORT`, `EMAIL_FROM`, and `SENTINEL_APP_URL`. Docker defaults route SMTP internally to Mailpit and expose its inspection UI only at `http://localhost:8025`; no production email credentials belong in this repository.
- Phase 7 adds no service, secret, worker, or third-party dependency. Its deterministic rule module and PostgreSQL-backed review state run in the Sentinel API transaction boundary; a Test Case is derived only after an authorized user approves one draft.
- Phase 8 adds no Docker service or client-side Jira dependency. The existing worker owns a separate Jira queue; local automated tests replace the Jira REST adapter, while a real manual check requires untracked server-only Jira Cloud credentials. A missing connection leaves Jira mapping and filing unavailable with a clear error rather than falling back to mock delivery.
- Phase 9 adds no service, queue, secret, or third-party dependency. Prisma transactions store source-version-bound Change Proposals and create immutable versions; the existing notification adapter sends safe proposal-state notices. Rejection may create a Jira `DRAFT`, but it never calls the Jira adapter until a user explicitly files that existing Phase 8 draft.
- Phase 10 adds `qa-postgres` and `qa-fixture` only for Docker-local diagnostics. Fixture initialization creates separate writer and read-only diagnostic roles. `QA_DATABASE_URL` must never target Sentinel's application database or use a writer role. The `pg` adapter verifies privileges, then runs only the allowlisted parameterized lookup inside a time-limited read-only transaction; raw rows, query values, and credentials never enter API responses, evidence, audit text, or Jira.
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
- Phase 6 notification emails and in-app summaries may contain only approved Product/Test or Release names, state, timestamp, safe reason, and protected Sentinel link. They must never serialize evidence, screenshots, variables, raw logs, credentials, cookies, tokens, or encryption material.
- Phase 7 rule evaluation must never serialize password, redacted, or variable plaintext values. Proposed values are accepted only for eligible safe text fields, remain product-authorized, and cannot be used to mutate a source Test Case or auto-start a Run.
- Phase 8 must never expose Jira API credentials or send evidence binaries, direct signed object URLs, raw network/console/storage data, variables, cookies, tokens, or credentials to Jira. Jira drafts, mappings, issue links, and queue states require current Product membership; mapping writes require the Product creator.
- Phase 10 diagnostic credentials must be a distinct least-privilege role. Query values, raw rows, SQL text, connection strings, and database credentials must never appear in browser responses, Evidence, audit data, logs, emails, or Jira. Permit only audited allowlisted queries with parameterization, row limits, read-only transactions, and timeouts.

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
- JIRA project configuration, production email provider, notification preferences/digests, and optional Slack provider.
- Observability platform and production alert thresholds.
- Production key management, rotation, and an external reusable-test-data adapter. Phase 4 deliberately uses a local PostgreSQL pool and local lifecycle checks only; reusable and single-use policies control only Sentinel's local reservation state, not cleanup in the target application.
