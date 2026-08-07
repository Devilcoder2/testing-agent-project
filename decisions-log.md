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
