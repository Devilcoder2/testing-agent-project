# Sentinel Phase 11 Adversarial Review

**Date:** 2026-08-20  
**Method:** Compare the implemented local Docker platform against `problem-brief.md`, `srd.md`, and `architecture.md` as a skeptical internal-pilot reviewer.

## Resolved for the local pilot

| Finding | Resolution | Evidence |
|---|---|---|
| A Product or Test Case owner could become unavailable, blocking configuration or proposal decisions. | Product creators can now independently transfer Product, Test Case, and Release ownership to eligible members; submitted proposals follow a Test Case transfer. | Ownership APIs, confirmation dialog, and focused pilot-hardening test. |
| Evidence storage grew indefinitely in local MinIO. | A worker retention task removes completed-Run evidence and completed diagnostics after 30 days, preserving safe history and retrying failed object deletion later. | Maintenance records, MinIO-first deletion, and retention test. |
| Local services were exposed on all host interfaces despite development-only authentication. | Sentinel, Demo CRM, and noVNC now bind to localhost. | Docker Compose port mappings and README pilot boundary. |
| An apparent healthy API could hide a stopped worker or unavailable dependency. | Dashboard Pilot readiness reports safe health for the local dependencies, worker heartbeat, QA read-only role, retention result, and optional Jira state. | Authenticated readiness API and Dashboard panel. |
| Jira rate limiting could be retried too quickly. | A 429 respects a valid `Retry-After` value once, capped at 60 seconds. | Jira adapter parsing, custom worker backoff, and focused tests. |

## Explicitly deferred risks

| Priority | Risk | Why it is not resolved in Phase 11 | Required before wider deployment |
|---|---|---|---|
| Highest | Seeded local credentials and signed development sessions are not production identity. | The agreed pilot is localhost-only and organization roles are separately planned. | OIDC/SAML or approved identity provider, role matrix, invite/deprovisioning, session controls, and security review. |
| Highest | Docker-local PostgreSQL, Redis, MinIO, and volumes have no backup, disaster recovery, or managed-secret strategy. | A single-machine pilot does not justify production infrastructure. | Managed services, encrypted backups, recovery drills, secret rotation, and monitoring. |
| High | The Demo CRM and QA fixture are controlled examples, not an external QA environment. | External target/network approval remains explicitly out of scope. | Target allowlists, network connectivity model, browser isolation review, per-target credentials, and compliance review. |
| High | Evidence retention is a fixed technical 30-day rule, not a legal/privacy retention policy. | The owner chose a pilot storage boundary only. | Data classification, legal retention requirements, deletion verification, user-facing policy, and production lifecycle rules. |
| Medium | Worker heartbeat proves recent process activity, not end-to-end capacity under real load. | The pilot target is 10 local users and two browser contexts. | Queue monitoring, alerting, load testing, dead-letter policy, and capacity targets. |
| Medium | Optional Jira behavior is mock-tested locally; no real provider credential/runbook is verified. | The owner chose local-only defaults. | Sandbox Jira validation, rate-limit/error drills, least-privilege service account, and incident runbook. |
| Medium | Ownership transfer is available only after another eligible Product membership already exists; the pilot has no membership-administration screen. | Phase 11 deliberately adds controlled transfer, not organization or role management. | Add organization roles, invitations, membership administration, and deprovisioning before treating ownership transfer as a self-service production workflow. |

## Pilot decision

Sentinel is suitable only for a controlled local internal pilot after the Phase 11 automated and manual checklist passes. It is not approved for network exposure, external customer data, or production use. The deferred risks above are release blockers for any wider deployment.
