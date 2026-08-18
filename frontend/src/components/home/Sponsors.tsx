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
]

export function OfficialCarrierStrip({ lang }: { lang: Lang }) {
  const label = t(lang, 'home.officialCarrier') as string

  return (
    <section className="sponsor-marquee" aria-label={label}>
      <div className="sponsor-marquee-track">
        {[0, 1].map((group) => (
          <div className="sponsor-marquee-group" aria-hidden={group === 1} key={group}>
            {[0, 1, 2].map((item) => (
              <div className="sponsor-marquee-item" key={item}>
                <Image
                  src="/sponsors/algerie_ferie_horizontal.png"
                  alt={group === 0 && item === 0 ? 'Algérie Ferries' : ''}
                  width={1268}
                  height={449}
                  className="sponsor-marquee-logo"
                />
                <span className="sponsor-marquee-dot" aria-hidden="true" />
                <span className="sponsor-marquee-label font-condensed">{label}</span>
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
                sizes="(max-width: 767px) 88vw, 30vw"
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
