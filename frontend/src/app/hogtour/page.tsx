// src/app/hogtour/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
export const metadata: Metadata = { title: 'H.O.G Tour 2026' }

const HIGHLIGHTS = [
  { icon:'🏍', label:'Balades organisées',        desc:'Convois guidés à travers des paysages épiques' },
  { icon:'🏛', label:'Découverte culturelle',      desc:'Patrimoine, architecture et traditions du M\'Zab' },
  { icon:'🎵', label:'Animations et soirées',      desc:'Concert sur les dunes, cocktail de clôture' },
  { icon:'🌍', label:'Rencontres internationales', desc:'Riders d\'Algérie et de l\'international' },
  { icon:'🏆', label:'Challenges et trophées',     desc:'Quad, défis, remise de trophées' },
]

export default function HOGTourPage() {
  return (
    <>
      {/* Page header */}
      <div className="relative pt-[140px] pb-20 bg-bg2 border-b border-orange/10 overflow-hidden">
        <div className="absolute inset-0 opacity-40"
          style={{ backgroundImage:'linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)', backgroundSize:'80px 80px', maskImage:'radial-gradient(ellipse 80% 80% at 50% 50%,black 30%,transparent 70%)' }}/>
        <div className="max-w-container mx-auto px-6 md:px-10 relative z-10">
          <div className="section-tag">Un Rendez-vous Historique</div>
          <h1 className="font-display leading-[.88] tracking-wide mt-3" style={{ fontSize:'clamp(48px, 7vw, 88px)' }}>
            Algeria<br /><span className="text-orange">H.O.G Tour 2026</span>
          </h1>
          <p className="text-muted text-[13px] tracking-[0.25em] uppercase mt-4">
            Du 29 octobre au 1<sup>er</sup> novembre 2026 · Algérie
          </p>
        </div>
      </div>

      <section className="py-20 bg-bg">
        <div className="max-w-container mx-auto px-6 md:px-10 flex flex-col gap-1">

          {/* Vidéo teaser */}
          <div className="relative w-full bg-bg3 border border-orange/10 overflow-hidden" style={{ aspectRatio: '16/9' }}>
            <video
              className="absolute inset-0 w-full h-full object-cover"
              src="/videos/hog_teaser.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(to top, rgba(0,0,0,.55), rgba(0,0,0,0) 62%), radial-gradient(900px 420px at 20% 15%, rgba(255,107,0,.14) 0%, rgba(255,107,0,0) 62%)',
              }}
            />
          </div>

          {/* Description + date badge */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-1">
            <div className="bg-bg3 border border-orange/10 p-10">
              <h2 className="font-display leading-[.92] tracking-wide mb-6" style={{ fontSize:'clamp(32px, 4vw, 52px)' }}>
                Un rendez-vous historique pour la<br /><span className="text-orange">communauté Harley-Davidson</span>
              </h2>
              {[
                <>Du <strong className="text-htext font-medium">29 octobre au 1er novembre 2026</strong>, l'Algérie accueillera pour la première fois un grand rassemblement officiel Harley-Davidson : le <strong className="text-orange font-medium">Algeria H.O.G Tour 2026</strong>.</>,
                <>Organisé par le H.O.G Algiers Chapter Algeria, cet événement marque une étape majeure pour la communauté Harley-Davidson en Afrique du Nord.</>,
                <>Pendant quatre jours, des passionnés venus d'Algérie et de l'international se réuniront autour des valeurs qui font l'ADN Harley-Davidson : <strong className="text-orange font-medium">Liberté, fraternité, passion et esprit de route.</strong></>,
              ].map((p, i) => (
                <p key={i} className="text-muted text-[15.5px] leading-[1.85] font-light mb-4">{p}</p>
              ))}
            </div>
            <div className="relative bg-bg3 border border-orange p-8 text-center">
              <div className="absolute top-2 left-2 w-4 h-4 border-t border-l border-orange"/>
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b border-r border-orange"/>
              <p className="text-orange text-[9px] tracking-[0.35em] uppercase mb-2">Dates officielles</p>
              <p className="font-display text-[22px] tracking-[0.15em] text-htext leading-none">29 Oct — 1er Nov</p>
              <p className="font-display text-orange text-[52px] leading-none mt-1">2026</p>
              <p className="text-muted text-[9.5px] tracking-[0.18em] uppercase mt-3">Première fois en Algérie</p>
            </div>
          </div>

          {/* Adventure */}
          <div className="bg-bg3 border border-orange/10 p-10">
            <h3 className="font-display leading-[.92] tracking-wide mb-5" style={{ fontSize:'clamp(28px, 3.5vw, 48px)' }}>
              Une aventure entre culture,<br />route et passion
            </h3>
            <p className="text-muted text-[18px] leading-relaxed font-light mb-6">
              Le 2026 Algeria H.O.G Tour proposera un parcours unique mêlant montagne, désert, patrimoine et modernité.
            </p>
            <div className="flex flex-col gap-0 border border-orange/10">
              {HIGHLIGHTS.map((h, i) => (
                <div key={i} className={`flex items-center gap-4 p-4 hover:bg-orange/5 transition-colors ${i < HIGHLIGHTS.length - 1 ? 'border-b border-orange/10' : ''}`}>
                  <span className="text-[22px] w-8 text-center flex-shrink-0">{h.icon}</span>
                  <div>
                    <p className="font-condensed font-semibold text-[16px]">{h.label}</p>
                    <p className="text-muted text-[13px]">{h.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Join CTA */}
          <div className="relative bg-bg3 border border-orange/10 p-10 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background:'linear-gradient(to right,#FF6B00,transparent)' }}/>
            <div className="flex items-center justify-between gap-10 flex-wrap">
              <div className="max-w-[600px]">
                <h3 className="font-display text-orange tracking-wide mb-4" style={{ fontSize:'clamp(28px,3.5vw,44px)' }}>
                  Rejoignez l'histoire
                </h3>
                <p className="text-muted text-[18px] leading-relaxed font-light mb-2">
                  Que vous soyez rider confirmé, membre H.O.G ou passionné de la marque, ce rendez-vous est une invitation à écrire ensemble une nouvelle page de l'histoire Harley-Davidson.
                </p>
                <p className="font-condensed font-semibold text-[20px] text-htext italic mt-4">Let's roar the rock.</p>
              </div>
              <Link href="/inscription"
                className="bg-orange text-black font-condensed font-extrabold text-[14px] tracking-[0.22em] uppercase px-12 py-4 hover:bg-white hover:-translate-y-0.5 transition-all duration-200 flex-shrink-0">
                Inscrivez Vous →
              </Link>
            </div>
          </div>

        </div>
      </section>
    </>
  )
}
