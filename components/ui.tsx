import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function SentinelMark({ compact = false }: { compact?: boolean }) {
  return <div className={classes("sentinel-brand", compact && "sentinel-brand--compact")}>
    <span className="sentinel-mark" aria-hidden="true"><span /></span>
    {!compact && <span className="sentinel-wordmark">Sentinel</span>}
  </div>;
}

export function Button({ className, variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button className={classes("button", `button--${variant}`, className)} {...props} />;
}

export function IconButton({ label, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button className={classes("icon-button", className)} aria-label={label} title={label} {...props}>{children}</button>;
}

export function Card({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={classes("card", className)} {...props}>{children}</section>;
}

export function StatusBadge({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warning" | "danger" | "info"; children: ReactNode }) {
  return <span className={classes("status-badge", `status-badge--${tone}`)}><span aria-hidden="true" />{children}</span>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span className="field__label">{label}</span>{children}{hint && <span className="field__hint">{hint}</span>}</label>;
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={classes("input", props.className)} {...props} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <span className="select-wrap"><select className={classes("input", "select", props.className)} {...props} /></span>;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={classes("input", "textarea", props.className)} {...props} />;
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-state__mark" aria-hidden="true">+</div><h2>{title}</h2><p>{detail}</p>{action}</div>;
}

export function Feedback({ tone = "info", children }: { tone?: "info" | "success" | "danger" | "warning"; children: ReactNode }) {
  return <p className={classes("feedback", `feedback--${tone}`)} role="status" aria-live="polite">{children}</p>;
}

export function PageHeader({ eyebrow, title, detail, actions }: { eyebrow?: string; title: string; detail?: string; actions?: ReactNode }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow ?? "Sentinel"}</p><h1>{title}</h1>{detail && <p className="page-header__detail">{detail}</p>}</div>{actions && <div className="page-header__actions">{actions}</div>}</header>;
}
