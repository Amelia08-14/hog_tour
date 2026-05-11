'use client'
import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'

export default function PaiementClient() {
  const sp = useSearchParams()
  const token = sp.get('token') || ''
  const paymentId = sp.get('paymentId') || ''
  const sig = sp.get('sig') || ''

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any | null>(null)
  const [checked, setChecked] = useState<any | null>(null)

  const apiBase = useMemo(() => {
    const v = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
    const base = v || (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : '')
    return base ? base.replace(/\/$/, '') : ''
  }, [])

  function apiUrl(path: string) {
    return apiBase ? `${apiBase}${path}` : path
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    setChecked(null)

    if ((!token && !paymentId) || !sig) {
      setError("Lien de paiement invalide.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch(apiUrl('/v1/payments/yassir/start'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token: token || undefined,
          paymentId: paymentId || undefined,
          sig,
          paymentMethodPreference: 'card',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(String(data?.message || data?.error || 'Paiement impossible.'))
        return
      }
      setResult(data)
      const redirectUrl = String(data?.redirectUrl || data?.paymentUrl || data?.url || '').trim()
      if (redirectUrl) window.location.href = redirectUrl
    } catch {
      setError("Impossible de contacter le serveur.")
    } finally {
      setLoading(false)
    }
  }

  async function checkStatus() {
    setError(null)
    setLoading(true)
    try {
      const qs = token
        ? `token=${encodeURIComponent(token)}&sig=${encodeURIComponent(sig)}`
        : `paymentId=${encodeURIComponent(paymentId)}&sig=${encodeURIComponent(sig)}`
      const url = apiUrl(`/v1/payments/yassir/check?${qs}`)
      const res = await fetch(url)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(String(data?.message || data?.error || 'Vérification impossible.'))
        return
      }
      setChecked(data)
    } catch {
      setError("Impossible de contacter le serveur.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="min-h-screen pt-[80px] pb-20 bg-bg">
      <div className="max-w-container mx-auto px-6 md:px-10 w-full">
        <div className="section-tag">Paiement</div>
        <h1 className="font-display leading-[.88] tracking-wide mt-3" style={{ fontSize:'clamp(34px,4vw,56px)' }}>
          Paiement en ligne
        </h1>
        <p className="text-muted text-[13px] tracking-[0.18em] uppercase mt-4">
          Carte bancaire (Visa / Mastercard)
        </p>

        {error && (
          <div className="mt-6 border border-orange/20 bg-bg3 px-5 py-4 text-[13px] text-orange">
            {error}
          </div>
        )}

        {!result ? (
          <div className="mt-10 max-w-[560px] border border-orange/12 bg-bg3 p-8">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <button
                type="submit"
                disabled={loading}
                className="mt-2 bg-orange text-black font-condensed font-bold text-[13px] tracking-[0.2em] uppercase px-9 py-3.5 hover:bg-white transition-colors disabled:opacity-60"
              >
                {loading ? 'Redirection…' : 'Payer par carte'}
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-10 border border-orange/12 bg-bg3 p-8">
            <p className="font-display text-[24px] tracking-[0.18em] text-orange">Paiement envoyé</p>
            <p className="text-muted text-[14px] mt-2">Statut: {String(result?.payment?.status || 'pending')}</p>
            <div className="mt-6 flex items-center gap-3 flex-wrap">
              <button
                onClick={checkStatus}
                disabled={loading}
                className="bg-bg2 border border-orange/20 text-htext font-condensed font-bold text-[12px] tracking-[0.2em] uppercase px-7 py-3 hover:border-orange/40 transition-colors disabled:opacity-60"
              >
                Vérifier le statut
              </button>
              {checked && (
                <>
                  <span className="text-muted text-[13px]">
                    Statut actuel: {String(checked?.payment?.status || '')}
                  </span>
                  {typeof checked?.badge?.url === 'string' && checked.badge.url && (
                    <a className="text-orange underline text-[13px]" href={String(checked.badge.url)}>
                      Ouvrir le badge
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
