'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number from 0 to `target` over `duration` milliseconds.
 * Respects `prefers-reduced-motion` — returns the target immediately if the
 * user has opted out of animations.
 *
 * @example
 * const displayed = useCountUp(1250, 600);
 * return <span>{displayed.toLocaleString('vi-VN')}</span>;
 */
export function useCountUp(target: number, duration: number = 500): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    // Skip animation if user prefers reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || target === 0) {
      setValue(target);
      return;
    }

    // Cancel previous animation
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    startRef.current = null;
    setValue(0);

    const animate = (timestamp: number) => {
      if (startRef.current === null) {
        startRef.current = timestamp;
      }

      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic: starts fast, decelerates
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, duration]);

  return value;
}
