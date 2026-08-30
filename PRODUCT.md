# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Sentinel serves QA testers, QA leads, and engineering teams responsible for repeatedly verifying important browser journeys before a release. The marketing surface is aimed primarily at global startup QA and engineering leads evaluating whether Sentinel fits a private pilot.

## Product Purpose

Sentinel turns browser journeys that a tester already knows into reusable guided or autonomous Runs. It keeps the taught intent, execution result, captured evidence, and release decision connected so teams can reduce repetitive regression work without giving up human judgment.

Success means a team can teach a real journey once, replay it safely, understand a failure without repeating the whole journey manually, and keep consequential decisions with an authorized person.

## Positioning

Sentinel is not positioned as generic AI test generation. Its differentiating mechanism is a human-taught browser journey that can be replayed inside explicit safety boundaries, with timeline-linked evidence and human-controlled checkpoints, approvals, and release decisions.

## Operating Context

- Teams verify web products in QA environments before regular releases.
- Testers record and maintain browser journeys, variables, checkpoints, and reusable test data.
- Guided and autonomous Runs produce screenshots plus network, console, and storage evidence where available.
- Release owners and authorized reviewers inspect results, readiness, immutable history, and follow-up workflows.
- Jira, GitHub, Telegram, and read-only QA database workflows are bounded integrations rather than autonomous decision makers.

## Capabilities and Constraints

- Sentinel currently targets browser-based web journeys, not native mobile testing.
- Autonomous replay stops safely when confidence or an explicit checkpoint requires human input.
- Sensitive values are redacted before retained evidence is exposed.
- Started Runs remain bound to the exact saved Test version and outcome history.
- The public marketing site and authenticated product are separate deployments and domains.
- The marketing site may collect a short pilot application but does not promise access, pricing, a launch date, or general availability.
- Public pilot submissions use server-side abuse protection and do not send a confirmation email in the initial release.

## Brand Commitments

- The public product name is **Sentinel**.
- The voice is direct, technically credible, concise, and specific about what the product does.
- Marketing must make the role of human judgment visible rather than portraying autonomy as uncontrolled replacement.
- The marketing identity may differ from the authenticated product identity.
- Fabricated metrics, customer logos, testimonials, availability claims, and unsupported capabilities are prohibited.

## Evidence on Hand

- Sanitized screenshots of the real Sentinel product are available under `marketing/public/images/`.
- A recorded product walkthrough and captions will be supplied before public launch and served through Cloudflare Stream.
- The implemented application, requirements, architecture, tests, and phase records are the factual source for capability copy.
- No approved customer logos, testimonials, pricing, public-launch date, or performance claims are available and none may be invented.

## Product Principles

1. Preserve human judgment at uncertain or consequential moments.
2. Keep every result connected to the evidence that produced it.
3. Stop safely instead of inventing certainty.
4. Make ownership, immutable history, and external side effects explicit.
5. Use concise, verifiable product proof instead of generic automation claims.

## Accessibility & Inclusion

The product and marketing surface target WCAG 2.2 AA. They must support keyboard navigation, visible focus, reduced motion, captions for video, screen-reader landmarks and labels, and layouts that remain usable at 200% zoom.
