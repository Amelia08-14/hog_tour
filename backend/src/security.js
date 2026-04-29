const crypto = require('crypto')

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
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

module.exports = { signToken, safeEqual, newToken }

