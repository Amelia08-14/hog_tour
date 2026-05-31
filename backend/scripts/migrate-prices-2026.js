/**
 * Migration one-shot : mise à jour des tarifs EUR (mai 2026)
 *   480 € → 960 €  (Chambre simple)
 *   400 € → 880 €  (Chambre double Motard)
 *   780 € → 1 740€ (Chambre double couple)
 *
 * Usage (VPS) :
 *   cd /path/to/backend
 *   node scripts/migrate-prices-2026.js
 *   node scripts/migrate-prices-2026.js --dry-run   # aperçu sans modifier
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const DRY_RUN = process.argv.includes('--dry-run')

// Mapping ancien amount_cents → nouveau, pour paiements EUR
const EUR_PRICE_MAP = {
  48000: 96000,   // 480 € → 960 €
  40000: 88000,   // 400 € → 880 €
  78000: 174000,  // 780 € → 1 740 €
}

// Normalisation des anciens labels hebergement vers les nouveaux labels propres
const LABEL_MAP = {
  'Chambre simple (480 €)':         'Chambre simple',
  'Chambre double 400€/ motard':    'Chambre double — Motard',
  'Chambre double pour couple 780€': 'Chambre double couple',
}

// Nouveau montant par label propre (pour recalculer si amount_cents incorrect)
const LABEL_TO_CENTS = {
  'Chambre simple':         96000,
  'Chambre double — Motard': 88000,
  'Chambre double couple':  174000,
}

async function run() {
  const { getDb } = require('../src/db')
  const db = await getDb()

  console.log(`\n=== Migration tarifs EUR 2026 ${DRY_RUN ? '[DRY RUN]' : ''} ===\n`)

  // 1. Lister tous les paiements EUR hors paid/refunded/cancelled
  const payments = await db.all(
    `SELECT p.id as payment_id, p.amount_cents, p.currency, p.status,
            r.id as reg_id, r.hebergement, r.residence_zone
     FROM payments p
     JOIN registrations r ON r.id = p.registration_id
     WHERE p.currency = 'EUR' AND p.status NOT IN ('paid', 'refunded', 'cancelled')`
  )

  console.log(`Paiements EUR non-finalisés trouvés : ${payments.length}`)

  let updatedPayments = 0
  let updatedLabels = 0

  for (const row of payments) {
    const oldLabel = row.hebergement || ''
    const cleanLabel = LABEL_MAP[oldLabel] || oldLabel
    const expectedCents = LABEL_TO_CENTS[cleanLabel] || EUR_PRICE_MAP[row.amount_cents]

    // Mettre à jour le label hebergement si ancienne version
    if (LABEL_MAP[oldLabel]) {
      console.log(`  [label] reg ${row.reg_id}: "${oldLabel}" → "${cleanLabel}"`)
      if (!DRY_RUN) {
        await db.run(
          `UPDATE registrations SET hebergement = ?, updated_at = ? WHERE id = ?`,
          [cleanLabel, new Date().toISOString(), row.reg_id]
        )
      }
      updatedLabels++
    }

    // Mettre à jour amount_cents si valeur ancienne ou incorrecte
    if (expectedCents && row.amount_cents !== expectedCents) {
      console.log(`  [prix]  pay ${row.payment_id}: ${row.amount_cents} → ${expectedCents} (${cleanLabel})`)
      if (!DRY_RUN) {
        await db.run(
          `UPDATE payments SET amount_cents = ?, updated_at = ?, updated_by = 'migration-2026' WHERE id = ?`,
          [expectedCents, new Date().toISOString(), row.payment_id]
        )
      }
      updatedPayments++
    }
  }

  console.log(`\nRésultat :`)
  console.log(`  Labels mis à jour  : ${updatedLabels}`)
  console.log(`  Montants mis à jour: ${updatedPayments}`)
  if (DRY_RUN) console.log(`\n(Aucune modification appliquée — relancer sans --dry-run pour confirmer)`)
  console.log()
  process.exit(0)
}

run().catch(e => { console.error(e); process.exit(1) })
