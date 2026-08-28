"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { Button, Card, Dialog, EmptyState, Feedback, Field, PageHeader, SelectInput, StatusBadge, TextArea, TextInput } from "./ui";

type Product = { id: string; name: string };
type SuggestionStatus = "DRAFT" | "APPROVED" | "DISMISSED";
type Suggestion = {
  id: string;
  kind: string;
  status: SuggestionStatus;
  title: string;
  rationale: string;
  expectedOutcome: string;
  proposedValue: string;
  product: Product;
  sourceTestCase: { id: string; name: string };
  sourceVersion: { id: string; version: number };
  sourceStep: { id: string; order: number; kind: string };
  approvedTestCase: { id: string; name: string } | null;
};
type ChangeProposal = {
  id: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "STALE";
  context: string;
  decisionNote: string | null;
  appliedVersion: number | null;
  canDecide: boolean;
  testCase: { name: string };
  run: { id: string };
  sourceVersion: { version: number; steps: Array<{ id: string; order: number; description: string | null; expectedOutcome: string | null }> };
  createdBy: { displayName: string };
  owner: { displayName: string };
  changes: Array<{ sourceStepId: string; order: number; proposedDescription: string | null; proposedExpectedOutcome: string | null }>;
};

async function request(path: string, method = "GET", body?: unknown) {
  return apiRequest(path, { method, body });
}

function statusTone(status: SuggestionStatus) {
  return status === "APPROVED" ? "success" as const : status === "DISMISSED" ? "neutral" as const : "warning" as const;
}

function ruleLabel(kind: string) {
  return kind.replaceAll("_", " ").toLowerCase();
}

export function ReviewView() {
  const searchParams = useSearchParams();
  const requestedQueue = searchParams.get("queue") === "changes" ? "changes" : "suggestions";
  const [products, setProducts] = useState<Product[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [productId, setProductId] = useState("");
  const [status, setStatus] = useState<"ALL" | SuggestionStatus>("ALL");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Suggestion | null>(null);
  const [queue, setQueue] = useState<"suggestions" | "changes">(requestedQueue);
  const [pendingAction, setPendingAction] = useState<{ suggestion: Suggestion; action: "approve" | "dismiss" } | null>(null);

  const sourceTestCaseId = searchParams.get("testCaseId") ?? "";
  async function load() {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (productId) query.set("productId", productId);
      if (status !== "ALL") query.set("status", status);
      if (sourceTestCaseId) query.set("testCaseId", sourceTestCaseId);
      const [nextProducts, nextSuggestions] = await Promise.all([
        request("products") as Promise<Product[]>,
        request(`suggestions${query.size ? `?${query}` : ""}`) as Promise<Suggestion[]>
      ]);
      setProducts(nextProducts);
      setSuggestions(nextSuggestions);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load the Review queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [productId, sourceTestCaseId, status]);
  useEffect(() => { setQueue(requestedQueue); }, [requestedQueue]);

  async function changeState(suggestion: Suggestion, action: "approve" | "dismiss" | "reopen") {
    setWorkingId(suggestion.id);
    setMessage("");
    try {
      const result = await request(`suggestions/${suggestion.id}/${action}`, "POST") as { testCase?: { name: string } };
      setMessage(action === "approve" ? `Suggestion approved. ${result.testCase?.name ?? "A new Test Case"} is ready for review.` : action === "dismiss" ? "Suggestion dismissed. It remains available in history." : "Suggestion reopened as a Draft.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update the suggestion.");
    } finally {
      setWorkingId(null);
    }
  }

  return <div className="dashboard-grid">
    <PageHeader eyebrow="Human decision queue" title="Review" detail={queue === "suggestions" ? sourceTestCaseId ? "Suggestions for the selected Test Case. These drafts never run or change a baseline until approval." : "Review deterministic negative-Test drafts before they become independent Test Cases." : "Compare proposed baseline annotations against their immutable source before making a decision."} actions={<div className="review-tabs" role="tablist" aria-label="Review queue"><Button role="tab" aria-selected={queue === "suggestions"} variant={queue === "suggestions" ? "primary" : "secondary"} onClick={() => setQueue("suggestions")}>Suggestions</Button><Button role="tab" aria-selected={queue === "changes"} variant={queue === "changes" ? "primary" : "secondary"} onClick={() => setQueue("changes")}>Change proposals</Button></div>} />
    {message && <Feedback tone={message.startsWith("Suggestion approved") || message.startsWith("Suggestion dismissed") || message.startsWith("Suggestion reopened") ? "success" : "danger"}>{message}</Feedback>}
    {queue === "suggestions" ? <Card className="panel-card"><div className="panel-card__head"><div><p className="eyebrow">Negative coverage</p><h2>Suggestions</h2><p>Drafts remain independent from Runs and source baselines until approval.</p></div><StatusBadge tone="info">{suggestions.length} visible</StatusBadge></div><div className="inventory-toolbar"><Field label="Filter by Product"><SelectInput value={productId} onChange={(event) => setProductId(event.target.value)} disabled={loading}><option value="">All accessible Products</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput></Field><Field label="Filter by review state"><SelectInput value={status} onChange={(event) => setStatus(event.target.value as "ALL" | SuggestionStatus)}><option value="ALL">All states</option><option value="DRAFT">Draft</option><option value="APPROVED">Approved</option><option value="DISMISSED">Dismissed</option></SelectInput></Field></div>{loading ? <StatusBadge tone="info">Loading Review queue</StatusBadge> : suggestions.length === 0 ? <EmptyState title="No suggestions found" detail={sourceTestCaseId ? "Generate suggestions from this Test Case when its current version contains supported validation metadata." : "Generate suggestions from a saved Test Case to create reviewable negative-Test drafts."} /> : <div className="review-list">{suggestions.map((suggestion) => <article className="review-item" key={suggestion.id}><div className="review-item__main"><div className="review-item__head"><h2>{suggestion.title}</h2><StatusBadge tone={statusTone(suggestion.status)}>{suggestion.status.toLowerCase()}</StatusBadge></div><p className="review-item__meta">{suggestion.product.name} · <Link href={`/test-cases/${suggestion.sourceTestCase.id}`}>{suggestion.sourceTestCase.name}</Link> · Version {suggestion.sourceVersion.version} · Step {suggestion.sourceStep.order}</p><p><strong>Rule:</strong> {ruleLabel(suggestion.kind)}</p><p><strong>Proposed safe value:</strong> {suggestion.proposedValue ? <code>{suggestion.proposedValue}</code> : "Leave blank"}</p><p><strong>Why:</strong> {suggestion.rationale}</p><p><strong>Expected:</strong> {suggestion.expectedOutcome}</p>{suggestion.approvedTestCase && <p><Link href={`/test-cases/${suggestion.approvedTestCase.id}`}>Open approved Test Case <span aria-hidden="true">→</span></Link></p>}</div><div className="review-item__actions">{suggestion.status === "DRAFT" && <><Button variant="secondary" onClick={() => setEditing(suggestion)} disabled={workingId === suggestion.id}>Edit draft</Button><Button onClick={() => setPendingAction({ suggestion, action: "approve" })} disabled={workingId === suggestion.id}>{workingId === suggestion.id ? "Working…" : "Approve"}</Button><Button variant="danger" onClick={() => setPendingAction({ suggestion, action: "dismiss" })} disabled={workingId === suggestion.id}>Dismiss</Button></>}{suggestion.status === "DISMISSED" && <Button variant="secondary" onClick={() => void changeState(suggestion, "reopen")} disabled={workingId === suggestion.id}>{workingId === suggestion.id ? "Working…" : "Reopen"}</Button>}</div></article>)}</div>}</Card> : <ChangeProposalQueue />}
    {editing && <SuggestionEditDialog suggestion={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); setMessage("Suggestion draft updated."); await load(); }} />}
    {pendingAction && <Dialog eyebrow="Confirm review decision" title={`${pendingAction.action === "approve" ? "Approve" : "Dismiss"} ${pendingAction.suggestion.title}?`} detail={pendingAction.action === "approve" ? "Approval creates a separate Version 1 Test Case. It does not run or change the source baseline." : "The suggestion remains in history and can be reopened later."} onClose={() => setPendingAction(null)} actions={<><Button variant="ghost" onClick={() => setPendingAction(null)}>Cancel</Button><Button variant={pendingAction.action === "dismiss" ? "danger" : "primary"} onClick={() => { const pending = pendingAction; setPendingAction(null); void changeState(pending.suggestion, pending.action); }}>{pendingAction.action === "approve" ? "Approve suggestion" : "Dismiss suggestion"}</Button></>} />}
  </div>;
}

function ChangeProposalQueue() {
  const [proposals, setProposals] = useState<ChangeProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ proposal: ChangeProposal; action: "approve" | "reject" } | null>(null);
  const [note, setNote] = useState("");
  async function load() { setLoading(true); try { setProposals(await request("change-proposals") as ChangeProposal[]); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load change proposals."); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  async function decide(proposal: ChangeProposal, action: "approve" | "reject", decisionNote: string) {
    setWorkingId(proposal.id); setMessage("");
    try { await request(`change-proposals/${proposal.id}/${action}`, "POST", { note: decisionNote }); setMessage(`Proposal ${action === "approve" ? "approved and saved as a new Test Case version" : "rejected; a Jira draft was prepared when this Product has a Jira mapping"}.`); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not decide this proposal."); } finally { setWorkingId(null); }
  }
  return <Card className="panel-card"><div className="panel-card__head"><div><p className="eyebrow">Baseline changes</p><h2>Change proposals</h2><p>Failed Runs can propose only descriptions and expected outcomes after a known QA deployment. The source baseline remains immutable until an authorized reviewer approves.</p></div><StatusBadge tone="info">{proposals.length} visible</StatusBadge></div>{message && <Feedback tone={message.startsWith("Proposal") ? "success" : "danger"}>{message}</Feedback>}{loading ? <StatusBadge tone="info">Loading change proposals</StatusBadge> : proposals.length === 0 ? <EmptyState title="No change proposals" detail="Create one from a completed failed Run only when a known QA deployment intentionally changed its behavior." /> : <div className="review-list">{proposals.map((proposal) => <article className="review-item" key={proposal.id}><div className="review-item__main"><div className="review-item__head"><h2>{proposal.testCase.name}</h2><StatusBadge tone={proposal.status === "APPROVED" ? "success" : proposal.status === "REJECTED" || proposal.status === "STALE" ? "danger" : "warning"}>{proposal.status.toLowerCase()}</StatusBadge></div><p className="review-item__meta">Failed Run <Link href={`/runs/${proposal.run.id}`}>evidence</Link> · Source version {proposal.sourceVersion.version} · Submitted by {proposal.createdBy.displayName} · Owner {proposal.owner.displayName}</p><p><strong>Deployment context:</strong> {proposal.context}</p>{proposal.changes.map((change) => { const source = proposal.sourceVersion.steps.find((step) => step.id === change.sourceStepId); return <div className="review-item__proposal" key={change.sourceStepId}><p><strong>Step {change.order}</strong></p><div className="proposal-diff"><div><small>Before</small><p>{source?.description ?? "No description"}</p><p>{source?.expectedOutcome ?? "No expected outcome"}</p></div><div><small>Proposed</small><p>{change.proposedDescription ?? "No description"}</p><p>{change.proposedExpectedOutcome ?? "No expected outcome"}</p></div></div></div>; })}{proposal.decisionNote && <p><strong>Decision note:</strong> {proposal.decisionNote}</p>}{proposal.appliedVersion && <p><strong>Applied baseline:</strong> Version {proposal.appliedVersion}</p>}</div><div className="review-item__actions">{proposal.canDecide && proposal.status === "SUBMITTED" && <><Button onClick={() => { setNote(""); setDecision({ proposal, action: "approve" }); }} disabled={workingId === proposal.id}>{workingId === proposal.id ? "Working…" : "Approve change"}</Button><Button variant="danger" onClick={() => { setNote(""); setDecision({ proposal, action: "reject" }); }} disabled={workingId === proposal.id}>Reject change</Button></>}</div></article>)}</div>}{decision && <Dialog eyebrow="Baseline decision" title={`${decision.action === "approve" ? "Approve" : "Reject"} ${decision.proposal.testCase.name}?`} detail={decision.action === "approve" ? "Approval creates the next immutable Test Case version. The failed Run and source version remain unchanged." : "Rejection preserves the proposal and may prepare a Jira draft when the Product is mapped."} onClose={() => setDecision(null)}><Field label="Decision note" hint="Optional; stored with the review decision."><TextArea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} /></Field><div className="modal__actions"><Button variant="ghost" onClick={() => setDecision(null)}>Cancel</Button><Button variant={decision.action === "reject" ? "danger" : "primary"} onClick={() => { const pending = decision; setDecision(null); void decide(pending.proposal, pending.action, note); }}>{decision.action === "approve" ? "Approve change" : "Reject change"}</Button></div></Dialog>}</Card>;
}

function SuggestionEditDialog({ suggestion, onClose, onSaved }: { suggestion: Suggestion; onClose: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState(suggestion.title);
  const [rationale, setRationale] = useState(suggestion.rationale);
  const [proposedValue, setProposedValue] = useState(suggestion.proposedValue);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const missingRequired = suggestion.kind === "REQUIRED_MISSING";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await request(`suggestions/${suggestion.id}`, "PATCH", { title, rationale, proposedValue });
      await onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the suggestion draft.");
    } finally {
      setSaving(false);
    }
  }
  return <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-suggestion-title"><div className="modal__header"><div><p className="eyebrow">Draft only</p><h2 id="edit-suggestion-title">Edit suggestion</h2><p>Target metadata, step order, kind, variables, and password behavior remain read-only.</p></div><Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Close</Button></div><form className="form-stack" onSubmit={submit}><Field label="Suggestion name"><TextInput value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={240} /></Field><Field label="Rationale"><TextArea value={rationale} onChange={(event) => setRationale(event.target.value)} required maxLength={240} /></Field><Field label="Proposed safe value" hint={missingRequired ? "Required-field suggestions must keep this blank." : "Passwords, tokens, and other secret-like values are rejected."}><TextInput value={proposedValue} onChange={(event) => setProposedValue(event.target.value)} readOnly={missingRequired} required={!missingRequired} maxLength={256} /></Field>{message && <Feedback tone="danger">{message}</Feedback>}<div className="modal__actions"><Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save draft"}</Button></div></form></section></div>;
}
