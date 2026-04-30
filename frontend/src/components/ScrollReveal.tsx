'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
export default function ScrollReveal() {
  const pathname = usePathname()
  useEffect(() => {
    const markVisible = (el: Element) => {
      el.classList.add('visible')
    }

    const scan = (io?: IntersectionObserver) => {
      document.querySelectorAll('.reveal').forEach(el => {
        if (el.classList.contains('visible')) return
        const r = (el as HTMLElement).getBoundingClientRect()
        const alreadyInView = r.top < window.innerHeight * 0.92 && r.bottom > 0
        if (alreadyInView) {
          markVisible(el)
          return
        }
        io?.observe(el)
      })
    }

    if (!('IntersectionObserver' in window)) {
      scan()
      return
    }

    const io = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (!e.isIntersecting) return
          markVisible(e.target)
          io.unobserve(e.target)
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -18% 0px' },
    )

    scan(io)

    let raf = 0
    const scheduleScan = () => {
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        scan(io)
      })
    }

    const mo = new MutationObserver(scheduleScan)
    mo.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('load', scheduleScan)

    return () => {
      window.removeEventListener('load', scheduleScan)
      if (raf) window.cancelAnimationFrame(raf)
      mo.disconnect()
      io.disconnect()
    }
  }, [pathname])
  return null
}
