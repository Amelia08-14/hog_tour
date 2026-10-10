/**
 * Base de DÉMONSTRATION pour présenter le check-in à l'équipe.
 *
 * Crée une base SQLite séparée, remplie de participants fictifs, et une
 * planche de badges imprimable dont les QR codes sont réellement scannables
 * par l'application. Rien n'est écrit dans la base réelle.
 *
 *   node scripts/demo-seed.js
 *
 * Options :
 *   --db <chemin>   base de démo (défaut: ./data/hogtour-demo.sqlite)
 *   --sheet <chemin> planche de badges HTML (défaut: ./data/demo-badges.html)
 *   --keep          ne pas recréer la base si elle existe déjà
 *
 * Ensuite, démarrer le backend sur cette base :
 *   DATABASE_PATH=./data/hogtour-demo.sqlite PORT=4100 npm start
 */
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

function opt(name, def) {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const KEEP = process.argv.includes('--keep')
const DB_PATH = path.resolve(opt('--db', './data/hogtour-demo.sqlite'))
const SHEET_PATH = path.resolve(opt('--sheet', './data/demo-badges.html'))

// Garde-fou : ce script écrit des données fictives, il ne doit jamais
// pouvoir viser la base des inscriptions réelles.
if (!/demo/i.test(path.basename(DB_PATH))) {
  console.error(`Refus : le nom du fichier doit contenir « demo » (reçu : ${path.basename(DB_PATH)}).`)
  console.error('Ce script insère des participants fictifs ; il ne doit pas toucher la base réelle.')
  process.exit(1)
}

process.env.DB_DRIVER = 'sqlite'
process.env.DATABASE_PATH = DB_PATH
process.env.QR_SIGNING_SECRET = process.env.QR_SIGNING_SECRET || 'demo_signing_secret'
process.env.MAIL_DISABLED = 'true'

const uuid = () => crypto.randomUUID()
const iso = d => new Date(d).toISOString()
// Jour 1 du tour : jeudi 29 octobre 2026, heure d'Algérie (UTC+1).
const J1 = Date.parse('2026-10-29T06:00:00Z')
const h = (hours, minutes = 0) => iso(J1 + hours * 3600_000 + minutes * 60_000)

const HEBERGEMENT = [
  'Chambre simple (480 €)',
  'Chambre double couple (760 €)',
  'Chambre double partagée (640 €)',
]
const TSHIRTS = ['S', 'M', 'L', 'XL', 'XXL']

/**
 * Chaque cas métier de l'application est représenté au moins une fois :
 * paiement en attente, inscription annulée, accompagnant, étapes déjà
 * validées, participants encore à accueillir.
 */
const PEOPLE = [
  // ── Déjà arrivés à Alger et à Ghardaïa, parcours complet ────────────────
  { nom: 'BENSALEM', prenom: 'Karim', passport: 'DZ4471203', sexe: 'Homme', zone: 'Algérie', nat: 'Algérienne', pay: 'paid', etape: 'hotel', hotel: 'Hôtel Belvédère Ghardaïa', chambre: '204' },
  { nom: 'HADDAD', prenom: 'Mounir', passport: 'DZ5582914', sexe: 'Homme', zone: 'Algérie', nat: 'Algérienne', pay: 'paid', etape: 'hotel', hotel: 'Hôtel Belvédère Ghardaïa', chambre: '205' },
  { nom: 'LARBI', prenom: 'Sofiane', passport: 'DZ3390887', sexe: 'Homme', zone: 'Algérie', nat: 'Algérienne', pay: 'paid', etape: 'kit' },
  { nom: 'ZERROUKI', prenom: 'Yacine', passport: 'DZ6612045', sexe: 'Homme', zone: 'Algérie', nat: 'Algérienne', pay: 'paid', etape: 'kit' },

  // ── Arrivés à Ghardaïa, kit pas encore remis ────────────────────────────
  { nom: 'MEZIANE', prenom: 'Lotfi', passport: 'DZ7723118', sexe: 'Homme', zone: 'Algérie', nat: 'Algérienne', pay: 'paid', etape: 'ghardaia' },
  { nom: 'BOUDJEMAA', prenom: 'Nadir', passport: 'DZ8814562', sexe: 'Homme', zone: 'Algérie', nat: 'Algérienne', pay: 'paid', etape: 'ghardaia',
    partner: { prenom: 'Samira', nom: 'BOUDJEMAA', passportNum: 'DZ8814563', nationalite: 'Algérienne', tailleTshirt: 'S' } },

  // ── Arrivés à Alger seulement ───────────────────────────────────────────
  { nom: 'CHERIF', prenom: 'Amine', passport: 'DZ2205774', sexe: 'Homme', zone: 'Algérie', nat: 'Algérienne', pay: 'paid', etape: 'alger' },
  { nom: 'OULD KADA', prenom: 'Rachid', passport: 'DZ9930441', sexe: 'Homme', zone: 'Algérie', nat: 'Algérienne', pay: 'paid', etape: 'alger' },
  { nom: 'SAADI', prenom: 'Djamel', passport: 'DZ1148930', sexe: 'Homme', zone: 'Algérie', nat: 'Algérienne', pay: 'paid', etape: 'alger' },
  { nom: 'TALEB', prenom: 'Farid', passport: 'DZ4408217', sexe: 'Homme', zone: 'Algérie', nat: 'Algérienne', pay: 'paid', etape: 'alger',
    partner: { prenom: 'Lynda', nom: 'TALEB', passportNum: 'DZ4408218', nationalite: 'Algérienne', tailleTshirt: 'M' } },
  { nom: 'MARTINEZ', prenom: 'Carlos', passport: 'ESP774120', sexe: 'Homme', zone: 'Espagne / Portugal', nat: 'Espagnole', pay: 'paid', etape: 'alger' },
  { nom: 'BEN AMMAR', prenom: 'Slim', passport: 'TN3390142', sexe: 'Homme', zone: 'Tunisie', nat: 'Tunisienne', pay: 'paid', etape: 'alger' },

  // ── Pas encore accueillis : c'est sur eux qu'on fait la démo en direct ──
  { nom: 'KHELIFI', prenom: 'Sid Ahmed', passport: 'DZ5501376', sexe: 'Homme', zone: 'Algérie', nat: 'Algérienne', pay: 'paid', etape: null },
  { nom: 'BELKACEM', prenom: 'Nabil', passport: 'DZ6673209', sexe: 'Homme', zone: 'Algérie', nat: 'Algérienne', pay: 'paid', etape: null },
  { nom: 'AIT OUARAB', prenom: 'Malik', passport: 'DZ7784115', sexe: 'Homme', zone: 'Algérie', nat: 'Algérienne', pay: 'paid', etape: null },
  { nom: 'GHALEM', prenom: 'Réda', passport: 'DZ8895023', sexe: 'Homme', zone: 'Algérie', nat: 'Algérienne', pay: 'paid', etape: null },
  { nom: 'MOKRANI', prenom: 'Hakim', passport: 'DZ9906781', sexe: 'Homme', zone: 'Algérie', nat: 'Algérienne', pay: 'paid', etape: null,
    partner: { prenom: 'Assia', nom: 'MOKRANI', passportNum: 'DZ9906782', nationalite: 'Algérienne', tailleTshirt: 'S' } },
  { nom: 'ROSSI', prenom: 'Matteo', passport: 'ITA220934', sexe: 'Homme', zone: 'Ailleurs', nat: 'Italienne', pay: 'paid', etape: null },
  { nom: 'DUBOIS', prenom: 'Camille', passport: 'FRA885310', sexe: 'Femme', zone: 'Ailleurs', nat: 'Française', pay: 'paid', etape: null },
  { nom: 'AL FITOURI', prenom: 'Tarek', passport: 'LY4471098', sexe: 'Homme', zone: 'Lybie', nat: 'Libyenne', pay: 'paid', etape: null },

  // ── Paiement à vérifier : l'agent doit cocher une case avant de valider ─
  { nom: 'SELLAMI', prenom: 'Walid', passport: 'DZ3317650', sexe: 'Homme', zone: 'Algérie', nat: 'Algérienne', pay: 'unpaid', etape: null },
  { nom: 'HAMIDI', prenom: 'Omar', passport: 'DZ2209843', sexe: 'Homme', zone: 'Algérie', nat: 'Algérienne', pay: 'pending', etape: null },

  // ── Inscription annulée : l'accueil doit être bloqué ────────────────────
  { nom: 'BRAHIMI', prenom: 'Mehdi', passport: 'DZ1120477', sexe: 'Homme', zone: 'Algérie', nat: 'Algérienne', pay: 'cancelled', etape: null },

  // ── Participantes ───────────────────────────────────────────────────────
  { nom: 'YAHIAOUI', prenom: 'Souad', passport: 'DZ4432901', sexe: 'Femme', zone: 'Algérie', nat: 'Algérienne', pay: 'paid', etape: 'alger' },
  { nom: 'BENNOUR', prenom: 'Imene', passport: 'DZ5543012', sexe: 'Femme', zone: 'Algérie', nat: 'Algérienne', pay: 'paid', etape: null },
  { nom: 'FERHAT', prenom: 'Lamia', passport: 'DZ6654123', sexe: 'Femme', zone: 'Algérie', nat: 'Algérienne', pay: 'paid', etape: 'ghardaia' },
]

const AGENTS = {
  alger: { username: 'accueil.alger', name: 'Accueil Alger' },
  ghardaia: { username: 'accueil.ghardaia', name: 'Accueil Ghardaïa' },
}
const ORDER = ['alger', 'ghardaia', 'kit', 'hotel']
const AT = { alger: h(2, 15), ghardaia: h(11, 40), kit: h(12, 20), hotel: h(13, 5) }

async function tableColumns(db, table) {
  const rows = await db.all(`PRAGMA table_info(${table})`)
  return new Set(rows.map(r => r.name))
}
async function insertRow(db, table, cols, data) {
  const keys = Object.keys(data).filter(k => cols.has(k))
  await db.run(
    `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
    keys.map(k => data[k]),
  )
}

async function main() {
  if (fs.existsSync(DB_PATH) && !KEEP) {
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(DB_PATH + suffix) } catch {}
    }
  }
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

  // Le schéma est créé par la migration de l'application elle-même : la base
  // de démo est donc strictement identique à la vraie.
  const { createStartedApp } = require('../src/app')
  await createStartedApp()

  const { getDb } = require('../src/db')
  const { newToken, signToken } = require('../src/security')
  const db = await getDb()

  const already = await db.get('SELECT COUNT(*) AS n FROM registrations')
  if (already.n > 0 && KEEP) {
    console.log(`Base de démo conservée (${already.n} inscriptions).`)
    return finish(db)
  }

  const regCols = await tableColumns(db, 'registrations')
  const payCols = await tableColumns(db, 'payments')
  const badgeCols = await tableColumns(db, 'badges')

  let i = 0
  for (const p of PEOPLE) {
    const id = uuid()
    const token = newToken()
    const created = iso(Date.parse('2026-06-01T10:00:00Z') + i * 3600_000)
    await insertRow(db, 'registrations', regCols, {
      id, created_at: created, updated_at: created,
      prenom: p.prenom, nom: p.nom, sexe: p.sexe,
      adresse: 'NA', ville: p.zone === 'Algérie' ? 'Alger' : 'NA',
      pays_iso2: 'DZ', phone_country_iso2: 'DZ',
      phone_number: `05${String(50000000 + i * 137).slice(0, 8)}`, phone_e164: null,
      email: `${p.prenom}.${p.nom}`.toLowerCase().replace(/[^a-z.]/g, '') + '@demo.hogtour',
      nationalite: p.nat === 'Algérienne' ? 'Algérienne' : 'Autre',
      nationalite_autre: p.nat === 'Algérienne' ? null : p.nat,
      residence_zone: p.zone, moto_modele: 'Harley-Davidson',
      profil: p.partner ? "Membre d'un groupe de Motards" : 'Solo',
      profil_groupe: p.partner ? 'HOG Algiers' : null,
      hebergement: p.partner ? HEBERGEMENT[1] : HEBERGEMENT[i % 2 === 0 ? 0 : 2],
      taille_tshirt: TSHIRTS[i % TSHIRTS.length],
      paiement_mode: 'Par virement',
      permis_num: `P${100000 + i}`, immatriculation: `${100 + i}-ALG-16`,
      passport_num: p.passport,
      partner_info: p.partner ? JSON.stringify(p.partner) : null,
    })
    await insertRow(db, 'payments', payCols, {
      id: uuid(), registration_id: id, status: p.pay,
      amount_cents: 48000, currency: 'EUR', method: 'manual', reference: null,
      updated_at: created, updated_by: 'demo-seed',
    })
    await insertRow(db, 'badges', badgeCols, {
      id: uuid(), registration_id: id, token, issued_at: created,
    })

    // Étapes déjà validées : le tableau de bord n'est pas vide à l'ouverture.
    if (p.etape) {
      const done = ORDER.slice(0, ORDER.indexOf(p.etape) + 1)
      const roles = p.partner ? ['primary', 'partner'] : ['primary']
      for (const role of roles) {
        await db.run(
          'INSERT INTO checkin_records (registration_id, person_role, revision) VALUES (?, ?, ?)',
          [id, role, done.length],
        )
        for (const action of done) {
          const agent = action === 'alger' ? AGENTS.alger : AGENTS.ghardaia
          await db.run(
            `UPDATE checkin_records SET ${action}_at = ?, ${action}_by = ?${action === 'hotel' ? ', hotel_name = ?, room_number = ?' : ''} WHERE registration_id = ? AND person_role = ?`,
            action === 'hotel'
              ? [AT[action], agent.username, p.hotel, p.chambre, id, role]
              : [AT[action], agent.username, id, role],
          )
          await db.run(
            'INSERT INTO checkin_events (id, registration_id, person_role, action, occurred_at, staff_username, staff_name, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [uuid(), id, role, action, AT[action], agent.username, agent.name,
              JSON.stringify({ paymentStatus: p.pay, paymentAcknowledged: false })],
          )
        }
      }
    }
    i++
  }

  const partners = PEOPLE.filter(p => p.partner).length
  console.log(`Base de démo créée : ${DB_PATH}`)
  console.log(`  ${PEOPLE.length} inscriptions, dont ${partners} avec accompagnant`)
  console.log(`  ${PEOPLE.length + partners} personnes à accueillir au total`)
  return finish(db)
}

/** Planche de badges imprimable, aux QR réellement scannables. */
async function finish(db) {
  const QRCode = require('qrcode')
  const rows = await db.all(
    `SELECT r.prenom, r.nom, r.passport_num, r.partner_info, r.residence_zone, p.status
     FROM registrations r
     LEFT JOIN payments p ON p.registration_id = r.id
     ORDER BY r.nom, r.prenom`,
  )
  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const STATUS = { paid: ['Payé', '#1b7a3d'], unpaid: ['Paiement à vérifier', '#b35300'], pending: ['Paiement en attente', '#b35300'], cancelled: ['ANNULÉ', '#b00020'] }

  const cards = []
  for (const r of rows) {
    // Charge utile identique a celle du badge PDF reel du backend.
    const payload = [
      'HOG TOUR 2026',
      `NOM: ${String(r.nom).toUpperCase()} ${String(r.prenom).toUpperCase()}`,
      `PASSPORT: ${r.passport_num || ''}`,
    ].join('\n')
    const png = await QRCode.toDataURL(payload, { margin: 1, width: 320 })
    const partner = r.partner_info ? JSON.parse(r.partner_info) : null
    const [label, color] = STATUS[r.status] || ['Paiement non renseigné', '#b35300']
    cards.push(`<article class="b">
      <img src="${png}" alt="">
      <h2>${esc(String(r.nom).toUpperCase())} ${esc(r.prenom)}</h2>
      <p class="pp">Passeport ${esc(r.passport_num)}</p>
      <p class="st" style="color:${color}">${esc(label)}</p>
      ${partner ? `<p class="pa">+ accompagnant : ${esc(partner.prenom)} ${esc(partner.nom)}<br><span>à retrouver par recherche, pas de QR propre</span></p>` : ''}
    </article>`)
  }

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Badges de démonstration — HOG Algeria Tour 2026</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 24px; font-family: system-ui, "Segoe UI", sans-serif; background: #fff; color: #111; }
  header { margin-bottom: 20px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  header p { margin: 0; color: #a33; font-size: 13px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; }
  .b { border: 1px solid #ccc; border-radius: 10px; padding: 12px; text-align: center; break-inside: avoid; }
  .b img { width: 140px; height: 140px; }
  .b h2 { font-size: 13px; margin: 8px 0 2px; }
  .pp { font-size: 11px; color: #444; margin: 0; }
  .st { font-size: 11px; font-weight: 600; margin: 5px 0 0; }
  .pa { font-size: 10px; color: #b35300; margin: 6px 0 0; }
  .pa span { color: #777; }
  @media print { body { padding: 8mm; } header p { color: #a33; } .b { border-color: #999; } }
</style></head>
<body>
<header>
  <h1>HOG ALGERIA TOUR 2026 — badges de DÉMONSTRATION</h1>
  <p>Participants fictifs. Ces QR ne fonctionnent qu'avec la base de démo, jamais avec la base réelle.</p>
</header>
<div class="grid">${cards.join('\n')}</div>
</body></html>`

  fs.mkdirSync(path.dirname(SHEET_PATH), { recursive: true })
  fs.writeFileSync(SHEET_PATH, html, 'utf8')
  console.log(`Planche de badges : ${SHEET_PATH} (${rows.length} badges scannables)`)
  console.log("  Ouvre ce fichier dans un navigateur : scan direct depuis l’ecran, ou Ctrl+P pour imprimer.")
  console.log("")
  console.log("Demarrer le backend de demo :")
  const rel = path.relative(process.cwd(), DB_PATH).split(path.sep).join("/")
  console.log(`  DATABASE_PATH=${rel} PORT=4100 npm start`)
  // Replie le journal WAL dans le fichier principal : la base de demo reste
  // un seul fichier, copiable tel quel sur une autre machine.
  try { await db.exec('PRAGMA wal_checkpoint(TRUNCATE)') } catch {}
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
