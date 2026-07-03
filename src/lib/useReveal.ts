// ============================================================
// useReveal — lightweight scroll-reveal via IntersectionObserver
// ============================================================
// Adds a CSS class once the element scrolls into view, so sections
// can fade/slide in. No external animation library. Respects
// prefers-reduced-motion (reveals immediately, no transition).

import { useEffect, useRef, useState } from 'react';

export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit,
) {
  const ref = useRef<T>(null);
  // Reduced motion → start already-shown so there's no fade-in and the
  // effect never needs to setState synchronously (avoids a cascading
  // render / the react-hooks set-state-in-effect lint).
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [shown, setShown] = useState(prefersReducedMotion);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced motion → already shown from the initial state; skip the observer.
    if (prefersReducedMotion) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px', ...options },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [options, prefersReducedMotion]);

  return { ref, shown };
}
