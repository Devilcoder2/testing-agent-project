"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Button, Card, EmptyState, Feedback, Field, PageHeader, StatusBadge, TextInput } from "./ui";
import { OwnershipTransfer } from "./ownership-transfer";

type Product = { id: string; name: string };
type TestCase = { id: string; name: string; currentVersion: number; product: Product; featureLabels?: Array<{ featureLabel: { id: string; name: string } }> };
type ReleaseRunItem = { id: string; status: "QUEUED" | "RUNNING" | "PASSED" | "FAILED" | "INTERRUPTED" | "EXCLUDED"; exclusionReason?: string | null; testCase: { id: string; name: string }; testCaseVersion: { version: number }; product: Product; run?: { id: string; status: string; outcome?: string | null; failureReason?: string | null } | null };
type ReleaseRun = { id: string; status: string; readiness: "IN_PROGRESS" | "READY" | "NOT_READY"; createdAt: string; initiatedBy?: { displayName: string }; items?: ReleaseRunItem[] };
type Release = { id: string; name: string; ownerId: string; owner?: { displayName: string }; tests: Array<{ testCase: TestCase }>; runs: ReleaseRun[] };

async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error ?? "Request failed.");
  return payload;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "The Release request could not be completed.";
}

function readinessTone(readiness: ReleaseRun["readiness"]) {
  return readiness === "READY" ? "success" as const : readiness === "NOT_READY" ? "danger" as const : "warning" as const;
}

function readable(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

export function ReleasesView() {
  const router = useRouter();
  const [releases, setReleases] = useState<Release[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("");
  const [query, setQuery] = useState("");

  async function load() {
    try {
      const [nextReleases, nextTests] = await Promise.all([request("releases") as Promise<Release[]>, request("test-cases") as Promise<TestCase[]>]);
      setReleases(nextReleases);
      setTestCases(nextTests);
    } catch (error) { setFeedback(message(error)); }
  }
  useEffect(() => { void load(); }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    try {
      const release = await request("releases", "POST", { name, testCaseIds: selected }) as Release;
      setIsCreateOpen(false);
      setName("");
      setSelected([]);
      setQuery("");
      router.push(`/releases/${release.id}`);
    } catch (error) { setFeedback(message(error)); }
  }

  const visibleTestCases = testCases.filter((testCase) => `${testCase.name} ${testCase.product.name}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="dashboard-grid"><PageHeader eyebrow="Batch execution" title="Releases" detail="Group safe autonomous Tests across Products and retain a reproducible version snapshot for every batch." actions={<Button onClick={() => setIsCreateOpen(true)}>New Release <span aria-hidden="true">+</span></Button>} />{feedback && <Feedback tone="danger">{feedback}</Feedback>}<Card className="panel-card">{releases.length === 0 ? <EmptyState title="No Releases" detail="Create a Release to batch-run Test Cases you can access across Products." action={<Button onClick={() => setIsCreateOpen(true)}>New Release</Button>} /> : <div className="run-list">{releases.map((release) => { const latest = release.runs[0]; return <article className="run-list__item" key={release.id}><div><div className="run-list__head"><h2>{release.name}</h2>{latest && <StatusBadge tone={readinessTone(latest.readiness)}>{readable(latest.readiness)}</StatusBadge>}</div><p>{release.tests.length} tagged Test Case{release.tests.length === 1 ? "" : "s"} · {new Set(release.tests.map((item) => item.testCase.product.name)).size} Product{new Set(release.tests.map((item) => item.testCase.product.name)).size === 1 ? "" : "s"}</p></div><Link className="button button--secondary" href={`/releases/${release.id}`}>Open <span aria-hidden="true">→</span></Link></article>; })}</div>}</Card>{isCreateOpen && <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="release-create-title"><div className="modal__header"><div><p className="eyebrow">Release scope</p><h2 id="release-create-title">Create Release</h2><p>Select Test Cases you belong to. Sentinel snapshots their versions only when you start a batch.</p></div><Button variant="ghost" type="button" onClick={() => setIsCreateOpen(false)}>Close</Button></div><form className="form-stack" onSubmit={create}><Field label="Release name"><TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. August CRM readiness" required /></Field><Field label="Find Test Cases" hint={`${selected.length} selected`}><TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by Test Case or Product" /></Field><fieldset className="release-selection"><legend className="field__label">Tagged Test Cases</legend>{visibleTestCases.length === 0 ? <p className="muted">No Test Cases match this search.</p> : visibleTestCases.map((testCase) => <label className="checkbox-row" key={testCase.id}><input type="checkbox" checked={selected.includes(testCase.id)} onChange={(event) => setSelected((all) => event.target.checked ? [...all, testCase.id] : all.filter((id) => id !== testCase.id))} /><span><strong>{testCase.name}</strong><small>{testCase.product.name} · Version {testCase.currentVersion}</small></span></label>)}</fieldset><div className="modal__actions"><Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button><Button type="submit" disabled={!selected.length}>Create Release · {selected.length} Test{selected.length === 1 ? "" : "s"}</Button></div></form></section></div>}</div>;
}

export function ReleaseDetailView({ releaseId }: { releaseId: string }) {
  const router = useRouter();
  const [release, setRelease] = useState<Release | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function load() {
    try {
      const [nextRelease, nextTests] = await Promise.all([request(`releases/${releaseId}`) as Promise<Release>, request("test-cases") as Promise<TestCase[]>]);
      setRelease(nextRelease);
      setTestCases(nextTests);
      setSelected(nextRelease.tests.map((item) => item.testCase.id));
    } catch (error) {
      const text = message(error);
      if (text.toLowerCase().includes("access")) router.replace("/releases");
      else setFeedback(text);
    }
  }
  useEffect(() => { void load(); }, [releaseId]);
  useEffect(() => {
    if (!release?.runs[0] || release.runs[0].readiness !== "IN_PROGRESS") return;
    const timer = window.setInterval(() => void load(), 2_000);
    return () => window.clearInterval(timer);
  }, [release]);

  async function saveTags() {
    setWorking(true); setFeedback("");
    try { await request(`releases/${releaseId}/tests`, "PATCH", { testCaseIds: selected }); setIsEditing(false); await load(); } catch (error) { setFeedback(message(error)); } finally { setWorking(false); }
  }
  async function startRun() {
    setWorking(true); setFeedback("");
    try { await request(`releases/${releaseId}/runs`, "POST"); await load(); } catch (error) { setFeedback(message(error)); } finally { setWorking(false); }
  }
  if (!release) return <Card className="panel-card"><StatusBadge tone="info">Loading Release</StatusBadge>{feedback && <Feedback tone="danger">{feedback}</Feedback>}</Card>;
  const latest = release.runs[0];
  const active = latest?.readiness === "IN_PROGRESS";
  return <div className="dashboard-grid"><div className="breadcrumbs"><Link href="/releases">Releases</Link><span aria-hidden="true">/</span><span>{release.name}</span></div><Card className="detail-card"><PageHeader eyebrow="Release readiness" title={release.name} detail="Tags can change between batches. Each started batch retains an immutable Test Case version snapshot." actions={<><OwnershipTransfer label="Release" currentOwnerId={release.ownerId} membersPath={`releases/${release.id}/members`} transferPath={`releases/${release.id}/owner`} onTransferred={() => window.location.reload()} /><Button variant="secondary" onClick={() => setIsEditing((open) => !open)} disabled={working}>{isEditing ? "Close editor" : "Edit Test Cases"}</Button><Button onClick={() => void startRun()} disabled={working || active}>{working ? "Starting…" : active ? "Batch in progress" : "Start Release Run"}</Button></>} />{latest && <div className="detail-meta"><StatusBadge tone={readinessTone(latest.readiness)}>{readable(latest.readiness)}</StatusBadge><span>{latest.items?.length ?? 0} persisted item{(latest.items?.length ?? 0) === 1 ? "" : "s"}</span></div>}</Card>{feedback && <Feedback tone="danger">{feedback}</Feedback>}{isEditing && <Card className="panel-card"><div className="panel-card__head"><div><p className="eyebrow">Release composition</p><h2>Tagged Test Cases</h2><p>At least one Test Case is required. You must belong to every included Product.</p></div><Button onClick={() => void saveTags()} disabled={working || !selected.length}>Save tags</Button></div><div className="form-stack">{testCases.map((testCase) => <label className="checkbox-row" key={testCase.id}><input type="checkbox" checked={selected.includes(testCase.id)} onChange={(event) => setSelected((all) => event.target.checked ? [...all, testCase.id] : all.filter((id) => id !== testCase.id))} /><span><strong>{testCase.name}</strong><small>{testCase.product.name} · Version {testCase.currentVersion}</small></span></label>)}</div></Card>}<Card className="detail-card"><div className="panel-card__head"><div><p className="eyebrow">Current composition</p><h2>Tagged Test Cases</h2></div></div><div className="run-list">{release.tests.map((item) => <article className="run-list__item" key={item.testCase.id}><div><h2>{item.testCase.name}</h2><p>{item.testCase.product.name} · Current Version {item.testCase.currentVersion}{item.testCase.featureLabels?.length ? ` · ${item.testCase.featureLabels.map((label) => label.featureLabel.name).join(", ")}` : ""}</p></div><Link className="button button--secondary" href={`/test-cases/${item.testCase.id}`}>Open Test</Link></article>)}</div></Card><Card className="detail-card"><div className="panel-card__head"><div><p className="eyebrow">Batch history</p><h2>Release Runs</h2><p>Excluded items remain visible so a batch never silently skips a Test Case.</p></div></div>{release.runs.length === 0 ? <EmptyState title="No Release Runs yet" detail="Start a Release Run to snapshot current versions and queue every eligible Auto Run." /> : <div className="form-stack">{release.runs.map((run) => <section className="release-run" key={run.id}><div className="run-list__head"><div><h3>Batch {new Date(run.createdAt).toLocaleString()}</h3><p>{run.initiatedBy?.displayName ?? "Named user"}</p></div><StatusBadge tone={readinessTone(run.readiness)}>{readable(run.readiness)}</StatusBadge></div><div className="run-list">{run.items?.map((item) => <article className="run-list__item" key={item.id}><div><div className="run-list__head"><h2>{item.testCase.name}</h2><StatusBadge tone={item.status === "PASSED" ? "success" : item.status === "EXCLUDED" || item.status === "FAILED" || item.status === "INTERRUPTED" ? "danger" : "warning"}>{readable(item.status)}</StatusBadge></div><p>{item.product.name} · Version {item.testCaseVersion.version}{item.exclusionReason ? ` · ${readable(item.exclusionReason)}` : ""}{item.run?.failureReason ? ` · ${readable(item.run.failureReason)}` : ""}</p></div>{item.run && <Link className="button button--secondary" href={`/runs/${item.run.id}`}>Open Run</Link>}</article>)}</div></section>)}</div>}</Card></div>;
}
