'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import HogTariffs from './HogTariffs'
import {
  PAYMENT_NAMES, STAGE_NAMES, amountDue, call, eventTime, fullName, isBlocked, isDone, isSettled,
  type HistoryEntry, type HogTariff, type Participant, type Session, type Stage,
} from './lib'

type Props = {
  session: Session
  initial: Participant
  station: 'alger' | 'ghardaia'
  verification?: string | null
  grid: HogTariff[]
  onClose: () => void
  onExpired: () => void
}

export default function PersonSheet({ session, initial, station, verification, grid, onClose, onExpired }: Props) {
  const [person, setPerson] = useState(initial)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [hotel, setHotel] = useState(initial.hotelName || session.defaultHotel)
  const [room, setRoom] = useState(initial.roomNumber)
  const [editHotel, setEditHotel] = useState(false)
  const [online, setOnline] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Stage | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const fetching = useRef(false)
  const busyRef = useRef(false)
  useEffect(() => { busyRef.current = busy }, [busy])

  const fail = useCallback((e: unknown) => {
    const err = e as { status?: number; message?: string }
    if (err?.status === 401) onExpired()
    setError(err?.message || 'La demande a échoué.')
    setOnline(false)
  }, [onExpired])

  const refresh = useCallback(async () => {
    if (fetching.current) return
    fetching.current = true
    try {
      const data = await call<{ participant: Participant; history: HistoryEntry[] }>(
        'GET', `/participants/${encodeURIComponent(initial.id)}`, { token: session.token })
      setPerson(data.participant)
      setHistory(data.history)
      setOnline(true)
      setError(null)
      if (data.participant.checks.hotel) {
        setHotel(data.participant.hotelName)
        setRoom(data.participant.roomNumber)
        setEditHotel(false)
      }
    } catch (e) { fail(e) } finally { fetching.current = false }
  }, [initial.id, session.token, fail])

  useEffect(() => {
    // Chargement initial de la fiche, puis actualisation périodique.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
    const timer = setInterval(() => { if (!busyRef.current && document.visibilityState === 'visible') refresh() }, 8000)
    return () => clearInterval(timer)
  }, [refresh])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  function ask(action: Stage) {
    if (busy || !online) return
    if (action === 'hotel' && !room.trim()) { setError('Renseigne le numéro de chambre avant de confirmer.'); return }
    setConfirm(action)
  }

  async function act(action: Stage) {
    setConfirm(null)
    setBusy(true)
    setError(null)
    try {
      const data = await call<{ participant: Participant; alreadyDone: boolean }>(
        'POST', `/participants/${encodeURIComponent(person.id)}/actions`, {
          token: session.token,
          body: {
            action, revision: person.revision,
            ...(action === 'hotel' ? { hotelName: hotel.trim(), roomNumber: room.trim() } : {}),
          },
        })
      setPerson(data.participant)
      setToast(data.alreadyDone ? 'Déjà enregistré — aucune nouvelle validation.' : 'Validation enregistrée.')
      try { navigator.vibrate?.(40) } catch { /* sans effet sur iOS */ }
      await refresh()
    } catch (e) {
      // Pas de réessai aveugle : l'agent recharge la fiche en cas de réponse perdue.
      fail(e)
    } finally { setBusy(false) }
  }

  const blocked = isBlocked(person)
  const due = amountDue(person)
  const canAct = (action: Stage, enabled = true) => !busy && online && enabled && !isDone(person, action) && !blocked

  const actionButton = (action: Stage, label: string, enabled = true) => (
    <button
      key={action}
      onClick={() => ask(action)}
      disabled={!canAct(action, enabled)}
      className="w-full mt-3 bg-orange text-black font-condensed font-extrabold tracking-[0.14em] uppercase text-[14px] py-4 disabled:opacity-40 disabled:cursor-not-allowed active:bg-white transition-colors"
    >
      {isDone(person, action) ? `${STAGE_NAMES[action]} · validé` : label}
    </button>
  )

  return (
    <div className="fixed inset-0 z-40 bg-bg overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-white/8 flex items-center justify-between px-4 py-3">
        <button onClick={onClose} disabled={busy} className="text-htext text-[14px] px-3 py-2 border border-white/15 disabled:opacity-40">‹ Retour</button>
        <span className="font-condensed font-bold tracking-[0.2em] uppercase text-[12px] text-orange">Fiche participant</span>
        <button onClick={refresh} disabled={busy} className="text-htext text-[14px] px-3 py-2 border border-white/15 disabled:opacity-40">Actualiser</button>
      </header>

      <div className="max-w-[640px] mx-auto px-5 py-6 flex flex-col gap-5">
        <div>
          <p className="font-condensed uppercase tracking-[0.2em] text-[11px] text-muted">{person.role === 'partner' ? 'Accompagnant' : 'Participant'}</p>
          <h1 className="font-display text-[40px] leading-[1.05] tracking-wide mt-2">{fullName(person)}</h1>
          <p className="text-orange font-semibold mt-2">{person.country}</p>
        </div>

        {person.hogMember && <HogTariffs person={person} grid={grid} />}

        <dl className="bg-bg3 border border-white/8 px-4 py-2 text-[14px]">
          {([
            ['Passeport', person.passport],
            ['Tee-shirt', person.tshirt || '—'],
            ['Hébergement', person.accommodation],
            ['Paiement', PAYMENT_NAMES[person.paymentStatus] ?? person.paymentStatus],
          ] as const).map(([label, value]) => (
            <div key={label} className="flex gap-3 py-2.5 border-b border-white/5 last:border-0">
              <dt className="w-[108px] shrink-0 text-muted">{label}</dt>
              <dd className="font-semibold min-w-0 break-words">{value || '—'}</dd>
            </div>
          ))}
        </dl>

        {(verification === 'legacy_text' || verification === 'manual') && (
          <Notice>Vérifie l’identité du participant. Les badges existants sont reconnus par leur nom et leur passeport.</Notice>
        )}
        {blocked ? (
          <Notice error>{PAYMENT_NAMES[person.paymentStatus]} · accueil bloqué. Consulte le responsable.</Notice>
        ) : !isSettled(person) && (
          <div className="border border-[#5A3A14] bg-[#2A1C0B] px-4 py-4">
            <p className="font-condensed font-bold tracking-[0.12em] uppercase text-[14px] text-orange">À encaisser sur place</p>
            <p className="text-[14px] mt-1">{due ? `${due} · ${person.accommodation}` : (person.accommodation || 'Montant non défini')}</p>
          </div>
        )}

        <section>
          <p className="font-condensed uppercase tracking-[0.2em] text-[11px] text-muted mb-4">Parcours du participant</p>
          <ol className="flex flex-col gap-4">
            {(['alger', 'ghardaia', 'kit', 'hotel'] as Stage[]).map(stage => {
              const check = person.checks[stage]
              return (
                <li key={stage} className="flex gap-3 items-start">
                  <span className={`mt-0.5 w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[14px] ${check ? 'bg-[#1B3322] text-[#90D9A0]' : 'bg-bg4 text-muted'}`}>{check ? '✓' : '•'}</span>
                  <div>
                    <p className="font-bold text-[15px]">{STAGE_NAMES[stage]}</p>
                    <p className={`text-[12px] mt-0.5 ${check ? 'text-[#90D9A0]' : 'text-muted'}`}>
                      {check ? `${eventTime(check.at)} · ${check.by}${stage === 'hotel' ? ` — ${person.hotelName} · ${person.roomNumber}` : ''}` : 'En attente'}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        <section className="border-t border-white/8 pt-5">
          <p className="font-condensed uppercase tracking-[0.2em] text-[11px] text-muted">Poste d’accueil · {station === 'alger' ? 'Alger' : 'Ghardaïa'}</p>
          {error && (
            <div className="mt-4">
              <Notice error>{error}</Notice>
              <button onClick={refresh} disabled={busy} className="mt-2 text-orange text-[14px] underline underline-offset-4">Actualiser la fiche</button>
            </div>
          )}
          {busy && <div className="mt-4 h-1 bg-bg4 overflow-hidden"><div className="h-full w-1/3 bg-orange animate-pulse" /></div>}

          {station === 'alger' && actionButton('alger', 'Confirmer l’arrivée à Alger')}
          {station === 'ghardaia' && (
            <>
              {!isDone(person, 'alger') && (
                <div className="mt-4"><Notice>Le check-in à Alger doit d’abord être enregistré. Contacte le poste d’Alger si une validation manque.</Notice></div>
              )}
              {actionButton('ghardaia', 'Confirmer l’arrivée à Ghardaïa', isDone(person, 'alger'))}
              {actionButton('kit', 'Confirmer la remise du kit', isDone(person, 'ghardaia'))}

              <h2 className="font-display text-[26px] tracking-wide mt-8 mb-3">Installation à l’hôtel</h2>
              {editHotel ? (
                <input
                  value={hotel}
                  onChange={e => setHotel(e.target.value)}
                  readOnly={busy || isDone(person, 'hotel')}
                  maxLength={160}
                  aria-label="Nom de l’hôtel"
                  className="w-full bg-bg2 border border-white/10 px-4 py-3 text-[16px] outline-none focus:border-orange/50"
                />
              ) : (
                <div className="flex items-center justify-between gap-3 bg-bg3 border border-white/8 px-4 py-3">
                  <span className="font-semibold text-[15px]">{hotel || '—'}</span>
                  {!isDone(person, 'hotel') && (
                    <button onClick={() => setEditHotel(true)} disabled={busy} className="text-orange text-[14px]">Changer</button>
                  )}
                </div>
              )}
              <input
                value={room}
                onChange={e => setRoom(e.target.value)}
                readOnly={busy || isDone(person, 'hotel')}
                maxLength={40}
                placeholder="Numéro de chambre"
                aria-label="Numéro de chambre"
                className="w-full mt-3 bg-bg2 border border-white/10 px-4 py-3 text-[16px] outline-none focus:border-orange/50 placeholder:text-muted2"
              />
              {actionButton('hotel', 'Confirmer l’installation', isDone(person, 'ghardaia'))}
            </>
          )}
        </section>

        {history.length > 0 && (
          <section className="border-t border-white/8 pt-5">
            <p className="font-condensed uppercase tracking-[0.2em] text-[11px] text-muted mb-3">Historique</p>
            <ul className="flex flex-col gap-3">
              {history.map((h, i) => (
                <li key={i} className="text-[12px] text-muted">
                  <span className="text-htext text-[13px] block">{STAGE_NAMES[h.action] ?? h.action}</span>
                  {eventTime(h.at)} · {h.staff}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-[420px] bg-bg3 border border-orange/30 p-6">
            <h2 className="font-display text-[26px] tracking-wide">
              {confirm === 'kit' ? 'Confirmer la remise du kit ?' : confirm === 'hotel' ? 'Confirmer l’installation ?' : 'Confirmer l’arrivée ?'}
            </h2>
            <p className="text-[14px] mt-3 leading-relaxed">
              <strong>{fullName(person)}</strong><br />
              {STAGE_NAMES[confirm]}
              {confirm === 'hotel' && <><br />{hotel.trim()} · Chambre {room.trim()}</>}
            </p>
            <p className="text-muted text-[12px] mt-3">Cette action sera enregistrée à ton nom.</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setConfirm(null)} className="flex-1 border border-white/20 py-3 text-[14px]">Annuler</button>
              <button onClick={() => act(confirm)} className="flex-1 bg-orange text-black font-condensed font-extrabold tracking-[0.14em] uppercase text-[13px] py-3">Confirmer</button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-8 z-50 bg-htext text-black text-[14px] px-5 py-3 shadow-lg" role="status">{toast}</div>
      )}
    </div>
  )
}

export function Notice({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <div className={`px-4 py-3 text-[13px] leading-relaxed border ${error ? 'border-[#8a3a2c] bg-[#2a1411] text-[#FFB4A8]' : 'border-orange/25 bg-bg3 text-htext'}`}>
      {children}
    </div>
  )
}
