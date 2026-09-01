'use client';

import { m, useInView, useReducedMotion } from 'motion/react';
import { useRef, useSyncExternalStore } from 'react';

type ScrollRevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'left' | 'right';
};

export function ScrollReveal({
  children,
  className = '',
  delay = 0,
  direction = 'up',
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const inView = useInView(ref, {
    once: true,
    amount: 0.08,
    margin: '0px 0px -20% 0px',
  });
  const reducedMotion = useReducedMotion();
  const concealed = hydrated && !inView;
  const travel = reducedMotion ? 0 : 18;
  const hiddenTransform =
    direction === 'left'
      ? { x: -travel, y: 0 }
      : direction === 'right'
        ? { x: travel, y: 0 }
        : { x: 0, y: travel };

  return (
    <m.div
      ref={ref}
      className={`scroll-reveal ${className}`.trim()}
      initial={false}
      animate={
        concealed
          ? {
              opacity: 0,
              ...hiddenTransform,
              filter: reducedMotion ? 'blur(0px)' : 'blur(4px)',
            }
          : { opacity: 1, x: 0, y: 0, filter: 'blur(0px)' }
      }
      transition={{
        duration: reducedMotion ? 0.12 : 0.68,
        delay: concealed ? 0 : delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </m.div>
  );
}
