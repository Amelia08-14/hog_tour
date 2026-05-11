const express = require('express')
const cors = require('cors')
require('dotenv').config()

const { initDb, getDb, withTransaction } = require('./db')
const { newToken, signToken, safeEqual, signAdminSession, verifyAdminSession } = require('./security')
const QRCode = require('qrcode')
const { sendMail } = require('./mailer')

function nowIso() {
  return new Date().toISOString()
}

function requireApiKey(req, res, next) {
  const expected = process.env.PAYMENT_API_KEY
  if (!expected) return res.status(500).json({ error: 'PAYMENT_API_KEY is not configured' })
  const got = req.header('x-api-key')
  if (!got || got !== expected) return res.status(401).json({ error: 'unauthorized' })
  return next()
}

function getCookie(req, name) {
  const h = String(req.headers.cookie || '')
  const parts = h.split(';')
  for (const part of parts) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const k = part.slice(0, idx).trim()
    if (k !== name) continue
    return decodeURIComponent(part.slice(idx + 1).trim())
  }
  return null
}

function cookieString(name, value, opts) {
  const v = encodeURIComponent(String(value || ''))
  let s = `${name}=${v}`
  if (opts && opts.maxAgeSeconds != null) s += `; Max-Age=${Number(opts.maxAgeSeconds) || 0}`
  if (opts && opts.path) s += `; Path=${opts.path}`
  if (opts && opts.httpOnly) s += `; HttpOnly`
  if (opts && opts.secure) s += `; Secure`
  if (opts && opts.sameSite) s += `; SameSite=${opts.sameSite}`
  return s
}

function requireAdmin(req, res, next) {
  const expected = process.env.PAYMENT_API_KEY
  const got = req.header('x-api-key')
  if (expected && got && got === expected) return next()

  const session = getCookie(req, 'admin_session')
  const payload = verifyAdminSession(session)
  if (!payload) return res.status(401).json({ error: 'unauthorized' })
  req.admin = payload
  return next()
}

function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json({ limit: '2mb' }))

  app.get('/health', (req, res) => res.json({ ok: true }))

  app.post('/v1/registrations', async (req, res) => {
    try {
      const body = req.body || {}

      const required = [
        'prenom',
        'nom',
        'sexe',
        'adresse',
        'ville',
        'paysIso2',
        'phoneCountryIso2',
        'phoneNumber',
        'email',
        'nationalite',
        'residenceZone',
        'profil',
        'hebergement',
        'tailleTshirt',
        'permisNum',
        'immatriculation',
        'passportNum',
      ]

      const missing = required.filter(k => !body[k] || String(body[k]).trim() === '')
      if (missing.length) return res.status(400).json({ error: 'missing_fields', fields: missing })

      if (body.nationalite === 'Autre' && (!body.nationaliteAutre || String(body.nationaliteAutre).trim() === '')) {
        return res.status(400).json({ error: 'missing_fields', fields: ['nationaliteAutre'] })
      }
      if (body.profil === "Membre d'un groupe de Motards" && (!body.profilGroupe || String(body.profilGroupe).trim() === '')) {
        return res.status(400).json({ error: 'missing_fields', fields: ['profilGroupe'] })
      }

      const rz = String(body.residenceZone).trim()
      if (!['Algérie', 'Ailleurs'].includes(rz)) {
        return res.status(400).json({ error: 'invalid_fields', fields: ['residenceZone'] })
      }

      const derivedPaymentMode = rz === 'Algérie' ? 'on_site' : 'online_yassir'

      const registrationId = require('uuid').v4()
      const paymentId = require('uuid').v4()
      const badgeId = require('uuid').v4()
      const token = newToken()

      const createdAt = nowIso()

      await withTransaction(async (db) => {
        await db.run(
          `INSERT INTO registrations (
            id, created_at, updated_at,
            prenom, nom, sexe, adresse, ville,
            pays_iso2, phone_country_iso2, phone_number,
            email, nationalite, nationalite_autre,
            residence_zone,
            profil, profil_groupe,
            hebergement, taille_tshirt, paiement_mode,
            permis_num, immatriculation, passport_num
          ) VALUES (
            ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?,
            ?, ?,
            ?, ?, ?,
            ?, ?, ?
          );`,
          [
            registrationId,
            createdAt,
            createdAt,
            String(body.prenom).trim(),
            String(body.nom).trim(),
            String(body.sexe).trim(),
            String(body.adresse).trim(),
            String(body.ville).trim(),
            String(body.paysIso2).trim().toUpperCase(),
            String(body.phoneCountryIso2).trim().toUpperCase(),
            String(body.phoneNumber).trim(),
            String(body.email).trim(),
            String(body.nationalite).trim(),
            body.nationaliteAutre ? String(body.nationaliteAutre).trim() : null,
            rz,
            String(body.profil).trim(),
            body.profilGroupe ? String(body.profilGroupe).trim() : null,
            String(body.hebergement).trim(),
            String(body.tailleTshirt).trim(),
            derivedPaymentMode,
            String(body.permisNum).trim(),
            String(body.immatriculation).trim(),
            String(body.passportNum).trim(),
          ],
        )

        await db.run(
          `INSERT INTO payments (
            id, registration_id, status, amount_cents, currency, method, reference, updated_at, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [paymentId, registrationId, 'unpaid', null, null, null, null, createdAt, null],
        )

        await db.run(
          `INSERT INTO badges (id, registration_id, token, issued_at) VALUES (?, ?, ?, ?);`,
          [badgeId, registrationId, token, createdAt],
        )
      })

      const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${Number(process.env.PORT) || 4000}`
      const sig = signToken(token)
      const badgeUrl = `${baseUrl.replace(/\/$/, '')}/v1/badge?token=${encodeURIComponent(token)}&sig=${encodeURIComponent(sig)}`

      const mailDisabled = ['1', 'true', 'yes'].includes(String(process.env.MAIL_DISABLED || '').toLowerCase().trim())
      const contactEmail = String(process.env.MAIL_TO || process.env.MAIL_FROM || 'contact@hogalgierschapteralgeria.com').trim()
      const userEmail = String(body.email).trim()
      const userFullName = `${String(body.prenom).trim()} ${String(body.nom).trim()}`

      if (!mailDisabled) {
        try {
          await sendMail({
            subject: `Nouvelle inscription — ${userFullName}`,
            replyTo: userEmail,
            text:
              `Nouvelle inscription H.O.G Tour 2026\n\n` +
              `Nom: ${String(body.nom).trim()}\n` +
              `Prénom: ${String(body.prenom).trim()}\n` +
              `Email: ${userEmail}\n` +
              `Téléphone: ${String(body.phoneCountryIso2).trim().toUpperCase()} ${String(body.phoneNumber).trim()}\n` +
              `Pays: ${String(body.paysIso2).trim().toUpperCase()}\n` +
              `Nationalité: ${String(body.nationalite).trim()}${body.nationalite === 'Autre' ? ` (${String(body.nationaliteAutre || '').trim()})` : ''}\n` +
              `Résidence: ${rz}\n` +
              `Paiement: ${derivedPaymentMode}\n` +
              `Passeport: ${String(body.passportNum).trim()}\n` +
              `Badge: ${badgeUrl}\n\n` +
              `ID: ${registrationId}\n`,
          })
        } catch (e) {
          console.error('registration admin email failed', e)
        }
      }

      let userMailSent = false
      if (!mailDisabled) {
        try {
          await sendMail({
            to: userEmail,
            subject: `Confirmation d'inscription — H.O.G Tour 2026`,
            replyTo: contactEmail,
            text:
              `Bonjour ${userFullName},\n\n` +
              `Votre inscription au H.O.G Tour 2026 a bien été enregistrée.\n\n` +
              `Votre badge : ${badgeUrl}\n` +
              `Mode de paiement : ${derivedPaymentMode}\n` +
              `Référence : ${registrationId}\n\n` +
              `Pour toute question, vous pouvez répondre à cet email.\n`,
          })
          userMailSent = true
        } catch (e) {
          console.error('registration user email failed', e)
        }
      }

      return res.status(201).json({
        id: registrationId,
        badge: { url: badgeUrl },
        mail: { sent: userMailSent },
      })
    } catch (e) {
      return res.status(500).json({ error: 'server_error' })
    }
  })

  app.post('/v1/contact', async (req, res) => {
    try {
      const body = req.body || {}
      const name = body.name ? String(body.name).trim() : ''
      const email = body.email ? String(body.email).trim() : ''
      const phone = body.phone ? String(body.phone).trim() : ''
      const message = body.message ? String(body.message).trim() : ''
      if (!name || !email || !message) return res.status(400).json({ error: 'missing_fields' })

      await sendMail({
        subject: `Contact — ${name}`,
        replyTo: email,
        text:
          `Nouveau message de contact\n\n` +
          `Nom: ${name}\n` +
          `Email: ${email}\n` +
          `Téléphone: ${phone}\n\n` +
          `${message}\n`,
      })

      return res.json({ ok: true })
    } catch (e) {
      return res.status(500).json({ error: 'server_error' })
    }
  })

  app.get('/v1/badge', async (req, res) => {
    try {
      const token = typeof req.query.token === 'string' ? req.query.token : ''
      const sig = typeof req.query.sig === 'string' ? req.query.sig : ''
      if (!token || !sig) return res.status(400).json({ error: 'missing_params' })

      const expectedSig = signToken(token)
      if (!safeEqual(sig, expectedSig)) return res.status(401).json({ error: 'invalid_signature' })

      const db = await getDb()
      const badge = await db.get(
        `SELECT b.id as badge_id, b.issued_at, r.id as registration_id, r.prenom, r.nom, r.email, r.passport_num, r.residence_zone
         FROM badges b
         JOIN registrations r ON r.id = b.registration_id
         WHERE b.token = ?`,
        [token],
      )
      if (!badge) return res.status(404).json({ error: 'not_found' })

      const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${Number(process.env.PORT) || 4000}`
      const badgeUrl = `${baseUrl.replace(/\/$/, '')}/v1/badge?token=${encodeURIComponent(token)}&sig=${encodeURIComponent(sig)}`
      const qrPayload = JSON.stringify({
        type: 'hogtour2026',
        nom: String(badge.nom || ''),
        prenom: String(badge.prenom || ''),
        passportNum: String(badge.passport_num || ''),
        token,
        sig,
      })
      const svg = await QRCode.toString(qrPayload, { type: 'svg', margin: 1, width: 260 })

      const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Badge H.O.G Tour 2026</title>
    <style>
      :root { color-scheme: dark; }
      body { margin:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#0B0B0B; color:#F5F5F5; }
      .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:40px 16px; }
      .card { width:100%; max-width:540px; border:1px solid rgba(255,107,0,.18); background:#121212; padding:28px; }
      .tag { letter-spacing:.22em; text-transform:uppercase; font-size:12px; color:rgba(255,255,255,.75); }
      h1 { margin:10px 0 0; font-size:28px; letter-spacing:.12em; text-transform:uppercase; color:#FF6B00; }
      .meta { margin-top:10px; color:rgba(255,255,255,.8); font-size:14px; line-height:1.5; }
      .qr { margin-top:18px; display:flex; justify-content:center; background:#fff; padding:14px; }
      .hint { margin-top:14px; color:rgba(255,255,255,.7); font-size:12px; line-height:1.5; }
      .link { margin-top:10px; font-size:12px; word-break:break-all; color:rgba(255,255,255,.6); }
      a { color:#FF6B00; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="tag">Badge</div>
        <h1>H.O.G Tour 2026</h1>
        <div class="meta">
          <div><strong>${escapeHtml(String(badge.prenom || ''))} ${escapeHtml(String(badge.nom || ''))}</strong></div>
          <div>${escapeHtml(String(badge.email || ''))}</div>
          <div>${escapeHtml(String(badge.passport_num || ''))}</div>
        </div>
        <div class="qr">${svg}</div>
        <div class="hint">
          Gardez ce badge. Le QR code contient vos informations (nom, prénom, passeport) ainsi que le token/signature pour vérification.
        </div>
        <div class="link">${escapeHtml(badgeUrl)}</div>
      </div>
    </div>
  </body>
</html>`

      res.setHeader('content-type', 'text/html; charset=utf-8')
      return res.status(200).send(html)
    } catch (e) {
      return res.status(500).json({ error: 'server_error' })
    }
  })

  app.get('/v1/qr', requireAdmin, async (req, res) => {
    try {
      const token = typeof req.query.token === 'string' ? req.query.token : ''
      const sig = typeof req.query.sig === 'string' ? req.query.sig : ''
      if (!token || !sig) return res.status(400).json({ error: 'missing_params' })

      const expectedSig = signToken(token)
      if (!safeEqual(sig, expectedSig)) return res.status(401).json({ error: 'invalid_signature' })

      const db = await getDb()
      const badge = await db.get(
        `SELECT b.id as badge_id, b.issued_at, r.id as registration_id, r.prenom, r.nom, r.email, r.passport_num, r.residence_zone
         FROM badges b
         JOIN registrations r ON r.id = b.registration_id
         WHERE b.token = ?`,
        [token],
      )
      if (!badge) return res.status(404).json({ error: 'not_found' })

      const payment = await db.get(
        `SELECT status, amount_cents, currency, method, reference, updated_at
         FROM payments
         WHERE registration_id = ?`,
        [badge.registration_id],
      )

      return res.json({
        badgeId: badge.badge_id,
        issuedAt: badge.issued_at,
        registration: {
          id: badge.registration_id,
          prenom: badge.prenom,
          nom: badge.nom,
          email: badge.email,
          passportNum: badge.passport_num,
          residenceZone: badge.residence_zone,
        },
        payment: payment || { status: 'unpaid' },
      })
    } catch (e) {
      return res.status(500).json({ error: 'server_error' })
    }
  })

  app.post('/v1/admin/login', async (req, res) => {
    try {
      const configuredUser = String(process.env.ADMIN_USER || '')
      const configuredPass = String(process.env.ADMIN_PASS || '')
      if (!configuredUser || !configuredPass) return res.status(500).json({ error: 'ADMIN_USER/ADMIN_PASS is not configured' })

      const body = req.body || {}
      const username = body.username ? String(body.username) : ''
      const password = body.password ? String(body.password) : ''
      if (!username || !password) return res.status(400).json({ error: 'missing_fields' })

      if (!safeEqual(username, configuredUser) || !safeEqual(password, configuredPass)) {
        return res.status(401).json({ error: 'unauthorized' })
      }

      const ttlSeconds = 60 * 60 * 24 * 7
      const session = signAdminSession({ u: configuredUser, exp: Date.now() + ttlSeconds * 1000 })
      res.setHeader(
        'set-cookie',
        cookieString('admin_session', session, {
          httpOnly: true,
          sameSite: 'Lax',
          secure: String(process.env.NODE_ENV || '') === 'production',
          path: '/',
          maxAgeSeconds: ttlSeconds,
        }),
      )
      return res.json({ ok: true })
    } catch (e) {
      return res.status(500).json({ error: 'server_error' })
    }
  })

  app.post('/v1/admin/logout', (req, res) => {
    res.setHeader(
      'set-cookie',
      cookieString('admin_session', '', {
        httpOnly: true,
        sameSite: 'Lax',
        secure: String(process.env.NODE_ENV || '') === 'production',
        path: '/',
        maxAgeSeconds: 0,
      }),
    )
    return res.json({ ok: true })
  })

  app.get('/v1/admin/me', requireAdmin, (req, res) => {
    const u = req.admin && typeof req.admin.u === 'string' ? req.admin.u : null
    return res.json({ ok: true, user: u })
  })

  app.get('/v1/admin/registrations', requireAdmin, async (req, res) => {
    try {
      const db = await getDb()
      const rawLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined
      const limit = Math.max(1, Math.min(5000, Number.isFinite(rawLimit) ? rawLimit : 500))
      const rows = await db.all(
        `SELECT id, created_at, prenom, nom, email, pays_iso2, phone_country_iso2, phone_number, residence_zone, paiement_mode
         FROM registrations
         ORDER BY created_at DESC
         LIMIT ?`,
        [limit],
      )
      return res.json({ items: rows })
    } catch (e) {
      return res.status(500).json({ error: 'server_error' })
    }
  })

  app.get('/v1/admin/registrations/:id', requireAdmin, async (req, res) => {
    try {
      const db = await getDb()
      const r = await db.get(`SELECT * FROM registrations WHERE id = ?`, [req.params.id])
      if (!r) return res.status(404).json({ error: 'not_found' })
      const payment = await db.get(`SELECT * FROM payments WHERE registration_id = ?`, [req.params.id])
      const badge = await db.get(`SELECT id, token, issued_at FROM badges WHERE registration_id = ?`, [req.params.id])
      const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${Number(process.env.PORT) || 4000}`
      const badgeUrl = badge
        ? `${baseUrl.replace(/\/$/, '')}/v1/badge?token=${encodeURIComponent(badge.token)}&sig=${encodeURIComponent(signToken(badge.token))}`
        : null
      const qrUrl = badge
        ? `${baseUrl.replace(/\/$/, '')}/v1/qr?token=${encodeURIComponent(badge.token)}&sig=${encodeURIComponent(signToken(badge.token))}`
        : null

      return res.json({ registration: r, payment, badge: badge ? { id: badge.id, issuedAt: badge.issued_at, badgeUrl, qrUrl } : null })
    } catch (e) {
      return res.status(500).json({ error: 'server_error' })
    }
  })

  app.post('/v1/admin/qr/resolve', requireAdmin, async (req, res) => {
    try {
      const body = req.body || {}
      let token = body.token ? String(body.token) : ''
      let sig = body.sig ? String(body.sig) : ''

      if ((!token || !sig) && body.url) {
        try {
          const u = new URL(String(body.url))
          token = u.searchParams.get('token') || ''
          sig = u.searchParams.get('sig') || ''
        } catch {
          return res.status(400).json({ error: 'invalid_url' })
        }
      }

      if (!token || !sig) return res.status(400).json({ error: 'missing_params' })

      const expectedSig = signToken(token)
      if (!safeEqual(sig, expectedSig)) return res.status(401).json({ error: 'invalid_signature' })

      const db = await getDb()
      const badge = await db.get(
        `SELECT b.id as badge_id, b.issued_at, r.*
         FROM badges b
         JOIN registrations r ON r.id = b.registration_id
         WHERE b.token = ?`,
        [token],
      )
      if (!badge) return res.status(404).json({ error: 'not_found' })

      const payment = await db.get(`SELECT * FROM payments WHERE registration_id = ?`, [badge.id])
      return res.json({ badgeId: badge.badge_id, issuedAt: badge.issued_at, registration: badge, payment })
    } catch (e) {
      return res.status(500).json({ error: 'server_error' })
    }
  })

  app.patch('/v1/admin/registrations/:id/payment', requireAdmin, async (req, res) => {
    try {
      const body = req.body || {}
      const status = body.status ? String(body.status) : ''
      const allowed = new Set(['unpaid', 'pending', 'paid', 'cancelled', 'refunded'])
      if (!allowed.has(status)) return res.status(400).json({ error: 'invalid_status' })

      const db = await getDb()
      const exists = await db.get(`SELECT id FROM registrations WHERE id = ?`, [req.params.id])
      if (!exists) return res.status(404).json({ error: 'not_found' })

      const updatedAt = nowIso()
      await db.run(
        `UPDATE payments
         SET status = ?,
             amount_cents = ?,
             currency = ?,
             method = ?,
             reference = ?,
             updated_at = ?,
             updated_by = ?
         WHERE registration_id = ?`,
        [
          status,
          typeof body.amountCents === 'number' ? body.amountCents : null,
          body.currency ? String(body.currency) : null,
          body.method ? String(body.method) : null,
          body.reference ? String(body.reference) : null,
          updatedAt,
          'payments_api',
          req.params.id,
        ],
      )

      const payment = await db.get(`SELECT * FROM payments WHERE registration_id = ?`, [req.params.id])
      return res.json({ payment })
    } catch (e) {
      return res.status(500).json({ error: 'server_error' })
    }
  })

  return app
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

async function createStartedApp() {
  await initDb()
  return createApp()
}

module.exports = { createApp, createStartedApp }
