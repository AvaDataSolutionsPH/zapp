// ============================================================
// ZAPP Donuts - Branded full-screen loading splash
// ============================================================
// Dark hero-style boot splash: large ZAPP logo above a Gmail-style
// progress bar, on a warm dark gradient with floating donut accents
// and a rotating loading tagline. Brand colors + the landing logo so
// the boot experience feels on-brand.

import { useState, useEffect } from 'react';
import { Donut } from 'lucide-react';

const TAGLINES = [
  'Baking your dashboard…',
  'Glazing the data…',
  'Counting the donuts…',
  'Warming up the oven…',
  'Sprinkling the details…',
];

export default function LoadingScreen() {
  const [tagline, setTagline] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setTagline((t) => (t + 1) % TAGLINES.length),
      1600,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-zapp-brown">
      {/* Dark cinematic background (matches the landing hero) */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#3a211f] via-zapp-brown to-[#1d100f]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,107,0,0.20),transparent_60%)]" />

      {/* Floating donut accents */}
      <Donut
        size={140}
        className="zapp-float-slow absolute left-[12%] top-[18%] text-zapp-gold/10"
        strokeWidth={1}
      />
      <Donut
        size={90}
        className="zapp-float-med absolute right-[15%] top-[24%] text-zapp-orange/15"
        strokeWidth={1}
      />
      <Donut
        size={120}
        className="zapp-float-med absolute bottom-[16%] left-[20%] text-zapp-red/10"
        strokeWidth={1}
      />
      <Donut
        size={70}
        className="zapp-float-slow absolute bottom-[22%] right-[22%] text-zapp-gold/10"
        strokeWidth={1}
      />

      {/* Center stack */}
      <div className="relative flex flex-col items-center">
        <div className="pointer-events-none absolute -inset-16 rounded-full bg-zapp-orange/15 blur-3xl" />

        {/* Logo (gentle pulse) */}
        <img
          src="/zapp-logo.png"
          alt="ZAPP Donuts"
          className="relative h-56 w-auto animate-pulse-soft drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)] sm:h-64"
        />

        {/* Gmail-style progress bar */}
        <div className="relative mt-6 h-1.5 w-64 overflow-hidden rounded-full bg-white/15">
          <div className="zapp-loading-bar h-full w-2/5 rounded-full bg-gradient-to-r from-zapp-orange via-zapp-red to-zapp-gold" />
        </div>

        {/* Rotating tagline */}
        <p
          key={tagline}
          className="zapp-tagline relative mt-5 text-sm font-medium tracking-wide text-white/80"
        >
          {TAGLINES[tagline]}
        </p>
      </div>
    </div>
  );
}
