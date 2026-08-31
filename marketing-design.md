# Sentinel Release Proof Marketing System

**Status:** Approved Phase 26 redesign

**Date:** 2026-08-31

**Applies to:** The separately deployed public marketing application only

## 1. Experience objective

The landing page must persuade startup QA and engineering leads that Sentinel can turn team-owned browser knowledge into defensible release evidence. It must look and behave like a release dossier made from the product itself—not a generic SaaS template decorated with testing copy.

The central visual idea is **Release Proof**: an active preflight sheet where real Sentinel captures, run records, checkpoints, and approval language are composed like registration proofs from a technical press room. The visitor should feel that the evidence is being assembled for a release decision as they move through the page.

The primary visitor path is:

1. Read the promise and see a real Sentinel workspace in the first viewport.
2. Play the walkthrough or follow the preflight sequence.
3. Inspect recording, replay, evidence, and human-control boundaries.
4. Submit a short application for the private pilot.

## 2. Structural system

The page uses a **Workbench** macrostructure rather than a sequence of interchangeable marketing sections.

- A minimal edge-aligned header carries the Sentinel wordmark, Sign in, and one persistent Join the pilot action. It has no centred menu of generic product links.
- The hero is a full-width ultramarine proof field. A short, condensed headline occupies the upper register while a real product capture is pinned into the lower-right evidence stage.
- A thin chartreuse trace connects the product stage to a paper-toned proof ledger below. It draws once and does not loop.
- The manual-regression problem, Teach → Replay → Decide sequence, and product capabilities appear as one continuous preflight record. They do not become equal feature cards or repeated alternating “text + mockup” bands.
- The four proof capabilities use large real screenshots, edge annotations, and crossfading evidence frames. Interface material is the content, not decoration inside fake browser chrome.
- The human-control section reads as an interruption in the record: a dark “stop condition” band with checkpoints, uncertainty, redaction, immutable history, and approvals stated as terse operational rules.
- The pilot form is the sign-off area of the dossier. It remains an ordinary accessible form, but its layout follows the release-approval metaphor rather than sitting in a floating card.
- The FAQ is a set of native review notes. The statement footer closes with “The release call stays human.” and only the real legal/contact destinations.

## 3. Content hierarchy

### First viewport

- Wordmark: **Sentinel**
- Display: **Teach the test once. Trust every release.**
- Supporting copy: **Sentinel turns the browser journeys your team already knows into repeatable runs, complete evidence, and clear release decisions.**
- Primary action: **Join the pilot**; scrolls to the inline pilot form.
- Secondary action: **Watch the walkthrough**; opens the poster-first managed video dialog and restores focus when closed.
- Product proof: the sanitized real dashboard capture, labelled as a local demo workspace. No metric, testimonial, invented run, browser frame, or decorative AI illustration.

### Preflight record

1. **Teach the journey.** Record the browser flow beside a plain-English step log.
2. **Replay it safely.** Choose Guided or Auto Runs, reuse validated test data, and stop at checkpoints or uncertainty.
3. **Decide with evidence.** Inspect timeline-linked screenshots, network, console, and storage evidence before a person makes the release call.

The capability record additionally shows release readiness, owner approval, and controlled Jira, GitHub, and Telegram workflows without implying that an integration makes decisions autonomously.

### Pilot and review notes

The form collects name, work email, company, and QA-team size. Success promises only manual review and personal follow-up for selected teams. Review notes cover pilot fit, web-testing scope, the tester’s continuing role, captured evidence, and selection.

## 4. Visual tokens

All production colour declarations use named OKLCH tokens. Hex values appear here only as approximate visual references.

| Token | OKLCH value | Approximate reference | Use |
|---|---:|---:|---|
| Proof blue | `oklch(39% 0.22 264)` | `#08278E` | Dominant first viewport and active proof fields |
| Proof blue deep | `oklch(24% 0.12 265)` | `#06164C` | Blue-surface depth and controls |
| Signal | `oklch(92% 0.22 120)` | `#D8F840` | Trace, selected state, and primary action only |
| Paper | `oklch(95% 0.012 250)` | `#ECEDE6` | Narrative canvas |
| Paper deep | `oklch(90% 0.014 250)` | `#DDE0DD` | Proof ledger subdivisions |
| Ink | `oklch(15% 0.018 260)` | `#101119` | Paper-surface text and evidence frame |
| Ink muted | `oklch(48% 0.018 260)` | `#666A74` | Supporting copy |
| Rule | `oklch(76% 0.020 255)` | `#B5BAC3` | Hairlines and field boundaries |
| Blue focus | `oklch(40% 0.24 264)` | — | Keyboard focus on paper surfaces |
| Signal focus | `oklch(92% 0.22 120)` | — | Keyboard focus on blue/dark surfaces |
| Error | `oklch(55% 0.19 28)` | — | Form error only; never a brand accent |

Signal occupies less than five percent of the page and is never used to carpet a section. Every flipped surface explicitly sets its text colour. No gradient, glow, glass, pure black, pure white, or red brand field is permitted.

## 5. Typography, grid, and shape

- Display: self-hosted **Antonio**, weight 700, condensed roman, used for the hero and major statement lines only.
- Body/interface: self-hosted **IBM Plex Sans**, weights 400 and 600, used for prose, labels, controls, and the form.
- Evidence identifiers may use **IBM Plex Mono** only if a third face becomes necessary; omit it when ordinary body figures suffice.
- The hero headline stays below 50 characters per line where possible, uses a maximum of 96px at wide viewports, and maintains line-height of at least 1.02.
- Body copy is at least 16px with a 45–70 character measure. Clickable labels never wrap.
- Wide layout uses an asymmetric twelve-column grid with a 1586×992 first-viewport reference. Mobile collapses into DOM order with the real product image following the promise.
- Edges, rules, crop marks, and the single trace create structure. Containers remain square or use radii no larger than 6px. Status pills are allowed only for true status.
- There are no nested cards, icon tiles, equal three-column feature grids, or ornamental section eyebrows. Sequence numbers appear only for Teach → Replay → Decide because order matters.

## 6. Motion and interaction

Motion uses Motion for React through lazy features and is limited to three primitives:

1. One first-load trace sweep connecting the hero statement to the evidence stage.
2. One restrained opacity/4px entrance for the hero’s semantic layer after the proof plate is present.
3. Crossfades between user-selected product-proof frames and between video/form states.

Button feedback uses a 1px press, explicit background/colour transitions, and no universal scaling. Focus rings are immediate. The page does not animate every section on scroll, parallax, scroll-link content, rotate carousels, follow the cursor, autoplay audio, or loop ambient decoration. Reduced motion removes spatial movement, trace drawing, and repeats while preserving state changes in at most 150ms.

## 7. Product media and walkthrough

- Product screenshots must come from local sanitized fixture workspaces and be reviewed for credentials, customer data, tokens, evidence payloads, repository secrets, and personal contact information.
- The hero uses `dashboard-proof.png` as an eager, dimensioned LCP image without fake browser chrome. Below-fold proof images are lazy-loaded and dimensioned.
- Walkthrough delivery remains poster-first. The Cloudflare Stream iframe is created only after a visitor presses play and removed on close. The final source is sanitized 16:9 video with WebVTT captions, keyboard controls, a written fallback, and focus-safe native dialog behavior.
- If Stream is unconfigured or unavailable, the written Teach → Replay → Decide summary remains available. Missing media never hides the product explanation.
- The social preview uses the Release Proof palette, Antonio statement typography, one trace, and the real product proof only if its details remain readable and safely sanitized.

## 8. Form, accessibility, and performance

- Every field has a visible label, stable helper/error row, constant border width, 44px minimum height, immediate focus indicator, and explicit loading/error/success behavior.
- Validation begins after blur and revalidates touched fields on change. Errors identify what failed and how to fix it without clearing other values.
- The dialog uses native `<dialog>`, closes by explicit control, Escape, or backdrop, and restores focus to the trigger.
- Meet WCAG 2.2 AA for semantics, heading order, control names, error announcements, focus, keyboard operation, captions, contrast, 200% zoom, and touch targets.
- Verify 320px, 375px, 414px, 768px, 1440px, and the 1586×992 reference with no horizontal overflow. `html` and `body` use `overflow-x: clip`.
- Target LCP ≤2.5 seconds, CLS ≤0.1, no Stream player download before interaction, and mobile Lighthouse scores of at least 90 for performance, accessibility, best practices, and SEO.

## 9. Explicit non-scope

No pricing, customer logos, testimonials, fabricated metrics, comparison tables, blog, newsletter, public account creation, confirmation email, marketing analytics, launch date, guaranteed access, or product-interface redesign is included. The acquisition surface does not close Sentinel’s separate production-readiness and learning-review gates.
