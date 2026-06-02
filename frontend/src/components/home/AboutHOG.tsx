// src/components/home/AboutHOG.tsx
import Image from 'next/image'
import Link from 'next/link'
import type { Lang } from '@/i18n/shared'
import { t } from '@/i18n/messages'

export default function AboutHOG({ lang }: { lang: Lang }) {
  const isAr = lang === 'ar'

  return (
    <section id="about" className="bg-bg overflow-hidden py-4">
      <div className="mx-auto px-4 sm:px-8 md:px-14 lg:px-20" style={{ maxWidth: '1280px' }}>

        {/* ── Block 1 ── */}
        <div className={`reveal about-block grid lg:grid-cols-2 mb-1 min-h-[480px]`}>

          {/* Image gauche */}
          <div className={`relative min-h-[300px] lg:min-h-0 overflow-hidden ${isAr ? 'order-2' : ''}`}>
            <Image
              src="/images/about-hog.jpeg"
              alt="H.O.G. (Harley Owners Group)"
              fill priority
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover about-img-scale"
            />
            <div className="absolute inset-0 about-img-grade"/>
            <div className={`absolute inset-0 ${isAr ? 'about-img-fade-left' : 'about-img-fade-right'}`}/>
          </div>

          {/* Texte droite */}
          <div className={`relative flex flex-col justify-center px-8 md:px-12 py-14 ${isAr ? 'order-1 text-right' : ''}`}>
            <span className="about-block-num font-display" aria-hidden="true">01</span>
            <div className="relative z-10">
              <div className="section-tag">{t(lang, 'home.hog.tag1')}</div>
              <h2
                className="font-display tracking-wide mt-2 mb-6"
                style={{
                  fontSize: isAr ? 'clamp(24px, 3vw, 40px)' : 'clamp(36px, 4.5vw, 62px)',
                  lineHeight: isAr ? '1.35' : '0.92',
                }}
              >
                {t(lang, 'home.hog.title1a')}<br />
                <span className="text-orange">{t(lang, 'home.hog.title1b')}</span>
              </h2>
              <p className="text-muted text-[17px] leading-[1.85] font-light max-w-[440px]">
                {t(lang, 'home.hog.p1')}
              </p>
              <Link href="/about"
                className={`inline-flex items-center gap-2 font-condensed text-[13px] text-orange border-b border-orange/30 pb-1 mt-8 hover:border-orange hover:gap-3 transition-all duration-200 ${isAr ? '' : 'uppercase tracking-[0.18em]'}`}>
                {t(lang, 'home.hog.link1')} <span>→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Séparateur ── */}
        <div className="about-sep flex items-center gap-5 py-4">
          <div className="about-sep-line flex-1"/>
          <span className={`about-sep-label font-condensed ${isAr ? '' : 'uppercase tracking-[0.32em]'}`}>
            H.O.G. Algiers Chapter
          </span>
          <div className="about-sep-line flex-1"/>
        </div>

        {/* ── Block 2 ── */}
        <div className={`reveal reveal-d1 about-block grid lg:grid-cols-2 mt-1 min-h-[480px]`}>

          {/* Texte gauche */}
          <div className={`relative flex flex-col justify-center px-8 md:px-12 py-14 order-2 lg:order-1 ${isAr ? 'text-right order-1 lg:order-2' : ''}`}>
            <span className="about-block-num-left font-display" aria-hidden="true">02</span>
            <div className="relative z-10">
              <div className="section-tag">{t(lang, 'home.hog.tag2')}</div>
              <h2
                className="font-display tracking-wide mt-2 mb-6"
                style={{
                  fontSize: isAr ? 'clamp(24px, 3vw, 40px)' : 'clamp(36px, 4.5vw, 62px)',
                  lineHeight: isAr ? '1.35' : '0.92',
                }}
              >
                {t(lang, 'home.hog.title2a')}<br />
                <span className="text-orange">{t(lang, 'home.hog.title2b')}</span>
              </h2>
              <p className="text-muted text-[17px] leading-[1.85] font-light mb-4 max-w-[440px]">
                {t(lang, 'home.hog.p2a')}
              </p>
              <p className="text-muted text-[17px] leading-[1.85] font-light max-w-[440px]">
                {t(lang, 'home.hog.p2b')}
              </p>
              <div className={`mt-8 inline-flex items-center gap-3.5 border border-orange/12 bg-bg3 px-4 py-3.5 ${isAr ? 'flex-row-reverse' : ''}`}>
                <div className="w-[36px] h-[36px] bg-orange flex items-center justify-center flex-shrink-0">
                  <svg width="15" height="15" fill="none" stroke="#000" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                <div>
                  <p className={`text-muted text-[11px] ${isAr ? '' : 'tracking-[0.18em] uppercase'}`}>{t(lang, 'home.hog.badgeTitle')}</p>
                  <p className="font-condensed font-semibold text-[14px] mt-0.5">{t(lang, 'home.hog.badgeSub')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Image droite */}
          <div className={`relative min-h-[300px] lg:min-h-0 overflow-hidden order-1 lg:order-2 ${isAr ? 'order-2 lg:order-1' : ''}`}>
            <Image
              src="/images/about-hog-2.jpeg"
              alt="H.O.G. Algiers Chapter Algeria"
              fill
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover about-img-scale"
            />
            <div className="absolute inset-0 about-img-grade"/>
            <div className={`absolute inset-0 ${isAr ? 'about-img-fade-right' : 'about-img-fade-left'}`}/>
          </div>
        </div>

      </div>
    </section>
  )
}
