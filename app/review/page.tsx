import { Suspense } from "react";
import { AppShell } from "../../components/app-shell";
import { ReviewView } from "../../components/review-views";

export default function ReviewPage() {
  return <AppShell><Suspense><ReviewView /></Suspense></AppShell>;
}
