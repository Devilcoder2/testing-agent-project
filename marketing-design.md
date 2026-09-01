# Sentinel Quiet Flight Marketing System

**Status:** Approved Phase 26 interaction-proof revision

**Date:** 2026-09-01

**Applies to:** The separately deployed public marketing application only

## 1. Experience objective

The landing page must help startup QA and engineering leads understand Sentinel in seconds: teach a real browser journey once, replay it inside explicit boundaries, and review the evidence before a person makes the release call. The page must feel calm, confident, and product-led rather than loud, editorial, or densely explanatory.

The central visual idea is **Quiet Flight Workbench**: a spacious product presentation with the composure of a modern hardware launch and a small, real-feeling workspace visitors can navigate for themselves. Copy, color, and motion step back. The interaction is the proof.

The primary visitor path is:

1. Understand the promise from one short statement.
2. Navigate a clearly labelled, read-only Sentinel sample workspace before feature detail.
3. Follow a simple Teach → Replay → Decide story.
4. Understand where Sentinel stops and human judgment begins.
5. Watch the walkthrough or submit a short private-pilot application.

## 2. Reference-derived design DNA

The direction synthesizes public references without copying their pixels, brand assets, proprietary media, or exact compositions.

- Apple Mac and iPad contribute generous negative space, large confident type, one idea per visual beat, smooth restrained motion, and a touch-friendly horizontal feature gallery.
- Google Antigravity contributes a centered first-view statement with minimal supporting copy and a clear pair of actions.
- Codex contributes an immersive product reveal and the confidence to let one visual field own a viewport.
- PayPal and PhonePe contribute immediate action clarity and a recognizable product demonstration directly beneath the promise.
- Cursor contributes a useful principle rather than a visual template: let the visitor operate a bounded product demonstration instead of asking a screenshot to prove everything.
- Reflect contributes early real-product proof, but not its dense dark styling, orange accent, geometric decoration, or logo wall.

The resulting system is deliberately quieter than every previous Sentinel marketing direction. It uses the references as a shared rhythm and hierarchy, not as a template.

## 3. Structural system

The page uses a **Workbench** macrostructure with varied pacing and one dominant idea per section. This supersedes the screenshot-led Product Cinema structure approved on 2026-08-31 because the owner requested product navigation as the primary proof.

- A quiet header contains the Sentinel identity, Product, How it works, Safety, Sign in, and one Join the pilot action. It is transparent at the top and gains a subtle solid boundary only after scroll.
- The hero uses one headline, one supporting sentence, and two actions. It contains no eyebrow, section number, decorative label, proof strip, metric, testimonial, or logo row.
- A code-native Sentinel sample workspace enters directly below the hero copy. It has no fake browser bar, login flow, write action, production data, or production API dependency. Visitors may move between Dashboard, Products, Test Cases, Test Data, Runs, Releases, and Review using local sample data only.
- The page alternates between expansive white space and focused product moments. Every major section answers one question rather than grouping unrelated claims.
- A horizontally scrollable feature rail presents the broader product without lengthening the page. Each concise card opens a focus-safe detail dialog over a blurred backdrop.
- Teach, Replay, and Decide remain concise narrative beats, but they point back to the interactive workspace rather than repeating low-resolution screenshots.
- Safety is a quiet interruption: one large statement, a short explanation, and five compact human-control rules.
- The pilot form is an open sign-off area, not a floating card. The FAQ remains native disclosure rows and the footer stays small.

## 4. Content hierarchy

### First viewport

- Wordmark: **Sentinel**
- Display: **Know before you ship.**
- Supporting copy: **Teach Sentinel a browser journey once. It replays it safely and returns the evidence for a human release decision.**
- Primary action: **Join the pilot**
- Secondary action: **Watch the walkthrough**
- Product proof: one navigable, explicitly labelled sample workspace bundled with the marketing application. No invented customers, browser chrome, decorative AI art, hidden mutation, or availability claim.

### Product story

1. **Teach it once.** Record the browser journey beside a plain-English step log.
2. **Replay with boundaries.** Use guided or autonomous Runs, reusable data, and explicit checkpoints.
3. **See what happened.** Review screenshots, network, console, and storage evidence on one timeline.
4. **Keep the call human.** Use readiness and owner approval without delegating the release decision to automation.

The feature rail expands those beats into Recording, Guided Runs, Autonomous Runs, Evidence timeline, Test Data, Release readiness, and Workflows. It uses native horizontal overflow and snap points, visible previous/next controls, keyboard scrolling, and no autoplay.

### Pilot and FAQ

The form collects name, work email, company, and QA-team size. Success promises manual review and personal follow-up only for selected teams. FAQ copy covers pilot fit, browser-testing scope, the tester's continuing role, captured evidence, and manual selection.

## 5. Visual tokens

All production colors use named OKLCH tokens. Cobalt is the only brand accent and occupies less than five percent of the page.

| Token | OKLCH value | Use |
|---|---:|---|
| Canvas | `oklch(99% 0.003 255)` | Main page ground |
| Canvas soft | `oklch(96.5% 0.006 255)` | Quiet section separation |
| Surface | `oklch(100% 0 0)` | Product and form surfaces |
| Ink | `oklch(16% 0.015 260)` | Headlines and primary text |
| Ink muted | `oklch(47% 0.018 260)` | Supporting copy |
| Ink faint | `oklch(66% 0.014 260)` | Captions and metadata |
| Rule | `oklch(89% 0.008 255)` | Hairlines and input boundaries |
| Cobalt | `oklch(52% 0.20 258)` | Primary action and active state |
| Cobalt deep | `oklch(40% 0.18 258)` | Hover and high-contrast link state |
| Cobalt soft | `oklch(95% 0.025 258)` | Selected or informational wash |
| Success | `oklch(50% 0.12 160)` | Passing state only |
| Warning | `oklch(58% 0.13 75)` | Waiting/checkpoint state only |
| Error | `oklch(55% 0.18 28)` | Form and failure state only |

No red brand field, chartreuse signal, dark hero, gradient, glass, glow, grain, decorative pattern, or permanent colored section is permitted. Product screenshots may retain their real interface colors.

## 6. Typography, space, and shape

- Display: **Geist**, roman, weights 500–650.
- Body/interface: **IBM Plex Sans**, weights 400–600.
- The hero display scales from 56px on mobile to approximately 104px on wide desktop.
- Body copy is at least 16px and normally stays below 60 characters per line.
- Section spacing varies from 96px to 240px. Major scenes may occupy most of a viewport even when the text is short.
- Wide layouts use a centered maximum canvas with product media wider than prose. Mobile preserves DOM order.
- Controls use 10–14px radii; media surfaces use 18–28px radii. Pills are reserved for true compact actions or status.
- Shadows are soft and rare. Most hierarchy comes from scale and space.

## 7. Motion and interaction

Motion uses Motion for React through lazy features and stays subordinate to comprehension.

1. The hero statement and actions appear once with opacity and no more than 8px of travel.
2. The Sentinel mark draws its single signal path once; it never loops.
3. The primary product surface settles into view once using a subtle scale from 0.985 to 1 and a short opacity transition.
4. Workspace views crossfade with no more than 6px of travel when the visitor changes destination.
5. Feature cards use native momentum scrolling and snap; the detail dialog fades and settles without spring overshoot.
6. Below-the-fold narrative groups reveal once only after they cross a lower viewport gate: the observer excludes the bottom 20% of the viewport and waits for a small visible portion of the group inside the remaining area. This keeps the animation in the visitor's field of attention instead of completing before they reach it. Reveals use varied 12–20px lifts, short lateral movement, or a soft 4px de-focus. Content remains visible in server HTML and when JavaScript is unavailable. Reduced motion removes translation and blur rather than removing content.

Buttons use color and a 1px press, not hover scaling. There is no parallax, custom cursor, marquee, text scrambling, repeating ambient animation, carousel autoplay, or scroll-jacked narrative. Reduced motion removes translation and scale while preserving state changes within 150ms.

## 8. Interactive proof, product media, and walkthrough

- The primary proof is a standalone React demonstration compiled into `marketing/`. It uses immutable local fixtures and local component state; it does not import the product application, establish a session, call an API, set a cookie, or expose a write control.
- The surface is visibly labelled **Interactive preview · Sample data · Read only**. Sample names and counts illustrate structure, not customer adoption or commercial performance.
- Any supporting screenshots come only from sanitized local Sentinel fixture workspaces and must be full-resolution, visually consistent, and reviewed for credentials, customer data, tokens, repository secrets, evidence payloads, and personal information. A screenshot with a mismatched theme or empty black region is a release blocker.
- Walkthrough delivery remains poster-first. The Cloudflare Stream iframe is created only after play, the final video is sanitized 16:9 with WebVTT captions, and the dialog is keyboard-operable and focus-safe.
- The walkthrough poster fills its complete media grid track at every supported width; animation wrappers may not shrink the 16:9 stage.
- If Stream is unavailable, the written Teach → Replay → Decide summary remains the complete fallback.
- The social preview uses the Quiet Flight canvas, short headline, cobalt action accent, and the new Sentinel signal-path mark.

## 9. Identity mark

The old three-bar placeholder is replaced by a simple signal-path mark: three checkpoints joined by one rising route inside a restrained rounded frame. It communicates a taught journey, observable progress, and a controlled finish without using a shield, robot, spark, or generic AI glyph. The same authored SVG geometry is used in the header and favicon. In the site header the mark stands alone at the left edge while the **Sentinel** wordmark is independently centered in the same Geist display family as the landing page.

The feature rail reserves breathing room above its cards so the restrained hover lift never clips a border. A full-viewport scrolling shell contains a max-content card track with equal leading and trailing gutters. At rest, the first card shares the exact centered-canvas left edge used by the feature heading; during scrolling, cards may travel fully to the viewport edge instead of being clipped at that initial inset. At the far end, the last card stops with the same trailing gutter as the first card's leading gutter. The native detail dialog remains explicitly fixed and centered in the top layer at every viewport, with the blurred backdrop, focus containment, Escape dismissal, and focus restoration preserved.

## 10. Form, accessibility, performance, and non-scope

- Every field has a visible label, stable helper/error area, 44px minimum target, immediate focus indicator, and explicit loading/error/success behavior.
- Meet WCAG 2.2 AA for semantics, heading order, control names, announcements, focus, keyboard operation, captions, contrast, 200% zoom, and touch targets.
- Verify 320px, 375px, 414px, 768px, 1280px, and 1440px with no horizontal overflow; `html` and `body` use `overflow-x: clip`.
- Target LCP ≤2.5 seconds, CLS ≤0.1, no Stream player download before interaction, and mobile Lighthouse scores of at least 90 for performance, accessibility, best practices, and SEO.
- No pricing, customer logos, testimonials, fabricated metrics, comparison table, blog, newsletter, public signup, confirmation email, analytics, launch date, guaranteed access, or product-interface redesign is included.
