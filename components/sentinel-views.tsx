"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { ThemeControl } from "./theme-control";
import { Button, Card, Dialog, EmptyState, Feedback, Field, Icon, Pagination, PageHeader, SelectInput, SentinelMark, Skeleton, StatusBadge, TextArea, TextInput } from "./ui";
import { OwnershipTransfer } from "./ownership-transfer";

type Product = { id: string; name: string; createdById?: string };
type Step = { id: string; order: number; kind: string; target: Record<string, string>; value?: string | null; isRedacted: boolean; description?: string | null; expectedOutcome?: string | null; variableName?: string | null; isCheckpoint?: boolean };
type FeatureLabel = { featureLabel: { id: string; name: string } };
type TestCaseSummary = { id: string; name: string; ownerId: string; currentVersion: number; product: Product; owner: { displayName: string }; updatedAt: string; featureLabels?: FeatureLabel[] };
type VersionVariable = { name: string; hasStaticDefault: boolean; maskedValue: string | null };
type SavedTestCase = TestCaseSummary & { versions: Array<{ version: number; steps: Step[]; variables?: VersionVariable[]; runs?: Array<{ id: string; mode: string; outcome?: string | null; createdAt: string }> }> };
type TestDataSet = { id: string; name: string; fieldNames: string[]; status: "SAFE" | "RESERVED" | "CONSUMED" | "INVALID"; reusePolicy: "REUSABLE" | "SINGLE_USE"; createdAt?: string };
type GitHubConnection = { id: string; label: string; repositoryFullName: string; repositoryId?: string; defaultBranch: string; branchAllowlist: string[]; status: "ACTIVE" | "PAUSED" | "DISCONNECTED"; analysisEnabled: boolean; linked?: boolean; linkedTestCaseCount?: number; installation?: { accountLogin: string; accountType: string | null; status: string }; createdAt?: string; updatedAt?: string };
type GitHubProductSettings = { available: boolean; canConfigure: boolean; connections: GitHubConnection[] };
type GitHubSourceAnalysis = { id: string; trigger: "GITHUB_FAILURE" | "MANUAL_REQUEST"; commitSha: string; parentSha?: string | null; status: "QUEUED" | "ANALYZING" | "COMPLETED" | "BLOCKED_SENSITIVE_CONTEXT" | "UNAVAILABLE" | "FAILED" | "EXPIRED"; confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE"; provider?: string | null; model?: string | null; observations?: string[] | null; hypotheses?: string[] | null; likelyCause?: string | null; remediation?: string | null; suggestedPatch?: string | null; sourceReferences?: Array<{ path: string; startLine: number; endLine: number; rationale: string }> | null; limitations?: string | null; errorCode?: string | null; completedAt?: string | null; expiresAt?: string; connection: { id: string; label: string; repositoryFullName: string } };
type RecordingContext = { id: string; token: string; testName: string };

const recordingStorageKey = (id: string) => `sentinel-recording:${id}`;
const preferredProductStorageKey = "sentinel-preferred-product";

async function request(path: string, method = "GET", body?: unknown) {
  return apiRequest(path, { method, body, redirectOnUnauthorized: path !== "auth/login" });
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
      await request("auth/login", "POST", { email: form.get("email"), password: form.get("password") });
      router.replace("/dashboard");
    } catch (error) {
      setMessage(errorMessage(error, "Sign in failed."));
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="auth-page">
    <section className="auth-page__story">
      <SentinelMark />
      <p className="eyebrow">QA operations platform</p>
      <h1>Turn browser knowledge into reliable quality signals.</h1>
      <p>Teach a journey once, retain its ownership and intent, then grow toward evidence-backed autonomous quality assurance.</p>
    </section>
    <section className="auth-page__form-wrap">
      <ThemeControl />
      <Card className="auth-card">
        <div className="auth-card__header"><p className="eyebrow">Organization access</p><h2>Sign in to Sentinel</h2><p>Use your organization account to access the local quality workspace.</p></div>
        <form className="auth-form" onSubmit={login}>
          <Field label="Email"><TextInput name="email" defaultValue="ava.tester@example.test" type="email" autoComplete="email" required /></Field>
          <Field label="Password"><TextInput name="password" defaultValue="sentinel-dev" type="password" autoComplete="current-password" required /></Field>
          {message && <Feedback tone="danger">{message}</Feedback>}
          <Button type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}<span aria-hidden="true">→</span></Button>
          <Link href="/forgot-password" className="button button--secondary">Forgot password?</Link>
        </form>
      </Card>
    </section>
  </main>;
}

function useDashboardData() {
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
      setError(message);
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
  return <div className="test-list">{testCases.map((testCase) => <article className="test-list__item" key={testCase.id}><div><p className="test-list__title">{testCase.name}</p><p className="test-list__meta">{testCase.product.name} · {testCase.owner.displayName} · Version {testCase.currentVersion}{testCase.featureLabels?.length ? ` · ${testCase.featureLabels.map((item) => item.featureLabel.name).join(", ")}` : ""}</p></div><Link className="button button--secondary" href={`/test-cases/${testCase.id}`}>Open <span aria-hidden="true">→</span></Link></article>)}</div>;
}

type DashboardMetric = {
  totalSavedTestCases: number;
  completedRuns: number;
  passRate: number | null;
  failedRuns: number;
  flakyTestCases: Array<{ id: string; name: string }>;
  coverage: { current: number; previous: number; change: number };
  latestCompletedRun: { id: string; outcome: string; completedAt: string; testCase: { id: string; name: string } } | null;
};
type DashboardData = {
  products: Product[];
  overview: Array<DashboardMetric & { product: Product }>;
  selected: (DashboardMetric & { product: Product; trend: Array<{ date: string; passed: number; failed: number }> }) | null;
  needsAttention: Array<{ id: string; type: string; createdAt: string; product: { name: string } | null; run: { id: string; testCase: { name: string } } | null }>;
};
type PilotReadinessData = { localOnly: boolean; ready: boolean; items: Array<{ key: string; label: string; status: "READY" | "ATTENTION" | "OPTIONAL"; detail: string }> };

function dashboardDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [productId, setProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [readiness, setReadiness] = useState<PilotReadinessData | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    request(`dashboard${productId ? `?productId=${productId}` : ""}`).then((result) => {
      if (!active) return;
      const next = result as DashboardData;
      setData(next);
    }).catch((loadError) => {
      if (active) setError(errorMessage(loadError, "Could not load health data."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId]);
  useEffect(() => { void request("pilot-readiness").then((result) => setReadiness(result as PilotReadinessData)).catch(() => setReadiness(null)); }, []);

  const selected = data?.selected ?? null;
  const isAllProducts = selected?.product.id === "";
  const trendMaximum = Math.max(1, ...(selected?.trend.map((day) => day.passed + day.failed) ?? []));
  return <div className="dashboard-grid">
    <PageHeader eyebrow="Quality health · rolling 30-day UTC window" title="Dashboard" detail="Recent Test health across the Products you can currently access." actions={<Field label="Product drill-down"><SelectInput value={productId} onChange={(event) => setProductId(event.target.value)} disabled={loading || !data?.products.length}><option value="">All accessible Products</option>{data?.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput></Field>} />
    {error && <Feedback tone="danger">{error}</Feedback>}
    {loading && !data ? <Skeleton lines={5} /> : !selected ? <EmptyState title="No accessible Products" detail="Create a Product, then save a Test Case to begin building health signals." /> : <>
      <section className="metrics metrics--health" aria-label={isAllProducts ? "All accessible Products health metrics" : "Selected Product health metrics"}>
        <Card className="metric-card"><p className="metric-card__label">Saved Test Cases</p><p className="metric-card__value">{selected.totalSavedTestCases}</p><p className="metric-card__detail">{isAllProducts ? "All accessible Products" : "Current Product baseline"}</p></Card>
        <Card className="metric-card"><p className="metric-card__label">Completed Runs</p><p className="metric-card__value">{selected.completedRuns}</p><p className="metric-card__detail">Finished in this window</p></Card>
        <Card className="metric-card"><p className="metric-card__label">Pass rate</p><p className="metric-card__value">{selected.passRate === null ? "—" : `${Math.round(selected.passRate * 100)}%`}</p><p className="metric-card__detail">Interrupted Runs excluded</p></Card>
        <Card className="metric-card"><p className="metric-card__label">Failed Runs</p><p className="metric-card__value">{selected.failedRuns}</p><p className="metric-card__detail">Needs investigation</p></Card>
        <Card className="metric-card"><p className="metric-card__label">Flaky Tests</p><p className="metric-card__value">{selected.flakyTestCases.length}</p><p className="metric-card__detail">Both Passed and Failed</p></Card>
        <Card className="metric-card"><p className="metric-card__label">Coverage change</p><p className="metric-card__value">{selected.coverage.change > 0 ? "+" : ""}{selected.coverage.change}</p><p className="metric-card__detail">{selected.coverage.current} saved vs {selected.coverage.previous} prior</p></Card>
      </section>
      <section className="dashboard-health-layout">
        <Card className="panel-card health-trend-card"><div className="panel-card__head"><div><p className="eyebrow">Run trend</p><h2>{selected.product.name}</h2><p>Daily completed outcomes; empty days are shown intentionally.</p></div><StatusBadge tone="info">UTC</StatusBadge></div><div className="health-trend" role="img" aria-label="Daily passed and failed Run trend for the last 30 days">{selected.trend.map((day) => <div className="health-trend__day" key={day.date} title={`${day.date}: ${day.passed} passed, ${day.failed} failed`}><span className="health-trend__bar health-trend__bar--passed" style={{ height: `${(day.passed / trendMaximum) * 100}%` }} /><span className="health-trend__bar health-trend__bar--failed" style={{ height: `${(day.failed / trendMaximum) * 100}%` }} /></div>)}</div><div className="health-trend__legend"><span><i className="health-trend__key health-trend__key--passed" />Passed</span><span><i className="health-trend__key health-trend__key--failed" />Failed</span></div></Card>
        <Card className="panel-card"><div className="panel-card__head"><div><p className="eyebrow">Latest activity</p><h2>Current signal</h2></div></div>{selected.latestCompletedRun ? <div className="health-latest"><StatusBadge tone={selected.latestCompletedRun.outcome === "PASSED" ? "success" : selected.latestCompletedRun.outcome === "FAILED" ? "danger" : "warning"}>{selected.latestCompletedRun.outcome.toLowerCase()}</StatusBadge><Link href={`/runs/${selected.latestCompletedRun.id}`}>{selected.latestCompletedRun.testCase.name}</Link><p>{dashboardDate(selected.latestCompletedRun.completedAt)}</p></div> : <EmptyState title="No completed Runs" detail="Complete a guided or Auto Run to establish a health signal." />}</Card>
      </section>
      <section className="dashboard-health-layout">
        <Card className="panel-card"><div className="panel-card__head"><div><p className="eyebrow">Stability</p><h2>Flaky current Tests</h2></div><StatusBadge tone={selected.flakyTestCases.length ? "warning" : "success"}>{selected.flakyTestCases.length ? "Review" : "Stable"}</StatusBadge></div>{selected.flakyTestCases.length ? <div className="health-link-list">{selected.flakyTestCases.map((testCase) => <Link key={testCase.id} href={`/test-cases/${testCase.id}`}>{testCase.name}<span aria-hidden="true">→</span></Link>)}</div> : <p className="health-empty-copy">No current Test Case version has both Passed and Failed Runs in this window.</p>}</Card>
        <Card className="panel-card"><div className="panel-card__head"><div><p className="eyebrow">Needs attention</p><h2>Unread action items</h2></div><Link className="button button--secondary" href="/notifications">Open inbox</Link></div>{data?.needsAttention.length ? <div className="health-link-list">{data.needsAttention.map((notification) => <Link key={notification.id} href={notification.run ? `/runs/${notification.run.id}` : "/notifications"}><span>{notification.type === "AUTO_RUN_CHECKPOINT" ? "Checkpoint review" : "Run failed"} · {notification.run?.testCase.name ?? notification.product?.name}</span><small>{dashboardDate(notification.createdAt)}</small></Link>)}</div> : <p className="health-empty-copy">No unread failure or checkpoint items need your attention.</p>}</Card>
      </section>
      <Card className="panel-card"><div className="panel-card__head"><div><p className="eyebrow">All accessible Products</p><h2>Health overview</h2></div><StatusBadge tone="info">{data?.overview.length ?? 0} Products</StatusBadge></div><div className="health-overview">{data?.overview.map((item) => <button type="button" key={item.product.id} className={`health-overview__row ${item.product.id === selected.product.id ? "health-overview__row--selected" : ""}`} onClick={() => setProductId(item.product.id)}><strong>{item.product.name}</strong><span>{item.totalSavedTestCases} Tests</span><span>{item.passRate === null ? "No pass rate" : `${Math.round(item.passRate * 100)}% pass`}</span><StatusBadge tone={item.latestCompletedRun?.outcome === "FAILED" ? "danger" : item.latestCompletedRun?.outcome === "PASSED" ? "success" : "neutral"}>{item.latestCompletedRun?.outcome?.toLowerCase() ?? "No Runs"}</StatusBadge></button>)}</div></Card>
      {readiness && <details className="operational-readiness"><summary><span><span className="eyebrow">Controlled internal pilot</span><strong>Operational readiness</strong><small>{readiness.localOnly ? "Local services and access boundary" : "Deployment services"}</small></span><StatusBadge tone={readiness.ready ? "success" : "warning"}>{readiness.ready ? "Ready" : "Needs attention"}</StatusBadge></summary><div className="pilot-readiness__list">{readiness.items.map((item) => <div className="pilot-readiness__item" key={item.key}><div><strong>{item.label}</strong><p>{item.detail}</p></div><StatusBadge tone={item.status === "READY" ? "success" : item.status === "ATTENTION" ? "warning" : "info"}>{item.status.toLowerCase()}</StatusBadge></div>)}</div></details>}
    </>}
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
  return <div className="dashboard-grid">
    <PageHeader eyebrow="Product configuration" title="Products" detail="Create and manage the Product contexts available for guided Test Case recording." actions={<Button className="product-create-action" type="button" onClick={() => openProductModal()}>New product <span aria-hidden="true">+</span></Button>} />
    {error && <Feedback tone="danger">{error}</Feedback>}{productMessage && !isCreateProductOpen && <Feedback tone={toneForMessage(productMessage)}>{productMessage}</Feedback>}
    <section className="products-layout products-layout--single"><Card className="panel-card"><div className="panel-card__head"><div><p className="eyebrow">Accessible Products</p><h2>Your Product contexts</h2><p>Products are private to their members and persist between sessions.</p></div><StatusBadge tone="info">{products.length} total</StatusBadge></div>{loading ? <StatusBadge tone="info">Loading Products</StatusBadge> : products.length === 0 ? <EmptyState title="No Products yet" detail="Create your first Product to start a guided recording." /> : <div className="product-list">{products.map((product) => { const testCount = testCases.filter((testCase) => testCase.product.id === product.id).length; return <article className="product-list__item" key={product.id}><div><h3>{product.name}</h3><p>{testCount} saved Test Case{testCount === 1 ? "" : "s"}</p></div><div className="product-list__actions"><GitHubProjectSettings product={product} /><JiraProjectSettings product={product} /><Button type="button" variant="secondary" onClick={() => openProductModal(product)}>Edit</Button>{product.createdById && <OwnershipTransfer label="Product" currentOwnerId={product.createdById} membersPath={`products/${product.id}/members`} transferPath={`products/${product.id}/owner`} onTransferred={() => window.location.reload()} />}<Link className="button button--secondary" href={`/test-cases?productId=${product.id}`}>View Test Cases</Link></div></article>; })}</div>}</Card></section>
    {isCreateProductOpen && <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title"><div className="modal__header"><div><p className="eyebrow">{isEditing ? "Product settings" : "New Product"}</p><h2 id="product-modal-title">{isEditing ? "Edit Product" : "Create new Product"}</h2><p>{isEditing ? "Update the Product name used to organize your Test Cases." : "A Product needs a name and is immediately available for your next recording."}</p></div><Button type="button" variant="ghost" onClick={() => setIsCreateProductOpen(false)}>Close</Button></div><form className="form-stack" onSubmit={saveProduct}><Field label="Product name"><TextInput value={newProductName} onChange={(event) => setNewProductName(event.target.value)} placeholder="e.g. Billing Portal" autoFocus required /></Field>{productMessage && <Feedback tone={toneForMessage(productMessage)}>{productMessage}</Feedback>}<div className="modal__actions"><Button type="button" variant="ghost" onClick={() => setIsCreateProductOpen(false)}>Cancel</Button><Button type="submit">{isEditing ? "Save changes" : "Create Product"} <span aria-hidden="true">{isEditing ? "→" : "+"}</span></Button></div></form></section></div>}
  </div>;
}

function GitHubProjectSettings({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<GitHubProductSettings | null>(null);
  const [activity, setActivity] = useState<Array<{ id: string; status: string; decisionReason?: string | null; queuedRunCount: number; excludedTests?: Array<{ name: string; reason: string }> | null; delivery: { branch?: string | null; afterSha?: string | null; receivedAt: string }; connection: { label: string; repositoryFullName: string }; runs: Array<{ id: string; status: string; outcome?: string | null; testCaseName: string; sourceAnalysisStatus?: string | null }> }>>([]);
  const [label, setLabel] = useState("");
  const [repositoryFullName, setRepositoryFullName] = useState("");
  const [branches, setBranches] = useState("main");
  const [editingConnection, setEditingConnection] = useState<GitHubConnection | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingDefaultBranch, setEditingDefaultBranch] = useState("");
  const [editingBranches, setEditingBranches] = useState("");
  const [editingAnalysisEnabled, setEditingAnalysisEnabled] = useState(true);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  const load = async () => {
    try {
      const [nextSettings, nextActivity] = await Promise.all([request(`products/${product.id}/github`) as Promise<GitHubProductSettings>, request(`products/${product.id}/github/activity`) as Promise<typeof activity>]);
      setSettings(nextSettings);
      setActivity(nextActivity);
    } catch (error) {
      setMessage(errorMessage(error, "Could not load GitHub repository settings."));
    }
  };

  useEffect(() => { if (open) void load(); }, [open, product.id]);

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setMessage("");
    try {
      await request(`products/${product.id}/github/connections`, "POST", { label, repositoryFullName, branchAllowlist: branches.split(",").map((branch) => branch.trim()).filter(Boolean) });
      setLabel("");
      setRepositoryFullName("");
      setBranches("main");
      setMessage("GitHub repository connected. Link saved Test Cases to let allowed pushes queue Auto Runs.");
      await load();
    } catch (error) {
      setMessage(errorMessage(error, "Could not connect the GitHub repository."));
    } finally {
      setWorking(false);
    }
  }

  async function changeConnection(connection: GitHubConnection, body: Record<string, unknown>) {
    setWorking(true);
    setMessage("");
    try {
      await request(`products/${product.id}/github/connections/${connection.id}`, "PATCH", body);
      setMessage("Repository settings updated.");
      setEditingConnection(null);
      await load();
    } catch (error) {
      setMessage(errorMessage(error, "Could not update the GitHub repository connection."));
    } finally {
      setWorking(false);
    }
  }

  function beginEdit(connection: GitHubConnection) {
    setMessage("");
    setEditingConnection(connection);
    setEditingLabel(connection.label);
    setEditingDefaultBranch(connection.defaultBranch);
    setEditingBranches(connection.branchAllowlist.join(", "));
    setEditingAnalysisEnabled(connection.analysisEnabled);
  }

  async function saveConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingConnection) return;
    await changeConnection(editingConnection, {
      label: editingLabel,
      defaultBranch: editingDefaultBranch,
      branchAllowlist: editingBranches.split(",").map((branch) => branch.trim()).filter(Boolean),
      analysisEnabled: editingAnalysisEnabled
    });
  }

  async function disconnect(connection: GitHubConnection) {
    setWorking(true);
    setMessage("");
    try {
      await request(`products/${product.id}/github/connections/${connection.id}`, "DELETE");
      setMessage("Repository disconnected. Historical Runs and analyses remain available to authorized members.");
      await load();
    } catch (error) {
      setMessage(errorMessage(error, "Could not disconnect the GitHub repository."));
    } finally {
      setWorking(false);
    }
  }

  return <>
    <Button type="button" variant="secondary" onClick={() => setOpen(true)}>GitHub</Button>
    {open && <div className="modal-backdrop" role="presentation">
      <section className="modal github-settings-modal" role="dialog" aria-modal="true" aria-labelledby={`github-settings-${product.id}`}>
        <div className="modal__header"><div><p className="eyebrow">Optional source automation</p><h2 id={`github-settings-${product.id}`}>GitHub repositories</h2><p>Connect frontend, backend, or other repositories separately. GitHub App credentials and source content remain server-side.</p></div><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Close</Button></div>
        {message && <Feedback tone={message.startsWith("GitHub repository") || message.startsWith("Repository disconnected") || message.startsWith("Repository settings") ? "success" : "danger"}>{message}</Feedback>}
        {!settings ? <Skeleton lines={4} /> : !settings.available ? <EmptyState title="GitHub App is not configured" detail="Add the server-only GitHub App settings before connecting a disposable sandbox repository." /> : <div className="form-stack">
          <section className="github-settings__section">
            <div className="panel-card__head"><div><p className="eyebrow">Connected repositories</p><h3>{settings.connections.length} connection{settings.connections.length === 1 ? "" : "s"}</h3></div><StatusBadge tone="info">Product-scoped</StatusBadge></div>
            {settings.connections.length === 0 ? <p className="health-empty-copy">No repository is connected yet. Existing Product workflows remain unchanged.</p> : <div className="run-list">{settings.connections.map((connection) => <article className="run-list__item" key={connection.id}><div><div className="run-list__head"><h3>{connection.label}</h3><StatusBadge tone={connection.status === "ACTIVE" ? "success" : connection.status === "PAUSED" ? "warning" : "neutral"}>{connection.status.toLowerCase()}</StatusBadge><StatusBadge tone={connection.analysisEnabled ? "info" : "neutral"}>{connection.analysisEnabled ? "analysis on" : "analysis off"}</StatusBadge></div><p><code>{connection.repositoryFullName}</code> · default {connection.defaultBranch} · allowed {connection.branchAllowlist.join(", ")} · {connection.linkedTestCaseCount ?? 0} linked Test Cases</p></div>{settings.canConfigure && connection.status !== "DISCONNECTED" && <div className="run-step__actions"><Button type="button" variant="secondary" onClick={() => beginEdit(connection)} disabled={working}>Edit</Button><Button type="button" variant="secondary" onClick={() => void changeConnection(connection, { status: connection.status === "ACTIVE" ? "PAUSED" : "ACTIVE" })} disabled={working}>{connection.status === "ACTIVE" ? "Pause" : "Resume"}</Button><Button type="button" variant="danger" onClick={() => void disconnect(connection)} disabled={working}>Disconnect</Button></div>}</article>)}</div>}
          </section>
          {editingConnection && <form className="form-stack github-settings__section" onSubmit={saveConnection}><div className="panel-card__head"><div><p className="eyebrow">Edit connection</p><h3>{editingConnection.repositoryFullName}</h3><p>Changes affect future webhook routing only. Existing Run history is unchanged.</p></div><Button type="button" variant="ghost" onClick={() => setEditingConnection(null)}>Close</Button></div><Field label="Connection label"><TextInput value={editingLabel} onChange={(event) => setEditingLabel(event.target.value)} maxLength={64} required /></Field><Field label="Default branch"><TextInput value={editingDefaultBranch} onChange={(event) => setEditingDefaultBranch(event.target.value)} placeholder="main" required /></Field><Field label="Allowed branches" hint="Separate literal branch names with commas. Use * only to allow every branch."><TextInput value={editingBranches} onChange={(event) => setEditingBranches(event.target.value)} placeholder="main, release-2026" required /></Field><label className="github-settings__checkbox"><input type="checkbox" checked={editingAnalysisEnabled} onChange={(event) => setEditingAnalysisEnabled(event.target.checked)} /> Enable automatic failure analysis for GitHub-triggered failed Runs</label><Button type="submit" disabled={working}>{working ? "Saving…" : "Save repository settings"}</Button></form>}
          {settings.canConfigure && <form className="form-stack github-settings__section" onSubmit={connect}><div><p className="eyebrow">Connect repository</p><h3>Use a GitHub App-installed repository</h3><p>Sentinel verifies the repository through the server-only App. No token belongs in this form.</p></div><Field label="Connection label"><TextInput value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Frontend" maxLength={64} required /></Field><Field label="Repository"><TextInput value={repositoryFullName} onChange={(event) => setRepositoryFullName(event.target.value)} placeholder="organization/repository" required /></Field><Field label="Allowed branches" hint="Separate literal branch names with commas. Use * only to allow every branch."><TextInput value={branches} onChange={(event) => setBranches(event.target.value)} placeholder="main, release-2026" required /></Field><Button type="submit" disabled={working}>{working ? "Verifying…" : "Connect repository"}</Button></form>}
          <section className="github-settings__section"><div><p className="eyebrow">GitHub activity</p><h3>Recent delivery decisions</h3><p>Only safe routing metadata is retained; webhook payloads and source code are never displayed.</p></div>{activity.length === 0 ? <p className="health-empty-copy">No signed push deliveries have reached this Product yet.</p> : <div className="run-list">{activity.map((item) => <article className="run-list__item" key={item.id}><div><div className="run-list__head"><h3>{item.connection.label}</h3><StatusBadge tone={item.status === "PROCESSED" ? "success" : item.status === "IGNORED" ? "neutral" : "warning"}>{item.status.toLowerCase()}</StatusBadge></div><p><code>{item.delivery.branch ?? "unknown branch"}</code> · {(item.delivery.afterSha ?? "unknown").slice(0, 12)} · {item.queuedRunCount} queued · {item.excludedTests?.length ?? 0} excluded</p>{item.decisionReason && <p>{item.decisionReason.replaceAll("_", " ").toLowerCase()}</p>}{item.runs.map((run) => <Link key={run.id} href={`/runs/${run.id}`}>{run.testCaseName} · {run.outcome?.toLowerCase() ?? run.status.toLowerCase()}{run.sourceAnalysisStatus ? ` · diagnosis ${run.sourceAnalysisStatus.toLowerCase()}` : ""}</Link>)}</div></article>)}</div>}</section>
        </div>}
      </section>
    </div>}
  </>;
}

function JiraProjectSettings({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [projectKey, setProjectKey] = useState("");
  const [canConfigure, setCanConfigure] = useState(false);
  const [available, setAvailable] = useState(false);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!open) return;
    request(`products/${product.id}/jira`).then((result) => {
      const config = result as { projectKey: string | null; canConfigure: boolean; available: boolean };
      setProjectKey(config.projectKey ?? "");
      setCanConfigure(config.canConfigure);
      setAvailable(config.available);
    }).catch((error) => setMessage(errorMessage(error, "Could not load Jira configuration.")));
  }, [open, product.id]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setMessage("");
    try {
      await request(`products/${product.id}/jira`, "PUT", { projectKey });
      setMessage("Jira project mapping saved and validated.");
    } catch (error) {
      setMessage(errorMessage(error, "Could not save Jira configuration."));
    } finally {
      setWorking(false);
    }
  }

  return <><Button type="button" variant="secondary" onClick={() => setOpen(true)}>Jira</Button>{open && <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby={`jira-config-${product.id}`}><div className="modal__header"><div><p className="eyebrow">Optional integration</p><h2 id={`jira-config-${product.id}`}>Jira Cloud</h2><p>Only the Product creator can change this Product’s Jira project. Credentials remain server-side.</p></div><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Close</Button></div>{!available ? <Feedback tone="danger">Jira Cloud has not been configured for this Sentinel deployment.</Feedback> : !canConfigure ? <Feedback tone="danger">Only the Product creator can change this Jira mapping.</Feedback> : <form className="form-stack" onSubmit={save}><Field label="Jira project key"><TextInput value={projectKey} onChange={(event) => setProjectKey(event.target.value.toUpperCase())} placeholder="e.g. CRM" required /></Field>{message && <Feedback tone={message.includes("saved") ? "success" : "danger"}>{message}</Feedback>}<div className="modal__actions"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={working}>{working ? "Validating…" : "Save mapping"}</Button></div></form>}</section></div>}</>;
}

export function TestDataView() {
  const searchParams = useSearchParams();
  const requestedProductId = searchParams.get("productId") ?? "";
  const { products, loading, error } = useDashboardData();
  const appliedRequestedProductId = useRef<string | null>(null);
  const [productId, setProductId] = useState(requestedProductId);
  const [dataSets, setDataSets] = useState<TestDataSet[]>([]);
  const [message, setMessage] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [fieldsText, setFieldsText] = useState("customer_email=");
  const [reusePolicy, setReusePolicy] = useState<"REUSABLE" | "SINGLE_USE">("REUSABLE");

  useEffect(() => {
    if (!products.length) return;
    if (appliedRequestedProductId.current !== requestedProductId) {
      appliedRequestedProductId.current = requestedProductId;
      setProductId(products.some((product) => product.id === requestedProductId) ? requestedProductId : products[0].id);
      return;
    }
    if (!products.some((product) => product.id === productId)) setProductId(products[0].id);
  }, [productId, products, requestedProductId]);
  useEffect(() => { if (!productId) return; request(`products/${productId}/test-data`).then((result) => setDataSets(result as TestDataSet[])).catch((loadError) => setMessage(errorMessage(loadError, "Could not load Test Data Sets."))); }, [productId]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields: Record<string, string> = {};
    for (const line of fieldsText.split("\n")) { const [field, ...parts] = line.split("="); if (field?.trim()) fields[field.trim()] = parts.join("=").trim(); }
    try { const created = await request(`products/${productId}/test-data`, "POST", { name, fields, reusePolicy }) as TestDataSet; setDataSets((all) => [created, ...all]); setName(""); setFieldsText("customer_email="); setReusePolicy("REUSABLE"); setIsCreateOpen(false); setMessage("Test Data Set created. Stored values are masked after creation."); } catch (createError) { setMessage(errorMessage(createError, "Could not create the Test Data Set.")); }
  }

  async function invalidate(dataSet: TestDataSet) {
    try { const updated = await request(`products/${productId}/test-data/${dataSet.id}/invalidate`, "POST") as TestDataSet; setDataSets((all) => all.map((item) => item.id === updated.id ? { ...item, ...updated } : item)); } catch (invalidateError) { setMessage(errorMessage(invalidateError, "Could not invalidate this Test Data Set.")); }
  }

  return <div className="dashboard-grid"><PageHeader eyebrow="Reusable run inputs" title="Test Data" detail="Create product-scoped data sets once. Values are encrypted and cannot be viewed after creation." actions={<Button type="button" onClick={() => setIsCreateOpen(true)} disabled={!productId}>New Test Data <span aria-hidden="true">+</span></Button>} />{error && <Feedback tone="danger">{error}</Feedback>}{message && <Feedback tone={toneForMessage(message)}>{message}</Feedback>}<Card className="panel-card"><div className="inventory-toolbar"><Field label="Product"><SelectInput value={productId} onChange={(event) => setProductId(event.target.value)} disabled={loading}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput></Field></div>{dataSets.length === 0 ? <EmptyState title="No Test Data Sets" detail="Create a reusable set for variable-marked Test Cases in this Product." /> : <div className="run-list">{dataSets.map((dataSet) => <article className="run-list__item" key={dataSet.id}><div><div className="run-list__head"><h2>{dataSet.name}</h2><StatusBadge tone={dataSet.reusePolicy === "REUSABLE" ? "info" : "warning"}>{dataSet.reusePolicy === "REUSABLE" ? "reusable" : "single-use"}</StatusBadge><StatusBadge tone={dataSet.status === "SAFE" ? "success" : dataSet.status === "RESERVED" ? "warning" : "neutral"}>{dataSet.status.toLowerCase()}</StatusBadge></div><p>Fields: {dataSet.fieldNames.join(", ")} · {dataSet.reusePolicy === "REUSABLE" ? "Reusable sequentially." : "Consumed after a passed Run."} Stored values remain masked.</p></div>{dataSet.status === "SAFE" && <Button variant="danger" onClick={() => void invalidate(dataSet)}>Invalidate</Button>}</article>)}</div>}</Card>{isCreateOpen && <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="test-data-title"><div className="modal__header"><div><p className="eyebrow">Local Test Data</p><h2 id="test-data-title">Create Test Data Set</h2><p>Enter one `variable_name=value` field per line. Sentinel encrypts values and never displays them again.</p></div><Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Close</Button></div><form className="form-stack" onSubmit={create}><Field label="Data Set name"><TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. New customer fixture" required /></Field><Field label="Reuse policy"><SelectInput value={reusePolicy} onChange={(event) => setReusePolicy(event.target.value as "REUSABLE" | "SINGLE_USE")}><option value="REUSABLE">Reusable — return to safe after every Run</option><option value="SINGLE_USE">Single-use — consume after a passed Run</option></SelectInput></Field><Field label="Fields"><TextArea value={fieldsText} onChange={(event) => setFieldsText(event.target.value)} rows={5} required /></Field><div className="modal__actions"><Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button><Button type="submit">Create Test Data</Button></div></form></section></div>}</div>;
}

export function TestCasesView() {
  const { products, testCases, loading, error } = useDashboardData();
  const searchParams = useSearchParams();
  const [productId, setProductId] = useState(() => searchParams.get("productId") ?? "");
  const [query, setQuery] = useState("");
  const [label, setLabel] = useState("");
  const [page, setPage] = useState(1);
  const labels = [...new Set(testCases.flatMap((testCase) => testCase.featureLabels?.map((item) => item.featureLabel.name) ?? []))].sort((left, right) => left.localeCompare(right));
  const filtered = useMemo(() => testCases.filter((testCase) => (!productId || testCase.product.id === productId) && (!label || testCase.featureLabels?.some((item) => item.featureLabel.name === label)) && testCase.name.toLowerCase().includes(query.toLowerCase())), [label, productId, query, testCases]);
  const pageSize = 25;
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [label, productId, query]);

  return <div className="dashboard-grid"><PageHeader eyebrow="Test library" title="Test Cases" detail="Browse the reusable, product-owned journeys available to you." actions={<StatusBadge tone="info">{filtered.length} / {testCases.length} visible Test Case{testCases.length === 1 ? "" : "s"}</StatusBadge>} />{error && <Feedback tone="danger">{error}</Feedback>}<Card className="panel-card"><div className="inventory-toolbar"><Field label="Filter by Product"><SelectInput value={productId} onChange={(event) => setProductId(event.target.value)} disabled={loading}><option value="">All accessible Products</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput></Field><Field label="Find a Test Case"><TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by Test Case name" /></Field><Field label="Filter by feature label"><SelectInput value={label} onChange={(event) => setLabel(event.target.value)}><option value="">All labels</option>{labels.map((item) => <option key={item} value={item}>{item}</option>)}</SelectInput></Field></div>{loading ? <Skeleton lines={6} /> : <div className="form-stack"><TestCaseList testCases={visible} /></div>}<Pagination page={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} label="Test Cases" /></Card></div>;
}

export function TestCaseDetailView({ testCaseId }: { testCaseId: string }) {
  const router = useRouter();
  const [testCase, setTestCase] = useState<SavedTestCase | null>(null);
  const [message, setMessage] = useState("");
  const [startingRun, setStartingRun] = useState<"GUIDED" | "AUTO" | null>(null);
  const [bindingMode, setBindingMode] = useState<"GUIDED" | "AUTO" | null>(null);
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);

  useEffect(() => {
    request(`test-cases/${testCaseId}`).then((result) => setTestCase(result as SavedTestCase)).catch((loadError) => {
      const error = errorMessage(loadError, "Could not open this Test Case.");
      setMessage(error);
    });
  }, [testCaseId]);

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

  async function generateSuggestions() {
    setGeneratingSuggestions(true);
    setMessage("");
    try {
      const result = await request(`test-cases/${testCaseId}/suggestions`, "POST") as { created: number; existing: number; skipped: Array<{ order: number }> };
      setMessage(`Suggestions generated: ${result.created} new, ${result.existing} already known, ${result.skipped.length} skipped.`);
    } catch (generationError) {
      setMessage(errorMessage(generationError, "Could not generate suggestions."));
    } finally {
      setGeneratingSuggestions(false);
    }
  }

  if (!testCase) return message ? <Feedback tone="danger">{message}</Feedback> : <Card className="panel-card"><StatusBadge tone="info">Loading saved Test Case</StatusBadge></Card>;
  const steps = testCaseSteps(testCase);
  const variables = testCase.versions.find((version) => version.version === testCase.currentVersion)?.variables ?? [];
  const begin = (mode: "GUIDED" | "AUTO") => variables.length ? setBindingMode(mode) : void startRun(mode);
  return <div className="dashboard-grid"><div className="breadcrumbs"><Link href="/dashboard">Dashboard</Link><span aria-hidden="true">/</span><Link href="/test-cases">Test Cases</Link><span aria-hidden="true">/</span><span>{testCase.name}</span></div>{message && <Feedback tone={message.startsWith("Suggestions generated") ? "success" : "danger"}>{message}</Feedback>}<Card className="detail-card"><PageHeader eyebrow="Saved Test Case" title={testCase.name} detail="This current version is read-only. Start a guided evidence session or a separate autonomous replay." actions={<><StatusBadge tone="success">Version {testCase.currentVersion}</StatusBadge><Button variant="secondary" onClick={() => begin("GUIDED")} disabled={Boolean(startingRun) || steps.length === 0}>{startingRun === "GUIDED" ? "Starting Run…" : "Guided Run"}</Button><Button onClick={() => begin("AUTO")} disabled={Boolean(startingRun) || steps.length === 0}>{startingRun === "AUTO" ? "Queueing Auto Run…" : "Auto Run"}</Button><details className="action-menu"><summary className="button button--secondary">More actions</summary><div><Link href={`/test-cases/${testCase.id}/edit`}>Edit Test</Link><Button variant="ghost" onClick={() => void generateSuggestions()} disabled={generatingSuggestions || steps.length === 0}>{generatingSuggestions ? "Generating…" : "Generate suggestions"}</Button><Link href={`/review?testCaseId=${testCase.id}`}>Open Review</Link><OwnershipTransfer label="Test Case" currentOwnerId={testCase.ownerId} membersPath={`products/${testCase.product.id}/members`} transferPath={`test-cases/${testCase.id}/owner`} onTransferred={() => window.location.reload()} /></div></details></>} /><div className="detail-meta"><span>{testCase.product.name}</span><span aria-hidden="true">•</span><span>Owner: {testCase.owner.displayName}</span><span aria-hidden="true">•</span><span>{steps.length} recorded step{steps.length === 1 ? "" : "s"}</span>{testCase.featureLabels?.map((item) => <StatusBadge key={item.featureLabel.id} tone="info">{item.featureLabel.name}</StatusBadge>)}</div></Card>{variables.length > 0 && <Card className="detail-card"><div className="panel-card__head"><div><p className="eyebrow">Variable configuration</p><h2>Variables</h2><p>Static defaults are encrypted. Stored values are never shown after entry.</p></div></div><div className="run-evidence__list">{variables.map((variable) => <article key={variable.name}><div><strong>{variable.name}</strong><small>{steps.filter((step) => step.variableName === variable.name).map((step) => `Step ${step.order}`).join(" · ")} · {variable.maskedValue ?? "No static default"}</small></div><StaticVariableEditor testCaseId={testCase.id} variable={variable} onSaved={(updated) => setTestCase((current) => current ? { ...current, versions: current.versions.map((version) => version.version === current.currentVersion ? { ...version, variables: (version.variables ?? []).map((item) => item.name === updated.name ? updated : item) } : version) } : current)} /></article>)}</div></Card>}<RepositoryRouting testCaseId={testCase.id} /><Card className="detail-card"><div className="panel-card__head"><div><p className="eyebrow">Current version timeline</p><h2>Recorded steps</h2><p>Descriptions, outcomes, variables, and checkpoints are persisted from recording.</p></div></div>{steps.length === 0 ? <EmptyState title="No recorded steps" detail="This Test Case was saved without recorded browser activity." /> : <div className="timeline">{steps.map((step) => <StepTimelineItem key={step.id} step={step} />)}</div>}</Card><Card className="detail-card"><div className="panel-card__head"><div><p className="eyebrow">Immutable history</p><h2>Version history</h2><p>Earlier versions and their Run summaries stay read-only.</p></div></div><div className="run-list">{testCase.versions.map((version) => <article className="run-list__item" key={version.version}><div><div className="run-list__head"><h2>Version {version.version}</h2><StatusBadge tone={version.version === testCase.currentVersion ? "success" : "neutral"}>{version.version === testCase.currentVersion ? "current" : "historical"}</StatusBadge></div><p>{version.steps.length} saved step{version.steps.length === 1 ? "" : "s"} · {version.runs?.length ?? 0} linked Run{(version.runs?.length ?? 0) === 1 ? "" : "s"}</p></div></article>)}</div></Card>{bindingMode && <VariableBindingDialog mode={bindingMode} productId={testCase.product.id} variables={variables} onClose={() => setBindingMode(null)} onStart={async (bindings) => { setBindingMode(null); await startRun(bindingMode, bindings); }} />}</div>;
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

function RepositoryRouting({ testCaseId }: { testCaseId: string }) {
  const [routing, setRouting] = useState<{ available: boolean; canEdit: boolean; connections: GitHubConnection[] } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    request(`test-cases/${testCaseId}/github`).then((result) => {
      const settings = result as { available: boolean; canEdit: boolean; connections: GitHubConnection[] };
      setRouting(settings);
      setSelectedIds(settings.connections.filter((connection) => connection.linked).map((connection) => connection.id));
    }).catch((error) => setMessage(errorMessage(error, "Could not load GitHub routing.")));
  }, [testCaseId]);

  function toggleConnection(connectionId: string, checked: boolean) {
    setSelectedIds((current) => checked ? [...new Set([...current, connectionId])] : current.filter((id) => id !== connectionId));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      await request(`test-cases/${testCaseId}/github`, "PATCH", { connectionIds: selectedIds });
      setMessage("GitHub routing saved. Only future allowed pushes can queue this Test Case.");
    } catch (error) {
      setMessage(errorMessage(error, "Could not save GitHub routing."));
    } finally {
      setSaving(false);
    }
  }

  if (!routing) return <Card className="detail-card github-routing"><Skeleton lines={2} /></Card>;
  const activeConnections = routing.connections.filter((connection) => connection.status === "ACTIVE");
  return <Card className="detail-card github-routing">
    <div className="panel-card__head"><div><p className="eyebrow">Optional GitHub automation</p><h2>Repository routing</h2><p>Link this Test Case to one or more Product repositories. A matching allowed push may queue its existing safe Auto Run.</p></div><StatusBadge tone={selectedIds.length ? "info" : "neutral"}>{selectedIds.length} linked</StatusBadge></div>
    {!routing.available ? <EmptyState title="GitHub App unavailable" detail="This deployment has no GitHub App configuration. Manual and ordinary Auto Runs remain unchanged." action={<Link className="button button--secondary" href="/products">Open Products</Link>} /> : activeConnections.length === 0 ? <EmptyState title="No active Product repositories" detail="An Admin or assigned Manager must connect and activate a Product repository before this Test Case can be triggered by a GitHub push." action={<Link className="button button--secondary" href="/products">Open Products</Link>} /> : <div className="form-stack">
      <div className="github-routing__list">{activeConnections.map((connection) => <label className="github-routing__item" key={connection.id}><input type="checkbox" checked={selectedIds.includes(connection.id)} onChange={(event) => toggleConnection(connection.id, event.target.checked)} disabled={!routing.canEdit || saving} /><span><strong>{connection.label}</strong><small><code>{connection.repositoryFullName}</code> · allowed {connection.branchAllowlist.join(", ")}</small></span></label>)}</div>
      {!routing.canEdit && <Feedback tone="warning">Your role can view routing, but only a Manager, Admin, or this Test Case’s Tester owner can change it.</Feedback>}
      {message && <Feedback tone={message.startsWith("GitHub routing saved") ? "success" : "danger"}>{message}</Feedback>}
      {routing.canEdit && <div><Button type="button" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save GitHub routing"}</Button></div>}
    </div>}
  </Card>;
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
type JiraFiling = { id: string; status: "DRAFT" | "QUEUED" | "FILED" | "FAILED"; action: "CREATE" | "COMMENT" | null; summary: string; description: string; priority: "Lowest" | "Low" | "Medium" | "High" | "Highest"; attemptCount: number; deliveryError: string | null; jiraIssue: { key: string; url: string; isOpen: boolean } | null };
type ChangeProposal = { id: string; status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "STALE"; context: string; appliedVersion?: number | null; changes: Array<{ sourceStepId: string; order: number; proposedDescription: string | null; proposedExpectedOutcome: string | null }> };
type DatabaseDiagnostic = { id: string; kind: "CUSTOMER_LOOKUP_BY_EMAIL"; status: "COMPLETE" | "INCOMPLETE" | "UNAVAILABLE"; safeMetadata: unknown; errorCode: string | null; completedAt: string | null };
type RunDetail = Omit<RunSummary, "stepResults"> & { activeStepOrder?: number | null; startedAt?: string | null; completedAt?: string | null; checkpointDeadline?: string | null; failureReason?: string | null; activeDurationMs?: number | null; benchmarkMedianMs?: number | null; durationDeltaMs?: number | null; testCaseVersion: { version: number }; stepResults: RunStepResult[]; attempts: RunAttempt[]; evidence: EvidenceItem[]; variableBindings?: Array<{ name: string; source: "STATIC" | "POOL" | "MANUAL"; dataSetId?: string | null }>; jiraFiling?: JiraFiling | null; changeProposal?: ChangeProposal | null; databaseDiagnostics?: DatabaseDiagnostic[]; githubRunLink?: { repositoryFullName: string; branch: string; commitSha: string; parentSha?: string | null; connection: { id: string; label: string; repositoryFullName: string; defaultBranch: string } } | null; sourceAnalyses?: GitHubSourceAnalysis[]; viewerUrl?: string | null };

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
  const [mode, setMode] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    request("runs").then((result) => setRuns(result as RunSummary[])).catch((loadError) => setMessage(errorMessage(loadError, "Could not load Runs.")));
  }, []);

  const filtered = runs.filter((run) => (!productId || run.product.id === productId) && (!mode || run.mode === mode) && (!outcome || (outcome === "ACTIVE" ? run.status !== "COMPLETED" : run.outcome === outcome)));
  const pageSize = 25;
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [mode, outcome, productId]);
  return <div className="dashboard-grid"><PageHeader eyebrow="Execution history" title="Runs" detail="Guided and autonomous executions retain their outcome and redacted evidence separately." actions={<StatusBadge tone="info">{filtered.length} / {runs.length} visible Run{runs.length === 1 ? "" : "s"}</StatusBadge>} />{message && <Feedback tone="danger">{message}</Feedback>}<Card className="panel-card"><div className="inventory-toolbar"><Field label="Filter by Product"><SelectInput value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">All accessible Products</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput></Field><Field label="Filter by outcome"><SelectInput value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="">All outcomes</option><option value="ACTIVE">Queued, running, or paused</option><option value="PASSED">Passed</option><option value="FAILED">Failed</option><option value="INTERRUPTED">Interrupted</option></SelectInput></Field><Field label="Filter by mode"><SelectInput value={mode} onChange={(event) => setMode(event.target.value)}><option value="">All modes</option><option value="AUTO">Auto</option><option value="GUIDED">Guided</option></SelectInput></Field></div>{runs.length === 0 && !message ? <Skeleton lines={6} /> : filtered.length === 0 ? <EmptyState title="No Runs found" detail="Change the filters or start a Guided Run or Auto Run from a saved Test Case." /> : <div className="run-list">{visible.map((run) => <article className="run-list__item" key={run.id}><div><div className="run-list__head"><h2>{run.testCase.name}</h2><StatusBadge tone={run.mode === "AUTO" ? "info" : "neutral"}>{run.mode === "AUTO" ? "Auto" : "Guided"}</StatusBadge><StatusBadge tone={runOutcomeTone(run)}>{runLabel(run)}</StatusBadge>{run.evidenceStatus === "PARTIAL" && <StatusBadge tone="warning">Evidence partial</StatusBadge>}</div><p>{run.product.name} · Started by {run.initiatedBy.displayName} · {run.stepResults.filter((step) => step.status === "PASSED").length}/{run.stepResults.length} steps passed{run.mode === "AUTO" && run.attempts?.length ? ` · ${run.attempts.length} attempt${run.attempts.length === 1 ? "" : "s"}` : ""}</p></div><Link className="button button--secondary" href={`/runs/${run.id}`}>Open Run <span aria-hidden="true">→</span></Link></article>)}</div>}<Pagination page={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} label="Runs" /></Card></div>;
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
  return <div className="run-evidence">
    <div><p className="eyebrow">Run Detail</p><h2>Evidence timeline</h2><p>Outcome and capture status remain separate. Sensitive values are redacted before persistence.</p></div>
    <section><h3>Screenshots</h3>{screenshots.length === 0 ? <p>No screenshots were captured.</p> : <div className="run-evidence__list">{screenshots.map((item) => <article key={item.id}><div><strong>{String((item.metadata as { label?: string } | null)?.label ?? "Screenshot")}</strong><small>{item.checksum ? `SHA-256 ${item.checksum.slice(0, 12)}…` : "Checksum unavailable"}</small></div><Button variant="secondary" onClick={() => void onOpenEvidence(item)}>Open</Button></article>)}</div>}</section>
    {["NETWORK", "CONSOLE", "STORAGE", "CAPTURE_ERROR"].map((kind) => {
      const items = evidence.filter((item) => item.kind === kind);
      const entries = items.flatMap((item) => {
        const metadata = item.metadata as { entries?: Array<Record<string, unknown>> } | Array<Record<string, unknown>> | null;
        return Array.isArray(metadata) ? metadata : Array.isArray(metadata?.entries) ? metadata.entries : [];
      });
      return <section key={kind}><h3>{kind.replace("_", " ").toLowerCase()}</h3>{items.length === 0 ? <p>No {kind.toLowerCase().replace("_", " ")} evidence at this Run boundary.</p> : <>{kind === "NETWORK" && entries.length > 0 && <div className="evidence-table-wrap"><table className="evidence-table"><thead><tr><th>Method</th><th>Status</th><th>Request</th><th>Duration</th></tr></thead><tbody>{entries.map((entry, index) => <tr key={index}><td>{String(entry.method ?? "—")}</td><td>{String(entry.status ?? "—")}</td><td><code>{String(entry.url ?? "Unknown request")}</code></td><td>{entry.durationMs === undefined ? "—" : `${String(entry.durationMs)} ms`}</td></tr>)}</tbody></table></div>}{kind !== "NETWORK" && <p>{items.length} captured {kind.toLowerCase().replace("_", " ")} boundar{items.length === 1 ? "y" : "ies"}. Open raw data only when the summary is insufficient.</p>}<div className="run-evidence__metadata">{items.map((item, index) => <details className="raw-evidence" key={item.id}><summary>{item.captureError ? "Capture error" : `${kind.replace("_", " ").toLowerCase()} boundary ${index + 1}`} · View raw data</summary><pre>{item.captureError ?? JSON.stringify(item.metadata, null, 2)}</pre></details>)}</div></>}</section>;
    })}
    <section className="follow-up-actions"><div><p className="eyebrow">After a failed Run</p><h3>Follow-up actions</h3><p>Diagnostics, external filing, intentional-change review, and source analysis remain explicit and independently authorized.</p></div><SourceAnalysisPanel /><JiraFilingPanel /><ChangeProposalPanel /><RunDiagnosticPanel /></section>
  </div>;
}

function sourceAnalysisTone(status: GitHubSourceAnalysis["status"]) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "QUEUED" || status === "ANALYZING") return "info" as const;
  if (status === "BLOCKED_SENSITIVE_CONTEXT" || status === "UNAVAILABLE") return "warning" as const;
  return "danger" as const;
}

function SourceAnalysisPanel() {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [connections, setConnections] = useState<GitHubConnection[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [commitSha, setCommitSha] = useState("");
  const [parentSha, setParentSha] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const runId = window.location.pathname.split("/").filter(Boolean).at(-1);
    if (!runId) return;
    request(`runs/${runId}`).then(async (result) => {
      const detail = result as RunDetail;
      setRun(detail);
      if (detail.githubRunLink) {
        setConnectionId(detail.githubRunLink.connection.id);
        setCommitSha(detail.githubRunLink.commitSha);
        setParentSha(detail.githubRunLink.parentSha ?? "");
      }
      const settings = await request(`products/${detail.product.id}/github`) as GitHubProductSettings;
      setConnections(settings.connections.filter((connection) => connection.status === "ACTIVE" && connection.analysisEnabled));
    }).catch((error) => setMessage(errorMessage(error, "Could not load source-analysis controls.")));
  }, []);

  if (!run || run.status !== "COMPLETED" || run.outcome !== "FAILED") return null;
  const failedRun = run;
  const analyses = failedRun.sourceAnalyses ?? [];
  const isGitHubTriggered = Boolean(failedRun.githubRunLink);

  async function requestAnalysis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setMessage("");
    try {
      await request(`runs/${failedRun.id}/source-analysis`, "POST", { connectionId, commitSha, parentSha: parentSha || undefined });
      const refreshed = await request(`runs/${failedRun.id}`) as RunDetail;
      setRun(refreshed);
      setMessage("Source analysis queued. Sentinel will keep only its safe structured diagnosis.");
    } catch (error) {
      setMessage(errorMessage(error, "Could not queue source analysis."));
    } finally {
      setWorking(false);
    }
  }

  return <section className="source-analysis"><div><p className="eyebrow">Advisory source diagnosis</p><h3>Analyze failure</h3><p>Sentinel checks one explicit commit in one connected repository. It never writes source code, changes the Test Case, opens a pull request, or files Jira automatically.</p></div>
    {isGitHubTriggered && run.githubRunLink && <div className="source-analysis__commit"><StatusBadge tone="info">GitHub-triggered Run</StatusBadge><p><code>{run.githubRunLink.repositoryFullName}</code> · <code>{run.githubRunLink.branch}</code> · <a href={`https://github.com/${run.githubRunLink.repositoryFullName}/commit/${run.githubRunLink.commitSha}`} target="_blank" rel="noreferrer">{run.githubRunLink.commitSha.slice(0, 12)}</a></p></div>}
    {analyses.map((analysis) => <article className="source-analysis__result" key={analysis.id}><div className="run-list__head"><h3>{analysis.connection.label}</h3><StatusBadge tone={sourceAnalysisTone(analysis.status)}>{analysis.status.replaceAll("_", " ").toLowerCase()}</StatusBadge><StatusBadge tone={analysis.confidence === "HIGH" ? "success" : analysis.confidence === "MEDIUM" ? "warning" : "neutral"}>{analysis.confidence.toLowerCase()} confidence</StatusBadge></div><p><code>{analysis.connection.repositoryFullName}</code> · <a href={`https://github.com/${analysis.connection.repositoryFullName}/commit/${analysis.commitSha}`} target="_blank" rel="noreferrer">{analysis.commitSha.slice(0, 12)}</a> · {analysis.trigger === "GITHUB_FAILURE" ? "automatic GitHub failure" : "explicit manual request"}</p>{analysis.status === "QUEUED" || analysis.status === "ANALYZING" ? <p>Analysis is running in the isolated worker. Refresh this Run Detail shortly for a safe result.</p> : <div className="source-analysis__findings">{analysis.likelyCause && <div><strong>Likely cause</strong><p>{analysis.likelyCause}</p></div>}{analysis.observations?.length ? <div><strong>Evidence-backed observations</strong><ul>{analysis.observations.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}{analysis.hypotheses?.length ? <div><strong>Hypotheses</strong><ul>{analysis.hypotheses.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}{analysis.remediation && <div><strong>Suggested remediation</strong><p>{analysis.remediation}</p></div>}{analysis.sourceReferences?.length ? <div><strong>Commit-pinned references</strong><ul>{analysis.sourceReferences.map((reference) => <li key={`${reference.path}:${reference.startLine}:${reference.endLine}`}><a href={`https://github.com/${analysis.connection.repositoryFullName}/blob/${analysis.commitSha}/${reference.path}#L${reference.startLine}-L${reference.endLine}`} target="_blank" rel="noreferrer"><code>{reference.path}:L{reference.startLine}–L{reference.endLine}</code></a> · {reference.rationale}</li>)}</ul></div> : null}{analysis.suggestedPatch && <details className="raw-evidence"><summary>Review-only patch fragment</summary><pre>{analysis.suggestedPatch}</pre></details>}{analysis.limitations && <div><strong>Limitations</strong><p>{analysis.limitations}</p></div>}{analysis.errorCode && <p>Safe analysis state: {analysis.errorCode.replaceAll("_", " ").toLowerCase()}.</p>}</div>}</article>)}
    {!isGitHubTriggered && <p className="health-empty-copy">This was a manual or other non-GitHub Run. Select a Product repository and paste a full immutable commit SHA; Sentinel will not infer the newest code.</p>}
    {connections.length === 0 ? <p className="health-empty-copy">No active Product repository has source analysis enabled. An Admin or assigned Manager can configure this in Products.</p> : <form className="form-stack source-analysis__form" onSubmit={requestAnalysis}><Field label="Repository"><SelectInput value={connectionId} onChange={(event) => setConnectionId(event.target.value)} required><option value="">Choose repository</option>{connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.label} · {connection.repositoryFullName}</option>)}</SelectInput></Field><Field label="Commit SHA" hint="Use the full 40-character immutable Git SHA, not a branch name or short SHA."><TextInput value={commitSha} onChange={(event) => setCommitSha(event.target.value.trim())} minLength={40} maxLength={40} pattern="[A-Fa-f0-9]{40}" placeholder="40-character commit SHA" required /></Field><Field label="Parent SHA (optional)" hint="Provides a bounded changed-file comparison when known."><TextInput value={parentSha} onChange={(event) => setParentSha(event.target.value.trim())} minLength={40} maxLength={40} pattern="[A-Fa-f0-9]{40}" placeholder="40-character parent SHA" /></Field>{message && <Feedback tone={message.startsWith("Source analysis queued") ? "success" : "danger"}>{message}</Feedback>}<Button type="submit" disabled={working || !connectionId || commitSha.length !== 40}>{working ? "Queueing…" : analyses.length ? "Request another explicit analysis" : "Analyze failure"}</Button></form>}
  </section>;
}

function RunDiagnosticPanel() {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  useEffect(() => { const runId = window.location.pathname.split("/").filter(Boolean).at(-1); if (runId) request(`runs/${runId}`).then((result) => setRun(result as RunDetail)).catch(() => undefined); }, []);
  if (!run || run.status !== "COMPLETED" || run.outcome !== "FAILED") return null;
  const failedRun = run;
  const diagnostic = failedRun.databaseDiagnostics?.find((item) => item.kind === "CUSTOMER_LOOKUP_BY_EMAIL");
  async function diagnose() {
    setWorking(true); setMessage("");
    try { const created = await request(`runs/${failedRun.id}/diagnostics/customer-lookup`, "POST") as DatabaseDiagnostic; setRun({ ...failedRun, databaseDiagnostics: [...(failedRun.databaseDiagnostics ?? []), created] }); } catch (error) { setMessage(errorMessage(error, "Could not run the customer lookup.")); } finally { setWorking(false); }
  }
  return <section><h3>Database insight</h3><p>Query the isolated QA customer fixture only when diagnosing this failed Run. Sentinel uses the recorded customer email transiently and never displays or stores it.</p>{diagnostic ? <div className="run-evidence__metadata"><StatusBadge tone={diagnostic.status === "COMPLETE" ? "success" : "warning"}>{diagnostic.status.toLowerCase()}</StatusBadge>{diagnostic.safeMetadata !== null && diagnostic.safeMetadata !== undefined && <pre>{JSON.stringify(diagnostic.safeMetadata, null, 2)}</pre>}{diagnostic.errorCode && <p>Safe diagnostic state: {diagnostic.errorCode.replaceAll("_", " ").toLowerCase()}.</p>}</div> : <Button onClick={() => void diagnose()} disabled={working}>{working ? "Checking QA data…" : "Run customer lookup"}</Button>}{message && <Feedback tone="danger">{message}</Feedback>}</section>;
}

function ChangeProposalPanel() {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [context, setContext] = useState("");
  const [stepId, setStepId] = useState("");
  const [description, setDescription] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => { const runId = window.location.pathname.split("/").filter(Boolean).at(-1); if (runId) request(`runs/${runId}`).then((result) => setRun(result as RunDetail)).catch(() => undefined); }, []);
  if (!run || run.status !== "COMPLETED" || run.outcome !== "FAILED") return null;
  const failedRun = run;
  const selected = failedRun.stepResults.find((step) => step.testStep.id === stepId);
  const existing = failedRun.changeProposal;
  async function submit() {
    if (!selected) return;
    setWorking(true); setMessage("");
    try {
      const proposal = await request(`runs/${failedRun.id}/change-proposals`, "POST", { context, changes: [{ stepId: selected.testStep.id, description, expectedOutcome }] }) as ChangeProposal;
      await request(`change-proposals/${proposal.id}/submit`, "POST");
      setMessage("Change proposal submitted to the original Test Case owner.");
      setRun({ ...failedRun, changeProposal: { ...proposal, status: "SUBMITTED" } });
    } catch (error) { setMessage(errorMessage(error, "Could not submit the change proposal.")); } finally { setWorking(false); }
  }
  if (existing) return <section><h3>Change proposal</h3><p>A baseline-change proposal is {existing.status.toLowerCase()}. It never changes this failed Run or its source version.</p><p><Link href="/review">Open Review <span aria-hidden="true">→</span></Link></p></section>;
  return <section><h3>Propose intentional change</h3><p>Use this only after a known QA deployment. Proposals can change a step’s description or expected outcome, never its action, selector, value, variable, checkpoint, or order.</p><div className="form-stack"><Field label="Deployment context"><TextArea value={context} onChange={(event) => setContext(event.target.value)} maxLength={1000} placeholder="What intentional QA change explains this failed Run?" /></Field><Field label="Saved step"><SelectInput value={stepId} onChange={(event) => { const next = run.stepResults.find((step) => step.testStep.id === event.target.value); setStepId(event.target.value); setDescription(next?.testStep.description ?? ""); setExpectedOutcome(next?.testStep.expectedOutcome ?? ""); }}><option value="">Choose a step</option>{run.stepResults.map((step) => <option key={step.id} value={step.testStep.id}>Step {step.order}: {runStepLabel(step)}</option>)}</SelectInput></Field>{selected && <><Field label="Proposed description"><TextArea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} placeholder={selected.testStep.description ?? "Optional"} /></Field><Field label="Proposed expected outcome"><TextArea value={expectedOutcome} onChange={(event) => setExpectedOutcome(event.target.value)} maxLength={2000} placeholder={selected.testStep.expectedOutcome ?? "Optional"} /></Field></>} {message && <Feedback tone={message.startsWith("Change proposal") ? "success" : "danger"}>{message}</Feedback>}<Button onClick={() => void submit()} disabled={working || !context || !selected}>{working ? "Submitting…" : "Submit for owner review"}</Button></div></section>;
}

function JiraFilingPanel() {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [filing, setFiling] = useState<JiraFiling | null>(null);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const runId = window.location.pathname.split("/").filter(Boolean).at(-1);
    if (!runId) return;
    request(`runs/${runId}`).then((result) => {
      const detail = result as RunDetail;
      setRun(detail);
      setFiling(detail.jiraFiling ?? null);
    }).catch(() => undefined);
  }, []);

  if (!run || run.status !== "COMPLETED" || run.outcome !== "FAILED") return null;
  const failedRunId = run.id;

  async function createDraft() {
    setWorking(true);
    setMessage("");
    try {
      const created = await request(`runs/${failedRunId}/jira-draft`, "POST") as JiraFiling;
      setFiling(created);
      setEditing(created.status === "DRAFT" || created.status === "FAILED");
    } catch (error) {
      setMessage(errorMessage(error, "Could not create a Jira draft."));
    } finally {
      setWorking(false);
    }
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!filing) return;
    setWorking(true);
    setMessage("");
    try {
      const updated = await request(`jira-filings/${filing.id}`, "PATCH", { summary: filing.summary, description: filing.description, priority: filing.priority }) as JiraFiling;
      setFiling(updated);
      setEditing(false);
    } catch (error) {
      setMessage(errorMessage(error, "Could not save the Jira draft."));
    } finally {
      setWorking(false);
    }
  }

  async function file() {
    if (!filing) return;
    setWorking(true);
    setMessage("");
    try {
      const queued = await request(`jira-filings/${filing.id}/file`, "POST") as JiraFiling;
      setFiling(queued);
    } catch (error) {
      setMessage(errorMessage(error, "Could not queue the Jira filing."));
    } finally {
      setWorking(false);
    }
  }

  return <section className="jira-filing"><div><p className="eyebrow">External bug workflow</p><h3>Jira Cloud</h3><p>Sentinel sends safe text and a protected Run Detail link. Evidence stays private here.</p></div>{message && <Feedback tone="danger">{message}</Feedback>}{!filing ? <Button variant="secondary" onClick={() => void createDraft()} disabled={working}>{working ? "Preparing…" : "Create Jira issue"}</Button> : <><div className="jira-filing__status"><StatusBadge tone={filing.status === "FILED" ? "success" : filing.status === "FAILED" ? "danger" : "warning"}>{filing.status.toLowerCase()}</StatusBadge>{filing.jiraIssue && <a href={filing.jiraIssue.url} target="_blank" rel="noreferrer">{filing.action === "COMMENT" ? "Updated" : "Open"} {filing.jiraIssue.key}</a>}</div>{(filing.status === "DRAFT" || filing.status === "FAILED") && <div className="run-step__actions"><Button variant="secondary" onClick={() => setEditing(true)} disabled={working}>Edit draft</Button><Button onClick={() => void file()} disabled={working}>{working ? "Queueing…" : "File to Jira"}</Button></div>}{filing.status === "QUEUED" && <p>Jira filing is queued. Refresh this Run Detail shortly for delivery status.</p>}{filing.status === "FAILED" && filing.deliveryError && <p>{filing.deliveryError}</p>}</>}{editing && filing && <div className="modal-backdrop" role="presentation"><section className="modal jira-filing__modal" role="dialog" aria-modal="true" aria-labelledby="jira-filing-title"><div className="modal__header"><div><p className="eyebrow">Review before filing</p><h2 id="jira-filing-title">Jira Bug draft</h2><p>Bug type is fixed. Do not add evidence, credentials, variables, or raw logs.</p></div><Button type="button" variant="ghost" onClick={() => setEditing(false)}>Close</Button></div><form className="form-stack" onSubmit={saveDraft}><Field label="Summary"><TextInput value={filing.summary} maxLength={240} onChange={(event) => setFiling({ ...filing, summary: event.target.value })} required /></Field><Field label="Priority"><SelectInput value={filing.priority} onChange={(event) => setFiling({ ...filing, priority: event.target.value as JiraFiling["priority"] })}>{["Lowest", "Low", "Medium", "High", "Highest"].map((priority) => <option key={priority}>{priority}</option>)}</SelectInput></Field><Field label="Safe reproduction description"><TextArea value={filing.description} maxLength={8000} onChange={(event) => setFiling({ ...filing, description: event.target.value })} required /></Field><div className="modal__actions"><Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button><Button type="submit" disabled={working}>{working ? "Saving…" : "Save draft"}</Button></div></form></section></div>}</section>;
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

  return <Dialog eyebrow="Guided test creation" title="Create recording workspace" detail="Choose the Product and name for the approved Demo CRM journey." className="recording-create-modal" onClose={onClose}><form className="form-stack" onSubmit={createRecording}><Field label="Product"><SelectInput value={productId} onChange={(event) => setProductId(event.target.value)} disabled={loading || products.length === 0}>{products.length === 0 ? <option value="">Create a Product first</option> : products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput></Field><Field label="Test Name"><TextInput value={testName} onChange={(event) => setTestName(event.target.value)} required /></Field><div className="fixed-target"><span>Approved target</span><strong>Demo CRM</strong><code>http://demo-target</code></div>{error && <Feedback tone="danger">{error}</Feedback>}{message && <Feedback tone="danger">{message}</Feedback>}<div className="modal__actions"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!products.length}>Create recording workspace</Button></div></form></Dialog>;
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
  const [isStepLogCollapsed, setIsStepLogCollapsed] = useState(false);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);

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

  useEffect(() => {
    if (!isBrowserFullscreen) return;
    const exitFullscreen = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsBrowserFullscreen(false);
    };
    document.addEventListener("keydown", exitFullscreen);
    return () => document.removeEventListener("keydown", exitFullscreen);
  }, [isBrowserFullscreen]);

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
  return <div className={`recording-page${isBrowserFullscreen ? " recording-page--browser-fullscreen" : ""}`}>{!isBrowserFullscreen && <header className="recording-bar"><div className="recording-bar__title"><Button variant="ghost" onClick={() => setIsExitOpen(true)} disabled={working}>Back to dashboard</Button><h1>{context.testName}</h1></div><div className="recording-bar__actions"><Button variant="secondary" type="button" onClick={() => setIsBrowserFullscreen(true)} aria-pressed={false}>Full screen</Button><Button onClick={save} disabled={working}>Save Test</Button><Button variant="danger" onClick={discard} disabled={working}>Discard</Button></div></header>}{message && <Feedback tone={toneForMessage(message)}>{message}</Feedback>}<section className={`recording-workspace${isStepLogCollapsed ? " recording-workspace--step-log-collapsed" : ""}${isBrowserFullscreen ? " recording-workspace--browser-fullscreen" : ""}`}><aside className="step-panel" aria-label="Step Log"><div className="step-panel__expanded" hidden={isStepLogCollapsed}><div className="step-panel__head"><div><p className="eyebrow">Live timeline</p><h2>Step Log</h2><p>Actions appear in order. Password values remain redacted.</p></div><div className="step-panel__head-actions"><StatusBadge tone="info">{steps.length} step{steps.length === 1 ? "" : "s"}</StatusBadge><Button className="step-panel__collapse" variant="secondary" type="button" onClick={() => setIsStepLogCollapsed(true)} aria-expanded="true" aria-label="Collapse Step Log" title="Collapse Step Log"><Icon name="chevronLeft" /></Button></div></div><div className="step-panel__list">{steps.length === 0 ? <EmptyState title="Waiting for actions" detail="Launch the browser and interact with the Demo CRM to create your first recorded step." /> : steps.map((step) => <StepEditor key={step.id} step={step} onUpdate={updateStep} />)}</div></div><div className="step-panel__collapsed" hidden={!isStepLogCollapsed}><Button className="step-panel__rail-toggle" variant="secondary" type="button" onClick={() => setIsStepLogCollapsed(false)} aria-expanded="false" aria-label="Expand Step Log" title="Expand Step Log"><Icon name="chevronRight" /></Button><span className="step-panel__rail-count" aria-label={`${steps.length} recorded steps`}>{steps.length}</span></div></aside><section className="browser-stage" aria-label="Live recording browser">{isBrowserFullscreen && <div className="browser-stage__fullscreen-controls"><Button variant="secondary" type="button" onClick={() => setIsBrowserFullscreen(false)}>Exit full screen</Button></div>}{viewerUrl ? <iframe title="Live recording browser" src={viewerUrl} allow="clipboard-read; clipboard-write" /> : <div className="browser-stage__empty"><div className="browser-stage__empty-card"><span className="sentinel-mark" aria-hidden="true"><span /></span><h2>{isLaunching ? "Launching secure browser" : "Browser ready"}</h2><p aria-live="polite">{isLaunching ? "Sentinel is preparing the approved Demo CRM. This normally takes a few seconds." : "Launch the live browser to begin recording the approved Demo CRM journey."}</p><Button onClick={launch} disabled={working}>{isLaunching ? "Launching live browser…" : "Launch live browser"}</Button></div></div>}</section></section><section className="recording-desktop-guidance"><p className="eyebrow">Desktop workspace required</p><h2>Use a wider screen to record a live journey.</h2><p>The browser and editable Step Log work together in a desktop-sized workspace. Return on a larger viewport to continue this draft.</p><Button variant="secondary" onClick={() => setIsExitOpen(true)} disabled={working}>Back to dashboard</Button></section>{isExitOpen && <div className="modal-backdrop" role="presentation"><section className="modal recording-exit-modal" role="dialog" aria-modal="true" aria-labelledby="recording-exit-title"><div className="modal__header"><div><p className="eyebrow">Leave recording</p><h2 id="recording-exit-title">Save or discard this draft</h2><p>Choose how to handle this Test Case before returning to the Dashboard.</p></div><Button type="button" variant="ghost" onClick={() => setIsExitOpen(false)} disabled={working}>Continue recording</Button></div><div className="modal__actions"><Button variant="danger" onClick={discard} disabled={working}>Discard Test Case</Button><Button onClick={save} disabled={working}>Save Test Case</Button></div></section></div>}</div>;
}

function StepEditor({ step, onUpdate }: { step: Step; onUpdate: (step: Step, patch: Partial<Step>) => Promise<void> }) {
  const label = step.target.text || step.target.name || step.target.url || step.target.tag || "Recorded target";
  return <article className="step-editor step"><div className="step-editor__head"><h3>Step {step.order}: {step.kind.replace("_", " ")}</h3><StatusBadge tone={step.isRedacted ? "warning" : step.isCheckpoint ? "success" : "info"}>{step.isRedacted ? "Redacted" : step.isCheckpoint ? "Checkpoint" : "Captured"}</StatusBadge></div><p className="step-editor__target">{label}</p>{step.value && <p className="step-editor__value">Value: {step.value}</p>}<Field label="Description"><TextArea defaultValue={step.description ?? ""} onBlur={(event) => void onUpdate(step, { description: event.target.value })} /></Field><Field label="Expected outcome"><TextArea defaultValue={step.expectedOutcome ?? ""} onBlur={(event) => void onUpdate(step, { expectedOutcome: event.target.value })} /></Field>{step.kind === "TEXT_ENTRY" && <Field label="Variable name"><TextInput defaultValue={step.variableName ?? ""} placeholder="Optional variable" onBlur={(event) => void onUpdate(step, { variableName: event.target.value })} /></Field>}<label className="checkpoint-toggle"><input type="checkbox" checked={Boolean(step.isCheckpoint)} onChange={(event) => void onUpdate(step, { isCheckpoint: event.target.checked })} /> <span>Pause Auto Run after this action for review</span></label></article>;
}
