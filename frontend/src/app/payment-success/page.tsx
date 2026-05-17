import { Suspense } from 'react'
import PaymentSuccessClient from './PaymentSuccessClient'

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <section className="min-h-screen flex items-center justify-center bg-bg">
          <p className="text-muted text-[13px] uppercase tracking-[0.2em]">Chargement…</p>
        </section>
      }
    >
      <PaymentSuccessClient />
    </Suspense>
  )
}
