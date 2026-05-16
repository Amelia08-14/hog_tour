const express = require('express')
const cors = require('cors')
require('dotenv').config()

const { initDb, getDb, withTransaction } = require('./db')
const { newToken, signToken, safeEqual, signAdminSession, verifyAdminSession } = require('./security')
const QRCode = require('qrcode')
const { sendMail } = require('./mailer')
const { writeRegistrationFiles, deleteStoredFiles, resolveStoragePath } = require('./uploads')
const { ensureCustomer, listPaymentMethods, createPaymentIntent, proceedIntent, checkIntent } = require('./yassir')
const { iso2ToIso3 } = require('./iso3166')

const multer = (() => {
  try { return require('multer') } catch { return null }
})()

function createUploadMiddleware() {
  if (!multer) return (req, res, next) => next()
  const m = multer({
    storage: multer.memoryStorage(),
    limits: { files: 10, fileSize: 10 * 1024 * 1024 },
  })
  return m.array('files', 10)
}

const uploadForRegistration = createUploadMiddleware()

function nowIso() {
  return new Date().toISOString()
}

function parsePriceToCents(input) {
  const s = String(input || '')
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*€?/i)
  if (!m) return null
  const n = Number(String(m[1]).replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100)
}

function isTrue(v) {
  return ['1', 'true', 'yes'].includes(String(v || '').toLowerCase().trim())
}

function firstString(obj, keys) {
  for (const k of keys) {
    const v = obj && obj[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

function normalizeYassirStatus(v) {
  const s = String(v || '').toLowerCase().trim()
  if (!s) return null
  if (['paid', 'succeeded', 'success', 'completed', 'captured'].includes(s)) return 'paid'
  if (['pending', 'processing', 'in_progress', 'requires_action', 'initiated', 'requires_payment_method'].includes(s)) return 'pending'
  if (['failed', 'declined', 'error'].includes(s)) return 'cancelled'
  if (['cancelled', 'canceled', 'expired'].includes(s)) return 'cancelled'
  if (['refunded'].includes(s)) return 'refunded'
  return null
}

function normalizeYassirStatusCode(code) {
  const n = Number(code)
  if (!Number.isFinite(n)) return null
  if (n === 2) return 'paid'
  if (n === 12 || n === 11 || n === 0) return 'pending'
  if (n >= 3 && n <= 9) return 'pending'
  if (n >= 20) return 'cancelled'
  return null
}

function extractYassirStatus(obj) {
  if (!obj) return null
  const data = (obj && obj.data) || obj
  const byCode = normalizeYassirStatusCode(data.statusCode)
  if (byCode) return byCode
  return normalizeYassirStatus(
    firstString(data, ['status', 'paymentStatus', 'payment_status']) ||
    firstString(obj, ['status', 'paymentStatus', 'payment_status'])
  )
}

function callingCodeFromIso2(iso2) {
  const k = String(iso2 || '').trim().toUpperCase()
  const map = {
    DZ: '213',
    FR: '33',
    BE: '32',
    CH: '41',
    DE: '49',
    ES: '34',
    IT: '39',
    GB: '44',
    UK: '44',
    US: '1',
    CA: '1',
    MA: '212',
    TN: '216',
  }
  return map[k] || null
}

function toE164FromRegistration(iso2, phoneNumber) {
  const raw = String(phoneNumber || '').trim()
  if (!raw) return ''
  if (raw.startsWith('+')) return raw.replace(/\s+/g, '')
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return ''
  const cc = callingCodeFromIso2(iso2)
  if (!cc) return ''
  const national = digits.replace(/^0+/, '')
  return `+${cc}${national}`
}

async function ensureBadgeForRegistration(db, registrationId) {
  const existing = await db.get(`SELECT token, issued_at FROM badges WHERE registration_id = ?`, [registrationId])
  if (existing && existing.token) return existing
  const badgeId = require('uuid').v4()
  const token = newToken()
  const issuedAt = nowIso()
  try {
    await db.run(
      `INSERT INTO badges (id, registration_id, token, issued_at) VALUES (?, ?, ?, ?);`,
      [badgeId, registrationId, token, issuedAt],
    )
    return { token, issued_at: issuedAt }
  } catch {
    const again = await db.get(`SELECT token, issued_at FROM badges WHERE registration_id = ?`, [registrationId])
    if (again && again.token) return again
    throw new Error('badge_issue_failed')
  }
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
      await new Promise((resolve, reject) => {
        uploadForRegistration(req, res, (err) => (err ? reject(err) : resolve()))
      })

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
      const currency = String(process.env.PAYMENT_CURRENCY || 'EUR').trim().toUpperCase() || 'EUR'
      const amountCents = derivedPaymentMode === 'online_yassir' ? parsePriceToCents(body.hebergement) : null
      const phoneE164 = body.phoneE164 ? String(body.phoneE164).trim() : ''
      const normalizedPhoneE164 = phoneE164 && /^\+\d{6,20}$/.test(phoneE164.replace(/\s+/g, '')) ? phoneE164.replace(/\s+/g, '') : ''
      if (derivedPaymentMode === 'online_yassir' && !normalizedPhoneE164) {
        return res.status(400).json({ error: 'phone_missing' })
      }

      const registrationId = require('uuid').v4()
      const paymentId = require('uuid').v4()
      const issueBadgeNow = derivedPaymentMode !== 'online_yassir'
      const badgeId = issueBadgeNow ? require('uuid').v4() : null
      const token = issueBadgeNow ? newToken() : null

      const createdAt = nowIso()

      const passportNum = String(body.passportNum).trim()
      {
        const db = await getDb()
        const existing = await db.get(`SELECT id FROM registrations WHERE passport_num = ?`, [passportNum])
        if (existing && existing.id) return res.status(409).json({ error: 'duplicate_passport' })
      }

      const incomingFiles = Array.isArray(req.files) ? req.files : []
      let storedFiles = []
      if (incomingFiles.length) {
        if (!multer) return res.status(500).json({ error: 'uploads_not_available' })
        storedFiles = await writeRegistrationFiles(registrationId, incomingFiles)
      }

      try {
        await withTransaction(async (db) => {
        await db.run(
          `INSERT INTO registrations (
            id, created_at, updated_at,
            prenom, nom, sexe, adresse, ville,
            pays_iso2, phone_country_iso2, phone_number, phone_e164,
            email, nationalite, nationalite_autre,
            residence_zone,
            profil, profil_groupe,
            hebergement, taille_tshirt, paiement_mode,
            permis_num, immatriculation, passport_num
          ) VALUES (
            ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
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
            normalizedPhoneE164 || null,
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
            passportNum,
          ],
        )

        await db.run(
          `INSERT INTO payments (
            id, registration_id, status, amount_cents, currency, method, reference, updated_at, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            paymentId,
            registrationId,
            derivedPaymentMode === 'online_yassir' ? 'pending' : 'unpaid',
            amountCents,
            amountCents != null ? currency : null,
            derivedPaymentMode === 'online_yassir' ? 'yassir' : null,
            null,
            createdAt,
            null,
          ],
        )

        if (issueBadgeNow) {
          await db.run(
            `INSERT INTO badges (id, registration_id, token, issued_at) VALUES (?, ?, ?, ?);`,
            [badgeId, registrationId, token, createdAt],
          )
        }
          for (const f of storedFiles) {
            await db.run(
              `INSERT INTO registration_files (
                id, registration_id, original_name, mime, size_bytes, storage_path, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
              [f.id, registrationId, f.originalName, f.mime || null, f.size, f.storagePath, createdAt],
            )
          }
        })
      } catch (e) {
        if (storedFiles.length) await deleteStoredFiles(storedFiles.map(f => f.storagePath))
        if (e && (e.code === 'SQLITE_CONSTRAINT' || e.code === 'ER_DUP_ENTRY')) {
          return res.status(409).json({ error: 'duplicate_passport' })
        }
        throw e
      }

      const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${Number(process.env.PORT) || 4000}`
      const paymentSig = signToken(paymentId)
      const paymentUrl = `${baseUrl.replace(/\/$/, '')}/paiement?paymentId=${encodeURIComponent(paymentId)}&sig=${encodeURIComponent(paymentSig)}`
      const badgeUrl = issueBadgeNow
        ? `${baseUrl.replace(/\/$/, '')}/v1/badge?token=${encodeURIComponent(token)}&sig=${encodeURIComponent(signToken(token))}`
        : null

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
              (derivedPaymentMode === 'online_yassir'
                ? `Votre inscription est en attente de paiement pour être validée.\n\n` +
                  `Paiement en ligne (carte) : ${paymentUrl}\n` +
                  `Référence : ${registrationId}\n\n`
                : `Votre inscription au H.O.G Tour 2026 a bien été enregistrée.\n\n` +
                  `Votre badge : ${badgeUrl}\n` +
                  `Mode de paiement : ${derivedPaymentMode}\n` +
                  `Référence : ${registrationId}\n\n`) +
              `Pour toute question, vous pouvez répondre à cet email.\n`,
          })
          userMailSent = true
        } catch (e) {
          console.error('registration user email failed', e)
        }
      }

      return res.status(201).json({
        id: registrationId,
        badge: badgeUrl ? { url: badgeUrl } : null,
        mail: { sent: userMailSent },
        files: { count: storedFiles.length },
        payment: {
          mode: derivedPaymentMode,
          status: derivedPaymentMode === 'online_yassir' ? 'pending' : 'unpaid',
          amountCents,
          currency: amountCents != null ? currency : null,
          url: derivedPaymentMode === 'online_yassir' ? paymentUrl : null,
        },
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

  app.post('/v1/payments/yassir/start', async (req, res) => {
    try {
      const body = req.body || {}
      const token = body.token ? String(body.token) : ''
      const paymentIdParam = body.paymentId ? String(body.paymentId) : ''
      const sig = body.sig ? String(body.sig) : ''
      const msisdn = body.msisdn ? String(body.msisdn).trim() : ''
      const otp = body.otp ? String(body.otp).trim() : ''
      const paymentMethodCode = body.paymentMethodCode ? String(body.paymentMethodCode).trim() : ''
      const paymentMethodPreference = body.paymentMethodPreference ? String(body.paymentMethodPreference).trim().toLowerCase() : ''
      if ((!token && !paymentIdParam) || !sig) return res.status(400).json({ error: 'missing_params' })
      if (token) {
        if (!safeEqual(sig, signToken(token))) return res.status(401).json({ error: 'invalid_signature' })
      } else {
        if (!safeEqual(sig, signToken(paymentIdParam))) return res.status(401).json({ error: 'invalid_signature' })
      }

      const db = await getDb()
      const row = paymentIdParam
        ? await db.get(
            `SELECT r.*, p.id as payment_id, p.status as payment_status, p.amount_cents, p.currency, p.reference
             FROM payments p
             JOIN registrations r ON r.id = p.registration_id
             WHERE p.id = ?`,
            [paymentIdParam],
          )
        : await db.get(
            `SELECT r.*, p.id as payment_id, p.status as payment_status, p.amount_cents, p.currency, p.reference
             FROM badges b
             JOIN registrations r ON r.id = b.registration_id
             JOIN payments p ON p.registration_id = r.id
             WHERE b.token = ?`,
            [token],
          )
      if (!row) return res.status(404).json({ error: 'not_found' })
      if (String(row.paiement_mode || '') !== 'online_yassir') return res.status(400).json({ error: 'not_online_payment' })
      if (!row.amount_cents || !row.currency) return res.status(400).json({ error: 'payment_amount_missing' })
      if (String(row.payment_status || '') === 'paid') return res.status(409).json({ error: 'already_paid' })

      const phoneE164 =
        (msisdn && msisdn.trim()) ||
        String(row.phone_e164 || '').trim() ||
        toE164FromRegistration(String(row.phone_country_iso2 || ''), String(row.phone_number || '')) ||
        ''
      if (!phoneE164) return res.status(400).json({ error: 'phone_missing' })

      const customer = await ensureCustomer({
        phoneE164,
        email: String(row.email || ''),
        firstName: String(row.prenom || ''),
        lastName: String(row.nom || ''),
      })
      const customerId = firstString(customer, ['id', 'customerId', 'customer_id']) || firstString(customer && customer.customer, ['id'])
      if (!customerId) {
        const debug = isTrue(process.env.YASSIR_DEBUG)
        return res.status(500).json({
          error: 'yassir_customer_failed',
          details: debug ? { customer } : undefined,
        })
      }

      let resolvedPaymentMethodId = null
      let resolvedPaymentMethodCode = paymentMethodCode || null
      try {
        const methodsResp = await listPaymentMethods({
          country: String(row.pays_iso2 || ''),
          amountCents: Number(row.amount_cents),
        })
        const list =
          (methodsResp && Array.isArray(methodsResp.items) && methodsResp.items) ||
          (methodsResp && Array.isArray(methodsResp.paymentMethods) && methodsResp.paymentMethods) ||
          (Array.isArray(methodsResp) ? methodsResp : [])
        if (Array.isArray(list) && list.length) {
          const wanted = String(paymentMethodCode || '').toLowerCase()
          const preferCard = paymentMethodPreference === 'card'

          const matchCode = (m) => String(m && (m.code || m.paymentMethodCode || m.payment_method_code) || '').toLowerCase()
          const matchName = (m) => String(m && (m.name || m.label || '') || '').toLowerCase()
          const isCard = (m) => {
            const c = matchCode(m)
            const n = matchName(m)
            return c.includes('card') || c.includes('visa') || c.includes('master') || n.includes('card') || n.includes('visa') || n.includes('master')
          }

          const found =
            (wanted ? list.find(m => matchCode(m) === wanted) : null) ||
            (preferCard ? list.find(isCard) : null) ||
            list[0]
          resolvedPaymentMethodId = firstString(found, ['id', 'paymentMethodId', 'payment_method_id'])
          resolvedPaymentMethodCode =
            firstString(found, ['code', 'paymentMethodCode', 'payment_method_code']) || resolvedPaymentMethodCode
        }
      } catch {}

      const callbackUrl = String(process.env.YASSIR_CALLBACK_URL || '').trim() || undefined
      const successRedirectUrl = String(process.env.YASSIR_SUCCESS_REDIRECT_URL || '').trim() || undefined
      const failRedirectUrl = String(process.env.YASSIR_FAIL_REDIRECT_URL || '').trim() || undefined
      const countryIso2 = String(row.pays_iso2 || '').trim()
      if (!countryIso2) return res.status(400).json({ error: 'missing_fields' })
      if (!iso2ToIso3(countryIso2)) return res.status(400).json({ error: 'invalid_country' })

      const intent = await createPaymentIntent({
        customerId,
        country: countryIso2,
        amountCents: Number(row.amount_cents),
        currency: String(row.currency),
        merchantTransactionId: String(row.payment_id),
        description: `HOG Tour 2026 — ${String(row.prenom || '')} ${String(row.nom || '')}`.trim(),
        callbackUrl,
        successRedirectUrl,
        failRedirectUrl,
      })
      const intentData = (intent && intent.data) || {}
      const intentId =
        firstString(intentData, ['paymentId', 'id', 'intentId', 'intent_id']) ||
        firstString(intent, ['id', 'intentId', 'intent_id', 'paymentIntentId', 'payment_intent_id']) ||
        firstString(intent && intent.intent, ['id', 'intentId', 'intent_id'])
      if (!intentId) return res.status(500).json({ error: 'yassir_intent_failed' })

      const clientSecret =
        firstString(intentData, ['clientSecret', 'client_secret']) ||
        firstString(intent, ['clientSecret', 'client_secret'])

      if (!resolvedPaymentMethodCode && !resolvedPaymentMethodId && !msisdn) {
        resolvedPaymentMethodCode = 'STRIPE'
      }

      const proceed = await proceedIntent({
        intentId,
        clientSecret,
        paymentMethodCode: resolvedPaymentMethodCode,
        paymentMethodId: resolvedPaymentMethodId,
        msisdn,
        otp,
        countryCode: iso2ToIso3(countryIso2),
        locale: 'en_US',
      })

      const mappedStatus = extractYassirStatus(proceed) || extractYassirStatus(intent) || 'pending'

      const proceedData = (proceed && proceed.data) || {}
      const redirectUrl =
        (proceedData.metadata && proceedData.metadata.payUrl) ||
        firstString(proceedData.metadata, ['payUrl', 'redirectUrl', 'url']) ||
        firstString(proceed, ['redirectUrl', 'paymentUrl', 'url', 'checkoutUrl', 'redirect_url', 'payment_url']) ||
        firstString(intent, ['redirectUrl', 'paymentUrl', 'url', 'checkoutUrl', 'redirect_url', 'payment_url']) ||
        firstString(proceed && proceed.nextAction, ['url', 'redirectUrl', 'paymentUrl']) ||
        firstString(intent && intent.nextAction, ['url', 'redirectUrl', 'paymentUrl'])

      const updatedAt = nowIso()
      await db.run(
        `UPDATE payments
         SET status = ?,
             method = ?,
             reference = ?,
             updated_at = ?,
             updated_by = ?
         WHERE id = ?`,
        [mappedStatus, paymentMethodPreference === 'card' ? 'yassir_card' : 'yassir', String(intentId), updatedAt, 'yassir_api', String(row.payment_id)],
      )

      let badge = null
      if (mappedStatus === 'paid') {
        const b = await ensureBadgeForRegistration(db, String(row.id))
        const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${Number(process.env.PORT) || 4000}`
        const badgeUrl = `${baseUrl.replace(/\/$/, '')}/v1/badge?token=${encodeURIComponent(String(b.token))}&sig=${encodeURIComponent(signToken(String(b.token)))}`
        badge = { url: badgeUrl }
      }

      return res.json({
        ok: true,
        payment: { status: mappedStatus, reference: String(intentId) },
        redirectUrl: redirectUrl || null,
        badge,
        yassir: { intent, proceed },
      })
    } catch (e) {
      const debug = isTrue(process.env.YASSIR_DEBUG)
      if (debug) console.error('yassir start failed', e)
      else console.error('yassir start failed', e && e.message ? String(e.message) : e)
      return res.status(500).json({
        error: 'server_error',
        message: e && e.message ? String(e.message) : undefined,
        details: debug ? (e && e.body ? e.body : null) : undefined,
      })
    }
  })

  app.get('/v1/payments/yassir/check', async (req, res) => {
    try {
      const token = typeof req.query.token === 'string' ? req.query.token : ''
      const paymentIdParam = typeof req.query.paymentId === 'string' ? req.query.paymentId : ''
      const sig = typeof req.query.sig === 'string' ? req.query.sig : ''
      if ((!token && !paymentIdParam) || !sig) return res.status(400).json({ error: 'missing_params' })
      if (token) {
        if (!safeEqual(sig, signToken(token))) return res.status(401).json({ error: 'invalid_signature' })
      } else {
        if (!safeEqual(sig, signToken(paymentIdParam))) return res.status(401).json({ error: 'invalid_signature' })
      }

      const db = await getDb()
      const row = paymentIdParam
        ? await db.get(
            `SELECT p.id as payment_id, p.registration_id as registration_id, p.status as payment_status, p.reference
             FROM payments p
             WHERE p.id = ?`,
            [paymentIdParam],
          )
        : await db.get(
            `SELECT p.id as payment_id, p.registration_id as registration_id, p.status as payment_status, p.reference
             FROM badges b
             JOIN payments p ON p.registration_id = b.registration_id
             WHERE b.token = ?`,
            [token],
          )
      if (!row) return res.status(404).json({ error: 'not_found' })
      const intentId = String(row.reference || '').trim()
      if (!intentId) return res.json({ ok: true, payment: { status: String(row.payment_status || 'unpaid') }, badge: null })

      const chk = await checkIntent({ intentId })
      const mappedStatus = extractYassirStatus(chk)

      if (mappedStatus && mappedStatus !== String(row.payment_status || '').trim()) {
        await db.run(
          `UPDATE payments SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?`,
          [mappedStatus, nowIso(), 'yassir_api', String(row.payment_id)],
        )
      }

      let badge = null
      const finalStatus = mappedStatus || String(row.payment_status || '')
      if (finalStatus === 'paid') {
        const b = await ensureBadgeForRegistration(db, String(row.registration_id))
        const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${Number(process.env.PORT) || 4000}`
        const badgeUrl = `${baseUrl.replace(/\/$/, '')}/v1/badge?token=${encodeURIComponent(String(b.token))}&sig=${encodeURIComponent(signToken(String(b.token)))}`
        badge = { url: badgeUrl }
      }

      return res.json({ ok: true, payment: { status: finalStatus }, badge, yassir: chk })
    } catch (e) {
      const debug = isTrue(process.env.YASSIR_DEBUG)
      if (debug) console.error('yassir check failed', e)
      else console.error('yassir check failed', e && e.message ? String(e.message) : e)
      return res.status(500).json({
        error: 'server_error',
        message: e && e.message ? String(e.message) : undefined,
        details: debug ? (e && e.body ? e.body : null) : undefined,
      })
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

  app.get('/v1/admin/debug/mail', requireAdmin, (req, res) => {
    return res.json({
      ok: true,
      mail: {
        disabled: isTrue(process.env.MAIL_DISABLED),
        from: String(process.env.MAIL_FROM || ''),
        to: String(process.env.MAIL_TO || ''),
      },
      smtp: {
        host: String(process.env.SMTP_HOST || ''),
        port: Number(process.env.SMTP_PORT || 587),
        secure: isTrue(process.env.SMTP_SECURE),
        user: String(process.env.SMTP_USER || ''),
        tlsServername: String(process.env.SMTP_TLS_SERVERNAME || ''),
        tlsRejectUnauthorized: !['0', 'false', 'no'].includes(String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || '').toLowerCase().trim()),
      },
    })
  })

  app.post('/v1/admin/debug/mail/test', requireAdmin, async (req, res) => {
    try {
      const body = req.body || {}
      const to = body.to ? String(body.to).trim() : ''
      await sendMail({
        to: to || undefined,
        subject: `Test email — HOG Tour backend`,
        text: `Test email envoyé le ${nowIso()}\n`,
      })
      return res.json({ ok: true })
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: 'mail_failed',
        message: e && e.message ? String(e.message) : String(e),
        code: e && e.code ? String(e.code) : undefined,
      })
    }
  })

  app.get('/v1/admin/files/:id', requireAdmin, async (req, res) => {
    try {
      const db = await getDb()
      const f = await db.get(
        `SELECT id, original_name, mime, storage_path FROM registration_files WHERE id = ?`,
        [req.params.id],
      )
      if (!f) return res.status(404).json({ error: 'not_found' })
      const abs = resolveStoragePath(f.storage_path)
      if (!abs) return res.status(404).json({ error: 'not_found' })
      return res.download(abs, String(f.original_name || 'file'))
    } catch (e) {
      return res.status(500).json({ error: 'server_error' })
    }
  })

  app.get('/v1/admin/registrations', requireAdmin, async (req, res) => {
    try {
      const db = await getDb()
      const rawLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined
      const limit = Math.max(1, Math.min(5000, Number.isFinite(rawLimit) ? rawLimit : 500))
      const rows = await db.all(
        `SELECT r.*,
                p.status     as payment_status,
                p.amount_cents as payment_amount_cents,
                p.currency   as payment_currency,
                p.method     as payment_method,
                p.reference  as payment_reference,
                p.updated_at as payment_updated_at,
                (SELECT COUNT(1) FROM registration_files rf WHERE rf.registration_id = r.id) as files_count
         FROM registrations r
         LEFT JOIN payments p ON p.registration_id = r.id
         ORDER BY r.created_at DESC
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
      const files = await db.all(
        `SELECT id, original_name, mime, size_bytes, created_at
         FROM registration_files
         WHERE registration_id = ?
         ORDER BY created_at DESC`,
        [req.params.id],
      )
      const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${Number(process.env.PORT) || 4000}`
      const badgeUrl = badge
        ? `${baseUrl.replace(/\/$/, '')}/v1/badge?token=${encodeURIComponent(badge.token)}&sig=${encodeURIComponent(signToken(badge.token))}`
        : null
      const qrUrl = badge
        ? `${baseUrl.replace(/\/$/, '')}/v1/qr?token=${encodeURIComponent(badge.token)}&sig=${encodeURIComponent(signToken(badge.token))}`
        : null

      return res.json({
        registration: r,
        payment,
        badge: badge ? { id: badge.id, issuedAt: badge.issued_at, badgeUrl, qrUrl } : null,
        files: (files || []).map(x => ({
          id: x.id,
          originalName: x.original_name,
          mime: x.mime,
          sizeBytes: x.size_bytes,
          createdAt: x.created_at,
          downloadUrl: `/v1/admin/files/${encodeURIComponent(x.id)}`,
        })),
      })
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
