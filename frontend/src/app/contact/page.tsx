import type { Metadata } from 'next'
import ContactClient from './ContactClient'
import { getLang } from '@/i18n/server'

export const metadata: Metadata = { title: 'Contact' }

export default async function ContactPage() {
  const lang = await getLang()
  return <ContactClient lang={lang} />
}
