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
- Phase 4: encrypted variables and the local Test Data lifecycle are implementation and automated-acceptance verified; owner learning review remains pending.
- Phase 5: Test Case versioning and Release management are implementation and automated-acceptance verified; owner learning review remains pending.
- Phase 6: health dashboard and durable local notifications are implementation and automated-acceptance verified; owner manual and learning reviews remain pending.
- Phase 7: deterministic negative-Test suggestions are implementation and automated-acceptance verified; owner manual and learning reviews remain pending.
- Phase 8: reviewed Jira Cloud Bug workflow is implemented; focused automated verification passed, while a real Jira Cloud and owner manual check remain pending.
- Phase 10: explicit read-only local QA customer diagnostics are implemented and focused Docker verification passed; full regression, owner manual, and learning reviews remain pending.
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

Phase 6 also starts Mailpit, the local email sink. Open [http://localhost:8025](http://localhost:8025) to inspect safe Sentinel notification email without sending anything outside Docker. Configure only local values in an untracked environment file: `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, `EMAIL_FROM=Sentinel <noreply@sentinel.local>`, and `SENTINEL_APP_URL=http://localhost:3001`.

Use `ava.tester@example.test` with password `sentinel-dev`. Create a recording for the built-in Demo CRM, launch the browser panel, then complete the demo target’s sign-in and customer-creation journey. Chromium runs in kiosk app mode and is policy-locked to the Demo CRM; the host exposes only the noVNC viewer on port 7900, not Selenium WebDriver.

Phase 2 adds an explicit **Run test** action on a saved Test Case. The tester follows the immutable saved steps in order, marks each active step passed or failed, and can interrupt the Run. Sentinel keeps a separate test outcome and evidence-capture state, stores screenshots in the private local MinIO service, and never stores a browser-video recording. Phase 3 adds a separate **Auto Run** action backed by Redis/BullMQ and up to two isolated headless Playwright contexts. It replays the local Demo CRM only, pauses for recorded checkpoints, retries one transient technical failure, and retains the same privacy-safe evidence without video. Phase 4 adds encrypted static defaults, product-scoped Test Data Sets, and manual pre-run values for variable-marked Test Cases; both Guided and Auto Runs use the same binding form and never expose retained raw values. Scheduling and external QA targets remain later work.

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

## Verify Phase 4

Set a local, untracked `VARIABLE_ENCRYPTION_KEY` to a base64-encoded 32-byte value before starting the stack. The API and worker require it for variable setup and variable-backed Runs.

```text
docker compose exec sentinel npm run lint
docker compose exec sentinel npm run typecheck
docker compose exec sentinel npm test
docker compose exec sentinel npx playwright test tests/phase-4-variables.spec.ts
```

Phase 4 checks cover encrypted variable persistence, static/pool/manual selection, product authorization, local Test Data Set lifecycle, Guided and Auto substitution, refresh/retry binding reuse, and redaction. Create a Test Data Set with the default **Reusable** policy to use it sequentially across completed Runs, or select **Single-use** for a unique target-mutating value that should become consumed after a Passed outcome. The selected set is always reserved while its Run is active. The Test Data and Run Detail views show sources and masked metadata, never saved raw values. Automated variable-name suggestions are deferred.

## Phase 5 scope

Phase 5 adds product-local feature labels, a saved-Test-Case editor that creates immutable next versions, and cross-product Releases for users who belong to every included Product. The editor may change labels, descriptions, expected outcomes, checkpoints, and non-secret text-entry variable markers. Recorded browser targets and literal/redacted input values remain read-only because they define the replayed action; record a new journey to change them. Starting a Release batch snapshots the tagged Test Case versions and uses the existing Auto Run worker. Only no-checkpoint Tests with no variables or encrypted static variable defaults are executed; every other tagged Test is shown as excluded with a reason. Batch readiness is derived from all items, while individual Guided and Auto Run actions remain unchanged.

To verify Phase 5, keep the stack running and execute:

```text
docker compose exec sentinel npx vitest run tests/release-api.test.ts
docker compose exec sentinel npx playwright test tests/phase-5-release.spec.ts
```

## Phase 6 scope

Phase 6 replaces the coverage-only Dashboard with a current-membership, rolling 30-day UTC health view. It shows saved Tests, completed Runs, pass rate, failed Run count, flaky current versions, coverage change, daily Product trend, and latest completed Run state. It also adds a Notifications inbox for new failed-Run, Auto Run checkpoint, and completed Release summary events. Mailpit email is a safe summary and protected Sentinel link only; it never includes evidence, screenshots, raw logs, variables, credentials, cookies, or tokens. Delivery retries once for a transient failure and cannot change Test/Release truth.

To verify it after the stack is running:

```text
docker compose exec sentinel npm run lint
docker compose exec sentinel npm run typecheck
docker compose exec sentinel npm test
docker compose exec sentinel npx playwright test tests/phase-6-dashboard-notifications.spec.ts
```

## Phase 7 scope

Phase 7 adds a central **Review** queue for conservative, deterministic negative-Test drafts. From a saved Test Case, an authorized product member manually selects **Generate suggestions**. Sentinel reads the current immutable version's captured validation metadata and may propose a blank required field, invalid email, or one-character-outside a known text boundary. Passwords, variable-backed and redacted values, unsupported fields, and missing metadata are skipped without exposing values. A draft may change only its title, rationale, and safe proposed value. Approving one creates an independent Version 1 Test Case owned by the approver; it does not mutate the source, start a Run, update a baseline, or notify anyone.

## Phase 8 scope

Phase 8 adds an optional Jira Cloud workflow for a completed failed Run. A Product creator maps their Product to one Jira project key; credentials remain server-only configuration. A current Product member explicitly reviews a generated Bug draft, may edit only its safe summary, reproduction text, and priority, and then files it. Jira receives a protected Sentinel Run Detail link rather than screenshots or raw evidence. Sentinel updates the Test Case's existing open Jira Bug for later failures, creates a replacement only after Jira reports the prior issue Done, and retries one transient delivery failure without changing any Run truth.

To verify it after the stack is running:

```text
docker compose exec sentinel npm run lint
docker compose exec sentinel npm run typecheck
docker compose exec sentinel npm test
docker compose exec sentinel npx playwright test tests/phase-7-suggestions.spec.ts
```

For a manual check, record and save a fresh Demo CRM happy-path Test, select **Generate suggestions**, then open **Review**. Inspect skip explanations and draft rules; edit and approve one draft; confirm the new independent Test Case has Version 1 and no Run; dismiss/reopen another draft; and verify a user without that Product cannot access the queue or its linked Tests.

## Phase 9 scope

Phase 9 adds manual, change-aware maintenance for a completed failed Run after a known QA deployment. From failed Run Detail, enter deployment context and propose a revised description or expected outcome for one saved step. The proposal never changes recorded actions, selectors, values, variables, checkpoints, order, or the existing baseline. Open **Review** to compare source and proposed text. Only the original Test Case owner can approve or reject: approval creates the next immutable version; a newer baseline makes the proposal stale. Rejection creates an editable Jira draft only when the Product has a Jira mapping, and never files it automatically. Proposal notifications contain safe state summaries and protected Review links only.

To verify the focused API/database behavior:

```text
docker compose exec sentinel npx vitest run tests/change-proposals.test.ts
```

## Phase 10 scope

Phase 10 adds one explicit, Product-authorized troubleshooting action for a completed failed Run: **Run customer lookup**. It uses the final eligible customer email from that Run only in memory to query the separate Docker-local QA customer fixture. The email, raw customer row, SQL, and database credentials are never displayed or stored. Run Detail shows only Found/Not found, customer status and timestamps, or a safe incomplete/unavailable state. The diagnostic database role is independently read-only and the adapter uses a parameterized one-row query in a read-only transaction with a 1.5-second timeout. A completed safe summary can appear in a later manually reviewed Jira draft; it never creates or files Jira work by itself.

To verify the focused fixture and adapter behavior after starting Docker:

```text
docker compose exec sentinel npx vitest run tests/database-diagnostics.test.ts
docker compose exec sentinel npx prisma migrate status
```

For a manual check, record and save the Demo CRM customer journey, start a Guided Run, manually enter the same customer journey, fail a step, complete the Run, then open Run Detail and select **Run customer lookup**. It should show a safe customer-found result without exposing the email. A passed or interrupted Run must not offer this action.

## Status

Phases 1, 1.5, 2, 3, 4, 5, 6, and 7 are implementation and automated-acceptance verified. Phase 8 has focused automated verification; real Jira Cloud/manual verification remains pending. Phase 9 has focused Docker API/database verification; owner manual and learning review remain pending. Phase 10 has focused Docker fixture/role/adapter verification; full regression, owner manual, and learning review remain pending. Owner learning reviews remain pending in `learning-log.md`, so no phase is marked fully understood. External production integrations, scheduling, external QA targets, Slack, LLM suggestions, GitHub deployment correlation, automatic change classification, and QA-network access remain later phases.
