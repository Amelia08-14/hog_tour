'use client'

import { useEffect, useMemo, useState } from 'react'

const PHOTO_COUNT = 30
const INITIAL_VISIBLE = 12
const DEFAULT_RATIO = 0.66

type Photo = { src: string; alt: string }

export default function Gallery() {
  const photos: Photo[] = useMemo(
    () =>
      Array.from({ length: PHOTO_COUNT }, (_, idx) => {
        const n = idx + 1
        const rawSrc = `/images/galeries/hogtour (${n}).jpeg`
        return { src: encodeURI(rawSrc), alt: `HOG Tour – Photo ${n}` }
      }),
    [],
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
        const w = img.naturalWidth || 1
        const h = img.naturalHeight || 1
        next[p.src] = h / w
        pending -= 1
        if (pending === 0 && !cancelled) setRatios(r => ({ ...r, ...next }))
      }
      img.onerror = () => {
        pending -= 1
        if (pending === 0 && !cancelled) setRatios(r => ({ ...r, ...next }))
      }
      img.src = p.src
    })

    return () => {
      cancelled = true
    }
  }, [photos, visibleCount])

  const layout = useMemo(() => {
    const items = photos.slice(0, visibleCount)
    const cols: Photo[][] = Array.from({ length: colsCount }, () => [])
    const heights = Array.from({ length: colsCount }, () => 0)

    items.forEach(p => {
      const ratio = ratios[p.src] ?? DEFAULT_RATIO
      let best = 0
      for (let c = 1; c < colsCount; c += 1) {
        if (heights[c] < heights[best]) best = c
      }
      cols[best].push(p)
      heights[best] += ratio
    })

    const maxH = heights.reduce((m, v) => (v > m ? v : m), 0)
    const fillers = heights.map(h => Math.max(0, maxH - h))

    return { cols, fillers }
  }, [photos, visibleCount, ratios, colsCount])

  return (
    <section className="bg-bg">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[3px]">
        {layout.cols.map((col, colIdx) => (
          <div key={colIdx} className="flex flex-col gap-[3px]">
            {col.map((p, i) => (
              <div
                key={p.src}
                className="group relative bg-bg3 border border-white/[.04] overflow-hidden cursor-pointer hover:border-orange/30 transition-colors duration-300"
              >
                <img
                  src={p.src}
                  alt={p.alt}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto transition-transform duration-700 ease-out group-hover:scale-[1.035]"
                />
                <div className="absolute inset-0 bg-orange/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" />
                <div
                  className="absolute inset-0 opacity-[.02]"
                  style={{ backgroundImage: 'repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(255,107,0,1) 10px,rgba(255,107,0,1) 11px)' }}
                />
                <div className="absolute left-4 bottom-4 text-muted2 text-[11px] tracking-[0.15em] uppercase opacity-0 group-hover:opacity-80 transition-opacity duration-300 z-10">
                  {p.alt}
                </div>
              </div>
            ))}
            {layout.fillers[colIdx] > 0.05 && (
              <div
                className="relative bg-bg3 border border-orange/12 overflow-hidden"
                style={{ paddingTop: `${layout.fillers[colIdx] * 100}%`, minHeight: 28 }}
              >
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(to right, rgba(255,107,0,.65), rgba(255,107,0,.05))' }} />
                <div
                  className="absolute inset-0 opacity-[.03]"
                  style={{ backgroundImage: 'repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(255,107,0,1) 10px,rgba(255,107,0,1) 11px)' }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-center pt-8">
        {visibleCount < PHOTO_COUNT ? (
          <button
            type="button"
            onClick={() => setVisibleCount(PHOTO_COUNT)}
            className="bg-orange text-black font-condensed font-extrabold text-[13px] tracking-[0.22em] uppercase px-8 py-3.5 hover:bg-white transition-colors"
          >
            Voir plus de photos
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setVisibleCount(INITIAL_VISIBLE)}
            className="bg-white/10 text-htext font-condensed font-extrabold text-[13px] tracking-[0.22em] uppercase px-8 py-3.5 hover:bg-white/15 transition-colors"
          >
            Réduire la galerie
          </button>
        )}
      </div>
    </section>
  )
}
