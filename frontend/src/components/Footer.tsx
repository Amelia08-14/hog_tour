// src/components/Footer.tsx
import Link from 'next/link'

const ITEMS = ['HOG TOUR 2026','ALGIERS CHAPTER ALGERIA','PREMIÈRE FOIS EN ALGÉRIE','29 OCT — 1ER NOV','HARLEY-DAVIDSON','ALGERIA BIKE WEEK']

export default function Footer() {
  return (
    <footer className="bg-bg2 border-t border-orange/10 overflow-hidden">

      {/* Ticker géant */}
      <div className="overflow-hidden py-5 border-b border-orange/10">
        <div className="flex whitespace-nowrap ticker-track">
          {[...ITEMS, ...ITEMS].map((item, i) => (
            <span key={i} className="font-display text-orange/15 px-8 inline-block tracking-[0.25em]"
              style={{ fontSize: 'clamp(40px, 7vw, 90px)' }}>
              {i > 0 && <span className="text-orange/8 mr-8">◆</span>}
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Contact bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 px-6 md:px-10 py-5 border-b border-orange/10">
        <div className="flex items-center gap-4 flex-wrap">
          <a href="mailto:contact@hogalgierschapteralgeria.com"
            className="text-muted text-[13px] hover:text-orange transition-colors duration-200">
            contact@hogalgierschapteralgeria.com
          </a>
          <span className="text-muted2 hidden sm:inline">·</span>
          <a href="tel:+213774318751"
            className="text-muted text-[13px] hover:text-orange transition-colors duration-200">
            +213 774 31 87 51
          </a>
        </div>
        <div className="flex gap-2">
          {[
            { label: 'Fb', href: 'https://www.facebook.com/profile.php?id=61581997936557',
              icon: <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" fill="currentColor"/> },
            { label: 'Ig', href: 'https://www.instagram.com/hogalgierschapteralgeria/',
              icon: <><rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" fill="none" stroke="currentColor" strokeWidth="2"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke="currentColor" strokeWidth="2"/></> },
            { label: 'Yt', href: 'https://www.youtube.com/@HOGAlgiersChapterAlgeria',
              icon: <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z M9.75 15.02l5.75-3.02-5.75-3.02v6.04z" fill="currentColor"/> },
          ].map(s => (
            <a key={s.label} href={s.href} target="_blank" rel="noreferrer"
              className="w-[38px] h-[38px] bg-orange text-black flex items-center justify-center hover:bg-white hover:-translate-y-0.5 transition-all duration-200">
              <svg width="16" height="16" viewBox="0 0 24 24">{s.icon}</svg>
            </a>
          ))}
        </div>
      </div>

      {/* Copyright */}
      <div className="px-6 md:px-10 py-4 text-center text-muted2 text-[12px]">
        H.O.G ALGIERS CHAPTER ALGERIA © Développé par{' '}
        <a href="https://linkedin.com/in/amel-benelhadj" className="text-orange hover:text-white transition-colors duration-200 font-medium">
          Amélia Benelhadj
        </a>{' '}
        2026. Tous Droits Réservés
      </div>
    </footer>
  )
}
