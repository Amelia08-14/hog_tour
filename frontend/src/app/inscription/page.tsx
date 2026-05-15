import type { Metadata } from 'next'
import Link from 'next/link'
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
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Link
            href="/inscription/test"
            className="inline-flex items-center justify-center rounded-full bg-orange px-8 py-3 text-[13px] font-bold uppercase tracking-[0.2em] text-black transition hover:bg-white"
          >
            Accéder au test de paiement
          </Link>
          <Link
            href="/paiement"
            className="inline-flex items-center justify-center rounded-full border border-orange/20 bg-bg3 px-8 py-3 text-[13px] font-bold uppercase tracking-[0.2em] text-orange transition hover:bg-orange/10"
          >
            Page de paiement dédiée
          </Link>
        </div>
      </div>
    </section>
  )
}
