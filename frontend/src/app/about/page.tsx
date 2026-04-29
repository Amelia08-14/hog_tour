// src/app/about/page.tsx
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'À Propos' }

export default function AboutPage() {
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
        <div className="max-w-container mx-auto px-6 md:px-10 relative z-10">
          <div className="section-tag">À Propos</div>
          <h1 className="font-display leading-[.88] tracking-wide mt-3" style={{ fontSize: 'clamp(44px, 6vw, 80px)' }}>
            Plus qu'un club.<br /><span className="text-orange">Une passion !</span>
          </h1>
        </div>
      </div>

      <section className="py-20 bg-bg">
        <div className="max-w-container mx-auto px-6 md:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start mb-20">

            {/* Photos */}
            <div className="grid grid-cols-2 gap-1">
              {['Photo membre avec micro','Photo directeur + bannière HOG'].map((label, i) => (
                <div key={i} className={`bg-bg3 border border-orange/10 flex flex-col items-center justify-center gap-3 ${i === 1 ? 'mt-10' : ''}`}
                  style={{ aspectRatio: '3/4', minHeight: '200px' }}>
                  <svg width="32" height="32" fill="none" stroke="#FF6B00" strokeWidth="1" viewBox="0 0 24 24" className="opacity-20">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span className="text-muted2 text-[10px] tracking-[0.15em] uppercase opacity-40 text-center px-4">{label}</span>
                </div>
              ))}
            </div>

            {/* Texte */}
            <div>
              {/* Carte directeur */}
              <div className="bg-bg3 border-t-2 border-orange border-x border-b border-orange/10 p-5 mb-8">
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

              <p className="font-condensed font-bold text-[20px] tracking-wide text-orange uppercase mb-6">
                Plus qu'un club. une passion !!
              </p>

              {[
                "Je m'appelle Abdelghani Mecheti, directeur du H.O.G Algiers Chapter Algeria. Je souhaite la bienvenue à tous nos membres et nouveaux visiteurs sur notre site.",
                "Je profite de cette occasion pour remercier sincèrement les membres de notre Staff pour leur engagement et la fidélité dont ils ont fait preuve. Je remercie toutes celles et ceux qui ont décidé de poursuivre l'aventure, de nous faire confiance et bienvenue aux nouveaux.",
                "Créé le 15 Mai 2013, notre Chapter est composé d'hommes, de femmes, de jeunes et moins jeunes, novices et rouleurs confirmés. Il faut se réjouir de cette mixité, d'une part, l'expérience des anciens et la jeunesse des nouveaux.",
                "Les responsables des activités travaillent sur les prochains programmes afin de vous proposer des sorties adaptées à tous les niveaux de conduite. Des virées plus ou moins longues, mais aussi, des actions caritatives et des activités en famille.",
              ].map((p, i) => (
                <p key={i} className="text-muted text-[15px] leading-[1.85] font-light mb-4">{p}</p>
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
            {['Event HOG Algeria 1','Event HOG Algeria 2','Algeria Bike Week'].map((label, i) => (
              <div key={i} className="bg-bg3 border border-orange/10 flex flex-col items-center justify-center gap-3" style={{ aspectRatio: '16/9', minHeight: '180px' }}>
                <svg width="28" height="28" fill="none" stroke="#FF6B00" strokeWidth="1" viewBox="0 0 24 24" className="opacity-20">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                <span className="text-muted2 text-[10px] tracking-[0.15em] uppercase opacity-40">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
