'use client'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import Scanner from './Scanner'
import PersonSheet, { Notice } from './PersonSheet'
import {
  SESSION_PENDING, amountDue, call, fullName, isBlocked, isDone, parseSession, saveSession,
  sessionServerSnapshot, sessionSnapshot, subscribeSession,
  type HogTariff, type Participant, type Session, type Stage,
} from './lib'

type Station = 'alger' | 'ghardaia'
type Stats = { total: number; alger: number; ghardaia: number; kit: number; hotel: number; serverTime: string }
type Open = { person: Participant; verification: string | null }

export default function CheckinApp() {
  const raw = useSyncExternalStore(subscribeSession, sessionSnapshot, sessionServerSnapshot)
  const session = useMemo(() => parseSession(raw), [raw])
  const ready = raw !== SESSION_PENDING
  const [grid, setGrid] = useState<HogTariff[]>([])

  const expire = useCallback(() => saveSession(null), [])

  // Grille de référence H.O.G : chargée une fois par session.
  useEffect(() => {
    if (!session) return
    call<{ hog: HogTariff[] }>('GET', '/tariffs', { token: session.token })
      .then(d => setGrid(d.hog))
      .catch(e => { if (e?.status === 401) expire() })
  }, [session, expire])

  if (!ready) return <div className="min-h-[100dvh] bg-bg" />
  if (!session) return <Login onDone={saveSession} />
  return <Home session={session} grid={grid} onExpired={expire} onLogout={async () => {
    try { await call('POST', '/auth/logout', { token: session.token }) } catch { /* la session locale est supprimée de toute façon */ }
    expire()
  }} />
}

function Login({ onDone }: { onDone: (s: Session) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(null)
    try {
      const data = await call<Session>('POST', '/auth/login', { body: { username: username.trim(), password } })
      onDone(data)
    } catch (err) {
      setError((err as Error).message)
    } finally { setBusy(false) }
  }

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-5" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <form onSubmit={submit} className="w-full max-w-[400px] flex flex-col gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/hog-logo.png" alt="" width={72} height={72} className="mx-auto" />
        <p className="font-condensed uppercase tracking-[0.25em] text-[12px] text-orange text-center">Accueil des participants</p>
        <h1 className="font-display text-[44px] leading-none tracking-wide text-center mb-2">HOG Check-in</h1>
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          placeholder="Identifiant" aria-label="Identifiant" required
          className="bg-bg2 border border-white/10 px-4 py-4 text-[16px] outline-none focus:border-orange/50 placeholder:text-muted2"
        />
        <input
          value={password}
          onChange={e => setPassword(e.target.value)}
          type="password" autoComplete="current-password"
          placeholder="Mot de passe" aria-label="Mot de passe" required
          className="bg-bg2 border border-white/10 px-4 py-4 text-[16px] outline-none focus:border-orange/50 placeholder:text-muted2"
        />
        {error && <Notice error>{error}</Notice>}
        <button
          disabled={busy}
          className="bg-orange text-black font-condensed font-extrabold tracking-[0.25em] uppercase text-[14px] py-4 disabled:opacity-60 active:bg-white transition-colors"
        >{busy ? 'Connexion…' : 'Se connecter'}</button>
        <p className="text-muted text-[12px] text-center">Réservé à l’équipe d’accueil. Ajoute cette page à l’écran d’accueil pour l’ouvrir comme une application.</p>
      </form>
    </main>
  )
}

function Home({ session, grid, onExpired, onLogout }: { session: Session; grid: HogTariff[]; onExpired: () => void; onLogout: () => void }) {
  const stations = session.user.stations.length ? session.user.stations : (['alger', 'ghardaia'] as Station[])
  const [station, setStation] = useState<Station>(stations.includes('alger') ? 'alger' : 'ghardaia')
  const [tab, setTab] = useState<'home' | 'list'>('home')
  const [stats, setStats] = useState<Stats | null>(null)
  const [people, setPeople] = useState<Participant[]>([])
  const [total, setTotal] = useState(0)
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'done' | 'pending'>('all')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [opened, setOpened] = useState<Open | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const generation = useRef(0)
  const count = useRef(30)
  const stage: Stage = station

  const refresh = useCallback(async (more = false, offset = 0) => {
    const mine = ++generation.current
    setLoading(true)
    try {
      const [dash, list] = await Promise.all([
        call<Stats>('GET', '/dashboard', { token: session.token }),
        call<{ items: Participant[]; total: number; nextOffset: number | null }>('GET', '/participants', {
          token: session.token,
          query: { q: query.trim(), stage, status: filter, offset: String(more ? offset : 0), limit: String(more ? 30 : Math.min(100, Math.max(30, count.current))) },
        }),
      ])
      if (mine !== generation.current) return
      setStats(dash)
      setPeople(prev => (more ? [...prev, ...list.items] : list.items))
      count.current = more ? count.current + list.items.length : list.items.length
      setTotal(list.total)
      setNextOffset(list.nextOffset)
      setError(null)
    } catch (e) {
      if (mine !== generation.current) return
      if ((e as { status?: number }).status === 401) onExpired()
      setError((e as Error).message)
    } finally {
      if (mine === generation.current) setLoading(false)
    }
  }, [session.token, query, stage, filter, onExpired])

  // Recherche différée à la saisie, puis actualisation toutes les 8 s hors fiche ouverte.
  useEffect(() => {
    const timer = setTimeout(() => refresh(), 250)
    return () => clearTimeout(timer)
  }, [refresh])
  useEffect(() => {
    if (opened || scanning) return
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 8000)
    return () => clearInterval(timer)
  }, [refresh, opened, scanning])

  async function onScan(qr: string) {
    setScanning(false)
    try {
      const r = await call<{ participant: Participant; verification: string }>('POST', '/resolve', { token: session.token, body: { qr } })
      setOpened({ person: r.participant, verification: r.verification })
    } catch (e) {
      if ((e as { status?: number }).status === 401) onExpired()
      setScanError((e as Error).message)
    }
  }

  const arrived = stats ? stats[station] : 0
  const all = stats?.total ?? 0

  return (
    <div className="min-h-[100dvh] pb-24" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="flex items-center justify-between px-5 py-4 border-b border-white/8">
        <div className="flex items-center gap-3 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/hog-logo.png" alt="" width={30} height={30} />
          <div className="min-w-0">
            <p className="font-condensed font-bold tracking-[0.18em] uppercase text-[13px] truncate">HOG Check-in</p>
            <p className="text-muted text-[12px] truncate">{session.user.name}</p>
          </div>
        </div>
        <button onClick={onLogout} className="text-muted text-[13px] px-3 py-2 border border-white/12">Déconnexion</button>
      </header>

      <div className="max-w-[640px] mx-auto px-5">
        {stations.length > 1 && (
          <div className="flex mt-5 border border-white/10" role="tablist" aria-label="Poste d’accueil">
            {stations.map(s => (
              <button
                key={s} role="tab" aria-selected={station === s}
                onClick={() => setStation(s)}
                className={`flex-1 py-3 font-condensed font-bold tracking-[0.18em] uppercase text-[13px] ${station === s ? 'bg-orange text-black' : 'text-muted'}`}
              >{s === 'alger' ? 'Alger' : 'Ghardaïa'}</button>
            ))}
          </div>
        )}

        {error && <div className="mt-4"><Notice error>{error}</Notice></div>}

        {tab === 'home' ? (
          <section>
            <p className="font-condensed uppercase tracking-[0.22em] text-[11px] text-muted mt-7">Accueil des participants</p>
            <h1 className="font-display text-[46px] leading-[1.02] tracking-wide mt-2">
              {station === 'alger' ? <>Le voyage<br />commence ici.</> : <>Bienvenue<br />à Ghardaïa.</>}
            </h1>
            <div className="bg-orange text-black p-6 mt-6">
              <p className="font-condensed font-extrabold tracking-[0.18em] uppercase text-[13px]">{station === 'alger' ? 'Étape 01 · Alger' : 'Étape 02 · Ghardaïa'}</p>
              <p className="mt-4"><span className="text-[54px] leading-none font-black">{stats ? arrived : '—'}</span> <span className="font-semibold">/ {all} participants</span></p>
              <div className="h-1.5 bg-white/35 mt-4"><div className="h-full bg-black" style={{ width: `${all ? Math.min(100, (arrived / all) * 100) : 0}%` }} /></div>
              <p className="text-[13px] mt-3">arrivées enregistrées à {station === 'alger' ? 'Alger' : 'Ghardaïa'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Metric value={stats?.kit} label="Kits remis" />
              <Metric value={stats?.hotel} label="Installés à l’hôtel" />
            </div>
            <button onClick={() => setTab('list')} className="w-full mt-4 py-3 text-orange text-[14px] border border-orange/30">Rechercher un participant</button>
          </section>
        ) : (
          <section>
            <h1 className="font-display text-[36px] tracking-wide mt-6">Participants</h1>
            <p className="text-muted text-[13px] mt-1">{total} résultat{total === 1 ? '' : 's'}</p>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              type="search" enterKeyHint="search"
              placeholder="Nom ou passeport" aria-label="Rechercher un participant"
              className="w-full mt-4 bg-bg2 border border-white/10 px-4 py-3.5 text-[16px] outline-none focus:border-orange/50 placeholder:text-muted2"
            />
            <div className="flex gap-2 mt-3">
              {([['all', 'Tous'], ['pending', 'En attente'], ['done', 'Validés']] as const).map(([value, label]) => (
                <button
                  key={value} onClick={() => setFilter(value)} aria-pressed={filter === value}
                  className={`px-3.5 py-2 text-[13px] border ${filter === value ? 'bg-orange text-black border-orange font-semibold' : 'border-white/12 text-muted'}`}
                >{label}</button>
              ))}
            </div>
            <ul className="mt-4 flex flex-col gap-2">
              {people.map(p => (
                <li key={p.id}>
                  <button onClick={() => setOpened({ person: p, verification: 'manual' })} className="w-full text-left bg-bg3 border border-white/8 px-4 py-3.5 flex items-center justify-between gap-3 active:border-orange/50">
                    <span className="min-w-0">
                      <span className="block font-semibold text-[15px] truncate">{fullName(p)}</span>
                      <span className="block text-muted text-[12px] truncate">
                        {p.role === 'partner' ? 'Accompagnant · ' : ''}{p.passport || 'Passeport non renseigné'}
                      </span>
                      <span className="flex flex-wrap items-center gap-2 mt-1">
                        {p.hogMember && <span className="bg-orange text-black font-condensed font-extrabold text-[10px] tracking-[0.15em] uppercase px-1.5 py-0.5">Membre H.O.G</span>}
                        {!isBlocked(p) && amountDue(p) && <span className="text-orange text-[12px]">{amountDue(p)}</span>}
                        {isBlocked(p) && <span className="text-[#FFB4A8] text-[12px]">Bloqué</span>}
                      </span>
                    </span>
                    <span className={`shrink-0 text-[12px] ${isDone(p, stage) ? 'text-[#90D9A0]' : 'text-muted'}`}>{isDone(p, stage) ? '✓ Validé' : 'En attente'}</span>
                  </button>
                </li>
              ))}
            </ul>
            {nextOffset !== null && (
              <button onClick={() => refresh(true, nextOffset)} disabled={loading} className="w-full mt-4 py-3 border border-white/15 text-[14px] disabled:opacity-50">Charger la suite</button>
            )}
            {!people.length && !loading && <p className="text-muted text-[14px] text-center mt-10">Aucun participant.</p>}
          </section>
        )}
      </div>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-bg/95 backdrop-blur border-t border-white/10 flex items-stretch" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <button onClick={() => setTab('home')} aria-current={tab === 'home'} className={`flex-1 py-4 text-[13px] font-condensed tracking-[0.14em] uppercase ${tab === 'home' ? 'text-orange' : 'text-muted'}`}>Accueil</button>
        <button onClick={() => { setScanError(null); setScanning(true) }} className="flex-[1.3] my-2 bg-orange text-black font-condensed font-extrabold tracking-[0.2em] uppercase text-[14px]">Scanner</button>
        <button onClick={() => setTab('list')} aria-current={tab === 'list'} className={`flex-1 py-4 text-[13px] font-condensed tracking-[0.14em] uppercase ${tab === 'list' ? 'text-orange' : 'text-muted'}`}>Participants</button>
      </nav>

      {scanning && <Scanner onResult={onScan} onClose={() => setScanning(false)} />}

      {scanError && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-5" role="alertdialog" aria-modal="true">
          <div className="w-full max-w-[420px] bg-bg3 border border-orange/30 p-6">
            <h2 className="font-display text-[26px] tracking-wide">Badge non validé</h2>
            <p className="text-[14px] mt-3 leading-relaxed">{scanError}</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setScanError(null)} className="flex-1 border border-white/20 py-3 text-[14px]">Fermer</button>
              <button onClick={() => { setScanError(null); setScanning(true) }} className="flex-1 bg-orange text-black font-condensed font-extrabold tracking-[0.14em] uppercase text-[13px] py-3">Rescanner</button>
            </div>
          </div>
        </div>
      )}

      {opened && (
        <PersonSheet
          session={session} initial={opened.person} station={station} verification={opened.verification} grid={grid}
          onClose={() => { setOpened(null); refresh() }} onExpired={onExpired}
        />
      )}
    </div>
  )
}

function Metric({ value, label }: { value?: number; label: string }) {
  return (
    <div className="bg-bg3 border border-white/8 p-5">
      <p className="font-display text-[40px] leading-none">{value ?? '—'}</p>
      <p className="text-muted text-[12px] mt-2">{label}</p>
    </div>
  )
}
