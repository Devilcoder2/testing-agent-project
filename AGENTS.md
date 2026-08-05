# Project Build Rules for AI Agents

This file is the standing build protocol for this project. Read it before planning, changing, or reviewing project work. Treat the project documents as the source of truth and keep them synchronized with the implementation.

## Core principle

Catch errors at the cheapest stage possible: the document stage, before they become code. Every stage must produce a reviewable artifact, and every artifact must be checked before the next stage builds on it.

Never accept vague claims such as “tested and working.” Show the exact command that was run and its raw output. Prefer evidence over summaries.

## Required project documents

Create and maintain these documents in this order:

1. `problem-brief.md` — who has the problem, what they do today, and why it fails.
2. `srd.md` — requirements, features, use cases, and diagrams where useful.
3. `architecture.md` — high-level system design and major technical choices.
4. `phases.md` — build order and testable acceptance criteria for every phase.
5. `techstack.md` — technologies and versions, confirmed compatible with the architecture.
6. `decisions-log.md` — a running record of every non-obvious decision, why it was made, and the date.
7. `learning-log.md` — the human-readable learning record for every feature built with AI assistance.

Add these only when the project needs them:

- Non-functional requirements for real users, performance, budgets, or reliability.
- Competitive research translated into specific feature checkboxes.
- A risk log for third-party dependencies or factors outside the project’s control.
- A glossary when domain terms could be misinterpreted.

Do not add documentation scope without a reason tied to the project.

## Learning-first vibe coding protocol

Vibe coding is encouraged, but generated code must be treated as a learning opportunity. The goal is not only to ship a working feature; it is for the project owner to understand how the feature works, why it was built that way, and what alternatives were rejected.

### Learning log

Maintain `learning-log.md` as a dedicated, append-only learning record. Add an entry for every completed feature or meaningful technical change before marking its phase complete.

Each entry must explain, in plain language:

- What the feature does and what user problem it solves.
- The complete flow from user action to result, including important data movement and system boundaries.
- Every significant technology, library, pattern, or service used.
- Why each technology or approach was chosen and how it helps the feature.
- Important implementation details a human maintainer needs to understand.
- Tradeoffs taken, including what became simpler and what became harder.
- Alternatives considered and why they were not chosen.
- Known limitations, risks, security concerns, and likely future improvements.
- Links or references to the relevant source files, tests, architecture decisions, and documentation.

Write for a learner who will maintain the project later. Define jargon, use small examples where useful, and do not copy unexplained generated-code summaries into the log.

### Ten-question understanding check

After each vibe-coded feature is built, create a set of exactly 10 technical questions about that feature. Store the questions and the owner’s answers in the same feature entry in `learning-log.md`, or in a clearly linked companion section.

The questions must test genuine understanding, not memorization. Cover the feature’s purpose, end-to-end flow, key files and responsibilities, data structures or API contracts, error and edge-case behavior, security or reliability concerns, testing strategy, major tradeoffs, rejected alternatives, and how the feature could be changed safely.

The agent must:

- Ask the owner to answer the 10 questions before considering the learning review complete.
- Explain any incorrect or incomplete answer and point to the relevant code or documentation.
- Re-test or revisit the feature when an answer reveals a misunderstanding.
- Record unresolved questions as explicit follow-up learning tasks.
- Never treat the feature as fully understood merely because the code runs or the agent generated an explanation.

### Priority-based diff learning review

For every feature or GitHub change, review the diff and group files by the amount of human attention they require. Show the review in priority order:

1. **Highest priority — understand now:** new, security-sensitive, complex, difficult-to-read, or behavior-critical code; unfamiliar abstractions; database migrations; authentication and authorization; external API integrations; concurrency, caching, error handling, and deployment configuration.
2. **Medium priority — understand next:** modified business logic, changed data models, tests that encode important behavior, configuration changes, and files whose impact spans multiple parts of the system.
3. **Lower priority — skim or defer:** generated files, lockfiles, formatting-only changes, snapshots, boilerplate, and simple documentation or asset changes, unless they affect behavior or security.

For each changed file, report:

- Its review priority and why it received that priority.
- What changed in plain language.
- The specific symbols, functions, classes, routes, queries, or configuration that deserve attention.
- Any risk, hidden behavior, or question the owner should investigate.
- Whether the owner should read it now, skim it, or defer it.

Always highlight the highest-priority technical files first. Do not bury difficult code under a file-count summary or treat all changed files as equally important. Use the actual Git diff as evidence.

### Phase completion learning gate

Before marking a phase complete, confirm that:

- `learning-log.md` contains an entry for each feature completed in the phase.
- Each entry explains the technology, flow, alternatives, tradeoffs, and limitations.
- Each feature has exactly 10 technical understanding questions.
- The owner has answered the questions, or unanswered items are explicitly recorded as follow-up tasks.
- The changed-file diff has been reviewed in priority order.
- The highest-priority files and concepts have been explicitly surfaced to the owner.

## Before coding starts

### Problem brief

- Write the problem in plain language: who, what, and why.
- Ask: “What five things about this project are you still assuming rather than confirming?”
- Resolve important assumptions before implementation.

### Requirements / SRD

- For every feature, ask whether it could be built in two different ways. If yes, clarify the requirement.
- Identify missing edge cases and unclear behavior.
- Ask: “List any requirements that conflict with each other or are ambiguous enough to be built differently than intended.”
- Ask: “What is in this document that I never asked for?” Remove or explicitly approve scope creep.

### Architecture

- Justify each major technology and system choice in plain language.
- Compare the choice with a simpler alternative.
- Check that it fits the project’s scale, budget, timeline, and team skill level.
- Ask: “Is this architecture appropriately simple for an MVP with the expected number of users, or are we over-building?”
- Check for commonly missed concerns such as authentication, storage, error handling, rate limits, and security.

### Phases

- Make each phase small enough to build and verify in one sitting.
- Define outcomes as specific, checkable statements, not descriptions.
- Check for hidden dependencies between phases.
- Ask: “Does any later phase depend on something not yet built in an earlier phase?”

Good acceptance criteria are concrete. For example:

- “Signup with a valid email succeeds.”
- “A duplicate email is rejected with a clear error.”
- “Login with a wrong password fails.”
- “The session survives a page refresh.”

### Project readiness gate

Before writing code, confirm that the following exist:

- `problem-brief.md`
- `srd.md`
- `architecture.md`
- `phases.md` with a testable checklist for each phase
- `techstack.md`
- `decisions-log.md` (it may initially be empty)
- A Git repository and `.gitignore`
- `README.md` with setup instructions, even if only a stub

If a required artifact is missing, flag it before coding unless the user explicitly authorizes proceeding.

## Build protocol: repeat for every phase

Before implementation:

- Read the current phase checklist from `phases.md`.
- Re-share or inspect the relevant sections of `architecture.md` and `techstack.md`.
- Check for an `.env.example` when new configuration is required; never add real secrets.
- Ensure tests exist or are planned for the phase’s features.
- Open `decisions-log.md` so deviations can be recorded.

During implementation:

- Follow the current documents rather than relying on conversation memory.
- Keep the implementation within the approved phase scope.
- If a deviation becomes necessary, stop and update the relevant document with the reason, then obtain user approval before building the deviation.
- Run the phase’s tests and relevant checks.
- Report the exact commands and raw outputs.

Before marking a phase complete:

- Run the phase checklist manually or through an explicit verification procedure.
- Review the diff against `architecture.md` and `srd.md`.
- Update `phases.md` with completion status and notes.
- Record deviations and their reasons in `decisions-log.md`.
- Save or paste raw test output, not just “it works.”
- Update `README.md` if setup or run instructions changed.
- Commit the completed work with a clear Git message.

## Drift and independent review

At the start of every phase, re-check the relevant source documents. Do not assume earlier conversation context is still accurate.

Every three to four phases, or whenever a document or feature is important, use a fresh session to perform an adversarial review. Provide the current documents and code and ask:

> Review this as a skeptical outside reviewer. Where does it diverge from good practice or from what was originally intended?

The review should look for scope drift, contradictions, missing edge cases, security gaps, over-engineering, and mismatches between the SRD, architecture, phases, and code.

## Shipping gate

Before shipping:

- Re-run the full build checklist from start to finish.
- Confirm all phase acceptance criteria.
- Review the final diff against the SRD and architecture.
- Confirm the decisions log is current.
- Confirm setup, test, and run instructions in `README.md` are accurate.
- Provide raw verification evidence for the final state.

## Communication standard

When reporting progress or completion:

- State what was actually changed or verified.
- Distinguish facts, assumptions, and unresolved risks.
- Include exact commands and raw output for tests and checks.
- Call out any missing document, ambiguity, deviation, or approval needed.
- Do not claim completion when an acceptance criterion has not been verified.

## GitHub synchronization rule

Keep the project synchronized with GitHub throughout development. After making a change to a project file:

- Review the actual diff and run the relevant checks.
- Stage only the files belonging to that change.
- Create a clear Git commit describing the change.
- Push the commit to the configured GitHub remote immediately.
- Report the commit hash, branch, push result, and any verification output.

Do not leave completed file changes only in the local working tree. If the repository has no GitHub remote yet, initialize the project’s GitHub repository and connect it before continuing. If authentication, network access, repository permissions, or another external condition prevents a commit or push, stop and clearly report the blocker rather than claiming the change was published. Never push secrets, `.env` files, credentials, or unrelated user changes.

For this project’s initial GitHub setup:

- Create a repository using the project name or an approved repository name.
- Keep the repository private unless the owner explicitly chooses public visibility.
- Add the GitHub remote as `origin`.
- Use `main` as the default branch.
- Make the initial commit and push it to GitHub.
- Verify the remote, pushed branch, and resulting GitHub repository URL.
