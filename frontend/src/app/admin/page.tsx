'use client'
import { useEffect, useMemo, useState, type FormEvent } from 'react'

type RegistrationRow = Record<string, any> & { id: string; created_at: string }

type RegistrationDetails = {
  registration: Record<string, any>
  payment: Record<string, any> | null
  badge: { id: string; issuedAt: string; badgeUrl: string | null; qrUrl: string | null } | null
  files: Array<{ id: string; originalName: string; mime: string; sizeBytes: number; createdAt: string; downloadUrl: string }>
}

const COLUMNS: Array<{ key: string; label: string }> = [
  { key: 'created_at', label: 'Date création' },
  { key: 'updated_at', label: 'Dernière mise à jour' },
  { key: 'prenom', label: 'Prénom' },
  { key: 'nom', label: 'Nom' },
  { key: 'sexe', label: 'Sexe' },
  { key: 'adresse', label: 'Adresse' },
  { key: 'ville', label: 'Ville' },
  { key: 'pays_iso2', label: 'Pays' },
  { key: 'phone_country_iso2', label: 'Indicatif' },
  { key: 'phone_number', label: 'Téléphone' },
  { key: 'email', label: 'Email' },
  { key: 'nationalite', label: 'Nationalité' },
  { key: 'nationalite_autre', label: 'Nationalité (autre)' },
  { key: 'residence_zone', label: 'Résidence' },
  { key: 'profil', label: 'Profil' },
  { key: 'profil_groupe', label: 'Groupe' },
  { key: 'hebergement', label: 'Hébergement' },
  { key: 'taille_tshirt', label: 'T-shirt' },
  { key: 'paiement_mode', label: 'Paiement (mode)' },
  { key: 'permis_num', label: 'Permis' },
  { key: 'immatriculation', label: 'Immatriculation' },
  { key: 'passport_num', label: 'Passeport' },
  { key: 'payment_status', label: 'Paiement (statut)' },
  { key: 'payment_amount_cents', label: 'Paiement (montant cents)' },
  { key: 'payment_currency', label: 'Paiement (devise)' },
  { key: 'payment_method', label: 'Paiement (méthode)' },
  { key: 'payment_reference', label: 'Paiement (référence)' },
  { key: 'payment_updated_at', label: 'Paiement (date)' },
  { key: 'files_count', label: 'Fichiers' },
]

function fmtDate(v: any) {
  const s = String(v || '')
  if (!s) return ''
  const d = new Date(s)
  if (!Number.isFinite(d.getTime())) return s
  return d.toLocaleString('fr-FR')
}

function fmtCell(key: string, value: any) {
  if (value == null) return ''
  if (key === 'created_at' || key === 'updated_at' || key === 'payment_updated_at') return fmtDate(value)
  return String(value)
}

function toCsv(rows: RegistrationRow[]) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const header = COLUMNS.map(c => esc(c.label)).join(',')
  const lines = rows.map(r => COLUMNS.map(c => esc(fmtCell(c.key, (r as any)[c.key]))).join(','))
  return [header, ...lines].join('\n')
}

export default function AdminPage() {
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const [items, setItems] = useState<RegistrationRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [details, setDetails] = useState<RegistrationDetails | null>(null)

  const apiBase = useMemo(() => {
    const v = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
    const base = v || (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : '')
    return base ? base.replace(/\/$/, '') : ''
  }, [])

  function apiUrl(path: string) {
    return apiBase ? `${apiBase}${path}` : path
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return items
    const keys = ['prenom', 'nom', 'email', 'phone_number', 'passport_num', 'immatriculation', 'permis_num']
    return items.filter(r => keys.some(k => String((r as any)[k] || '').toLowerCase().includes(s)))
  }, [items, q])

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
      setDetails(data as RegistrationDetails)
    } catch {
      setError("Impossible de contacter le serveur.")
    }
  }

  function downloadCsv() {
    const content = toCsv(filtered)
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inscriptions-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
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
      <section className="min-h-screen flex items-center pt-[60px] pb-20 bg-bg">
        <div className="max-w-container mx-auto px-6 md:px-10 w-full">
          <p className="text-muted text-[14px]">Chargement…</p>
        </div>
      </section>
    )
  }

  return (
    <section className="min-h-screen pt-[60px] pb-20 bg-bg">
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
              <p className="text-muted text-[13px] tracking-[0.18em] uppercase">{filtered.length} inscription(s)</p>
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Recherche (nom, email, téléphone…)…"
                  className="bg-bg3 border border-orange/10 text-htext text-[13px] px-4 py-3 outline-none focus:border-orange/30 w-[280px]"
                />
                <button
                  onClick={downloadCsv}
                  disabled={loading || !filtered.length}
                  className="bg-bg3 border border-orange/10 text-htext font-condensed font-bold text-[12px] tracking-[0.2em] uppercase px-6 py-3 hover:border-orange/30 transition-colors disabled:opacity-60"
                >
                  Export CSV
                </button>
                <button
                  onClick={loadList}
                  disabled={loading}
                  className="bg-bg3 border border-orange/10 text-htext font-condensed font-bold text-[12px] tracking-[0.2em] uppercase px-6 py-3 hover:border-orange/30 transition-colors disabled:opacity-60"
                >
                  {loading ? 'Actualisation…' : 'Actualiser'}
                </button>
              </div>
            </div>

            <div className="mt-6 border border-orange/12 overflow-hidden">
              <div className="overflow-auto">
                <table className="min-w-[1700px] w-full text-left">
                  <thead className="bg-bg3 border-b border-orange/10">
                    <tr className="text-muted text-[11px] tracking-[0.18em] uppercase">
                      {COLUMNS.map(c => (
                        <th key={c.key} className="px-4 py-3 whitespace-nowrap">{c.label}</th>
                      ))}
                      <th className="px-4 py-3 whitespace-nowrap">Détail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filtered.map((r) => (
                      <tr key={r.id} className="text-htext text-[13px]">
                        {COLUMNS.map(c => (
                          <td key={c.key} className="px-4 py-3 whitespace-nowrap text-muted">
                            {fmtCell(c.key, (r as any)[c.key])}
                          </td>
                        ))}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button onClick={() => loadDetails(r.id)} className="text-orange underline">
                            Ouvrir
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!filtered.length && (
                      <tr>
                        <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-muted text-[13px]">
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
                  <p className="text-muted text-[11px] tracking-[0.18em] uppercase">Détail inscription</p>
                  <button onClick={() => { setSelectedId(null); setDetails(null) }} className="text-orange underline">
                    Fermer
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="border border-orange/10 p-4">
                    <p className="text-muted text-[11px] tracking-[0.18em] uppercase">Badge</p>
                    <div className="mt-3 flex flex-col gap-2 text-[13px]">
                      <div className="text-muted">ID: <span className="text-htext">{String(details.registration?.id || '')}</span></div>
                      {details.badge?.badgeUrl && (
                        <a className="text-orange underline break-all" href={details.badge.badgeUrl} target="_blank" rel="noreferrer">
                          Ouvrir badge
                        </a>
                      )}
                      {details.badge?.qrUrl && (
                        <a className="text-orange underline break-all" href={details.badge.qrUrl} target="_blank" rel="noreferrer">
                          Ouvrir QR (admin)
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="border border-orange/10 p-4">
                    <p className="text-muted text-[11px] tracking-[0.18em] uppercase">Fichiers</p>
                    <div className="mt-3 flex flex-col gap-2 text-[13px]">
                      {details.files?.length ? details.files.map(f => (
                        <div key={f.id} className="flex items-center justify-between gap-4 border-b border-white/10 pb-2">
                          <div className="min-w-0">
                            <div className="text-htext break-all">{f.originalName}</div>
                            <div className="text-muted2 text-[12px]">{fmtDate(f.createdAt)} · {f.sizeBytes ? `${Math.round(f.sizeBytes / 1024)} KB` : ''}</div>
                          </div>
                          <a className="text-orange underline whitespace-nowrap" href={f.downloadUrl}>
                            Télécharger
                          </a>
                        </div>
                      )) : (
                        <div className="text-muted">Aucun fichier.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
