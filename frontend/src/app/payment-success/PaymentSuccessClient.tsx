'use client'
import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'

type State = 'loading' | 'paid' | 'pending' | 'failed'

export default function PaymentSuccessClient() {
  const sp = useSearchParams()
  // Yassir redirige avec statusCode (2=payé, 3=échec). Ancien param status conservé en secours.
  const urlStatusCode = sp.get('statusCode') || ''
  const urlStatus = sp.get('status') || ''
  const yassirRef = sp.get('paymentId') || ''
  const internalId = sp.get('internalId') || ''

  // Indice d'affichage uniquement — le statut réel vient de checkIntent/webhook côté backend
  const codeHint: '' | 'paid' | 'failed' =
    urlStatusCode === '2' ? 'paid'
    : urlStatusCode === '3' ? 'failed'
    : urlStatus === 'success' ? 'paid'
    : urlStatus === 'failed' || urlStatus === 'cancelled' ? 'failed'
    : ''

  const [state, setState] = useState<State>('loading')
  const [badgeUrl, setBadgeUrl] = useState<string | null>(null)

  const apiBase = useMemo(() => {
    const v = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
    return (v || (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : '')).replace(/\/$/, '')
  }, [])

  useEffect(() => {
    const lookupParam = internalId
      ? `internalId=${encodeURIComponent(internalId)}`
      : yassirRef ? `ref=${encodeURIComponent(yassirRef)}` : ''
    if (!lookupParam) {
      setState(codeHint === 'failed' ? 'failed' : codeHint === 'paid' ? 'pending' : 'pending')
      return
    }
    fetch(`${apiBase}/v1/payments/yassir/result?${lookupParam}`)
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        const s = data.payment?.status
        if (s === 'paid') {
          setBadgeUrl(data.badgeUrl || null)
          setState('paid')
        } else if (s === 'cancelled' || codeHint === 'failed') {
          // checkIntent confirme l'échec, ou Yassir a redirigé avec statusCode=3
          setState('failed')
        } else {
          // Paiement en cours — le webhook confirmera et enverra le badge par email
          setState('pending')
        }
      })
      .catch(() => setState(codeHint === 'failed' ? 'failed' : 'pending'))
  }, [yassirRef, internalId, codeHint, apiBase])

  if (state === 'loading') return <Screen icon="⟳" title="Vérification…" muted="Confirmation du paiement en cours." />

  if (state === 'paid') return (
    <Screen
      icon="✓"
      iconColor="#FF6B00"
      title="Paiement confirmé"
      muted={badgeUrl
        ? "Votre inscription au H.O.G Tour 2026 est validée. Un email de confirmation vous a été envoyé."
        : "Votre paiement est confirmé. Votre badge de participation vous sera envoyé par email dans quelques instants."}
      cta={badgeUrl ? { label: 'ACCÉDER À MON BADGE', href: badgeUrl } : undefined}
    />
  )

  if (state === 'failed') return (
    <Screen
      icon="✕"
      iconColor="rgba(255,80,80,.8)"
      title="Paiement échoué"
      muted="Le paiement n'a pas abouti. Vous pouvez réessayer depuis votre email d'inscription."
      cta={{ label: 'RETOUR À L\'ACCUEIL', href: '/' }}
    />
  )

  return (
    <Screen
      icon="◎"
      iconColor="rgba(255,107,0,.7)"
      title="Paiement en attente"
      muted="Votre paiement est en cours de traitement. Vous recevrez un email de confirmation dès validation."
      cta={{ label: 'RETOUR À L\'ACCUEIL', href: '/' }}
    />
  )
}

function Screen({ icon, iconColor, title, muted, cta }: {
  icon: string
  iconColor?: string
  title: string
  muted: string
  cta?: { label: string; href: string }
}) {
  return (
    <section className="min-h-screen flex items-center justify-center bg-bg relative overflow-hidden px-6">
      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(600px 400px at 50% 40%, rgba(255,107,0,.10) 0%, transparent 70%)',
      }} />
      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'repeating-linear-gradient(90deg,rgba(255,107,0,.03) 0 1px,transparent 1px 60px),repeating-linear-gradient(0deg,rgba(255,107,0,.03) 0 1px,transparent 1px 60px)',
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 80%)',
      }} />

      <div className="relative z-10 w-full max-w-md text-center">
        {/* Corner accents */}
        <div className="relative inline-block w-full">
          <div style={{
            position: 'absolute', inset: 0,
            background: [
              'linear-gradient(#FF6B00,#FF6B00) top left / 28px 1px no-repeat',
              'linear-gradient(#FF6B00,#FF6B00) top left / 1px 28px no-repeat',
              'linear-gradient(#FF6B00,#FF6B00) top right / 28px 1px no-repeat',
              'linear-gradient(#FF6B00,#FF6B00) top right / 1px 28px no-repeat',
              'linear-gradient(#FF6B00,#FF6B00) bottom left / 28px 1px no-repeat',
              'linear-gradient(#FF6B00,#FF6B00) bottom left / 1px 28px no-repeat',
              'linear-gradient(#FF6B00,#FF6B00) bottom right / 28px 1px no-repeat',
              'linear-gradient(#FF6B00,#FF6B00) bottom right / 1px 28px no-repeat',
            ].join(','),
            opacity: 0.4,
            pointerEvents: 'none',
            zIndex: 2,
          }} />

          <div className="border border-orange/10 bg-bg2 px-8 py-12">
            {/* Eyebrow */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="w-6 h-px bg-orange/50" />
              <span className="text-orange/70 text-[9px] uppercase tracking-[0.4em]">H.O.G Tour 2026</span>
              <div className="w-6 h-px bg-orange/50" />
            </div>

            {/* Icon */}
            <div className="text-5xl mb-6 leading-none" style={{ color: iconColor || 'rgba(255,255,255,.3)' }}>
              {icon}
            </div>

            {/* Title */}
            <h1 className="font-display text-htext mb-4 uppercase tracking-wide" style={{ fontSize: 'clamp(22px,4vw,32px)', lineHeight: 1 }}>
              {title}
            </h1>

            {/* Divider */}
            <div style={{ height: 1, background: 'linear-gradient(to right,transparent,rgba(255,107,0,.3),transparent)', margin: '20px 0' }} />

            {/* Message */}
            <p className="text-muted text-[14px] leading-relaxed mb-8">{muted}</p>

            {/* CTA */}
            {cta && (
              <a
                href={cta.href}
                className="inline-flex items-center gap-3 font-condensed font-extrabold uppercase text-[11px] transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background: '#FF6B00', color: '#000',
                  padding: '14px 32px',
                  letterSpacing: '3px',
                  boxShadow: '0 0 28px rgba(255,107,0,.35)',
                }}
              >
                {cta.label}
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
