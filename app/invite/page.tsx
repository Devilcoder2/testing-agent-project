import { AccountSetupView } from "@/components/account-views";
import { Suspense } from "react";

export default function InvitePage() {
  return <Suspense fallback={<main className="center" aria-label="Loading invitation">Loading invitation…</main>}><AccountSetupView kind="invite" /></Suspense>;
}
