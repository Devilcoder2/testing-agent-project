"use client";

import { useParams } from "next/navigation";
import { RecordingWorkspaceView } from "../../../components/sentinel-views";

export default function RecordingWorkspacePage() {
  const params = useParams<{ id: string }>();
  return <RecordingWorkspaceView recordingId={params.id} />;
}
