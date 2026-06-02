// src/components/home/Hero.tsx
import Image from 'next/image'
import type { Lang } from '@/i18n/shared'
import { t } from '@/i18n/messages'
import HeroCountdown from './HeroCountdown'

export default function Hero({ lang }: { lang: Lang }) {
  const titleLines = t(lang, 'hero.titleLines') as string[]
  const stats = t(lang, 'hero.stats') as Array<{ v: string; l: string }>
  const isAr = lang === 'ar'

  return (
    <section className="hero-future relative w-full min-h-screen flex flex-col overflow-hidden">

      {/* ── Photo de fond ── */}
      <div className="absolute inset-0 hog-parallax-bg">
        <div
          className="absolute inset-0 hero-bg-zoom"
          style={{
            backgroundImage: "url('/images/hero-bg.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center 35%',
            backgroundColor: '#1a1208',
          }}
        />
      </div>

      {/* ── Overlays ── */}
      <div className="absolute inset-0 pointer-events-none hero-future-overlay"/>
      <div className="absolute inset-0 pointer-events-none hero-cinematic-vignette"/>
      <div className="absolute inset-0 pointer-events-none hero-future-grid"/>
      <div className="absolute inset-0 pointer-events-none hero-future-scan"/>
      <div className="absolute inset-0 pointer-events-none hero-spotlight"/>
      <div className="absolute inset-0 pointer-events-none hero-future-corners"/>

      {/* ── Watermark ALGERIA ── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
        <span className="font-display hero-watermark select-none" aria-hidden="true">ALGERIA</span>
      </div>

      {/* ── Road lines SVG ── */}
      <svg className="absolute bottom-14 left-0 right-0 w-full pointer-events-none hog-parallax-lines"
        style={{ height: '45%', zIndex: 3 }}
        viewBox="0 0 1440 400" fill="none" preserveAspectRatio="none">
        <path d="M720 400 L0 50"    stroke="#FF6B00" strokeWidth="1"   strokeDasharray="12 20" opacity=".18"/>
        <path d="M720 400 L1440 50" stroke="#FF6B00" strokeWidth="1"   strokeDasharray="12 20" opacity=".18"/>
        <path d="M720 400 L720 0"   stroke="#FF6B00" strokeWidth="1.5" strokeDasharray="20 28" opacity=".22"/>
        <path d="M720 400 L200 80"  stroke="#FF6B00" strokeWidth="0.5" strokeDasharray="8 32"  opacity=".10"/>
        <path d="M720 400 L1240 80" stroke="#FF6B00" strokeWidth="0.5" strokeDasharray="8 32"  opacity=".10"/>
      </svg>

      {/* ── Badge HOG top-right ── */}
      <div
        className={`absolute top-[76px] ${isAr ? 'left-5 sm:left-8 md:left-10' : 'right-5 sm:right-8 md:right-10'} md:top-[92px] hero-tour-logo`}
        style={{ zIndex: 10 }}
      >
        <div className="hero-logo-wrap">
          <Image
            src="/images/logo-hogtour.png"
            alt="H.O.G. Tour 2026"
            width={168}
            height={168}
            className="object-contain hero-logo-img"
            priority
          />
        </div>
      </div>

      {/* ── Contenu centré ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center relative text-center px-6 md:px-12"
        style={{ zIndex: 5, paddingTop: '88px', paddingBottom: '20px' }}
      >
        {/* Eyebrow */}
        <div className="au1 hero-eyebrow inline-flex items-center gap-3 mb-7">
          <span className="block w-8 h-px bg-orange/60 flex-shrink-0"/>
          <span
            className={`text-orange/80 text-[10.5px] ${isAr ? '' : 'uppercase'}`}
            style={{ letterSpacing: isAr ? '0px' : '0.38em' }}
          >
            {t(lang, 'hero.eyebrow')}
          </span>
          <span className="block w-8 h-px bg-orange/60 flex-shrink-0"/>
        </div>

        {/* H1 */}
        <h1
          className="au2 font-display m-0"
          style={{
            fontSize: isAr ? 'clamp(34px, 6vw, 76px)' : 'clamp(40px, 8.5vw, 132px)',
            lineHeight: isAr ? '1.30' : '0.94',
            letterSpacing: isAr ? '0px' : '1.5px',
          }}
        >
          <span className="block text-white">{titleLines?.[0] || 'H.O.G. TOUR 2026 ®'}</span>
          <span className="block text-white">{titleLines?.[1] || ''}</span>
          <span className="block text-orange hero-title-orange">{titleLines?.[2] || ''}</span>
        </h1>

        {/* Route badge */}
        <div className={`au-route hero-route-badge font-condensed ${isAr ? '' : 'uppercase'} mt-7`}>
          <span className="hero-route-dot"/>
          {t(lang, 'home.ticketSubtitle')}
          <span className="hero-route-dot"/>
        </div>

        {/* Countdown XXL */}
        <HeroCountdown lang={lang} />

        {/* CTAs */}
        <div className="au4 flex gap-4 flex-wrap justify-center">
          <a
            href="/inscription"
            className={`font-condensed font-extrabold ${isAr ? '' : 'uppercase'} transition-all duration-200 hover:-translate-y-1`}
            style={{
              background: '#FF6B00', color: '#000',
              fontSize: '13px', letterSpacing: isAr ? '0px' : '3px',
              padding: '17px 44px',
              border: '2px solid #FF6B00',
              boxShadow: '0 0 36px rgba(255,107,0,.50), 0 0 72px rgba(255,107,0,.18)',
              display: 'inline-flex', alignItems: 'center', gap: '10px',
            }}
          >
            {t(lang, 'hero.ctaRegister')}
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
          <a
            href="/hogtour"
            className={`font-condensed font-bold ${isAr ? '' : 'uppercase'} transition-all duration-200 hover:-translate-y-1`}
            style={{
              background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.22)',
              color: 'rgba(255,255,255,.88)', fontSize: '13px', letterSpacing: isAr ? '0px' : '3px',
              padding: '17px 38px', backdropFilter: 'blur(8px)',
              display: 'inline-flex', alignItems: 'center',
            }}
          >
            {t(lang, 'hero.ctaDiscover')}
          </a>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="au5 hero-stats-strip relative grid grid-cols-2 md:grid-cols-4" style={{ zIndex: 5 }}>
        {(Array.isArray(stats) ? stats : []).map((st, i) => (
          <div
            key={i}
            className="hero-stat text-center transition-colors duration-200"
            style={{ borderRight: i < 3 ? '1px solid rgba(255,107,0,.10)' : 'none' }}
          >
            <span className="hero-stat-v font-display text-orange block leading-none">{st.v}</span>
            <p className="hero-stat-l text-muted mt-2">{st.l}</p>
          </div>
        ))}
      </div>

    </section>
  )
}
