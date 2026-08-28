"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { Button, Card, Dialog, Feedback, PageHeader, StatusBadge } from "./ui";

type AccountTelegram = { configured: boolean; linked: boolean; linkedAt: string | null };
type AdminTelegram = { configured: boolean; active: boolean; webhookActiveAt: string | null; lastCheckedAt: string | null; safeError: string | null; linkedIdentities: number; failedDeliveriesLast24Hours: number };

async function request(path: string, method = "GET") {
  return apiRequest(path, { method });
}

export function TelegramIntegrationsView() {
  const [state, setState] = useState<AccountTelegram | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = async () => { try { setState(await request("account/telegram") as AccountTelegram); } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not load Telegram status."); } };
  useEffect(() => { void load(); }, []);
  async function createLink() {
    setError(""); setMessage("");
    try { const result = await request("account/telegram/link", "POST") as { deepLink: string }; setLink(result.deepLink); } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not create a Telegram link."); }
  }
  async function unlink() {
    setError(""); setMessage("");
    try { await request("account/telegram", "DELETE"); setMessage("Telegram was unlinked. Future chat commands are blocked immediately."); setLink(null); await load(); } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not unlink Telegram."); }
  }
  return <section className="page-stack"><PageHeader eyebrow="Account" title="Integrations" detail="Connect only a private Telegram chat. Sentinel never stores your conversation or shares Run evidence in chat." />
    {message && <Feedback tone="success">{message}</Feedback>}{error && <Feedback tone="danger">{error}</Feedback>}
    <Card className="integration-card"><div className="section-heading"><div><p className="eyebrow">Telegram Run Assistant</p><h2>Private-chat Run requests</h2></div><StatusBadge tone={state?.linked ? "success" : "neutral"}>{state?.linked ? "Linked" : "Not linked"}</StatusBadge></div><p>Use guided buttons to select eligible individual Auto Runs. Telegram cannot receive Test Data, evidence, Run links, cancellation, or administration commands.</p>{!state ? <p>Loading integration status…</p> : !state.configured ? <Feedback tone="warning">Telegram is not configured for this local Sentinel deployment.</Feedback> : state.linked ? <div className="inline-actions"><Button variant="danger" onClick={unlink}>Unlink Telegram</Button><span>Unlinking immediately blocks future commands from this chat.</span></div> : <div className="inline-actions"><Button onClick={createLink}>Get Telegram link</Button><span>The one-time link expires after 10 minutes and binds the next private chat only.</span></div>}</Card>
    {link && <Dialog eyebrow="Private Telegram link" title="Open Telegram to finish linking" detail="This one-time link expires in 10 minutes. It does not make Sentinel public." onClose={() => setLink(null)} actions={<><Button variant="ghost" onClick={() => setLink(null)}>Close</Button><Button onClick={() => void navigator.clipboard?.writeText(link).then(() => setMessage("Telegram link copied."))}>Copy link</Button></>}><p className="integration-link"><a href={link} target="_blank" rel="noreferrer">Open Telegram link</a></p><p>Telegram must be a private chat. Group messages and unlinked chats cannot run anything.</p></Dialog>}
  </section>;
}

export function TelegramAdminStatusCard() {
  const [state, setState] = useState<AdminTelegram | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = async () => { try { setState(await request("admin/telegram") as AdminTelegram); } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not load Telegram integration status."); } };
  useEffect(() => { void load(); }, []);
  async function setActive(active: boolean) {
    setMessage(""); setError("");
    try { await request(`admin/telegram/${active ? "activate" : "deactivate"}`, "POST"); setMessage(active ? "Telegram webhook activated." : "Telegram webhook deactivated."); await load(); } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not update Telegram webhook status."); }
  }
  const tone = state?.active ? "success" : state?.configured ? "warning" : "neutral";
  return <Card className="integration-card"><div className="section-heading"><div><p className="eyebrow">Deployment integration</p><h2>Telegram Run Assistant</h2></div><StatusBadge tone={tone}>{state?.active ? "Webhook active" : state?.configured ? "Ready to activate" : "Configuration needed"}</StatusBadge></div><p>Only the route-restricted Telegram webhook gateway is reachable through the optional tunnel. Bot credentials, webhook URL, chat IDs, and message text remain server-only.</p>{message && <Feedback tone="success">{message}</Feedback>}{error && <Feedback tone="danger">{error}</Feedback>}{state && <dl className="integration-card__metrics"><div><dt>Linked private chats</dt><dd>{state.linkedIdentities}</dd></div><div><dt>Failed deliveries (24h)</dt><dd>{state.failedDeliveriesLast24Hours}</dd></div><div><dt>Last webhook check</dt><dd>{state.lastCheckedAt ? new Date(state.lastCheckedAt).toLocaleString() : "Not checked"}</dd></div></dl>}{state?.safeError && <Feedback tone="warning">Telegram reported a safe connection error. Check server-only configuration and the webhook tunnel.</Feedback>}<div className="inline-actions">{state?.active ? <Button variant="danger" onClick={() => void setActive(false)}>Deactivate webhook</Button> : <Button disabled={!state?.configured} onClick={() => void setActive(true)}>Activate webhook</Button>}</div></Card>;
}
