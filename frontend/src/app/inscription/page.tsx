import type { Metadata } from 'next'
import { getLang } from '@/i18n/server'

export const metadata: Metadata = { title: 'Inscription' }

export default async function InscriptionPage() {
  const lang = await getLang()

  return (
    <section className="min-h-screen pt-[80px] pb-20 bg-bg">
      <div className="max-w-container mx-auto px-6 md:px-10 w-full">
        <div className="section-tag">Inscription</div>
        <h1 className="font-display leading-[.88] tracking-wide mt-3" style={{ fontSize: 'clamp(34px,4vw,56px)' }}>
          Inscriptions momentanément fermées
        </h1>
        <p className="mt-6 max-w-2xl text-[16px] leading-8 text-muted">
          Les inscriptions reprendront très bientôt. Restez branchés !
          Nous préparons la meilleure expérience pour vous.
        </p>
      </div>
    </section>
  )
}
