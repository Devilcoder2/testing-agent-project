import { Suspense } from "react";
import { AppShell } from "../../components/app-shell";
import { TestCasesView } from "../../components/sentinel-views";

export default function TestCasesPage() {
  return <AppShell><Suspense><TestCasesView /></Suspense></AppShell>;
}
