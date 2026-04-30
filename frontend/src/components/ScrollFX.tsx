'use client'

import { useEffect } from 'react'

export default function ScrollFX() {
  useEffect(() => {
    let raf = 0
    let lastY = window.scrollY
    let lastT = performance.now()

    const tick = () => {
      raf = 0
      const y = window.scrollY
      const t = performance.now()
      const dt = Math.max(16, t - lastT)
      const v = (y - lastY) / dt

      document.documentElement.style.setProperty('--hog-scroll', String(y))
      document.documentElement.style.setProperty('--hog-vel', String(v))

      lastY = y
      lastT = t
    }

    const onScroll = () => {
      if (raf) return
      raf = window.requestAnimationFrame(tick)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  return null
}
