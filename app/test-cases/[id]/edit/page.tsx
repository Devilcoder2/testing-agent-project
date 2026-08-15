"use client";

import { useParams } from "next/navigation";
import { AppShell } from "../../../../components/app-shell";
import { TestCaseEditorView } from "../../../../components/test-case-editor";

export default function TestCaseEditPage() {
  const params = useParams<{ id: string }>();
  return <AppShell><TestCaseEditorView testCaseId={params.id} /></AppShell>;
}
