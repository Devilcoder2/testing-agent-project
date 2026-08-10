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
- Phase 1.5: frontend foundation and Phase 1 UX redesign acceptance-verified; owner learning review remains pending.
- Phase 2: guided Runs and privacy-safe evidence capture are acceptance-verified; owner learning review remains pending.
- Phase 3: autonomous replay is implementation and automated-acceptance verified; owner learning review remains pending.
- Application code: local Docker recording, guided Runs, MinIO evidence, Redis/BullMQ, and a two-concurrency Playwright worker are available.
- Mobile testing: deferred from v1.
- QA PostgreSQL access: read-only by design.

## Project rules

Read [`AGENTS.md`](AGENTS.md) before planning or changing the project. In particular, each changed file must be independently validated, committed alone, and pushed immediately to `origin`.

## Run Phases 1–3 locally

Docker Desktop is required. Start the local stack, then open [http://localhost:3001](http://localhost:3001).

```text
docker compose up --build -d
docker compose logs -f sentinel
docker compose down
```

Use `ava.tester@example.test` with password `sentinel-dev`. Create a recording for the built-in Demo CRM, launch the browser panel, then complete the demo target’s sign-in and customer-creation journey. Chromium runs in kiosk app mode and is policy-locked to the Demo CRM; the host exposes only the noVNC viewer on port 7900, not Selenium WebDriver.

Phase 2 adds an explicit **Run test** action on a saved Test Case. The tester follows the immutable saved steps in order, marks each active step passed or failed, and can interrupt the Run. Sentinel keeps a separate test outcome and evidence-capture state, stores screenshots in the private local MinIO service, and never stores a browser-video recording. Phase 3 adds a separate **Auto Run** action backed by Redis/BullMQ and up to two isolated headless Playwright contexts. It replays the local Demo CRM only, pauses for recorded checkpoints, retries one transient technical failure, and retains the same privacy-safe evidence without video. Scheduling and external QA targets remain later work.

## Verify Phase 1

After the stack is running, execute the checks from the Sentinel container. The Docker image includes the Chromium runtime used by Playwright.

```text
docker compose exec sentinel npm run lint
docker compose exec sentinel npm run typecheck
docker compose exec sentinel npm test
docker compose exec sentinel npx playwright test tests/browser-lock.spec.ts
docker compose exec sentinel npx playwright test tests/product-creation.spec.ts
docker compose exec sentinel npx playwright test tests/phase-1-recording.spec.ts
docker compose exec sentinel npx playwright test tests/frontend-phase-1-5.spec.ts
```

The browser checks cover locked-target navigation, full-stage live-browser rendering, Product authorization, the remote recording journey, password redaction, saving, dashboard navigation, reopening, and persistence after a page refresh.

## Verify Phase 2

Keep the Docker stack running, then run:

```text
docker compose exec sentinel npm run lint
docker compose exec sentinel npm run typecheck
docker compose exec sentinel npm test
docker compose exec sentinel npx playwright test tests/phase-2-runs.spec.ts
```

The Phase 2 checks cover strict guided-step order, immutable version binding, browser-session recovery after refresh, failed/interrupted outcomes, redaction, START/END screenshot capture, network/console/storage evidence, MinIO screenshot metadata, and product authorization. A human owner should also start a saved Test Case Run, refresh while it is active, complete the Demo CRM sign-in and customer journey, pass each step, and inspect the evidence timeline before accepting the phase manually. A successful Demo CRM Run shows START and END screenshots, its same-origin activity requests in Network, and redacted session-storage keys after the journey; an empty START storage snapshot is correct because it is taken before sign-in. Console remains empty unless the target emits a warning or error—entering an incorrect Demo CRM password is a safe way to verify warning capture.

## Verify Phase 3

Keep the Docker stack running, then run:

```text
docker compose exec sentinel npm run lint
docker compose exec sentinel npm run typecheck
docker compose exec sentinel npm test
docker compose exec sentinel npx playwright test tests/phase-3-auto-runs.spec.ts
```

The Phase 3 checks cover isolated autonomous Demo CRM replay, safe exact selector matching, worker-only credential redaction, checkpoint Continue/Cancel behavior, two concurrent worker contexts, one linked technical retry, duration benchmarking, and guided-Run regression behavior. To check it manually, save a Demo CRM Test Case, choose **Auto Run**, then inspect its outcome, redacted evidence, attempts, and duration comparison in Run Detail. Marking a recording step as a checkpoint pauses the Auto Run for review; choose Continue or Cancel from the Run Detail.

## Status

Phases 1, 1.5, 2, and 3 are implementation and acceptance-verified. Their owner learning reviews remain pending in `learning-log.md`, so they are not yet marked fully understood. External integrations, scheduling, external QA targets, variables, releases, notifications, and QA-network access remain later phases.
