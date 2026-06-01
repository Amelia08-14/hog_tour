'use client'
import { useEffect, useMemo, useState, type FormEvent } from 'react'

type Row = Record<string, any> & { id: string; created_at: string }
type Details = {
  registration: Record<string, any>
  payment: Record<string, any> | null
  badge: { id: string; issuedAt: string; badgeUrl: string | null; qrUrl: string | null } | null
  files: Array<{ id: string; originalName: string; mime: string; sizeBytes: number; createdAt: string; downloadUrl: string }>
}

const CSV_COLUMNS = [
  { key: 'created_at', label: 'Date' },
  { key: 'prenom', label: 'Prénom' }, { key: 'nom', label: 'Nom' },
  { key: 'sexe', label: 'Sexe' }, { key: 'email', label: 'Email' },
  { key: 'phone_number', label: 'Téléphone' }, { key: 'pays_iso2', label: 'Pays' },
  { key: 'adresse', label: 'Adresse' }, { key: 'ville', label: 'Ville' },
  { key: 'nationalite', label: 'Nationalité' }, { key: 'residence_zone', label: 'Résidence' },
  { key: 'profil', label: 'Profil' }, { key: 'profil_groupe', label: 'Groupe' },
  { key: 'hebergement', label: 'Hébergement' }, { key: 'taille_tshirt', label: 'T-shirt' },
  { key: 'paiement_mode', label: 'Mode paiement' }, { key: 'permis_num', label: 'Permis' },
  { key: 'immatriculation', label: 'Immatriculation' }, { key: 'passport_num', label: 'Passeport' },
  { key: 'payment_status', label: 'Statut paiement' },
  { key: 'payment_amount_cents', label: 'Montant (cents)' },
  { key: 'payment_currency', label: 'Devise' },
  { key: 'payment_method', label: 'Méthode' },
  { key: 'files_count', label: 'Fichiers' },
]

function fmtDate(v: any) {
  const d = new Date(String(v || ''))
  return Number.isFinite(d.getTime()) ? d.toLocaleString('fr-FR') : String(v || '')
}
function fmtDateShort(v: any) {
  const d = new Date(String(v || ''))
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('fr-FR') : ''
}
function fmtAmount(cents: any, currency: any) {
  const n = Number(cents)
  if (!n) return '—'
  const c = String(currency || 'EUR')
  if (c === 'DZD') return `${Math.round(n / 100).toLocaleString('fr-DZ')} DA`
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: c }).format(n / 100)
}
function toCsv(rows: Row[]) {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`
  return [
    CSV_COLUMNS.map(c => esc(c.label)).join(','),
    ...rows.map(r => CSV_COLUMNS.map(c => esc(String((r as any)[c.key] ?? ''))).join(',')),
  ].join('\n')
}

function StatusBadge({ row }: { row: Row }) {
  const status = String(row.payment_status || '')
  const method = String(row.payment_method || '')
  const heb = String(row.hebergement || '')

  if (status === 'paid') return (
    <span className="inline-flex items-center gap-1 bg-emerald-900/40 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold tracking-[1.5px] uppercase px-2 py-0.5">
      ✓ Payé
    </span>
  )
  if (method === 'on_site') return (
    <span className="inline-flex items-center gap-1 bg-blue-900/40 border border-blue-500/30 text-blue-400 text-[10px] font-bold tracking-[1.5px] uppercase px-2 py-0.5">
      Sur place
    </span>
  )
  if (status === 'pending') return (
    <span className="inline-flex items-center gap-1 bg-orange/10 border border-orange/30 text-orange text-[10px] font-bold tracking-[1.5px] uppercase px-2 py-0.5">
      En attente
    </span>
  )
  if (!heb) return (
    <span className="inline-flex items-center gap-1 bg-white/5 border border-white/10 text-muted text-[10px] font-bold tracking-[1.5px] uppercase px-2 py-0.5">
      Nouveau
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 bg-white/5 border border-white/10 text-muted2 text-[10px] font-bold tracking-[1.5px] uppercase px-2 py-0.5">
      {status || '—'}
    </span>
  )
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`border px-6 py-5 ${accent ? 'border-orange/30 bg-orange/5' : 'border-orange/10 bg-bg3'}`}>
      <p className="text-[8px] uppercase tracking-[3px] text-muted mb-2">{label}</p>
      <p className={`font-display text-[36px] leading-none ${accent ? 'text-orange' : 'text-htext'}`}>{value}</p>
      {sub && <p className="text-muted text-[11px] mt-2">{sub}</p>}
    </div>
  )
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3 text-[12px]">
      <div className="w-32 text-muted shrink-0 truncate">{label}</div>
      <div className="flex-1 bg-bg2 h-4 relative overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-orange/50 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-6 text-right text-htext font-bold shrink-0">{value}</div>
      <div className="w-8 text-right text-muted shrink-0">{pct}%</div>
    </div>
  )
}

export default function AdminPage() {
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [items, setItems]       = useState<Row[]>([])
  const [q, setQ]               = useState('')
  const [filterZone, setFilterZone] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [details, setDetails]   = useState<Details | null>(null)
  const [tab, setTab]           = useState<'dashboard' | 'list' | 'mail'>('dashboard')
  const [mailInfo, setMailInfo] = useState<any>(null)
  const [mailTo, setMailTo]     = useState('')
  const [mailResult, setMailResult] = useState<string | null>(null)

  const apiBase = useMemo(() => {
    const v = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
    const base = v || (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : '')
    return base ? base.replace(/\/$/, '') : ''
  }, [])
  const api = (p: string) => apiBase ? `${apiBase}${p}` : p

  // ── stats ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = items.length
    const paid        = items.filter(r => r.payment_status === 'paid').length
    const onSite      = items.filter(r => r.payment_method === 'on_site').length
    const confirmed   = paid + onSite
    const pending     = items.filter(r => r.payment_status === 'pending' && r.payment_method !== 'on_site').length
    const noHeb       = items.filter(r => !r.hebergement).length

    const byZone: Record<string, number> = {}
    const byHeb: Record<string, number>  = {}
    const byTshirt: Record<string, number> = {}
    let revCents = 0

    for (const r of items) {
      const z = String(r.residence_zone || 'Inconnu')
      byZone[z] = (byZone[z] || 0) + 1
      const h = String(r.hebergement || 'Non choisi')
      byHeb[h] = (byHeb[h] || 0) + 1
      const t = String(r.taille_tshirt || '—')
      byTshirt[t] = (byTshirt[t] || 0) + 1
      if (r.payment_status === 'paid') revCents += Number(r.payment_amount_cents) || 0
    }

    const timeline: Record<string, number> = {}
    for (const r of items) {
      const day = fmtDateShort(r.created_at)
      if (day) timeline[day] = (timeline[day] || 0) + 1
    }

    return { total, paid, onSite, confirmed, pending, noHeb, byZone, byHeb, byTshirt, revCents, timeline }
  }, [items])

  // ── filtered list ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let out = items
    if (filterZone)   out = out.filter(r => r.residence_zone === filterZone)
    if (filterStatus === 'paid')    out = out.filter(r => r.payment_status === 'paid')
    if (filterStatus === 'on_site') out = out.filter(r => r.payment_method === 'on_site')
    if (filterStatus === 'pending') out = out.filter(r => r.payment_status === 'pending' && r.payment_method !== 'on_site')
    if (filterStatus === 'new')     out = out.filter(r => !r.hebergement)
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      const keys = ['prenom', 'nom', 'email', 'phone_number', 'passport_num', 'immatriculation', 'permis_num', 'hebergement']
      out = out.filter(r => keys.some(k => String((r as any)[k] || '').toLowerCase().includes(s)))
    }
    return out
  }, [items, q, filterZone, filterStatus])

  // ── API calls ───────────────────────────────────────────────────────────
  async function checkSession() {
    try {
      const r = await fetch(api('/v1/admin/me'), { credentials: 'include' })
      return r.ok && Boolean((await r.json().catch(() => null))?.ok)
    } catch { return false }
  }

  async function loadList() {
    setError(null); setLoading(true)
    try {
      const r = await fetch(api('/v1/admin/registrations?limit=5000'), { credentials: 'include' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError('Impossible de récupérer les inscriptions.'); return }
      setItems(Array.isArray(d?.items) ? d.items : [])
    } catch { setError('Serveur inaccessible.') }
    finally { setLoading(false) }
  }

  async function loadDetails(id: string) {
    setSelectedId(id); setDetails(null); setTab('list')
    try {
      const r = await fetch(api(`/v1/admin/registrations/${encodeURIComponent(id)}`), { credentials: 'include' })
      const d = await r.json().catch(() => ({}))
      if (r.ok) setDetails(d as Details)
    } catch {}
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault(); setError(null)
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    const username = String(fd.get('username') || '').trim()
    const password = String(fd.get('password') || '')
    if (!username || !password) { setError('Renseignez le login et le mot de passe.'); return }
    setLoading(true)
    try {
      const r = await fetch(api('/v1/admin/login'), {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!r.ok) { setError('Identifiants invalides.'); return }
      setAuthed(true)
      await loadList()
      await loadMailInfo()
    } catch { setError('Serveur inaccessible.') }
    finally { setLoading(false) }
  }

  async function handleLogout() {
    await fetch(api('/v1/admin/logout'), { method: 'POST', credentials: 'include' }).catch(() => {})
    setAuthed(false); setItems([]); setSelectedId(null); setDetails(null)
  }

  async function loadMailInfo() {
    try {
      const r = await fetch(api('/v1/admin/debug/mail'), { credentials: 'include' })
      if (r.ok) setMailInfo(await r.json().catch(() => null))
    } catch {}
  }

  async function sendTestMail() {
    setMailResult(null); setLoading(true)
    try {
      const r = await fetch(api('/v1/admin/debug/mail/test'), {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: mailTo.trim() || undefined }),
      })
      const d = await r.json().catch(() => ({}))
      setMailResult(r.ok ? '✓ Email envoyé.' : `Échec: ${String(d?.message || 'erreur')}`)
    } catch { setMailResult('Serveur inaccessible.') }
    finally { setLoading(false) }
  }

  function downloadCsv() {
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: `hog-inscriptions-${new Date().toISOString().slice(0,10)}.csv` })
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      const ok = await checkSession()
      if (!alive) return
      setAuthed(ok); setChecking(false)
      if (ok) { loadList(); loadMailInfo() }
    })()
    return () => { alive = false }
  }, [])

  // ── render ──────────────────────────────────────────────────────────────
  if (checking) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <p className="text-muted text-[13px] tracking-[3px] uppercase">Chargement…</p>
    </div>
  )

  if (!authed) return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6">
      <div className="w-full max-w-[420px]">
        <div className="mb-8">
          <p className="text-[9px] uppercase tracking-[5px] text-orange/60 mb-2">H.O.G Tour 2026</p>
          <h1 className="font-display text-[40px] text-htext leading-none tracking-wide">ADMIN</h1>
        </div>
        <div className="border border-orange/12 bg-bg3 p-8">
          <div className="h-0.5 w-12 bg-orange mb-8" />
          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            <div>
              <label className="block text-[11px] uppercase tracking-[2px] text-muted mb-3">Login</label>
              <input name="username" type="text" autoComplete="username"
                className="w-full bg-transparent border-b border-white/15 pb-3 text-htext text-[18px] outline-none focus:border-orange transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[2px] text-muted mb-3">Mot de passe</label>
              <input name="password" type="password" autoComplete="current-password"
                className="w-full bg-transparent border-b border-white/15 pb-3 text-htext text-[18px] outline-none focus:border-orange transition-colors" />
            </div>
            {error && <p className="text-orange text-[12px]">{error}</p>}
            <button type="submit" disabled={loading}
              className="mt-2 bg-orange text-black font-condensed font-bold text-[13px] tracking-[0.25em] uppercase py-4 hover:bg-white transition-colors disabled:opacity-60">
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  const zones = Object.keys(stats.byZone).sort((a, b) => stats.byZone[b] - stats.byZone[a])
  const hebs  = Object.keys(stats.byHeb).sort((a, b) => stats.byHeb[b] - stats.byHeb[a])
  const tshirts = ['S','M','L','XL','XXL'].filter(s => stats.byTshirt[s])

  return (
    <div className="min-h-screen bg-bg pt-[60px]">
      {/* Top bar */}
      <div className="border-b border-orange/10 bg-bg2 px-6 md:px-10 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[8px] uppercase tracking-[4px] text-orange/60">H.O.G Tour 2026</span>
          <span className="text-orange/30 mx-2">|</span>
          <span className="font-display text-[18px] text-htext tracking-wide">ADMIN</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadList} disabled={loading}
            className="text-muted text-[11px] uppercase tracking-[2px] hover:text-htext transition-colors disabled:opacity-40">
            {loading ? '↻ Actualisation…' : '↻ Actualiser'}
          </button>
          <button onClick={handleLogout}
            className="border border-orange/15 text-muted font-condensed font-bold text-[11px] tracking-[2px] uppercase px-4 py-2 hover:border-orange/40 hover:text-htext transition-colors">
            Déconnexion
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-orange/10 bg-bg2 px-6 md:px-10 flex gap-1">
        {(['dashboard', 'list', 'mail'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`font-condensed font-bold text-[11px] tracking-[2px] uppercase px-5 py-3 border-b-2 transition-colors ${tab === t ? 'border-orange text-orange' : 'border-transparent text-muted hover:text-htext'}`}>
            {t === 'dashboard' ? 'Vue d\'ensemble' : t === 'list' ? `Inscriptions (${items.length})` : 'Email'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-6 md:mx-10 mt-4 border border-orange/20 bg-bg3 px-5 py-3 text-[13px] text-orange">{error}</div>
      )}

      {/* ── DASHBOARD ── */}
      {tab === 'dashboard' && (
        <div className="px-6 md:px-10 py-8 space-y-8">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Total inscriptions" value={stats.total} accent />
            <KpiCard label="Confirmées" value={stats.confirmed}
              sub={`${stats.paid} payées · ${stats.onSite} sur place`} />
            <KpiCard label="En attente paiement" value={stats.pending} />
            <KpiCard label="Revenus ligne" value={stats.revCents ? fmtAmount(stats.revCents, 'EUR') : '—'}
              sub="Paiements en ligne confirmés" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Résidence */}
            <div className="border border-orange/10 bg-bg3 p-6">
              <p className="text-[9px] uppercase tracking-[3px] text-orange/60 mb-5">Résidence</p>
              <div className="space-y-3">
                {zones.map(z => <Bar key={z} label={z} value={stats.byZone[z]} max={stats.total} />)}
              </div>
            </div>

            {/* Hébergement */}
            <div className="border border-orange/10 bg-bg3 p-6">
              <p className="text-[9px] uppercase tracking-[3px] text-orange/60 mb-5">Hébergement</p>
              <div className="space-y-3">
                {hebs.map(h => <Bar key={h} label={h === 'Non choisi' ? '— Non choisi' : h} value={stats.byHeb[h]} max={stats.total} />)}
              </div>
            </div>

            {/* T-shirts + Statuts */}
            <div className="flex flex-col gap-6">
              <div className="border border-orange/10 bg-bg3 p-6">
                <p className="text-[9px] uppercase tracking-[3px] text-orange/60 mb-5">T-shirts</p>
                <div className="space-y-3">
                  {tshirts.map(t => <Bar key={t} label={t} value={stats.byTshirt[t] || 0} max={stats.total} />)}
                </div>
              </div>
              <div className="border border-orange/10 bg-bg3 p-6">
                <p className="text-[9px] uppercase tracking-[3px] text-orange/60 mb-4">Statuts</p>
                <div className="space-y-2">
                  {[
                    { label: 'Payés en ligne', value: stats.paid, color: 'text-emerald-400' },
                    { label: 'Confirmés sur place', value: stats.onSite, color: 'text-blue-400' },
                    { label: 'En attente', value: stats.pending, color: 'text-orange' },
                    { label: 'Sans hébergement', value: stats.noHeb, color: 'text-muted' },
                  ].map(s => (
                    <div key={s.label} className="flex justify-between text-[12px]">
                      <span className="text-muted">{s.label}</span>
                      <span className={`font-bold ${s.color}`}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          {Object.keys(stats.timeline).length > 1 && (
            <div className="border border-orange/10 bg-bg3 p-6">
              <p className="text-[9px] uppercase tracking-[3px] text-orange/60 mb-5">Inscriptions par jour</p>
              <div className="flex items-end gap-2 h-16">
                {Object.entries(stats.timeline).sort(([a],[b]) => a.localeCompare(b)).map(([day, count]) => {
                  const maxDay = Math.max(...Object.values(stats.timeline))
                  const pct = maxDay ? (count / maxDay) * 100 : 0
                  return (
                    <div key={day} className="flex flex-col items-center gap-1 flex-1 min-w-[28px]">
                      <span className="text-muted text-[9px]">{count}</span>
                      <div className="w-full bg-orange/60 rounded-sm" style={{ height: `${Math.max(4, pct * 0.48)}px` }} />
                      <span className="text-muted text-[8px] truncate w-full text-center">{day.slice(0, 5)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LIST ── */}
      {tab === 'list' && (
        <div className="px-6 md:px-10 py-8">
          {/* Filters bar */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Recherche nom, email, passeport…"
              className="bg-bg3 border border-orange/10 text-htext text-[13px] px-4 py-2.5 outline-none focus:border-orange/30 w-64" />
            <select value={filterZone} onChange={e => setFilterZone(e.target.value)}
              className="bg-bg3 border border-orange/10 text-htext text-[13px] px-4 py-2.5 outline-none focus:border-orange/30 appearance-none cursor-pointer">
              <option value="">Toutes les zones</option>
              {zones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="bg-bg3 border border-orange/10 text-htext text-[13px] px-4 py-2.5 outline-none focus:border-orange/30 appearance-none cursor-pointer">
              <option value="">Tous les statuts</option>
              <option value="paid">Payés</option>
              <option value="on_site">Sur place</option>
              <option value="pending">En attente</option>
              <option value="new">Sans hébergement</option>
            </select>
            <span className="text-muted text-[11px] uppercase tracking-[2px] ml-auto">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span>
            <button onClick={downloadCsv} disabled={!filtered.length}
              className="bg-bg3 border border-orange/15 text-htext font-condensed font-bold text-[11px] tracking-[2px] uppercase px-5 py-2.5 hover:border-orange/40 transition-colors disabled:opacity-50">
              ↓ Export CSV
            </button>
          </div>

          {/* Table */}
          <div className="border border-orange/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-[13px]">
                <thead className="bg-bg2">
                  <tr className="text-muted text-[9px] uppercase tracking-[2px] border-b border-orange/10">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Participant</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Zone</th>
                    <th className="px-4 py-3">Hébergement</th>
                    <th className="px-4 py-3">T-shirt</th>
                    <th className="px-4 py-3">Montant</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {filtered.map(r => (
                    <tr key={r.id}
                      onClick={() => loadDetails(r.id)}
                      className={`cursor-pointer hover:bg-bg3 transition-colors ${selectedId === r.id ? 'bg-orange/5' : ''}`}>
                      <td className="px-4 py-3 text-muted2 whitespace-nowrap">{fmtDateShort(r.created_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-htext font-semibold">{r.prenom} {r.nom}</div>
                        <div className="text-muted2 text-[11px]">{r.passport_num}</div>
                      </td>
                      <td className="px-4 py-3 text-muted max-w-[180px] truncate">{r.email}</td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">{r.residence_zone || '—'}</td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">
                        {r.hebergement ? r.hebergement.replace('Chambre ', '').replace(' — ', '/') : <span className="text-muted2">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted">{r.taille_tshirt || '—'}</td>
                      <td className="px-4 py-3 text-htext font-medium whitespace-nowrap">
                        {fmtAmount(r.payment_amount_cents, r.payment_currency)}
                      </td>
                      <td className="px-4 py-3"><StatusBadge row={r} /></td>
                      <td className="px-4 py-3">
                        <span className="text-orange/60 text-[11px]">→</span>
                      </td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-muted text-[13px]">Aucune inscription.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail panel */}
          {selectedId && details && (
            <div className="mt-6 border border-orange/15 bg-bg3">
              <div className="flex items-center justify-between px-6 py-4 border-b border-orange/10">
                <div>
                  <p className="text-[9px] uppercase tracking-[3px] text-orange/60 mb-0.5">Détail</p>
                  <p className="text-htext font-semibold">
                    {details.registration?.prenom} {details.registration?.nom}
                  </p>
                </div>
                <button onClick={() => { setSelectedId(null); setDetails(null) }}
                  className="text-muted hover:text-htext transition-colors text-[20px] leading-none">×</button>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Données */}
                <div className="space-y-2">
                  <p className="text-[9px] uppercase tracking-[3px] text-orange/60 mb-3">Inscription</p>
                  {[
                    ['Sexe', details.registration?.sexe],
                    ['Téléphone', `${details.registration?.phone_country_iso2} ${details.registration?.phone_number}`],
                    ['Adresse', `${details.registration?.adresse}, ${details.registration?.ville}`],
                    ['Nationalité', details.registration?.nationalite],
                    ['Résidence', details.registration?.residence_zone],
                    ['Profil', details.registration?.profil_groupe ? `Groupe — ${details.registration.profil_groupe}` : details.registration?.profil],
                    ['Taille', details.registration?.taille_tshirt],
                    ['Permis', details.registration?.permis_num],
                    ['Immatriculation', details.registration?.immatriculation],
                    ['Passeport', details.registration?.passport_num],
                  ].map(([label, val]) => val ? (
                    <div key={label as string} className="flex gap-2 text-[12px]">
                      <span className="text-muted w-24 shrink-0">{label}</span>
                      <span className="text-htext">{val}</span>
                    </div>
                  ) : null)}
                </div>

                {/* Paiement */}
                <div className="space-y-2">
                  <p className="text-[9px] uppercase tracking-[3px] text-orange/60 mb-3">Paiement</p>
                  {[
                    ['Hébergement', details.registration?.hebergement || '—'],
                    ['Montant', fmtAmount(details.payment?.amount_cents, details.payment?.currency)],
                    ['Statut', details.payment?.status],
                    ['Méthode', details.payment?.method],
                    ['Référence', details.payment?.reference],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex gap-2 text-[12px]">
                      <span className="text-muted w-24 shrink-0">{label}</span>
                      <span className="text-htext font-mono text-[11px]">{val || '—'}</span>
                    </div>
                  ))}
                  {details.badge?.badgeUrl && (
                    <a href={details.badge.badgeUrl} target="_blank" rel="noreferrer"
                      className="inline-block mt-4 text-orange text-[11px] underline">
                      Voir le badge →
                    </a>
                  )}
                </div>

                {/* Fichiers */}
                <div>
                  <p className="text-[9px] uppercase tracking-[3px] text-orange/60 mb-3">Fichiers joints ({details.files?.length || 0})</p>
                  {details.files?.length ? (
                    <div className="space-y-2">
                      {details.files.map(f => (
                        <div key={f.id} className="flex items-center justify-between gap-3 border border-orange/8 bg-bg2 px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-htext text-[12px] truncate">{f.originalName}</div>
                            <div className="text-muted2 text-[10px]">{f.sizeBytes ? `${Math.round(f.sizeBytes / 1024)} KB` : ''}</div>
                          </div>
                          <a href={f.downloadUrl} className="text-orange text-[11px] underline whitespace-nowrap shrink-0">↓ Télécharger</a>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-muted text-[12px]">Aucun fichier.</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MAIL ── */}
      {tab === 'mail' && (
        <div className="px-6 md:px-10 py-8 max-w-[700px]">
          <div className="border border-orange/10 bg-bg3 p-6 mb-6">
            <p className="text-[9px] uppercase tracking-[3px] text-orange/60 mb-4">Configuration SMTP</p>
            <pre className="text-[12px] text-htext whitespace-pre-wrap break-all leading-relaxed">
              {mailInfo ? JSON.stringify(mailInfo, null, 2) : '—'}
            </pre>
            <button onClick={loadMailInfo} className="mt-4 text-orange text-[11px] underline">Rafraîchir</button>
          </div>
          <div className="border border-orange/10 bg-bg3 p-6">
            <p className="text-[9px] uppercase tracking-[3px] text-orange/60 mb-4">Envoyer un email de test</p>
            <input value={mailTo} onChange={e => setMailTo(e.target.value)} placeholder="Destinataire (optionnel)"
              className="w-full bg-bg2 border border-orange/10 text-htext text-[13px] px-4 py-3 outline-none focus:border-orange/30 mb-4" />
            <button onClick={sendTestMail} disabled={loading}
              className="bg-orange text-black font-condensed font-bold text-[12px] tracking-[0.2em] uppercase px-6 py-3 hover:bg-white transition-colors disabled:opacity-60">
              {loading ? 'Envoi…' : 'Envoyer le test'}
            </button>
            {mailResult && <p className="mt-4 text-[13px] text-orange">{mailResult}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
