'use client';

import { AnimatePresence, m } from 'motion/react';
import { useState } from 'react';
import { SentinelLogo } from './sentinel-logo';

const destinations = [
  ['Dashboard', 'grid'],
  ['Products', 'box'],
  ['Test Cases', 'check'],
  ['Test Data', 'table'],
  ['Runs', 'play'],
  ['Releases', 'flag'],
  ['Review', 'eye'],
] as const;

type Destination = (typeof destinations)[number][0];

const viewCopy: Record<Destination, { eyebrow: string; title: string; description: string }> = {
  Dashboard: {
    eyebrow: 'Workspace overview',
    title: 'Good morning, Maya.',
    description: 'The important release signals, without the release-week scavenger hunt.',
  },
  Products: {
    eyebrow: 'Products',
    title: 'Billing Portal',
    description: 'One product boundary for its journeys, data, Runs, and release evidence.',
  },
  'Test Cases': {
    eyebrow: 'Test Cases / TC-018',
    title: 'Checkout with saved card',
    description: 'A browser journey taught once and kept readable step by step.',
  },
  'Test Data': {
    eyebrow: 'Test Data / TD-004',
    title: 'Pilot customer set',
    description: 'Reusable values stay separate from the journey that consumes them.',
  },
  Runs: {
    eyebrow: 'Runs / RUN-204',
    title: 'Checkout regression',
    description: 'Every replay step stays linked to the evidence it produced.',
  },
  Releases: {
    eyebrow: 'Releases / 2026.09',
    title: 'September release',
    description: 'Readiness is assembled from current Runs, evidence, and owner decisions.',
  },
  Review: {
    eyebrow: 'Review queue',
    title: 'One decision needs a human.',
    description: 'Sentinel can surface uncertainty. It cannot quietly approve past it.',
  },
};

function NavIcon({ type }: { type: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (type === 'play') return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" {...common} /><path d="m8.5 7 4 3-4 3Z" {...common} /></svg>;
  if (type === 'check') return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="3.5" width="12" height="13" rx="2" {...common} /><path d="m7 10 2 2 4-5" {...common} /></svg>;
  if (type === 'table') return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4" width="14" height="12" rx="2" {...common} /><path d="M3 8h14M8 8v8" {...common} /></svg>;
  if (type === 'flag') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 17V3m0 1h9l-2 3 2 3H5" {...common} /></svg>;
  if (type === 'eye') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 10s2.7-4.5 7.5-4.5 7.5 4.5 7.5 4.5-2.7 4.5-7.5 4.5S2.5 10 2.5 10Z" {...common} /><circle cx="10" cy="10" r="2" {...common} /></svg>;
  if (type === 'box') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 2.8 6.5 3.5v7.4L10 17.2l-6.5-3.5V6.3Z" {...common} /><path d="m3.5 6.3 6.5 3.6 6.5-3.6M10 9.9v7.3" {...common} /></svg>;
  return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="5.5" height="5.5" rx="1" {...common} /><rect x="11.5" y="3" width="5.5" height="5.5" rx="1" {...common} /><rect x="3" y="11.5" width="5.5" height="5.5" rx="1" {...common} /><rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1" {...common} /></svg>;
}

function Status({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'wait'; children: React.ReactNode }) {
  return <span className={`demo-status demo-status-${tone}`}>{children}</span>;
}

function DashboardView() {
  return <>
    <div className="demo-stat-grid">
      <article><span>Release readiness</span><strong>Review</strong><small>1 owner decision</small></article>
      <article><span>Latest Run</span><strong>Passed</strong><small>8 of 8 steps</small></article>
      <article><span>Evidence</span><strong>Complete</strong><small>4 signal types</small></article>
    </div>
    <div className="demo-two-column">
      <article className="demo-panel"><header><h4>Current release</h4><Status tone="wait">Needs review</Status></header><div className="release-score"><span>2026.09</span><strong>3 / 4</strong></div><div className="progress-track"><i /></div><p>Automated checks are complete. One checkpoint is waiting for Maya.</p></article>
      <article className="demo-panel"><header><h4>Recent activity</h4><span className="demo-muted">Today</span></header><ul className="activity-list"><li><i className="activity-good" /><span><strong>Checkout regression</strong><small>Run completed · 8 steps</small></span><time>09:42</time></li><li><i /><span><strong>Release review</strong><small>Owner decision requested</small></span><time>09:44</time></li></ul></article>
    </div>
  </>;
}

function ProductsView() {
  return <div className="demo-product-card"><div className="product-symbol">BP</div><div><span className="demo-kicker">Web application</span><h4>Billing Portal</h4><p>Customer checkout, saved payment methods, invoices, and account access.</p></div><dl><div><dt>Test Cases</dt><dd>1</dd></div><div><dt>Active release</dt><dd>2026.09</dd></div><div><dt>Last Run</dt><dd><Status tone="good">Passed</Status></dd></div></dl></div>;
}

function TestCasesView() {
  const steps = ['Open the billing portal', 'Sign in as the pilot customer', 'Choose the saved Visa card', 'Confirm the order summary', 'Verify the receipt'];
  return <div className="demo-panel journey-panel"><header><div><span className="demo-kicker">Recorded journey</span><h4>5 readable steps</h4></div><Status>Version 3</Status></header><ol>{steps.map((step, index) => <li key={step}><span>{index + 1}</span><div><strong>{step}</strong><small>{index === 2 ? 'Uses cardAlias from Pilot customer set' : 'Browser action captured with intent'}</small></div>{index === 4 ? <Status tone="good">Assertion</Status> : null}</li>)}</ol></div>;
}

function TestDataView() {
  return <div className="demo-panel data-panel"><header><div><span className="demo-kicker">Reusable · redacted in evidence</span><h4>Pilot customer set</h4></div><Status>3 variables</Status></header><table className="demo-table"><caption className="sr-only">Sample test data</caption><thead><tr><th>Variable</th><th>Sample value</th><th>Policy</th></tr></thead><tbody><tr><td>accountEmail</td><td>pilot@example.test</td><td>Reusable</td></tr><tr><td>cardAlias</td><td>saved-visa</td><td>Reusable</td></tr><tr><td>securityCode</td><td>•••</td><td>Single use</td></tr></tbody></table></div>;
}

function RunsView() {
  const steps = ['Open portal', 'Sign in', 'Select saved card', 'Confirm order'];
  return <div className="run-layout"><div className="demo-panel run-steps"><header><h4>Run timeline</h4><Status tone="good">Passed</Status></header>{steps.map((step, index) => <div className={index === 2 ? 'run-step run-step-active' : 'run-step'} key={step}><span>{index + 1}</span><div><strong>{step}</strong><small>{index === 2 ? 'Screenshot · Network · Console' : 'Completed in sample replay'}</small></div><Status tone="good">✓</Status></div>)}</div><div className="demo-panel evidence-panel"><header><h4>Step 3 evidence</h4><span className="demo-muted">09:42:18</span></header><div className="evidence-preview"><div className="checkout-mini"><span>Payment method</span><strong>Visa ···· 4242</strong><i /></div></div><div className="evidence-tabs"><span className="active">Screenshot</span><span>Network 12</span><span>Console 0</span></div></div></div>;
}

function ReleasesView() {
  return <div className="demo-two-column"><article className="demo-panel release-panel"><header><div><span className="demo-kicker">Target · 03 Sep</span><h4>Release 2026.09</h4></div><Status tone="wait">Review</Status></header><div className="release-check"><span>Journey replay</span><Status tone="good">Passed</Status></div><div className="release-check"><span>Evidence complete</span><Status tone="good">Complete</Status></div><div className="release-check"><span>Owner approval</span><Status tone="wait">Waiting</Status></div></article><article className="demo-panel"><header><h4>Decision trail</h4><span className="demo-muted">Immutable</span></header><p className="decision-note">“Checkout evidence is complete. Verify the updated tax notice before approval.”</p><div className="decision-owner"><span className="avatar">M</span><span><strong>Maya Chen</strong><small>Release owner</small></span></div></article></div>;
}

function ReviewView() {
  return <div className="demo-panel review-panel"><div className="review-signal"><span>!</span></div><div><span className="demo-kicker">Human checkpoint</span><h4>Tax notice changed during replay</h4><p>The checkout completed, but the visible notice differs from the taught journey. Sentinel stopped the decision here instead of guessing.</p><div className="review-evidence"><span>Screenshot attached</span><span>DOM difference located</span><span>No console errors</span></div></div></div>;
}

function ActiveView({ destination }: { destination: Destination }) {
  if (destination === 'Dashboard') return <DashboardView />;
  if (destination === 'Products') return <ProductsView />;
  if (destination === 'Test Cases') return <TestCasesView />;
  if (destination === 'Test Data') return <TestDataView />;
  if (destination === 'Runs') return <RunsView />;
  if (destination === 'Releases') return <ReleasesView />;
  return <ReviewView />;
}

export function InteractiveProductDemo() {
  const [destination, setDestination] = useState<Destination>('Dashboard');
  const copy = viewCopy[destination];

  return (
    <section className="interactive-demo" aria-label="Interactive Sentinel product preview">
      <div className="demo-disclosure"><span className="demo-live-dot" aria-hidden="true" /> Interactive preview <i /> Sample data <i /> Read only</div>
      <div className="demo-shell">
        <aside className="demo-sidebar">
          <div className="demo-brand"><SentinelLogo /><span>Preview workspace</span></div>
          <nav aria-label="Preview destinations">
            {destinations.map(([label, icon]) => <button key={label} type="button" className={destination === label ? 'active' : ''} aria-current={destination === label ? 'page' : undefined} onClick={() => setDestination(label)}><NavIcon type={icon} /><span>{label}</span>{label === 'Review' ? <b>1</b> : null}</button>)}
          </nav>
          <div className="demo-account"><span className="avatar">M</span><span><strong>Maya Chen</strong><small>Sample account</small></span></div>
        </aside>
        <div className="demo-main">
          <header className="demo-topbar"><div className="demo-breadcrumb">Sentinel Pilot <span>/</span> Billing Portal</div><div className="demo-readonly-lock"><span aria-hidden="true">⌁</span> Navigation only</div></header>
          <AnimatePresence mode="wait" initial={false}>
            <m.div className="demo-view" key={destination} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
              <div className="demo-view-heading"><span>{copy.eyebrow}</span><h3>{copy.title}</h3><p>{copy.description}</p></div>
              <ActiveView destination={destination} />
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
