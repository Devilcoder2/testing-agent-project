'use client';

import { m } from 'motion/react';

type SentinelLogoProps = {
  compact?: boolean;
  animated?: boolean;
};

export function SentinelLogo({ compact = false, animated = false }: SentinelLogoProps) {
  const Path = animated ? m.path : 'path';

  return (
    <span className="sentinel-logo" aria-label={compact ? 'Sentinel' : undefined}>
      <svg
        className="sentinel-logo-mark"
        viewBox="0 0 40 40"
        role={compact ? 'img' : undefined}
        aria-hidden={compact ? undefined : true}
      >
        <rect x="2.5" y="2.5" width="35" height="35" rx="10" fill="currentColor" />
        <Path
          d="M10.5 27.5 17 21l5 3 7.5-10"
          fill="none"
          stroke="var(--color-logo-trace)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...(animated
            ? {
                initial: { pathLength: 0, opacity: 0.35 },
                animate: { pathLength: 1, opacity: 1 },
                transition: { duration: 0.75, delay: 0.18, ease: 'easeOut' },
              }
            : {})}
        />
        <circle cx="10.5" cy="27.5" r="2.15" fill="var(--color-logo-trace)" />
        <circle cx="17" cy="21" r="2.15" fill="var(--color-logo-trace)" />
        <circle cx="22" cy="24" r="2.15" fill="var(--color-logo-trace)" />
        <circle cx="29.5" cy="14" r="2.6" fill="var(--color-cobalt)" />
      </svg>
      {compact ? null : <span className="sentinel-logo-word">Sentinel</span>}
    </span>
  );
}
