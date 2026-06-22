// ============================================================
// ZAPP Donuts - Branded full-screen loading splash
// ============================================================
// Gmail-style boot splash: centered ZAPP logo above a slim
// indeterminate progress bar. Brand colors + the same logo used
// on the landing page so the boot experience feels on-brand.

export default function LoadingScreen({
  message = 'Loading ZAPP Donuts…',
}: {
  message?: string;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-zapp-cream">
      {/* Soft brand glow behind the logo */}
      <div className="relative flex flex-col items-center">
        <div className="pointer-events-none absolute -inset-10 rounded-full bg-zapp-orange/10 blur-3xl" />

        {/* Logo (gentle pulse) */}
        <img
          src="/zapp-logo.png"
          alt="ZAPP Donuts"
          className="relative h-28 w-auto animate-pulse-soft drop-shadow-[0_4px_12px_rgba(0,0,0,0.15)] sm:h-32"
        />

        {/* Gmail-style progress bar */}
        <div className="relative mt-8 h-1.5 w-56 overflow-hidden rounded-full bg-zapp-brown/10">
          <div className="zapp-loading-bar h-full w-2/5 rounded-full bg-gradient-to-r from-zapp-orange via-zapp-red to-zapp-gold" />
        </div>

        <p className="relative mt-5 text-sm font-medium tracking-wide text-zapp-brown/70">
          {message}
        </p>
      </div>
    </div>
  );
}
