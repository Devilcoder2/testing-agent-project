'use client';

import { LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import { useRef } from 'react';

const signInUrl =
  process.env.NEXT_PUBLIC_PRODUCT_SIGN_IN_URL ?? 'http://localhost:3001';

function ProductStage({ onPlay }: { onPlay: () => void }) {
  return (
    <div
      className="product-stage"
      aria-label="Sentinel release evidence preview"
    >
      <div className="stage-topbar">
        <span className="stage-brand">Sentinel / Checkout release</span>
        <span className="run-status">Run complete</span>
      </div>
      <div className="stage-body">
        <div className="browser-proof">
          <div className="browser-window">
            <div className="browser-bar" aria-hidden="true">
              <span className="browser-dot" />
              <span className="browser-dot" />
              <span className="browser-dot" />
              <span className="browser-url">shop.example.test / checkout</span>
            </div>
            <div className="release-board">
              <span className="release-kicker">Release readiness</span>
              <h2 className="release-title">Checkout candidate 2.4</h2>
              <div className="release-summary">
                <div className="release-stat">
                  <strong>14</strong>
                  <span>journeys passed</span>
                </div>
                <div className="release-stat">
                  <strong>01</strong>
                  <span>needs review</span>
                </div>
                <div className="release-stat">
                  <strong>42m</strong>
                  <span>evidence window</span>
                </div>
              </div>
              <div className="evidence-list" aria-label="Captured run evidence">
                {[
                  ['01', 'Cart quantity persists', 'Verified'],
                  ['02', 'Discount applies at checkout', 'Verified'],
                  ['03', 'Payment retry preserves state', 'Review'],
                  ['04', 'Receipt is delivered', 'Verified'],
                ].map(([index, label, state]) => (
                  <div className="evidence-row" key={label}>
                    <span className="evidence-index">{index}</span>
                    <span>{label}</span>
                    <span className="evidence-ok">{state}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <button
            className="play-control"
            type="button"
            onClick={onPlay}
            aria-label="Play the Sentinel walkthrough"
          >
            <svg width="22" height="24" viewBox="0 0 22 24" aria-hidden="true">
              <path d="M21 12 1 23V1l20 11Z" fill="currentColor" />
            </svg>
          </button>
        </div>
        <aside className="timeline" aria-label="Run timeline">
          <p className="timeline-label">Live evidence</p>
          <ol>
            <li>
              <strong>Open checkout</strong>Screenshot · network
            </li>
            <li>
              <strong>Apply discount</strong>DOM · console
            </li>
            <li className="is-active">
              <strong>Retry payment</strong>Checkpoint paused
            </li>
            <li>
              <strong>Verify receipt</strong>Storage · screenshot
            </li>
          </ol>
        </aside>
      </div>
    </div>
  );
}

export default function Home() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reduceMotion = useReducedMotion();

  const reveal = reduceMotion
    ? undefined
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };

  return (
    <LazyMotion features={domAnimation}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="site-shell">
        <header className="site-header">
          <div className="header-inner">
            <a className="wordmark" href="#main" aria-label="Sentinel home">
              <span className="wordmark-mark" aria-hidden="true" />
              Sentinel
            </a>
            <nav className="main-nav" aria-label="Primary navigation">
              <a href="#product">Product</a>
              <a href="#how-it-works">How it works</a>
              <a href="#evidence">Evidence</a>
              <a href="#pilot">Pilot</a>
            </nav>
            <div className="header-actions">
              <a className="text-link" href={signInUrl}>
                Sign in
              </a>
              <a className="button button-primary" href="#pilot">
                Join the pilot
              </a>
            </div>
          </div>
        </header>

        <main id="main">
          <section className="hero" id="product">
            <div className="hero-grid">
              <m.div
                {...reveal}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              >
                <p className="eyebrow">QA automation with human judgment</p>
                <h1>
                  Teach the test once. <em>Trust</em> every release.
                </h1>
                <p className="hero-copy">
                  Sentinel turns the browser journeys your team already knows
                  into repeatable runs, complete evidence, and clear release
                  decisions.
                </p>
                <div className="hero-actions">
                  <a className="button button-primary" href="#pilot">
                    Join the pilot waitlist
                  </a>
                  <button
                    className="button"
                    type="button"
                    onClick={() => dialogRef.current?.showModal()}
                  >
                    Watch the walkthrough <span aria-hidden="true">↗</span>
                  </button>
                </div>
                <p className="hero-note">
                  Built for startup QA and engineering teams. Pilot access is
                  selected, not first-come-first-served.
                </p>
              </m.div>

              <m.div
                className="media-column"
                initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.12, ease: 'easeOut' }}
              >
                <ProductStage onPlay={() => dialogRef.current?.showModal()} />
              </m.div>
            </div>
            <div className="signal-rule" aria-hidden="true">
              <m.span
                initial={
                  reduceMotion
                    ? undefined
                    : { scaleX: 0, transformOrigin: 'left' }
                }
                animate={reduceMotion ? undefined : { scaleX: 1 }}
                transition={{ duration: 0.75, delay: 0.25, ease: 'easeOut' }}
              />
            </div>
          </section>

          <section
            className="pilot-preview"
            id="pilot"
            aria-labelledby="pilot-preview-title"
          >
            <p className="eyebrow">Pilot applications</p>
            <h2 id="pilot-preview-title">
              Bring one release journey. Leave with a repeatable system.
            </h2>
            <p>
              The short qualifier and secure waitlist form are being connected
              next.
            </p>
          </section>
        </main>
      </div>

      <dialog className="video-dialog" ref={dialogRef}>
        <div className="dialog-bar">
          <strong>Sentinel product walkthrough</strong>
          <button
            className="dialog-close"
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close walkthrough"
          >
            ×
          </button>
        </div>
        <div className="dialog-content">
          <p className="eyebrow">Walkthrough coming before launch</p>
          <h2>See a journey taught, replayed, and reviewed.</h2>
          <p>
            The final captioned walkthrough will load here only after you choose
            to play it. For now, the release-evidence preview shows the full
            story: human instruction, autonomous replay, captured proof, and a
            decision that stays with your team.
          </p>
          <a
            className="button button-ink"
            href="#pilot"
            onClick={() => dialogRef.current?.close()}
          >
            Join the pilot
          </a>
        </div>
      </dialog>
    </LazyMotion>
  );
}
