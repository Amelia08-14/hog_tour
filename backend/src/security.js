const crypto = require('crypto')

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64urlDecode(s) {
  const normalized = String(s || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return Buffer.from(normalized + pad, 'base64')
}

function signToken(token) {
  const secret = process.env.QR_SIGNING_SECRET
  if (!secret) throw new Error('QR_SIGNING_SECRET is required')
  const h = crypto.createHmac('sha256', secret)
  h.update(token)
  return base64url(h.digest())
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

function newToken() {
  return base64url(crypto.randomBytes(24))
}

function getAdminSessionSecret() {
  const s = process.env.ADMIN_SESSION_SECRET || process.env.QR_SIGNING_SECRET
  if (!s) throw new Error('ADMIN_SESSION_SECRET (or QR_SIGNING_SECRET) is required')
  return s
}

function signAdminSession(payload) {
  const secret = getAdminSessionSecret()
  const body = base64url(Buffer.from(JSON.stringify(payload)))
  const h = crypto.createHmac('sha256', secret)
  h.update(body)
  const sig = base64url(h.digest())
  return `${body}.${sig}`
}

function verifyAdminSession(session) {
  const s = String(session || '')
  const idx = s.lastIndexOf('.')
  if (idx <= 0) return null
  const body = s.slice(0, idx)
  const sig = s.slice(idx + 1)

  const secret = getAdminSessionSecret()
  const h = crypto.createHmac('sha256', secret)
  h.update(body)
  const expected = base64url(h.digest())
  if (!safeEqual(sig, expected)) return null

  let payload
  try {
    payload = JSON.parse(base64urlDecode(body).toString('utf8'))
  } catch {
    return null
  }

  if (!payload || typeof payload !== 'object') return null
  if (typeof payload.exp !== 'number' || payload.exp <= Date.now()) return null
  return payload
}

module.exports = { signToken, safeEqual, newToken, signAdminSession, verifyAdminSession }
