'use client'

import { useEffect } from 'react'

export default function ScrollFX() {
  useEffect(() => {
    let raf = 0
    let lastY = window.scrollY
    let lastT = performance.now()
    let reduceMotion = false
    let parallaxEls: Array<{ el: HTMLElement; strength: number }> = []

    const clamp = (min: number, v: number, max: number) => Math.max(min, Math.min(max, v))

    const collectParallax = () => {
      parallaxEls = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]')).map(el => {
        const raw = el.getAttribute('data-parallax-strength')
        const strength = raw ? Number(raw) : 28
        return { el, strength: Number.isFinite(strength) ? strength : 28 }
      })
    }

    const tick = () => {
      raf = 0
      const y = window.scrollY
      const t = performance.now()
      const dt = Math.max(16, t - lastT)
      const v = (y - lastY) / dt
      const speed = Math.min(1, Math.abs(v) * 34)

      document.documentElement.style.setProperty('--hog-scroll', String(y))
      document.documentElement.style.setProperty('--hog-vel', String(v))
      document.documentElement.style.setProperty('--hog-speed', String(speed))

      if (!reduceMotion && parallaxEls.length) {
        const vh = window.innerHeight || 800
        for (const { el, strength } of parallaxEls) {
          const r = el.getBoundingClientRect()
          if (r.bottom < -80 || r.top > vh + 80) continue
          const center = r.top + r.height / 2
          const rel = (center - vh / 2) / vh
          const off = clamp(-1, rel, 1)
          const ty = off * -strength
          el.style.transform = `translate3d(0, ${ty.toFixed(2)}px, 0) scale(1.035)`
        }
      }

      lastY = y
      lastT = t
    }

    const onScroll = () => {
      if (raf) return
      raf = window.requestAnimationFrame(tick)
    }

    reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
    collectParallax()
    const mo = new MutationObserver(() => collectParallax())
    mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-parallax', 'data-parallax-strength'] })

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', () => {
      collectParallax()
      onScroll()
    })

    return () => {
      window.removeEventListener('scroll', onScroll)
      mo.disconnect()
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  return null
}
