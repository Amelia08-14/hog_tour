import { Suspense } from 'react'
import PaiementClient from './PaiementClient'

export default function PaiementPage() {
  return (
    <Suspense
      fallback={(
        <section className="min-h-screen pt-[80px] pb-20 bg-bg">
          <div className="max-w-container mx-auto px-6 md:px-10 w-full">
            <p className="text-muted text-[14px]">Chargement…</p>
          </div>
        </section>
      )}
    >
      <PaiementClient />
    </Suspense>
  )
}
