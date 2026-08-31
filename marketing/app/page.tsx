'use client';

import { LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { WaitlistForm } from '@/components/waitlist-form';

const signInUrl =
  process.env.NEXT_PUBLIC_PRODUCT_SIGN_IN_URL ?? 'http://localhost:3001';
const streamVideoId = process.env.NEXT_PUBLIC_STREAM_VIDEO_ID;
const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

const productScenes = [
  {
    title: 'Teach it once.',
    body: 'Record the browser journey while Sentinel keeps the intent beside every step.',
    image: '/images/dashboard-proof.png',
    alt: 'Sanitized Sentinel workspace showing a browser-testing product overview.',
  },
  {
    title: 'Replay with boundaries.',
    body: 'Run guided or autonomously with reusable data, checkpoints, and a safe stop on uncertainty.',
    image: '/images/run-evidence-proof.png',
    alt: 'Sanitized Sentinel run showing ordered replay steps and evidence.',
  },
  {
    title: 'See what happened.',
    body: 'Review screenshots, network, console, and storage evidence on the same run timeline.',
    image: '/images/run-evidence-proof.png',
    alt: 'Sanitized Sentinel evidence view with screenshots and captured browser signals.',
  },
];

const safeguards = [
  ['Checkpoints', 'Pause where judgment matters.'],
  ['Safe failure', 'Stop instead of guessing.'],
  ['Redaction', 'Remove sensitive values before evidence persists.'],
  ['Immutable history', 'Keep the exact test version with every run.'],
  ['Human approval', 'Inform the release call. Never impersonate it.'],
];

const questions = [
  [
    'Who is the pilot for?',
    'Startup QA and engineering teams repeatedly verifying important browser journeys before release.',
  ],
  [
    'What can Sentinel test today?',
    'Sentinel focuses on browser-based web journeys: recording, guided or autonomous replay, and the evidence around each run.',
  ],
  [
    'Does Sentinel replace testers?',
    'No. It preserves tester knowledge and handles repeatable execution so people can focus on judgment and investigation.',
  ],
  [
    'What evidence is captured?',
    'Depending on the run boundary, Sentinel retains screenshots plus network, console, and browser-storage evidence. Sensitive values are redacted before persistence.',
  ],
  [
    'How are pilot teams selected?',
    'Applications are reviewed manually for fit. Selected teams receive personal follow-up; applying does not promise access or a launch date.',
  ],
];

export default function Home() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [videoRequested, setVideoRequested] = useState(false);
  const reduceMotion = useReducedMotion();

  function openWalkthrough() {
    setVideoRequested(true);
    dialogRef.current?.showModal();
  }

  function closeWalkthrough() {
    dialogRef.current?.close();
    setVideoRequested(false);
  }

  const heroMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.52, ease: [0.16, 1, 0.3, 1] as const },
      };

  const productMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, scale: 0.985 },
        animate: { opacity: 1, scale: 1 },
        transition: {
          duration: 0.62,
          delay: 0.08,
          ease: [0.16, 1, 0.3, 1] as const,
        },
      };

  return (
    <LazyMotion features={domAnimation}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#main" aria-label="Sentinel home">
            <span className="brand-mark" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>Sentinel</span>
          </a>

          <nav className="main-nav" aria-label="Primary navigation">
            <a href="#product">Product</a>
            <a href="#how-it-works">How it works</a>
            <a href="#safety">Safety</a>
          </nav>

          <div className="header-actions">
            <a className="sign-in" href={signInUrl}>
              Sign in
            </a>
            <a className="button button-primary header-pilot" href="#pilot">
              Join the pilot
            </a>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="hero" id="product">
          <m.div className="hero-copy" {...heroMotion}>
            <h1>Know before you ship.</h1>
            <p>
              Teach Sentinel a browser journey once. It replays it safely and
              returns the evidence for a human release decision.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#pilot">
                Join the pilot
              </a>
              <button className="button button-secondary" onClick={openWalkthrough}>
                <span className="play-icon" aria-hidden="true">
                  ▶
                </span>
                Watch the walkthrough
              </button>
            </div>
          </m.div>

          <m.figure className="hero-product" {...productMotion}>
            <Image
              src="/images/product-surface.png"
              alt="Sanitized Sentinel dashboard for a Billing Portal demo product."
              width={1440}
              height={900}
              priority
            />
          </m.figure>
        </section>

        <section className="quiet-statement" aria-labelledby="problem-title">
          <h2 id="problem-title">
            Release week shouldn’t mean replaying the same browser journeys by
            hand.
          </h2>
        </section>

        <section className="product-story" id="how-it-works" aria-label="How Sentinel works">
          {productScenes.map((scene, index) => (
            <article className="product-scene" key={scene.title}>
              <div className="scene-copy">
                <span className="scene-step">Step {index + 1}</span>
                <h2>{scene.title}</h2>
                <p>{scene.body}</p>
              </div>
              <figure className="scene-media">
                <Image
                  src={scene.image}
                  alt={scene.alt}
                  width={1440}
                  height={900}
                  loading="lazy"
                />
              </figure>
            </article>
          ))}
        </section>

        <section className="human-call">
          <div>
            <h2>The evidence arrives. The decision stays human.</h2>
          </div>
          <p>
            Readiness, approvals, and Jira, GitHub, or Telegram follow-up stay
            visible without turning an integration into a silent decision maker.
          </p>
        </section>

        <section className="safety-section" id="safety">
          <div className="safety-intro">
            <h2>Autonomy that knows when to stop.</h2>
            <p>
              Sentinel moves quickly inside the boundaries your team sets—and
              stops cleanly when it needs a person.
            </p>
          </div>
          <dl className="safeguard-list">
            {safeguards.map(([term, description]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{description}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="walkthrough-section" aria-labelledby="walkthrough-title">
          <div className="walkthrough-copy">
            <h2 id="walkthrough-title">See the complete loop.</h2>
            <p>From a taught journey to the evidence behind a release signal.</p>
            <button className="text-action" onClick={openWalkthrough}>
              Watch the walkthrough <span aria-hidden="true">→</span>
            </button>
          </div>
          <button
            className="walkthrough-poster"
            type="button"
            onClick={openWalkthrough}
            aria-label="Play the Sentinel product walkthrough"
          >
            <Image
              src="/images/dashboard-proof.png"
              alt=""
              width={1440}
              height={900}
              loading="lazy"
            />
            <span className="poster-play" aria-hidden="true">
              ▶
            </span>
          </button>
        </section>

        <section className="pilot-section" id="pilot" aria-labelledby="pilot-title">
          <div className="pilot-copy">
            <h2 id="pilot-title">Bring one real journey.</h2>
            <p>
              Tell us about your QA team. Selected pilot teams receive personal
              follow-up—no launch-date or access promise.
            </p>
          </div>
          <div className="pilot-form-wrap">
            <WaitlistForm />
          </div>
        </section>

        <section className="faq-section" aria-labelledby="faq-title">
          <h2 id="faq-title">A few useful answers.</h2>
          <div className="faq-list">
            {questions.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#main">
          Sentinel
        </a>
        <p>The release call stays human.</p>
        <nav aria-label="Footer navigation">
          <a href={signInUrl}>Sign in</a>
          <Link href="/privacy">Privacy</Link>
          {contactEmail ? <a href={`mailto:${contactEmail}`}>Contact</a> : null}
        </nav>
      </footer>

      <dialog
        className="video-dialog"
        ref={dialogRef}
        onClose={() => setVideoRequested(false)}
      >
        <div className="dialog-panel">
          <div className="dialog-header">
            <div>
              <h2>Sentinel walkthrough</h2>
              <p>Teach → Replay → Decide</p>
            </div>
            <button
              className="dialog-close"
              type="button"
              onClick={closeWalkthrough}
              aria-label="Close walkthrough"
            >
              Close
            </button>
          </div>
          <div className="video-frame">
            {videoRequested && streamVideoId ? (
              <iframe
                src={`https://customer-${streamVideoId}.cloudflarestream.com/${streamVideoId}/iframe`}
                title="Sentinel product walkthrough"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="video-fallback">
                <h3>The walkthrough is being prepared.</h3>
                <p>
                  Teach a browser journey, replay it inside explicit boundaries,
                  inspect the linked evidence, and keep the release decision with
                  a person.
                </p>
              </div>
            )}
          </div>
        </div>
      </dialog>
    </LazyMotion>
  );
}
