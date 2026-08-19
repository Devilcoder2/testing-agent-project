"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Button, Card, EmptyState, Feedback, Field, PageHeader, StatusBadge, TextArea, TextInput } from "./ui";

type Step = { id: string; order: number; kind: string; target: Record<string, string>; value?: string | null; isRedacted: boolean; description?: string | null; expectedOutcome?: string | null; variableName?: string | null; isCheckpoint?: boolean };
type TestCase = { id: string; name: string; currentVersion: number; product: { name: string }; featureLabels: Array<{ featureLabel: { name: string } }>; versions: Array<{ version: number; steps: Step[] }> };
type DraftStep = { id: string; description: string; expectedOutcome: string; variableName: string; isCheckpoint: boolean };

async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error ?? "Request failed.");
  return payload;
}

function createDraft(step: Step): DraftStep {
  return { id: step.id, description: step.description ?? "", expectedOutcome: step.expectedOutcome ?? "", variableName: step.variableName ?? "", isCheckpoint: Boolean(step.isCheckpoint) };
}

export function TestCaseEditorView({ testCaseId }: { testCaseId: string }) {
  const router = useRouter();
  const [testCase, setTestCase] = useState<TestCase | null>(null);
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [labels, setLabels] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    request(`test-cases/${testCaseId}`).then((result) => {
      const loaded = result as TestCase;
      setTestCase(loaded);
      const current = loaded.versions.find((version) => version.version === loaded.currentVersion);
      setSteps((current?.steps ?? []).map(createDraft));
      setLabels(loaded.featureLabels.map((item) => item.featureLabel.name).join(", "));
    }).catch((error) => setFeedback(error instanceof Error ? error.message : "Could not load this Test Case."));
  }, [testCaseId]);

  function updateStep(id: string, patch: Partial<DraftStep>) {
    setSteps((all) => all.map((step) => step.id === id ? { ...step, ...patch } : step));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setFeedback("");
    try {
      const payload = steps.map((step) => ({ ...step, variableName: step.variableName || null, description: step.description || null, expectedOutcome: step.expectedOutcome || null }));
      const featureLabels = labels.split(",").map((label) => label.trim()).filter(Boolean);
      const result = await request(`test-cases/${testCaseId}/versions`, "POST", { steps: payload, featureLabels }) as { version: { version: number } };
      router.push(`/test-cases/${testCaseId}?savedVersion=${result.version.version}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save a new Test Case version.");
    } finally { setSaving(false); }
  }

  if (!testCase) return <Card className="panel-card"><StatusBadge tone="info">Loading Test Case editor</StatusBadge>{feedback && <Feedback tone="danger">{feedback}</Feedback>}</Card>;
  if (!steps.length) return <EmptyState title="No saved steps" detail="This Test Case cannot be versioned because it has no recorded steps." action={<Link className="button button--secondary" href={`/test-cases/${testCaseId}`}>Back to Test Case</Link>} />;
  return <div className="dashboard-grid"><div className="breadcrumbs"><Link href={`/test-cases/${testCaseId}`}>Test Case</Link><span aria-hidden="true">/</span><span>Edit</span></div><Card className="detail-card"><PageHeader eyebrow="Immutable next version" title={`Edit ${testCase.name}`} detail={`You are editing Version ${testCase.currentVersion}. Saving creates Version ${testCase.currentVersion + 1}; the original remains unchanged.`} actions={<StatusBadge tone="info">{testCase.product.name}</StatusBadge>} /><form className="form-stack" onSubmit={save}><Field label="Feature labels" hint="Comma-separated, product-local labels. Labels organize the Test Case but do not change its ownership."><TextInput value={labels} onChange={(event) => setLabels(event.target.value)} placeholder="e.g. authentication, customer management" /></Field><div className="form-stack">{steps.map((step, index) => { const source = testCase.versions.find((version) => version.version === testCase.currentVersion)?.steps[index]; return <Card className="step-editor" key={step.id}><div className="step-editor__head"><h3>Step {index + 1}: {source?.kind.replace("_", " ")}</h3><StatusBadge tone={source?.isRedacted ? "warning" : step.isCheckpoint ? "success" : "info"}>{source?.isRedacted ? "Redacted" : step.isCheckpoint ? "Checkpoint" : "Saved"}</StatusBadge></div><Field label="Recorded browser target" hint="Captured during recording and used to replay this action. Create a new recording to change it."><TextArea value={JSON.stringify(source?.target ?? {}, null, 2)} readOnly rows={4} className="input--read-only" /></Field>{source?.kind === "TEXT_ENTRY" && <Field label={source.isRedacted ? "Recorded password" : "Recorded input"} hint={source.isRedacted ? "Passwords remain redacted and cannot be edited." : source.variableName ? "This action uses a variable. Change its static default in the Variables section after saving." : "This literal input was captured during recording. Add a variable below when the value should change between Runs."}><TextInput value={source.isRedacted ? "[REDACTED]" : source.value ?? "No text captured"} readOnly className="input--read-only" /></Field>}<Field label="Description"><TextArea value={step.description} onChange={(event) => updateStep(step.id, { description: event.target.value })} /></Field><Field label="Expected outcome"><TextArea value={step.expectedOutcome} onChange={(event) => updateStep(step.id, { expectedOutcome: event.target.value })} /></Field>{source?.kind === "TEXT_ENTRY" && !source.isRedacted && <Field label="Variable name" hint={source.variableName ? "Rename this marker if needed. It cannot be removed because the original value is not retained." : "Optional. Use lower-case letters, numbers, and underscores. Matching names share one value."}><TextInput value={step.variableName} onChange={(event) => { if (!source.variableName || event.target.value.trim()) updateStep(step.id, { variableName: event.target.value }); }} placeholder="Optional variable" /></Field>}<label className="checkpoint-toggle"><input type="checkbox" checked={step.isCheckpoint} onChange={(event) => updateStep(step.id, { isCheckpoint: event.target.checked })} /> <span>Pause an Auto Run after this action for review</span></label></Card>; })}</div>{feedback && <Feedback tone="danger">{feedback}</Feedback>}<div className="modal__actions"><Link className="button button--ghost" href={`/test-cases/${testCaseId}`}>Cancel</Link><Button type="submit" disabled={saving}>{saving ? "Saving Version…" : `Save Version ${testCase.currentVersion + 1}`}</Button></div></form></Card></div>;
}
