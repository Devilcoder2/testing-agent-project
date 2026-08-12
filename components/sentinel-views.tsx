"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, Feedback, Field, PageHeader, SelectInput, StatusBadge, TextArea, TextInput } from "./ui";

type Product = { id: string; name: string };
type Step = { id: string; order: number; kind: string; target: Record<string, string>; value?: string | null; isRedacted: boolean; description?: string | null; expectedOutcome?: string | null; variableName?: string | null; isCheckpoint?: boolean; suggestion?: { name: string; reason: string } | null };
type TestCaseSummary = { id: string; name: string; currentVersion: number; product: Product; owner: { displayName: string }; updatedAt: string };
type VersionVariable = { name: string; hasStaticDefault: boolean; maskedValue: string | null };
type SavedTestCase = TestCaseSummary & { versions: Array<{ version: number; steps: Step[]; variables?: VersionVariable[] }> };
type TestDataSet = { id: string; name: string; fieldNames: string[]; status: "SAFE" | "RESERVED" | "CONSUMED" | "INVALID"; createdAt?: string };
type RecordingContext = { id: string; token: string; testName: string };

const recordingStorageKey = (id: string) => `sentinel-recording:${id}`;
const preferredProductStorageKey = "sentinel-preferred-product";

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
  if (message.toLowerCase().includes("created") || message.toLowerCase().includes("saved") || message.toLowerCase().includes("renamed")) return "success" as const;
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
      if (message.toLowerCase().includes("access") || message.toLowerCase().includes("sign in")) router.replace("/");
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
  const { products, testCases, loading, error } = useDashboardData();
  const testsPerProduct = products.length ? (testCases.length / products.length).toFixed(1) : "0";
  const distribution = products.map((product) => ({ ...product, testCount: testCases.filter((testCase) => testCase.product.id === product.id).length })).sort((left, right) => right.testCount - left.testCount || left.name.localeCompare(right.name));
  const visibleDistribution = distribution.slice(0, 5);
  const largestCount = Math.max(1, ...visibleDistribution.map((product) => product.testCount));

  return <div className="dashboard-grid">
    <PageHeader eyebrow="Workspace overview" title="Dashboard" detail="A concise view of the Products and reusable Test Cases available to you." />
    {error && <Feedback tone="danger">{error}</Feedback>}
    <section className="metrics" aria-label="Workspace summary"><Card className="metric-card"><p className="metric-card__label">Accessible Products</p><p className="metric-card__value">{products.length}</p><p className="metric-card__detail">Products you can record against</p></Card><Card className="metric-card"><p className="metric-card__label">Saved Test Cases</p><p className="metric-card__value">{testCases.length}</p><p className="metric-card__detail">Reusable browser journeys</p></Card><Card className="metric-card"><p className="metric-card__label">Coverage density</p><p className="metric-card__value">{testsPerProduct}</p><p className="metric-card__detail">Saved Tests per accessible Product</p></Card></section>
    <section className="dashboard-visuals" aria-label="Test Case distribution"><Card className="distribution-card"><div className="panel-card__head"><div><p className="eyebrow">Coverage distribution</p><h2>Test Cases by Product</h2><p>Each bar uses the saved Test Cases you can currently access.</p></div></div>{loading ? <StatusBadge tone="info">Loading workspace data</StatusBadge> : distribution.length === 0 ? <EmptyState title="No accessible Products" detail="Create a Product from the Products page to begin organizing Test Cases." /> : <div className="distribution-list">{visibleDistribution.map((product) => <div className="distribution-row" key={product.id}><span className="distribution-row__label" title={product.name}>{product.name}</span><div className="distribution-track" aria-label={`${product.name}: ${product.testCount} saved Test Cases`} role="img"><span style={{ width: `${(product.testCount / largestCount) * 100}%` }} /></div><span className="distribution-row__count">{product.testCount}</span></div>)}{distribution.length > visibleDistribution.length && <p className="distribution-card__note">Showing the five highest-coverage Products. View the full list in Products.</p>}</div>}</Card></section>
  </div>;
}

export function ProductsView() {
  const { products, testCases, setProducts, loading, error } = useDashboardData();
  const [newProductName, setNewProductName] = useState("");
  const [productMessage, setProductMessage] = useState("");
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  function openProductModal(product?: Product) {
    setEditingProduct(product ?? null);
    setNewProductName(product?.name ?? "");
    setProductMessage("");
    setIsCreateProductOpen(true);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProductMessage("");
    try {
      if (editingProduct) {
        const product = await request(`products/${editingProduct.id}`, "PATCH", { name: newProductName }) as Product;
        setProducts((all) => all.map((item) => item.id === product.id ? product : item).sort((left, right) => left.name.localeCompare(right.name)));
        setNewProductName("");
        setProductMessage(`Product "${product.name}" renamed.`);
        setEditingProduct(null);
        setIsCreateProductOpen(false);
        return;
      }
      const product = await request("products", "POST", { name: newProductName }) as Product;
      setProducts((all) => [...all, product].sort((left, right) => left.name.localeCompare(right.name)));
      window.sessionStorage.setItem(preferredProductStorageKey, product.id);
      setNewProductName("");
      setProductMessage(`Product "${product.name}" created and selected for your next recording.`);
      setIsCreateProductOpen(false);
    } catch (createError) {
      setProductMessage(errorMessage(createError, "Could not create Product."));
    }
  }

  const isEditing = Boolean(editingProduct);
  return <div className="dashboard-grid"><PageHeader eyebrow="Product configuration" title="Products" detail="Create and manage the Product contexts available for guided Test Case recording." actions={<Button className="product-create-action" type="button" onClick={() => openProductModal()}>New product <span aria-hidden="true">+</span></Button>} />{error && <Feedback tone="danger">{error}</Feedback>}{productMessage && !isCreateProductOpen && <Feedback tone={toneForMessage(productMessage)}>{productMessage}</Feedback>}<section className="products-layout products-layout--single"><Card className="panel-card"><div className="panel-card__head"><div><p className="eyebrow">Accessible Products</p><h2>Your Product contexts</h2><p>Products are private to their members and persist between sessions.</p></div><StatusBadge tone="info">{products.length} total</StatusBadge></div>{loading ? <StatusBadge tone="info">Loading Products</StatusBadge> : products.length === 0 ? <EmptyState title="No Products yet" detail="Create your first Product to start a guided recording." /> : <div className="product-list">{products.map((product) => { const testCount = testCases.filter((testCase) => testCase.product.id === product.id).length; return <article className="product-list__item" key={product.id}><div><h3>{product.name}</h3><p>{testCount} saved Test Case{testCount === 1 ? "" : "s"}</p></div><div className="product-list__actions"><Button type="button" variant="secondary" onClick={() => openProductModal(product)}>Edit</Button><Link className="button button--secondary" href={`/test-cases?productId=${product.id}`}>View Test Cases</Link></div></article>; })}</div>}</Card></section>{isCreateProductOpen && <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title"><div className="modal__header"><div><p className="eyebrow">{isEditing ? "Product settings" : "New Product"}</p><h2 id="product-modal-title">{isEditing ? "Edit Product" : "Create new Product"}</h2><p>{isEditing ? "Update the Product name used to organize your Test Cases." : "A Product needs a name and is immediately available for your next recording."}</p></div><Button type="button" variant="ghost" onClick={() => setIsCreateProductOpen(false)}>Close</Button></div><form className="form-stack" onSubmit={saveProduct}><Field label="Product name"><TextInput value={newProductName} onChange={(event) => setNewProductName(event.target.value)} placeholder="e.g. Billing Portal" autoFocus required /></Field>{productMessage && <Feedback tone={toneForMessage(productMessage)}>{productMessage}</Feedback>}<div className="modal__actions"><Button type="button" variant="ghost" onClick={() => setIsCreateProductOpen(false)}>Cancel</Button><Button type="submit">{isEditing ? "Save changes" : "Create Product"} <span aria-hidden="true">{isEditing ? "→" : "+"}</span></Button></div></form></section></div>}</div>;
}

export function TestDataView() {
  const { products, loading, error } = useDashboardData();
  const [productId, setProductId] = useState("");
  const [dataSets, setDataSets] = useState<TestDataSet[]>([]);
  const [message, setMessage] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [fieldsText, setFieldsText] = useState("customer_email=");

  useEffect(() => { if (!productId && products[0]) setProductId(products[0].id); }, [productId, products]);
  useEffect(() => { if (!productId) return; request(`products/${productId}/test-data`).then((result) => setDataSets(result as TestDataSet[])).catch((loadError) => setMessage(errorMessage(loadError, "Could not load Test Data Sets."))); }, [productId]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields: Record<string, string> = {};
    for (const line of fieldsText.split("\n")) { const [field, ...parts] = line.split("="); if (field?.trim()) fields[field.trim()] = parts.join("=").trim(); }
    try { const created = await request(`products/${productId}/test-data`, "POST", { name, fields }) as TestDataSet; setDataSets((all) => [created, ...all]); setName(""); setFieldsText("customer_email="); setIsCreateOpen(false); setMessage("Test Data Set created. Stored values are masked after creation."); } catch (createError) { setMessage(errorMessage(createError, "Could not create the Test Data Set.")); }
  }

  async function invalidate(dataSet: TestDataSet) {
    try { const updated = await request(`products/${productId}/test-data/${dataSet.id}/invalidate`, "POST") as TestDataSet; setDataSets((all) => all.map((item) => item.id === updated.id ? { ...item, ...updated } : item)); } catch (invalidateError) { setMessage(errorMessage(invalidateError, "Could not invalidate this Test Data Set.")); }
  }

  return <div className="dashboard-grid"><PageHeader eyebrow="Reusable run inputs" title="Test Data" detail="Create product-scoped data sets once. Values are encrypted and cannot be viewed after creation." actions={<Button type="button" onClick={() => setIsCreateOpen(true)} disabled={!productId}>New Test Data <span aria-hidden="true">+</span></Button>} />{error && <Feedback tone="danger">{error}</Feedback>}{message && <Feedback tone={toneForMessage(message)}>{message}</Feedback>}<Card className="panel-card"><div className="inventory-toolbar"><Field label="Product"><SelectInput value={productId} onChange={(event) => setProductId(event.target.value)} disabled={loading}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput></Field></div>{dataSets.length === 0 ? <EmptyState title="No Test Data Sets" detail="Create a reusable set for variable-marked Test Cases in this Product." /> : <div className="run-list">{dataSets.map((dataSet) => <article className="run-list__item" key={dataSet.id}><div><div className="run-list__head"><h2>{dataSet.name}</h2><StatusBadge tone={dataSet.status === "SAFE" ? "success" : dataSet.status === "RESERVED" ? "warning" : "neutral"}>{dataSet.status.toLowerCase()}</StatusBadge></div><p>Fields: {dataSet.fieldNames.join(", ")} · Stored values remain masked.</p></div>{dataSet.status === "SAFE" && <Button variant="danger" onClick={() => void invalidate(dataSet)}>Invalidate</Button>}</article>)}</div>}</Card>{isCreateOpen && <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="test-data-title"><div className="modal__header"><div><p className="eyebrow">Local Test Data</p><h2 id="test-data-title">Create Test Data Set</h2><p>Enter one `variable_name=value` field per line. Sentinel encrypts values and never displays them again.</p></div><Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Close</Button></div><form className="form-stack" onSubmit={create}><Field label="Data Set name"><TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. New customer fixture" required /></Field><Field label="Fields"><TextArea value={fieldsText} onChange={(event) => setFieldsText(event.target.value)} rows={5} required /></Field><div className="modal__actions"><Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button><Button type="submit">Create Test Data</Button></div></form></section></div>}</div>;
}

export function TestCasesView() {
  const { products, testCases, loading, error } = useDashboardData();
  const searchParams = useSearchParams();
  const [productId, setProductId] = useState(() => searchParams.get("productId") ?? "");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => testCases.filter((testCase) => (!productId || testCase.product.id === productId) && testCase.name.toLowerCase().includes(query.toLowerCase())), [productId, query, testCases]);

  return <div className="dashboard-grid"><PageHeader eyebrow="Test library" title="Test Cases" detail="Browse the reusable, product-owned journeys available to you." actions={<StatusBadge tone="info">{filtered.length} / {testCases.length} visible Test Case{testCases.length === 1 ? "" : "s"}</StatusBadge>} />{error && <Feedback tone="danger">{error}</Feedback>}<Card className="panel-card"><div className="inventory-toolbar"><Field label="Filter by Product"><SelectInput value={productId} onChange={(event) => setProductId(event.target.value)} disabled={loading}><option value="">All accessible Products</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput></Field><Field label="Find a Test Case"><TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by Test Case name" /></Field></div><div className="form-stack"><TestCaseList testCases={filtered} /></div></Card></div>;
}

export function TestCaseDetailView({ testCaseId }: { testCaseId: string }) {
  const router = useRouter();
  const [testCase, setTestCase] = useState<SavedTestCase | null>(null);
  const [message, setMessage] = useState("");
  const [startingRun, setStartingRun] = useState<"GUIDED" | "AUTO" | null>(null);
  const [bindingMode, setBindingMode] = useState<"GUIDED" | "AUTO" | null>(null);

  useEffect(() => {
    request(`test-cases/${testCaseId}`).then((result) => setTestCase(result as SavedTestCase)).catch((loadError) => {
      const error = errorMessage(loadError, "Could not open this Test Case.");
      if (error.toLowerCase().includes("access") || error.toLowerCase().includes("sign in")) router.replace("/");
      else setMessage(error);
    });
  }, [router, testCaseId]);

  async function startRun(mode: "GUIDED" | "AUTO", bindings?: Record<string, unknown>) {
    setStartingRun(mode);
    setMessage("");
    try {
      const result = await request(`test-cases/${testCaseId}/${mode === "GUIDED" ? "runs" : "auto-runs"}`, "POST", bindings ? { bindings } : undefined) as { run: { id: string } };
      router.push(`/runs/${result.run.id}`);
    } catch (startError) {
      setMessage(errorMessage(startError, `Could not start the ${mode === "GUIDED" ? "guided" : "Auto"} Run.`));
    } finally {
      setStartingRun(null);
    }
  }

  if (message) return <Feedback tone="danger">{message}</Feedback>;
  if (!testCase) return <Card className="panel-card"><StatusBadge tone="info">Loading saved Test Case</StatusBadge></Card>;
  const steps = testCaseSteps(testCase);
  const variables = testCase.versions.find((version) => version.version === testCase.currentVersion)?.variables ?? [];
  const begin = (mode: "GUIDED" | "AUTO") => variables.length ? setBindingMode(mode) : void startRun(mode);
  return <div className="dashboard-grid"><div className="breadcrumbs"><Link href="/dashboard">Dashboard</Link><span aria-hidden="true">/</span><Link href="/test-cases">Test Cases</Link><span aria-hidden="true">/</span><span>{testCase.name}</span></div><Card className="detail-card"><PageHeader eyebrow="Saved Test Case" title={testCase.name} detail="This current version is read-only. Start a guided evidence session or a separate autonomous replay." actions={<><StatusBadge tone="success">Version {testCase.currentVersion}</StatusBadge><Button variant="secondary" onClick={() => begin("GUIDED")} disabled={Boolean(startingRun) || steps.length === 0}>{startingRun === "GUIDED" ? "Starting Run…" : "Run test"}</Button><Button onClick={() => begin("AUTO")} disabled={Boolean(startingRun) || steps.length === 0}>{startingRun === "AUTO" ? "Queueing Auto Run…" : "Auto Run"} <span aria-hidden="true">→</span></Button></>} /><div className="detail-meta"><span>{testCase.product.name}</span><span aria-hidden="true">•</span><span>Owner: {testCase.owner.displayName}</span><span aria-hidden="true">•</span><span>{steps.length} recorded step{steps.length === 1 ? "" : "s"}</span></div></Card>{variables.length > 0 && <Card className="detail-card"><div className="panel-card__head"><div><p className="eyebrow">Variable configuration</p><h2>Variables</h2><p>Static defaults are encrypted. Stored values are never shown after entry.</p></div></div><div className="run-evidence__list">{variables.map((variable) => <article key={variable.name}><div><strong>{variable.name}</strong><small>{steps.filter((step) => step.variableName === variable.name).map((step) => `Step ${step.order}`).join(" · ")} · {variable.maskedValue ?? "No static default"}</small></div><StaticVariableEditor testCaseId={testCase.id} variable={variable} onSaved={(updated) => setTestCase((current) => current ? { ...current, versions: current.versions.map((version) => version.version === current.currentVersion ? { ...version, variables: (version.variables ?? []).map((item) => item.name === updated.name ? updated : item) } : version) } : current)} /></article>)}</div></Card>}<Card className="detail-card"><div className="panel-card__head"><div><p className="eyebrow">Current version timeline</p><h2>Recorded steps</h2><p>Descriptions, outcomes, variables, and checkpoints are persisted from recording.</p></div></div>{steps.length === 0 ? <EmptyState title="No recorded steps" detail="This Test Case was saved without recorded browser activity." /> : <div className="timeline">{steps.map((step) => <StepTimelineItem key={step.id} step={step} />)}</div>}</Card>{bindingMode && <VariableBindingDialog mode={bindingMode} productId={testCase.product.id} variables={variables} onClose={() => setBindingMode(null)} onStart={async (bindings) => { setBindingMode(null); await startRun(bindingMode, bindings); }} />}</div>;
}

function StaticVariableEditor({ testCaseId, variable, onSaved }: { testCaseId: string; variable: VersionVariable; onSaved: (variable: VersionVariable) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  async function save() {
    setMessage("");
    try { onSaved(await request(`test-cases/${testCaseId}/variables/${variable.name}`, "PATCH", { value }) as VersionVariable); setValue(""); setEditing(false); } catch (error) { setMessage(errorMessage(error, "Could not save the static value.")); }
  }
  if (!editing) return <Button variant="secondary" onClick={() => setEditing(true)}>{variable.hasStaticDefault ? "Replace default" : "Set default"}</Button>;
  return <div className="form-stack"><TextInput aria-label={`Static value for ${variable.name}`} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Enter encrypted static value" type="password" /><Button onClick={() => void save()}>Save default</Button>{message && <Feedback tone="danger">{message}</Feedback>}</div>;
}

function VariableBindingDialog({ mode, productId, variables, onClose, onStart }: { mode: "GUIDED" | "AUTO"; productId: string; variables: VersionVariable[]; onClose: () => void; onStart: (bindings: Record<string, unknown>) => Promise<void> }) {
  const [dataSets, setDataSets] = useState<TestDataSet[]>([]);
  const [bindings, setBindings] = useState<Record<string, { source: "STATIC" | "POOL" | "MANUAL"; dataSetId?: string; value?: string }>>(() => Object.fromEntries(variables.map((variable) => [variable.name, { source: variable.hasStaticDefault ? "STATIC" : "MANUAL" }])));
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { request(`products/${productId}/test-data`).then((result) => setDataSets(result as TestDataSet[])).catch((error) => setMessage(errorMessage(error, "Could not load Test Data Sets."))); }, [productId]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSubmitting(true); setMessage(""); try { await onStart(bindings); } catch (error) { setMessage(errorMessage(error, "Could not start this Run.")); } finally { setSubmitting(false); } }
  return <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="variable-binding-title"><div className="modal__header"><div><p className="eyebrow">{mode === "AUTO" ? "Autonomous replay" : "Guided Run"}</p><h2 id="variable-binding-title">Choose variable values</h2><p>Sentinel stores chosen values encrypted and shows only their source after the Run starts.</p></div><Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>Close</Button></div><form className="form-stack" onSubmit={submit}>{variables.map((variable) => { const binding = bindings[variable.name]; const compatible = dataSets.filter((dataSet) => dataSet.status === "SAFE" && dataSet.fieldNames.includes(variable.name)); return <Card className="panel-card" key={variable.name}><Field label={variable.name}><SelectInput value={binding.source} onChange={(event) => setBindings((all) => ({ ...all, [variable.name]: { source: event.target.value as "STATIC" | "POOL" | "MANUAL" } }))}><option value="STATIC" disabled={!variable.hasStaticDefault}>Static default{variable.hasStaticDefault ? " (masked)" : " unavailable"}</option><option value="POOL">Test Data Set</option><option value="MANUAL">Manual for this Run</option></SelectInput></Field>{binding.source === "POOL" && <Field label={`Test Data Set for ${variable.name}`}><SelectInput value={binding.dataSetId ?? ""} onChange={(event) => setBindings((all) => ({ ...all, [variable.name]: { ...binding, dataSetId: event.target.value } }))}><option value="">Choose safe Test Data</option>{compatible.map((dataSet) => <option key={dataSet.id} value={dataSet.id}>{dataSet.name}</option>)}</SelectInput></Field>}{binding.source === "MANUAL" && <Field label={`Manual value for ${variable.name}`}><TextInput type="password" value={binding.value ?? ""} onChange={(event) => setBindings((all) => ({ ...all, [variable.name]: { ...binding, value: event.target.value } }))} /></Field>}</Card>; })}{message && <Feedback tone="danger">{message}</Feedback>}<div className="modal__actions"><Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? "Starting…" : mode === "AUTO" ? "Queue Auto Run" : "Start Guided Run"}</Button></div></form></section></div>;
}

function StepTimelineItem({ step }: { step: Step }) {
  const label = step.target.text || step.target.name || step.target.url || step.target.tag || "Recorded target";
  return <article className="timeline-item"><div className="timeline-item__rail"><span className="timeline-item__number">{step.order}</span></div><div className="timeline-item__card"><h3>{step.kind.replace("_", " ")}</h3><p className="timeline-item__target">{label}</p>{step.value && <p className="timeline-item__annotation"><strong>Value:</strong> {step.value}</p>}{step.description && <p className="timeline-item__annotation"><strong>Description:</strong> {step.description}</p>}{step.expectedOutcome && <p className="timeline-item__annotation"><strong>Expected outcome:</strong> {step.expectedOutcome}</p>}{step.variableName && <p className="timeline-item__annotation"><strong>Variable:</strong> {step.variableName}</p>}{step.isCheckpoint && <p className="timeline-item__annotation"><strong>Checkpoint:</strong> Review required during Auto Run</p>}</div></article>;
}

type EvidenceItem = { id: string; kind: string; objectKey?: string | null; checksum?: string | null; byteSize?: number | null; metadata?: unknown; captureError?: string | null; capturedAt: string };
type RunStepResult = { id: string; order: number; status: "PENDING" | "RUNNING" | "WAITING_FOR_CONFIRMATION" | "PASSED" | "FAILED"; testStep: Step; evidence?: EvidenceItem[] };
type RunAttempt = { id: string; attemptNumber: number; status: string; failureReason?: string | null; activeDurationMs?: number | null };
type RunSummary = { id: string; mode: "GUIDED" | "AUTO"; status: "QUEUED" | "RUNNING" | "PAUSED" | "CANCELLING" | "COMPLETED"; outcome?: "PASSED" | "FAILED" | "INTERRUPTED" | null; evidenceStatus: "COMPLETE" | "PARTIAL"; createdAt: string; product: Product; testCase: { id: string; name: string }; initiatedBy: { displayName: string }; stepResults: Array<{ status: string }>; attempts?: RunAttempt[] };
type RunDetail = Omit<RunSummary, "stepResults"> & { activeStepOrder?: number | null; startedAt?: string | null; completedAt?: string | null; checkpointDeadline?: string | null; failureReason?: string | null; activeDurationMs?: number | null; benchmarkMedianMs?: number | null; durationDeltaMs?: number | null; testCaseVersion: { version: number }; stepResults: RunStepResult[]; attempts: RunAttempt[]; evidence: EvidenceItem[]; variableBindings?: Array<{ name: string; source: "STATIC" | "POOL" | "MANUAL"; dataSetId?: string | null }>; viewerUrl?: string | null };

function runOutcomeTone(run: Pick<RunSummary, "status" | "outcome">) {
  if (run.status === "RUNNING") return "info" as const;
  if (run.status === "QUEUED" || run.status === "PAUSED" || run.status === "CANCELLING") return "warning" as const;
  if (run.outcome === "PASSED") return "success" as const;
  if (run.outcome === "FAILED") return "danger" as const;
  return "warning" as const;
}

function runLabel(run: Pick<RunSummary, "status" | "outcome">) {
  if (run.status === "RUNNING") return "Running";
  if (run.status === "PAUSED") return "Checkpoint review";
  if (run.status === "CANCELLING") return "Cancelling";
  if (!run.outcome) return "Queued";
  return `${run.outcome.slice(0, 1)}${run.outcome.slice(1).toLowerCase()}`;
}

export function RunsView() {
  const { products } = useDashboardData();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [message, setMessage] = useState("");
  const [productId, setProductId] = useState("");
  const [outcome, setOutcome] = useState("");

  useEffect(() => {
    request("runs").then((result) => setRuns(result as RunSummary[])).catch((loadError) => setMessage(errorMessage(loadError, "Could not load Runs.")));
  }, []);

  const filtered = runs.filter((run) => (!productId || run.product.id === productId) && (!outcome || (outcome === "ACTIVE" ? run.status !== "COMPLETED" : run.outcome === outcome)));
  return <div className="dashboard-grid"><PageHeader eyebrow="Execution history" title="Runs" detail="Guided and autonomous executions retain their outcome and redacted evidence separately." actions={<StatusBadge tone="info">{filtered.length} / {runs.length} visible Run{runs.length === 1 ? "" : "s"}</StatusBadge>} />{message && <Feedback tone="danger">{message}</Feedback>}<Card className="panel-card"><div className="inventory-toolbar"><Field label="Filter by Product"><SelectInput value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">All accessible Products</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput></Field><Field label="Filter by outcome"><SelectInput value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="">All outcomes</option><option value="ACTIVE">Queued, running, or paused</option><option value="PASSED">Passed</option><option value="FAILED">Failed</option><option value="INTERRUPTED">Interrupted</option></SelectInput></Field></div>{filtered.length === 0 ? <EmptyState title="No Runs found" detail="Start a Guided Run or Auto Run from a saved Test Case." /> : <div className="run-list">{filtered.map((run) => <article className="run-list__item" key={run.id}><div><div className="run-list__head"><h2>{run.testCase.name}</h2><StatusBadge tone={run.mode === "AUTO" ? "info" : "neutral"}>{run.mode === "AUTO" ? "Auto" : "Guided"}</StatusBadge><StatusBadge tone={runOutcomeTone(run)}>{runLabel(run)}</StatusBadge>{run.evidenceStatus === "PARTIAL" && <StatusBadge tone="warning">Evidence partial</StatusBadge>}</div><p>{run.product.name} · Started by {run.initiatedBy.displayName} · {run.stepResults.filter((step) => step.status === "PASSED").length}/{run.stepResults.length} steps passed{run.mode === "AUTO" && run.attempts?.length ? ` · ${run.attempts.length} attempt${run.attempts.length === 1 ? "" : "s"}` : ""}</p></div><Link className="button button--secondary" href={`/runs/${run.id}`}>Open Run <span aria-hidden="true">→</span></Link></article>)}</div>}</Card></div>;
}

function runStepLabel(step: RunStepResult) {
  return step.testStep.description || step.testStep.target.text || step.testStep.target.name || step.testStep.target.url || step.testStep.kind.replace("_", " ");
}

export function RunWorkspaceView({ runId }: { runId: string }) {
  const router = useRouter();
  const [run, setRun] = useState<RunDetail | null>(null);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  const load = async () => {
    try {
      const result = await request(`runs/${runId}`) as RunDetail;
      setRun(result);
      setMessage("");
    } catch (loadError) {
      setMessage(errorMessage(loadError, "Could not load this Run."));
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (run?.status !== "COMPLETED") void load(); }, 1200);
    return () => window.clearInterval(timer);
  }, [run?.status, runId]);

  async function completeStep(step: RunStepResult, status: "PASSED" | "FAILED") {
    setWorking(true);
    try {
      await request(`runs/${runId}/steps/${step.id}/complete`, "POST", { status });
      await load();
    } catch (completionError) {
      setMessage(errorMessage(completionError, "Could not complete this Run step."));
    } finally {
      setWorking(false);
    }
  }

  async function interrupt() {
    setWorking(true);
    try {
      await request(`runs/${runId}/interrupt`, "POST");
      await load();
    } catch (interruptError) {
      setMessage(errorMessage(interruptError, "Could not interrupt this Run."));
    } finally {
      setWorking(false);
    }
  }

  async function resumeAutoRun() {
    setWorking(true);
    try {
      await request(`runs/${runId}/resume`, "POST");
      await load();
    } catch (resumeError) {
      setMessage(errorMessage(resumeError, "Could not resume this Auto Run."));
    } finally {
      setWorking(false);
    }
  }

  async function cancelAutoRun() {
    setWorking(true);
    try {
      await request(`runs/${runId}/cancel`, "POST");
      await load();
    } catch (cancelError) {
      setMessage(errorMessage(cancelError, "Could not cancel this Auto Run."));
    } finally {
      setWorking(false);
    }
  }

  async function openEvidence(evidence: EvidenceItem) {
    if (!evidence.objectKey) return;
    try {
      const result = await request(`evidence/${evidence.id}/access`) as { url: string };
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (evidenceError) {
      setMessage(errorMessage(evidenceError, "Could not open this evidence artifact."));
    }
  }

  if (message && !run) return <div className="recording-page recording-page--loading"><Feedback tone="danger">{message}</Feedback><Button variant="secondary" onClick={() => router.push("/runs")}>Back to Runs</Button></div>;
  if (!run) return <div className="recording-page recording-page--loading"><StatusBadge tone="info">Loading Run</StatusBadge></div>;
  const isAuto = run.mode === "AUTO";
  const activeStep = run.stepResults.find((step) => step.order === run.activeStepOrder && step.status === "PENDING");
  const isActive = run.status === "RUNNING";
  const autoIsLive = run.status === "QUEUED" || run.status === "RUNNING" || run.status === "PAUSED" || run.status === "CANCELLING";
  const screenshots = run.evidence.filter((evidence) => evidence.kind === "SCREENSHOT");
  const groupedEvidence = ["NETWORK", "CONSOLE", "STORAGE", "CAPTURE_ERROR"] as const;
  const checkpointDeadline = run.checkpointDeadline?.replace("T", " ").replace(/\.\d+Z$/, " UTC");

  return <div className="run-page"><header className="recording-bar"><div className="recording-bar__title"><Button variant="ghost" onClick={() => router.push("/runs")} disabled={working}>Back to Runs</Button><h1>{run.testCase.name}</h1></div><div className="recording-bar__actions"><StatusBadge tone={isAuto ? "info" : "neutral"}>{isAuto ? "Auto Run" : "Guided Run"}</StatusBadge><StatusBadge tone={runOutcomeTone(run)}>{runLabel(run)}</StatusBadge>{!isAuto && isActive && <Button variant="danger" onClick={interrupt} disabled={working}>Interrupt Run</Button>}{isAuto && run.status === "PAUSED" && <Button onClick={resumeAutoRun} disabled={working}>Continue</Button>}{isAuto && autoIsLive && run.status !== "CANCELLING" && <Button variant="danger" onClick={cancelAutoRun} disabled={working}>Cancel</Button>}</div></header>{message && <Feedback tone="danger">{message}</Feedback>}<section className="recording-workspace"><aside className="step-panel"><div className="step-panel__head"><div><p className="eyebrow">{isAuto ? "Autonomous replay" : "Guided Run"}</p><h2>{isAuto ? "Replay progress" : "Step Checklist"}</h2><p>{isAuto ? "Sentinel performs recorded actions in strict order and stops for a marked checkpoint." : "Complete each saved step in order. Evidence is captured at each boundary."}</p></div><StatusBadge tone={run.evidenceStatus === "PARTIAL" ? "warning" : "success"}>Evidence {run.evidenceStatus.toLowerCase()}</StatusBadge></div>{isAuto && <div className="auto-run-summary"><p><strong>Attempt history</strong> {run.attempts.map((attempt) => `#${attempt.attemptNumber} ${attempt.status.toLowerCase()}`).join(" · ")}</p>{run.failureReason && <p><strong>Reason:</strong> {run.failureReason.replaceAll("_", " ").toLowerCase()}</p>}{run.status === "PAUSED" && <><p><strong>Checkpoint ready:</strong> Review the screenshot and expected outcome, then Continue or Cancel.</p>{checkpointDeadline && <p><strong>Review window ends:</strong> {checkpointDeadline}</p>}</>}</div>}{run.variableBindings?.length ? <div className="auto-run-summary"><p><strong>Variable sources</strong> {run.variableBindings.map((binding) => `${binding.name}: ${binding.source.toLowerCase()}`).join(" · ")}</p><p>Values are encrypted and masked.</p></div> : null}<div className="step-panel__list">{run.stepResults.map((step) => <article className={`run-step ${step.order === run.activeStepOrder && step.status !== "PASSED" && step.status !== "FAILED" ? "run-step--active" : ""}`} key={step.id}><div className="step-editor__head"><h3>Step {step.order}</h3><StatusBadge tone={step.status === "PASSED" ? "success" : step.status === "FAILED" ? "danger" : step.order === run.activeStepOrder ? "info" : "neutral"}>{step.status.replaceAll("_", " ").toLowerCase()}</StatusBadge></div><p>{runStepLabel(step)}</p>{step.testStep.expectedOutcome && <p className="run-step__expected">Expected: {step.testStep.expectedOutcome}</p>}{step.testStep.isCheckpoint && <p className="run-step__expected">Checkpoint review required after this action.</p>}{!isAuto && isActive && step.id === activeStep?.id && <div className="run-step__actions"><Button onClick={() => completeStep(step, "PASSED")} disabled={working}>Pass step</Button><Button variant="danger" onClick={() => completeStep(step, "FAILED")} disabled={working}>Fail step</Button></div>}</article>)}</div></aside><section className="browser-stage" aria-label={isAuto ? "Auto Run evidence" : "Guided Run browser"}>{!isAuto && isActive && run.viewerUrl ? <iframe title="Guided Run browser" src={run.viewerUrl} allow="clipboard-read; clipboard-write" /> : <div className="auto-run-evidence"><div className="auto-run-evidence__summary"><p className="eyebrow">{isAuto ? "Headless execution" : "Run detail"}</p><h2>{isAuto && autoIsLive ? run.status === "PAUSED" ? "Checkpoint review required" : "Replay in progress" : "Execution evidence"}</h2><p>{isAuto ? "Auto Run uses an isolated headless browser. No browser video is retained." : "Outcome and evidence remain independently reported."}</p>{isAuto && run.activeDurationMs !== null && run.activeDurationMs !== undefined && <p><strong>Active duration:</strong> {Math.round(run.activeDurationMs / 100) / 10}s{run.benchmarkMedianMs ? ` · Guided median: ${Math.round(run.benchmarkMedianMs / 100) / 10}s` : " · Guided benchmark unavailable"}</p>}</div><RunEvidenceDetail screenshots={screenshots} evidence={run.evidence.filter((item) => groupedEvidence.includes(item.kind as typeof groupedEvidence[number]))} onOpenEvidence={openEvidence} /></div>}</section></section><section className="recording-desktop-guidance"><p className="eyebrow">Desktop workspace required</p><h2>Use a wider screen to review this Run.</h2><p>{isAuto ? "Auto Runs retain private screenshots and redacted operational evidence without retaining browser video." : "The saved-step checklist and remote browser work together in a desktop-sized workspace."}</p><Button variant="secondary" onClick={() => router.push("/runs")}>Back to Runs</Button></section></div>;
}

function RunEvidenceDetail({ screenshots, evidence, onOpenEvidence }: { screenshots: EvidenceItem[]; evidence: EvidenceItem[]; onOpenEvidence: (evidence: EvidenceItem) => Promise<void> }) {
  return <div className="run-evidence"><div><p className="eyebrow">Run Detail</p><h2>Evidence timeline</h2><p>Outcome and capture status remain separate. Sensitive values are redacted before persistence.</p></div><section><h3>Screenshots</h3>{screenshots.length === 0 ? <p>No screenshots were captured.</p> : <div className="run-evidence__list">{screenshots.map((item) => <article key={item.id}><div><strong>{String((item.metadata as { label?: string } | null)?.label ?? "Screenshot")}</strong><small>{item.checksum ? `SHA-256 ${item.checksum.slice(0, 12)}…` : "Checksum unavailable"}</small></div><Button variant="secondary" onClick={() => void onOpenEvidence(item)}>Open</Button></article>)}</div>}</section>{["NETWORK", "CONSOLE", "STORAGE", "CAPTURE_ERROR"].map((kind) => { const items = evidence.filter((item) => item.kind === kind); return <section key={kind}><h3>{kind.replace("_", " ").toLowerCase()}</h3>{items.length === 0 ? <p>No {kind.toLowerCase().replace("_", " ")} evidence at this Run boundary.</p> : <div className="run-evidence__metadata">{items.map((item) => <pre key={item.id}>{item.captureError ?? JSON.stringify(item.metadata, null, 2)}</pre>)}</div>}</section>; })}</div>;
}

export function NewRecordingDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { products, loading, error } = useDashboardData();
  const [productId, setProductId] = useState("");
  const [testName, setTestName] = useState("Create customer");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (productId || !products.length) return;
    const storedProductId = window.sessionStorage.getItem(preferredProductStorageKey);
    const nextProductId = products.some((product) => product.id === storedProductId) ? storedProductId ?? products[0].id : products[0].id;
    setProductId(nextProductId);
    if (storedProductId) window.sessionStorage.removeItem(preferredProductStorageKey);
  }, [productId, products]);

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

  return <div className="modal-backdrop" role="presentation"><section className="modal recording-create-modal" role="dialog" aria-modal="true" aria-labelledby="recording-modal-title"><div className="modal__header"><div><p className="eyebrow">Guided test creation</p><h2 id="recording-modal-title">Create recording workspace</h2><p>Choose the Product and name for the approved Demo CRM journey.</p></div><Button type="button" variant="ghost" onClick={onClose}>Close</Button></div><form className="form-stack" onSubmit={createRecording}><Field label="Product"><SelectInput value={productId} onChange={(event) => setProductId(event.target.value)} disabled={loading || products.length === 0}>{products.length === 0 ? <option value="">Create a Product first</option> : products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput></Field><Field label="Test Name"><TextInput value={testName} onChange={(event) => setTestName(event.target.value)} required /></Field><Field label="Website Link" hint="Phase 1 accepts only the isolated Demo CRM target."><TextInput value="http://demo-target" readOnly /></Field>{error && <Feedback tone="danger">{error}</Feedback>}{message && <Feedback tone="danger">{message}</Feedback>}<div className="modal__actions"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!products.length}>Create recording workspace <span aria-hidden="true">→</span></Button></div></form></section></div>;
}

export function RecordingWorkspaceView({ recordingId }: { recordingId: string }) {
  const router = useRouter();
  const [context, setContext] = useState<RecordingContext | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isExitOpen, setIsExitOpen] = useState(false);

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
    setIsLaunching(true);
    setMessage("");
    try {
      const result = await request(`recordings/${context.id}/launch`, "POST", { token: context.token }) as { viewerUrl: string };
      setViewerUrl(result.viewerUrl);
    } catch (launchError) {
      setMessage(errorMessage(launchError, "Could not launch browser."));
    } finally {
      setIsLaunching(false);
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

  if (!context) return <div className="recording-page recording-page--loading"><Feedback tone="warning">{message || "Loading recording workspace…"}</Feedback><Button variant="secondary" onClick={() => router.push("/dashboard")}>Back to dashboard</Button></div>;
  return <div className="recording-page"><header className="recording-bar"><div className="recording-bar__title"><Button variant="ghost" onClick={() => setIsExitOpen(true)} disabled={working}>Back to dashboard</Button><h1>{context.testName}</h1></div><div className="recording-bar__actions"><Button onClick={save} disabled={working}>Save Test</Button><Button variant="danger" onClick={discard} disabled={working}>Discard</Button></div></header>{message && <Feedback tone={toneForMessage(message)}>{message}</Feedback>}<section className="recording-workspace"><aside className="step-panel"><div className="step-panel__head"><div><p className="eyebrow">Live timeline</p><h2>Step Log</h2><p>Actions appear in order. Password values remain redacted.</p></div><StatusBadge tone="info">{steps.length} step{steps.length === 1 ? "" : "s"}</StatusBadge></div><div className="step-panel__list">{steps.length === 0 ? <EmptyState title="Waiting for actions" detail="Launch the browser and interact with the Demo CRM to create your first recorded step." /> : steps.map((step) => <StepEditor key={step.id} step={step} onUpdate={updateStep} />)}</div></aside><section className="browser-stage" aria-label="Live recording browser">{viewerUrl ? <iframe title="Live recording browser" src={viewerUrl} allow="clipboard-read; clipboard-write" /> : <div className="browser-stage__empty"><div className="browser-stage__empty-card"><span className="sentinel-mark" aria-hidden="true"><span /></span><h2>{isLaunching ? "Launching secure browser" : "Browser ready"}</h2><p aria-live="polite">{isLaunching ? "Sentinel is preparing the approved Demo CRM. This normally takes a few seconds." : "Launch the live browser to begin recording the approved Demo CRM journey."}</p><Button onClick={launch} disabled={working}>{isLaunching ? "Launching live browser…" : "Launch live browser"}</Button></div></div>}</section></section><section className="recording-desktop-guidance"><p className="eyebrow">Desktop workspace required</p><h2>Use a wider screen to record a live journey.</h2><p>The browser and editable Step Log work together in a desktop-sized workspace. Return on a larger viewport to continue this draft.</p><Button variant="secondary" onClick={() => setIsExitOpen(true)} disabled={working}>Back to dashboard</Button></section>{isExitOpen && <div className="modal-backdrop" role="presentation"><section className="modal recording-exit-modal" role="dialog" aria-modal="true" aria-labelledby="recording-exit-title"><div className="modal__header"><div><p className="eyebrow">Leave recording</p><h2 id="recording-exit-title">Save or discard this draft</h2><p>Choose how to handle this Test Case before returning to the Dashboard.</p></div><Button type="button" variant="ghost" onClick={() => setIsExitOpen(false)} disabled={working}>Continue recording</Button></div><div className="modal__actions"><Button variant="danger" onClick={discard} disabled={working}>Discard Test Case</Button><Button onClick={save} disabled={working}>Save Test Case</Button></div></section></div>}</div>;
}

function StepEditor({ step, onUpdate }: { step: Step; onUpdate: (step: Step, patch: Partial<Step>) => Promise<void> }) {
  const label = step.target.text || step.target.name || step.target.url || step.target.tag || "Recorded target";
  return <article className="step-editor step"><div className="step-editor__head"><h3>Step {step.order}: {step.kind.replace("_", " ")}</h3><StatusBadge tone={step.isRedacted ? "warning" : step.isCheckpoint ? "success" : "info"}>{step.isRedacted ? "Redacted" : step.isCheckpoint ? "Checkpoint" : "Captured"}</StatusBadge></div><p className="step-editor__target">{label}</p>{step.value && <p className="step-editor__value">Value: {step.value}</p>}{step.suggestion && <div className="feedback feedback--info" role="status">Suggested variable: <strong>{step.suggestion.name}</strong> ({step.suggestion.reason}) <Button type="button" variant="ghost" onClick={() => void onUpdate(step, { variableName: step.suggestion?.name })}>Use suggestion</Button></div>}<Field label="Description"><TextArea defaultValue={step.description ?? ""} onBlur={(event) => void onUpdate(step, { description: event.target.value })} /></Field><Field label="Expected outcome"><TextArea defaultValue={step.expectedOutcome ?? ""} onBlur={(event) => void onUpdate(step, { expectedOutcome: event.target.value })} /></Field>{step.kind === "TEXT_ENTRY" && <Field label="Variable name"><TextInput defaultValue={step.variableName ?? ""} placeholder="Optional variable" onBlur={(event) => void onUpdate(step, { variableName: event.target.value })} /></Field>}<label className="checkpoint-toggle"><input type="checkbox" checked={Boolean(step.isCheckpoint)} onChange={(event) => void onUpdate(step, { isCheckpoint: event.target.checked })} /> <span>Pause Auto Run after this action for review</span></label></article>;
}
