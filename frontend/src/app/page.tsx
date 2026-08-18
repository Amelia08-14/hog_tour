// src/app/page.tsx
import Hero      from '@/components/home/Hero'
import AboutHOG  from '@/components/home/AboutHOG'
import Programme from '@/components/home/Programme'
import Ticket    from '@/components/home/Ticket'
import Gallery   from '@/components/home/Gallery'
import { OfficialCarrierStrip, SponsorsSection } from '@/components/home/Sponsors'
import { getLang } from '@/i18n/server'

export default async function HomePage() {
  const lang = await getLang()
  return (
    <>
      <Hero lang={lang} />
      <OfficialCarrierStrip lang={lang} />
      <AboutHOG lang={lang} />
      <Programme lang={lang} />
      <Ticket lang={lang} />
      <SponsorsSection lang={lang} />
      <Gallery lang={lang} />
    </>
  )
}
