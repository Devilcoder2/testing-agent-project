"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { Button, Card, Dialog, EmptyState, Feedback, Field, PageHeader, SelectInput, TextInput } from "./ui";
import { TelegramAdminStatusCard } from "./telegram-views";

type Product = { id: string; name: string };
type Member = { id: string; email: string; displayName: string; accountStatus: "ACTIVE" | "DISABLED"; role: "ADMIN" | "MANAGER" | "TESTER"; products: Product[] };
type PilotLeadStatus = "NEW" | "CONTACTED" | "INVITED" | "ARCHIVED";
type PilotLead = { id: string; email: string; name: string; company: string; qaTeamSize: "1" | "2-5" | "6-15" | "16+"; status: PilotLeadStatus; createdAt: string; updatedAt: string };

const pilotStatuses: Array<{ value: PilotLeadStatus; label: string }> = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "INVITED", label: "Invited" },
  { value: "ARCHIVED", label: "Archived" }
];

async function request(path: string, method = "GET", body?: unknown) {
  return apiRequest(path, { method, body });
}

export function AdministrationView() {
  const [members, setMembers] = useState<Member[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pilotLeads, setPilotLeads] = useState<PilotLead[]>([]);
  const [pilotStatus, setPilotStatus] = useState<"ALL" | PilotLeadStatus>("ALL");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingPilotLeadId, setPendingPilotLeadId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [confirming, setConfirming] = useState<Member | null>(null);
  const [deletingPilotLead, setDeletingPilotLead] = useState<PilotLead | null>(null);
  const load = async () => { setLoading(true); try { const [nextMembers, nextProducts, nextPilotLeads] = await Promise.all([request("admin/members") as Promise<Member[]>, request("products") as Promise<Product[]>, request("admin/pilot-waitlist") as Promise<PilotLead[]>]); setMembers(nextMembers); setProducts(nextProducts); setPilotLeads(nextPilotLeads); } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not load organization administration."); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const productIds = form.getAll("productId"); setMessage(""); setError("");
    try { const outcome = await request("admin/members", "POST", { displayName: form.get("displayName"), email: form.get("email"), role: form.get("role"), productIds }) as { existingAccount?: boolean }; setMessage(outcome.existingAccount ? "Existing account added to the organization." : "Invitation sent to the local Mailpit inbox."); event.currentTarget.reset(); setInviteOpen(false); await load(); } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not invite the member."); }
  }
  async function update(member: Member, body: Record<string, unknown>) {
    setMessage(""); setError("");
    try { await request(`admin/members/${member.id}`, "PATCH", body); setMessage(`${member.displayName} updated. Existing sessions were revoked if access changed.`); await load(); return true; } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not update the member."); return false; }
  }
  async function updatePilotStatus(lead: PilotLead, status: PilotLeadStatus) {
    setPendingPilotLeadId(lead.id); setMessage(""); setError("");
    try { await request(`admin/pilot-waitlist/${lead.id}`, "PATCH", { status }); setMessage(`${lead.name} marked ${status.toLowerCase()}.`); await load(); } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not update the pilot lead."); } finally { setPendingPilotLeadId(null); }
  }
  async function deletePilotLead(lead: PilotLead) {
    setPendingPilotLeadId(lead.id); setMessage(""); setError("");
    try { await request(`admin/pilot-waitlist/${lead.id}`, "DELETE"); setMessage("Pilot lead deleted permanently."); setDeletingPilotLead(null); await load(); } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not delete the pilot lead."); } finally { setPendingPilotLeadId(null); }
  }
  const visiblePilotLeads = pilotStatus === "ALL" ? pilotLeads : pilotLeads.filter((lead) => lead.status === pilotStatus);
  return <section className="page-stack"><PageHeader eyebrow="Organization administration" title="People, access, and pilot" detail="Review private-pilot interest, invite team members, and control Product access." actions={<Button onClick={() => setInviteOpen(true)}>Invite member</Button>} />
    {message && <Feedback tone="success">{message}</Feedback>}{error && <Feedback tone="danger">{error}</Feedback>}
    <TelegramAdminStatusCard />
    <div className="section-heading"><div><p className="eyebrow">Private pilot</p><h2>Pilot waitlist</h2><p>Qualified applications submitted through the public Sentinel landing page.</p></div><div className="pilot-ledger__filter"><label htmlFor="pilot-status-filter">Status</label><SelectInput id="pilot-status-filter" value={pilotStatus} onChange={(event) => setPilotStatus(event.target.value as typeof pilotStatus)}><option value="ALL">All statuses</option>{pilotStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</SelectInput></div></div>
    {loading ? <Card>Loading pilot applications…</Card> : visiblePilotLeads.length === 0 ? <EmptyState title="No pilot applications" detail={pilotStatus === "ALL" ? "New landing-page applications will appear here." : `No ${pilotStatus.toLowerCase()} applications match this filter.`} /> : <div className="pilot-ledger" aria-label="Pilot waitlist applications">{visiblePilotLeads.map((lead) => <article className="pilot-ledger__row" key={lead.id}><div className="pilot-ledger__identity"><strong>{lead.name}</strong><a href={`mailto:${lead.email}`}>{lead.email}</a><span>{lead.company}</span></div><div className="pilot-ledger__context"><span>QA team {lead.qaTeamSize}</span><time dateTime={lead.createdAt}>{new Date(lead.createdAt).toLocaleDateString()}</time></div><div className="pilot-ledger__actions"><label className="sr-only" htmlFor={`pilot-status-${lead.id}`}>Status for {lead.name}</label><SelectInput id={`pilot-status-${lead.id}`} value={lead.status} disabled={pendingPilotLeadId === lead.id} onChange={(event) => void updatePilotStatus(lead, event.target.value as PilotLeadStatus)}>{pilotStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</SelectInput><Button variant="danger" disabled={pendingPilotLeadId === lead.id} onClick={() => setDeletingPilotLead(lead)}>Delete</Button></div></article>)}</div>}
    <div className="section-heading"><div><p className="eyebrow">Members</p><h2>Organization members</h2></div><span>{members.length} people</span></div>
    {loading ? <Card>Loading members…</Card> : members.length === 0 ? <EmptyState title="No members yet" detail="Invite the first team member to establish organization access." /> : <div className="card-grid member-grid">{members.map((member) => <Card key={member.id} className="member-card"><div className="section-heading"><div><h3>{member.displayName}</h3><p>{member.email}</p></div></div><div className="member-card__meta"><span>User type: {member.role.toLowerCase()}</span><span>{member.products.length} Product{member.products.length === 1 ? "" : "s"}</span></div><div className="member-card__actions"><Button variant="secondary" onClick={() => setEditing(member)}>Edit access</Button><Button variant={member.accountStatus === "ACTIVE" ? "danger" : "secondary"} onClick={() => setConfirming(member)}>{member.accountStatus === "ACTIVE" ? "Disable" : "Reactivate"}</Button></div></Card>)}</div>}
    {inviteOpen && <Dialog eyebrow="Organization access" title="Invite a member" detail="The invitation link is delivered to the local Mailpit inbox and expires after 24 hours." onClose={() => setInviteOpen(false)}><form className="form-stack" onSubmit={invite}><Field label="Name"><TextInput name="displayName" required /></Field><Field label="Email"><TextInput name="email" type="email" required /></Field><Field label="Role"><SelectInput name="role" defaultValue="TESTER"><option value="TESTER">Tester</option><option value="MANAGER">Manager</option><option value="ADMIN">Admin</option></SelectInput></Field><fieldset className="checkbox-grid"><legend>Product access</legend>{products.map((product) => <label className="checkbox-row" key={product.id}><input name="productId" type="checkbox" value={product.id} /><span><strong>{product.name}</strong></span></label>)}</fieldset>{error && <Feedback tone="danger">{error}</Feedback>}<div className="modal__actions"><Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button><Button type="submit">Send invitation</Button></div></form></Dialog>}
    {editing && <MemberEditor member={editing} products={products} error={error} onClose={() => setEditing(null)} onSave={(body) => update(editing, body)} />}
    {confirming && <Dialog eyebrow="Confirm account state" title={`${confirming.accountStatus === "ACTIVE" ? "Disable" : "Reactivate"} ${confirming.displayName}?`} detail={confirming.accountStatus === "ACTIVE" ? "Disabling removes effective access and revokes active sessions while preserving history." : "Reactivating restores access according to the saved role and Product assignments."} onClose={() => setConfirming(null)} actions={<><Button variant="ghost" onClick={() => setConfirming(null)}>Cancel</Button><Button variant={confirming.accountStatus === "ACTIVE" ? "danger" : "primary"} onClick={() => { void update(confirming, { accountStatus: confirming.accountStatus === "ACTIVE" ? "DISABLED" : "ACTIVE" }); setConfirming(null); }}>{confirming.accountStatus === "ACTIVE" ? "Disable account" : "Reactivate account"}</Button></>} />}
    {deletingPilotLead && <Dialog eyebrow="Permanent deletion" title={`Delete ${deletingPilotLead.name}'s pilot application?`} detail="This permanently removes the submitted name, email, company, and QA-team information. The deletion audit keeps only the lead identifier." onClose={() => setDeletingPilotLead(null)} actions={<><Button variant="ghost" disabled={pendingPilotLeadId === deletingPilotLead.id} onClick={() => setDeletingPilotLead(null)}>Cancel</Button><Button variant="danger" disabled={pendingPilotLeadId === deletingPilotLead.id} onClick={() => void deletePilotLead(deletingPilotLead)}>{pendingPilotLeadId === deletingPilotLead.id ? "Deleting…" : "Delete permanently"}</Button></>} />}
  </section>;
}

function MemberEditor({ member, products, error, onClose, onSave }: { member: Member; products: Product[]; error: string; onClose: () => void; onSave: (body: Record<string, unknown>) => Promise<boolean> }) {
  const [role, setRole] = useState(member.role);
  const [productIds, setProductIds] = useState(member.products.map((product) => product.id));
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    try { if (await onSave({ role, productIds })) onClose(); } finally { setSaving(false); }
  }
  return <Dialog eyebrow="Member access" title={`Edit ${member.displayName}`} detail="Review the complete access change before saving. Existing sessions are revoked when effective access changes." onClose={onClose}><form className="form-stack" onSubmit={submit}><Field label="Role"><SelectInput value={role} onChange={(event) => setRole(event.target.value as Member["role"])}><option value="TESTER">Tester</option><option value="MANAGER">Manager</option><option value="ADMIN">Admin</option></SelectInput></Field><fieldset className="checkbox-grid"><legend>Product access</legend>{products.map((product) => <label className="checkbox-row" key={product.id}><input type="checkbox" checked={productIds.includes(product.id)} onChange={(event) => setProductIds((current) => event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} /><span><strong>{product.name}</strong></span></label>)}</fieldset>{error && <Feedback tone="danger">{error}</Feedback>}<div className="modal__actions"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save access"}</Button></div></form></Dialog>;
}
