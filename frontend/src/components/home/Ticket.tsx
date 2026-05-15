// src/components/home/Ticket.tsx
import type { Lang } from '@/i18n/shared'
import { t } from '@/i18n/messages'

export default function Ticket({ lang }: { lang: Lang }) {
  const isAr = lang === 'ar'
  return (
    <section className="ticket-cinematic relative py-32 overflow-hidden">

      {/* ── Background image ── */}
      <div className="absolute inset-0" style={{
        backgroundImage: "url('/images/hero-bg.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center 55%',
      }}/>

      {/* ── Dark gradient overlay ── */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to bottom, #0A0A08 0%, rgba(10,10,8,.78) 35%, rgba(10,10,8,.78) 65%, #0A0A08 100%)',
      }}/>

      {/* ── Orange volumetric glow ── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(1000px 500px at 50% 50%, rgba(255,107,0,.14) 0%, rgba(255,107,0,0) 72%)',
      }}/>

      {/* ── Grid overlay ── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'repeating-linear-gradient(90deg, rgba(255,107,0,.04) 0 1px, transparent 1px 60px), repeating-linear-gradient(0deg, rgba(255,107,0,.04) 0 1px, transparent 1px 60px)',
        maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 80%)',
      }}/>

      {/* ── Corner accents ── */}
      <div className="absolute inset-8 pointer-events-none" style={{
        background:
          'linear-gradient(#FF6B00,#FF6B00) top left / 40px 1px no-repeat,' +
          'linear-gradient(#FF6B00,#FF6B00) top left / 1px 40px no-repeat,' +
          'linear-gradient(#FF6B00,#FF6B00) top right / 40px 1px no-repeat,' +
          'linear-gradient(#FF6B00,#FF6B00) top right / 1px 40px no-repeat,' +
          'linear-gradient(#FF6B00,#FF6B00) bottom left / 40px 1px no-repeat,' +
          'linear-gradient(#FF6B00,#FF6B00) bottom left / 1px 40px no-repeat,' +
          'linear-gradient(#FF6B00,#FF6B00) bottom right / 40px 1px no-repeat,' +
          'linear-gradient(#FF6B00,#FF6B00) bottom right / 1px 40px no-repeat',
        opacity: 0.35,
      }}/>

      {/* ── Content ── */}
      <div className={`relative z-10 max-w-container mx-auto px-6 md:px-10 text-center ${isAr ? 'text-right md:text-center' : ''}`}>

        <div className="section-tag justify-center">{t(lang, 'home.ticketTag')}</div>

        <h2
          className="font-display tracking-wide text-htext mt-3 mb-3"
          style={{
            fontSize: isAr ? 'clamp(26px, 3.5vw, 48px)' : 'clamp(38px, 5.5vw, 76px)',
            lineHeight: isAr ? 1.35 : 0.93,
            textShadow: '0 4px 40px rgba(0,0,0,.6)',
          }}
        >
          {t(lang, 'home.ticketTitle')}
        </h2>

        <p className={`font-condensed text-muted mt-3 mb-10 ${isAr ? '' : 'uppercase tracking-[0.22em]'}`}
          style={{ fontSize: 'clamp(12px, 1.4vw, 15px)' }}>
          {t(lang, 'home.ticketSubtitle')}
        </p>

        {/* Divider */}
        <div className="ticket-divider mx-auto mb-10"/>

        {/* CTA */}
        <a
          href="/inscription"
          className={`ticket-cta font-condensed font-extrabold ${isAr ? '' : 'uppercase'} inline-flex items-center gap-3 transition-all duration-300`}
          style={{ letterSpacing: isAr ? '0px' : '0.22em' }}
        >
          {t(lang, 'home.ticketCta')}
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </a>

        {/* Info strip */}
        <div className="ticket-info-strip mt-14 flex items-center justify-center gap-8 flex-wrap">
          {[
            { icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', label: lang === 'ar' ? '29 أكتوبر — 1 نوفمبر 2026' : lang === 'en' ? 'Oct 29 — Nov 1, 2026' : '29 Oct — 1er Nov 2026' },
            { icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z', label: lang === 'ar' ? 'الجزائر → غرداية' : 'Algiers → Ghardaïa' },
            { icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7', label: lang === 'ar' ? '1580 كم' : '1 580 km' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-muted">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="text-orange/70 flex-shrink-0">
                <path d={item.icon}/>
              </svg>
              <span className={`font-condensed text-[13px] ${isAr ? '' : 'uppercase tracking-[0.14em]'}`}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
