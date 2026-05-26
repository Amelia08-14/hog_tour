'use client'
import { useMemo, useState, useEffect, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'

type Info = {
  prenom: string
  nom: string
  hebergement: string
  residenceZone: string
  amountCents: number | null
  currency: string
  paymentStatus: string
  paymentMethod: string
}

type Step = 'accommodation' | 'payment'

const ACCOMMODATIONS = [
  {
    value: 'Chambre simple',
    labelDzd: '75 000 DA',
    labelEur: '480 €',
    desc: '1 personne — chambre individuelle',
  },
  {
    value: 'Chambre double — Motard',
    labelDzd: '65 000 DA / motard',
    labelEur: '400 € / motard',
    desc: '2 motards — chambre partagée',
  },
  {
    value: 'Chambre double couple',
    labelDzd: '125 000 DA',
    labelEur: '780 €',
    desc: '2 personnes en couple',
  },
]

function formatAmount(cents: number, currency: string) {
  if (currency === 'DZD') {
    return new Intl.NumberFormat('fr-DZ', { style: 'currency', currency: 'DZD', maximumFractionDigits: 0 }).format(cents / 100)
  }
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR' }).format(cents / 100)
}

export default function PaiementClient() {
  const sp = useSearchParams()
  const token = sp.get('token') || ''
  const paymentId = sp.get('paymentId') || ''
  const sig = sp.get('sig') || ''
  const isTestMode = sp.get('test') === '1'

  const [info, setInfo] = useState<Info | null>(null)
  const [infoError, setInfoError] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('accommodation')
  const [selectedAccommodation, setSelectedAccommodation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onSiteDone, setOnSiteDone] = useState(false)

  const apiBase = useMemo(() => {
    const v = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
    const base = v || (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : '')
    return base ? base.replace(/\/$/, '') : ''
  }, [])

  function apiUrl(path: string) {
    return apiBase ? `${apiBase}${path}` : path
  }

  const qs = useMemo(() => {
    if (token) return `token=${encodeURIComponent(token)}&sig=${encodeURIComponent(sig)}`
    if (paymentId) return `paymentId=${encodeURIComponent(paymentId)}&sig=${encodeURIComponent(sig)}`
    return ''
  }, [token, paymentId, sig])

  useEffect(() => {
    if (!qs) return
    fetch(apiUrl(`/v1/payments/info?${qs}`))
      .then(r => r.json())
      .then(data => {
        if (data.error) { setInfoError('Lien invalide ou expiré.'); return }
        const d = data as Info
        setInfo(d)
        if (d.hebergement && d.amountCents != null) {
          setSelectedAccommodation(d.hebergement)
          setStep('payment')
        }
      })
      .catch(() => setInfoError('Impossible de charger les informations.'))
  }, [qs])

  const isAilleurs = info?.residenceZone?.toLowerCase() === 'ailleurs'

  const accommodationOptions = useMemo(() => {
    const base = [...ACCOMMODATIONS]
    if (isTestMode) base.push({ value: 'Pack test', labelDzd: '1 DA', labelEur: '1 €', desc: 'Test — 1 unité' })
    return base
  }, [isTestMode])

  async function handleConfirmAccommodation(e: FormEvent) {
    e.preventDefault()
    if (!selectedAccommodation) { setError('Choisissez un hébergement.'); return }
    if (!paymentId || !sig) { setError('Lien de paiement invalide.'); return }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/v1/payments/choose-accommodation'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paymentId, sig, hebergement: selectedAccommodation }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(String(data?.message || data?.error || 'Erreur.')); return }
      setInfo(prev => prev ? {
        ...prev,
        hebergement: data.hebergement,
        amountCents: data.amountCents,
        currency: data.currency,
      } : prev)
      setStep('payment')
    } catch { setError('Impossible de contacter le serveur.') }
    finally { setLoading(false) }
  }

  async function handlePayOnline(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if ((!token && !paymentId) || !sig) { setError('Lien de paiement invalide.'); return }
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/v1/payments/yassir/start'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: token || undefined, paymentId: paymentId || undefined, sig, paymentMethodPreference: 'card' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(String(data?.message || data?.error || 'Paiement impossible.')); return }
      const redirectUrl = String(data?.redirectUrl || data?.paymentUrl || data?.url || '').trim()
      if (redirectUrl) window.location.href = redirectUrl
      else setError('Aucune URL de redirection reçue.')
    } catch { setError('Impossible de contacter le serveur.') }
    finally { setLoading(false) }
  }

  async function handlePayOnSite() {
    setError(null)
    if (!paymentId || !sig) { setError('Lien de paiement invalide.'); return }
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/v1/payments/choose-onsite'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paymentId, sig }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(String(data?.message || data?.error || 'Erreur.')); return }
      setOnSiteDone(true)
    } catch { setError('Impossible de contacter le serveur.') }
    finally { setLoading(false) }
  }

  if (onSiteDone) return (
    <section className="min-h-screen pt-[80px] pb-20 bg-bg flex items-center justify-center">
      <div className="max-w-[520px] w-full mx-auto px-6">
        <div className="border border-orange/12 bg-bg3 p-10 text-center">
          <div className="text-4xl mb-5" style={{ color: '#FF6B00' }}>✓</div>
          <h1 className="font-display text-htext uppercase tracking-wide mb-3" style={{ fontSize: 'clamp(20px,4vw,28px)' }}>
            Inscription confirmée
          </h1>
          <div style={{ height: 1, background: 'linear-gradient(to right,transparent,rgba(255,107,0,.3),transparent)', margin: '16px 0' }} />
          <p className="text-muted text-[14px] leading-relaxed">
            Vous avez choisi le <strong className="text-htext">paiement sur place</strong>.<br />
            Un email de confirmation avec votre badge vous a été envoyé. Réglez votre inscription lors de l&apos;événement.
          </p>
          <a href="/" className="inline-block mt-8 text-[11px] font-condensed font-bold uppercase tracking-[3px] text-orange/70 hover:text-orange transition-colors">
            Retour à l&apos;accueil →
          </a>
        </div>
      </div>
    </section>
  )

  return (
    <section className="min-h-screen pt-[80px] pb-20 bg-bg">
      <div className="max-w-container mx-auto px-6 md:px-10 w-full">
        <div className="section-tag">Paiement</div>
        <h1 className="font-display leading-[.88] tracking-wide mt-3" style={{ fontSize: 'clamp(34px,4vw,56px)' }}>
          {step === 'accommodation' ? 'Choix de l’hébergement' : isAilleurs ? 'Finaliser mon inscription' : 'Confirmer mon inscription'}
        </h1>

        {infoError && (
          <div className="mt-6 max-w-[560px] border border-orange/20 bg-bg3 px-5 py-4 text-[13px] text-orange">
            {infoError}
          </div>
        )}

        {error && (
          <div className="mt-4 max-w-[560px] border border-orange/20 bg-bg3 px-5 py-4 text-[13px] text-orange">
            {error}
          </div>
        )}

        {/* Step 1 — choose accommodation */}
        {step === 'accommodation' && (
          <form onSubmit={handleConfirmAccommodation} className="mt-8 max-w-[600px]">
            {info && (
              <p className="text-muted text-[13px] mb-6">
                Bonjour <span className="text-htext font-semibold">{info.prenom} {info.nom}</span> — choisissez votre hébergement pour voir le montant à régler.
              </p>
            )}
            <div className="flex flex-col gap-3">
              {accommodationOptions.map(opt => {
                const priceLabel = isAilleurs ? opt.labelEur : opt.labelDzd
                const selected = selectedAccommodation === opt.value
                return (
                  <label
                    key={opt.value}
                    onClick={() => setSelectedAccommodation(opt.value)}
                    className={`flex items-center justify-between gap-4 border px-5 py-4 cursor-pointer transition-all ${selected ? 'border-orange bg-bg3' : 'border-orange/12 bg-bg3 hover:border-orange/30'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-4 h-4 min-w-[16px] rounded-[3px] border flex items-center justify-center transition-all ${selected ? 'bg-orange border-orange' : 'bg-white/[.04] border-white/25'}`}>
                        {selected && <svg width="10" height="10" fill="none" stroke="#000" strokeWidth="2.5" viewBox="0 0 12 12"><polyline points="2 6 5 9 10 3" /></svg>}
                      </div>
                      <div>
                        <div className="text-htext text-[14px] font-semibold">{opt.value}</div>
                        <div className="text-muted text-[11px] mt-0.5">{opt.desc}</div>
                      </div>
                    </div>
                    <div className="text-orange font-bold text-[15px] tracking-wide whitespace-nowrap shrink-0">{priceLabel}</div>
                  </label>
                )
              })}
            </div>
            <button
              type="submit"
              disabled={loading || !selectedAccommodation}
              className="mt-6 w-full bg-orange text-black font-condensed font-bold text-[13px] tracking-[0.2em] uppercase px-9 py-4 hover:bg-white transition-colors disabled:opacity-60"
            >
              {loading ? 'Traitement…' : 'Confirmer mon choix →'}
            </button>
          </form>
        )}

        {/* Step 2 — payment */}
        {step === 'payment' && info && (
          <div className="mt-8 max-w-[560px]">
            {/* Recap */}
            <div className="border border-orange/12 bg-bg3 p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-5 h-px bg-orange/40" />
                <span className="text-[9px] uppercase tracking-[3px] text-orange/60">Récapitulatif</span>
                <div className="w-5 h-px bg-orange/40" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 border border-orange/8 bg-bg2 px-4 py-3">
                  <div className="text-[8px] uppercase tracking-[2px] text-muted mb-1">Participant</div>
                  <div className="text-[14px] font-semibold text-htext uppercase tracking-wide">{info.prenom} {info.nom}</div>
                </div>
                <div className="border border-orange/8 bg-bg2 px-4 py-3">
                  <div className="text-[8px] uppercase tracking-[2px] text-muted mb-1">Hébergement</div>
                  <div className="text-[13px] font-medium text-htext">{info.hebergement}</div>
                </div>
                <div className="border border-orange/8 bg-bg2 px-4 py-3">
                  <div className="text-[8px] uppercase tracking-[2px] text-muted mb-1">Montant</div>
                  <div className="text-[18px] font-bold text-orange tracking-wide">
                    {info.amountCents != null ? formatAmount(info.amountCents, info.currency) : '—'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep('accommodation')}
                className="mt-4 text-[11px] text-muted hover:text-htext transition-colors"
              >
                ← Modifier le choix d&apos;hébergement
              </button>
            </div>

            {/* Payment options */}
            {isAilleurs ? (
              <div className="border border-orange/12 bg-bg3 p-8">
                <p className="text-muted text-[13px] mb-6 leading-relaxed">
                  Choisissez votre mode de paiement pour finaliser votre inscription.
                </p>
                <div className="flex flex-col gap-4">
                  <form onSubmit={handlePayOnline}>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-orange text-black font-condensed font-bold text-[13px] tracking-[0.2em] uppercase px-9 py-4 hover:bg-white transition-colors disabled:opacity-60"
                    >
                      {loading ? 'Redirection…' : 'Payer en ligne — Carte bancaire (Yassir)'}
                    </button>
                  </form>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handlePayOnSite}
                    className="w-full bg-transparent border border-orange/30 text-htext font-condensed font-bold text-[13px] tracking-[0.2em] uppercase px-9 py-4 hover:border-orange/60 transition-colors disabled:opacity-60"
                  >
                    {loading ? 'Traitement…' : "Payer sur place lors de l'événement"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="border border-orange/12 bg-bg3 p-8">
                <p className="text-muted text-[13px] mb-2 leading-relaxed">
                  Règlement sur place lors de l&apos;événement — <strong className="text-htext">espèces uniquement</strong>.
                </p>
                <p className="text-muted text-[12px] mb-6">
                  Votre badge de participation vous sera envoyé par email à la confirmation.
                </p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handlePayOnSite}
                  className="w-full bg-orange text-black font-condensed font-bold text-[13px] tracking-[0.2em] uppercase px-9 py-4 hover:bg-white transition-colors disabled:opacity-60"
                >
                  {loading ? 'Traitement…' : 'Confirmer mon inscription'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
