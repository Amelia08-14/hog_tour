// src/components/home/Hero.tsx
// Photo : public/images/hero-bg.png
import Image from 'next/image'
import type { Lang } from '@/i18n/shared'
import { t } from '@/i18n/messages'

export default function Hero({ lang }: { lang: Lang }) {
  const titleLines = t(lang, 'hero.titleLines') as string[]
  const stats = t(lang, 'hero.stats') as Array<{ v: string; l: string }>
  return (
    <section className="hero-future relative w-full min-h-screen flex flex-col justify-end overflow-hidden">

      {/* ── Photo de fond ── */}
      <div
        className="absolute inset-0 hog-parallax-bg"
      >
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

      <div className="absolute inset-0 pointer-events-none hero-future-overlay"/>
      <div className="absolute inset-0 pointer-events-none hero-future-grid"/>
      <div className="absolute inset-0 pointer-events-none hero-future-scan"/>
      <div className="absolute inset-0 pointer-events-none hero-future-corners"/>

      {/* ── Road lines SVG ── */}
      <svg className="absolute bottom-14 left-0 right-0 w-full pointer-events-none hog-parallax-lines"
        style={{ height: '45%', zIndex: 3 }}
        viewBox="0 0 1440 400" fill="none" preserveAspectRatio="none">
        <path d="M720 400 L0 50"    stroke="#FF6B00" strokeWidth="1"   strokeDasharray="12 20" opacity=".2"/>
        <path d="M720 400 L1440 50" stroke="#FF6B00" strokeWidth="1"   strokeDasharray="12 20" opacity=".2"/>
        <path d="M720 400 L720 0"   stroke="#FF6B00" strokeWidth="1.5" strokeDasharray="20 28" opacity=".25"/>
      </svg>

      {/* ── Badge HOG top-right ── */}
      <div className="absolute top-[76px] right-5 sm:right-8 md:top-[92px] md:right-10 hero-tour-logo" style={{ zIndex: 10 }}>
        <div className="hero-logo-wrap">
          <Image
            src="/images/logo-hogtour.png"
            alt="H.O.G Tour 2026"
            width={168}
            height={168}
            className="object-contain hero-logo-img"
            priority
          />
        </div>
      </div>

      {/* ── Contenu principal ── */}
      <div className="relative px-6 md:px-12 pb-6 max-w-4xl" style={{ zIndex: 5 }}>

        {/* Eyebrow */}
        <div className="au1 hero-eyebrow inline-flex items-center gap-2.5 mb-5">
          <span className="block w-5 h-px bg-orange flex-shrink-0"/>
          <span className={`text-orange text-[11px] ${lang === 'ar' ? '' : 'uppercase'}`} style={{ letterSpacing: lang === 'ar' ? '0px' : '0.4em', fontFamily: 'Barlow, sans-serif' }}>
            {t(lang, 'hero.eyebrow')}
          </span>
        </div>

        {/* H1 */}
        <h1 className="au2 font-display m-0 hero-title" style={{ fontSize: 'clamp(52px, 8.7vw, 118px)', lineHeight: '0.98', letterSpacing: lang === 'ar' ? '0px' : '1.5px' }}>
          <span className="block text-white hero-title-white">{titleLines?.[0] || 'H.O.G TOUR 2026 ®'}</span>
          <span className="block text-white hero-title-white">{titleLines?.[1] || ''}</span>
          <span className="block text-orange hero-title-orange">{titleLines?.[2] || ''}</span>
        </h1>

        {/* Sous-titre */}
        <p className="au3 font-condensed font-normal leading-relaxed mt-5 mb-10 max-w-[560px]"
          style={{ fontSize: 'clamp(14px, 1.75vw, 18px)', letterSpacing: lang === 'ar' ? '0px' : '3px', textTransform: lang === 'ar' ? 'none' : 'uppercase', color: 'rgba(255,255,255,.70)' }}>
          <strong className="font-bold" style={{ color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,.8)' }}>{t(lang, 'hero.subtitleStrong')}</strong>
          {' '}{t(lang, 'hero.subtitleRest')}
        </p>

        {/* CTAs */}
        <div className="au4 flex gap-3 flex-wrap">
          <a href="/inscription" className={`font-condensed font-extrabold ${lang === 'ar' ? '' : 'uppercase'} transition-all duration-200 hover:-translate-y-0.5`}
            style={{ background: '#FF6B00', color: '#000', fontSize: '13px', letterSpacing: lang === 'ar' ? '0px' : '3px', padding: '16px 40px', border: '2px solid #FF6B00', boxShadow: '0 0 24px rgba(255,107,0,.35)', display: 'inline-flex', alignItems: 'center' }}>
            {t(lang, 'hero.ctaRegister')}
          </a>
          <a href="/hogtour" className={`font-condensed font-bold ${lang === 'ar' ? '' : 'uppercase'} transition-all duration-200 hover:-translate-y-0.5`}
            style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.30)', color: 'rgba(255,255,255,.9)', fontSize: '13px', letterSpacing: lang === 'ar' ? '0px' : '3px', padding: '16px 36px', backdropFilter: 'blur(4px)', display: 'inline-flex', alignItems: 'center' }}>
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
            <span className="hero-stat-v font-display text-orange block leading-none">
              {st.v}
            </span>
            <p className="hero-stat-l text-muted mt-2">{st.l}</p>
          </div>
        ))}
      </div>

      {/* ── Scroll indicator ── */}
      <div className="au6 hero-scroll-indicator absolute hidden md:flex flex-col items-center gap-2 text-muted2"
        style={{ bottom: '80px', right: '52px', zIndex: 6, fontSize: '8.5px', letterSpacing: '0.25em', textTransform: 'uppercase' }}>
        <div className="w-px h-11 scroll-pulse"
          style={{ background: 'linear-gradient(to bottom, #FF6B00, transparent)' }}/>
        <span className="hero-scroll-label">{t(lang, 'hero.scroll')}</span>
      </div>

    </section>
  )
}
