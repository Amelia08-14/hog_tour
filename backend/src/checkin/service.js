const { randomUUID } = require('node:crypto')
const { getDb, withTransaction } = require('../db')
const { signToken, safeEqual } = require('../security')
const { hogTariff } = require('../tariffs')
const FIELDS = ['alger', 'ghardaia', 'kit', 'hotel']
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
const passportKey = value => normalize(value).replace(/ /g, '')
const mysql = () => String(process.env.DB_DRIVER || 'sqlite').toLowerCase() === 'mysql'
function fault(status, error, message) { return Object.assign(new Error(message), { status, code: error }) }
// Tous les participants logent au meme hotel. L'agent ne saisit donc que le
// numero de chambre. Modifiable par CHECKIN_DEFAULT_HOTEL dans le .env du
// serveur, sans recompiler ni reinstaller l'application.
const defaultHotel = () => String(process.env.CHECKIN_DEFAULT_HOTEL || 'Hôtel Belvédère Ghardaïa').trim().slice(0, 160)
function partnerOf(row) {
  try {
    const p = typeof row.partner_info === 'object' ? row.partner_info : JSON.parse(row.partner_info || 'null')
    return p?.prenom && p?.nom ? p : null
  } catch { return null }
}
function person(row, role, record = {}, payment = {}) {
  const p = role === 'partner' ? partnerOf(row) : null
  if (role === 'partner' && !p) return null
  const checks = Object.fromEntries(FIELDS.map(field => [field, record[`${field}_at`] ? {
    at: record[`${field}_at`], by: record[`${field}_by`],
  } : null]))
  return {
    id: `${row.id}:${role}`, registrationId: row.id, role,
    firstName: p?.prenom || row.prenom, lastName: p?.nom || row.nom,
    passport: p ? String(p.passportNum || '') : String(row.passport_num || ''),
    country: p?.nationalite || row.residence_zone || row.nationalite || row.pays_iso2,
    tshirt: p?.tailleTshirt || row.taille_tshirt,
    accommodation: row.hebergement,
    // Membre du H.O.G Algérie (déclaré à l'inscription) : tarifs référentiels. Le
    // tarif retenu, s'il existe, accompagne la fiche pour l'afficher à l'accueil.
    hogMember: !!Number(row.hog_member),
    hogTariff: hogTariff(row.hebergement),
    group: row.profil_groupe || row.profil || '',
    paymentStatus: payment.status || 'unknown',
    // Tous les participants reglent a l'accueil : l'agent a besoin du montant,
    // pas d'un avertissement.
    paymentMethod: payment.method || '',
    amountCents: Number.isFinite(Number(payment.amount_cents)) ? Number(payment.amount_cents) : null,
    currency: payment.currency || '',
    revision: Number(record.revision || 0), checks,
    hotelName: record.hotel_name || '', roomNumber: record.room_number || '',
  }
}
async function snapshot(db = null) {
  db = db || await getDb()
  const rows = await db.all('SELECT id, prenom, nom, passport_num, residence_zone, nationalite, pays_iso2, taille_tshirt, hebergement, profil_groupe, profil, partner_info, hog_member FROM registrations ORDER BY nom, prenom, id')
  const records = await db.all('SELECT * FROM checkin_records')
  // Plusieurs paiements possibles : statut du dernier, ordre déterministe.
  const payments = await db.all('SELECT registration_id, status, method, amount_cents, currency FROM payments ORDER BY updated_at DESC, id DESC')
  const recordMap = new Map(records.map(r => [`${r.registration_id}:${r.person_role}`, r]))
  const paymentMap = new Map()
  for (const p of payments) if (!paymentMap.has(p.registration_id)) paymentMap.set(p.registration_id, p)
  const result = []
  for (const row of rows) for (const role of ['primary', 'partner']) {
    const p = person(row, role, recordMap.get(`${row.id}:${role}`), paymentMap.get(row.id))
    if (p) result.push(p)
  }
  return result
}
function parsePersonId(id) {
  const match = /^([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}):(primary|partner)$/i.exec(String(id || ''))
  if (!match) throw fault(400, 'invalid_person', 'Participant invalide.')
  return { registrationId: match[1], role: match[2] }
}
async function getPerson(id, db = null) {
  db = db || await getDb()
  const { registrationId, role } = parsePersonId(id)
  const row = await db.get('SELECT * FROM registrations WHERE id = ?', [registrationId])
  if (!row) throw fault(404, 'not_found', 'Inscription introuvable.')
  const record = await db.get('SELECT * FROM checkin_records WHERE registration_id = ? AND person_role = ?', [registrationId, role])
  const payment = await db.get('SELECT status, method, amount_cents, currency FROM payments WHERE registration_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1', [registrationId])
  const value = person(row, role, record || {}, payment || {})
  if (!value) throw fault(404, 'not_found', 'Accompagnant introuvable.')
  return value
}
async function resolveQr(raw) {
  if (typeof raw !== 'string' || raw.length > 4096 || !raw.trim()) throw fault(400, 'invalid_qr', 'QR code vide ou invalide.')
  const input = raw.trim()
  const db = await getDb()
  if (/^https?:\/\//i.test(input)) {
    let url
    try { url = new URL(input) } catch { throw fault(400, 'invalid_qr', 'Lien QR invalide.') }
    const token = url.searchParams.get('token') || ''
    const sig = url.searchParams.get('sig') || ''
    if (!token || !sig || !safeEqual(sig, signToken(token))) throw fault(400, 'invalid_signature', 'Signature du badge invalide.')
    const b = await db.get('SELECT registration_id FROM badges WHERE token = ?', [token])
    if (!b) throw fault(404, 'not_found', 'Badge inconnu dans cette base.')
    return { participant: await getPerson(`${b.registration_id}:primary`), verification: 'signed_url' }
  }
  const badgeId = /^([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})(-P)?$/i.exec(input)
  if (badgeId) {
    const b = await db.get('SELECT registration_id FROM badges WHERE id = ?', [badgeId[1]])
    if (!b) throw fault(404, 'not_found', 'Référence de badge inconnue.')
    return { participant: await getPerson(`${b.registration_id}:${badgeId[2] ? 'partner' : 'primary'}`), verification: 'badge_id' }
  }
  const text = /^HOG TOUR 2026\s*\r?\nNOM:\s*([^\r\n]+)\r?\nPASSPORT:\s*([^\r\n]*)\s*$/i.exec(input)
  if (!text) throw fault(400, 'unsupported_qr', 'Ce QR code ne correspond pas à un badge HOG Tour 2026.')
  const passport = passportKey(text[2])
  if (!passport) throw fault(422, 'missing_passport', 'Le badge ne contient pas de passeport. Recherche le participant et vérifie son identité.')
  const candidates = (await snapshot(db)).filter(p => passportKey(p.passport) === passport && normalize(`${p.lastName} ${p.firstName}`) === normalize(text[1]))
  if (!candidates.length) throw fault(404, 'not_found', 'Aucune inscription ne correspond au nom et au passeport de ce badge.')
  if (candidates.length !== 1) throw fault(409, 'ambiguous_badge', 'Plusieurs inscriptions correspondent. Vérification manuelle nécessaire.')
  return { participant: candidates[0], verification: 'legacy_text' }
}
async function act(id, body, staff) {
  const { registrationId, role } = parsePersonId(id)
  const action = body.action
  if (!FIELDS.includes(action)) throw fault(400, 'invalid_action', 'Action inconnue.')
  const station = action === 'alger' ? 'alger' : 'ghardaia'
  if (!staff.stations.includes(station)) throw fault(403, 'station_forbidden', 'Ton compte n’est pas autorisé pour cette étape.')
  if (!Number.isInteger(body.revision) || body.revision < 0) throw fault(400, 'revision_required', 'Actualise la fiche avant de confirmer.')
  // Champ laisse vide : on retombe sur l'hotel de l'evenement.
  const hotelName = (typeof body.hotelName === 'string' ? body.hotelName.trim() : '') || defaultHotel()
  const roomNumber = typeof body.roomNumber === 'string' ? body.roomNumber.trim() : ''
  if (action === 'hotel' && (!roomNumber || roomNumber.length > 40)) throw fault(400, 'room_required', 'Renseigne le numéro de chambre.')
  return withTransaction(async db => {
    // Verrou par inscription : plusieurs téléphones ne peuvent pas valider en parallèle.
    const exists = await db.get(`SELECT id FROM registrations WHERE id = ?${mysql() ? ' FOR UPDATE' : ''}`, [registrationId])
    if (!exists) throw fault(404, 'not_found', 'Inscription introuvable.')
    const p = await getPerson(id, db)
    if (p.checks[action]) {
      if (action === 'hotel' && (p.hotelName !== hotelName || p.roomNumber !== roomNumber)) throw fault(409, 'hotel_already_assigned', 'Une autre chambre est déjà enregistrée. Consulte le responsable.')
      return { participant: p, alreadyDone: true }
    }
    if (p.revision !== body.revision) throw fault(409, 'stale_revision', 'La fiche a changé sur un autre appareil. Actualise-la avant de confirmer.')
    if (['cancelled', 'refunded'].includes(p.paymentStatus)) throw fault(409, 'payment_blocked', 'Inscription annulée ou remboursée. Consulte le responsable.')
    if (action === 'ghardaia' && !p.checks.alger) throw fault(409, 'alger_required', 'Le check-in à Alger doit être enregistré en premier.')
    if (['kit', 'hotel'].includes(action) && !p.checks.ghardaia) throw fault(409, 'ghardaia_required', 'Enregistre d’abord l’arrivée à Ghardaïa.')
    if (!p.revision) await db.run('INSERT INTO checkin_records (registration_id, person_role, revision) VALUES (?, ?, 0)', [registrationId, role])
    const at = new Date().toISOString()
    const params = [at, staff.username]
    let sql = `UPDATE checkin_records SET ${action}_at = ?, ${action}_by = ?, revision = revision + 1`
    if (action === 'hotel') { sql += ', hotel_name = ?, room_number = ?'; params.push(hotelName, roomNumber) }
    sql += ' WHERE registration_id = ? AND person_role = ?'
    params.push(registrationId, role)
    await db.run(sql, params)
    await db.run(`INSERT INTO checkin_events (id, registration_id, person_role, action, occurred_at, staff_username, staff_name, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), registrationId, role, action, at, staff.username, staff.name, JSON.stringify({ paymentStatus: p.paymentStatus, paymentMethod: p.paymentMethod, amountCents: p.amountCents, ...(action === 'hotel' ? { hotelName, roomNumber } : {}) })])
    return { participant: await getPerson(id, db), alreadyDone: false }
  })
}
module.exports = { snapshot, resolveQr, getPerson, act, fault, FIELDS, normalize, defaultHotel }
