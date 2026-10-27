const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hog-members-test-'))
process.env.DB_DRIVER = 'sqlite'
process.env.DATABASE_PATH = path.join(dir, 'test.sqlite')
process.env.UPLOADS_DIR = path.join(dir, 'uploads')
process.env.QR_SIGNING_SECRET = crypto.randomBytes(32).toString('hex')
process.env.CHECKIN_USERS_FILE = path.join(dir, 'users.json')
process.env.MAIL_DISABLED = 'true'
const salt = crypto.randomBytes(16).toString('hex')
const password = 'Test-password-only-123'
fs.writeFileSync(process.env.CHECKIN_USERS_FILE, JSON.stringify([
  { username: 'test.staff', name: 'Agent Test', stations: ['alger', 'ghardaia'], passwordHash: `scrypt:${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}` },
]))
const { createStartedApp } = require('../src/app')
const { HOG_TARIFFS } = require('../src/tariffs')
let server, base, bearer
const GROUP = "Membre d'un groupe de Motards"
let counter = 0
async function register(fields) {
  counter++
  const form = new FormData()
  const data = {
    prenom: 'Karim', nom: `Membre${counter}`, sexe: 'Homme', adresse: '1 rue Test', ville: 'Alger', paysIso2: 'DZ',
    phoneCountryIso2: 'DZ', phoneNumber: '0555000000', phoneE164: '+213555000000', email: 'test@example.invalid',
    nationalite: 'Algérienne', residenceZone: 'Algérie', harleyOwner: 'Oui', motoModele: 'Sportster',
    profil: 'Solo', tailleTshirt: 'M', paiementMode: 'on_site', permisNum: `PERM${counter}`,
    immatriculation: `IMM${counter}`, passportNum: `PASS${counter}`, ...fields,
  }
  for (const [k, v] of Object.entries(data)) if (v !== undefined) form.set(k, v)
  for (const name of ['permis.jpg', 'passeport.jpg', 'carte.jpg']) form.append('files', new Blob([Buffer.from('x')], { type: 'image/jpeg' }), name)
  const res = await fetch(`${base}/v1/registrations`, { method: 'POST', body: form })
  const body = await res.json()
  return { status: res.status, body, paymentId: new URL(body.payment?.url || 'http://x/?').searchParams.get('paymentId') }
}
const sig = id => require('../src/security').signToken(id)
async function info(paymentId) {
  return (await fetch(`${base}/v1/payments/info?paymentId=${paymentId}&sig=${encodeURIComponent(sig(paymentId))}`)).json()
}
async function choose(paymentId, hebergement) {
  const form = new FormData()
  form.set('paymentId', paymentId); form.set('sig', sig(paymentId)); form.set('hebergement', hebergement)
  const res = await fetch(`${base}/v1/payments/choose-accommodation`, { method: 'POST', body: form })
  return { status: res.status, body: await res.json() }
}
async function checkin(method, url, body, token = bearer) {
  const r = await fetch(`${base}/v1/checkin${url}`, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) })
  return { status: r.status, body: await r.json() }
}
before(async () => {
  const app = await createStartedApp()
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  base = `http://127.0.0.1:${server.address().port}`
  bearer = (await checkin('POST', '/auth/login', { username: 'test.staff', password }, null)).body.token
})
after(async () => { if (server) await new Promise(resolve => server.close(resolve)) })

test('grille H.O.G : six chambres, prix de la chambre et part par motard', () => {
  assert.deepEqual(HOG_TARIFFS.map(t => t.roomCents / 100), [53000, 85000, 90000, 107800, 162000, 157000])
  assert.deepEqual(HOG_TARIFFS.map(t => t.perPersonCents / 100), [53000, 85000, 45000, 107800, 81000, 157000])
})

test('hors membre : le nom du groupe reste obligatoire, comme avant', async () => {
  const r = await register({ profil: GROUP })
  assert.equal(r.status, 400); assert.deepEqual(r.body.fields, ['profilGroupe'])
})

test('membre H.O.G : aucun groupe à saisir, le H.O.G est son groupe', async () => {
  assert.equal((await register({ hogMember: 'Oui', profil: GROUP })).status, 201)
  assert.equal((await register({ hogMember: 'Oui', profil: 'Solo' })).status, 201)
  // Même si un nom est envoyé, le groupe enregistré est celui du H.O.G.
  const r = await register({ hogMember: 'Oui', profil: GROUP, profilGroupe: 'Autre club' })
  const db = await require('../src/db').getDb()
  assert.equal((await db.get('SELECT profil_groupe FROM registrations WHERE id = ?', [r.body.id])).profil_groupe, 'H.O.G Algérie')
})

test('non-membre en groupe : son groupe est enregistré tel quel', async () => {
  const r = await register({ hogMember: 'Non', profil: GROUP, profilGroupe: 'Atlas Riders' })
  assert.equal(r.status, 201)
  const db = await require('../src/db').getDb()
  assert.equal((await db.get('SELECT profil_groupe, hog_member FROM registrations WHERE id = ?', [r.body.id])).profil_groupe, 'Atlas Riders')
})

test('membre H.O.G : seule la grille membres est proposée et facturée', async () => {
  const { paymentId } = await register({ hogMember: 'Oui' })
  const i = await info(paymentId)
  assert.equal(i.hogMember, true); assert.equal(i.hogOptions.length, 6)
  // La grille publique est refusée pour un membre, et réciproquement.
  assert.equal((await choose(paymentId, 'Chambre simple')).body.error, 'invalid_hebergement')
  const ok = await choose(paymentId, HOG_TARIFFS[0].value)
  assert.equal(ok.status, 200, JSON.stringify(ok.body))
  assert.deepEqual([ok.body.amountCents, ok.body.currency], [5300000, 'DZD'])
  // Chambre partagée par deux motards : chacun règle sa moitié.
  const other = await register({ hogMember: 'Oui' })
  const shared = await choose(other.paymentId, HOG_TARIFFS[4].value)
  assert.deepEqual([shared.body.amountCents, shared.body.currency], [8100000, 'DZD'])
})

test('non-membre : grille publique inchangée, tarifs membres refusés', async () => {
  const { paymentId } = await register({})
  const i = await info(paymentId)
  assert.equal(i.hogMember, false); assert.deepEqual(i.hogOptions, [])
  assert.equal((await choose(paymentId, HOG_TARIFFS[0].value)).body.error, 'invalid_hebergement')
  const ok = await choose(paymentId, 'Chambre simple')
  assert.deepEqual([ok.body.amountCents, ok.body.currency], [7500000, 'DZD'])
})

test('check-in : le membre est signalé avec son tarif et la grille est exposée', async () => {
  const { paymentId } = await register({ hogMember: 'Oui' })
  await choose(paymentId, HOG_TARIFFS[3].value)
  const list = (await checkin('GET', '/participants?limit=100')).body.items
  const member = list.filter(p => p.hogMember)
  assert.ok(member.length >= 1)
  const mine = member.find(p => p.accommodation === HOG_TARIFFS[3].value)
  assert.equal(mine.amountCents, 10780000); assert.equal(mine.hogTariff.roomCents, 10780000)
  assert.ok(list.some(p => !p.hogMember))
  assert.equal((await checkin('GET', `/participants/${encodeURIComponent(mine.id)}`)).body.participant.hogMember, true)
  const grid = await checkin('GET', '/tariffs')
  assert.equal(grid.body.hog.length, 6)
  assert.equal((await checkin('GET', '/tariffs', null, null)).status, 401)
})
