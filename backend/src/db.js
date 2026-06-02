const fs = require('fs')
const path = require('path')

let sqliteDbPromise
let mysqlPoolPromise

function driver() {
  return String(process.env.DB_DRIVER || 'sqlite').toLowerCase()
}

function getDbPath() {
  const raw = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'hogtour.sqlite')
  const resolved = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw)
  fs.mkdirSync(path.dirname(resolved), { recursive: true })
  return resolved
}

async function getSqliteDb() {
  if (!sqliteDbPromise) {
    const sqlite3 = require('sqlite3')
    const { open } = require('sqlite')
    sqliteDbPromise = open({ filename: getDbPath(), driver: sqlite3.Database })
  }
  return sqliteDbPromise
}

async function getMysqlPool() {
  if (!mysqlPoolPromise) {
    const mysql = require('mysql2/promise')
    const host = String(process.env.MYSQL_HOST || '127.0.0.1')
    const port = Number(process.env.MYSQL_PORT || 3306)
    const user = String(process.env.MYSQL_USER || '')
    const password = String(process.env.MYSQL_PASSWORD || '')
    const database = String(process.env.MYSQL_DATABASE || '')
    if (!user || !database) throw new Error('MySQL is not configured (MYSQL_USER / MYSQL_DATABASE)')

    mysqlPoolPromise = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 10),
      timezone: 'Z',
    })
  }
  return mysqlPoolPromise
}

function wrapSqlite(db) {
  return {
    async exec(sql) {
      return db.exec(sql)
    },
    async run(sql, params = []) {
      return db.run(sql, params)
    },
    async get(sql, params = []) {
      return db.get(sql, params)
    },
    async all(sql, params = []) {
      return db.all(sql, params)
    },
  }
}

function wrapMysql(connOrPool) {
  const exec = async (sql, params = []) => {
    if (params && params.length) {
      return connOrPool.execute(sql, params)
    }
    return connOrPool.query(sql)
  }
  return {
    async exec(sql) {
      return exec(sql)
    },
    async run(sql, params = []) {
      return exec(sql, params)
    },
    async get(sql, params = []) {
      const [rows] = await exec(sql, params)
      return Array.isArray(rows) ? (rows[0] || null) : null
    },
    async all(sql, params = []) {
      const [rows] = await exec(sql, params)
      return Array.isArray(rows) ? rows : []
    },
  }
}

async function getDb() {
  if (driver() === 'mysql') {
    const pool = await getMysqlPool()
    return wrapMysql(pool)
  }
  const db = await getSqliteDb()
  return wrapSqlite(db)
}

async function initDb() {
  if (driver() === 'mysql') {
    const pool = await getMysqlPool()
    const db = wrapMysql(pool)

    await db.exec(`
      CREATE TABLE IF NOT EXISTS registrations (
        id CHAR(36) PRIMARY KEY,
        created_at VARCHAR(40) NOT NULL,
        updated_at VARCHAR(40) NOT NULL,
        prenom VARCHAR(120) NOT NULL,
        nom VARCHAR(120) NOT NULL,
        sexe VARCHAR(32) NOT NULL,
        adresse VARCHAR(255) NOT NULL,
        ville VARCHAR(120) NOT NULL,
        pays_iso2 CHAR(2) NOT NULL,
        phone_country_iso2 CHAR(2) NOT NULL,
        phone_number VARCHAR(64) NOT NULL,
        phone_e164 VARCHAR(32),
        email VARCHAR(190) NOT NULL,
        nationalite VARCHAR(80) NOT NULL,
        nationalite_autre VARCHAR(120),
        residence_zone VARCHAR(32),
        profil VARCHAR(120) NOT NULL,
        profil_groupe VARCHAR(190),
        hebergement VARCHAR(190) NOT NULL,
        taille_tshirt VARCHAR(16) NOT NULL,
        paiement_mode VARCHAR(40) NOT NULL,
        permis_num VARCHAR(120) NOT NULL,
        immatriculation VARCHAR(120) NOT NULL,
        passport_num VARCHAR(120)
      );
    `)

    await db.exec(`
      CREATE TABLE IF NOT EXISTS payments (
        id CHAR(36) PRIMARY KEY,
        registration_id CHAR(36) NOT NULL,
        status VARCHAR(32) NOT NULL,
        amount_cents INT,
        currency VARCHAR(8),
        method VARCHAR(64),
        reference VARCHAR(190),
        client_secret VARCHAR(500),
        updated_at VARCHAR(40) NOT NULL,
        updated_by VARCHAR(64),
        INDEX idx_payments_registration_id (registration_id),
        CONSTRAINT fk_payments_registration
          FOREIGN KEY (registration_id) REFERENCES registrations(id)
          ON DELETE CASCADE
      );
    `)

    await db.exec(`
      CREATE TABLE IF NOT EXISTS badges (
        id CHAR(36) PRIMARY KEY,
        registration_id CHAR(36) NOT NULL UNIQUE,
        token VARCHAR(190) NOT NULL UNIQUE,
        issued_at VARCHAR(40) NOT NULL,
        INDEX idx_badges_token (token),
        CONSTRAINT fk_badges_registration
          FOREIGN KEY (registration_id) REFERENCES registrations(id)
          ON DELETE CASCADE
      );
    `)

    await db.exec(`
      CREATE TABLE IF NOT EXISTS registration_files (
        id CHAR(36) PRIMARY KEY,
        registration_id CHAR(36) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mime VARCHAR(120),
        size_bytes INT,
        storage_path VARCHAR(255) NOT NULL,
        created_at VARCHAR(40) NOT NULL,
        INDEX idx_registration_files_registration_id (registration_id),
        CONSTRAINT fk_registration_files_registration
          FOREIGN KEY (registration_id) REFERENCES registrations(id)
          ON DELETE CASCADE
      );
    `)

    const dbName = String(process.env.MYSQL_DATABASE)
    const cols = await db.all(
      `SELECT COLUMN_NAME as name
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name = 'registrations'`,
      [dbName],
    )
    const names = new Set(cols.map(c => c.name))
    const addCol = async (name, typeSql) => {
      if (names.has(name)) return
      await db.exec(`ALTER TABLE registrations ADD COLUMN ${name} ${typeSql}`)
    }
    await addCol('passport_num', 'VARCHAR(120) NULL')
    await addCol('residence_zone', 'VARCHAR(32) NULL')
    await addCol('phone_e164', 'VARCHAR(32) NULL')
    await addCol('moto_modele', 'VARCHAR(160) NULL')

    // Colonnes payments (MySQL) — ajoutées ici car cette branche fait un return anticipé
    const addPaymentCol = async (sql) => {
      try {
        await db.exec(sql)
      } catch (e) {
        if (!(e && (e.code === 'ER_DUP_FIELDNAME' || String(e.message || '').toLowerCase().includes('duplicate column')))) throw e
      }
    }
    await addPaymentCol(`ALTER TABLE payments ADD COLUMN client_secret VARCHAR(500);`)
    await addPaymentCol(`ALTER TABLE payments ADD COLUMN confirmation_sent TINYINT DEFAULT 0;`)
    await addPaymentCol(`ALTER TABLE payments ADD COLUMN failure_reason VARCHAR(500);`)

    try {
      await db.exec(`CREATE UNIQUE INDEX ux_registrations_passport_num ON registrations(passport_num);`)
    } catch {}
    return
  }

  const sqlite = await getSqliteDb()
  const db = wrapSqlite(sqlite)
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
        phone_e164 TEXT,
        email TEXT NOT NULL,
        nationalite TEXT NOT NULL,
        nationalite_autre TEXT,
        residence_zone TEXT,
        profil TEXT NOT NULL,
        profil_groupe TEXT,
        hebergement TEXT NOT NULL,
        taille_tshirt TEXT NOT NULL,
        paiement_mode TEXT NOT NULL,
        permis_num TEXT NOT NULL,
        immatriculation TEXT NOT NULL,
        passport_num TEXT
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        registration_id TEXT NOT NULL,
        status TEXT NOT NULL,
        amount_cents INTEGER,
        currency TEXT,
        method TEXT,
        reference TEXT,
        client_secret TEXT,
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

      CREATE TABLE IF NOT EXISTS registration_files (
        id TEXT PRIMARY KEY,
        registration_id TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime TEXT,
        size_bytes INTEGER,
        storage_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(registration_id) REFERENCES registrations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_payments_registration_id ON payments(registration_id);
      CREATE INDEX IF NOT EXISTS idx_badges_token ON badges(token);
      CREATE UNIQUE INDEX IF NOT EXISTS ux_registrations_passport_num ON registrations(passport_num);
      CREATE INDEX IF NOT EXISTS idx_registration_files_registration_id ON registration_files(registration_id);
  `)

  const cols = await db.all(`PRAGMA table_info(registrations);`)
  const hasResidenceZone = cols.some(c => c.name === 'residence_zone')
  if (!hasResidenceZone) await db.exec(`ALTER TABLE registrations ADD COLUMN residence_zone TEXT;`)
  const hasPassport = cols.some(c => c.name === 'passport_num')
  if (!hasPassport) await db.exec(`ALTER TABLE registrations ADD COLUMN passport_num TEXT;`)
  const hasPhoneE164 = cols.some(c => c.name === 'phone_e164')
  if (!hasPhoneE164) await db.exec(`ALTER TABLE registrations ADD COLUMN phone_e164 TEXT;`)
  const hasMotoModele = cols.some(c => c.name === 'moto_modele')
  if (!hasMotoModele) await db.exec(`ALTER TABLE registrations ADD COLUMN moto_modele TEXT;`)

  if (driver() === 'mysql') {
    try {
      await db.exec(`ALTER TABLE payments ADD COLUMN client_secret VARCHAR(500);`)
    } catch (e) {
      if (!(e && (e.code === 'ER_DUP_FIELDNAME' || String(e.message || '').toLowerCase().includes('duplicate column')))) throw e
    }
    try {
      await db.exec(`ALTER TABLE payments ADD COLUMN confirmation_sent TINYINT DEFAULT 0;`)
    } catch (e) {
      if (!(e && (e.code === 'ER_DUP_FIELDNAME' || String(e.message || '').toLowerCase().includes('duplicate column')))) throw e
    }
    try {
      await db.exec(`ALTER TABLE payments ADD COLUMN failure_reason VARCHAR(500);`)
    } catch (e) {
      if (!(e && (e.code === 'ER_DUP_FIELDNAME' || String(e.message || '').toLowerCase().includes('duplicate column')))) throw e
    }
  } else {
    const paymentCols = await db.all(`PRAGMA table_info(payments);`)
    const hasClientSecret = paymentCols.some(c => c.name === 'client_secret')
    if (!hasClientSecret) await db.exec(`ALTER TABLE payments ADD COLUMN client_secret TEXT;`)
    const hasConfirmationSent = paymentCols.some(c => c.name === 'confirmation_sent')
    if (!hasConfirmationSent) await db.exec(`ALTER TABLE payments ADD COLUMN confirmation_sent INTEGER DEFAULT 0;`)
    const hasFailureReason = paymentCols.some(c => c.name === 'failure_reason')
    if (!hasFailureReason) await db.exec(`ALTER TABLE payments ADD COLUMN failure_reason TEXT;`)
  }
}

async function withTransaction(fn) {
  if (driver() === 'mysql') {
    const pool = await getMysqlPool()
    const conn = await pool.getConnection()
    const tx = wrapMysql(conn)
    try {
      await conn.beginTransaction()
      const out = await fn(tx)
      await conn.commit()
      return out
    } catch (e) {
      try { await conn.rollback() } catch {}
      throw e
    } finally {
      conn.release()
    }
  }

  const sqlite = await getSqliteDb()
  const tx = wrapSqlite(sqlite)
  await sqlite.exec('BEGIN')
  try {
    const out = await fn(tx)
    await sqlite.exec('COMMIT')
    return out
  } catch (e) {
    try { await sqlite.exec('ROLLBACK') } catch {}
    throw e
  }
}

module.exports = { getDb, initDb, withTransaction }
