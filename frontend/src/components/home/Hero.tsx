// src/components/home/Hero.tsx
// Photo : public/images/hero-bg.png
import Image from 'next/image'

export default function Hero() {
  return (
    <section className="relative w-full min-h-screen flex flex-col justify-end overflow-hidden">

      {/* ── Photo de fond ── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/images/hero-bg.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center 35%',
          backgroundColor: '#1a1208',
        }}
      />

      {/* ── Overlay gradient bas ── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'linear-gradient(to bottom, rgba(5,3,1,.55) 0%, rgba(5,3,1,.05) 30%, rgba(5,3,1,.05) 46%, rgba(5,3,1,.50) 65%, rgba(5,3,1,.92) 84%, rgba(5,3,1,1) 100%)'
      }}/>

      {/* ── Overlay gauche (lisibilité texte) ── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'linear-gradient(to right, rgba(5,3,1,.88) 0%, rgba(5,3,1,.50) 32%, rgba(5,3,1,.10) 56%, transparent 72%)'
      }}/>

      {/* ── Road lines SVG ── */}
      <svg className="absolute bottom-14 left-0 right-0 w-full pointer-events-none"
        style={{ height: '45%', zIndex: 3 }}
        viewBox="0 0 1440 400" fill="none" preserveAspectRatio="none">
        <path d="M720 400 L0 50"    stroke="#FF6B00" strokeWidth="1"   strokeDasharray="12 20" opacity=".2"/>
        <path d="M720 400 L1440 50" stroke="#FF6B00" strokeWidth="1"   strokeDasharray="12 20" opacity=".2"/>
        <path d="M720 400 L720 0"   stroke="#FF6B00" strokeWidth="1.5" strokeDasharray="20 28" opacity=".25"/>
      </svg>

      {/* ── Badge HOG top-right ── */}
      <div className="absolute top-[96px] right-10 hidden md:block" style={{ zIndex: 10 }}>
        <div className="w-[140px] h-[140px] rounded-full flex items-center justify-center overflow-hidden"
          style={{ border: '2px solid rgba(255,107,0,.45)', background: 'rgba(10,10,8,.65)', backdropFilter: 'blur(10px)' }}>
          <Image
            src="/images/logo-hogtour.png"
            alt="H.O.G Tour 2026"
            width={112}
            height={112}
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* ── Contenu principal ── */}
      <div className="relative px-6 md:px-12 pb-6 max-w-4xl" style={{ zIndex: 5 }}>

        {/* Eyebrow */}
        <div className="au1 inline-flex items-center gap-2.5 mb-5"
          style={{ background: 'rgba(255,107,0,.08)', border: '1px solid rgba(255,107,0,.25)', padding: '7px 14px 7px 10px' }}>
          <span className="block w-5 h-px bg-orange flex-shrink-0"/>
          <span className="text-orange text-[10.5px] uppercase" style={{ letterSpacing: '0.4em', fontFamily: 'Barlow, sans-serif' }}>
            H.O.G Algiers Chapter Algeria &nbsp;·&nbsp; Accréditation #8062
          </span>
        </div>

        {/* H1 */}
        <h1 className="au2 font-display m-0" style={{ fontSize: 'clamp(44px, 8.5vw, 110px)', lineHeight: '0.98', letterSpacing: '1.5px' }}>
          <span className="block text-white" style={{ textShadow: '0 2px 20px rgba(0,0,0,.95)' }}>
            H.O.G TOUR 2026 ®
          </span>
          <span className="block text-white" style={{ textShadow: '0 2px 20px rgba(0,0,0,.95)' }}>
            PREMIÈRE FOIS EN
          </span>
          <span className="block text-orange" style={{ textShadow: '0 0 60px rgba(255,107,0,.6), 0 2px 20px rgba(0,0,0,.95)' }}>
            ALGÉRIE
          </span>
        </h1>

        {/* Sous-titre */}
        <p className="au3 font-condensed font-normal leading-relaxed mt-5 mb-10 max-w-[560px]"
          style={{ fontSize: 'clamp(13px, 1.6vw, 17px)', letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(255,255,255,.65)' }}>
          <strong className="font-bold" style={{ color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,.8)' }}>Ne ratez pas l&apos;occasion</strong>
          {' '}et soyez les bienvenus pour cette première édition.
        </p>

        {/* CTAs */}
        <div className="au4 flex gap-3 flex-wrap">
          <a href="/inscription" className="font-condensed font-extrabold uppercase transition-all duration-200 hover:-translate-y-0.5"
            style={{ background: '#FF6B00', color: '#000', fontSize: '13px', letterSpacing: '3px', padding: '16px 40px', border: '2px solid #FF6B00', boxShadow: '0 0 24px rgba(255,107,0,.35)', display: 'inline-flex', alignItems: 'center' }}>
            Inscrivez Vous
          </a>
          <a href="/hogtour" className="font-condensed font-bold uppercase transition-all duration-200 hover:-translate-y-0.5"
            style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.30)', color: 'rgba(255,255,255,.9)', fontSize: '13px', letterSpacing: '3px', padding: '16px 36px', backdropFilter: 'blur(4px)', display: 'inline-flex', alignItems: 'center' }}>
            Découvrir l&apos;événement
          </a>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="au5 relative grid grid-cols-2 md:grid-cols-4" style={{ zIndex: 5, borderTop: '1px solid rgba(255,107,0,.20)', background: 'rgba(8,8,6,.80)', backdropFilter: 'blur(20px)' }}>
        {[
          { v: '1 580', l: 'Kilomètres de route' },
          { v: '4',     l: "Jours d'aventure"    },
          { v: '29 Oct',l: 'Date de départ'       },
          { v: '1ère',  l: 'Fois en Algérie'      },
        ].map((st, i) => (
          <div key={i} className="py-5 px-6 text-center hover:bg-orange/5 transition-colors duration-200"
            style={{ borderRight: i < 3 ? '1px solid rgba(255,107,0,.10)' : 'none' }}>
            <span className="font-display text-orange block leading-none" style={{ fontSize: '34px', textShadow: '0 0 20px rgba(255,107,0,.3)' }}>
              {st.v}
            </span>
            <p className="text-muted mt-1.5" style={{ fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase' }}>{st.l}</p>
          </div>
        ))}
      </div>

      {/* ── Scroll indicator ── */}
      <div className="au6 absolute hidden md:flex flex-col items-center gap-2 text-muted2"
        style={{ bottom: '80px', right: '52px', zIndex: 6, fontSize: '8.5px', letterSpacing: '0.25em', textTransform: 'uppercase' }}>
        <div className="w-px h-11 scroll-pulse"
          style={{ background: 'linear-gradient(to bottom, #FF6B00, transparent)' }}/>
        <span>Scroll</span>
      </div>

    </section>
  )
}
