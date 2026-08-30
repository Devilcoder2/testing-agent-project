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

## Global discovery extension — 2026-08-24

As Sentinel grows across Products, Test Cases, Test Data, Runs, Releases, Review, notifications, and administration, users must currently choose a section before they can discover a named item. Existing section filters narrow known collections but do not help a user who remembers a name and not its location. Repeating separate search controls and matching rules on every page would create inconsistent behavior, duplicated requests, and a larger authorization surface.

The desired outcome is one search field in the authenticated command masthead. A query such as `Demo` returns authorized items whose safe display title begins with that text, groups them by section, and places the current section first. Selecting a result opens its protected detail route when one exists and otherwise opens the relevant section. Search must feel immediate without querying on every keystroke and must remain fully keyboard and screen-reader operable.

Five implementation assumptions have been resolved for the first version:

1. “Starting with” means case-insensitive prefix matching after trimming surrounding whitespace, not fuzzy or full-text matching.
2. Search covers safe entity titles and member names/email only; Test Data values, variable values, evidence, source code, payloads, secrets, and raw logs are excluded.
3. Current-page priority changes result ordering only and never broadens authorization or hides other matching categories.
4. Results are intentionally capped per category for a responsive command search; section pages remain the complete inventory.
5. The first version needs no new search service or index at the ten-user pilot scale; PostgreSQL queries through the existing API are sufficient and can later be replaced behind the same response contract.

## Public pilot acquisition extension — 2026-08-30

### Problem

Sentinel has a substantial working product surface but no public, product-specific way for a prospective customer to understand it or request pilot access. Sending startup QA and engineering teams directly to the organization sign-in screen does not explain the problem Sentinel solves, establish trust, demonstrate the real workflow, or capture qualified interest.

### Who has the problem

- QA leads at growing SaaS startups whose teams still repeat critical browser regression journeys by hand.
- Engineering leaders who need faster release feedback without replacing tester judgment with an opaque automation claim.
- The Sentinel owner, who needs a credible way to demonstrate the product and contact a small number of suitable pilot teams before general availability.

### What happens today and why it fails

Prospective customers have no concise public product story, walkthrough, feature proof, privacy notice, or pilot application path. The authenticated product is designed for existing organization members, while category-standard “agentic AI” claims would overstate Sentinel's current production readiness and obscure its safer human-taught, evidence-backed approach.

### Desired outcome

A global English-speaking startup QA or engineering visitor can understand Sentinel's value within the first viewport, watch a real sanitized walkthrough, inspect the core record/replay/evidence/approval workflow, and submit a short pilot application. Sentinel stores that lead inside an organization-isolated waitlist boundary so an authorized administrator can follow up manually.

### Success signals

- The first viewport communicates “Teach the test once. Trust every release.” and exposes both walkthrough and pilot actions.
- All product proof comes from implemented Sentinel behavior and sanitized product media; no fabricated customer, metric, pricing, or availability claim appears.
- A valid pilot application is accepted without creating a Sentinel user account or sending an automated email.
- Duplicate email submissions receive the same public success response and do not disclose whether an address already exists.
- Authorized Sentinel administrators can review, progress, archive, and delete leads only for their configured organization.

### Five confirmed assumptions

1. Sentinel is the final public product name.
2. The marketing site and authenticated product use separate deployments and domains while remaining in one repository.
3. The first CTA offers consideration for a private pilot, not a price, access date, or guarantee.
4. Cloudflare Stream and Turnstile may be configured for managed video and abuse protection.
5. Final sanitized video, captions, legal identity, contact information, production domains, and privacy wording will be supplied before public launch.

### Boundaries

The first public surface includes one landing page, one privacy page, product sign-in navigation, managed walkthrough playback, a pilot application, and the minimum Sentinel administration needed to act on applications. It does not include pricing, billing, a blog, comparison pages, testimonials, customer logos, a newsletter, bulk outreach, third-party behavioral analytics, general account signup, or a claim that the existing product shipping gate is complete.
