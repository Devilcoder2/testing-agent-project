import { Suspense } from "react";
import { AppShell } from "../../../components/app-shell";
import { NewRecordingView } from "../../../components/sentinel-views";

export default function NewRecordingPage() {
  return <AppShell><Suspense fallback={null}><NewRecordingView /></Suspense></AppShell>;
}
