const fs = require('fs')
const path = require('path')
const sqlite3 = require('sqlite3')
const { open } = require('sqlite')

let dbPromise

function getDbPath() {
  const raw = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'hogtour.sqlite')
  const resolved = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw)
  fs.mkdirSync(path.dirname(resolved), { recursive: true })
  return resolved
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = open({ filename: getDbPath(), driver: sqlite3.Database })
  }
  return dbPromise
}

async function initDb() {
  const db = await getDb()
  await db.exec('PRAGMA foreign_keys = ON;')
  await db.exec(`
    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      prenom TEXT NOT NULL,
      nom TEXT NOT NULL,
      sexe TEXT NOT NULL,
      adresse TEXT NOT NULL,
      ville TEXT NOT NULL,
      pays_iso2 TEXT NOT NULL,
      phone_country_iso2 TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      email TEXT NOT NULL,
      nationalite TEXT NOT NULL,
      nationalite_autre TEXT,
      profil TEXT NOT NULL,
      profil_groupe TEXT,
      hebergement TEXT NOT NULL,
      taille_tshirt TEXT NOT NULL,
      paiement_mode TEXT NOT NULL,
      permis_num TEXT NOT NULL,
      immatriculation TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      registration_id TEXT NOT NULL,
      status TEXT NOT NULL,
      amount_cents INTEGER,
      currency TEXT,
      method TEXT,
      reference TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT,
      FOREIGN KEY(registration_id) REFERENCES registrations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS badges (
      id TEXT PRIMARY KEY,
      registration_id TEXT NOT NULL UNIQUE,
      token TEXT NOT NULL UNIQUE,
      issued_at TEXT NOT NULL,
      FOREIGN KEY(registration_id) REFERENCES registrations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_payments_registration_id ON payments(registration_id);
    CREATE INDEX IF NOT EXISTS idx_badges_token ON badges(token);
  `)
}

module.exports = { getDb, initDb }

