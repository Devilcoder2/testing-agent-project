"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button, Card, EmptyState, Feedback, Field, PageHeader, SelectInput, TextInput } from "./ui";

type Product = { id: string; name: string };
type Member = { id: string; email: string; displayName: string; accountStatus: "ACTIVE" | "DISABLED"; role: "ADMIN" | "MANAGER" | "TESTER"; products: Product[] };

async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "Request failed.");
  return payload;
}

export function AdministrationView() {
  const [members, setMembers] = useState<Member[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); try { const [nextMembers, nextProducts] = await Promise.all([request("admin/members"), request("products")]); setMembers(nextMembers); setProducts(nextProducts); } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not load organization members."); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const productIds = form.getAll("productId"); setMessage(""); setError("");
    try { const outcome = await request("admin/members", "POST", { displayName: form.get("displayName"), email: form.get("email"), role: form.get("role"), productIds }); setMessage(outcome.existingAccount ? "Existing account added to the organization." : "Invitation sent to the local Mailpit inbox."); event.currentTarget.reset(); await load(); } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not invite the member."); }
  }
  async function update(member: Member, body: Record<string, unknown>) {
    setMessage(""); setError("");
    try { await request(`admin/members/${member.id}`, "PATCH", body); setMessage(`${member.displayName} updated. Existing sessions were revoked if access changed.`); await load(); } catch (issue) { setError(issue instanceof Error ? issue.message : "Could not update the member."); }
  }
  return <section className="page-stack"><PageHeader eyebrow="Organization administration" title="People and access" detail="Invite team members, assign their role, and set the Products they may access." />
    <Card><h2>Invite a member</h2><form className="form-grid" onSubmit={invite}><Field label="Name"><TextInput name="displayName" required /></Field><Field label="Email"><TextInput name="email" type="email" required /></Field><Field label="Role"><SelectInput name="role" defaultValue="TESTER"><option value="TESTER">Tester</option><option value="MANAGER">Manager</option><option value="ADMIN">Admin</option></SelectInput></Field><Field label="Product access"><select name="productId" multiple size={Math.max(2, products.length)} aria-label="Product access">{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></Field><Button type="submit">Send invitation</Button></form></Card>
    {message && <Feedback tone="success">{message}</Feedback>}{error && <Feedback tone="danger">{error}</Feedback>}
    <div className="section-heading"><div><p className="eyebrow">Members</p><h2>Organization members</h2></div><span>{members.length} people</span></div>
    {loading ? <Card>Loading members…</Card> : members.length === 0 ? <EmptyState title="No members yet" detail="Invite the first team member above." /> : <div className="card-grid">{members.map((member) => <Card key={member.id}><div className="section-heading"><div><h3>{member.displayName}</h3><p>{member.email}</p></div><span className={`status-badge status-badge--${member.accountStatus === "ACTIVE" ? "success" : "danger"}`}>{member.accountStatus}</span></div><Field label="Role"><SelectInput value={member.role} onChange={(event) => void update(member, { role: event.target.value })}><option value="TESTER">Tester</option><option value="MANAGER">Manager</option><option value="ADMIN">Admin</option></SelectInput></Field><Field label="Product access"><select multiple value={member.products.map((product) => product.id)} onChange={(event) => void update(member, { productIds: [...event.currentTarget.selectedOptions].map((option) => option.value) })}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></Field><Button variant={member.accountStatus === "ACTIVE" ? "danger" : "secondary"} onClick={() => void update(member, { accountStatus: member.accountStatus === "ACTIVE" ? "DISABLED" : "ACTIVE" })}>{member.accountStatus === "ACTIVE" ? "Disable account" : "Reactivate account"}</Button></Card>)}</div>}
  </section>;
}
