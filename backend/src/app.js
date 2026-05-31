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

const HEBERGEMENT_PRICES = {
  'Chambre simple': { dzd: 7500000, eur: 96000 },
  'Chambre double — Motard': { dzd: 6500000, eur: 88000 },
  'Chambre double couple': { dzd: 12500000, eur: 174000 },
  'Pack test': { dzd: 100, eur: 100 },
}
const ON_SITE_ZONES = ['Algérie', 'Lybie', 'Tunisie']

function hebergementPrice(hebergement, residenceZone) {
  const prices = HEBERGEMENT_PRICES[hebergement]
  if (!prices) return null
  const isLocal = ON_SITE_ZONES.includes(String(residenceZone || ''))
  return isLocal ? { amountCents: prices.dzd, currency: 'DZD' } : { amountCents: prices.eur, currency: 'EUR' }
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
  if (n === 3) return 'cancelled'
  if (n === 13) return 'pending'
  if (n === 12 || n === 11 || n === 0) return 'pending'
  if (n >= 4 && n <= 9) return 'pending'
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
      if (!['Algérie', 'Lybie', 'Tunisie', 'Ailleurs'].includes(rz)) {
        return res.status(400).json({ error: 'invalid_fields', fields: ['residenceZone'] })
      }

      const derivedPaymentMode = ['Algérie', 'Lybie', 'Tunisie'].includes(rz) ? 'on_site' : 'online_yassir'
      const phoneE164 = body.phoneE164 ? String(body.phoneE164).trim() : ''
      const normalizedPhoneE164 = phoneE164 && /^\+\d{6,20}$/.test(phoneE164.replace(/\s+/g, '')) ? phoneE164.replace(/\s+/g, '') : ''
      if (derivedPaymentMode === 'online_yassir' && !normalizedPhoneE164) {
        return res.status(400).json({ error: 'phone_missing' })
      }

      const registrationId = require('uuid').v4()
      const paymentId = require('uuid').v4()

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
          [paymentId, registrationId, 'pending', null, null, null, null, createdAt, null],
        )
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

      const mailDisabled = ['1', 'true', 'yes'].includes(String(process.env.MAIL_DISABLED || '').toLowerCase().trim())
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
              `Lien paiement: ${paymentUrl}\n\n` +
              `ID: ${registrationId}\n`,
          })
        } catch (e) {
          console.error('registration admin email failed', e)
        }
      }

      return res.status(201).json({
        id: registrationId,
        badge: null,
        mail: { sent: false },
        files: { count: storedFiles.length },
        payment: {
          mode: derivedPaymentMode,
          status: 'pending',
          amountCents: null,
          currency: null,
          url: paymentUrl,
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
        if (isTrue(process.env.YASSIR_DEBUG)) {
          console.log('yassir listPaymentMethods raw:', JSON.stringify(methodsResp))
        }
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
      const failRedirectUrl = String(process.env.YASSIR_FAIL_REDIRECT_URL || '').trim() || undefined
      const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${Number(process.env.PORT) || 4000}`
      const successRedirectBase = String(process.env.YASSIR_SUCCESS_REDIRECT_URL || '').trim() || `${baseUrl.replace(/\/$/, '')}/payment-success`
      const successRedirectUrl = `${successRedirectBase}${successRedirectBase.includes('?') ? '&' : '?'}internalId=${encodeURIComponent(String(row.payment_id))}`
      const countryIso2 = String(row.pays_iso2 || '').trim()
      if (!countryIso2) return res.status(400).json({ error: 'missing_fields' })
      if (!iso2ToIso3(countryIso2)) return res.status(400).json({ error: 'invalid_country' })

      const intent = await createPaymentIntent({
        phoneE164,
        country: countryIso2,
        amountCents: Number(row.amount_cents),
        currency: String(row.currency),
        merchantTransactionId: String(row.payment_id),
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

      if (isTrue(process.env.YASSIR_DEBUG)) {
        console.log('yassir intent response keys:', JSON.stringify(Object.keys(intentData)), 'top-level:', JSON.stringify(Object.keys(intent || {})))
        console.log('yassir intent data sample:', JSON.stringify({
          id: intentData.id, paymentId: intentData.paymentId, intentId: intentData.intentId,
          redirectUrl: intentData.redirectUrl, checkoutUrl: intentData.checkoutUrl,
          payUrl: intentData.payUrl, status: intentData.status, statusCode: intentData.statusCode,
          clientSecret: clientSecret ? '***' : undefined,
        }))
      }

      // Check if createPaymentIntent already provided a hosted checkout URL (production Yassir flow)
      const intentRedirectUrl =
        firstString(intentData, ['redirectUrl', 'checkoutUrl', 'payUrl', 'paymentUrl', 'url', 'redirect_url', 'checkout_url']) ||
        (intentData.metadata && firstString(intentData.metadata, ['payUrl', 'redirectUrl', 'url'])) ||
        firstString(intent, ['redirectUrl', 'checkoutUrl', 'payUrl', 'paymentUrl', 'url', 'redirect_url'])

      let proceed = null
      let mappedStatus = extractYassirStatus(intent) || 'pending'
      let redirectUrl = intentRedirectUrl || null

      if (!intentRedirectUrl) {
        // No hosted checkout URL from intent — try proceedIntent
        if (!resolvedPaymentMethodCode && !resolvedPaymentMethodId && !msisdn) {
          resolvedPaymentMethodCode = 'WALLET_V2'
        }
        const extractRedirectFromProceed = (p) => {
          const pd = (p && p.data) || {}
          return (
            firstString(p, ['payUrl', 'redirectUrl', 'paymentUrl', 'url', 'checkoutUrl', 'redirect_url', 'payment_url']) ||
            firstString(pd, ['payUrl', 'redirectUrl', 'url', 'checkoutUrl']) ||
            (pd.metadata && firstString(pd.metadata, ['payUrl', 'redirectUrl', 'url'])) ||
            firstString(p && p.nextAction, ['url', 'redirectUrl', 'payUrl']) ||
            null
          )
        }

        try {
          proceed = await proceedIntent({
            intentId,
            clientSecret,
            paymentMethodCode: resolvedPaymentMethodCode,
            paymentMethodId: resolvedPaymentMethodId,
            msisdn,
            otp,
            countryCode: iso2ToIso3(countryIso2),
            locale: 'en_US',
          })
          mappedStatus = extractYassirStatus(proceed) || mappedStatus
          redirectUrl = extractRedirectFromProceed(proceed)
          if (isTrue(process.env.YASSIR_DEBUG)) console.log('yassir proceed response:', JSON.stringify(proceed))
        } catch (proceedErr) {
          const isNotActive = proceedErr && proceedErr.body && Array.isArray(proceedErr.body.errors) &&
            proceedErr.body.errors.some(e => String(e).toLowerCase().includes('not active'))
          if (isNotActive) {
            // Payment method not configured — retry with no method code (universal checkout fallback)
            console.log('yassir proceed: method not active, retrying with empty body')
            try {
              proceed = await proceedIntent({ intentId, clientSecret, countryCode: iso2ToIso3(countryIso2), locale: 'en_US' })
              mappedStatus = extractYassirStatus(proceed) || mappedStatus
              redirectUrl = extractRedirectFromProceed(proceed)
              if (isTrue(process.env.YASSIR_DEBUG)) console.log('yassir proceed (empty body) response:', JSON.stringify(proceed))
            } catch (proceedErr2) {
              console.error('yassir proceedIntent (empty body) also failed:', proceedErr2 && proceedErr2.message ? String(proceedErr2.message) : proceedErr2, proceedErr2 && proceedErr2.body ? JSON.stringify(proceedErr2.body) : '')
              return res.status(500).json({
                error: 'payment_method_unavailable',
                message: 'Aucune méthode de paiement disponible sur ce compte Yassir. Contactez le support.',
              })
            }
          } else {
            console.error('yassir proceedIntent failed:', proceedErr && proceedErr.message ? String(proceedErr.message) : proceedErr, proceedErr && proceedErr.body ? JSON.stringify(proceedErr.body) : '')
            return res.status(500).json({
              error: 'payment_method_unavailable',
              message: proceedErr && proceedErr.body && proceedErr.body.errors ? proceedErr.body.errors.join(', ') : 'Méthode de paiement non disponible.',
            })
          }
        }
      }

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
      if (clientSecret) {
        try {
          await db.run(`UPDATE payments SET client_secret = ? WHERE id = ?`, [clientSecret, String(row.payment_id)])
        } catch { /* column may not exist yet on older deployments */ }
      }

      let badge = null
      if (mappedStatus === 'paid') {
        const b = await ensureBadgeForRegistration(db, String(row.id))
        const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${Number(process.env.PORT) || 4000}`
        const badgeUrl = `${baseUrl.replace(/\/$/, '')}/v1/badge?token=${encodeURIComponent(String(b.token))}&sig=${encodeURIComponent(signToken(String(b.token)))}`
        badge = { url: badgeUrl }
      }

      if (redirectUrl && mappedStatus !== 'paid') {
        const mailDisabled = ['1', 'true', 'yes'].includes(String(process.env.MAIL_DISABLED || '').toLowerCase().trim())
        if (!mailDisabled) {
          try {
            const fullName = `${String(row.prenom || '')} ${String(row.nom || '')}`
            await sendMail({
              to: String(row.email || ''),
              subject: `Inscription en attente de confirmation — H.O.G Tour 2026`,
              replyTo: String(process.env.MAIL_TO || process.env.MAIL_FROM || 'contact@hogalgierschapteralgeria.com'),
              html: buildConfirmationEmailHtml({
                prenom: String(row.prenom || ''),
                fullName,
                registrationId: String(row.payment_id || ''),
                mode: 'payment_pending',
                paymentUrl: null,
                badgeUrl: null,
              }),
              text: `Bonjour ${fullName},\n\nVotre paiement est en cours de traitement. Vous recevrez votre badge de participation par email dès confirmation.\nRéférence : ${row.payment_id}\n`,
            })
          } catch (mailErr) {
            console.error('yassir start pending email failed', mailErr && mailErr.message ? String(mailErr.message) : mailErr)
          }
        }
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
            `SELECT p.id as payment_id, p.registration_id as registration_id, p.status as payment_status, p.reference, p.client_secret
             FROM payments p
             WHERE p.id = ?`,
            [paymentIdParam],
          )
        : await db.get(
            `SELECT p.id as payment_id, p.registration_id as registration_id, p.status as payment_status, p.reference, p.client_secret
             FROM badges b
             JOIN payments p ON p.registration_id = b.registration_id
             WHERE b.token = ?`,
            [token],
          )
      if (!row) return res.status(404).json({ error: 'not_found' })
      const intentId = String(row.reference || '').trim()
      if (!intentId) return res.json({ ok: true, payment: { status: String(row.payment_status || 'unpaid') }, badge: null })

      const chk = await checkIntent({ intentId, clientSecret: row.client_secret || undefined })
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

  app.post('/v1/payments/yassir/webhook', async (req, res) => {
    // Always ACK immediately — Yassir will retry on non-2xx
    res.status(200).json({ ok: true })

    try {
      const payload = req.body || {}

      // Always log webhook — critical for debugging payment status
      console.log('yassir webhook received', JSON.stringify({
        headers: {
          'content-type': req.headers['content-type'],
          'x-signature': req.headers['x-signature'],
          'x-webhook-signature': req.headers['x-webhook-signature'],
          'x-yassir-signature': req.headers['x-yassir-signature'],
        },
        body: payload,
      }, null, 2))

      // Extract intent/payment ID — format unknown until Shabrina confirms
      const data = (payload && payload.data) || payload
      const intentId =
        firstString(data, ['paymentId', 'intentId', 'intent_id', 'payment_id', 'transactionId', 'paymentIntentId']) ||
        firstString(payload, ['paymentId', 'intentId', 'intent_id', 'payment_id', 'transactionId', 'paymentIntentId'])

      if (!intentId) {
        console.warn('yassir webhook: no intentId in payload', JSON.stringify(payload))
        return
      }

      const mappedStatus = extractYassirStatus(payload)
      if (!mappedStatus) {
        console.warn('yassir webhook: unknown status in payload', JSON.stringify(payload))
        return
      }

      const db = await getDb()
      const row = await db.get(
        `SELECT p.id as payment_id, p.registration_id, p.status as payment_status
         FROM payments p WHERE p.reference = ?`,
        [intentId],
      )

      if (!row) {
        console.warn('yassir webhook: no payment found for intentId', intentId)
        return
      }

      if (mappedStatus === String(row.payment_status || '').trim()) return

      await db.run(
        `UPDATE payments SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?`,
        [mappedStatus, nowIso(), 'yassir_webhook', String(row.payment_id)],
      )

      if (mappedStatus === 'paid') {
        const badge = await ensureBadgeForRegistration(db, String(row.registration_id))
        const mailDisabled = ['1', 'true', 'yes'].includes(String(process.env.MAIL_DISABLED || '').toLowerCase().trim())
        if (!mailDisabled) {
          try {
            const reg = await db.get(`SELECT * FROM registrations WHERE id = ?`, [row.registration_id])
            if (reg) {
              const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${Number(process.env.PORT) || 4000}`
              const badgeUrl = `${baseUrl.replace(/\/$/, '')}/v1/badge?token=${encodeURIComponent(String(badge.token))}&sig=${encodeURIComponent(signToken(String(badge.token)))}`
              const fullName = `${String(reg.prenom || '')} ${String(reg.nom || '')}`
              const issuedDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
              let pdfAttachment
              try {
                const pdfBuffer = await buildBadgePdf({
                  prenom: String(reg.prenom || ''),
                  nom: String(reg.nom || ''),
                  passportNum: String(reg.passport_num || ''),
                  zone: String(reg.residence_zone || ''),
                  issuedDate,
                  badgeId: String(badge.id || ''),
                })
                const safeNom = String(reg.nom || '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
                pdfAttachment = { filename: `badge-hog2026-${safeNom}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }
              } catch (pdfErr) {
                console.error('webhook badge PDF generation failed', pdfErr && pdfErr.message ? String(pdfErr.message) : pdfErr)
              }
              await sendMail({
                to: String(reg.email || ''),
                subject: `Paiement confirmé — H.O.G Tour 2026`,
                replyTo: String(process.env.MAIL_TO || process.env.MAIL_FROM || 'contact@hogalgierschapteralgeria.com'),
                html: buildConfirmationEmailHtml({
                  prenom: String(reg.prenom || ''),
                  fullName,
                  registrationId: String(reg.id || ''),
                  mode: 'paid',
                  paymentUrl: null,
                  badgeUrl,
                }),
                text: `Bonjour ${fullName},\n\nVotre paiement est confirmé. Accédez à votre badge : ${badgeUrl}\nRéférence : ${reg.id}\n`,
                attachments: pdfAttachment ? [pdfAttachment] : undefined,
              })
            }
          } catch (mailErr) {
            console.error('webhook confirmation email failed', mailErr && mailErr.message ? String(mailErr.message) : mailErr)
          }
        }
      }

      console.log(`yassir webhook: ${intentId} → ${mappedStatus}`)
    } catch (e) {
      console.error('yassir webhook error', e && e.message ? String(e.message) : e)
    }
  })

  app.get('/v1/payments/info', async (req, res) => {
    try {
      const token = typeof req.query.token === 'string' ? req.query.token.trim() : ''
      const paymentIdParam = typeof req.query.paymentId === 'string' ? req.query.paymentId.trim() : ''
      const sig = typeof req.query.sig === 'string' ? req.query.sig.trim() : ''
      if ((!token && !paymentIdParam) || !sig) return res.status(400).json({ error: 'missing_params' })

      const expectedSig = token ? signToken(token) : signToken(paymentIdParam)
      if (!safeEqual(sig, expectedSig)) return res.status(401).json({ error: 'invalid_signature' })

      const db = await getDb()
      const row = paymentIdParam
        ? await db.get(
            `SELECT r.prenom, r.nom, r.hebergement, r.residence_zone, p.id as payment_id, p.amount_cents, p.currency, p.status as payment_status, p.method
             FROM payments p JOIN registrations r ON r.id = p.registration_id WHERE p.id = ?`,
            [paymentIdParam],
          )
        : await db.get(
            `SELECT r.prenom, r.nom, r.hebergement, r.residence_zone, p.id as payment_id, p.amount_cents, p.currency, p.status as payment_status, p.method
             FROM badges b
             JOIN registrations r ON r.id = b.registration_id
             JOIN payments p ON p.registration_id = r.id
             WHERE b.token = ?`,
            [token],
          )
      if (!row) return res.status(404).json({ error: 'not_found' })

      return res.json({
        prenom: String(row.prenom || ''),
        nom: String(row.nom || ''),
        hebergement: String(row.hebergement || ''),
        residenceZone: String(row.residence_zone || ''),
        amountCents: row.amount_cents,
        currency: String(row.currency || 'EUR'),
        paymentStatus: String(row.payment_status || 'pending'),
        paymentMethod: String(row.method || ''),
      })
    } catch (e) {
      return res.status(500).json({ error: 'server_error' })
    }
  })

  app.post('/v1/payments/choose-accommodation', async (req, res) => {
    try {
      const body = req.body || {}
      const paymentIdParam = typeof body.paymentId === 'string' ? body.paymentId.trim() : ''
      const sig = typeof body.sig === 'string' ? body.sig.trim() : ''
      const hebergement = typeof body.hebergement === 'string' ? body.hebergement.trim() : ''
      if (!paymentIdParam || !sig || !hebergement) return res.status(400).json({ error: 'missing_params' })
      if (!safeEqual(sig, signToken(paymentIdParam))) return res.status(401).json({ error: 'invalid_signature' })
      if (!HEBERGEMENT_PRICES[hebergement]) return res.status(400).json({ error: 'invalid_hebergement' })

      const db = await getDb()
      const row = await db.get(
        `SELECT r.id, r.prenom, r.nom, r.residence_zone, p.id as payment_id, p.status as payment_status
         FROM payments p JOIN registrations r ON r.id = p.registration_id WHERE p.id = ?`,
        [paymentIdParam],
      )
      if (!row) return res.status(404).json({ error: 'not_found' })
      if (row.payment_status === 'paid') return res.status(400).json({ error: 'already_paid' })

      const pricing = hebergementPrice(hebergement, String(row.residence_zone || ''))
      if (!pricing) return res.status(400).json({ error: 'price_not_found' })

      await db.run(`UPDATE registrations SET hebergement = ?, updated_at = ? WHERE id = ?`, [hebergement, nowIso(), String(row.id)])
      await db.run(`UPDATE payments SET amount_cents = ?, currency = ?, updated_at = ?, updated_by = 'user_choice' WHERE id = ?`,
        [pricing.amountCents, pricing.currency, nowIso(), paymentIdParam])

      return res.json({ ok: true, hebergement, amountCents: pricing.amountCents, currency: pricing.currency })
    } catch (e) {
      return res.status(500).json({ error: 'server_error' })
    }
  })

  app.post('/v1/payments/choose-onsite', async (req, res) => {
    try {
      const body = req.body || {}
      const paymentIdParam = typeof body.paymentId === 'string' ? body.paymentId.trim() : ''
      const sig = typeof body.sig === 'string' ? body.sig.trim() : ''
      if (!paymentIdParam || !sig) return res.status(400).json({ error: 'missing_params' })
      if (!safeEqual(sig, signToken(paymentIdParam))) return res.status(401).json({ error: 'invalid_signature' })

      const db = await getDb()
      const row = await db.get(
        `SELECT r.*, p.id as payment_id, p.status as payment_status, p.method, p.amount_cents, p.currency
         FROM payments p JOIN registrations r ON r.id = p.registration_id WHERE p.id = ?`,
        [paymentIdParam],
      )
      if (!row) return res.status(404).json({ error: 'not_found' })
      if (row.payment_status === 'paid') return res.status(400).json({ error: 'already_paid' })

      await db.run(`UPDATE registrations SET paiement_mode = 'on_site', updated_at = ? WHERE id = ?`, [nowIso(), String(row.id)])
      await db.run(`UPDATE payments SET method = 'on_site', status = 'unpaid', updated_at = ?, updated_by = 'user_choice' WHERE id = ?`,
        [nowIso(), paymentIdParam])

      const badge = await ensureBadgeForRegistration(db, String(row.id))
      const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${Number(process.env.PORT) || 4000}`
      const badgeUrl = `${baseUrl.replace(/\/$/, '')}/v1/badge?token=${encodeURIComponent(String(badge.token))}&sig=${encodeURIComponent(signToken(String(badge.token)))}`

      const mailDisabled = ['1', 'true', 'yes'].includes(String(process.env.MAIL_DISABLED || '').toLowerCase().trim())
      if (!mailDisabled) {
        try {
          const fullName = `${String(row.prenom || '')} ${String(row.nom || '')}`
          const issuedDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
          let pdfAttachment
          try {
            const pdfBuffer = await buildBadgePdf({
              prenom: String(row.prenom || ''),
              nom: String(row.nom || ''),
              passportNum: String(row.passport_num || ''),
              zone: String(row.residence_zone || ''),
              issuedDate,
              badgeId: String(badge.id || ''),
            })
            const safeNom = String(row.nom || '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
            pdfAttachment = { filename: `badge-hog2026-${safeNom}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }
          } catch (pdfErr) {
            console.error('choose-onsite badge PDF failed', pdfErr && pdfErr.message ? String(pdfErr.message) : pdfErr)
          }
          await sendMail({
            to: String(row.email || ''),
            subject: `Inscription confirmée — H.O.G Tour 2026`,
            replyTo: String(process.env.MAIL_TO || process.env.MAIL_FROM || 'contact@hogalgierschapteralgeria.com'),
            html: buildConfirmationEmailHtml({
              prenom: String(row.prenom || ''),
              fullName,
              registrationId: String(row.id || ''),
              mode: 'on_site',
              paymentUrl: null,
              badgeUrl,
            }),
            text: `Bonjour ${fullName},\n\nVotre inscription au H.O.G Tour 2026 est confirmée. Paiement sur place.\nBadge : ${badgeUrl}\nRéférence : ${row.id}\n`,
            attachments: pdfAttachment ? [pdfAttachment] : undefined,
          })
        } catch (mailErr) {
          console.error('choose-onsite email failed', mailErr && mailErr.message ? String(mailErr.message) : mailErr)
        }
      }

      return res.json({ ok: true, badgeUrl })
    } catch (e) {
      return res.status(500).json({ error: 'server_error' })
    }
  })

  app.get('/v1/payments/yassir/result', async (req, res) => {
    try {
      const ref = typeof req.query.ref === 'string' ? req.query.ref.trim() : ''
      const internalId = typeof req.query.internalId === 'string' ? req.query.internalId.trim() : ''
      const urlStatus = typeof req.query.urlStatus === 'string' ? req.query.urlStatus.trim().toLowerCase() : ''
      if (!ref && !internalId) return res.status(400).json({ error: 'missing_params' })

      const db = await getDb()
      let row = internalId
        ? await db.get(
            `SELECT p.id as payment_id, p.registration_id, p.status as payment_status, p.reference, p.client_secret
             FROM payments p WHERE p.id = ?`,
            [internalId],
          )
        : await db.get(
            `SELECT p.id as payment_id, p.registration_id, p.status as payment_status, p.reference, p.client_secret
             FROM payments p WHERE p.reference = ? OR p.id = ?`,
            [ref, ref],
          )
      if (!row && urlStatus === 'success') {
        // Yassir's redirect paymentId doesn't match our stored IDs — find most recently updated pending payment
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        row = await db.get(
          `SELECT p.id as payment_id, p.registration_id, p.status as payment_status, p.reference, p.client_secret
           FROM payments p
           WHERE p.status = 'pending' AND (p.method LIKE 'yassir%')
             AND p.updated_at >= ?
           ORDER BY p.updated_at DESC LIMIT 1`,
          [twoHoursAgo],
        )
        if (row) {
          console.log(`yassir result: matched ref=${ref} to payment_id=${row.payment_id} via recent-pending fallback`)
        } else {
          console.log(`yassir result: no record found for ref=${ref} and no recent pending payment, trusting urlStatus=success without DB update`)
          return res.json({ payment: { status: 'paid' }, badgeUrl: null })
        }
      }
      if (!row) return res.status(404).json({ error: 'not_found' })

      let finalStatus = String(row.payment_status || 'pending')
      let justPaid = false

      const intentId = String(row.reference || ref || '').trim()
      try {
        const chk = intentId ? await checkIntent({ intentId, clientSecret: row.client_secret || undefined }) : null
        const mappedStatus = chk ? extractYassirStatus(chk) : null
        console.log(`yassir result check: ref=${intentId} raw=${JSON.stringify(chk && chk.data ? { statusCode: chk.data.statusCode, status: chk.data.status } : chk)} mapped=${mappedStatus}`)
        if (mappedStatus && mappedStatus !== finalStatus) {
          await db.run(
            `UPDATE payments SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?`,
            [mappedStatus, nowIso(), 'yassir_api', String(row.payment_id)],
          )
          if (mappedStatus === 'paid') justPaid = true
          finalStatus = mappedStatus
        }
      } catch (chkErr) {
        console.error(`yassir result checkIntent failed: ref=${ref}`, chkErr && chkErr.message ? String(chkErr.message) : chkErr, chkErr && chkErr.body ? JSON.stringify(chkErr.body) : '')
      }

      // Fallback: trust Yassir's redirect status=success when checkIntent fails or returns non-paid
      if (finalStatus !== 'paid' && urlStatus === 'success') {
        console.log(`yassir result: checkIntent inconclusive, trusting urlStatus=success for ref=${ref}`)
        await db.run(
          `UPDATE payments SET status = 'paid', updated_at = ?, updated_by = 'yassir_redirect' WHERE id = ?`,
          [nowIso(), String(row.payment_id)],
        )
        justPaid = true
        finalStatus = 'paid'
      }

      let badgeUrl = null
      if (finalStatus === 'paid') {
        const b = await ensureBadgeForRegistration(db, String(row.registration_id))
        const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${Number(process.env.PORT) || 4000}`
        badgeUrl = `${baseUrl.replace(/\/$/, '')}/v1/badge?token=${encodeURIComponent(String(b.token))}&sig=${encodeURIComponent(signToken(String(b.token)))}`

        if (justPaid) {
          const mailDisabled = ['1', 'true', 'yes'].includes(String(process.env.MAIL_DISABLED || '').toLowerCase().trim())
          if (!mailDisabled) {
            try {
              const reg = await db.get(`SELECT * FROM registrations WHERE id = ?`, [row.registration_id])
              if (reg) {
                const fullName = `${String(reg.prenom || '')} ${String(reg.nom || '')}`
                const issuedDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
                let pdfAttachment
                try {
                  const pdfBuffer = await buildBadgePdf({
                    prenom: String(reg.prenom || ''),
                    nom: String(reg.nom || ''),
                    passportNum: String(reg.passport_num || ''),
                    zone: String(reg.residence_zone || ''),
                    issuedDate,
                    badgeId: String(b.id || ''),
                  })
                  const safeNom = String(reg.nom || '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
                  pdfAttachment = { filename: `badge-hog2026-${safeNom}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }
                } catch (pdfErr) {
                  console.error('badge PDF generation failed', pdfErr && pdfErr.message ? String(pdfErr.message) : pdfErr)
                }
                await sendMail({
                  to: String(reg.email || ''),
                  subject: `Paiement confirmé — H.O.G Tour 2026`,
                  replyTo: String(process.env.MAIL_TO || process.env.MAIL_FROM || 'contact@hogalgierschapteralgeria.com'),
                  html: buildConfirmationEmailHtml({
                    prenom: String(reg.prenom || ''),
                    fullName,
                    registrationId: String(reg.id || ''),
                    mode: 'paid',
                    paymentUrl: null,
                    badgeUrl,
                  }),
                  text: `Bonjour ${fullName},\n\nVotre paiement est confirmé. Accédez à votre badge : ${badgeUrl}\nRéférence : ${reg.id}\n`,
                  attachments: pdfAttachment ? [pdfAttachment] : undefined,
                })
              }
            } catch (mailErr) {
              console.error('result confirmation email failed', mailErr && mailErr.message ? String(mailErr.message) : mailErr)
            }
          }
        }
      }

      return res.json({ payment: { status: finalStatus }, badgeUrl })
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
      const qrPayload = [
        'HOG TOUR 2026',
        `NOM: ${String(badge.nom || '').toUpperCase()} ${String(badge.prenom || '').toUpperCase()}`,
        `PASSPORT: ${String(badge.passport_num || '')}`,
      ].join('\n')
      const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 2, width: 280, color: { dark: '#000000', light: '#ffffff' } })

      const issuedDate = badge.issued_at
        ? new Date(badge.issued_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
        : ''
      const zone = String(badge.residence_zone || '').trim()
      const pdfUrl = `${badgeUrl.replace('/v1/badge?', '/v1/badge/pdf?')}`
      const html = buildBadgeHtml({
        prenom: String(badge.prenom || ''),
        nom: String(badge.nom || ''),
        email: String(badge.email || ''),
        passportNum: String(badge.passport_num || ''),
        zone,
        issuedDate,
        badgeId: String(badge.badge_id || ''),
        qrDataUrl,
        pdfUrl,
      })

      res.setHeader('content-type', 'text/html; charset=utf-8')
      return res.status(200).send(html)
    } catch (e) {
      return res.status(500).json({ error: 'server_error' })
    }
  })

  app.get('/v1/badge/pdf', async (req, res) => {
    try {
      const token = typeof req.query.token === 'string' ? req.query.token : ''
      const sig = typeof req.query.sig === 'string' ? req.query.sig : ''
      if (!token || !sig) return res.status(400).json({ error: 'missing_params' })

      const expectedSig = signToken(token)
      if (!safeEqual(sig, expectedSig)) return res.status(401).json({ error: 'invalid_signature' })

      const db = await getDb()
      const badge = await db.get(
        `SELECT b.id as badge_id, b.issued_at, r.id as registration_id, r.prenom, r.nom, r.passport_num, r.residence_zone
         FROM badges b
         JOIN registrations r ON r.id = b.registration_id
         WHERE b.token = ?`,
        [token],
      )
      if (!badge) return res.status(404).json({ error: 'not_found' })

      const issuedDate = badge.issued_at
        ? new Date(badge.issued_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
        : ''
      const pdfBuffer = await buildBadgePdf({
        prenom: String(badge.prenom || ''),
        nom: String(badge.nom || ''),
        passportNum: String(badge.passport_num || ''),
        zone: String(badge.residence_zone || ''),
        issuedDate,
        badgeId: String(badge.badge_id || ''),
      })

      const safeNom = String(badge.nom || '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
      res.setHeader('content-type', 'application/pdf')
      res.setHeader('content-disposition', `attachment; filename="badge-hog2026-${safeNom}.pdf"`)
      return res.send(pdfBuffer)
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

  app.post('/v1/admin/registrations/:id/payment/check', requireAdmin, async (req, res) => {
    try {
      const db = await getDb()
      const payment = await db.get(
        `SELECT p.id as payment_id, p.registration_id, p.status as payment_status, p.reference, p.client_secret
         FROM payments p JOIN registrations r ON r.id = p.registration_id WHERE r.id = ?`,
        [req.params.id],
      )
      if (!payment) return res.status(404).json({ error: 'not_found' })
      const intentId = String(payment.reference || '').trim()
      if (!intentId) return res.status(400).json({ error: 'no_reference', message: 'Payment has no Yassir reference stored yet.' })

      const chk = await checkIntent({ intentId, clientSecret: payment.client_secret || undefined })
      const mappedStatus = extractYassirStatus(chk)
      console.log(`admin force-check: registration=${req.params.id} ref=${intentId} raw=${JSON.stringify(chk && chk.data ? { statusCode: chk.data.statusCode, status: chk.data.status } : chk)} mapped=${mappedStatus}`)

      let updated = false
      if (mappedStatus && mappedStatus !== String(payment.payment_status || '').trim()) {
        await db.run(
          `UPDATE payments SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?`,
          [mappedStatus, nowIso(), 'admin_force_check', String(payment.payment_id)],
        )
        updated = true
        if (mappedStatus === 'paid') {
          await ensureBadgeForRegistration(db, String(payment.registration_id))
        }
      }

      const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${Number(process.env.PORT) || 4000}`
      const badge = await db.get(`SELECT token FROM badges WHERE registration_id = ?`, [payment.registration_id])
      const badgeUrl = badge
        ? `${baseUrl.replace(/\/$/, '')}/v1/badge?token=${encodeURIComponent(badge.token)}&sig=${encodeURIComponent(signToken(badge.token))}`
        : null

      return res.json({
        ok: true,
        updated,
        previousStatus: String(payment.payment_status || ''),
        newStatus: mappedStatus || String(payment.payment_status || ''),
        badgeUrl,
        yassir: chk,
      })
    } catch (e) {
      return res.status(500).json({
        error: 'server_error',
        message: e && e.message ? String(e.message) : String(e),
        details: e && e.body ? e.body : undefined,
      })
    }
  })

  return app
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function buildBadgeHtml({ prenom, nom, email, passportNum, zone, issuedDate, badgeId, qrDataUrl, pdfUrl }) {
  const h = escapeHtml
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${h(prenom)} ${h(nom)} — Badge H.O.G Tour 2026</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0A0A08;color:#F0EBE0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,Arial,sans-serif;min-height:100vh}
    .grain{position:fixed;inset:0;pointer-events:none;z-index:999;opacity:.04;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:160px;mix-blend-mode:overlay}
    .glow{position:fixed;inset:-40% -40%;pointer-events:none;z-index:0;background:radial-gradient(700px 500px at 50% 25%,rgba(255,107,0,.16) 0%,transparent 70%)}
    .wrap{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 16px}
    .card{width:100%;max-width:460px;position:relative}
    .corners{position:absolute;inset:0;background:linear-gradient(#FF6B00,#FF6B00) top left/30px 1px no-repeat,linear-gradient(#FF6B00,#FF6B00) top left/1px 30px no-repeat,linear-gradient(#FF6B00,#FF6B00) top right/30px 1px no-repeat,linear-gradient(#FF6B00,#FF6B00) top right/1px 30px no-repeat,linear-gradient(#FF6B00,#FF6B00) bottom left/30px 1px no-repeat,linear-gradient(#FF6B00,#FF6B00) bottom left/1px 30px no-repeat,linear-gradient(#FF6B00,#FF6B00) bottom right/30px 1px no-repeat,linear-gradient(#FF6B00,#FF6B00) bottom right/1px 30px no-repeat;opacity:.45;pointer-events:none;z-index:2}
    .top-bar{background:#FF6B00;height:3px}
    .header{padding:28px 30px 22px;border:1px solid rgba(255,107,0,.14);border-top:none;background:rgba(14,11,8,.97)}
    .eyebrow{display:flex;align-items:center;gap:10px;margin-bottom:16px}
    .eline{width:22px;height:1px;background:rgba(255,107,0,.55)}
    .etxt{font-size:9px;letter-spacing:.4em;text-transform:uppercase;color:rgba(255,107,0,.75)}
    .role{font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:rgba(255,255,255,.35);margin-bottom:6px}
    .name{font-size:clamp(26px,6vw,38px);font-weight:900;letter-spacing:.05em;text-transform:uppercase;color:#F0EBE0;line-height:1.05}
    .zone-pill{display:inline-block;background:#FF6B00;color:#000;font-size:9px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;padding:3px 10px;margin-top:10px}
    .divider{height:1px;background:linear-gradient(to right,transparent,rgba(255,107,0,.35),transparent);margin:20px 0}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:0}
    .cell{padding:10px 12px;border:1px solid rgba(255,107,0,.07);background:rgba(255,107,0,.02)}
    .clabel{font-size:8px;letter-spacing:.3em;text-transform:uppercase;color:rgba(255,255,255,.28);margin-bottom:4px}
    .cval{font-size:12px;font-weight:600;color:rgba(255,255,255,.82);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .qr-section{padding:0 30px 26px;border:1px solid rgba(255,107,0,.14);border-top:none;background:rgba(14,11,8,.97)}
    .qr-wrap{background:#fff;padding:14px;display:flex;justify-content:center;margin-bottom:14px}
    .qr-wrap img{display:block;width:230px;height:230px;image-rendering:pixelated}
    .route{display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 14px;border:1px solid rgba(255,107,0,.09);background:rgba(255,107,0,.03)}
    .rcity{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.55)}
    .rarrow{color:rgba(255,107,0,.65);font-size:13px}
    .scan{margin-top:12px;text-align:center;font-size:9px;letter-spacing:.28em;text-transform:uppercase;color:rgba(255,255,255,.28)}
    .bid{margin-top:8px;text-align:center;font-size:9px;font-family:monospace;color:rgba(255,255,255,.16);word-break:break-all}
    .bottom-bar{background:rgba(255,107,0,.35);height:1px}
    .dl-wrap{margin-top:24px;display:flex;justify-content:center;gap:12px;flex-wrap:wrap}
    .dl-btn{display:inline-flex;align-items:center;gap:8px;background:#FF6B00;color:#000;font-weight:700;font-size:11px;letter-spacing:3px;text-transform:uppercase;border:none;cursor:pointer;padding:14px 28px;text-decoration:none;transition:opacity .15s}
    .dl-btn:hover{opacity:.85}
    .dl-btn.secondary{background:transparent;color:rgba(255,255,255,.55);border:1px solid rgba(255,107,0,.25)}
    .dl-btn.secondary:hover{border-color:rgba(255,107,0,.55);color:#fff}
    @media print{.grain,.glow,.dl-wrap{display:none!important}.wrap{padding:0;justify-content:flex-start}.card{max-width:100%}}
  </style>
</head>
<body>
  <div class="grain"></div>
  <div class="glow"></div>
  <div class="wrap">
    <div id="badge-card" class="card">
      <div class="corners"></div>
      <div class="top-bar"></div>
      <div class="header">
        <div class="eyebrow">
          <div class="eline"></div>
          <span class="etxt">H.O.G Algiers Chapter</span>
          <div class="eline"></div>
        </div>
        <div class="role">Participant · H.O.G Tour 2026</div>
        <div class="name">${h(prenom)}<br>${h(nom)}</div>
        ${zone ? `<div class="zone-pill">${h(zone)}</div>` : ''}
        <div class="divider"></div>
        <div class="grid">
          <div class="cell"><div class="clabel">Passeport</div><div class="cval">${h(passportNum)}</div></div>
          <div class="cell"><div class="clabel">Émis le</div><div class="cval">${h(issuedDate)}</div></div>
          <div class="cell"><div class="clabel">Dates</div><div class="cval">29 Oct — 1 Nov</div></div>
          <div class="cell"><div class="clabel">Distance</div><div class="cval">1 580 km</div></div>
        </div>
      </div>
      <div class="qr-section">
        <div class="qr-wrap"><img src="${qrDataUrl}" alt="QR Code" width="230" height="230"/></div>
        <div class="route">
          <span class="rcity">Alger</span>
          <span class="rarrow">→</span>
          <span class="rcity">Ghardaïa</span>
          <span class="rarrow">→</span>
          <span class="rcity">Alger</span>
        </div>
        <div class="scan">Scannez pour vérifier</div>
        <div class="bid">${h(badgeId)}</div>
      </div>
      <div class="bottom-bar"></div>
    </div>

    <div class="dl-wrap">
      ${pdfUrl ? `<a class="dl-btn" href="${h(pdfUrl)}" download="badge-hog2026-${h(String(nom || '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase())}.pdf">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 3v13M5 14l7 7 7-7"/><path d="M3 21h18"/></svg>
        Télécharger mon badge (PDF)
      </a>` : ''}
      <button class="dl-btn secondary" onclick="window.print()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
        Imprimer
      </button>
    </div>
  </div>
</body>
</html>`
}

async function buildBadgePdf({ prenom, nom, passportNum, zone, issuedDate, badgeId }) {
  const PDFDocument = require('pdfkit')
  const qrPayload = [
    'HOG TOUR 2026',
    `NOM: ${String(nom || '').toUpperCase()} ${String(prenom || '').toUpperCase()}`,
    `PASSPORT: ${String(passportNum || '')}`,
  ].join('\n')
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 2, width: 300, color: { dark: '#000000', light: '#ffffff' } })
  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64')

  return new Promise((resolve, reject) => {
    const W = 420
    const H = 600
    const PAD = 28
    const doc = new PDFDocument({
      size: [W, H],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: { Title: `Badge H.O.G Tour 2026 — ${prenom} ${nom}` },
    })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Background
    doc.rect(0, 0, W, H).fill('#0A0A08')
    // Top orange bar
    doc.rect(0, 0, W, 4).fill('#FF6B00')
    // Header block
    doc.rect(0, 4, W, 258).fill('#111009')
    doc.rect(0, 4, W, 258).strokeColor('#FF6B00').strokeOpacity(0.12).lineWidth(0.7).stroke()

    // Eyebrow
    let y = 28
    doc.moveTo(PAD, y + 4).lineTo(PAD + 16, y + 4).strokeColor('#FF6B00').strokeOpacity(0.55).lineWidth(0.7).stroke()
    doc.font('Helvetica').fontSize(7).fillColor('#FF6B00').fillOpacity(0.75)
      .text('H.O.G ALGIERS CHAPTER', PAD + 22, y, { characterSpacing: 2.5, lineBreak: false })
    doc.moveTo(W - PAD - 16, y + 4).lineTo(W - PAD, y + 4).strokeColor('#FF6B00').strokeOpacity(0.55).lineWidth(0.7).stroke()

    // Role
    y = 48
    doc.fillOpacity(1).font('Helvetica').fontSize(8).fillColor('#666050')
      .text('PARTICIPANT · H.O.G TOUR 2026', PAD, y, { characterSpacing: 2, lineBreak: false })

    // Name
    y = 66
    doc.font('Helvetica-Bold').fontSize(30).fillColor('#F0EBE0').fillOpacity(1)
      .text(String(prenom || '').toUpperCase(), PAD, y, { lineBreak: false })
    y += 34
    doc.font('Helvetica-Bold').fontSize(30).fillColor('#F0EBE0')
      .text(String(nom || '').toUpperCase(), PAD, y, { lineBreak: false })

    // Zone pill
    y += 42
    if (zone) {
      doc.rect(PAD, y, 70, 16).fill('#FF6B00')
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#000000')
        .text(String(zone).toUpperCase(), PAD + 8, y + 4, { characterSpacing: 1.5, lineBreak: false })
      y += 24
    }

    // Divider
    y += 4
    doc.moveTo(PAD, y).lineTo(W - PAD, y).strokeColor('#FF6B00').strokeOpacity(0.28).lineWidth(0.5).stroke()
    y += 12

    // Info grid 2×2
    const cellW = (W - PAD * 2 - 8) / 2
    const cellH = 42
    const cells = [
      { label: 'PASSEPORT', val: String(passportNum || '—') },
      { label: 'ÉMIS LE', val: String(issuedDate || '—') },
      { label: 'DATES', val: '29 Oct — 1 Nov' },
      { label: 'DISTANCE', val: '1 580 km' },
    ]
    cells.forEach((cell, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const cx = PAD + col * (cellW + 8)
      const cy = y + row * (cellH + 6)
      doc.rect(cx, cy, cellW, cellH).strokeColor('#FF6B00').strokeOpacity(0.09).lineWidth(0.5).stroke()
      doc.font('Helvetica').fontSize(7).fillColor('#555040').fillOpacity(1)
        .text(cell.label, cx + 8, cy + 8, { characterSpacing: 2, lineBreak: false })
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#D0C8BC').fillOpacity(1)
        .text(cell.val, cx + 8, cy + 22, { lineBreak: false, width: cellW - 16, ellipsis: true })
    })

    y += 2 * (cellH + 6) + 10

    // QR section
    doc.rect(0, y, W, H - y).fill('#111009')
    doc.moveTo(0, y).lineTo(W, y).strokeColor('#FF6B00').strokeOpacity(0.1).lineWidth(0.5).stroke()
    y += 16

    // QR image (white bg)
    const qrSize = 168
    const qrX = Math.round((W - qrSize) / 2)
    doc.rect(qrX - 12, y, qrSize + 24, qrSize + 24).fill('#ffffff')
    doc.image(qrBuffer, qrX, y + 12, { width: qrSize, height: qrSize })
    y += qrSize + 38

    // Route
    doc.font('Helvetica').fontSize(9).fillColor('#FF6B00').fillOpacity(0.8)
      .text('ALGER  →  GHARDAÏA  →  ALGER', 0, y, { align: 'center', width: W, characterSpacing: 1.5 })
    y += 18

    // Scan label
    doc.font('Helvetica').fontSize(7).fillColor('#444030').fillOpacity(1)
      .text('SCANNEZ POUR VÉRIFIER', 0, y, { align: 'center', width: W, characterSpacing: 2.5 })
    y += 13

    // Badge ID
    doc.font('Helvetica').fontSize(6).fillColor('#282820').fillOpacity(1)
      .text(String(badgeId || ''), 0, y, { align: 'center', width: W })

    // Bottom bar
    doc.rect(0, H - 2, W, 2).fill('#FF6B00').fillOpacity(0.35)

    doc.end()
  })
}

function buildConfirmationEmailHtml({ prenom, fullName, registrationId, mode, paymentUrl, badgeUrl }) {
  const h = escapeHtml
  const isPaid = mode === 'paid'
  const isPending = mode === 'payment_pending'
  const isOnSite = mode === 'on_site'
  const ctaUrl = isPaid ? (badgeUrl || null) : null
  const ctaLabel = isPaid ? 'ACCÉDER À MON BADGE' : null
  const mainMsg = isPaid
    ? `Votre inscription au <strong style="color:#FF6B00;">H.O.G Tour 2026</strong> est confirmée. Votre badge officiel est disponible — conservez-le précieusement, il vous sera demandé lors de l'événement.`
    : isPending
      ? `Votre paiement pour le <strong style="color:#FF6B00;">H.O.G Tour 2026</strong> est en cours de traitement. Vous recevrez votre badge de participation par email dès que le paiement sera confirmé.`
      : isOnSite
        ? `Votre inscription au <strong style="color:#FF6B00;">H.O.G Tour 2026</strong> est bien enregistrée. Vous avez choisi le <strong style="color:#FF6B00;">paiement sur place</strong> — réglez votre inscription lors de l'événement.`
        : `Votre inscription au <strong style="color:#FF6B00;">H.O.G Tour 2026</strong> a bien été reçue. Vous allez recevoir un lien de paiement par email.`

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>H.O.G Tour 2026</title></head>
<body style="margin:0;padding:0;background:#0A0A08;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0A08;padding:48px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">

  <!-- Top orange bar -->
  <tr><td style="background:#FF6B00;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

  <!-- Header -->
  <tr><td style="background:#111009;border:1px solid rgba(255,107,0,.14);border-top:none;padding:40px 44px 32px;">
    <p style="margin:0 0 10px;font-size:9px;letter-spacing:5px;text-transform:uppercase;color:rgba(255,107,0,.7);">H.O.G Algiers Chapter Algeria</p>
    <h1 style="margin:0 0 4px;font-size:34px;font-weight:900;letter-spacing:4px;text-transform:uppercase;color:#FF6B00;line-height:1;">H.O.G TOUR</h1>
    <p style="margin:0 0 28px;font-size:20px;font-weight:900;letter-spacing:4px;color:rgba(255,255,255,.15);">2026</p>
    <hr style="border:none;border-top:1px solid rgba(255,107,0,.18);margin:0 0 28px;">
    <p style="margin:0 0 16px;font-size:16px;color:rgba(255,255,255,.85);line-height:1.5;">
      Bonjour <strong style="color:#FF6B00;">${h(prenom)}</strong>,
    </p>
    <p style="margin:0 ${ctaUrl ? '32px' : '0'} 0;font-size:14px;color:rgba(255,255,255,.6);line-height:1.9;">${mainMsg}</p>
    ${ctaUrl ? `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;">
      <tr>
        <td style="background:#FF6B00;padding:16px 38px;">
          <a href="${h(ctaUrl)}" style="color:#000;font-weight:700;font-size:11px;letter-spacing:3px;text-transform:uppercase;text-decoration:none;">${ctaLabel} &rarr;</a>
        </td>
      </tr>
    </table>` : ''}
  </td></tr>

  <!-- Details -->
  <tr><td style="background:#0D0C09;border:1px solid rgba(255,107,0,.09);border-top:none;padding:28px 44px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="50%" style="padding:12px 16px 12px 0;border-bottom:1px solid rgba(255,255,255,.05);">
          <p style="margin:0;font-size:8px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.28);">Participant</p>
          <p style="margin:5px 0 0;font-size:14px;font-weight:700;color:rgba(255,255,255,.85);">${h(fullName)}</p>
        </td>
        <td width="50%" style="padding:12px 0 12px 16px;border-bottom:1px solid rgba(255,255,255,.05);">
          <p style="margin:0;font-size:8px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.28);">Référence</p>
          <p style="margin:5px 0 0;font-size:12px;font-weight:600;color:rgba(255,255,255,.7);font-family:monospace;">${h(registrationId)}</p>
        </td>
      </tr>
      <tr>
        <td width="50%" style="padding:12px 16px 0 0;">
          <p style="margin:0;font-size:8px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.28);">Dates</p>
          <p style="margin:5px 0 0;font-size:13px;font-weight:600;color:rgba(255,255,255,.75);">29 Oct — 1 Nov 2026</p>
        </td>
        <td width="50%" style="padding:12px 0 0 16px;">
          <p style="margin:0;font-size:8px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.28);">Route</p>
          <p style="margin:5px 0 0;font-size:13px;font-weight:600;color:rgba(255,255,255,.75);">Alger &rarr; Gharda&iuml;a &rarr; Alger</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#0A0A08;border:1px solid rgba(255,107,0,.06);border-top:none;padding:22px 44px;text-align:center;">
    <p style="margin:0 0 6px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.2);">Pour toute question</p>
    <a href="mailto:contact@hogalgierschapteralgeria.com" style="color:rgba(255,107,0,.65);font-size:12px;text-decoration:none;">contact@hogalgierschapteralgeria.com</a>
    <p style="margin:16px 0 0;font-size:9px;color:rgba(255,255,255,.12);letter-spacing:2px;">H.O.G ALGIERS CHAPTER ALGERIA &middot; 2026</p>
  </td></tr>

  <!-- Bottom bar -->
  <tr><td style="background:rgba(255,107,0,.4);height:1px;font-size:0;line-height:0;">&nbsp;</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

async function createStartedApp() {
  await initDb()
  return createApp()
}

module.exports = { createApp, createStartedApp }
