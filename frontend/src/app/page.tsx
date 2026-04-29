// src/app/page.tsx
import Hero      from '@/components/home/Hero'
import AboutHOG  from '@/components/home/AboutHOG'
import Programme from '@/components/home/Programme'
import Ticket    from '@/components/home/Ticket'
import Gallery   from '@/components/home/Gallery'

export default function HomePage() {
  return (
    <>
      <Hero />
      <AboutHOG />
      <Programme />
      <Ticket />
      <Gallery />
    </>
  )
}
