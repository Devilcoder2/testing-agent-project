"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { TEST_DATA_LIMITS } from "@/lib/test-data";
import { Card, Dialog, EmptyState, Feedback, Field, Icon, IconButton, PageHeader, SelectInput, Skeleton, StatusBadge, TextInput } from "./ui";

type Product = { id: string; name: string };
type RowStatus = "SAFE" | "RESERVED" | "CONSUMED" | "INVALID";
type SafeRow = { id: string; order: number };
type TestDataSet = {
  id: string;
  productId: string;
  ownerId: string | null;
  name: string;
  fieldNames: string[];
  reusePolicy: "REUSABLE" | "SINGLE_USE";
  status: RowStatus;
  rowCount: number;
  rowCounts: Record<Lowercase<RowStatus>, number>;
  safeRows: SafeRow[];
  canEdit: boolean;
  canInvalidate: boolean;
  product: Product;
};
type TestDataDetail = TestDataSet & { rows: Array<{ id: string; order: number; status: RowStatus; maskedFields: string[] }> };
type DraftColumn = { key: string; name: string; originalName?: string };
type DraftCell = { value: string; retained: boolean };
type DraftRow = { key: string; id?: string; status?: RowStatus; cells: Record<string, DraftCell> };

let draftSequence = 0;
const draftKey = (prefix: string) => `${prefix}-${Date.now()}-${draftSequence++}`;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function canonicalDraftField(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

function blankDraft() {
  const column: DraftColumn = { key: draftKey("column"), name: "customer_email" };
  return { columns: [column], rows: [{ key: draftKey("row"), cells: { [column.key]: { value: "", retained: false } } }] as DraftRow[] };
}

function cellText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : String(value);
}

export function TestDataView() {
  const searchParams = useSearchParams();
  const requestedProductId = searchParams.get("productId") ?? "";
  const focusId = searchParams.get("focus") ?? "";
  const [products, setProducts] = useState<Product[]>([]);
  const [dataSets, setDataSets] = useState<TestDataSet[]>([]);
  const [productId, setProductId] = useState(requestedProductId);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<TestDataDetail | null | "create">(null);

  async function load() {
    setLoading(true);
    try {
      const [nextProducts, nextDataSets] = await Promise.all([apiRequest("products"), apiRequest("test-data")]);
      const accessibleProducts = nextProducts as Product[];
      setProducts(accessibleProducts);
      setDataSets(nextDataSets as TestDataSet[]);
      setProductId((current) => accessibleProducts.some((product) => product.id === (requestedProductId || current)) ? (requestedProductId || current) : "");
    } catch (error) {
      setMessage(errorMessage(error, "Could not load Test Data."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);
  const visible = useMemo(() => dataSets.filter((dataSet) => !productId || dataSet.productId === productId), [dataSets, productId]);

  async function openEdit(dataSet: TestDataSet) {
    setMessage("");
    try {
      setEditing(await apiRequest(`products/${dataSet.productId}/test-data/${dataSet.id}`) as TestDataDetail);
    } catch (error) {
      setMessage(errorMessage(error, "Could not open this Test Data."));
    }
  }

  async function invalidate(dataSet: TestDataSet) {
    setMessage("");
    try {
      const updated = await apiRequest(`products/${dataSet.productId}/test-data/${dataSet.id}/invalidate`, { method: "POST" }) as TestDataSet;
      setDataSets((all) => all.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      setMessage(`${dataSet.name} invalidated.`);
    } catch (error) {
      setMessage(errorMessage(error, "Could not invalidate this Test Data."));
    }
  }

  return <div className="dashboard-grid">
    <PageHeader eyebrow="Reusable run inputs" title="Test Data" actions={<IconButton label="New Test Data" onClick={() => setEditing("create")} disabled={products.length === 0}><Icon name="plus" /></IconButton>} />
    {message && <Feedback tone={message.endsWith("invalidated.") || message.includes("saved") || message.includes("created") ? "success" : "danger"}>{message}</Feedback>}
    <Card className="panel-card">
      <div className="inventory-toolbar"><Field label="Product"><SelectInput value={productId} onChange={(event) => setProductId(event.target.value)} disabled={loading}><option value="">All accessible Products</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput></Field></div>
      {loading ? <Skeleton lines={6} /> : visible.length === 0 ? <EmptyState title="No Test Data" detail={productId ? "Create Test Data for this Product or choose All accessible Products." : "Create a secure table for a variable-marked Test Case."} /> : <div className="test-data-list">{visible.map((dataSet) => <article className={`test-data-item ${focusId === dataSet.id ? "test-data-item--focused" : ""}`} key={dataSet.id}>
        <div className="test-data-item__main"><div className="run-list__head"><h2>{dataSet.name}</h2>{!productId && <StatusBadge tone="neutral">{dataSet.product.name}</StatusBadge>}<StatusBadge tone={dataSet.reusePolicy === "REUSABLE" ? "info" : "warning"}>{dataSet.reusePolicy === "REUSABLE" ? "Reusable" : "Single-use"}</StatusBadge><StatusBadge tone={dataSet.status === "SAFE" ? "success" : dataSet.status === "RESERVED" ? "warning" : "neutral"}>{dataSet.status.toLowerCase()}</StatusBadge><StatusBadge tone="neutral">{dataSet.rowCount} row{dataSet.rowCount === 1 ? "" : "s"}</StatusBadge></div><p>Fields: {dataSet.fieldNames.join(", ")}</p></div>
        <div className="test-data-item__actions">{dataSet.canEdit && <IconButton label={`Edit ${dataSet.name}`} onClick={() => void openEdit(dataSet)}><Icon name="edit" /></IconButton>}{dataSet.canInvalidate && <IconButton className="icon-button--danger" label={`Invalidate ${dataSet.name}`} onClick={() => void invalidate(dataSet)}><Icon name="invalidate" /></IconButton>}</div>
      </article>)}</div>}
    </Card>
    {editing && <TestDataEditor mode={editing === "create" ? "create" : "edit"} products={products} initialProductId={productId || products[0]?.id || ""} dataSet={editing === "create" ? undefined : editing} onClose={() => setEditing(null)} onSaved={(saved, action) => { setEditing(null); setDataSets((all) => action === "created" ? [saved, ...all] : all.map((item) => item.id === saved.id ? saved : item)); setMessage(`${saved.name} ${action}.`); }} />}
  </div>;
}

function TestDataEditor({ mode, products, initialProductId, dataSet, onClose, onSaved }: { mode: "create" | "edit"; products: Product[]; initialProductId: string; dataSet?: TestDataDetail; onClose: () => void; onSaved: (dataSet: TestDataSet, action: "created" | "saved") => void }) {
  const initial = useMemo(() => {
    if (!dataSet) return blankDraft();
    const columns = dataSet.fieldNames.map((name) => ({ key: draftKey("column"), name, originalName: name }));
    const rows = dataSet.rows.map((row) => ({ key: draftKey("row"), id: row.id, status: row.status, cells: Object.fromEntries(columns.map((column) => [column.key, { value: "", retained: true }])) }));
    return { columns, rows };
  }, [dataSet]);
  const [productId, setProductId] = useState(dataSet?.productId ?? initialProductId);
  const [name, setName] = useState(dataSet?.name ?? "");
  const [reusePolicy, setReusePolicy] = useState<"REUSABLE" | "SINGLE_USE">(dataSet?.reusePolicy ?? "REUSABLE");
  const [columns, setColumns] = useState<DraftColumn[]>(initial.columns);
  const [rows, setRows] = useState<DraftRow[]>(initial.rows);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function addColumn() {
    if (columns.length >= TEST_DATA_LIMITS.columns) return setMessage(`A table can have at most ${TEST_DATA_LIMITS.columns} columns.`);
    const column = { key: draftKey("column"), name: `field_${columns.length + 1}` };
    setColumns((all) => [...all, column]);
    setRows((all) => all.map((row) => ({ ...row, cells: { ...row.cells, [column.key]: { value: "", retained: false } } })));
  }

  function removeColumn(column: DraftColumn) {
    if (columns.length === 1) return setMessage("Keep at least one column.");
    setColumns((all) => all.filter((item) => item.key !== column.key));
    setRows((all) => all.map((row) => ({ ...row, cells: Object.fromEntries(Object.entries(row.cells).filter(([key]) => key !== column.key)) })));
  }

  function renameColumn(column: DraftColumn, nextName: string) {
    const changedIdentity = column.originalName !== undefined && canonicalDraftField(nextName) !== column.originalName;
    setColumns((all) => all.map((item) => item.key === column.key ? { ...item, name: nextName } : item));
    if (changedIdentity) setRows((all) => all.map((row) => ({ ...row, cells: { ...row.cells, [column.key]: { value: "", retained: false } } })));
  }

  function addRow() {
    if (rows.length >= TEST_DATA_LIMITS.rows) return setMessage(`A table can have at most ${TEST_DATA_LIMITS.rows.toLocaleString("en-US")} rows.`);
    setRows((all) => [...all, { key: draftKey("row"), cells: Object.fromEntries(columns.map((column) => [column.key, { value: "", retained: false }])) }]);
  }

  function removeRow(row: DraftRow) {
    if (rows.length === 1) return setMessage("Keep at least one row.");
    setRows((all) => all.filter((item) => item.key !== row.key));
  }

  function updateCell(rowKey: string, columnKey: string, value: string) {
    setRows((all) => all.map((row) => row.key === rowKey ? { ...row, cells: { ...row.cells, [columnKey]: { value, retained: false } } } : row));
  }

  async function importExcel(file: File) {
    setMessage("");
    if (!file.name.toLowerCase().endsWith(".xlsx")) return setMessage("Choose an .xlsx Excel workbook.");
    if (file.size > TEST_DATA_LIMITS.workbookBytes) return setMessage("The Excel workbook must be 2 MiB or smaller.");
    setWorking(true);
    try {
      const { readSheet } = await import("read-excel-file/browser");
      const sheet = await readSheet(file);
      const first = sheet.findIndex((row) => row.some((cell) => cell !== null && cellText(cell).trim()));
      if (first < 0) throw new Error("The first worksheet is empty.");
      const header = sheet[first].map((cell) => canonicalDraftField(cellText(cell)));
      while (header.at(-1) === "") header.pop();
      if (!header.length || header.some((field) => !field)) throw new Error("Every imported column needs a header.");
      if (header.length > TEST_DATA_LIMITS.columns) throw new Error(`The workbook has more than ${TEST_DATA_LIMITS.columns} columns.`);
      if (new Set(header).size !== header.length) throw new Error("Imported column headers must be unique.");
      const importedValues = sheet.slice(first + 1).filter((row) => row.some((cell) => cell !== null && cellText(cell).trim())).map((row) => header.map((_, index) => cellText(row[index]).trim()));
      if (!importedValues.length) throw new Error("The workbook needs at least one data row below its headers.");
      if (importedValues.length > TEST_DATA_LIMITS.rows) throw new Error(`The workbook has more than ${TEST_DATA_LIMITS.rows.toLocaleString("en-US")} rows.`);
      const nextColumns = header.map((field) => ({ key: draftKey("column"), name: field }));
      const nextRows = importedValues.map((values) => ({ key: draftKey("row"), cells: Object.fromEntries(nextColumns.map((column, index) => [column.key, { value: values[index], retained: false }])) }));
      setColumns(nextColumns);
      setRows(nextRows);
      setMessage(`Imported ${nextRows.length} row${nextRows.length === 1 ? "" : "s"} and ${nextColumns.length} column${nextColumns.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessage(errorMessage(error, "The Excel workbook could not be read."));
    } finally {
      setWorking(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const fieldNames = columns.map((column) => canonicalDraftField(column.name));
    if (fieldNames.some((field) => !field)) return setMessage("Every column needs a valid name.");
    if (new Set(fieldNames).size !== fieldNames.length) return setMessage("Every column name must be unique.");
    const payloadRows = rows.map((row) => ({ ...(row.id ? { id: row.id } : {}), values: Object.fromEntries(columns.map((column, index) => [fieldNames[index], row.cells[column.key]?.retained ? null : row.cells[column.key]?.value ?? ""])) }));
    setWorking(true);
    try {
      const saved = await apiRequest(`products/${productId}/test-data${dataSet ? `/${dataSet.id}` : ""}`, { method: dataSet ? "PATCH" : "POST", body: { name, reusePolicy, fieldNames, rows: payloadRows } }) as TestDataSet;
      onSaved(saved, dataSet ? "saved" : "created");
    } catch (error) {
      setMessage(errorMessage(error, `Could not ${dataSet ? "save" : "create"} this Test Data.`));
    } finally {
      setWorking(false);
    }
  }

  return <Dialog eyebrow="Local Test Data" title={mode === "create" ? "Create Test Data" : `Edit ${dataSet?.name}`} detail="Each complete row supplies one Run. Stored cells remain masked unless you replace them." onClose={onClose} className="test-data-modal">
    <form className="form-stack" onSubmit={submit}>
      <div className="test-data-editor__meta">{mode === "create" && <Field label="Product"><SelectInput value={productId} onChange={(event) => setProductId(event.target.value)} required>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput></Field>}<Field label="Test Data name"><TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Customer variations" required maxLength={TEST_DATA_LIMITS.nameLength} /></Field><Field label="Reuse policy"><SelectInput value={reusePolicy} onChange={(event) => setReusePolicy(event.target.value as "REUSABLE" | "SINGLE_USE")}><option value="REUSABLE">Reusable</option><option value="SINGLE_USE">Single-use</option></SelectInput></Field></div>
      <div className="test-data-editor__toolbar"><IconButton type="button" label="Upload Excel workbook" onClick={() => fileRef.current?.click()} disabled={working}><Icon name="upload" /></IconButton><input ref={fileRef} className="visually-hidden" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importExcel(file); }} /><IconButton type="button" label="Add column" onClick={addColumn} disabled={working}><Icon name="plus" /></IconButton><IconButton type="button" label="Add row" onClick={addRow} disabled={working}><Icon name="plus" /></IconButton><StatusBadge tone="info">{rows.length} row{rows.length === 1 ? "" : "s"} · {columns.length} column{columns.length === 1 ? "" : "s"}</StatusBadge></div>
      <div className="test-data-grid-wrap"><table className="test-data-grid"><thead><tr><th scope="col">#</th>{columns.map((column) => <th scope="col" key={column.key}><div><TextInput aria-label={`Column ${columns.indexOf(column) + 1} name`} value={column.name} onChange={(event) => renameColumn(column, event.target.value)} maxLength={64} /><IconButton type="button" className="icon-button--danger" label={`Remove column ${column.name || columns.indexOf(column) + 1}`} onClick={() => removeColumn(column)} disabled={columns.length === 1 || working}><Icon name="delete" /></IconButton></div></th>)}<th scope="col"><span className="visually-hidden">Row actions</span></th></tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={row.key}><th scope="row">{rowIndex + 1}{row.status && <small>{row.status.toLowerCase()}</small>}</th>{columns.map((column) => { const cell = row.cells[column.key] ?? { value: "", retained: false }; return <td key={column.key}><TextInput aria-label={`Row ${rowIndex + 1}, ${column.name || `column ${columns.indexOf(column) + 1}`}`} value={cell.value} placeholder={cell.retained ? "Stored value (masked)" : "Enter value"} onChange={(event) => updateCell(row.key, column.key, event.target.value)} maxLength={TEST_DATA_LIMITS.cellLength} /></td>; })}<td><IconButton type="button" className="icon-button--danger" label={`Remove row ${rowIndex + 1}`} onClick={() => removeRow(row)} disabled={rows.length === 1 || working}><Icon name="delete" /></IconButton></td></tr>)}</tbody></table></div>
      {message && <Feedback tone={message.startsWith("Imported") ? "success" : "danger"}>{message}</Feedback>}
      <div className="modal__actions"><IconButton type="button" label="Cancel Test Data changes" onClick={onClose} disabled={working}><Icon name="close" /></IconButton><IconButton type="submit" label={dataSet ? "Save Test Data changes" : "Create Test Data"} disabled={working || !productId}><Icon name="check" /></IconButton></div>
    </form>
  </Dialog>;
}
