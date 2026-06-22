// ============================================================
// ZAPP Donuts ERP - Public Landing Page (redesigned)
// ============================================================
// Matches the approved "BE PART OF THE SWEETEST BUSINESS!" concept:
// cinematic dark hero over a donut-shop ambiance, ZAPP red/gold
// branding, three franchise-value badges, the product display case
// on the right, and a red "1000+ stores nationwide" CTA bar.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Donut,
  TrendingUp,
  Store,
  Menu,
  X,
  ArrowRight,
  ClipboardCheck,
  UserCheck,
  Truck,
  MapPin,
  Factory,
  Handshake,
  BarChart3,
  Zap,
  ChevronRight,
} from 'lucide-react';

// ── Section wrapper ────────────────────────────────────────────

function Section({
  id,
  className = '',
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`px-4 sm:px-6 lg:px-8 ${className}`}>
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

const NAV_LINKS = [
  { label: 'HOME', href: '#home' },
  { label: 'ABOUT US', href: '#about' },
  { label: 'WHY ZAPP DONUTS?', href: '#why' },
  { label: 'PARTNERSHIP', href: '#how-it-works' },
  { label: 'FAQ', href: '#faq' },
  { label: 'CONTACT', href: '#contact' },
];

// ── Landing Page ──────────────────────────────────────────────

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ─── Navbar ─────────────────────────────────────────── */}
      <nav
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-zapp-brown/95 shadow-lg shadow-black/20 backdrop-blur-md'
            : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <a href="#home" className="flex items-center gap-2">
            <img
              src="/zapp-logo.png"
              alt="ZAPP Donuts"
              className="h-20 w-auto drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] sm:h-24 lg:h-28"
            />
          </a>

          {/* Desktop links */}
          <div className="hidden items-center gap-7 xl:flex">
            {NAV_LINKS.map((link, i) => (
              <a
                key={link.href}
                href={link.href}
                className={`relative text-[13px] font-bold tracking-wide transition-colors hover:text-zapp-gold ${
                  i === 0 ? 'text-zapp-gold' : 'text-white'
                }`}
              >
                {link.label}
                {i === 0 && (
                  <span className="absolute -bottom-2 left-0 h-[3px] w-full rounded bg-zapp-gold" />
                )}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/apply')}
              className="hidden rounded-md bg-zapp-brand-red px-6 py-3 text-[13px] font-extrabold tracking-wide text-white shadow-lg shadow-black/30 transition-all hover:bg-zapp-brand-red-dark sm:inline-flex"
            >
              BECOME A STORE PARTNER
            </button>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-lg p-2 text-white xl:hidden"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="border-t border-white/10 bg-zapp-brown/98 px-4 py-4 xl:hidden">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10 hover:text-zapp-gold"
                >
                  {link.label}
                </a>
              ))}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/apply');
                }}
                className="mt-2 rounded-full bg-zapp-red px-5 py-3 text-sm font-bold text-white"
              >
                BECOME A STORE PARTNER
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* ─── Hero ───────────────────────────────────────────── */}
      <header
        id="home"
        className="relative min-h-screen overflow-hidden bg-zapp-brown"
      >
        {/* Real donut-shop background photo */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/zapp-bg.png')" }}
        />
        {/* Dark cinematic gradients (match reference: deep on the left for
            text legibility, warmer/lighter toward the product on the right) */}
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_40%,rgba(255,107,0,0.18),transparent_55%)]" />

        <Section className="relative flex min-h-screen items-center pt-28 pb-40 lg:pt-24">
          <div className="grid w-full gap-10 lg:grid-cols-2 lg:items-center">
            {/* Left: copy */}
            <div>
              <h1 className="font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.6)] sm:text-5xl lg:text-6xl">
                Be Part of
                <br />
                The Sweetest
                <br />
                <span className="text-zapp-gold drop-shadow-[0_2px_12px_rgba(255,215,0,0.35)]">
                  Business!
                </span>
              </h1>

              {/* Red accent underline (matches the reference) */}
              <div className="mt-5 h-1.5 w-24 rounded-full bg-zapp-brand-red" />

              <p className="mt-6 max-w-md text-lg leading-relaxed text-white/90">
                Join ZAPP Donuts and own a proven, high-demand business that
                brings happiness in every bite.
              </p>

              {/* Feature badges (icon stacked above label, like the reference) */}
              <div className="mt-10 grid max-w-lg grid-cols-3 gap-5">
                {[
                  {
                    icon: <Donut size={24} />,
                    title: 'HIGH DEMAND',
                    desc: 'Loved by all ages. Perfect anytime, anywhere.',
                  },
                  {
                    icon: <TrendingUp size={24} />,
                    title: 'PROVEN BUSINESS',
                    desc: 'Low risk, high return with fast ROI.',
                  },
                  {
                    icon: <Store size={24} />,
                    title: 'EASY TO START',
                    desc: 'We guide you every step of the way.',
                  },
                ].map((f) => (
                  <div key={f.title}>
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-zapp-brand-red text-white shadow-lg shadow-black/40">
                      {f.icon}
                    </div>
                    <h3 className="text-sm font-extrabold tracking-wide text-white">
                      {f.title}
                    </h3>
                    <p className="mt-1 text-xs leading-snug text-white/75">
                      {f.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: product display case */}
            <div className="hidden justify-center lg:flex lg:justify-end">
              <div className="relative">
                <div className="absolute inset-0 scale-125 rounded-full bg-zapp-brand-red/25 blur-3xl" />
                <div className="absolute -inset-6 rounded-full bg-zapp-gold/10 blur-2xl" />
                <img
                  src="/donut-stall.png"
                  alt="ZAPP Donuts display case"
                  className="relative max-h-[78vh] w-auto object-contain drop-shadow-[0_25px_70px_rgba(0,0,0,0.75)]"
                />
              </div>
            </div>
          </div>
        </Section>

        {/* ─── Red stats bar (bottom of hero) ───────────────── */}
        <div className="absolute inset-x-0 bottom-0 z-10 bg-zapp-brand-red">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <Store size={44} className="text-white" strokeWidth={1.5} />
              <div>
                <div className="text-4xl font-black leading-none text-white">
                  1000+
                </div>
                <div className="mt-1 text-sm font-bold uppercase tracking-widest text-white/90">
                  Stores Nationwide
                </div>
              </div>
            </div>
            <div className="hidden h-12 w-px bg-white/30 sm:block" />
            <button
              onClick={() => navigate('/apply')}
              className="inline-flex items-center gap-2 rounded-md bg-zapp-gold px-10 py-4 text-base font-black uppercase tracking-wide text-zapp-brown shadow-lg transition-transform hover:scale-[1.02]"
            >
              Become a Store Partner
            </button>
          </div>
        </div>
      </header>

      {/* ─── About Section ──────────────────────────────────── */}
      <Section id="about" className="py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="text-sm font-black uppercase tracking-wider text-zapp-red">
              About Us
            </span>
            <h2 className="mt-3 font-display text-3xl font-extrabold text-zapp-brown sm:text-4xl">
              The Donut Brand Filipinos Love
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              ZAPP Donuts is a Philippine-based donut franchise built on a
              multi-plant distribution model. With production facilities in{' '}
              <strong className="text-zapp-brown">Daraga (Bicol)</strong>,{' '}
              <strong className="text-zapp-brown">Manila (NCR)</strong>, and{' '}
              <strong className="text-zapp-brown">Cebu (Visayas)</strong>, we
              ensure fresh daily deliveries to franchise stores across the
              nation.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              We partner with franchisees for a seamless, scalable business —
              backed by reliable logistics, consistent quality, and a modern
              operations platform that handles inventory, billing, forecasting,
              and analytics so you can focus on growing your store.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              {
                icon: <Zap size={24} className="text-zapp-red" />,
                title: 'Smart Operations',
                desc: 'Image-assisted inventory, automated billing, demand forecasting.',
              },
              {
                icon: <Truck size={24} className="text-zapp-red" />,
                title: 'Daily Fresh Deliveries',
                desc: 'Baked and delivered daily from your nearest plant.',
              },
              {
                icon: <Handshake size={24} className="text-zapp-red" />,
                title: 'Two Franchise Models',
                desc: 'Distributor-linked or direct franchise partnerships.',
              },
              {
                icon: <BarChart3 size={24} className="text-zapp-red" />,
                title: 'Modern ERP Platform',
                desc: 'Full dashboard for sales, billing, and reporting.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-gray-100 bg-zapp-cream/50 p-6 transition-all hover:-translate-y-1 hover:border-zapp-red/20 hover:shadow-lg"
              >
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-zapp-red/10">
                  {item.icon}
                </div>
                <h3 className="text-sm font-bold text-zapp-brown">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── Why ZAPP (value band) ──────────────────────────── */}
      <div id="why" className="bg-zapp-brown">
        <Section className="py-16 lg:py-20">
          <div className="grid gap-8 text-center sm:grid-cols-3">
            {[
              { value: '3', label: 'Production Plants' },
              { value: '1000+', label: 'Stores Nationwide' },
              { value: '9', label: 'Signature Products' },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-5xl font-black text-zapp-gold">
                  {s.value}
                </div>
                <div className="mt-2 text-sm font-bold uppercase tracking-widest text-white/70">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ─── How It Works / Partnership ─────────────────────── */}
      <Section id="how-it-works" className="py-20 lg:py-28">
        <div className="text-center">
          <span className="text-sm font-black uppercase tracking-wider text-zapp-red">
            Partnership
          </span>
          <h2 className="mt-3 text-3xl font-extrabold text-zapp-brown sm:text-4xl">
            Four Simple Steps to Ownership
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            From interested applicant to operational franchise owner — our
            streamlined process gets you there fast.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              step: 1,
              icon: <ClipboardCheck size={26} />,
              title: 'Apply with Referral Code',
              desc: 'Get a code from a distributor or ZAPP rep, then fill out the online application.',
            },
            {
              step: 2,
              icon: <UserCheck size={26} />,
              title: 'Get Reviewed & Approved',
              desc: 'Our team verifies your documents and approves your franchise within days.',
            },
            {
              step: 3,
              icon: <Truck size={26} />,
              title: 'Receive Daily Deliveries',
              desc: 'Fresh donuts delivered daily from the nearest plant, verified on arrival.',
            },
            {
              step: 4,
              icon: <TrendingUp size={26} />,
              title: 'Track Sales & Grow',
              desc: 'Use the ZAPP ERP to track sales, manage billing, and grow with insights.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="relative rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="absolute -top-4 left-6 flex h-9 w-9 items-center justify-center rounded-full bg-zapp-red text-sm font-black text-white shadow-md shadow-red-200">
                {item.step}
              </div>
              <div className="mt-2 mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-zapp-red/10 text-zapp-red">
                {item.icon}
              </div>
              <h3 className="text-base font-bold text-zapp-brown">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Our Plants ─────────────────────────────────────── */}
      <Section id="faq" className="bg-zapp-cream/40 py-20 lg:py-28">
        <div className="text-center">
          <span className="text-sm font-black uppercase tracking-wider text-zapp-red">
            Our Plants
          </span>
          <h2 className="mt-3 text-3xl font-extrabold text-zapp-brown sm:text-4xl">
            Strategically Located Production
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Three plants across the Philippines ensure fresh daily deliveries to
            every franchise store in their region.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          {[
            {
              name: 'Daraga Plant',
              code: 'DRG',
              location: 'Daraga, Albay',
              region: 'Bicol Region',
              coverage: 'Albay, Camarines Sur, Sorsogon, and nearby provinces',
              color: 'from-orange-500 to-red-500',
            },
            {
              name: 'Manila Plant',
              code: 'MNL',
              location: 'Tondo, Manila',
              region: 'National Capital Region',
              coverage: 'Manila, Makati, Quezon City, Pasig, and Metro Manila',
              color: 'from-amber-500 to-orange-600',
            },
            {
              name: 'Cebu Plant',
              code: 'CEB',
              location: 'Mandaue, Cebu',
              region: 'Visayas Region',
              coverage: 'Cebu, Mandaue, Lapu-Lapu, and surrounding Visayan areas',
              color: 'from-red-500 to-rose-600',
            },
          ].map((plant) => (
            <div
              key={plant.code}
              className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <div
                className={`bg-gradient-to-r ${plant.color} px-6 py-8 text-white`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-white/70">
                      Plant Code: {plant.code}
                    </div>
                    <h3 className="mt-1 text-xl font-extrabold">{plant.name}</h3>
                  </div>
                  <Factory size={32} className="text-white/30" />
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin size={14} className="text-gray-400" />
                  {plant.location}
                </div>
                <div className="mt-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Region
                  </span>
                  <p className="mt-0.5 text-sm font-semibold text-zapp-brown">
                    {plant.region}
                  </p>
                </div>
                <div className="mt-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Coverage
                  </span>
                  <p className="mt-0.5 text-sm text-gray-600">
                    {plant.coverage}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── CTA Section ────────────────────────────────────── */}
      <div
        id="contact"
        className="relative overflow-hidden bg-zapp-red"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border-[24px] border-white/10" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-72 w-72 rounded-full border-[20px] border-zapp-gold/20" />
        <Section className="relative py-20 lg:py-24">
          <div className="text-center">
            <h2 className="font-display text-3xl font-black text-white sm:text-4xl lg:text-5xl">
              Ready to Join ZAPP Donuts?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/85">
              Start your franchise journey today — apply now and become part of
              the sweetest business in the Philippines.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => navigate('/apply')}
                className="group inline-flex items-center gap-2 rounded-full bg-zapp-gold px-8 py-4 text-sm font-black uppercase tracking-wide text-zapp-brown shadow-xl transition-transform hover:scale-[1.03]"
              >
                Become a Store Partner
                <ArrowRight
                  size={18}
                  className="transition-transform group-hover:translate-x-1"
                />
              </button>
              <button
                onClick={() => navigate('/stores')}
                className="inline-flex items-center gap-2 rounded-full border border-white/40 px-8 py-4 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                Browse Store Directory
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </Section>
      </div>

      {/* ─── Footer ─────────────────────────────────────────── */}
      <footer className="bg-zapp-brown">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <img
              src="/zapp-logo.png"
              alt="ZAPP Donuts"
              className="h-12 w-auto"
            />
            <div className="flex items-center gap-6">
              <button
                onClick={() => navigate('/stores')}
                className="text-sm font-medium text-white/70 transition-colors hover:text-zapp-gold"
              >
                Store Directory
              </button>
              <button
                onClick={() => navigate('/apply')}
                className="text-sm font-medium text-white/70 transition-colors hover:text-zapp-gold"
              >
                Apply
              </button>
              <button
                onClick={() => navigate('/login')}
                className="text-sm font-medium text-white/70 transition-colors hover:text-zapp-gold"
              >
                Franchisee Login
              </button>
            </div>
            <p className="text-xs text-white/50">
              &copy; {new Date().getFullYear()} ZAPP Donuts. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
