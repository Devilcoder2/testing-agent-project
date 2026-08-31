'use client';

import { SyntheticEvent, useEffect, useRef, useState } from 'react';

const apiBase =
  process.env.NEXT_PUBLIC_PRODUCT_API_URL ?? 'http://localhost:3001';
const siteKey =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA';

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: 'light';
      callback: (token: string) => void;
      'error-callback': () => void;
      'expired-callback': () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileLoader: Promise<TurnstileApi> | undefined;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileLoader) return turnstileLoader;

  turnstileLoader = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-sentinel-turnstile]',
    );
    const script = existing ?? document.createElement('script');
    script.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.sentinelTurnstile = 'true';
    script.addEventListener('load', () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Verification did not initialize.'));
    });
    script.addEventListener('error', () =>
      reject(new Error('Verification could not load.')),
    );
    if (!existing) document.head.appendChild(script);
  });

  return turnstileLoader;
}

function Verification({ onToken }: { onToken: (token: string) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | undefined>(undefined);
  const [message, setMessage] = useState(
    'Verification loads when this form is in view.',
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setMessage('Loading secure verification…');
        void loadTurnstile()
          .then((turnstile) => {
            if (cancelled || !hostRef.current) return;
            widgetRef.current = turnstile.render(hostRef.current, {
              sitekey: siteKey,
              action: 'pilot_waitlist',
              theme: 'light',
              callback: (token) => {
                onToken(token);
                setMessage('Verification complete.');
              },
              'expired-callback': () => {
                onToken('');
                setMessage('Verification expired. Complete it again.');
              },
              'error-callback': () => {
                onToken('');
                setMessage(
                  'Verification is unavailable. Please try again shortly.',
                );
              },
            });
          })
          .catch(() =>
            setMessage(
              'Verification is unavailable. Please try again shortly.',
            ),
          );
      },
      { rootMargin: '180px' },
    );

    observer.observe(host);
    return () => {
      cancelled = true;
      observer.disconnect();
      if (widgetRef.current && window.turnstile) {
        window.turnstile.remove(widgetRef.current);
      }
    };
  }, [onToken]);

  return (
    <div className="verification-wrap">
      <div ref={hostRef} className="turnstile-host" />
      <p className="form-hint" aria-live="polite">
        {message}
      </p>
    </div>
  );
}

export function WaitlistForm() {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'submitting' }
    | { kind: 'success' }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    if (!token) {
      setStatus({
        kind: 'error',
        message: 'Complete the secure verification before applying.',
      });
      return;
    }

    const fields = new FormData(form);
    const text = (name: string) => {
      const value = fields.get(name);
      return typeof value === 'string' ? value : '';
    };
    setStatus({ kind: 'submitting' });

    try {
      const response = await fetch(`${apiBase}/api/public/pilot-waitlist`, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: text('name').trim(),
          email: text('email').trim(),
          company: text('company').trim(),
          qaTeamSize: text('qaTeamSize'),
          companyWebsite: text('companyWebsite'),
          turnstileToken: token,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        accepted?: boolean;
        error?: string;
      } | null;

      if (response.status !== 202 || result?.accepted !== true) {
        throw new Error(
          result?.error ??
            'Your application could not be sent. Please try again.',
        );
      }

      form.reset();
      setStatus({ kind: 'success' });
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Your application could not be sent. Please try again.',
      });
      setToken('');
    }
  }

  if (status.kind === 'success') {
    return (
      <output className="form-success" tabIndex={-1}>
        <span aria-hidden="true">✓</span>
        <p className="eyebrow">Application received</p>
        <h3>Thank you for raising your hand.</h3>
        <p>
          We review every application personally. If your team is a fit for this
          pilot, we’ll reach out to the work email you provided.
        </p>
      </output>
    );
  }

  return (
    <form className="waitlist-form" onSubmit={submit} noValidate>
      <div className="form-grid">
        <label>
          <span>Name</span>
          <input
            name="name"
            autoComplete="name"
            minLength={2}
            maxLength={80}
            required
          />
        </label>
        <label>
          <span>Work email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
          />
        </label>
        <label>
          <span>Company</span>
          <input
            name="company"
            autoComplete="organization"
            minLength={2}
            maxLength={120}
            required
          />
        </label>
        <label>
          <span>QA team size</span>
          <select name="qaTeamSize" defaultValue="" required>
            <option value="" disabled>
              Select team size
            </option>
            <option value="1">1</option>
            <option value="2-5">2–5</option>
            <option value="6-15">6–15</option>
            <option value="16+">16+</option>
          </select>
        </label>
      </div>

      <label className="bot-field" aria-hidden="true">
        Company website
        <input name="companyWebsite" autoComplete="off" tabIndex={-1} />
      </label>

      <Verification onToken={setToken} />

      {status.kind === 'error' ? (
        <p className="form-error" role="alert">
          {status.message}
        </p>
      ) : null}

      <div className="form-submit-row">
        <button
          className="button button-primary"
          type="submit"
          disabled={status.kind === 'submitting'}
        >
          {status.kind === 'submitting'
            ? 'Sending application…'
            : 'Apply for the pilot'}
        </button>
        <p>
          No newsletter. No automated sales sequence. Personal follow-up only
          for selected teams.
        </p>
      </div>
    </form>
  );
}
