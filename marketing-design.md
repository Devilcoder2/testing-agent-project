# Sentinel Editorial Signal Marketing System

**Status:** Approved Phase 26 direction  
**Date:** 2026-08-30  
**Applies to:** The separately deployed public marketing application only

## 1. Experience objective

The landing page must persuade a global startup QA or engineering lead that Sentinel can turn team-owned browser knowledge into trustworthy release signals. It should feel commissioned and product-specific: concise editorial pacing, strong rules and numbering, sanitized real interface proof, one controlled accent, and motion that explains sequence rather than decorating empty space.

The primary visitor path is:

1. Understand the promise in the first viewport.
2. Watch a real product walkthrough or continue into the three-step story.
3. Inspect concrete recording, replay, evidence, and human-control proof.
4. Submit a short application to join the private-pilot waitlist.

## 2. Final content hierarchy

### Header

- Sentinel trace mark and wordmark link to the top.
- Anchor links: Product, How it works, Evidence, Pilot.
- External text link: Sign in.
- Primary action: Join the pilot waitlist.
- Desktop header is sticky and flat with a paper-colored background and one hairline. Mobile uses an accessible disclosure, not a horizontally scrolling link row.

### Hero

- Eyebrow: **QA automation with human judgment**
- Display: **Teach the test once. Trust every release.**
- Supporting copy: **Sentinel turns the browser journeys your team already knows into repeatable runs, complete evidence, and clear release decisions.**
- Primary action: **Join the pilot waitlist**; scrolls to and focuses the pilot section without forcing a modal.
- Secondary action: **Watch the product tour**; opens the walkthrough dialog and returns focus when closed.
- Media stage uses the real sanitized Sentinel interface inside an ink frame, with a static poster and a clear play control. It must not resemble a fabricated browser or generic dashboard illustration.

### Narrative sections

1. **Release week shouldn’t mean replaying the same browser journeys by hand.** Two short supporting paragraphs explain lost QA time and missing evidence without a statistic.
2. **Teach → Replay → Decide.** Three numbered states share one horizontal/vertical trace and no card-wall layout.
3. **Product proof.** Four alternating editorial stories: live recording and Step Log; guided/auto Runs and Test Data; timeline evidence; release readiness and controlled integrations.
4. **Autonomy with a stop button.** Checkpoints, safe uncertainty stops, redaction, immutable history, and owner approval appear as one dark trust band with terse signal rows.
5. **Pilot application.** The qualification form and expectation copy sit side by side at wide viewports and stack on smaller screens.
6. **FAQ.** Native disclosure rows cover audience, tester role, web-only scope, evidence, and pilot selection.

### Footer

Include Sentinel, product sign-in, Privacy, the configured public contact, and “Private pilot — access by invitation.” Do not include pricing, blog, newsletter, social counters, customer logos, testimonials, comparisons, or general signup.

## 3. Visual tokens

| Token | Value | Use |
|---|---:|---|
| Paper | `#F4F0E8` | Page canvas |
| Paper deep | `#E8E0D4` | Alternating narrative bands |
| Surface | `#FFFDF8` | Form and media surfaces |
| Ink | `#15120F` | Primary text and dominant actions |
| Ink muted | `#625B52` | Supporting copy |
| Hairline | `#D4CABD` | Rules and control boundaries |
| Vermilion | `#B63A22` | Accent, active trace, and signal labels |
| Vermilion soft | `#F4D9D0` | Error/attention wash |
| Sage | `#2E604C` | Safe/passing signal |
| Sage soft | `#DDE9E1` | Safe status wash |
| Focus | `#1559C5` | Keyboard focus only |

Ink on Paper and Surface is the default reading pair. White text on Vermilion is permitted for compact controls because it exceeds AA contrast. Vermilion text is used on Surface/Paper, never on Ink for body-sized copy. The landing page has one light theme; the dark trust band is a section, not a theme switch.

## 4. Typography, grid, and shape

- Display/editorial: self-hosted Source Serif 4 variable, 68/70 wide, 52/55 tablet, 42/45 mobile; weight 520; tracking `-0.035em`.
- Interface/body: self-hosted Source Sans 3 variable; body 18/28, supporting 15/23, label 12/16 at weight 680.
- Monospace is reserved for short product state labels and evidence identifiers, using the system stack.
- Content width: 1440px maximum. Desktop gutters 40–64px, tablet 32px, mobile 20px.
- Use a 12-column wide grid with intentionally unequal hero and story tracks. Section padding is 96–144px wide and 72–88px narrow.
- Controls use 4–8px radii; media and form panels use at most 12px. Status capsules may be fully rounded. Normal sections are flat and shadowless.
- Decorative geometry is limited to hairline rules, the four-bar Sentinel trace, section numbers, and one animated signal line built with CSS/SVG.

## 5. Motion and interaction

- Use Motion 13.1.1 through lazy features.
- The hero trace draws once after the main content is visible; it does not loop.
- Viewport reveals use opacity plus no more than 8px vertical movement over 320–480ms.
- The three-step signal changes active label, line length, and supporting text without moving surrounding layout.
- Product-proof frames crossfade and shift no more than 6px. The visitor can read all proof with JavaScript or motion disabled.
- Buttons use 120–160ms fill/border feedback. Dialog entry/exit is 180–220ms.
- `prefers-reduced-motion: reduce` removes translation, trace drawing, and scroll-linked transitions; content renders immediately and state changes remain visible.
- No autoplay audio, looping marquee, parallax, cursor following, magnetic buttons, scroll hijacking, staggered text fragments, or decorative loading sequence.

## 6. Product media and walkthrough

- Product screenshots must come from local development fixture accounts and must be reviewed for credentials, real customer data, tokens, evidence payloads, repository secrets, and personal contact information before use.
- Capture consistent 16:10 frames for recording, Run evidence, and release/review proof. Use CSS cropping only at predefined art direction breakpoints; never compress important text until it becomes decorative noise.
- Walkthrough contract: sanitized 16:9 source, custom 1600×900 poster, WebVTT captions, approved title/description, and Cloudflare Stream video ID. The page creates the Stream iframe only after play and removes it on close.
- If Stream is unavailable or no ID is configured, the poster remains and the dialog presents the written Teach → Replay → Decide summary. Missing media never hides the page's product explanation.
- The social preview is one branded landscape composition using the exact hero headline, paper/ink/vermilion palette, trace mark, and concise pilot label. It contains no credentials, customer data, fake UI, metric, or testimonial.

## 7. Form and feedback behavior

- Fields: Name, Work email, Company, and QA team size. Labels are always visible; placeholder text is an example, not the label.
- Team-size options are `1`, `2–5`, `6–15`, and `16+`.
- A hidden company-website honeypot remains empty in normal use. Turnstile is visually contained but not hidden from accessibility APIs.
- Submit label: **Join the pilot waitlist**. During submission: **Sending application…**.
- Invalid fields retain all other values and move focus to the first error after a summary announcement.
- Network, rate-limit, or challenge failure keeps the form open and provides a safe retry message. Expired or used Turnstile tokens reset the challenge.
- Success replaces the form with: **You’re on the pilot list. We review every application and will contact selected teams personally.** It does not promise timing or send an email.

## 8. Accessibility and performance acceptance

- Meet WCAG 2.2 AA for semantic landmarks, heading order, control names, form relationships, error announcements, dialog focus, skip link, visible focus, contrast, keyboard operation, 200% zoom, and touch targets.
- Captions are available before public video launch. All meaningful visual proof has concise alternative text and adjacent copy.
- The DOM order remains logical when the visual grid alternates media and text.
- Initial page rendering includes no Stream iframe. Font files are self-hosted and subset where practical. The poster is responsive and encoded as AVIF/WebP with a reliable fallback.
- Target LCP ≤2.5 seconds, CLS ≤0.1, no horizontal overflow from 320px upward, and mobile Lighthouse scores of at least 90 for performance, accessibility, best practices, and SEO.
