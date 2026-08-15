"use client";

import { useParams } from "next/navigation";
import { AppShell } from "../../../components/app-shell";
import { ReleaseDetailView } from "../../../components/release-views";

export default function ReleaseDetailPage() {
  const params = useParams<{ id: string }>();
  return <AppShell><ReleaseDetailView releaseId={params.id} /></AppShell>;
}
