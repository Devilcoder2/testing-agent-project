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
| Styling | CSS Modules or a small utility layer | Version chosen with UI scaffold | Keeps the first workspace understandable and avoids premature design-system scope. |
| Validation | Zod | 3.x or compatible stable major | Runtime validation at API and job boundaries. |
| Testing | Vitest and Playwright Test | Current compatible majors pinned in Phase 1 | Fast unit tests plus real-browser acceptance tests. |

## 2. Persistence and execution

| Area | Provisional choice | Planning version/range | Why |
|---|---|---|---|
| Application database | PostgreSQL | 16.x or compatible managed version | Relational ownership, versioning, audit, release, and Run data. |
| ORM/query layer | Prisma or typed SQL layer | Select one during Phase 1 spike | Provides migrations and typed access; the final choice must preserve explicit transaction and query control. |
| Job queue | Redis plus BullMQ or equivalent durable queue | Compatible stable major | Separates browser work from HTTP requests and supports retries/concurrency. |
| Evidence storage | S3-compatible object storage | Provider selected before evidence phase | Handles large video, screenshots, and logs with lifecycle policies. |
| Browser automation | Playwright | Compatible stable release pinned in Phase 1 | Recording, browser contexts, network events, screenshots, video, and cross-browser web control. |

## 3. Integrations

- **Authentication:** Organization-approved OIDC/SAML provider when confirmed; a development-only local identity adapter may be used before the provider is available. Shared login must resolve to a named actor.
- **JIRA:** REST API through a server-side adapter; credentials stay server-side and issue creation uses idempotency and duplicate checks.
- **Notifications:** Email provider through an adapter; Slack remains optional.
- **QA PostgreSQL:** Separate connection and read-only role from Sentinel’s application database. Use allowlisted parameterized queries, timeouts, row limits, and audit logs.

## 4. Development and operations

- Git and GitHub `origin` on `main`.
- `.env.example` for configuration names only; never commit secrets.
- Docker Compose may provide local PostgreSQL and Redis during development if the selected app setup benefits from it.
- CI should run formatting/lint checks, unit tests, type checks, and browser smoke tests.
- Structured logs should include correlation IDs for a Test Case, Run, job, evidence event, and external integration request.

## 5. Security requirements for the stack

- Pin dependencies and review transitive vulnerabilities before deployment.
- Do not capture or persist secrets without configured redaction.
- Use least-privilege service accounts and separate credentials per environment.
- Enforce target URL allowlists so replay cannot accidentally reach production.
- Verify the QA database role cannot write by an automated permission check.
- Apply authorization before serving evidence URLs; use short-lived signed object URLs if supported.

## 6. Compatibility checks before coding

Phase 1 must confirm:

1. The selected Node, Next.js, TypeScript, ORM, and Playwright versions install together.
2. A minimal web page can create and persist a Product and Test Case.
3. Playwright can record basic navigation, click, and text-entry events against a local or approved QA target.
4. The test runner can execute unit, type, and browser tests without modifying tracked files.
5. Local development configuration is reproducible from `README.md` and `.env.example`.

## 7. Deliberately deferred choices

- Final Next.js deployment target.
- Prisma versus typed SQL after the first persistence spike.
- Redis/BullMQ versus an equivalent managed queue.
- Object-storage provider, retention period, and redaction implementation.
- Identity provider and named identity mapping for shared login.
- JIRA project configuration, email provider, and optional Slack provider.
- Observability platform and production alert thresholds.
