"use client";

import { useEffect, useState } from "react";
import { Button, Feedback, Field, SelectInput } from "./ui";

type Member = { id: string; displayName: string; email: string };
type MembershipResponse = { canTransfer: boolean; members: Member[] };

async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error ?? "Ownership transfer failed.");
  return payload;
}

export function OwnershipTransfer({ label, currentOwnerId, membersPath, transferPath, onTransferred }: { label: string; currentOwnerId: string; membersPath: string; transferPath: string; onTransferred: () => void }) {
  const [access, setAccess] = useState<MembershipResponse | null>(null);
  const [nextOwnerId, setNextOwnerId] = useState("");
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => { void request(membersPath).then((result) => setAccess(result as MembershipResponse)).catch(() => setAccess(null)); }, [membersPath]);
  const eligible = access?.members.filter((member) => member.id !== currentOwnerId) ?? [];
  if (!access?.canTransfer || eligible.length === 0) return null;

  async function transfer() {
    if (!nextOwnerId) return;
    setWorking(true); setFeedback("");
    try {
      await request(transferPath, "PATCH", { ownerId: nextOwnerId });
      setOpen(false); setNextOwnerId(""); onTransferred();
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Ownership transfer failed."); } finally { setWorking(false); }
  }

  return <><Button variant="secondary" onClick={() => setOpen(true)}>Transfer {label} ownership</Button>{open && <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="ownership-transfer-title"><div className="modal__header"><div><p className="eyebrow">Ownership continuity</p><h2 id="ownership-transfer-title">Transfer {label} ownership</h2><p>The selected existing member receives future ownership actions. Historical Runs and audit history remain unchanged.</p></div><Button variant="ghost" onClick={() => setOpen(false)} disabled={working}>Close</Button></div><Field label="New owner"><SelectInput value={nextOwnerId} onChange={(event) => setNextOwnerId(event.target.value)}><option value="">Select an eligible member</option>{eligible.map((member) => <option key={member.id} value={member.id}>{member.displayName} · {member.email}</option>)}</SelectInput></Field>{feedback && <Feedback tone="danger">{feedback}</Feedback>}<div className="modal__actions"><Button variant="ghost" onClick={() => setOpen(false)} disabled={working}>Cancel</Button><Button onClick={() => void transfer()} disabled={working || !nextOwnerId}>{working ? "Transferring…" : "Confirm transfer"}</Button></div></section></div>}</>;
}
