# Sentinel — Autonomous QA Agent Platform

This project is being built with AI-assisted, learning-first development.

## Project guidance

- Read [`AGENTS.md`](AGENTS.md) before planning or changing the project.
- Record feature learnings in [`learning-log.md`](learning-log.md).
- Keep changes committed and pushed to the GitHub repository.
- Every project change is reviewed, committed, and pushed as an independent single-file change.

## Project documents

Read these in order before implementation:

1. [`problem-brief.md`](problem-brief.md) — users, current process, and problem.
2. [`srd.md`](srd.md) — product requirements and acceptance baseline.
3. [`architecture.md`](architecture.md) — provisional system design and boundaries.
4. [`phases.md`](phases.md) — dependency-aware build order and Phase 1 checklist.
5. [`techstack.md`](techstack.md) — provisional technologies and compatibility checks.
6. [`decisions-log.md`](decisions-log.md) — non-obvious decisions and open items.
7. [`learning-log.md`](learning-log.md) — owner learning records and ten-question checks.

The attached requirements document is the current product source of truth. Architecture and technology choices are provisional until the Phase 1 compatibility checks are completed.

## Readiness status

- Product documentation: prepared.
- Phase 1: implementation in progress; local Docker recording slice is available.
- Application code: not started.
- Mobile testing: deferred from v1.
- QA PostgreSQL access: read-only by design.

## Project rules

Read [`AGENTS.md`](AGENTS.md) before planning or changing the project. In particular, each changed file must be independently validated, committed alone, and pushed immediately to `origin`.

## Run Phase 1 locally

Docker Desktop is required. Start the local stack, then open [http://localhost:3001](http://localhost:3001).

```text
docker compose up --build -d
docker compose logs -f sentinel
docker compose down
```

Use `ava.tester@example.test` with password `sentinel-dev`. Create a recording for the built-in Demo CRM, launch the browser panel, then complete the demo target’s sign-in and customer-creation journey. The local browser viewer runs on port 7900.

## Status

Project setup and documentation foundation are complete. Feature coding begins only after the Phase 1 checklist and compatibility checks are reviewed.
