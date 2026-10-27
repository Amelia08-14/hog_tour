// Client de l'API /v1/checkin, partagé par les écrans de l'application web.
// Même contrat que l'application mobile (voir docs/API.md).

export type Stage = 'alger' | 'ghardaia' | 'kit' | 'hotel'
export type Check = { at: string; by: string } | null

export type HogTariff = {
  value: string; room: string; occupancy: string; persons: number
  roomCents: number; perPersonCents: number; currency: string
}

export type Participant = {
  id: string; registrationId: string; role: 'primary' | 'partner'
  firstName: string; lastName: string; passport: string; country: string; tshirt: string
  accommodation: string; group: string
  hogMember: boolean; hogTariff: HogTariff | null
  paymentStatus: string; paymentMethod: string; amountCents: number | null; currency: string
  revision: number; checks: Record<Stage, Check>
  hotelName: string; roomNumber: string
}

export type HistoryEntry = { action: Stage; at: string; staff: string }
export type Staff = { username: string; name: string; stations: ('alger' | 'ghardaia')[] }
export type Session = { token: string; expiresAt: string; user: Staff; defaultHotel: string }

export const STAGE_NAMES: Record<Stage, string> = {
  alger: 'Arrivée à Alger',
  ghardaia: 'Arrivée à Ghardaïa',
  kit: 'Kit remis',
  hotel: 'Installation à l’hôtel',
}

// Tous les participants règlent à l'accueil : seules les annulations alertent.
export const PAYMENT_NAMES: Record<string, string> = {
  paid: 'Déjà payé',
  unpaid: 'À encaisser sur place',
  pending: 'À encaisser sur place',
  cancelled: 'Inscription annulée',
  refunded: 'Paiement remboursé',
  unknown: 'À encaisser sur place',
}

export class ApiError extends Error {
  code: string
  status: number
  constructor(message: string, code = '', status = 0) {
    super(message)
    this.code = code
    this.status = status
  }
}

const apiBase = (() => {
  const v = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
  const base = v || (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : '')
  return base ? base.replace(/\/$/, '') : ''
})()

export async function call<T = unknown>(
  method: 'GET' | 'POST',
  path: string,
  opts: { token?: string | null; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const qs = opts.query ? `?${new URLSearchParams(opts.query).toString()}` : ''
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(`${apiBase}/v1/checkin${path}${qs}`, {
      method,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
    let data: { message?: string; error?: string } & Record<string, unknown>
    try { data = await res.json() } catch {
      throw new ApiError('Réponse inattendue du serveur. Réessaie dans un instant.', '', res.status)
    }
    if (!res.ok) throw new ApiError(data?.message || 'La demande a échoué.', data?.error || '', res.status)
    return data as T
  } catch (e) {
    if (e instanceof ApiError) throw e
    if ((e as Error)?.name === 'AbortError') {
      throw new ApiError(method === 'POST' && path.includes('/actions')
        ? 'Le serveur n’a pas répondu à temps. Actualise la fiche pour vérifier si la validation a été enregistrée.'
        : 'Le serveur ne répond pas. Vérifie ta connexion et réessaie.')
    }
    throw new ApiError('Connexion au serveur impossible. Aucun succès n’est confirmé hors connexion.')
  } finally {
    clearTimeout(timer)
  }
}

export const fullName = (p: Participant) => `${p.firstName} ${p.lastName}`.trim()
export const isDone = (p: Participant, stage: Stage) => !!p.checks?.[stage]
export const isSettled = (p: Participant) => p.paymentStatus === 'paid'
export const isBlocked = (p: Participant) => ['cancelled', 'refunded'].includes(p.paymentStatus)

const grouped = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)).replace(/[  ]/g, ' ')
export function formatMoney(cents: number, currency: string) {
  const c = (currency || '').toUpperCase()
  const symbol = c === 'EUR' ? '€' : c === 'DZD' || c === '' ? 'DA' : c
  return `${grouped(cents / 100)} ${symbol}`
}
export function amountDue(p: Participant) {
  if (isSettled(p) || p.amountCents == null || p.amountCents <= 0) return ''
  return formatMoney(p.amountCents, p.currency)
}

// L'événement se déroule en Algérie (UTC+1, sans changement saisonnier).
export function eventTime(value?: string | null) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return '—'
  const d = new Date(date.getTime() + 3600_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} · ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}

// Session conservée dans le navigateur (12 h côté serveur). Exposée comme un
// store externe pour que le rendu serveur et l'hydratation restent cohérents.
const SESSION_KEY = 'hog.checkin.session'
export const SESSION_PENDING = 'pending'
let memorySession = ''
const listeners = new Set<() => void>()

export function subscribeSession(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => { if (e.key === SESSION_KEY) listener() }
  window.addEventListener('storage', onStorage)
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage) }
}
export function sessionSnapshot(): string {
  try { return window.localStorage.getItem(SESSION_KEY) ?? memorySession } catch { return memorySession }
}
export const sessionServerSnapshot = () => SESSION_PENDING

export function parseSession(raw: string): Session | null {
  if (!raw || raw === SESSION_PENDING) return null
  try {
    const s = JSON.parse(raw) as Session
    return s?.token && s.user && new Date(s.expiresAt).getTime() > Date.now() ? s : null
  } catch { return null }
}
export function saveSession(s: Session | null) {
  memorySession = s ? JSON.stringify(s) : ''
  try {
    if (s) window.localStorage.setItem(SESSION_KEY, memorySession)
    else window.localStorage.removeItem(SESSION_KEY)
  } catch { /* stockage indisponible (navigation privée) : la session reste en mémoire */ }
  listeners.forEach(l => l())
}
