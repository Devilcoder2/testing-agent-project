"use client";

import { useEffect, useId, useRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type SVGProps, type TextareaHTMLAttributes } from "react";

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export type IconName = "admin" | "bell" | "check" | "chevronLeft" | "chevronRight" | "close" | "dashboard" | "data" | "menu" | "more" | "plus" | "products" | "releases" | "review" | "runs" | "search" | "signOut" | "testCases";

const iconPaths: Record<IconName, ReactNode> = {
  admin: <><circle cx="12" cy="8" r="3" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0M19 4v4M17 6h4" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  data: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  products: <><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" /><path d="m4 12 8 4.5 8-4.5M4 16.5 12 21l8-4.5" /></>,
  releases: <><path d="M4 4h16v16H4z" /><path d="M8 9h8M8 13h8M8 17h5" /></>,
  review: <><path d="M4 4h16v16H4z" /><path d="m8 12 2.5 2.5L16 9" /></>,
  runs: <><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4V8Z" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  signOut: <><path d="M10 4H5v16h5M14 8l4 4-4 4M9 12h9" /></>,
  testCases: <><path d="M5 4h14v16H5z" /><path d="m8 9 1.5 1.5L12 8M14 9h2M8 15l1.5 1.5L12 14M14 15h2" /></>
};

export function Icon({ name, className, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return <svg className={classes("icon", className)} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{iconPaths[name]}</svg>;
}

export function SentinelMark({ compact = false }: { compact?: boolean }) {
  return <div className={classes("sentinel-brand", compact && "sentinel-brand--compact")}>
    <span className="sentinel-mark" aria-hidden="true"><i /><i /><i /><i /></span>
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
  return <div className="empty-state"><div className="empty-state__mark" aria-hidden="true"><span /><span /><span /></div><h2>{title}</h2><p>{detail}</p>{action}</div>;
}

export function Feedback({ tone = "info", children }: { tone?: "info" | "success" | "danger" | "warning"; children: ReactNode }) {
  return <p className={classes("feedback", `feedback--${tone}`)} role="status" aria-live="polite">{children}</p>;
}

export function PageHeader({ eyebrow, title, detail, actions }: { eyebrow?: string; title: string; detail?: string; actions?: ReactNode }) {
  return <header className="page-header"><div className="page-header__copy"><p className="eyebrow">{eyebrow ?? "Sentinel"}</p><h1>{title}</h1>{detail && <p className="page-header__detail">{detail}</p>}</div>{actions && <div className="page-header__actions">{actions}</div>}<span className="page-header__rule" aria-hidden="true" /></header>;
}

export function Dialog({ title, eyebrow, detail, children, actions, onClose, className }: { title: string; eyebrow?: string; detail?: string; children?: ReactNode; actions?: ReactNode; onClose: () => void; className?: string }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
    focusable?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab" || !dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>("button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])")];
      if (!items.length) return;
      const first = items[0]; const last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" role="presentation"><section ref={dialogRef} className={classes("modal", className)} role="dialog" aria-modal="true" aria-labelledby={titleId}><div className="modal__header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id={titleId}>{title}</h2>{detail && <p>{detail}</p>}</div><IconButton label="Close dialog" type="button" onClick={onClose}><Icon name="close" /></IconButton></div>{children}{actions && <div className="modal__actions">{actions}</div>}</section></div>;
}

export function Pagination({ page, totalItems, pageSize = 25, onPageChange, label = "results" }: { page: number; totalItems: number; pageSize?: number; onPageChange: (page: number) => void; label?: string }) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  return <nav className="pagination" aria-label={`${label} pagination`}><p>{start}–{end} of {totalItems} {label}</p><div><IconButton label="Previous page" onClick={() => onPageChange(page - 1)} disabled={page <= 1}><Icon name="chevronLeft" /></IconButton><span aria-current="page">Page {page} of {pageCount}</span><IconButton label="Next page" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}><Icon name="chevronRight" /></IconButton></div></nav>;
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return <div className="skeleton" aria-label="Loading content" role="status">{Array.from({ length: lines }, (_, index) => <span key={index} />)}</div>;
}
