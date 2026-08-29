import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { TestDataView } from "@/components/test-data-view";

export default function TestDataPage() {
  return <AppShell><Suspense><TestDataView /></Suspense></AppShell>;
}
