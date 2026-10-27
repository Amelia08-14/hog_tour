const express = require('express')
const auth = require('./auth')
const { getDb } = require('../db')
const { snapshot, resolveQr, getPerson, act, FIELDS, normalize, fault, defaultHotel } = require('./service')
const { checkinInitError } = require('./schema')
const { HOG_TARIFFS } = require('../tariffs')
function createCheckinRouter() {
  const router = express.Router()
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  // Tables absentes : refus explicite plutot qu'une erreur SQL opaque.
  router.use((req, res, next) => checkinInitError()
    ? res.status(503).json({ error: 'checkin_unavailable', message: 'Le module de check-in n’est pas initialise sur le serveur. Contacte le responsable technique.' })
    : next())
  router.post('/auth/login', auth.login)
  router.use(auth.authenticate)
  router.post('/auth/logout', auth.logout)
  router.get('/me', (req, res) => res.json({ user: req.staff, defaultHotel: defaultHotel() }))
  // Grille de référence des membres du H.O.G Algérie, affichée à l'accueil.
  router.get('/tariffs', (req, res) => res.json({ hog: HOG_TARIFFS }))
  router.post('/resolve', async (req, res) => res.json(await resolveQr(req.body?.qr)))
  router.get('/dashboard', async (req, res) => {
    const list = await snapshot()
    res.json({ total: list.length, ...Object.fromEntries(FIELDS.map(f => [f, list.filter(p => p.checks[f]).length])), serverTime: new Date().toISOString() })
  })
  router.get('/participants', async (req, res) => {
    const q = typeof req.query.q === 'string' ? normalize(req.query.q).slice(0, 120) : ''
    const stage = req.query.stage || 'alger'
    const status = req.query.status || 'all'
    if (!FIELDS.includes(stage) || !['all', 'done', 'pending'].includes(status)) throw fault(400, 'invalid_filter', 'Filtre invalide.')
    const offset = Math.max(0, Math.min(100000, Number.parseInt(req.query.offset, 10) || 0))
    const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 30))
    const filtered = (await snapshot()).filter(p => {
      const haystack = normalize(`${p.firstName} ${p.lastName} ${p.lastName} ${p.firstName} ${p.passport}`)
      return (!q || haystack.includes(q)) && (status === 'all' || (status === 'done' ? !!p.checks[stage] : !p.checks[stage]))
    })
    res.json({ items: filtered.slice(offset, offset + limit), total: filtered.length, nextOffset: offset + limit < filtered.length ? offset + limit : null })
  })
  router.get('/participants/:id', async (req, res) => {
    const p = await getPerson(req.params.id)
    const history = await (await getDb()).all('SELECT action, occurred_at AS at, staff_name AS staff FROM checkin_events WHERE registration_id = ? AND person_role = ? ORDER BY occurred_at DESC, id DESC', [p.registrationId, p.role])
    res.json({ participant: p, history })
  })
  router.post('/participants/:id/actions', async (req, res) => res.json(await act(req.params.id, req.body || {}, req.staff)))
  router.use((err, req, res, next) => {
    if (res.headersSent) return next(err)
    if (!err.status) console.error('checkin error:', err.code || err.name)
    res.status(err.status || 500).json({ error: err.code || 'server_error', message: err.status ? err.message : 'Erreur serveur. Réessaie ou contacte le responsable.' })
  })
  return router
}
module.exports = { createCheckinRouter }
