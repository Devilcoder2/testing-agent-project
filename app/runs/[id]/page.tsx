"use client";

import { useParams } from "next/navigation";
import { RunWorkspaceView } from "../../../components/sentinel-views";

export default function RunDetailPage() {
  const params = useParams<{ id: string }>();
  return <RunWorkspaceView runId={params.id} />;
}
