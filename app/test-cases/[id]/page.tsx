"use client";

import { useParams } from "next/navigation";
import { AppShell } from "../../../components/app-shell";
import { TestCaseDetailView } from "../../../components/sentinel-views";

export default function TestCaseDetailPage() {
  const params = useParams<{ id: string }>();
  return <AppShell><TestCaseDetailView testCaseId={params.id} /></AppShell>;
}
