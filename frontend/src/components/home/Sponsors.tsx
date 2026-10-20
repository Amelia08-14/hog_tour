import Image from 'next/image'
import type { Lang } from '@/i18n/shared'
import { t } from '@/i18n/messages'

const sponsors = [
  {
    src: '/sponsors/_algerie_ferie%20logo%20.png',
    alt: 'Algérie Ferries',
    width: 1278,
    height: 889,
  },
  {
    src: '/sponsors/filiale%20algerie_ferie.png',
    alt: 'Groupe Algérien de Transport Maritime',
    width: 1336,
    height: 690,
  },
  {
    src: '/sponsors/vulcanet.png',
    alt: 'Vulcanet',
    width: 1336,
    height: 228,
  },
  {
    src: '/sponsors/logo_jsm.png',
    alt: 'JSM – Solution Smart Marketing & Com',
    width: 961,
    height: 630,
  },
  {
    src: '/sponsors/krosti.png',
    alt: 'Krosti',
    width: 702,
    height: 210,
  },
  {
    src: '/sponsors/cophyd.png',
    alt: 'COPHYD',
    width: 372,
    height: 210,
  },
]

export function OfficialCarrierStrip({ lang }: { lang: Lang }) {
  const carrier = t(lang, 'home.officialCarrier') as string
  const partner = t(lang, 'home.officialPartner') as string

  // Chaque partenaire porte son propre intitulé : « Transporteur Officiel »
  // appartient à Algérie Ferries, les autres sont partenaires du tour.
  const marquee = [
    {
      src: '/sponsors/algerie_ferie_horizontal.png',
      alt: 'Algérie Ferries',
      width: 1268,
      height: 449,
      label: carrier,
    },
    {
      src: '/sponsors/krosti.png',
      alt: 'Krosti',
      width: 702,
      height: 210,
      label: partner,
    },
    {
      src: '/sponsors/cophyd.png',
      alt: 'COPHYD',
      width: 372,
      height: 210,
      label: partner,
    },
  ]
  // La bande défile en translatant d'un groupe : chaque groupe doit être au
  // moins aussi large que l'écran, sinon un vide apparaît à droite.
  const pass = [...marquee, ...marquee]

  return (
    <section className="sponsor-marquee" aria-label={`${carrier} · ${partner}`}>
      <div className="sponsor-marquee-track">
        {[0, 1].map((group) => (
          <div className="sponsor-marquee-group" aria-hidden={group === 1} key={group}>
            {pass.map((sponsor, index) => (
              <div className="sponsor-marquee-item" key={`${sponsor.src}-${index}`}>
                <Image
                  src={sponsor.src}
                  alt={group === 0 && index < marquee.length ? sponsor.alt : ''}
                  width={sponsor.width}
                  height={sponsor.height}
                  className="sponsor-marquee-logo"
                />
                <span className="sponsor-marquee-dot" aria-hidden="true" />
                <span className="sponsor-marquee-label font-condensed">{sponsor.label}</span>
                <span className="sponsor-marquee-separator" aria-hidden="true">•</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

export function SponsorsSection({ lang }: { lang: Lang }) {
  const isAr = lang === 'ar'

  return (
    <section className="sponsors-section" aria-labelledby="sponsors-title">
      <div className="sponsors-glow" aria-hidden="true" />
      <div className={`sponsors-inner ${isAr ? 'text-right' : ''}`}>
        <div className="sponsors-heading">
          <div className="section-tag">{t(lang, 'home.sponsorsTag')}</div>
          <h2 id="sponsors-title" className="font-display sponsors-title">
            {t(lang, 'home.sponsorsTitle')}
          </h2>
        </div>

        <div className="sponsors-grid">
          {sponsors.map((sponsor) => (
            <article className="sponsor-card" key={sponsor.src}>
              <span className="sponsor-card-corner sponsor-card-corner-top" aria-hidden="true" />
              <Image
                src={sponsor.src}
                alt={sponsor.alt}
                width={sponsor.width}
                height={sponsor.height}
                sizes="(max-width: 767px) 88vw, 23vw"
                className="sponsor-card-logo"
              />
              <span className="sponsor-card-corner sponsor-card-corner-bottom" aria-hidden="true" />
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
