import { AccountSetupView } from "@/components/account-views";
import { Suspense } from "react";

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="center" aria-label="Loading password reset">Loading password reset…</main>}><AccountSetupView kind="reset" /></Suspense>;
}
