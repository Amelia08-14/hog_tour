import type { Metadata, Viewport } from 'next'
import CheckinApp from './CheckinApp'

// Application interne de l'équipe d'accueil : jamais indexée.
export const metadata: Metadata = {
  title: 'HOG Check-in',
  description: "Accueil des participants — HOG Algeria Tour 2026.",
  robots: { index: false, follow: false },
  manifest: '/checkin.webmanifest',
  appleWebApp: { capable: true, title: 'HOG Check-in', statusBarStyle: 'black-translucent' },
  icons: { icon: '/checkin/icon-192.png', apple: '/checkin/icon-180.png' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0A0A08',
}

export default function CheckinPage() {
  return <CheckinApp />
}
