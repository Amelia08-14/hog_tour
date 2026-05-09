// src/app/about/page.tsx
import type { Metadata } from 'next'
import Image from 'next/image'
export const metadata: Metadata = { title: 'À Propos' }

export default function AboutPage() {
  const photosMain = [
    { src: '/images/galeries/hogtour (18).jpeg', alt: 'H.O.G Algeria — sur la route' },
    { src: '/images/galeries/hogtour (14).jpeg', alt: 'H.O.G Algeria — rassemblement' },
  ]

  const photosExtra = [
    { src: '/images/galeries/hogtour (8).jpeg', alt: 'H.O.G Algeria — moment de ride' },
    { src: '/images/galeries/hogtour (3).jpeg', alt: 'H.O.G Algeria — groupe' },
    { src: '/images/galeries/hogtour (24).jpeg', alt: 'H.O.G Algeria — paysage' },
  ]

  return (
    <>
      {/* Page header */}
      <div className="relative pt-[140px] pb-20 bg-bg2 border-b border-orange/10 overflow-hidden">
        <div className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)',
            backgroundSize: '80px 80px',
            maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%,black 30%,transparent 70%)',
          }}/>
        <div className="absolute inset-0 pointer-events-none about-header-sweep" />
        <div className="max-w-container 2xl:max-w-[1400px] mx-auto px-6 md:px-10 relative z-10">
          <div className="section-tag au1">À Propos</div>
          <h1 className="au2 font-display leading-[.88] tracking-wide mt-3" style={{ fontSize: 'clamp(44px, 6vw, 80px)' }}>
            Plus qu'un club.<br /><span className="text-orange">Une passion !</span>
          </h1>
        </div>
      </div>

      <section className="py-20 bg-bg">
        <div className="max-w-container 2xl:max-w-[1400px] mx-auto px-6 md:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start mb-20">

            {/* Photos */}
            <div className="au3 grid grid-cols-2 gap-1">
              {photosMain.map((p, i) => (
                <div
                  key={p.src}
                  className={`reveal reveal-streak hog-glow relative bg-bg3 border border-orange/10 overflow-hidden ${i === 1 ? 'mt-10' : ''}`}
                  style={{ aspectRatio: '3/4', minHeight: '240px' }}
                >
                  <Image
                    src={p.src}
                    alt={p.alt}
                    fill
                    sizes="(min-width: 1024px) 520px, 50vw"
                    className={`object-cover transition-transform duration-700 hover:scale-[1.03] about-img-in ${i === 0 ? 'about-d2' : 'about-d3'}`}
                    priority={i === 0}
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(to top, rgba(0,0,0,.62), rgba(0,0,0,0) 62%)' }}
                  />
                </div>
              ))}
            </div>

            {/* Texte */}
            <div className="au3">
              {/* Carte directeur */}
              <div className="about-card-in about-d2 bg-bg3 border-t-2 border-orange border-x border-b border-orange/10 p-5 mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-[52px] h-[52px] bg-orange flex items-center justify-center flex-shrink-0">
                    <span className="font-display text-[20px] text-black tracking-[2px]">AM</span>
                  </div>
                  <div>
                    <p className="font-condensed font-semibold text-[18px]">Abdelghani Mecheti</p>
                    <p className="text-orange text-[10.5px] tracking-[0.15em] uppercase mt-0.5">Directeur — H.O.G Algiers Chapter Algeria</p>
                  </div>
                </div>
              </div>

              <p className="au4 font-condensed font-bold text-[20px] tracking-wide text-orange uppercase mb-6">
                Plus qu'un club. une passion !!
              </p>

              {[
                "Je m'appelle Abdelghani Mecheti, directeur du H.O.G Algiers Chapter Algeria. Je souhaite la bienvenue à tous nos membres et nouveaux visiteurs sur notre site.",
                "Je profite de cette occasion pour remercier sincèrement les membres de notre Staff pour leur engagement et la fidélité dont ils ont fait preuve. Je remercie toutes celles et ceux qui ont décidé de poursuivre l'aventure, de nous faire confiance et bienvenue aux nouveaux.",
                "Créé le 15 Mai 2013, notre Chapter est composé d'hommes, de femmes, de jeunes et moins jeunes, novices et rouleurs confirmés. Il faut se réjouir de cette mixité, d'une part, l'expérience des anciens et la jeunesse des nouveaux.",
                "Les responsables des activités travaillent sur les prochains programmes afin de vous proposer des sorties adaptées à tous les niveaux de conduite. Des virées plus ou moins longues, mais aussi, des actions caritatives et des activités en famille.",
              ].map((p, i) => (
                <p key={i} className="text-muted text-[18px] leading-[1.85] font-light mb-4">{p}</p>
              ))}

              <blockquote className="border-l-2 border-orange pl-6 py-4 bg-bg3 my-6">
                <p className="font-condensed font-medium text-[17px] leading-snug italic text-htext">
                  "À toutes celles et ceux qui hésiteraient encore à nous rejoindre, je peux vous
                  assurer que si rouler avec votre Harley-Davidson est un pur bonheur, imaginez une
                  seule seconde si vous partagiez cette passion avec nous…!"
                </p>
              </blockquote>

              <div className="flex flex-col gap-1 mt-6">
                <div className="w-12 h-px bg-orange"/>
                <p className="font-condensed font-semibold text-[16px] mt-2">Abdelghani Mecheti</p>
                <p className="text-orange text-[10.5px] tracking-[0.15em] uppercase">Directeur, H.O.G Algiers Chapter Algeria</p>
              </div>
            </div>
          </div>

          {/* Photos extra */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
            {photosExtra.map((p, idx) => (
              <div
                key={p.src}
                className="reveal reveal-streak hog-glow relative bg-bg3 border border-orange/10 overflow-hidden"
                style={{ aspectRatio: '16/9', minHeight: '200px' }}
              >
                <Image
                  src={p.src}
                  alt={p.alt}
                  fill
                  sizes="(min-width: 1024px) 420px, 100vw"
                  className={`object-cover transition-transform duration-700 hover:scale-[1.03] about-img-in ${idx === 0 ? 'about-d2' : idx === 1 ? 'about-d3' : 'about-d4'}`}
                />
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,.55), rgba(0,0,0,0) 65%)' }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
