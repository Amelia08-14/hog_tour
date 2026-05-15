import type { Metadata } from 'next'
import InscriptionClient from '@/app/inscription/InscriptionClient'
import { getLang } from '@/i18n/server'

export const metadata: Metadata = { title: 'Inscription - Test Paiement' }

export default async function InscriptionTestPage() {
  const lang = await getLang()
  return <InscriptionClient lang={lang} />
}
