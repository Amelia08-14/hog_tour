'use client'
// src/components/home/Programme.tsx
import { useState } from 'react'

const DAYS = [
  { num:'01', label:'Jour 01', route:'Alger → Ghardaïa',       km:600, type:'Aller simple',
    acts:['Briefing général','Départ du convoi','Pause technique et brunch à 200 kms','Pause déjeuner à 400 kms','Arrivée à l\'hôtel après 600 kms','Remise des packs rallye','Check-in et installation','Dîner en groupe'] },
  { num:'02', label:'Jour 02', route:'Ghardaïa → El Guerrara',  km:250, type:'Aller / Retour',
    acts:['Briefing d\'avant départ','Direction El Guerrara à 125 kms','Déjeuner en palmeraie','Ballade à dos de chameaux','Challenge','Retour à Ghardaïa','Dîner à l\'hôtel'] },
  { num:'03', label:'Jour 03', route:'Ghardaïa → Sebseb',       km:130, type:'Aller / Retour',
    acts:['Visite du Souk local et place emblématique','Déjeuner cité écologique Tafilalt','Départ vers Sebseb','Challenge Quad dans les dunes','Concert sur les dunes','Remise des trophées','Retour à l\'hôtel à Ghardaïa'] },
  { num:'04', label:'Jour 04', route:'Ghardaïa → Alger',        km:600, type:'Aller simple',
    acts:['Briefing général d\'avant départ','Ride fête nationale du 1er Novembre','Pause technique à 200 kms','Pause déjeuner à 400 kms','Arrivée à Alger','Cocktail dînatoire de clôture'] },
]

export default function Programme() {
  const [active, setActive] = useState(0)

  return (
    <section id="programme" className="py-28 bg-bg2 border-t border-b border-orange/10">
      <div className="max-w-container mx-auto px-6 md:px-10">

        {/* Header */}
        <div className="reveal reveal-streak flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-14">
          <div>
            <div className="section-tag">Le Programme</div>
            <h2 className="font-display leading-[.93] tracking-wide"
              style={{ fontSize: 'clamp(44px, 6vw, 72px)' }}>
              Il s'étale sur <span className="text-orange">4 jours</span>
            </h2>
            <p className="text-muted text-[15px] leading-relaxed font-light max-w-[520px] mt-3">
              Au départ d'Alger, avec un programme riche en rides, découvertes culinaires,
              culture des régions et les fabuleux paysages de Ghardaïa.
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-display text-muted text-xl tracking-[0.25em]">29 Oct — 1er Nov 2026</p>
            <p className="text-muted2 text-[12px] mt-1">Alger → Ghardaïa → Alger</p>
          </div>
        </div>

        {/* Route strip */}
        <div className="reveal reveal-streak relative flex items-center justify-between bg-bg3 border border-orange/12 px-8 py-6 mb-1 overflow-hidden">
          <div className="absolute inset-0 opacity-50 pointer-events-none"
            style={{ backgroundImage: 'repeating-linear-gradient(90deg,transparent,transparent 60px,rgba(255,255,255,.03) 60px,rgba(255,255,255,.03) 61px)' }}/>
          <RouteCity name="ALGER"    sub="Point de départ" />
          <RouteArrow km={600} label="km aller" />
          <RouteCity name="GHARDAÏA" sub="Patrimoine UNESCO" highlight />
          <RouteArrow km={380} label="km excursions" />
          <RouteCity name="ALGER"    sub="1er Nov · Retour" />
        </div>

        {/* Pourquoi Ghardaïa */}
        <div className="reveal reveal-streak relative bg-bg3 border border-orange/12 mb-1 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(to right, #FF6B00, transparent)' }}/>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px]">
            <div className="p-9">
              <h3 className="font-display tracking-wide mb-4"
                style={{ fontSize: 'clamp(28px, 3.5vw, 44px)' }}>
                Pourquoi <span className="text-orange">Ghardaïa ?</span>
              </h3>
              <p className="text-muted text-[15px] leading-[1.82] font-light">
                De tout temps, Ghardaïa est considérée comme la porte du Sud algérien.
                Située dans la vallée du M'Zab, fondée au XI<sup>e</sup> siècle, elle est classée
                au patrimoine mondial de l'UNESCO, notamment en raison de son architecture Ksourienne.
              </p>
              <p className="text-muted text-[15px] leading-[1.82] font-light mt-3">
                La région du M'Zab offre un choix multiple de sites touristiques pour découvrir
                l'architecture, la culture locale et les traditions culinaires de la région.
              </p>
            </div>
            <div className="border-t lg:border-t-0 lg:border-l border-orange/10 flex flex-row lg:flex-col">
              {[
                { v: 'XIe',   l: 'Siècle de fondation' },
                { v: 'UNESCO',l: 'Patrimoine mondial'  },
                { v: "M'Zab", l: 'Vallée mythique'     },
              ].map((st, i) => (
                <div key={i} className={`flex-1 flex flex-col items-center justify-center text-center py-5 px-4 hover:bg-orange/5 transition-colors duration-200
                  ${i < 2 ? 'border-r lg:border-r-0 lg:border-b border-orange/10' : ''}`}>
                  <span className="font-display text-orange leading-none block"
                    style={{ fontSize: st.v === 'UNESCO' ? '22px' : '34px', letterSpacing: '1px' }}>
                    {st.v}
                  </span>
                  <p className="text-muted text-[9px] tracking-[0.2em] uppercase mt-1.5">{st.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4 Day cards */}
        <div className="reveal reveal-streak grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px bg-white/5">
          {DAYS.map((d, i) => (
            <div
              key={i}
              onClick={() => setActive(i)}
              className={`relative overflow-hidden p-7 cursor-pointer transition-colors duration-200
                ${active === i
                  ? 'bg-bg4 border-b-2 border-orange'
                  : 'bg-bg2 border-b-2 border-transparent hover:bg-bg3'}`}
            >
              {/* Gros numéro fond */}
              <span className={`absolute top-2.5 right-3 font-display text-[80px] leading-none pointer-events-none select-none transition-colors duration-300
                ${active === i ? 'text-orange/[.09]' : 'text-orange/[.05]'}`}>
                {d.num}
              </span>

              <p className="text-orange text-[9.5px] tracking-[0.25em] uppercase mb-2">{d.label}</p>
              <p className="font-condensed font-semibold text-[17px] leading-snug mb-1.5">{d.route}</p>
              <div className="flex items-baseline gap-1.5 mb-3.5">
                <span className="font-display text-orange text-[22px] leading-none">{d.km}</span>
                <span className="text-muted text-[11px] tracking-wide">KMS</span>
                <span className="text-muted2 text-[10px] tracking-wide ml-1">{d.type}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {d.acts.map((a, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <span className="block w-1 h-1 min-w-[4px] bg-orange mt-[5px] flex-shrink-0"/>
                    <span className={`text-[12px] leading-snug transition-colors duration-200
                      ${active === i ? 'text-htext' : 'text-muted'}`}>
                      {a}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}

function RouteCity({ name, sub, highlight = false }: { name: string; sub: string; highlight?: boolean }) {
  return (
    <div className="relative z-10 text-center flex-shrink-0">
      <p className={`font-display text-[22px] tracking-[0.18em] ${highlight ? 'text-orange' : 'text-htext'}`}>{name}</p>
      <p className="text-muted text-[9.5px] tracking-[0.18em] uppercase">{sub}</p>
    </div>
  )
}

function RouteArrow({ km, label }: { km: number; label: string }) {
  return (
    <div className="relative z-10 flex flex-1 items-center gap-2 px-5">
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, #FF6B00, rgba(255,107,0,.2))' }}/>
      <div className="text-center flex-shrink-0">
        <p className="font-display text-orange text-[28px] leading-none">{km}</p>
        <p className="text-muted text-[9px] tracking-[0.18em] uppercase">{label}</p>
      </div>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, #FF6B00, rgba(255,107,0,.2))' }}/>
    </div>
  )
}
