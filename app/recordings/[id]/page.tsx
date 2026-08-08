"use client";

import { useParams } from "next/navigation";
import { AppShell } from "../../../components/app-shell";
import { RecordingWorkspaceView } from "../../../components/sentinel-views";

export default function RecordingWorkspacePage() {
  const params = useParams<{ id: string }>();
  return <AppShell><RecordingWorkspaceView recordingId={params.id} /></AppShell>;
}
