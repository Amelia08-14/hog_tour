'use client'
import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import ScrollReveal from '@/components/ScrollReveal'
import ScrollFX from '@/components/ScrollFX'

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || ''
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/')

  if (isAdmin) {
    return <main>{children}</main>
  }

  return (
    <>
      <div className="ambient-lights" aria-hidden="true" />
      <div className="ambient-illustration" aria-hidden="true">
        <svg viewBox="0 0 1600 900" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <g className="dune-a">
            <path
              d="M -80 820
                 C  110 758, 330 770, 562 812
                 S  948 892, 1188 808
                 S  1452 734, 1700 772"
              fill="none"
              stroke="#FF6B00"
              strokeWidth="1.0"
              strokeOpacity="0.28"
              strokeLinecap="round"
            />
          </g>
          <g className="dune-b">
            <path
              d="M -80 738
                 C  148 678, 365 692, 598 736
                 S  975 816, 1212 734
                 S  1460 660, 1700 698"
              fill="none"
              stroke="#FF6B00"
              strokeWidth="0.7"
              strokeOpacity="0.18"
              strokeLinecap="round"
            />
          </g>
          <g className="dune-c">
            <path
              d="M -80 655
                 C  195 592, 428 608, 668 652
                 S 1055 730, 1282 650
                 S  1490 580, 1700 618"
              fill="none"
              stroke="#FF6B00"
              strokeWidth="0.5"
              strokeOpacity="0.10"
              strokeLinecap="round"
            />
          </g>
          <g className="eagle-a">
            <path
              d="M 0,0
                 C -12,-12 -30,-10 -48,-4
                 C -30,-6 -12,-2 0,0
                 C 12,-2 30,-6 48,-4
                 C 30,-10 12,-12 0,0"
              fill="#FF6B00"
              opacity="0.80"
            />
            <path d="M -7,0 C -4,8 0,11 4,8 C 1,4 -1,4 -7,0 Z" fill="#FF6B00" opacity="0.70" />
          </g>
          <g className="eagle-b">
            <path
              d="M 0,0
                 C -8,-8 -20,-7 -32,-3
                 C -20,-4 -8,-1 0,0
                 C 8,-1 20,-4 32,-3
                 C 20,-7 8,-8 0,0"
              fill="#FF6B00"
              opacity="0.65"
            />
            <path d="M -5,0 C -3,6 0,8 3,6 C 1,3 -1,3 -5,0 Z" fill="#FF6B00" opacity="0.55" />
          </g>
        </svg>
      </div>
      <Nav />
      <main>{children}</main>
      <Footer />
      <ScrollReveal />
      <ScrollFX />
    </>
  )
}

