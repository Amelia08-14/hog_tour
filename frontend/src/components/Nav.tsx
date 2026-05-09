'use client'
// src/components/Nav.tsx
import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/',           label: 'Accueil'         },
  { href: '/about',      label: 'A Propos'         },
  { href: '/hogtour',    label: 'H.O.G Tour 2026'  },
  { href: '/contact',    label: 'Contactez Nous'   },
]

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open,     setOpen]     = useState(false)
  const pathname = usePathname()
  const isHome   = pathname === '/'

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const solid = !isHome || scrolled

  return (
    <nav className={`
      fixed top-0 left-0 right-0 z-50
      flex items-center justify-between
      px-6 md:px-10 h-[72px]
      transition-all duration-500
      ${solid
        ? 'bg-bg/95 backdrop-blur-md border-b border-orange/10'
        : 'bg-transparent border-b border-transparent'}
    `}>

      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 flex-shrink-0">
        <div className="w-[48px] h-[48px] rounded-full border border-orange/40 bg-bg/60 backdrop-blur-sm flex items-center justify-center overflow-hidden hover:border-orange hover:shadow-[0_0_16px_rgba(255,107,0,0.2)] transition-all duration-200">
          <Image
            src="/images/hog-logo.png"
            alt="HOG Tour"
            width={32}
            height={32}
            className="object-contain"
            priority
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-orange text-[17px] tracking-[0.3em] leading-none">H.O.G Algeria</span>
          <span className="text-muted2 text-[10px] tracking-[0.2em] uppercase">Algiers Chapter</span>
        </div>
      </Link>

      {/* Desktop links */}
      <ul className="hidden lg:flex gap-8 list-none">
        {LINKS.map(l => (
          <li key={l.href}>
            <Link
              href={l.href}
              className={`text-[12.5px] tracking-[0.22em] uppercase transition-colors duration-200
                ${pathname === l.href ? 'text-orange' : 'text-white/60 hover:text-white'}`}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* Right */}
      <div className="flex items-center gap-4">

        {/* Lang */}
        <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-full border border-white/15 bg-bg/40 backdrop-blur-md">
          <a
            href="#"
            aria-current="true"
            className="px-2.5 py-1 rounded-full bg-orange text-black text-[11px] tracking-widest uppercase font-bold"
          >
            FR
          </a>
          <a
            href="#"
            className="px-2.5 py-1 rounded-full text-[11px] tracking-widest uppercase text-white/85 hover:text-orange hover:bg-white/5 transition-colors"
          >
            AR
          </a>
          <a
            href="#"
            className="px-2.5 py-1 rounded-full text-[11px] tracking-widest uppercase text-white/85 hover:text-orange hover:bg-white/5 transition-colors"
          >
            EN
          </a>
        </div>

        {/* CTA */}
        <Link
          href="/inscription"
          className="bg-orange text-black font-condensed font-bold text-[12px] tracking-[0.22em] uppercase px-5 py-2.5 hover:bg-white hover:-translate-y-0.5 transition-all duration-200 whitespace-nowrap"
        >
          Inscrivez Vous
        </Link>

        {/* Burger */}
        <button
          className="lg:hidden flex flex-col gap-[5px] p-1"
          onClick={() => setOpen(v => !v)}
          aria-label="Menu"
        >
          <span className={`block w-5 h-px bg-htext transition-all duration-300 ${open ? 'rotate-45 translate-y-[6px]' : ''}`}/>
          <span className={`block w-5 h-px bg-htext transition-all duration-300 ${open ? 'opacity-0' : ''}`}/>
          <span className={`block w-5 h-px bg-htext transition-all duration-300 ${open ? '-rotate-45 -translate-y-[6px]' : ''}`}/>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="absolute top-[72px] left-0 right-0 bg-bg/97 backdrop-blur-lg border-b border-orange/10 flex flex-col lg:hidden">
          {LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block px-6 py-4 text-muted text-[12px] tracking-[0.22em] uppercase border-b border-white/5 hover:text-orange hover:bg-bg3 transition-all duration-200"
            >
              {l.label}
            </Link>
          ))}
          <div className="px-6 py-4 border-b border-white/5">
            <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full border border-white/15 bg-bg/40 backdrop-blur-md">
              <a
                href="#"
                aria-current="true"
                className="px-3 py-1 rounded-full bg-orange text-black text-[12px] tracking-widest uppercase font-bold"
              >
                FR
              </a>
              <a
                href="#"
                className="px-3 py-1 rounded-full text-[12px] tracking-widest uppercase text-white/85 hover:text-orange hover:bg-white/5 transition-colors"
              >
                AR
              </a>
              <a
                href="#"
                className="px-3 py-1 rounded-full text-[12px] tracking-widest uppercase text-white/85 hover:text-orange hover:bg-white/5 transition-colors"
              >
                EN
              </a>
            </div>
          </div>
          <Link
            href="/inscription"
            onClick={() => setOpen(false)}
            className="mx-6 my-4 bg-orange text-black font-condensed font-bold text-[13px] tracking-[0.2em] uppercase py-3 text-center hover:bg-white transition-colors"
          >
            Inscrivez Vous
          </Link>
        </div>
      )}
    </nav>
  )
}
