import type { Metadata } from 'next'
import InscriptionClient from '@/app/inscription/InscriptionClient'
import { getLang } from '@/i18n/server'

export const metadata: Metadata = { title: 'Inscription' }

export default async function InscriptionPage() {
  const lang = await getLang()
  return <InscriptionClient lang={lang} />
}
