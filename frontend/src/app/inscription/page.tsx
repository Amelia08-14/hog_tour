import type { Metadata } from 'next'
import Image from 'next/image'

export const metadata: Metadata = { title: 'Inscription' }

export default function InscriptionPage() {
  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(234,88,12,0.35)); }
          50%       { filter: drop-shadow(0 0 22px rgba(234,88,12,0.75)); }
        }
        .anim-logo  { animation: fadeInUp 0.7s ease both, pulseGlow 3s ease-in-out 0.8s infinite; }
        .anim-title { animation: fadeInUp 0.7s ease 0.25s both; }
        .anim-text  { animation: fadeInUp 0.7s ease 0.45s both; }
      `}</style>

      <section className="min-h-screen flex flex-col items-center justify-center bg-bg text-center px-6 pt-[80px]">
        <Image
          src="/images/logo-hogtour.png"
          alt="HOG Tour"
          width={140}
          height={140}
          className="anim-logo mb-8 mx-auto"
          priority
        />
        <h1
          className="anim-title font-display leading-[.88] tracking-wide"
          style={{ fontSize: 'clamp(30px,4vw,56px)' }}
        >
          Inscriptions momentanément fermées
        </h1>
        <p className="anim-text mt-6 max-w-xl text-[16px] leading-8 text-muted">
          Les inscriptions reprendront très bientôt. Restez branchés !
          Nous préparons la meilleure expérience pour vous.
        </p>
      </section>
    </>
  )
}
