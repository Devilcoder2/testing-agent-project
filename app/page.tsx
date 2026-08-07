"use client";

import { FormEvent, useEffect, useState } from "react";

type Product = { id: string; name: string };
type Step = { id: string; order: number; kind: string; target: Record<string, string>; value?: string | null; isRedacted: boolean; description?: string | null; expectedOutcome?: string | null; variableName?: string | null };
type TestCaseSummary = { id: string; name: string; currentVersion: number; product: Product; owner: { displayName: string }; updatedAt: string };
type SavedTestCase = TestCaseSummary & { versions: Array<{ version: number; steps: Step[] }> };

async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(payload?.error ?? "Request failed.");
  return payload;
}

export default function Home() {
  const [signedIn, setSignedIn] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [testCases, setTestCases] = useState<TestCaseSummary[]>([]);
  const [selectedTestCase, setSelectedTestCase] = useState<SavedTestCase | null>(null);
  const [productId, setProductId] = useState("");
  const [testName, setTestName] = useState("Create customer");
  const [recording, setRecording] = useState<{ id: string; token: string } | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadDashboard = async () => {
    const [nextProducts, nextTestCases] = await Promise.all([request("products") as Promise<Product[]>, request("test-cases") as Promise<TestCaseSummary[]>]);
    setProducts(nextProducts); setTestCases(nextTestCases); setProductId((current) => current || nextProducts[0]?.id || "");
  };
  useEffect(() => { if (recording) { const timer = window.setInterval(() => request(`recordings/${recording.id}/steps`).then(setSteps).catch(() => undefined), 1000); return () => window.clearInterval(timer); } }, [recording]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { await request("auth/dev-login", "POST", { email: form.get("email"), password: form.get("password") }); await loadDashboard(); setSignedIn(true); } catch (error) { setMessage(error instanceof Error ? error.message : "Sign in failed."); }
  }
  async function createRecording(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    try { const result = await request("recordings", "POST", { productId, testName, targetUrl: "http://demo-target" }); setRecording({ id: result.recording.id, token: result.token }); setSteps([]); setViewerUrl(null); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create recording."); }
  }
  async function launch() {
    if (!recording) return;
    try { const result = await request(`recordings/${recording.id}/launch`, "POST", { token: recording.token }); setViewerUrl(result.viewerUrl); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not launch browser."); }
  }
  async function updateStep(step: Step, patch: Partial<Step>) {
    if (!recording) return; const next = await request(`recordings/${recording.id}/steps/${step.id}`, "PATCH", patch); setSteps((all) => all.map((item) => item.id === step.id ? next : item));
  }
  async function save() { if (!recording) return; try { const saved = await request(`recordings/${recording.id}/save`, "POST"); const detail = await request(`test-cases/${saved.id}`) as SavedTestCase; await loadDashboard(); setRecording(null); setViewerUrl(null); setSelectedTestCase(detail); setMessage("Test Case saved as version 1."); } catch (error) { setMessage(error instanceof Error ? error.message : "Save failed."); } }
  async function discard() { if (!recording) return; try { await request(`recordings/${recording.id}`, "DELETE"); setRecording(null); setSteps([]); setViewerUrl(null); setMessage("Recording discarded."); } catch (error) { setMessage(error instanceof Error ? error.message : "Discard failed."); } }
  async function openTestCase(id: string) { try { setSelectedTestCase(await request(`test-cases/${id}`) as SavedTestCase); setMessage(""); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not open Test Case."); } }

  if (!signedIn) return <main className="center"><form className="card stack" onSubmit={login}><div className="logo">Sentinel development</div><h1>Sign in to record a QA journey</h1><p className="muted">Use Ava Tester: ava.tester@example.test / sentinel-dev</p><label>Email<input name="email" defaultValue="ava.tester@example.test" type="email" required /></label><label>Password<input name="password" defaultValue="sentinel-dev" type="password" required /></label>{message && <p className="error">{message}</p>}<button>Sign in</button></form></main>;

  return <main className="shell"><header className="header"><div><div className="logo">Sentinel</div><h1>Guided test recording</h1></div><span className="muted">Local Phase 1</span></header>
    {selectedTestCase ? <section className="stack"><section className="panel row"><button className="secondary" onClick={() => setSelectedTestCase(null)}>Back to dashboard</button><div><div className="logo">Saved Test Case</div><h2>{selectedTestCase.name}</h2><p className="muted">{selectedTestCase.product.name} · Owner: {selectedTestCase.owner.displayName} · Version {selectedTestCase.currentVersion}</p></div></section><section className="panel"><h2>Saved steps</h2><p className="muted">These are the persisted annotations for the current Test Case version. Refresh the page, sign in, and reopen this test to confirm they remain.</p><div className="step-list">{selectedTestCase.versions.find((version) => version.version === selectedTestCase.currentVersion)?.steps.map((step) => <article className="step" key={step.id}><h3>Step {step.order}: {step.kind.replace("_", " ")}</h3><small>{step.target.text || step.target.name || step.target.url || step.target.tag}</small>{step.value && <p className="muted">Value: {step.value}</p>}{step.description && <p><strong>Description:</strong> {step.description}</p>}{step.expectedOutcome && <p><strong>Expected outcome:</strong> {step.expectedOutcome}</p>}{step.variableName && <p><strong>Variable:</strong> {step.variableName}</p>}</article>)}</div></section></section> : !recording ? <section className="stack"><section className="panel"><h2>Saved Test Cases</h2>{testCases.length === 0 ? <p className="muted">No saved Test Cases yet.</p> : <div className="step-list">{testCases.map((testCase) => <article className="step row" key={testCase.id}><div><strong>{testCase.name}</strong><br /><small>{testCase.product.name} · {testCase.owner.displayName} · Version {testCase.currentVersion}</small></div><button className="secondary" onClick={() => openTestCase(testCase.id)}>Open</button></article>)}</div>}</section><form className="panel stack" onSubmit={createRecording}><h2>Add New Test</h2><label>Product<select value={productId} onChange={(event) => setProductId(event.target.value)}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Test Name<input value={testName} onChange={(event) => setTestName(event.target.value)} required /></label><label>Website Link<input value="http://demo-target" readOnly /></label><button>Create recording workspace</button>{message && <p className="error">{message}</p>}</form></section> : <><section className="panel row"><strong>{testName}</strong><button className="secondary" onClick={discard}>Back to dashboard</button><button onClick={launch}>Launch live browser</button><button onClick={save}>Save Test</button><button className="danger" onClick={discard}>Discard</button>{message && <span className={message.includes("saved") ? "success" : "error"}>{message}</span>}</section>
      <section className="workspace"><aside className="panel"><h2>Step Log</h2><p className="muted">Actions appear as you use the browser. Passwords are redacted.</p><div className="step-list">{steps.map((step) => <article className="step" key={step.id}><h3>Step {step.order}: {step.kind.replace("_", " ")}</h3><small>{step.target.text || step.target.name || step.target.url || step.target.tag}</small>{step.value && <p className="muted">Value: {step.value}</p>}<div className="stack"><label>Description<textarea defaultValue={step.description ?? ""} onBlur={(event) => updateStep(step, { description: event.target.value })} /></label><label>Expected outcome<textarea defaultValue={step.expectedOutcome ?? ""} onBlur={(event) => updateStep(step, { expectedOutcome: event.target.value })} /></label>{step.kind === "TEXT_ENTRY" && <label>Variable name<input defaultValue={step.variableName ?? ""} placeholder="Optional variable" onBlur={(event) => updateStep(step, { variableName: event.target.value })} /></label>}</div></article>)}</div></aside>
        <section className="browser">{viewerUrl ? <iframe title="Live recording browser" src={viewerUrl} allow="clipboard-read; clipboard-write" /> : <div className="center"><div className="card"><h2>Browser ready</h2><p className="muted">Launch the live browser to begin recording the demo CRM journey.</p></div></div>}</section></section></>}
  </main>;
}
