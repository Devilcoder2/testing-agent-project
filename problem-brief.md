# Sentinel Problem Brief

## Problem

Sentinel is an internal platform for teaching a browser-based QA journey once and replaying it reliably across the organization’s web products. It is intended to remove repetitive regression clicking while preserving human judgment for checkpoints, behavior changes, and consequential decisions.

## Who has the problem

- A shared QA team of 10 testers.
- Developers and product managers who understand a feature and may need to teach or inspect a test.
- Developers who need enough evidence to diagnose failures without reproducing them manually.
- QA leads who need product-level and release-level confidence before weekly releases.

## What happens today

Testing is entirely manual. Before a release, testers spend 6–7 hours per day, five days per week, clicking through multiple products in a shared QA environment. The same regression journeys are repeated every week, while new or changed behavior competes for the team’s attention.

The QA environment uses PostgreSQL databases and the organization tracks bugs in JIRA. There is no existing automated-test suite to migrate.

## Why the current process fails

1. Repetitive regression work consumes tester time that could be used for exploratory and new-feature testing.
2. Manual repetition is slow and difficult to scale across multiple products.
3. Failures require people to reproduce the journey and collect evidence manually.
4. Test data can be consumed or changed, making fixed test values unreliable.
5. Small intentional UI or wording changes can create stale tests, while real defects can be mistaken for expected changes.
6. Release readiness requires manually combining results across unrelated product journeys.

## Desired outcome

A tester can teach a named, product-specific web journey in an interactive recording workspace. Sentinel stores the journey and its owner, replays it on demand or in batches, captures complete timeline-linked evidence for every run, and routes failures to the right human or JIRA workflow.

The system must:

- Support multiple internal web products.
- Support 10 concurrent named users initially.
- Support shared organization login and individual logins while retaining individual ownership.
- Keep the original test creator as the approval authority for expected-behavior changes.
- Use QA PostgreSQL only for read-only diagnosis and verification.
- Leave mobile testing, database writes, and migration of existing automated tests out of v1.

## Success signals for the first version

The first version should prove that a tester can create and save a reusable browser journey with trustworthy ownership and step data. Later phases should demonstrate that the journey can be replayed faster than manual execution, produce usable evidence, and support release and failure workflows.

Quantitative organizational success targets—such as tester-hours saved, acceptable flake rate, and three-month adoption—are not yet defined and should be measured after early use.

## Confirm before implementation expands

The following are currently assumptions or open items rather than confirmed product decisions:

1. Which organization-level identity provider and shared-login mechanism will supply a reliable named tester identity?
2. Which existing reusable test-data pools and APIs are available to Sentinel?
3. What evidence-retention period and storage budget are acceptable for videos, payloads, screenshots, and storage snapshots?
4. How should ownership and approval authority be reassigned if a test creator leaves or changes teams?
5. What success metrics define a successful first three months of production use?

## Initial boundaries

### In scope for v1

Web applications in the QA environment, multiple products, test recording, replay, evidence, variables, negative-test suggestions, releases, dashboards, notifications, JIRA, change approval, and read-only PostgreSQL insight.

### Out of scope for v1

Mobile testing, writes to QA or production databases, source-control root-cause correlation, and migration of existing automated tests.

## Source

This brief is derived from `sentinel-detailed-requirements.md` (v1.0), supplied with the project on 2026-08-05.
