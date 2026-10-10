const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hog-checkin-test-'))
process.env.DB_DRIVER = 'sqlite'
process.env.DATABASE_PATH = path.join(dir, 'test.sqlite')
process.env.QR_SIGNING_SECRET = crypto.randomBytes(32).toString('hex')
process.env.CHECKIN_USERS_FILE = path.join(dir, 'users.json')
process.env.MAIL_DISABLED = 'true'
const salt = crypto.randomBytes(16).toString('hex')
const password = 'Test-password-only-123'
fs.writeFileSync(process.env.CHECKIN_USERS_FILE, JSON.stringify([
  { username: 'test.staff', name: 'Agent Test', stations: ['alger', 'ghardaia'], passwordHash: `scrypt:${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}` },
  { username: 'test.alger', name: 'Alger Test', stations: ['alger'], passwordHash: `scrypt:${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}` },
]))
const { createStartedApp } = require('../src/app')
const { getDb } = require('../src/db')
const { signToken } = require('../src/security')
let server, base, bearer, algerToken, db
const rid = crypto.randomUUID(), bid = crypto.randomUUID(), badgeToken = 'fixture_signed_token'
let pending, cancelled
const primary = `${rid}:primary`, partner = `${rid}:partner`
async function request(method, url, body, token = bearer) {
  const r = await fetch(`${base}/v1/checkin${url}`, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { status: r.status, body: await r.json() }
}
async function seed(id, badge, status, passport = 'TEST9001', withPartner = false) {
  const stamp = new Date().toISOString()
  const data = {
    id, created_at: stamp, updated_at: stamp, prenom: 'Nadia', nom: 'Test', sexe: 'F', adresse: 'Test', ville: 'Alger', pays_iso2: 'DZ', phone_country_iso2: 'DZ', phone_number: '000000000', email: 'test@example.invalid', nationalite: 'Algérienne', profil: 'Motard', hebergement: 'Chambre double couple', taille_tshirt: 'M', paiement_mode: 'onsite', permis_num: 'TEST', immatriculation: 'TEST', passport_num: passport,
    partner_info: withPartner ? JSON.stringify({ prenom: 'Samir', nom: 'Exemple', passportNum: 'TEST9002', tailleTshirt: 'L' }) : null,
  }
  const columns = Object.keys(data)
  await db.run(`INSERT INTO registrations (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, Object.values(data))
  await db.run('INSERT INTO badges (id, registration_id, token, issued_at) VALUES (?, ?, ?, ?)', [badge, id, id === rid ? badgeToken : crypto.randomUUID(), stamp])
  await db.run('INSERT INTO payments (id, registration_id, status, updated_at) VALUES (?, ?, ?, ?)', [crypto.randomUUID(), id, status, stamp])
  return `${id}:primary`
}
before(async () => {
  const app = await createStartedApp()
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  base = `http://127.0.0.1:${server.address().port}`
  db = await getDb()
  await seed(rid, bid, 'paid', 'TEST9001', true)
  pending = await seed(crypto.randomUUID(), crypto.randomUUID(), 'unpaid', 'TEST9003')
  cancelled = await seed(crypto.randomUUID(), crypto.randomUUID(), 'cancelled', 'TEST9004')
  bearer = (await request('POST', '/auth/login', { username: 'test.staff', password }, null)).body.token
  algerToken = (await request('POST', '/auth/login', { username: 'test.alger', password }, null)).body.token
})
after(async () => { if (server) await new Promise(resolve => server.close(resolve)) })
test('authentification, isolement des données et déconnexion', async () => {
  assert.ok(bearer)
  assert.equal((await request('GET', '/participants', null, null)).status, 401)
  assert.equal((await request('POST', '/auth/login', { username: 'test.staff', password: 'bad' }, null)).status, 401)
  const login = await request('POST', '/auth/login', { username: 'test.staff', password }, null)
  assert.equal((await request('POST', '/auth/logout', {}, login.body.token)).status, 200)
  assert.equal((await request('GET', '/me', null, login.body.token)).status, 401)
})
test('QR texte : nom ET passeport, sans correspondance floue', async () => {
  const r = await request('POST', '/resolve', { qr: 'HOG TOUR 2026\nNOM: TEST NADIA\nPASSPORT: TEST9001' })
  assert.equal(r.status, 200); assert.equal(r.body.participant.id, primary)
  assert.equal((await request('POST', '/resolve', { qr: 'HOG TOUR 2026\nNOM: INCONNU NADIA\nPASSPORT: TEST9001' })).status, 404)
  assert.equal((await request('POST', '/resolve', { qr: 'HOG TOUR 2026\nNOM: TEST NADIA\nPASSPORT: ' })).status, 422)
  assert.equal((await request('POST', '/resolve', { qr: 'garbage' })).status, 400)
})
test('URLs signées, références badge, accompagnants individuels', async () => {
  const r = await request('POST', '/resolve', { qr: `https://example.invalid/v1/badge?token=${badgeToken}&sig=${signToken(badgeToken)}` })
  assert.equal(r.body.participant.id, primary)
  assert.equal((await request('POST', '/resolve', { qr: `https://example.invalid/v1/badge?token=${badgeToken}&sig=bad` })).status, 400)
  assert.equal((await request('POST', '/resolve', { qr: bid + '-P' })).body.participant.id, partner)
  assert.equal((await request('POST', '/resolve', { qr: 'HOG TOUR 2026\nNOM: EXEMPLE SAMIR\nPASSPORT: TEST9002' })).body.participant.id, partner)
})
test('ordre des étapes et droits par poste', async () => {
  assert.equal((await request('POST', `/participants/${primary}/actions`, { action: 'ghardaia', revision: 0 })).body.error, 'alger_required')
  assert.equal((await request('POST', `/participants/${primary}/actions`, { action: 'kit', revision: 0 })).body.error, 'ghardaia_required')
  assert.equal((await request('POST', `/participants/${primary}/actions`, { action: 'ghardaia', revision: 0 }, algerToken)).status, 403)
})
test('scans simultanés : une seule validation et un seul événement', async () => {
  const replies = await Promise.all(Array.from({ length: 6 }, () => request('POST', `/participants/${primary}/actions`, { action: 'alger', revision: 0 })))
  assert.ok(replies.every(r => r.status === 200), JSON.stringify(replies))
  assert.equal(replies.filter(r => !r.body.alreadyDone).length, 1)
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM checkin_events WHERE registration_id = ?', [rid])).n, 1)
  assert.equal((await request('GET', `/participants/${partner}`)).body.participant.checks.alger, null)
})
test('versions périmées, kit unique et installation hôtel', async () => {
  assert.equal((await request('POST', `/participants/${primary}/actions`, { action: 'ghardaia', revision: 0 })).body.error, 'stale_revision')
  assert.equal((await request('POST', `/participants/${primary}/actions`, { action: 'ghardaia', revision: 1 })).status, 200)
  assert.equal((await request('POST', `/participants/${primary}/actions`, { action: 'kit', revision: 2 })).status, 200)
  assert.equal((await request('POST', `/participants/${primary}/actions`, { action: 'kit', revision: 2 })).body.alreadyDone, true)
  // Sans numero de chambre, rien n'est enregistre.
  assert.equal((await request('POST', `/participants/${primary}/actions`, { action: 'hotel', revision: 3 })).body.error, 'room_required')
  const body = { action: 'hotel', revision: 3, hotelName: 'Hôtel Test', roomNumber: '204A' }
  assert.equal((await request('POST', `/participants/${primary}/actions`, body)).body.participant.roomNumber, '204A')
  assert.equal((await request('POST', `/participants/${primary}/actions`, { ...body, roomNumber: '205' })).body.error, 'hotel_already_assigned')
  assert.equal((await request('GET', `/participants/${primary}`)).body.history.length, 4)
})
test('paiements : confirmation explicite et blocage annulations', async () => {
  assert.equal((await request('POST', `/participants/${pending}/actions`, { action: 'alger', revision: 0 })).body.error, 'payment_ack_required')
  assert.equal((await request('POST', `/participants/${pending}/actions`, { action: 'alger', revision: 0, acknowledgePayment: true })).status, 200)
  assert.equal((await request('POST', `/participants/${cancelled}/actions`, { action: 'alger', revision: 0, acknowledgePayment: true })).body.error, 'payment_blocked')
})
test('recherche, pagination, tableaux de bord et absence de secrets dans les réponses', async () => {
  const r = await request('GET', '/participants?q=Samir&limit=1')
  assert.equal(r.body.items.length, 1); assert.equal(r.body.items[0].id, partner)
  assert.equal((await request('GET', '/participants?limit=1')).body.nextOffset, 1)
  const stats = (await request('GET', '/dashboard')).body
  assert.deepEqual([stats.total, stats.alger, stats.ghardaia, stats.kit, stats.hotel], [4, 2, 1, 1, 1])
  assert.equal((await request('GET', '/participants?stage=BAD')).status, 400)
  assert.ok(!JSON.stringify(r.body).includes('client_secret'))
})
test('hôtel par défaut : l’agent ne saisit que la chambre', async () => {
  const { defaultHotel } = require('../src/checkin/service')
  // L'application apprend l'hotel de l'evenement a la connexion et le pre-remplit.
  assert.equal((await request('GET', '/me')).body.defaultHotel, defaultHotel())
  const login = await request('POST', '/auth/login', { username: 'test.staff', password }, null)
  assert.equal(login.body.defaultHotel, defaultHotel())
  // Champ hotel laisse vide : le serveur retombe sur l'hotel de l'evenement.
  const p = (await request('GET', `/participants/${partner}`)).body.participant
  let revision = p.revision
  for (const action of ['alger', 'ghardaia', 'kit']) {
    const r = await request('POST', `/participants/${partner}/actions`, { action, revision })
    assert.equal(r.status, 200, `${action}: ${JSON.stringify(r.body)}`)
    revision = r.body.participant.revision
  }
  const done = await request('POST', `/participants/${partner}/actions`, { action: 'hotel', revision, roomNumber: '112' })
  assert.equal(done.status, 200, JSON.stringify(done.body))
  assert.equal(done.body.participant.hotelName, defaultHotel())
  assert.equal(done.body.participant.roomNumber, '112')
})
test('badge ambigu refusé et compte désactivé immédiatement révoqué', async () => {
  const duplicate = JSON.stringify({ prenom: 'Nadia', nom: 'Test', passportNum: 'TEST9001' })
  await db.run('UPDATE registrations SET partner_info = ? WHERE id = ?', [duplicate, pending.split(':')[0]])
  assert.equal((await request('POST', '/resolve', { qr: 'HOG TOUR 2026\nNOM: TEST NADIA\nPASSPORT: TEST9001' })).body.error, 'ambiguous_badge')
  const users = JSON.parse(fs.readFileSync(process.env.CHECKIN_USERS_FILE, 'utf8'))
  users[0].disabled = true; fs.writeFileSync(process.env.CHECKIN_USERS_FILE, JSON.stringify(users))
  assert.equal((await request('GET', '/dashboard')).status, 401)
})
