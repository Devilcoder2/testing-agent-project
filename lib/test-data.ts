import { TestDataReusePolicy, TestDataStatus } from "@prisma/client";
import { canonicalVariableName, isSecretLikeVariable } from "./variables";
import { TEST_DATA_LIMITS } from "./test-data-limits";

export { TEST_DATA_LIMITS } from "./test-data-limits";

export type TestDataRowInput = {
  id?: string;
  values: Record<string, string | null>;
};

export type TestDataTableInput = {
  name: string;
  reusePolicy: TestDataReusePolicy;
  fieldNames: string[];
  rows: TestDataRowInput[];
};

export class TestDataInputError extends Error {}

function inputError(message: string): never {
  throw new TestDataInputError(message);
}

function normalizeName(value: unknown) {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > TEST_DATA_LIMITS.nameLength) inputError(`Use a Test Data name of up to ${TEST_DATA_LIMITS.nameLength} characters.`);
  return name;
}

function normalizeReusePolicy(value: unknown) {
  if (value === undefined || value === TestDataReusePolicy.REUSABLE) return TestDataReusePolicy.REUSABLE;
  if (value === TestDataReusePolicy.SINGLE_USE) return TestDataReusePolicy.SINGLE_USE;
  return inputError("Choose whether this Test Data is reusable or single-use.");
}

function normalizeFields(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) inputError("Add at least one Test Data column.");
  if (value.length > TEST_DATA_LIMITS.columns) inputError(`Test Data supports at most ${TEST_DATA_LIMITS.columns} columns.`);
  const fields = value.map((field) => {
    try {
      return canonicalVariableName(field);
    } catch {
      return inputError("Column names must start with a letter and use only lower-case letters, numbers, and underscores.");
    }
  });
  if (new Set(fields).size !== fields.length) inputError("Every Test Data column name must be unique.");
  return fields;
}

function normalizeRows(value: unknown, fieldNames: string[], allowRetainedCells: boolean) {
  if (!Array.isArray(value) || value.length === 0) inputError("Add at least one complete Test Data row.");
  if (value.length > TEST_DATA_LIMITS.rows) inputError(`Test Data supports at most ${TEST_DATA_LIMITS.rows.toLocaleString("en-US")} rows.`);
  const ids = new Set<string>();
  return value.map((entry, index): TestDataRowInput => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) inputError(`Row ${index + 1} is invalid.`);
    const raw = entry as { id?: unknown; values?: unknown };
    const id = raw.id === undefined ? undefined : typeof raw.id === "string" && raw.id ? raw.id : inputError(`Row ${index + 1} has an invalid identity.`);
    if (id && ids.has(id)) inputError("A stored Test Data row can appear only once.");
    if (id) ids.add(id);
    if (!raw.values || typeof raw.values !== "object" || Array.isArray(raw.values)) inputError(`Row ${index + 1} needs a value for every column.`);
    const submitted = raw.values as Record<string, unknown>;
    if (Object.keys(submitted).some((field) => !fieldNames.includes(field))) inputError(`Row ${index + 1} contains an unknown column.`);
    const values: Record<string, string | null> = {};
    for (const fieldName of fieldNames) {
      const value = submitted[fieldName];
      if (value === null && allowRetainedCells && id) {
        values[fieldName] = null;
        continue;
      }
      if (typeof value !== "string" || !value.trim()) inputError(`Row ${index + 1} needs a value for ${fieldName}.`);
      const normalized = value.trim();
      if (normalized.length > TEST_DATA_LIMITS.cellLength) inputError(`${fieldName} in row ${index + 1} exceeds ${TEST_DATA_LIMITS.cellLength} characters.`);
      if (isSecretLikeVariable(fieldName, normalized)) inputError("Passwords, tokens, and other secret-like values cannot be stored in Test Data.");
      values[fieldName] = normalized;
    }
    return { ...(id ? { id } : {}), values };
  });
}

export function normalizeTestDataTable(value: unknown, options: { allowRetainedCells?: boolean } = {}): TestDataTableInput {
  const body = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const fieldNames = normalizeFields(body.fieldNames);
  return {
    name: normalizeName(body.name),
    reusePolicy: normalizeReusePolicy(body.reusePolicy),
    fieldNames,
    rows: normalizeRows(body.rows, fieldNames, options.allowRetainedCells === true)
  };
}

type PublicRow = { id: string; order: number; status: TestDataStatus };

export function aggregateTestDataStatus(rows: PublicRow[]) {
  if (rows.some((row) => row.status === TestDataStatus.RESERVED)) return TestDataStatus.RESERVED;
  if (rows.some((row) => row.status === TestDataStatus.SAFE)) return TestDataStatus.SAFE;
  if (rows.some((row) => row.status === TestDataStatus.CONSUMED)) return TestDataStatus.CONSUMED;
  return TestDataStatus.INVALID;
}

export function publicTestDataSet(dataSet: {
  id: string;
  productId: string;
  ownerId: string | null;
  name: string;
  fieldNames: string[];
  reusePolicy: TestDataReusePolicy;
  createdAt: Date;
  updatedAt: Date;
  product?: { id: string; name: string };
  rows: PublicRow[];
}, canManage: boolean) {
  const counts = Object.fromEntries(Object.values(TestDataStatus).map((status) => [status.toLowerCase(), dataSet.rows.filter((row) => row.status === status).length])) as Record<Lowercase<TestDataStatus>, number>;
  const allRowsSafe = dataSet.rows.length > 0 && dataSet.rows.every((row) => row.status === TestDataStatus.SAFE);
  return {
    id: dataSet.id,
    productId: dataSet.productId,
    ownerId: dataSet.ownerId,
    name: dataSet.name,
    fieldNames: dataSet.fieldNames,
    reusePolicy: dataSet.reusePolicy,
    status: aggregateTestDataStatus(dataSet.rows),
    rowCount: dataSet.rows.length,
    rowCounts: counts,
    safeRows: dataSet.rows.filter((row) => row.status === TestDataStatus.SAFE).sort((left, right) => left.order - right.order).map((row) => ({ id: row.id, order: row.order })),
    canEdit: canManage && allRowsSafe,
    canInvalidate: canManage && dataSet.rows.some((row) => row.status === TestDataStatus.SAFE) && !dataSet.rows.some((row) => row.status === TestDataStatus.RESERVED),
    ...(dataSet.product ? { product: dataSet.product } : {}),
    createdAt: dataSet.createdAt,
    updatedAt: dataSet.updatedAt
  };
}
