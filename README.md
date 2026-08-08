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

[`frontend.md`](frontend.md) is the approved Phase 1.5 design source of truth for the dark Sentinel visual system, route-based information architecture, accessibility requirements, and future-screen specifications.

The attached requirements document is the current product source of truth. Architecture and technology choices are provisional until the Phase 1 compatibility checks are completed.

## Readiness status

- Product documentation: prepared.
- Phase 1: acceptance criteria verified; owner learning review remains pending.
- Phase 1.5: frontend foundation and Phase 1 UX redesign in progress.
- Application code: local Docker recording slice is available.
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

## Verify Phase 1

After the stack is running, execute the checks from the Sentinel container. The Docker image includes the Chromium runtime used by Playwright.

```text
docker compose exec sentinel npm run lint
docker compose exec sentinel npm run typecheck
docker compose exec sentinel npm test
docker compose exec sentinel npx playwright test tests/product-creation.spec.ts
docker compose exec sentinel npx playwright test tests/phase-1-recording.spec.ts
docker compose exec sentinel npx playwright test tests/frontend-phase-1-5.spec.ts
```

The final browser test covers the remote recording journey, password redaction, saving, dashboard navigation, reopening, and persistence after a page refresh.

## Status

Phase 1 is implemented and its acceptance checks have been verified. Phase 1.5 is redesigning those same flows into the documented route-based Sentinel interface without changing their backend behavior. Phase 1 is not marked fully understood or closed because the owner learning questions in `learning-log.md` still need answers. Replay, evidence bundles, external integrations, scheduling, and QA-network access remain later phases.
