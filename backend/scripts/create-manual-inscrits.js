/**
 * Crée manuellement des inscrits "passeport seul" + badge signé, directement en base.
 *
 * Utile pour ajouter des participants qui n'ont fourni que leur numéro de passeport :
 * l'inscrit apparaît dans l'admin et son badge (QR) est résolvable au check-in.
 *
 * Fonctionne quel que soit le driver (sqlite ou mysql) : il réutilise src/db.js
 * et src/security.js, donc le token de badge est signé exactement comme en prod.
 *
 * Usage (sur le VPS, dans le dossier backend) :
 *
 *   node scripts/create-manual-inscrits.js "P1234567" "X9876543"
 *
 *   # avec nom/prénom/email optionnels (séparés par des virgules, dans cet ordre) :
 *   node scripts/create-manual-inscrits.js "P1234567,DUPONT,Jean,jean@mail.com" "X9876543,MARTIN,Alice"
 *
 *   # aperçu sans rien écrire :
 *   node scripts/create-manual-inscrits.js --dry-run "P1234567" "X9876543"
 *
 * Options :
 *   --dry-run           n'écrit rien, montre ce qui serait fait
 *   --zone "Algérie"    residence_zone (défaut: "Algérie")
 *   --status paid       statut du paiement (défaut: "paid")
 */

// Charge la config : backend/.env en local, /etc/hogtour/backend.env sur le VPS (systemd).
{
  const fs = require('fs')
  const path = require('path')
  const localEnv = path.join(__dirname, '..', '.env')
  const vpsEnv = '/etc/hogtour/backend.env'
  if (fs.existsSync(localEnv)) require('dotenv').config({ path: localEnv })
  else if (fs.existsSync(vpsEnv)) require('dotenv').config({ path: vpsEnv })
  else require('dotenv').config()
}

const crypto = require('crypto')
const { getDb } = require('../src/db')
const { newToken, signToken } = require('../src/security')

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')

function optValue(name, def) {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : def
}

const ZONE = optValue('--zone', 'Algérie')
const STATUS = optValue('--status', 'paid')

// Tout ce qui n'est pas une option = une "spec" d'inscrit
const OPTION_FLAGS = new Set(['--dry-run', '--zone', '--status'])
const specs = []
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--dry-run') continue
  if (a === '--zone' || a === '--status') { i++; continue }
  if (a.startsWith('--')) continue
  specs.push(a)
}

if (!specs.length) {
  console.error('Aucun inscrit fourni.\nExemple : node scripts/create-manual-inscrits.js "P1234567" "X9876543"')
  process.exit(1)
}

function nowIso() {
  return new Date().toISOString()
}

function uuid() {
  return crypto.randomUUID()
}

function parseSpec(raw) {
  const [passportRaw, nomRaw, prenomRaw, emailRaw] = String(raw).split(',').map(s => (s || '').trim())
  const passport = passportRaw
  if (!passport) throw new Error(`spec invalide (passeport manquant): "${raw}"`)
  const nom = nomRaw || 'INVITE'
  const prenom = prenomRaw || passport
  const email = emailRaw || `${passport.toLowerCase()}@no-email.hogtour`
  return { passport, nom, prenom, email }
}

async function tableColumns(db, table) {
  const driver = String(process.env.DB_DRIVER || 'sqlite').toLowerCase()
  if (driver === 'mysql') {
    const rows = await db.all(
      `SELECT COLUMN_NAME AS name FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ?`,
      [table],
    )
    return new Set(rows.map(r => r.name))
  }
  const rows = await db.all(`PRAGMA table_info(${table})`)
  return new Set(rows.map(r => r.name))
}

async function insertRow(db, table, cols, data) {
  const keys = Object.keys(data).filter(k => cols.has(k))
  const placeholders = keys.map(() => '?').join(',')
  await db.run(
    `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`,
    keys.map(k => data[k]),
  )
}

async function run() {
  const db = await getDb()
  const regCols = await tableColumns(db, 'registrations')
  const payCols = await tableColumns(db, 'payments')
  const badgeCols = await tableColumns(db, 'badges')
  const baseUrl = (process.env.PUBLIC_BASE_URL || `http://localhost:${Number(process.env.PORT) || 4000}`).replace(/\/$/, '')

  console.log(`\n=== Création inscrits manuels ${DRY_RUN ? '[DRY RUN]' : ''} ===`)
  console.log(`Zone: ${ZONE} | Statut paiement: ${STATUS} | Base URL: ${baseUrl}\n`)

  const created = []

  for (const raw of specs) {
    const { passport, nom, prenom, email } = parseSpec(raw)

    const existing = await db.get(`SELECT id FROM registrations WHERE passport_num = ?`, [passport])
    if (existing && existing.id) {
      console.log(`⚠  passeport "${passport}" déjà présent (registration ${existing.id}) — ignoré`)
      continue
    }

    const registrationId = uuid()
    const paymentId = uuid()
    const badgeId = uuid()
    const token = newToken()
    const ts = nowIso()

    console.log(`+ ${prenom} ${nom} | passeport ${passport} | reg ${registrationId}`)

    if (DRY_RUN) {
      const sig = signToken(token)
      console.log(`  badge : ${baseUrl}/v1/badge?token=${encodeURIComponent(token)}&sig=${encodeURIComponent(sig)}`)
      continue
    }

    await insertRow(db, 'registrations', regCols, {
      id: registrationId, created_at: ts, updated_at: ts,
      prenom, nom, sexe: 'NA', adresse: 'NA', ville: 'NA',
      pays_iso2: 'DZ', phone_country_iso2: 'DZ', phone_number: 'NA', phone_e164: null,
      email, nationalite: 'NA', nationalite_autre: null,
      residence_zone: ZONE, moto_modele: null,
      profil: 'Invité', profil_groupe: null,
      hebergement: '', taille_tshirt: 'NA', paiement_mode: 'manual',
      permis_num: 'NA', immatriculation: 'NA', passport_num: passport,
    })

    await insertRow(db, 'payments', payCols, {
      id: paymentId, registration_id: registrationId, status: STATUS,
      amount_cents: null, currency: null, method: 'manual', reference: null,
      updated_at: ts, updated_by: 'manual-script',
    })

    await insertRow(db, 'badges', badgeCols, {
      id: badgeId, registration_id: registrationId, token, issued_at: ts,
    })

    const sig = signToken(token)
    const badgeUrl = `${baseUrl}/v1/badge?token=${encodeURIComponent(token)}&sig=${encodeURIComponent(sig)}`
    const pdfUrl = `${baseUrl}/v1/badge/pdf?token=${encodeURIComponent(token)}&sig=${encodeURIComponent(sig)}`
    created.push({ prenom, nom, passport, registrationId, badgeUrl, pdfUrl })
    console.log(`  badge : ${badgeUrl}`)
    console.log(`  pdf   : ${pdfUrl}`)
  }

  console.log(`\n=== Terminé : ${created.length} inscrit(s) créé(s) ===`)
  for (const c of created) {
    console.log(`- ${c.prenom} ${c.nom} (${c.passport})\n    ${c.badgeUrl}`)
  }
  console.log()
  process.exit(0)
}

run().catch(e => { console.error('ERREUR:', e && e.message ? e.message : e); process.exit(1) })
