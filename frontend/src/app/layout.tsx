// src/app/layout.tsx
import type { Metadata } from 'next'
import { Barlow, Barlow_Condensed, Bebas_Neue, Noto_Kufi_Arabic, Noto_Sans_Arabic } from 'next/font/google'
import './globals.css'
import Shell from '@/components/Shell'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { dirForLang, normalizeLang } from '@/i18n/shared'

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

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-ar-body',
})

const notoKufiArabic = Noto_Kufi_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ar-display',
})

export const metadata: Metadata = {
  title: { default: 'Algeria H.O.G.® Tour 2026 Algeria', template: '%s | Algeria H.O.G.® Tour 2026' },
  description: "Première édition du HOG Tour en Algérie. Alger → Ghardaïa, 1 580 km, 4 jours. 29 oct — 1er nov 2026.",
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const lang = normalizeLang(cookieStore.get('hog_lang')?.value)
  const dir = dirForLang(lang)
  return (
    <html lang={lang} dir={dir}>
      <body
        suppressHydrationWarning
        className={`${bebasNeue.variable} ${barlow.variable} ${barlowCondensed.variable} ${notoSansArabic.variable} ${notoKufiArabic.variable}`}
      >
        <Shell lang={lang}>{children}</Shell>
      </body>
    </html>
  )
}
