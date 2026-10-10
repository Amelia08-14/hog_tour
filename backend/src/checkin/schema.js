const { getDb } = require('../db')
async function initCheckinDb() {
  const db = await getDb()
  const mysql = String(process.env.DB_DRIVER || 'sqlite').toLowerCase() === 'mysql'
  // Migration additive : aucune suppression, aucun changement des paiements / badges.
  await db.exec(`CREATE TABLE IF NOT EXISTS checkin_sessions (
    token_hash VARCHAR(64) PRIMARY KEY, username VARCHAR(80) NOT NULL, expires_at VARCHAR(40) NOT NULL
  )`)
  await db.exec(`CREATE TABLE IF NOT EXISTS checkin_records (
    registration_id ${mysql ? 'CHAR(36)' : 'TEXT'} NOT NULL,
    person_role VARCHAR(16) NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    alger_at VARCHAR(40), alger_by VARCHAR(120),
    ghardaia_at VARCHAR(40), ghardaia_by VARCHAR(120),
    kit_at VARCHAR(40), kit_by VARCHAR(120),
    hotel_at VARCHAR(40), hotel_by VARCHAR(120),
    hotel_name VARCHAR(160), room_number VARCHAR(40),
    PRIMARY KEY (registration_id, person_role),
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
  )`)
  await db.exec(`CREATE TABLE IF NOT EXISTS checkin_events (
    id VARCHAR(36) PRIMARY KEY, registration_id ${mysql ? 'CHAR(36)' : 'TEXT'} NOT NULL,
    person_role VARCHAR(16) NOT NULL, action VARCHAR(24) NOT NULL,
    occurred_at VARCHAR(40) NOT NULL, staff_username VARCHAR(80) NOT NULL,
    staff_name VARCHAR(120) NOT NULL, detail_json TEXT NOT NULL,
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
  )`)
}
// Le site public (inscriptions, paiements) tourne deja. Une migration de
// check-in qui echoue ne doit pas empecher le serveur de demarrer et couper
// l'API publique : on retient l'erreur et /v1/checkin repond 503 en clair.
let initError = null
async function initCheckinDbSafe() {
  try {
    await initCheckinDb()
    initError = null
  } catch (e) {
    initError = e
    console.error('checkin: migration impossible, /v1/checkin desactive —', e.message)
  }
  return initError
}
function checkinInitError() { return initError }
module.exports = { initCheckinDb, initCheckinDbSafe, checkinInitError }
