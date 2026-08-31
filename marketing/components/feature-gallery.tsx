'use client';

import { AnimatePresence, m } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

const features = [
  { number: '01', title: 'Recording', short: 'Teach a browser journey while its intent is still obvious.', detail: 'Sentinel records the browser actions beside a plain-English step log, so the durable asset is the journey—not a pile of selectors.', points: ['Live browser capture', 'Readable step intent', 'Versioned Test Case'] },
  { number: '02', title: 'Guided Runs', short: 'Keep a person close when the journey is new or sensitive.', detail: 'Guided execution keeps the replay structured while allowing a tester to observe the browser and respond at explicit checkpoints.', points: ['Visible step progress', 'Explicit checkpoints', 'Safe interruption'] },
  { number: '03', title: 'Autonomous Runs', short: 'Replay known journeys inside boundaries your team controls.', detail: 'Autonomous Runs use the same taught journey and reusable data, with a safe failure when the browser no longer matches the known path.', points: ['Bounded autonomy', 'Reusable variables', 'Stop on uncertainty'] },
  { number: '04', title: 'Evidence timeline', short: 'Put every signal beside the step that produced it.', detail: 'Screenshots, network activity, console messages, and browser-storage evidence stay aligned to the replay timeline for faster investigation.', points: ['Step-linked screenshots', 'Network and console', 'Storage evidence'] },
  { number: '05', title: 'Test Data', short: 'Reuse representative values without burying them in the journey.', detail: 'Named Test Data sets keep environment-specific inputs separate from Test Cases and make variable use visible during replay.', points: ['Named variables', 'Reusable or single use', 'Evidence redaction'] },
  { number: '06', title: 'Release readiness', short: 'Assemble the state of the release without inventing certainty.', detail: 'Current Runs, required checks, open review points, and owner decisions meet in one release view while approval stays human.', points: ['Current Run state', 'Owner checkpoints', 'Decision history'] },
  { number: '07', title: 'Workflows', short: 'Carry the outcome into the systems your team already watches.', detail: 'Jira, GitHub, and Telegram workflows can carry evidence and follow-up without becoming invisible release decision makers.', points: ['Jira follow-up', 'GitHub context', 'Telegram notification'] },
] as const;

type Feature = (typeof features)[number];

export function FeatureGallery() {
  const railRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<Feature | null>(null);
  const [edge, setEdge] = useState<'start' | 'middle' | 'end'>('start');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (selected && dialog && !dialog.open) dialog.showModal();
  }, [selected]);

  function updateEdge() {
    const rail = railRef.current;
    if (!rail) return;
    if (rail.scrollLeft < 8) setEdge('start');
    else if (rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 8) setEdge('end');
    else setEdge('middle');
  }

  function move(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.min(rail.clientWidth * 0.78, 760), behavior: 'smooth' });
  }

  function close() {
    dialogRef.current?.close();
    setSelected(null);
  }

  return (
    <section className="feature-gallery" aria-labelledby="features-title">
      <div className="feature-heading">
        <div><span className="section-kicker">Inside Sentinel</span><h2 id="features-title">More capability. Less page.</h2></div>
        <div className="rail-controls" aria-label="Feature gallery controls">
          <button type="button" onClick={() => move(-1)} disabled={edge === 'start'} aria-label="Previous features">←</button>
          <button type="button" onClick={() => move(1)} disabled={edge === 'end'} aria-label="Next features">→</button>
        </div>
      </div>
      <div className="feature-rail" ref={railRef} onScroll={updateEdge}>
        {features.map((feature, index) => (
          <m.button
            className={`feature-card feature-card-${(index % 3) + 1}`}
            type="button"
            key={feature.title}
            onClick={() => setSelected(feature)}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            aria-label={`Learn more about ${feature.title}`}
          >
            <span className="feature-number">{feature.number}</span>
            <span className="feature-glyph" aria-hidden="true"><i /><i /><i /></span>
            <span className="feature-card-copy"><strong>{feature.title}</strong><span>{feature.short}</span></span>
            <span className="feature-open" aria-hidden="true">+</span>
          </m.button>
        ))}
      </div>

      <dialog className="feature-dialog" ref={dialogRef} onClose={() => setSelected(null)}>
        <AnimatePresence mode="wait">
          {selected ? (
            <m.div key={selected.title} className="feature-dialog-panel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <button className="feature-dialog-close" type="button" onClick={close} aria-label="Close feature detail">×</button>
              <span className="feature-number">{selected.number}</span>
              <h3>{selected.title}</h3>
              <p>{selected.detail}</p>
              <ul>{selected.points.map((point) => <li key={point}><span aria-hidden="true">✓</span>{point}</li>)}</ul>
              <a className="button button-primary" href="#pilot" onClick={close}>Join the pilot</a>
            </m.div>
          ) : null}
        </AnimatePresence>
      </dialog>
    </section>
  );
}
