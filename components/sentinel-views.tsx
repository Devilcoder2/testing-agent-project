"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, Feedback, Field, PageHeader, SelectInput, StatusBadge, TextArea, TextInput } from "./ui";

type Product = { id: string; name: string };
type Step = { id: string; order: number; kind: string; target: Record<string, string>; value?: string | null; isRedacted: boolean; description?: string | null; expectedOutcome?: string | null; variableName?: string | null };
type TestCaseSummary = { id: string; name: string; currentVersion: number; product: Product; owner: { displayName: string }; updatedAt: string };
type SavedTestCase = TestCaseSummary & { versions: Array<{ version: number; steps: Step[] }> };
type RecordingContext = { id: string; token: string; testName: string };

const recordingStorageKey = (id: string) => `sentinel-recording:${id}`;

async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(payload?.error ?? "Request failed.");
  return payload;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function testCaseSteps(testCase: SavedTestCase) {
  return testCase.versions.find((version) => version.version === testCase.currentVersion)?.steps ?? [];
}

function toneForMessage(message: string) {
  if (message.toLowerCase().includes("created") || message.toLowerCase().includes("saved")) return "success" as const;
  return "danger" as const;
}

export function SignInView() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setMessage("");
    try {
      await request("auth/dev-login", "POST", { email: form.get("email"), password: form.get("password") });
      router.replace("/dashboard");
    } catch (error) {
      setMessage(errorMessage(error, "Sign in failed."));
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="auth-page">
    <section className="auth-page__story">
      <div className="sentinel-brand"><span className="sentinel-mark" aria-hidden="true"><span /></span><span className="sentinel-wordmark">Sentinel</span></div>
      <p className="eyebrow">QA operations platform</p>
      <h1>Turn browser knowledge into reliable quality signals.</h1>
      <p>Teach a journey once, retain its ownership and intent, then grow toward evidence-backed autonomous quality assurance.</p>
    </section>
    <section className="auth-page__form-wrap">
      <Card className="auth-card">
        <div className="auth-card__header"><p className="eyebrow">Development access</p><h2>Sign in to Sentinel</h2><p>Use a seeded named development account to access the local recording workspace.</p></div>
        <form className="auth-form" onSubmit={login}>
          <Field label="Email"><TextInput name="email" defaultValue="ava.tester@example.test" type="email" autoComplete="email" required /></Field>
          <Field label="Password"><TextInput name="password" defaultValue="sentinel-dev" type="password" autoComplete="current-password" required /></Field>
          {message && <Feedback tone="danger">{message}</Feedback>}
          <Button type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}<span aria-hidden="true">→</span></Button>
        </form>
      </Card>
    </section>
  </main>;
}

function useDashboardData() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [testCases, setTestCases] = useState<TestCaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [nextProducts, nextTestCases] = await Promise.all([request("products") as Promise<Product[]>, request("test-cases") as Promise<TestCaseSummary[]>]);
      setProducts(nextProducts);
      setTestCases(nextTestCases);
      return { products: nextProducts, testCases: nextTestCases };
    } catch (loadError) {
      const message = errorMessage(loadError, "Could not load the workspace.");
      if (message.includes("access") || message.includes("sign in")) router.replace("/");
      else setError(message);
      return { products: [], testCases: [] };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  return { products, testCases, setProducts, setTestCases, loading, error, load };
}

function TestCaseList({ testCases, emptyAction }: { testCases: TestCaseSummary[]; emptyAction?: ReactNode }) {
  if (testCases.length === 0) return <EmptyState title="No saved Test Cases" detail="Create a guided recording to turn a browser journey into a reusable Test Case." action={emptyAction} />;
  return <div className="test-list">{testCases.map((testCase) => <article className="test-list__item" key={testCase.id}><div><p className="test-list__title">{testCase.name}</p><p className="test-list__meta">{testCase.product.name} · {testCase.owner.displayName} · Version {testCase.currentVersion}</p></div><Link className="button button--secondary" href={`/test-cases/${testCase.id}`}>Open <span aria-hidden="true">→</span></Link></article>)}</div>;
}

export function DashboardView() {
  const { products, testCases, setProducts, loading, error } = useDashboardData();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [productMessage, setProductMessage] = useState("");

  useEffect(() => { if (!selectedProductId && products[0]) setSelectedProductId(products[0].id); }, [products, selectedProductId]);
  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const selectedTests = selectedProductId ? testCases.filter((testCase) => testCase.product.id === selectedProductId) : testCases;

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProductMessage("");
    try {
      const product = await request("products", "POST", { name: newProductName }) as Product;
      setProducts((all) => [...all, product].sort((left, right) => left.name.localeCompare(right.name)));
      setSelectedProductId(product.id);
      setNewProductName("");
      setProductMessage(`Product "${product.name}" created and selected.`);
    } catch (createError) {
      setProductMessage(errorMessage(createError, "Could not create Product."));
    }
  }

  return <div className="dashboard-grid">
    <PageHeader eyebrow="Workspace overview" title="Quality, made observable." detail="Create product-owned tests, record live journeys, and preserve the intent behind every step." actions={<Link className="button button--primary" href={`/recordings/new${selectedProductId ? `?productId=${selectedProductId}` : ""}`}>New recording <span aria-hidden="true">+</span></Link>} />
    {error && <Feedback tone="danger">{error}</Feedback>}
    <section className="metrics" aria-label="Workspace summary"><Card className="metric-card"><p className="metric-card__label">Accessible Products</p><p className="metric-card__value">{products.length}</p><p className="metric-card__detail">Products you can record against</p></Card><Card className="metric-card"><p className="metric-card__label">Saved Test Cases</p><p className="metric-card__value">{testCases.length}</p><p className="metric-card__detail">Reusable browser journeys</p></Card><Card className="metric-card"><p className="metric-card__label">Current Product</p><p className="metric-card__value">{selectedProduct ? selectedTests.length : "—"}</p><p className="metric-card__detail">Tests in {selectedProduct?.name ?? "your workspace"}</p></Card></section>
    <section className="content-grid"><Card className="panel-card"><div className="panel-card__head"><div><p className="eyebrow">Test inventory</p><h2>Saved Test Cases</h2><p>Open a versioned journey to inspect its recorded steps and annotations.</p></div><Link className="button button--ghost" href="/test-cases">View all <span aria-hidden="true">→</span></Link></div><div className="form-stack"><Field label="Product"><SelectInput value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} disabled={loading || products.length === 0}>{products.length === 0 ? <option value="">Create a Product first</option> : products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput></Field><TestCaseList testCases={selectedTests} emptyAction={<Link className="button button--primary" href={`/recordings/new${selectedProductId ? `?productId=${selectedProductId}` : ""}`}>Record your first test</Link>} /></div></Card><Card className="panel-card"><div className="panel-card__head"><div><p className="eyebrow">Product context</p><h2>Create Product</h2><p>Create a Product you own and use it immediately for a new Test Case.</p></div></div><form className="form-stack" onSubmit={createProduct}><Field label="Product name"><TextInput value={newProductName} onChange={(event) => setNewProductName(event.target.value)} placeholder="e.g. Billing Portal" required /></Field><Button type="submit">Create Product <span aria-hidden="true">+</span></Button>{productMessage && <Feedback tone={toneForMessage(productMessage)}>{productMessage}</Feedback>}</form></Card></section>
  </div>;
}

export function TestCasesView() {
  const { products, testCases, loading, error } = useDashboardData();
  const [productId, setProductId] = useState("");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => testCases.filter((testCase) => (!productId || testCase.product.id === productId) && testCase.name.toLowerCase().includes(query.toLowerCase())), [productId, query, testCases]);

  return <div className="dashboard-grid"><PageHeader eyebrow="Test library" title="Test Cases" detail="Browse the reusable, product-owned journeys available to you." actions={<Link className="button button--primary" href={`/recordings/new${productId ? `?productId=${productId}` : ""}`}>New recording <span aria-hidden="true">+</span></Link>} />{error && <Feedback tone="danger">{error}</Feedback>}<Card className="panel-card"><div className="form-row"><Field label="Product"><SelectInput value={productId} onChange={(event) => setProductId(event.target.value)} disabled={loading}><option value="">All accessible Products</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput></Field><Field label="Find a Test Case"><TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by Test Case name" /></Field></div><div className="form-stack"><StatusBadge tone="info">{filtered.length} visible Test Case{filtered.length === 1 ? "" : "s"}</StatusBadge><TestCaseList testCases={filtered} emptyAction={<Link className="button button--primary" href="/recordings/new">Create a recording</Link>} /></div></Card></div>;
}

export function TestCaseDetailView({ testCaseId }: { testCaseId: string }) {
  const router = useRouter();
  const [testCase, setTestCase] = useState<SavedTestCase | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    request(`test-cases/${testCaseId}`).then((result) => setTestCase(result as SavedTestCase)).catch((loadError) => {
      const error = errorMessage(loadError, "Could not open this Test Case.");
      if (error.includes("access") || error.includes("sign in")) router.replace("/");
      else setMessage(error);
    });
  }, [router, testCaseId]);

  if (message) return <Feedback tone="danger">{message}</Feedback>;
  if (!testCase) return <Card className="panel-card"><StatusBadge tone="info">Loading saved Test Case</StatusBadge></Card>;
  const steps = testCaseSteps(testCase);
  return <div className="dashboard-grid"><div className="breadcrumbs"><Link href="/dashboard">Dashboard</Link><span aria-hidden="true">/</span><Link href="/test-cases">Test Cases</Link><span aria-hidden="true">/</span><span>{testCase.name}</span></div><Card className="detail-card"><PageHeader eyebrow="Saved Test Case" title={testCase.name} detail="This current version is read-only. Future edits will create a new controlled version." actions={<StatusBadge tone="success">Version {testCase.currentVersion}</StatusBadge>} /><div className="detail-meta"><span>{testCase.product.name}</span><span aria-hidden="true">•</span><span>Owner: {testCase.owner.displayName}</span><span aria-hidden="true">•</span><span>{steps.length} recorded step{steps.length === 1 ? "" : "s"}</span></div></Card><Card className="detail-card"><div className="panel-card__head"><div><p className="eyebrow">Current version timeline</p><h2>Recorded steps</h2><p>Descriptions, outcomes, and variables are the persisted annotations captured during recording.</p></div></div>{steps.length === 0 ? <EmptyState title="No recorded steps" detail="This Test Case was saved without recorded browser activity." /> : <div className="timeline">{steps.map((step) => <StepTimelineItem key={step.id} step={step} />)}</div>}</Card></div>;
}

function StepTimelineItem({ step }: { step: Step }) {
  const label = step.target.text || step.target.name || step.target.url || step.target.tag || "Recorded target";
  return <article className="timeline-item"><div className="timeline-item__rail"><span className="timeline-item__number">{step.order}</span></div><div className="timeline-item__card"><h3>{step.kind.replace("_", " ")}</h3><p className="timeline-item__target">{label}</p>{step.value && <p className="timeline-item__annotation"><strong>Value:</strong> {step.value}</p>}{step.description && <p className="timeline-item__annotation"><strong>Description:</strong> {step.description}</p>}{step.expectedOutcome && <p className="timeline-item__annotation"><strong>Expected outcome:</strong> {step.expectedOutcome}</p>}{step.variableName && <p className="timeline-item__annotation"><strong>Variable:</strong> {step.variableName}</p>}</div></article>;
}

export function NewRecordingView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { products, loading, error } = useDashboardData();
  const [productId, setProductId] = useState("");
  const [testName, setTestName] = useState("Create customer");
  const [message, setMessage] = useState("");
  const preferredProductId = searchParams.get("productId");

  useEffect(() => { if (!productId && products.length) setProductId(products.some((product) => product.id === preferredProductId) ? preferredProductId ?? products[0].id : products[0].id); }, [preferredProductId, productId, products]);

  async function createRecording(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!productId) { setMessage("Create or select a Product before creating a Test Case."); return; }
    try {
      const result = await request("recordings", "POST", { productId, testName, targetUrl: "http://demo-target" }) as { recording: { id: string }; token: string };
      const context: RecordingContext = { id: result.recording.id, token: result.token, testName };
      window.sessionStorage.setItem(recordingStorageKey(context.id), JSON.stringify(context));
      router.push(`/recordings/${context.id}`);
    } catch (createError) {
      setMessage(errorMessage(createError, "Could not create recording."));
    }
  }

  return <div className="dashboard-grid"><div className="breadcrumbs"><Link href="/dashboard">Dashboard</Link><span aria-hidden="true">/</span><span>New recording</span></div><PageHeader eyebrow="Guided test creation" title="Create a recording workspace" detail="Associate this Test Case with a Product, then teach the approved Demo CRM journey in a live remote browser." /><Card className="panel-card"><form className="form-stack" onSubmit={createRecording}><Field label="Product"><SelectInput value={productId} onChange={(event) => setProductId(event.target.value)} disabled={loading || products.length === 0}>{products.length === 0 ? <option value="">Create a Product first</option> : products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput></Field><Field label="Test Name"><TextInput value={testName} onChange={(event) => setTestName(event.target.value)} required /></Field><Field label="Website Link" hint="Phase 1 accepts only the isolated Demo CRM target."><TextInput value="http://demo-target" readOnly /></Field>{error && <Feedback tone="danger">{error}</Feedback>}{message && <Feedback tone="danger">{message}</Feedback>}<div className="form-row"><Button type="submit" disabled={!products.length}>Create recording workspace <span aria-hidden="true">→</span></Button><Button type="button" variant="ghost" onClick={() => router.push("/dashboard")}>Cancel</Button></div></form></Card></div>;
}

export function RecordingWorkspaceView({ recordingId }: { recordingId: string }) {
  const router = useRouter();
  const [context, setContext] = useState<RecordingContext | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(recordingStorageKey(recordingId));
    if (!stored) { setMessage("This recording workspace is unavailable. Create a new recording from the dashboard."); return; }
    try { setContext(JSON.parse(stored) as RecordingContext); } catch { setMessage("This recording workspace could not be restored. Create a new recording from the dashboard."); }
  }, [recordingId]);

  useEffect(() => {
    if (!context) return;
    const loadSteps = () => request(`recordings/${context.id}/steps`).then((result) => setSteps(result as Step[])).catch((loadError) => setMessage(errorMessage(loadError, "Could not refresh recorded steps.")));
    void loadSteps();
    const timer = window.setInterval(loadSteps, 1000);
    return () => window.clearInterval(timer);
  }, [context]);

  async function launch() {
    if (!context) return;
    setWorking(true);
    setMessage("");
    try {
      const result = await request(`recordings/${context.id}/launch`, "POST", { token: context.token }) as { viewerUrl: string };
      setViewerUrl(result.viewerUrl);
    } catch (launchError) {
      setMessage(errorMessage(launchError, "Could not launch browser."));
    } finally {
      setWorking(false);
    }
  }

  async function updateStep(step: Step, patch: Partial<Step>) {
    if (!context) return;
    try {
      const updated = await request(`recordings/${context.id}/steps/${step.id}`, "PATCH", patch) as Step;
      setSteps((all) => all.map((item) => item.id === step.id ? updated : item));
    } catch (updateError) {
      setMessage(errorMessage(updateError, "Could not save this step annotation."));
    }
  }

  async function save() {
    if (!context) return;
    setWorking(true);
    setMessage("");
    try {
      const saved = await request(`recordings/${context.id}/save`, "POST") as { id: string };
      window.sessionStorage.removeItem(recordingStorageKey(context.id));
      router.push(`/test-cases/${saved.id}`);
    } catch (saveError) {
      setMessage(errorMessage(saveError, "Save failed."));
    } finally {
      setWorking(false);
    }
  }

  async function discard() {
    if (!context) return;
    setWorking(true);
    setMessage("");
    try {
      await request(`recordings/${context.id}`, "DELETE");
      window.sessionStorage.removeItem(recordingStorageKey(context.id));
      router.push("/dashboard");
    } catch (discardError) {
      setMessage(errorMessage(discardError, "Could not discard recording."));
    } finally {
      setWorking(false);
    }
  }

  if (!context) return <div className="recording-page"><Feedback tone="warning">{message || "Loading recording workspace…"}</Feedback><Button variant="secondary" onClick={() => router.push("/dashboard")}>Back to dashboard</Button></div>;
  return <div className="recording-page"><Card className="recording-bar"><div className="recording-bar__title"><StatusBadge tone={viewerUrl ? "success" : "warning"}>{viewerUrl ? "Recording active" : "Draft ready"}</StatusBadge><h1>{context.testName}</h1></div><div className="recording-bar__actions"><Button variant="secondary" onClick={() => router.push("/dashboard")}>Back to dashboard</Button><Button variant="secondary" onClick={launch} disabled={working}>{viewerUrl ? "Reset live browser" : "Launch live browser"}</Button><Button onClick={save} disabled={working}>Save Test</Button><Button variant="danger" onClick={discard} disabled={working}>Discard</Button></div></Card>{message && <Feedback tone={toneForMessage(message)}>{message}</Feedback>}<section className="recording-workspace"><aside className="step-panel"><div className="step-panel__head"><div><p className="eyebrow">Live timeline</p><h2>Step Log</h2><p>Actions appear in order. Password values remain redacted.</p></div><StatusBadge tone="info">{steps.length} step{steps.length === 1 ? "" : "s"}</StatusBadge></div><div className="step-panel__list">{steps.length === 0 ? <EmptyState title="Waiting for actions" detail="Launch the browser and interact with the Demo CRM to create your first recorded step." /> : steps.map((step) => <StepEditor key={step.id} step={step} onUpdate={updateStep} />)}</div></aside><section className="browser-stage" aria-label="Live recording browser">{viewerUrl ? <iframe title="Live recording browser" src={viewerUrl} allow="clipboard-read; clipboard-write" /> : <div className="browser-stage__empty"><div className="browser-stage__empty-card"><span className="sentinel-mark" aria-hidden="true"><span /></span><h2>Browser ready</h2><p>Launch the live browser to begin recording the approved Demo CRM journey.</p><Button onClick={launch} disabled={working}>Launch live browser</Button></div></div>}</section></section><section className="recording-desktop-guidance"><p className="eyebrow">Desktop workspace required</p><h2>Use a wider screen to record a live journey.</h2><p>The browser and editable Step Log work together in a desktop-sized workspace. Return on a larger viewport to continue this draft.</p><Button variant="secondary" onClick={() => router.push("/dashboard")}>Back to dashboard</Button></section></div>;
}

function StepEditor({ step, onUpdate }: { step: Step; onUpdate: (step: Step, patch: Partial<Step>) => Promise<void> }) {
  const label = step.target.text || step.target.name || step.target.url || step.target.tag || "Recorded target";
  return <article className="step-editor step"><div className="step-editor__head"><h3>Step {step.order}: {step.kind.replace("_", " ")}</h3><StatusBadge tone={step.isRedacted ? "warning" : "info"}>{step.isRedacted ? "Redacted" : "Captured"}</StatusBadge></div><p className="step-editor__target">{label}</p>{step.value && <p className="step-editor__value">Value: {step.value}</p>}<Field label="Description"><TextArea defaultValue={step.description ?? ""} onBlur={(event) => void onUpdate(step, { description: event.target.value })} /></Field><Field label="Expected outcome"><TextArea defaultValue={step.expectedOutcome ?? ""} onBlur={(event) => void onUpdate(step, { expectedOutcome: event.target.value })} /></Field>{step.kind === "TEXT_ENTRY" && <Field label="Variable name"><TextInput defaultValue={step.variableName ?? ""} placeholder="Optional variable" onBlur={(event) => void onUpdate(step, { variableName: event.target.value })} /></Field>}</article>;
}
