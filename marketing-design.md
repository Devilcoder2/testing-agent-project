# Sentinel Quiet Flight Marketing System

**Status:** Approved Phase 26 replacement direction

**Date:** 2026-08-31

**Applies to:** The separately deployed public marketing application only

## 1. Experience objective

The landing page must help startup QA and engineering leads understand Sentinel in seconds: teach a real browser journey once, replay it inside explicit boundaries, and review the evidence before a person makes the release call. The page must feel calm, confident, and product-led rather than loud, editorial, or densely explanatory.

The central visual idea is **Quiet Flight**: a spacious product presentation with the composure of a modern hardware launch and the discipline of a pre-release checklist. The product interface carries the proof. Copy, color, and motion step back.

The primary visitor path is:

1. Understand the promise from one short statement.
2. See the real Sentinel interface before feature detail.
3. Follow a simple Teach → Replay → Decide story.
4. Understand where Sentinel stops and human judgment begins.
5. Watch the walkthrough or submit a short private-pilot application.

## 2. Reference-derived design DNA

The direction synthesizes public references without copying their pixels, brand assets, proprietary media, or exact compositions.

- Apple Mac contributes generous negative space, large confident type, one idea per visual beat, and product imagery as the primary evidence.
- Google Antigravity contributes a centered first-view statement with minimal supporting copy and a clear pair of actions.
- Codex contributes an immersive product reveal and the confidence to let one visual field own a viewport.
- PayPal and PhonePe contribute immediate action clarity and a recognizable product demonstration directly beneath the promise.
- Reflect contributes early real-product proof, but not its dense dark styling, orange accent, geometric decoration, or logo wall.

The resulting system is deliberately quieter than every previous Sentinel marketing direction. It uses the references as a shared rhythm and hierarchy, not as a template.

## 3. Structural system

The page uses a **Product Cinema** macrostructure with varied pacing and one dominant idea per section.

- A quiet header contains the Sentinel identity, Product, How it works, Safety, Sign in, and one Join the pilot action. It is transparent at the top and gains a subtle solid boundary only after scroll.
- The hero uses one headline, one supporting sentence, and two actions. It contains no eyebrow, section number, decorative label, proof strip, metric, testimonial, or logo row.
- A large real Sentinel capture enters directly below the hero copy. It is presented as the product itself, with no fake browser bar and no dense annotation frame.
- The page alternates between expansive white space and focused product moments. Every major section answers one question rather than grouping unrelated claims.
- Teach, Replay, and Decide are sequential full-width scenes. Each uses one concise statement and one real sanitized screenshot.
- Safety is a quiet interruption: one large statement, a short explanation, and five compact human-control rules.
- The pilot form is an open sign-off area, not a floating card. The FAQ remains native disclosure rows and the footer stays small.

## 4. Content hierarchy

### First viewport

- Wordmark: **Sentinel**
- Display: **Know before you ship.**
- Supporting copy: **Teach Sentinel a browser journey once. It replays it safely and returns the evidence for a human release decision.**
- Primary action: **Join the pilot**
- Secondary action: **Watch the walkthrough**
- Product proof: one sanitized real Sentinel workspace capture. No invented metrics, customers, browser chrome, decorative AI art, or availability claim.

### Product story

1. **Teach it once.** Record the browser journey beside a plain-English step log.
2. **Replay with boundaries.** Use guided or autonomous Runs, reusable data, and explicit checkpoints.
3. **See what happened.** Review screenshots, network, console, and storage evidence on one timeline.
4. **Keep the call human.** Use readiness and owner approval without delegating the release decision to automation.

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
2. The primary product surface settles into view once using a subtle scale from 0.985 to 1 and a short opacity transition.
3. Product-story media crossfades only when the visitor changes the selected scene or reaches the next scene.

Buttons use color and a 1px press, not hover scaling. There is no parallax, custom cursor, marquee, text scrambling, repeating ambient animation, carousel autoplay, or scroll-jacked narrative. Reduced motion removes translation and scale while preserving state changes within 150ms.

## 8. Product media and walkthrough

- Screenshots come only from sanitized local Sentinel fixture workspaces and are reviewed for credentials, customer data, tokens, repository secrets, evidence payloads, and personal information.
- The hero uses the clearest real Sentinel screenshot as an eager, dimensioned LCP image without fake browser chrome.
- Product media uses generous surrounding space and a single subtle surface treatment. Annotations are short and attached to real evidence.
- Walkthrough delivery remains poster-first. The Cloudflare Stream iframe is created only after play, the final video is sanitized 16:9 with WebVTT captions, and the dialog is keyboard-operable and focus-safe.
- If Stream is unavailable, the written Teach → Replay → Decide summary remains the complete fallback.
- The social preview uses the Quiet Flight canvas, short headline, cobalt action accent, and one safe real Sentinel crop.

## 9. Form, accessibility, performance, and non-scope

- Every field has a visible label, stable helper/error area, 44px minimum target, immediate focus indicator, and explicit loading/error/success behavior.
- Meet WCAG 2.2 AA for semantics, heading order, control names, announcements, focus, keyboard operation, captions, contrast, 200% zoom, and touch targets.
- Verify 320px, 375px, 414px, 768px, 1280px, and 1440px with no horizontal overflow; `html` and `body` use `overflow-x: clip`.
- Target LCP ≤2.5 seconds, CLS ≤0.1, no Stream player download before interaction, and mobile Lighthouse scores of at least 90 for performance, accessibility, best practices, and SEO.
- No pricing, customer logos, testimonials, fabricated metrics, comparison table, blog, newsletter, public signup, confirmation email, analytics, launch date, guaranteed access, or product-interface redesign is included.
