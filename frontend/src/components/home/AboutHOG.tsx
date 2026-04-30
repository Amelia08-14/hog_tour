// src/components/home/AboutHOG.tsx
import Image from 'next/image'
import Link from 'next/link'

export default function AboutHOG() {
  return (
    <section id="about" className="py-28 bg-bg">
      <div className="max-w-container mx-auto px-6 md:px-10">

        {/* Bloc 1 — LE H.O.G */}
        <div className="reveal reveal-streak grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Photo placeholder */}
          <div className="relative aspect-[4/3] bg-bg3 border border-orange/10 flex flex-col items-center justify-center gap-3 overflow-hidden">
            <Image
              src="/images/about-hog.jpeg"
              alt="H.O.G (Harley Owners Group)"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'linear-gradient(to right, rgba(5,3,1,.60) 0%, rgba(5,3,1,.20) 55%, rgba(5,3,1,.05) 100%)'
            }}/>
          </div>

          <div>
            <div className="section-tag">À Propos</div>
            <h2 className="font-display leading-[.93] tracking-wide mb-5"
              style={{ fontSize: 'clamp(36px, 4.5vw, 60px)' }}>
              Le H.O.G<br />
              <span className="text-orange">(Harley Owners Group)</span>
            </h2>
            <p className="text-muted text-[15px] leading-[1.82] font-light">
              Le Harley Owners Group ou H.O.G est un club créé par la firme Harley-Davidson
              pour rassembler les propriétaires de motos de la marque. Chaque concessionnaire
              possède un Chapter, subdivision du Harley Owners Group. Il existe plus d'un
              million de membres dans le monde entier.
            </p>
            <Link href="/about"
              className="inline-flex items-center gap-2 font-condensed text-[13px] tracking-[0.18em] uppercase text-orange border-b border-orange/30 pb-1 mt-6 hover:border-orange hover:gap-3 transition-all duration-200">
              En savoir plus <span>→</span>
            </Link>
          </div>
        </div>

        {/* Divider */}
        <div className="my-16 h-px bg-orange/10"/>

        {/* Bloc 2 — LE H.O.G ALGIERS CHAPTER ALGERIA */}
        <div className="reveal reveal-d1 reveal-streak grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1">
            <div className="section-tag">Notre Chapter</div>
            <h2 className="font-display leading-[.93] tracking-wide mb-5"
              style={{ fontSize: 'clamp(36px, 4.5vw, 60px)' }}>
              Le H.O.G Algiers<br />
              <span className="text-orange">Chapter Algeria</span>
            </h2>
            <p className="text-muted text-[15px] leading-[1.82] font-light mb-4">
              Créé le <strong className="text-htext font-medium">15 Mai 2013</strong>, le H.O.G Algiers
              Chapter Algeria est le club accrédité par Harley-Davidson en Algérie sous le numéro{' '}
              <strong className="text-orange font-medium">#8062</strong>. Le club réunit les
              propriétaires de motos Harley-Davidson passionnés, organisés autour de balades,
              stages de conduite, évènements et actions caritatives.
            </p>
            <p className="text-muted text-[15px] leading-[1.82] font-light">
              Depuis <strong className="text-htext font-medium">2023</strong>, co-organisateur
              du plus grand événement motocycle en Algérie :{' '}
              <strong className="text-orange font-medium">Algeria Bike Week</strong>.
            </p>
            {/* Badge accréditation */}
            <div className="mt-8 inline-flex items-center gap-3.5 border border-orange/12 bg-bg3 p-3.5">
              <div className="w-[42px] h-[42px] bg-orange flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" fill="none" stroke="#000" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <div>
                <p className="text-muted text-[9.5px] tracking-[0.18em] uppercase">Chapter Officiel Harley-Davidson</p>
                <p className="font-condensed font-semibold text-[14px] mt-0.5">Accréditation internationale #8062 · Depuis 2013</p>
              </div>
            </div>
          </div>

          {/* Photo */}
          <div className="order-1 lg:order-2 relative aspect-[4/3] bg-bg3 border border-orange/10 flex flex-col items-center justify-center gap-3 overflow-hidden">
            <Image
              src="/images/about-hog-2.jpeg"
              alt="H.O.G Algiers Chapter Algeria"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'linear-gradient(to left, rgba(5,3,1,.55) 0%, rgba(5,3,1,.18) 55%, rgba(5,3,1,.05) 100%)'
            }}/>
          </div>
        </div>

      </div>
    </section>
  )
}
