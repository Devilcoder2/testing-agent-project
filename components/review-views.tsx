"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Card, EmptyState, Feedback, Field, PageHeader, SelectInput, StatusBadge, TextArea, TextInput } from "./ui";

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

async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(payload?.error ?? "Request failed.");
  return payload;
}

function statusTone(status: SuggestionStatus) {
  return status === "APPROVED" ? "success" as const : status === "DISMISSED" ? "neutral" as const : "warning" as const;
}

function ruleLabel(kind: string) {
  return kind.replaceAll("_", " ").toLowerCase();
}

export function ReviewView() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [productId, setProductId] = useState("");
  const [status, setStatus] = useState<"ALL" | SuggestionStatus>("ALL");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Suggestion | null>(null);

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

  async function changeState(suggestion: Suggestion, action: "approve" | "dismiss" | "reopen") {
    if (action === "dismiss" && !window.confirm(`Dismiss “${suggestion.title}”? You can reopen it later from Review.`)) return;
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
    <PageHeader eyebrow="Conservative negative coverage" title="Review" detail={sourceTestCaseId ? "Suggestions for the selected Test Case. These drafts never run or change a baseline until approval." : "Review deterministic negative-Test drafts before they become independent Test Cases."} actions={<StatusBadge tone="info">{suggestions.length} visible suggestion{suggestions.length === 1 ? "" : "s"}</StatusBadge>} />
    {message && <Feedback tone={message.startsWith("Suggestion approved") || message.startsWith("Suggestion dismissed") || message.startsWith("Suggestion reopened") ? "success" : "danger"}>{message}</Feedback>}
    <Card className="panel-card"><div className="inventory-toolbar"><Field label="Filter by Product"><SelectInput value={productId} onChange={(event) => setProductId(event.target.value)} disabled={loading}><option value="">All accessible Products</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput></Field><Field label="Filter by review state"><SelectInput value={status} onChange={(event) => setStatus(event.target.value as "ALL" | SuggestionStatus)}><option value="ALL">All states</option><option value="DRAFT">Draft</option><option value="APPROVED">Approved</option><option value="DISMISSED">Dismissed</option></SelectInput></Field></div>{loading ? <StatusBadge tone="info">Loading Review queue</StatusBadge> : suggestions.length === 0 ? <EmptyState title="No suggestions found" detail={sourceTestCaseId ? "Generate suggestions from this Test Case when its current version contains supported validation metadata." : "Generate suggestions from a saved Test Case to create reviewable negative-Test drafts."} /> : <div className="review-list">{suggestions.map((suggestion) => <article className="review-item" key={suggestion.id}><div className="review-item__main"><div className="review-item__head"><h2>{suggestion.title}</h2><StatusBadge tone={statusTone(suggestion.status)}>{suggestion.status.toLowerCase()}</StatusBadge></div><p className="review-item__meta">{suggestion.product.name} · <Link href={`/test-cases/${suggestion.sourceTestCase.id}`}>{suggestion.sourceTestCase.name}</Link> · Version {suggestion.sourceVersion.version} · Step {suggestion.sourceStep.order}</p><p><strong>Rule:</strong> {ruleLabel(suggestion.kind)}</p><p><strong>Proposed safe value:</strong> {suggestion.proposedValue ? <code>{suggestion.proposedValue}</code> : "Leave blank"}</p><p><strong>Why:</strong> {suggestion.rationale}</p><p><strong>Expected:</strong> {suggestion.expectedOutcome}</p>{suggestion.approvedTestCase && <p><Link href={`/test-cases/${suggestion.approvedTestCase.id}`}>Open approved Test Case <span aria-hidden="true">→</span></Link></p>}</div><div className="review-item__actions">{suggestion.status === "DRAFT" && <><Button variant="secondary" onClick={() => setEditing(suggestion)} disabled={workingId === suggestion.id}>Edit draft</Button><Button onClick={() => void changeState(suggestion, "approve")} disabled={workingId === suggestion.id}>{workingId === suggestion.id ? "Working…" : "Approve"}</Button><Button variant="danger" onClick={() => void changeState(suggestion, "dismiss")} disabled={workingId === suggestion.id}>Dismiss</Button></>}{suggestion.status === "DISMISSED" && <Button variant="secondary" onClick={() => void changeState(suggestion, "reopen")} disabled={workingId === suggestion.id}>{workingId === suggestion.id ? "Working…" : "Reopen"}</Button>}</div></article>)}</div>}</Card>
    {editing && <SuggestionEditDialog suggestion={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); setMessage("Suggestion draft updated."); await load(); }} />}
  </div>;
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
