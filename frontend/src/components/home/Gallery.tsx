'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Lang } from '@/i18n/shared'
import { t } from '@/i18n/messages'

const PHOTO_COUNT = 30
const INITIAL_VISIBLE = 12
const DEFAULT_RATIO = 0.66

type Photo = { src: string; alt: string }

export default function Gallery({ lang }: { lang: Lang }) {
  const isAr = lang === 'ar'

  const photos: Photo[] = useMemo(
    () =>
      Array.from({ length: PHOTO_COUNT }, (_, idx) => {
        const n = idx + 1
        const rawSrc = `/images/galeries/hogtour (${n}).jpeg`
        const label = lang === 'en' ? `HOG Tour – Photo ${n}` : lang === 'ar' ? `HOG Tour – صورة ${n}` : `HOG Tour – Photo ${n}`
        return { src: encodeURI(rawSrc), alt: label }
      }),
    [lang],
  )

  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)
  const [ratios, setRatios] = useState<Record<string, number>>({})
  const [colsCount, setColsCount] = useState(3)

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth
      setColsCount(w >= 1024 ? 3 : w >= 640 ? 2 : 1)
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  useEffect(() => {
    const list = photos.slice(0, visibleCount)
    let cancelled = false
    const next: Record<string, number> = {}
    let pending = list.length
    if (!pending) return
    list.forEach(p => {
      const img = new window.Image()
      img.decoding = 'async'
      img.loading = 'eager'
      img.onload = () => {
        if (cancelled) return
        next[p.src] = (img.naturalHeight || 1) / (img.naturalWidth || 1)
        pending -= 1
        if (pending === 0 && !cancelled) setRatios(r => ({ ...r, ...next }))
      }
      img.onerror = () => {
        pending -= 1
        if (pending === 0 && !cancelled) setRatios(r => ({ ...r, ...next }))
      }
      img.src = p.src
    })
    return () => { cancelled = true }
  }, [photos, visibleCount])

  const layout = useMemo(() => {
    const items = photos.slice(0, visibleCount)
    const cols: Photo[][] = Array.from({ length: colsCount }, () => [])
    const heights = Array.from({ length: colsCount }, () => 0)
    items.forEach(p => {
      const ratio = ratios[p.src] ?? DEFAULT_RATIO
      let best = 0
      for (let c = 1; c < colsCount; c++) if (heights[c] < heights[best]) best = c
      cols[best].push(p)
      heights[best] += ratio
    })
    const maxH = heights.reduce((m, v) => (v > m ? v : m), 0)
    return { cols, fillers: heights.map(h => Math.max(0, maxH - h)) }
  }, [photos, visibleCount, ratios, colsCount])

  return (
    <section className="bg-bg">

      {/* ── Header ── */}
      <div className={`relative overflow-hidden py-20 px-6 md:px-10 ${isAr ? 'text-right' : ''}`}>
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(800px 400px at 50% 50%, rgba(255,107,0,.07) 0%, transparent 70%)',
        }}/>
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <span className="font-display select-none" style={{
            fontSize: 'clamp(80px, 18vw, 200px)',
            color: 'transparent',
            WebkitTextStroke: '1px rgba(255,107,0,.05)',
            letterSpacing: '0.2em',
            whiteSpace: 'nowrap',
          }} aria-hidden="true">GALLERY</span>
        </div>

        <div className="relative z-10 max-w-container mx-auto">
          <div className="section-tag">{t(lang, 'home.galleryTag')}</div>
          <h2
            className="font-display leading-[.92] tracking-wide mt-2"
            style={{ fontSize: 'clamp(42px, 5.5vw, 72px)' }}
          >
            {t(lang, 'home.galleryTitle')}
          </h2>
          <p className="text-muted mt-4 text-[16px] leading-relaxed font-light max-w-[480px]">
            {lang === 'ar'
              ? 'لحظات لا تُنسى من رحلة هارلي ديفيدسون عبر الجزائر'
              : lang === 'en'
              ? 'Unforgettable moments from the Harley-Davidson journey across Algeria.'
              : 'Des instants inoubliables de l\'aventure Harley-Davidson à travers l\'Algérie.'}
          </p>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[3px]">
        {layout.cols.map((col, colIdx) => (
          <div key={colIdx} className="flex flex-col gap-[3px]">
            {col.map((p) => (
              <div
                key={p.src}
                className="group relative bg-bg3 overflow-hidden cursor-pointer"
              >
                <img
                  src={p.src}
                  alt={p.alt}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
                  style={{ background: 'linear-gradient(to top, rgba(255,107,0,.22) 0%, transparent 50%)' }}
                />
                {/* Caption */}
                <div className="absolute bottom-0 left-0 right-0 px-4 py-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-10"
                  style={{ background: 'linear-gradient(to top, rgba(10,10,8,.85) 0%, transparent 100%)' }}>
                  <span className={`text-muted2 text-[11px] ${isAr ? '' : 'tracking-[0.15em] uppercase'}`}>{p.alt}</span>
                </div>
              </div>
            ))}
            {layout.fillers[colIdx] > 0.05 && (
              <div
                className="relative bg-bg3 overflow-hidden"
                style={{ paddingTop: `${layout.fillers[colIdx] * 100}%`, minHeight: 28 }}
              >
                <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right, rgba(255,107,0,.5), rgba(255,107,0,.05))' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Controls ── */}
      <div className="flex justify-center pt-10 pb-6">
        {visibleCount < PHOTO_COUNT ? (
          <button
            type="button"
            onClick={() => setVisibleCount(PHOTO_COUNT)}
            className={`bg-orange text-black font-condensed font-extrabold text-[13px] px-10 py-4 hover:bg-white transition-all duration-200 hover:-translate-y-0.5 ${isAr ? '' : 'tracking-[0.22em] uppercase'}`}
            style={{ boxShadow: '0 0 28px rgba(255,107,0,.3)' }}
          >
            {t(lang, 'home.galleryMore')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setVisibleCount(INITIAL_VISIBLE)}
            className={`bg-white/8 text-htext font-condensed font-extrabold text-[13px] px-10 py-4 hover:bg-white/12 transition-colors duration-200 border border-white/10 ${isAr ? '' : 'tracking-[0.22em] uppercase'}`}
          >
            {t(lang, 'home.galleryLess')}
          </button>
        )}
      </div>
    </section>
  )
}
