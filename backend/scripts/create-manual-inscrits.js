/**
 * Crée manuellement des inscrits + badge signé, directement en base.
 *
 * Pour ajouter des participants hors formulaire (ex : on n'a que le passeport).
 * L'inscrit apparaît dans l'admin et son badge (QR) est résolvable au check-in.
 *
 * Fonctionne quel que soit le driver (sqlite ou mysql) : il réutilise src/db.js
 * et src/security.js, donc le token de badge est signé exactement comme en prod.
 * Les colonnes absentes du schéma sont ignorées automatiquement.
 *
 * ── Usage (sur le VPS, dans /var/www/hogtour/backend) ──
 *
 *   node scripts/create-manual-inscrits.js "SPEC1" "SPEC2"
 *
 * Une SPEC = champs séparés par des virgules, dans cet ordre (seul le 1er est requis) :
 *   passeport,NOM,Prénom,email,sexe,zone,nationalité
 *
 *   - sexe        : "Femme" | "Homme"
 *   - zone        : "Algérie" | "Lybie" | "Tunisie" | "Espagne / Portugal" | "Ailleurs"
 *   - nationalité : "Algérienne" ou libre (ex "Française" → stocké en nationalite_autre)
 *
 * Exemple :
 *   node scripts/create-manual-inscrits.js --onsite \
 *     "304953240,GIBELLA,Cynthia Yamina Antoinette,,Femme,Algérie,Algérienne" \
 *     "25HH89159,GIBELLA,Antonio,,Homme,Ailleurs,Française"
 *
 * ── Options ──
 *   --onsite            paiement sur place : paiement_mode/method = 'on_site', statut 'unpaid'
 *   --status <s>        statut de paiement si pas --onsite (défaut: "paid")
 *   --zone <z>          zone par défaut si absente de la SPEC (défaut: "Algérie")
 *   --dry-run           n'écrit rien, affiche ce qui serait fait
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
const ONSITE = args.includes('--onsite')

function optValue(name, def) {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : def
}

const DEFAULT_ZONE = optValue('--zone', 'Algérie')
const STATUS = ONSITE ? 'unpaid' : optValue('--status', 'paid')
const PAYMENT_MODE = ONSITE ? 'on_site' : 'manual'
const PAYMENT_METHOD = ONSITE ? 'on_site' : 'manual'

const VALID_ZONES = ['Algérie', 'Lybie', 'Tunisie', 'Espagne / Portugal', 'Ailleurs']

const FLAGS_WITH_VALUE = new Set(['--status', '--zone'])
const specs = []
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a.startsWith('--')) {
    if (FLAGS_WITH_VALUE.has(a)) i++
    continue
  }
  specs.push(a)
}

if (!specs.length) {
  console.error('Aucun inscrit fourni. Voir l\'en-tête du script pour le format des SPEC.')
  process.exit(1)
}

const nowIso = () => new Date().toISOString()
const uuid = () => crypto.randomUUID()

function parseSpec(raw) {
  const parts = String(raw).split(',').map(s => (s || '').trim())
  const [passport, nomRaw, prenomRaw, emailRaw, sexeRaw, zoneRaw, natRaw] = parts
  if (!passport) throw new Error(`SPEC invalide (passeport manquant): "${raw}"`)

  const nom = nomRaw || 'INVITE'
  const prenom = prenomRaw || passport
  const email = emailRaw || `${passport.toLowerCase()}@no-email.hogtour`

  let sexe = 'NA'
  if (/^f/i.test(sexeRaw || '')) sexe = 'Femme'
  else if (/^h|^m/i.test(sexeRaw || '')) sexe = 'Homme'

  let zone = zoneRaw || DEFAULT_ZONE
  if (!VALID_ZONES.includes(zone)) {
    throw new Error(`Zone invalide "${zone}" pour ${passport}. Valeurs: ${VALID_ZONES.join(' | ')}`)
  }

  let nationalite = 'NA'
  let nationaliteAutre = null
  const nat = (natRaw || '').trim()
  if (nat) {
    if (/^alg/i.test(nat)) nationalite = 'Algérienne'
    else { nationalite = 'Autre'; nationaliteAutre = nat }
  }

  return { passport, nom, prenom, email, sexe, zone, nationalite, nationaliteAutre }
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
  console.log(`Paiement: ${PAYMENT_MODE} (statut ${STATUS}) | Base URL: ${baseUrl}\n`)

  const created = []

  for (const raw of specs) {
    const s = parseSpec(raw)

    const existing = await db.get(`SELECT id FROM registrations WHERE passport_num = ?`, [s.passport])
    if (existing && existing.id) {
      console.log(`⚠  passeport "${s.passport}" déjà présent (registration ${existing.id}) — ignoré`)
      continue
    }

    const registrationId = uuid()
    const token = newToken()
    const ts = nowIso()
    const sig = signToken(token)
    const badgeUrl = `${baseUrl}/v1/badge?token=${encodeURIComponent(token)}&sig=${encodeURIComponent(sig)}`
    const pdfUrl = `${baseUrl}/v1/badge/pdf?token=${encodeURIComponent(token)}&sig=${encodeURIComponent(sig)}`

    console.log(`+ ${s.prenom} ${s.nom} | ${s.passport} | ${s.sexe} | ${s.zone} | ${s.nationaliteAutre || s.nationalite}`)
    console.log(`  reg   : ${registrationId}`)
    console.log(`  badge : ${badgeUrl}`)

    if (DRY_RUN) continue

    await insertRow(db, 'registrations', regCols, {
      id: registrationId, created_at: ts, updated_at: ts,
      prenom: s.prenom, nom: s.nom, sexe: s.sexe, adresse: 'NA', ville: 'NA',
      pays_iso2: 'DZ', phone_country_iso2: 'DZ', phone_number: 'NA', phone_e164: null,
      email: s.email, nationalite: s.nationalite, nationalite_autre: s.nationaliteAutre,
      residence_zone: s.zone, moto_modele: null,
      profil: 'Solo', profil_groupe: null,
      hebergement: '', taille_tshirt: 'NA', paiement_mode: PAYMENT_MODE,
      permis_num: 'NA', immatriculation: 'NA', passport_num: s.passport,
    })

    await insertRow(db, 'payments', payCols, {
      id: uuid(), registration_id: registrationId, status: STATUS,
      amount_cents: null, currency: null, method: PAYMENT_METHOD, reference: null,
      updated_at: ts, updated_by: 'manual-script',
    })

    await insertRow(db, 'badges', badgeCols, {
      id: uuid(), registration_id: registrationId, token, issued_at: ts,
    })

    created.push({ ...s, registrationId, badgeUrl, pdfUrl })
    console.log(`  pdf   : ${pdfUrl}`)
  }

  console.log(`\n=== Terminé : ${created.length} inscrit(s) créé(s) ===`)
  for (const c of created) {
    console.log(`- ${c.prenom} ${c.nom} (${c.passport})\n    badge : ${c.badgeUrl}\n    pdf   : ${c.pdfUrl}`)
  }
  console.log()
  process.exit(0)
}

run().catch(e => { console.error('ERREUR:', e && e.message ? e.message : e); process.exit(1) })
