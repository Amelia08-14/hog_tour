'use client'
// src/components/home/Programme.tsx
import { useState } from 'react'
import type { Lang } from '@/i18n/shared'

type Day = { num: string; label: string; route: string; km: number; type: string; acts: string[] }

function programmeCopy(lang: Lang): {
  tag: string
  titleA: string
  titleB: string
  subtitle: string
  dates: string
  route: string
  routeStops: { a: { name: string; sub: string }; b: { name: string; sub: string }; c: { name: string; sub: string }; aToB: { km: number; label: string }; bToC: { km: number; label: string } }
  whyTitle: string
  whyP1: string
  whyP2: string
  whyStats: Array<{ v: string; l: string }>
  days: Day[]
} {
  if (lang === 'en') {
    return {
      tag: 'Schedule',
      titleA: 'A',
      titleB: 'day journey',
      subtitle: 'Starting from Algiers, a rich program of rides, discoveries, local culture, and the stunning landscapes of Ghardaïa.',
      dates: 'Oct 29 — Nov 1, 2026',
      route: 'Algiers → Ghardaïa → Algiers',
      routeStops: {
        a: { name: 'ALGIERS', sub: 'Departure point' },
        b: { name: 'GHARDAÏA', sub: 'UNESCO Heritage' },
        c: { name: 'ALGIERS', sub: 'Nov 1 · Return' },
        aToB: { km: 600, label: 'km outbound' },
        bToC: { km: 380, label: 'km excursions' },
      },
      whyTitle: 'Why Ghardaïa?',
      whyP1:
        'Ghardaïa has long been considered the gateway to the Algerian South. Located in the M’Zab Valley and founded in the 11th century, it is listed as a UNESCO World Heritage site for its unique ksour architecture.',
      whyP2:
        'The M’Zab region offers many sites to discover local architecture, culture, and culinary traditions.',
      whyStats: [
        { v: '11th', l: 'Century founded' },
        { v: 'UNESCO', l: 'World Heritage' },
        { v: "M’Zab", l: 'Iconic valley' },
      ],
      days: [
        { num: '01', label: 'Day 01', route: 'Algiers → Ghardaïa', km: 600, type: 'One‑way',
          acts: ['General briefing', 'Convoy departure', 'Technical stop & brunch at 200 km', 'Lunch break at 400 km', 'Hotel arrival after 600 km', 'Rally packs hand‑out', 'Check‑in & setup', 'Group dinner'] },
        { num: '02', label: 'Day 02', route: 'Ghardaïa → El Guerrara', km: 250, type: 'Round trip',
          acts: ['Pre‑departure briefing', 'Ride to El Guerrara (125 km)', 'Lunch in the palm grove', 'Camel ride', 'Challenge', 'Return to Ghardaïa', 'Dinner at the hotel'] },
        { num: '03', label: 'Day 03', route: 'Ghardaïa → Sebseb', km: 130, type: 'Round trip',
          acts: ['Visit the local souk & main square', 'Lunch at the eco‑city of Tafilelt', 'Departure to Sebseb', 'Quad challenge in the dunes', 'Concert on the dunes', 'Awards ceremony', 'Return to the hotel in Ghardaïa'] },
        { num: '04', label: 'Day 04', route: 'Ghardaïa → Algiers', km: 600, type: 'One‑way',
          acts: ['General pre‑departure briefing', 'National Day ride (Nov 1)', 'Technical stop at 200 km', 'Lunch break at 400 km', 'Arrival in Algiers', 'Closing dinner cocktail'] },
      ],
    }
  }
  if (lang === 'ar') {
    return {
      tag: 'البرنامج',
      titleA: 'رحلة تمتد',
      titleB: 'أيام',
      subtitle: 'انطلاقًا من الجزائر العاصمة، برنامج غني بالقيادة والاكتشافات والثقافة المحلية ومناظر غرداية الساحرة.',
      dates: '29 أكتوبر — 1 نوفمبر 2026',
      route: 'الجزائر → غرداية → الجزائر',
      routeStops: {
        a: { name: 'الجزائر', sub: 'نقطة الانطلاق' },
        b: { name: 'غرداية', sub: 'تراث اليونسكو' },
        c: { name: 'الجزائر', sub: '1 نوفمبر · العودة' },
        aToB: { km: 600, label: 'كم ذهاب' },
        bToC: { km: 380, label: 'كم رحلات' },
      },
      whyTitle: 'لماذا غرداية؟',
      whyP1:
        'تُعد غرداية منذ زمن بعيد بوابة الجنوب الجزائري. تقع في وادي مزاب وتأسست في القرن الحادي عشر، وهي مُدرجة ضمن قائمة التراث العالمي لليونسكو لما تتميز به من عمارة قصورية فريدة.',
      whyP2:
        'تقدم منطقة مزاب العديد من المواقع لاكتشاف العمارة والثقافة المحلية والتقاليد الغذائية للمنطقة.',
      whyStats: [
        { v: 'القرن 11', l: 'سنة التأسيس' },
        { v: 'UNESCO', l: 'تراث عالمي' },
        { v: 'مزاب', l: 'وادي أسطوري' },
      ],
      days: [
        { num: '01', label: 'اليوم 01', route: 'الجزائر → غرداية', km: 600, type: 'ذهاب',
          acts: ['إحاطة عامة', 'انطلاق القافلة', 'توقف تقني وفطور عند 200 كم', 'استراحة غداء عند 400 كم', 'الوصول إلى الفندق بعد 600 كم', 'تسليم حزم الرالي', 'تسجيل الدخول والاستقرار', 'عشاء جماعي'] },
        { num: '02', label: 'اليوم 02', route: 'غرداية → القرارة', km: 250, type: 'ذهاب وعودة',
          acts: ['إحاطة قبل الانطلاق', 'التوجه إلى القرارة (125 كم)', 'غداء في واحة النخيل', 'جولة على ظهر الجمال', 'تحدٍ', 'العودة إلى غرداية', 'عشاء في الفندق'] },
        { num: '03', label: 'اليوم 03', route: 'غرداية → سبسب', km: 130, type: 'ذهاب وعودة',
          acts: ['زيارة السوق المحلي والساحة الرمزية', 'غداء في المدينة البيئية تافيلالت', 'الانطلاق نحو سبسب', 'تحدي رباعيات في الكثبان', 'حفل موسيقي على الرمال', 'تسليم الجوائز', 'العودة إلى الفندق في غرداية'] },
        { num: '04', label: 'اليوم 04', route: 'غرداية → الجزائر', km: 600, type: 'ذهاب',
          acts: ['إحاطة عامة قبل الانطلاق', 'جولة عيد 1 نوفمبر', 'توقف تقني عند 200 كم', 'استراحة غداء عند 400 كم', 'الوصول إلى الجزائر', 'كوكتيل عشاء الختام'] },
      ],
    }
  }
  return {
    tag: 'Le Programme',
    titleA: "Il s'étale sur",
    titleB: 'jours',
    subtitle: "Au départ d'Alger, avec un programme riche en rides, découvertes culinaires, culture des régions et les fabuleux paysages de Ghardaïa.",
    dates: '29 Oct — 1er Nov 2026',
    route: 'Alger → Ghardaïa → Alger',
    routeStops: {
      a: { name: 'ALGER', sub: 'Point de départ' },
      b: { name: 'GHARDAÏA', sub: 'Patrimoine UNESCO' },
      c: { name: 'ALGER', sub: '1er Nov · Retour' },
      aToB: { km: 600, label: 'km aller' },
      bToC: { km: 380, label: 'km excursions' },
    },
    whyTitle: 'Pourquoi Ghardaïa ?',
    whyP1:
      "De tout temps, Ghardaïa est considérée comme la porte du Sud algérien. Située dans la vallée du M'Zab, fondée au XIe siècle, elle est classée au patrimoine mondial de l'UNESCO, notamment en raison de son architecture Ksourienne.",
    whyP2:
      "La région du M'Zab offre un choix multiple de sites touristiques pour découvrir l'architecture, la culture locale et les traditions culinaires de la région.",
    whyStats: [
      { v: 'XIe', l: 'Siècle de fondation' },
      { v: 'UNESCO', l: 'Patrimoine mondial' },
      { v: "M'Zab", l: 'Vallée mythique' },
    ],
    days: [
      { num:'01', label:'Jour 01', route:'Alger → Ghardaïa', km:600, type:'Aller simple',
        acts:['Briefing général','Départ du convoi','Pause technique et brunch à 200 kms','Pause déjeuner à 400 kms',"Arrivée à l'hôtel après 600 kms",'Remise des packs rallye','Check-in et installation','Dîner en groupe'] },
      { num:'02', label:'Jour 02', route:'Ghardaïa → El Guerrara', km:250, type:'Aller / Retour',
        acts:["Briefing d'avant départ",'Direction El Guerrara à 125 kms','Déjeuner en palmeraie','Ballade à dos de chameaux','Challenge','Retour à Ghardaïa',"Dîner à l'hôtel"] },
      { num:'03', label:'Jour 03', route:'Ghardaïa → Sebseb', km:130, type:'Aller / Retour',
        acts:['Visite du Souk local et place emblématique','Déjeuner cité écologique Tafilalt','Départ vers Sebseb','Challenge Quad dans les dunes','Concert sur les dunes','Remise des trophées',"Retour à l'hôtel à Ghardaïa"] },
      { num:'04', label:'Jour 04', route:'Ghardaïa → Alger', km:600, type:'Aller simple',
        acts:["Briefing général d'avant départ",'Ride fête nationale du 1er Novembre','Pause technique à 200 kms','Pause déjeuner à 400 kms','Arrivée à Alger','Cocktail dînatoire de clôture'] },
    ],
  }
}

export default function Programme({ lang }: { lang: Lang }) {
  const [active, setActive] = useState(0)
  const copy = programmeCopy(lang)
  const days = copy.days

  return (
    <section id="programme" className="py-28 bg-bg2 border-t border-b border-orange/10 relative overflow-hidden">
      <div className="prog-glow" aria-hidden="true"/>
      <div className="max-w-container mx-auto px-6 md:px-10 relative z-10">

        {/* Header */}
        <div className="reveal reveal-streak flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-14">
          <div className={lang === 'ar' ? 'text-right' : ''}>
            <div className="section-tag">{copy.tag}</div>
            <h2 className="font-display tracking-wide"
              style={{
                fontSize: lang === 'ar' ? 'clamp(28px, 3.5vw, 46px)' : 'clamp(44px, 6vw, 72px)',
                lineHeight: lang === 'ar' ? '1.35' : '0.93',
              }}>
              {copy.titleA} <span className="text-orange">4</span> {copy.titleB}
            </h2>
            <p className="text-muted text-[18px] leading-relaxed font-light max-w-[560px] mt-3">
              {copy.subtitle}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`font-display text-muted text-xl ${lang === 'ar' ? 'tracking-normal' : 'tracking-[0.25em]'}`}>{copy.dates}</p>
            <p className="text-muted2 text-[15px] mt-1">{copy.route}</p>
          </div>
        </div>

        {/* Route strip */}
        <div className="reveal reveal-streak hog-glow relative flex items-center justify-between bg-bg3 border border-orange/12 px-8 py-6 mb-1 overflow-hidden">
          <div className="absolute inset-0 opacity-50 pointer-events-none"
            style={{ backgroundImage: 'repeating-linear-gradient(90deg,transparent,transparent 60px,rgba(255,255,255,.03) 60px,rgba(255,255,255,.03) 61px)' }}/>
          <RouteCity name={copy.routeStops.a.name} sub={copy.routeStops.a.sub} />
          <RouteArrow km={copy.routeStops.aToB.km} label={copy.routeStops.aToB.label} />
          <RouteCity name={copy.routeStops.b.name} sub={copy.routeStops.b.sub} highlight />
          <RouteArrow km={copy.routeStops.bToC.km} label={copy.routeStops.bToC.label} />
          <RouteCity name={copy.routeStops.c.name} sub={copy.routeStops.c.sub} />
        </div>

        {/* Pourquoi Ghardaïa */}
        <div className="reveal reveal-streak hog-glow relative bg-bg3 border border-orange/12 mb-1 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(to right, #FF6B00, transparent)' }}/>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px]">
            <div className="p-9">
              <h3 className="font-display tracking-wide mb-4"
                style={{ fontSize: 'clamp(28px, 3.5vw, 44px)' }}>
                {copy.whyTitle.split(' ').slice(0, -1).join(' ')} <span className="text-orange">{copy.whyTitle.split(' ').slice(-1)[0]}</span>
              </h3>
              <p className="text-muted text-[18px] leading-[1.82] font-light">
                {copy.whyP1}
              </p>
              <p className="text-muted text-[18px] leading-[1.82] font-light mt-3">
                {copy.whyP2}
              </p>
            </div>
            <div className="border-t lg:border-t-0 lg:border-l border-orange/10 flex flex-row lg:flex-col">
              {copy.whyStats.map((st, i) => (
                <div key={i} className={`flex-1 flex flex-col items-center justify-center text-center py-5 px-4 hover:bg-orange/5 transition-colors duration-200
                  ${i < 2 ? 'border-r lg:border-r-0 lg:border-b border-orange/10' : ''}`}>
                  <span className="font-display text-orange leading-none block"
                    style={{ fontSize: st.v === 'UNESCO' ? '22px' : '34px', letterSpacing: '1px' }}>
                    {st.v}
                  </span>
                  <p className={`text-muted text-[11px] mt-1.5 ${lang === 'ar' ? '' : 'tracking-[0.2em] uppercase'}`}>{st.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4 Day cards */}
        <div className="reveal reveal-streak hog-glow grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px bg-white/5">
          {days.map((d, i) => (
            <div
              key={i}
              onClick={() => setActive(i)}
              className={`relative overflow-hidden p-7 cursor-pointer transition-all duration-300
                ${active === i
                  ? 'prog-day-active bg-bg4 border-b-2 border-orange'
                  : 'bg-bg2 border-b-2 border-transparent hover:bg-bg3'}`}
            >
              {/* Gros numéro fond */}
              <span className={`absolute top-2.5 right-3 font-display text-[80px] leading-none pointer-events-none select-none transition-colors duration-300
                ${active === i ? 'text-orange/[.09]' : 'text-orange/[.05]'}`}>
                {d.num}
              </span>

              <p className={`text-orange text-[11px] mb-2 ${lang === 'ar' ? '' : 'tracking-[0.25em] uppercase'}`}>{d.label}</p>
              <p className="font-condensed font-semibold text-[18px] leading-snug mb-1.5">{d.route}</p>
              <div className="flex items-baseline gap-1.5 mb-3.5">
                <span className="font-display text-orange text-[22px] leading-none">{d.km}</span>
                <span className="text-muted text-[12px] tracking-wide">KMS</span>
                <span className="text-muted2 text-[12px] tracking-wide ml-1">{d.type}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {d.acts.map((a, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <span className="block w-1 h-1 min-w-[4px] bg-orange mt-[5px] flex-shrink-0"/>
                    <span className={`text-[14px] leading-snug transition-colors duration-200
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
      <p className={`font-display text-[24px] tracking-[0.18em] ${highlight ? 'text-orange' : 'text-htext'}`}>{name}</p>
      <p className="text-muted text-[11px] tracking-[0.18em] uppercase">{sub}</p>
    </div>
  )
}

function RouteArrow({ km, label }: { km: number; label: string }) {
  return (
    <div className="relative z-10 flex flex-1 items-center gap-2 px-5">
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, #FF6B00, rgba(255,107,0,.2))' }}/>
      <div className="text-center flex-shrink-0">
        <p className="font-display text-orange text-[28px] leading-none">{km}</p>
        <p className="text-muted text-[11px] tracking-[0.18em] uppercase">{label}</p>
      </div>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, #FF6B00, rgba(255,107,0,.2))' }}/>
    </div>
  )
}
