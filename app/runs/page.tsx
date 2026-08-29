import { Suspense } from "react";
import { AppShell } from "../../components/app-shell";
import { RunsView } from "../../components/sentinel-views";

export default function RunsPage() {
  return <AppShell><Suspense><RunsView /></Suspense></AppShell>;
}
