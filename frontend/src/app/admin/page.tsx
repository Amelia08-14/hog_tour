'use client'
import { useEffect, useMemo, useState, type FormEvent } from 'react'

type RegistrationListItem = {
  id: string
  created_at: string
  prenom: string
  nom: string
  email: string
  pays_iso2: string
  phone_country_iso2: string
  phone_number: string
  residence_zone?: string | null
  paiement_mode?: string | null
}

export default function AdminPage() {
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [items, setItems] = useState<RegistrationListItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [details, setDetails] = useState<any | null>(null)

  const apiBase = useMemo(() => {
    const v = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
    const base = v || (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : '')
    return base ? base.replace(/\/$/, '') : ''
  }, [])

  function apiUrl(path: string) {
    return apiBase ? `${apiBase}${path}` : path
  }

  async function checkSession() {
    try {
      const res = await fetch(apiUrl('/v1/admin/me'), { credentials: 'include' })
      if (!res.ok) return false
      const data = await res.json().catch(() => null)
      return Boolean(data && data.ok)
    } catch {
      return false
    }
  }

  async function loadList() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/v1/admin/registrations?limit=5000'), { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError("Impossible de récupérer les inscriptions.")
        return
      }
      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch {
      setError("Impossible de contacter le serveur.")
    } finally {
      setLoading(false)
    }
  }

  async function loadDetails(id: string) {
    setError(null)
    setSelectedId(id)
    setDetails(null)
    try {
      const res = await fetch(apiUrl(`/v1/admin/registrations/${encodeURIComponent(id)}`), { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError("Impossible de récupérer le détail.")
        return
      }
      setDetails(data)
    } catch {
      setError("Impossible de contacter le serveur.")
    }
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      const ok = await checkSession()
      if (!alive) return
      setAuthed(ok)
      setChecking(false)
      if (ok) loadList()
    })()
    return () => { alive = false }
  }, [])

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const form = e.currentTarget as HTMLFormElement
    const fd = new FormData(form)
    const username = String(fd.get('username') || '').trim()
    const password = String(fd.get('password') || '')
    if (!username || !password) {
      setError('Veuillez renseigner le login et le mot de passe.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(apiUrl('/v1/admin/login'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        setError('Identifiants invalides.')
        return
      }
      setAuthed(true)
      await loadList()
    } catch {
      setError("Impossible de contacter le serveur.")
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    setError(null)
    setLoading(true)
    try {
      await fetch(apiUrl('/v1/admin/logout'), {
        method: 'POST',
        credentials: 'include',
      })
      setAuthed(false)
      setItems([])
      setSelectedId(null)
      setDetails(null)
    } catch {
      setError("Impossible de contacter le serveur.")
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <section className="min-h-screen flex items-center pt-[120px] pb-20 bg-bg">
        <div className="max-w-container mx-auto px-6 md:px-10 w-full">
          <p className="text-muted text-[14px]">Chargement…</p>
        </div>
      </section>
    )
  }

  return (
    <section className="min-h-screen pt-[120px] pb-20 bg-bg">
      <div className="max-w-container mx-auto px-6 md:px-10 w-full">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="section-tag">Admin</div>
            <h1 className="font-display leading-[.88] tracking-wide mt-3" style={{ fontSize:'clamp(34px,4vw,56px)' }}>
              Inscriptions
            </h1>
          </div>
          {authed && (
            <button
              onClick={handleLogout}
              disabled={loading}
              className="bg-bg3 border border-orange/10 text-htext font-condensed font-bold text-[12px] tracking-[0.2em] uppercase px-6 py-3 hover:border-orange/30 transition-colors disabled:opacity-60"
            >
              Déconnexion
            </button>
          )}
        </div>

        {error && (
          <div className="mt-6 border border-orange/20 bg-bg3 px-5 py-4 text-[13px] text-orange">
            {error}
          </div>
        )}

        {!authed ? (
          <div className="mt-10 max-w-[520px] border border-orange/12 bg-bg3 p-8">
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div>
                <label htmlFor="username" className="block text-htext text-[14px] pb-2">Login</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  className="w-full bg-transparent border-b border-white/15 pb-3 pt-1 text-htext text-[18px] outline-none placeholder:text-muted focus:border-orange transition-colors duration-200"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-htext text-[14px] pb-2">Mot de passe</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  className="w-full bg-transparent border-b border-white/15 pb-3 pt-1 text-htext text-[18px] outline-none placeholder:text-muted focus:border-orange transition-colors duration-200"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="mt-2 bg-orange text-black font-condensed font-bold text-[13px] tracking-[0.2em] uppercase px-9 py-3.5 hover:bg-white transition-colors disabled:opacity-60"
              >
                {loading ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-10">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-muted text-[13px] tracking-[0.18em] uppercase">{items.length} inscription(s)</p>
              <button
                onClick={loadList}
                disabled={loading}
                className="bg-bg3 border border-orange/10 text-htext font-condensed font-bold text-[12px] tracking-[0.2em] uppercase px-6 py-3 hover:border-orange/30 transition-colors disabled:opacity-60"
              >
                {loading ? 'Actualisation…' : 'Actualiser'}
              </button>
            </div>

            <div className="mt-6 border border-orange/12 overflow-hidden">
              <div className="overflow-auto">
                <table className="min-w-[980px] w-full text-left">
                  <thead className="bg-bg3 border-b border-orange/10">
                    <tr className="text-muted text-[11px] tracking-[0.18em] uppercase">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Nom</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Téléphone</th>
                      <th className="px-4 py-3">Pays</th>
                      <th className="px-4 py-3">Résidence</th>
                      <th className="px-4 py-3">Paiement</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {items.map((r) => (
                      <tr key={r.id} className="text-htext text-[13px]">
                        <td className="px-4 py-3 whitespace-nowrap text-muted">{new Date(r.created_at).toLocaleString('fr-FR')}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{r.prenom} {r.nom}</td>
                        <td className="px-4 py-3">{r.email}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted">{r.phone_country_iso2} {r.phone_number}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted">{r.pays_iso2}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted">{r.residence_zone ?? ''}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted">{r.paiement_mode ?? ''}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => loadDetails(r.id)}
                            className="text-orange underline"
                          >
                            Voir
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!items.length && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-muted text-[13px]">
                          Aucune inscription trouvée.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedId && details && (
              <div className="mt-8 border border-orange/12 bg-bg3 p-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-muted text-[11px] tracking-[0.18em] uppercase">Détail</p>
                  <button onClick={() => { setSelectedId(null); setDetails(null) }} className="text-orange underline">
                    Fermer
                  </button>
                </div>
                <pre className="mt-4 whitespace-pre-wrap break-words text-[12px] text-htext">
                  {JSON.stringify(details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

