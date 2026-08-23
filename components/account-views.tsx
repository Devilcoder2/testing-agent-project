"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button, Card, Feedback, Field, TextInput } from "./ui";

async function request(path: string, body: unknown) {
  const response = await fetch(`/api/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "Request failed.");
  return payload;
}

export function AccountSetupView({ kind }: { kind: "invite" | "reset" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const token = params.get("token") ?? "";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmation")) return setMessage("The password confirmation does not match.");
    setSubmitting(true); setMessage("");
    try {
      await request(kind === "invite" ? "auth/invitations/accept" : "auth/password-reset/complete", { token, password: form.get("password") });
      router.replace("/");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update the account."); } finally { setSubmitting(false); }
  }
  return <main className="auth-page"><section className="auth-page__story"><div className="sentinel-brand"><span className="sentinel-mark" aria-hidden="true"><span /></span><span className="sentinel-wordmark">Sentinel</span></div><p className="eyebrow">Secure account setup</p><h1>{kind === "invite" ? "Join your Sentinel organization." : "Set a new password."}</h1><p>Use a password with at least 12 characters. This one-time link expires after 24 hours.</p></section><section className="auth-page__form-wrap"><Card className="auth-card"><form className="auth-form" onSubmit={submit}><Field label="New password"><TextInput name="password" type="password" autoComplete="new-password" required /></Field><Field label="Confirm password"><TextInput name="confirmation" type="password" autoComplete="new-password" required /></Field>{message && <Feedback tone="danger">{message}</Feedback>}<Button type="submit" disabled={submitting || !token}>{submitting ? "Saving…" : "Save password"}</Button><Link href="/" className="button button--secondary">Back to sign in</Link></form></Card></section></main>;
}

export function PasswordResetRequestView() {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setSubmitting(true); setMessage("");
    try { const result = await request("auth/password-reset/request", { email: form.get("email") }); setMessage(result.message); } catch { setMessage("If the account exists, a password reset link has been sent."); } finally { setSubmitting(false); }
  }
  return <main className="auth-page"><section className="auth-page__story"><div className="sentinel-brand"><span className="sentinel-mark" aria-hidden="true"><span /></span><span className="sentinel-wordmark">Sentinel</span></div><p className="eyebrow">Account recovery</p><h1>Reset your password.</h1><p>We will send a one-time link if the email belongs to an active Sentinel account.</p></section><section className="auth-page__form-wrap"><Card className="auth-card"><form className="auth-form" onSubmit={submit}><Field label="Email"><TextInput name="email" type="email" autoComplete="email" required /></Field>{message && <Feedback tone="success">{message}</Feedback>}<Button type="submit" disabled={submitting}>{submitting ? "Sending…" : "Send reset link"}</Button><Link href="/" className="button button--secondary">Back to sign in</Link></form></Card></section></main>;
}
