# Sentinel Clean-Sheet Interface System

**Status:** Approved direction for Phase 16

**Date:** 2026-08-24

**Supersedes:** The Phase 15 dark-only incremental interface direction

## 1. Product atmosphere

Sentinel is a precision QA operations workspace. The interface should feel composed, legible, and trustworthy under pressure: an editorial workbench paired with an instrument panel, not a generic admin template and not a decorative developer tool.

The new frontend starts from a blank visual canvas. Existing data contracts, authorization, workflows, and safety boundaries remain the functional specification, but the previous sidebar, dark-only palette, cards, spacing, visual hierarchy, and decorative treatment are not design inputs.

Three principles govern every screen:

1. **Signal before chrome.** Results, risks, and next actions appear before configuration and secondary metadata.
2. **Calm density.** Hairline structure, deliberate whitespace, and compact rows make complex operational data scannable without feeling crowded.
3. **Visible causality.** Runs, evidence, decisions, and source analysis visually show what happened, why it matters, and what the user can safely do next.

## 2. Visual identity

The identity is called **Signal Canvas**. It combines a warm paper-like light theme, an ink-black dark theme, a vivid cobalt action color, and broad semantic signal bands. A small four-bar Sentinel trace mark represents a journey becoming a verified result.

Avoid gradients on application surfaces, glass effects, floating-card dashboards, neon glows, oversized radii, and ornamental illustration. Use color for actions, status, selection, and diagnostic grouping only.

## 3. Color system

All component colors use semantic tokens. Components never contain theme-specific color literals.

### Light theme — Canvas

| Role | Value | Use |
|---|---:|---|
| Canvas | `#F5F5F0` | Page background |
| Surface | `#FFFFFF` | Primary work surfaces |
| Raised surface | `#FAFAF7` | Toolbars and grouped regions |
| Strong surface | `#EFEFE9` | Selected or emphasized neutral regions |
| Ink | `#171714` | Primary text |
| Muted ink | `#5F5F58` | Supporting text |
| Faint ink | `#86867D` | Metadata |
| Hairline | `#DEDED6` | Default structure |
| Strong border | `#C7C7BD` | Interactive boundaries |
| Cobalt | `#3157D5` | Primary action and selected navigation |
| Cobalt hover | `#2545B5` | Primary hover |
| Cobalt soft | `#E9EDFF` | Selection and informational wash |
| Teal | `#087F6C` | Passing and healthy |
| Amber | `#A45B08` | Waiting and caution |
| Coral | `#C63F46` | Failure and destructive action |
| Violet | `#7650C7` | Review and proposals |

### Dark theme — Ink

| Role | Value | Use |
|---|---:|---|
| Canvas | `#11110F` | Page background |
| Surface | `#181816` | Primary work surfaces |
| Raised surface | `#1F1F1C` | Toolbars and grouped regions |
| Strong surface | `#292925` | Selected or emphasized neutral regions |
| Ink | `#F3F3ED` | Primary text |
| Muted ink | `#B6B6AD` | Supporting text |
| Faint ink | `#88887F` | Metadata |
| Hairline | `#34342F` | Default structure |
| Strong border | `#4A4A43` | Interactive boundaries |
| Cobalt | `#7892FF` | Primary action and selected navigation |
| Cobalt hover | `#98AAFF` | Primary hover |
| Cobalt soft | `#242D52` | Selection and informational wash |
| Teal | `#55C8B2` | Passing and healthy |
| Amber | `#E7A34B` | Waiting and caution |
| Coral | `#F07A7F` | Failure and destructive action |
| Violet | `#B49AF2` | Review and proposals |

The default follows the operating-system preference. A header control switches themes explicitly, saves the choice locally, and announces the new state. Both themes are first-class and must pass the same visual and accessibility checks.

## 4. Typography

Use local system fonts only; do not add a network dependency.

- Interface: `Inter` when available, then the system sans stack.
- Operational data: the local system monospace stack for SHAs, selectors, URLs, identifiers, durations, and evidence payloads only.
- Display title: 40/44 at wide desktop, 32/37 on tablet, 28/33 on mobile; weight 620; tracking `-0.035em`.
- Page title: 30/36 desktop and 26/32 mobile; weight 620; tracking `-0.025em`.
- Section title: 18/25; weight 620.
- Body: 15/23; weight 420.
- Supporting text: 13/19; weight 450.
- Label: 12/16; weight 650; sentence case. Uppercase is reserved for compact state or chronology markers.
- Numeric metrics use tabular numerals.

## 5. Spacing, shape, and elevation

- Base grid: 4px.
- Common spacing: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Control radius: 6px.
- Panel radius: 10px.
- Dialog radius: 14px.
- Pills: fully rounded only for status, filters, and avatars.
- Most hierarchy comes from spacing, fill, and 1px hairlines.
- Shadow is reserved for menus, dialogs, and sticky action bars. Normal cards and rows are flat.
- Touch targets are at least 44px; dense pointer rows may look compact while retaining a 44px action target.

## 6. Global layout and navigation

### Desktop

The prior persistent sidebar is replaced with a two-level top workspace system.

1. A 64px **command masthead** contains the Sentinel identity, global search, current workspace context, theme control, notification access, New recording action, and account menu.
2. A 44px **section navigator** groups routes by intent:
   - Overview: Dashboard
   - Build: Products, Test Cases, Test Data
   - Operate: Runs, Releases
   - Decide: Review, Notifications
   - Manage: Administration when authorized
3. Main content uses a 1440px maximum canvas with 32–48px horizontal gutters.
4. A page heading may use a two-column composition: narrative/context on the left, decisive action on the right.
5. Dense detail screens may introduce a sticky local index below the section navigator; global navigation never becomes a third permanent column.

### Global command search

- The search field sits at the visual center of the masthead and may expand toward available horizontal space without displacing the primary New recording action.
- Its default prompt is “Search workspace”; a compact `⌘K`/`Ctrl K` hint teaches keyboard access without becoming required instruction.
- Results open in a flat, hairline-bounded command panel below the field. Groups use the same section labels as navigation, with the current route's group first and a maximum of five rows per group.
- Each result shows a section icon, safe title, concise context, and destination cue. Highlighting uses the cobalt soft surface plus a left trace, not elevation.
- Loading, no matches, and safe failure appear inside the same panel and are announced politely. Escape closes the panel; Arrow keys and Enter operate the active row.
- At tablet and mobile widths, search moves to a full-width row below the masthead identity/actions. Its result panel remains viewport-bounded and touch rows retain 44px targets.

### Tablet and mobile

- Below 1024px, the section navigator becomes a single Menu control opening a full-height navigation sheet.
- Below 768px, page gutters reduce to 20px, actions wrap below headings, and metric grids become two columns then one.
- Inventory rows become labelled blocks with their primary action visible and secondary actions in an overflow disclosure.
- Modal dialogs become bottom sheets below 640px, except safety confirmations which remain centered and concise.
- Recording and live Guided Run keep their existing desktop-only functional boundary below 1024px and show a clear explanation instead of a broken workspace.

## 7. Component language

### Buttons

- Primary: cobalt fill with white text in light theme and near-black text only where contrast remains AA in dark theme.
- Secondary: surface fill, strong hairline, ink text.
- Quiet: no border until hover; used for low-risk navigation and dismissal.
- Danger: coral text/border by default, coral fill only in final confirmations.
- Each region has one visually dominant action.

### Forms

- Labels sit above controls; instructions and errors sit below.
- Inputs use surface fill and a strong 1px boundary; focus uses a 2px cobalt outline plus offset.
- Related inputs live in clearly titled field groups instead of nested cards.
- Validation is inline, announced, and preserves entered values.
- Checkbox/radio rows expose the entire label as the hit target.

### Data and status

- Inventory uses bordered rows or semantic tables, not a grid of floating cards.
- Status badges include a shape marker and text; color is never the only cue.
- Metrics pair a value with a plain-language definition and optional trend.
- Run progress is a vertical trace with explicit transitions between queued, active, checkpoint, passed, failed, and interrupted states.
- Evidence uses tabs plus concise parsed summaries, with raw data behind a disclosure.

### Feedback

- Empty states explain why the area is empty and offer one relevant next action.
- Loading uses low-motion skeleton bands matching the destination structure.
- Inline errors stay near the failed action. Page-level service problems use a bounded status banner.
- Destructive and ownership actions use accessible confirmation dialogs with consequence text.

## 8. Screen compositions

- **Authentication:** split editorial entry canvas on large screens and a single-column form on mobile; theme switch remains available before sign-in.
- **Dashboard:** a top “attention rail,” compact health ledger, result trend, latest activity, and collapsed environment readiness. Health overview rows share fixed Product, Tests, pass-rate, and latest-status tracks on desktop; long Product names truncate within their track instead of shifting later columns.
- **Products:** product ledger with test coverage, source/integration state, and a focused configuration drawer.
- **Test Cases:** search-led inventory with Product filter, version/owner context, and direct Run affordances.
- **Test Case Detail:** an immutable journey header followed by local tabs for Journey, Variables, Versions, and Repository routing.
- **Test Data:** lifecycle ledger that emphasizes safe/reserved/consumed state without revealing values.
- **Runs:** operational queue with mode/outcome filters; Run Detail uses a trace-first layout and evidence workspace.
- **Releases:** readiness ledger; Release Detail separates current composition from immutable batch history.
- **Notifications:** chronological inbox with unread markers and protected context links.
- **Review:** Suggestions and Change proposals remain distinct modes; before/after baseline content uses a two-column comparison.
- **Administration:** member directory and explicit editor sheet, with roles, account state, and Product access visible at a glance.
- **GitHub/source analysis:** repository connections appear as a Product-scoped integration ledger; a failed Run shows a bounded advisory analysis panel with commit context, confidence, observations, hypotheses, remediation, safe patch fragment, references, and limitations.
- **Recording Workspace:** a standalone instrument view with a slim session header, collapsible timeline rail, and dominant browser stage. It does not inherit the global masthead. The expanded timeline header keeps its title, non-wrapping step count, and circular left-facing collapse chevron in one horizontal row. The 4rem restore rail uses the matching right-facing chevron; both controls retain accessible names and tooltips, and the rail has no rotated text or count badge. A full-screen control hides the session header and rail so the browser stage owns the full viewport. A persistent minimize control restores the prior rail state; this is Sentinel layout mode, not browser-native full screen.

## 9. Motion and interaction

- Control feedback: 100ms.
- Navigation and tabs: 160ms.
- Menus and sheets: 200ms.
- Dialogs: 220ms.
- Use opacity, border color, and transforms no larger than 6px. Never animate layout dimensions for content-heavy regions.
- Page changes use a brief content fade; lists do not cascade item animations.
- Loading bands move only when reduced motion is not requested.
- `prefers-reduced-motion: reduce` removes translation and repeating animations while preserving state feedback.

## 10. Accessibility

- Target WCAG 2.2 AA in both themes at 100% and 200% zoom.
- Preserve semantic landmarks, heading order, list/table meaning, labelled form controls, and live status regions.
- Provide a keyboard-visible skip link and focus treatment on every interactive element.
- Dialogs trap focus, support Escape where safe, and restore focus.
- Navigation exposes the active route with `aria-current`; theme state and mobile navigation state are announced.
- Charts include text summaries; status and trend meaning never rely on hue alone.
- Respect reduced motion, contrast preferences where practical, and system theme preference.

## 11. Do and do not

### Do

- Lead with the user’s decision, failure, or next action.
- Use broad semantic bands to group related diagnostic information.
- Keep identifiers and raw evidence visually secondary but easy to reach.
- Preserve consistent placement for filters, feedback, and page actions.
- Test every screen in light, dark, narrow, keyboard-only, and reduced-motion conditions.

### Do not

- Reintroduce the Phase 15 sidebar or dark-only operations aesthetic.
- Use floating glass panels, gradients, glow, decorative blur, or generic dashboard card walls.
- Hide important state behind hover, color, or an unlabeled icon.
- change business rules, API contracts, authorization, redaction, or evidence boundaries as part of visual work.
- Add a UI library, font package, icon package, or animation dependency without a documented need.
