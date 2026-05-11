// src/app/layout.tsx
import type { Metadata } from 'next'
import { Barlow, Barlow_Condensed, Bebas_Neue } from 'next/font/google'
import './globals.css'
import Shell from '@/components/Shell'
import type { ReactNode } from 'react'

const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-display',
})

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-body',
})

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-condensed',
})

export const metadata: Metadata = {
  title: { default: 'H.O.G Tour 2026 Algeria', template: '%s | H.O.G Tour 2026' },
  description: "Première édition du HOG Tour en Algérie. Alger → Ghardaïa, 1 580 km, 4 jours. 29 oct — 1er nov 2026.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body
        suppressHydrationWarning
        className={`${bebasNeue.variable} ${barlow.variable} ${barlowCondensed.variable}`}
      >
        <Shell>{children}</Shell>
      </body>
    </html>
  )
}
