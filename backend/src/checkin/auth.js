const crypto = require('node:crypto')
const fs = require('node:fs')
const { promisify } = require('node:util')
const { getDb } = require('../db')
const { defaultHotel } = require('./service')
const scrypt = promisify(crypto.scrypt)
const digest = value => crypto.createHash('sha256').update(value).digest('hex')
const attempts = new Map()
const WINDOW = 15 * 60 * 1000

function users() {
  const filename = process.env.CHECKIN_USERS_FILE
  if (!filename) return []
  const list = JSON.parse(fs.readFileSync(filename, 'utf8'))
  if (!Array.isArray(list)) throw new Error('CHECKIN_USERS_FILE must contain an array')
  return list.filter(u => u && !u.disabled && typeof u.username === 'string')
}
function publicUser(u) {
  return { username: u.username, name: u.name || u.username,
    stations: (u.stations || ['alger', 'ghardaia']).filter(s => ['alger', 'ghardaia'].includes(s)) }
}
async function passwordMatches(password, hash) {
  const [algorithm, salt, expected] = String(hash || '').split(':')
  if (algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(expected || '')) return false
  const actual = await scrypt(password, salt, 64)
  return crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'))
}
function throttled(keys) {
  const now = Date.now()
  for (const [key, item] of attempts) if (item.until <= now) attempts.delete(key)
  if (attempts.size > 20000) return true
  return keys.some(key => (attempts.get(key)?.count || 0) >= 10)
}
function failed(keys) {
  for (const key of keys) {
    const item = attempts.get(key) || { count: 0, until: Date.now() + WINDOW }
    item.count++
    attempts.set(key, item)
  }
}
async function login(req, res) {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  const keys = [`ip:${req.ip}`, `user:${username}`]
  if (throttled(keys)) return res.status(429).json({ error: 'rate_limited', message: 'Trop de tentatives. Réessaie dans 15 minutes.' })
  if (!username || username.length > 80 || password.length > 256) return res.status(400).json({ error: 'invalid_login', message: 'Identifiants invalides.' })
  const all = users()
  if (!all.length) return res.status(503).json({ error: 'staff_not_configured', message: 'Les comptes de l’équipe ne sont pas encore configurés.' })
  const user = all.find(u => u.username === username)
  // Même coût de calcul pour un utilisateur absent.
  const hash = user?.passwordHash || `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`
  if (!(await passwordMatches(password, hash))) {
    failed(keys)
    return res.status(401).json({ error: 'invalid_login', message: 'Identifiant ou mot de passe incorrect.' })
  }
  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 12 * 3600 * 1000).toISOString()
  const db = await getDb()
  await db.run('DELETE FROM checkin_sessions WHERE expires_at < ?', [new Date().toISOString()])
  await db.run('INSERT INTO checkin_sessions (token_hash, username, expires_at) VALUES (?, ?, ?)', [digest(token), username, expiresAt])
  return res.json({ token, expiresAt, user: publicUser(user), defaultHotel: defaultHotel() })
}
async function authenticate(req, res, next) {
  const raw = req.get('authorization') || ''
  if (!/^Bearer [A-Za-z0-9_-]{43}$/.test(raw)) return res.status(401).json({ error: 'unauthorized', message: 'Connecte-toi avec ton compte équipe.' })
  const tokenHash = digest(raw.slice(7))
  const db = await getDb()
  const session = await db.get('SELECT username FROM checkin_sessions WHERE token_hash = ? AND expires_at > ?', [tokenHash, new Date().toISOString()])
  const user = session && users().find(u => u.username === session.username)
  if (!user) return res.status(401).json({ error: 'session_expired', message: 'Session expirée. Reconnecte-toi.' })
  req.staff = publicUser(user)
  req.sessionHash = tokenHash
  next()
}
async function logout(req, res) {
  await (await getDb()).run('DELETE FROM checkin_sessions WHERE token_hash = ?', [req.sessionHash])
  res.json({ ok: true })
}
module.exports = { login, authenticate, logout }
