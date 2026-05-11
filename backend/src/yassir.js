const { iso2ToIso3 } = require('./iso3166')

function requiredEnv(name) {
  const v = String(process.env[name] || '').trim()
  if (!v) throw new Error(`${name} is not configured`)
  return v
}

function getBaseUrl() {
  return (process.env.YASSIR_BASE_URL || 'https://stg-api.payment.yassir.io').replace(/\/$/, '')
}

function getAuthHeader() {
  const clientId = requiredEnv('YASSIR_CLIENT_ID')
  const clientSecret = requiredEnv('YASSIR_CLIENT_SECRET')
  const token = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')
  return `Bearer ${token}`
}

async function yassirRequest(method, path, { query, body } = {}) {
  const baseUrl = getBaseUrl()
  const u = new URL(baseUrl + path)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v == null) continue
      u.searchParams.set(k, String(v))
    }
  }

  const platform = String(process.env.YASSIR_PLATFORM || 'API').trim().toUpperCase() || 'API'
  const sdkVersion = String(process.env.YASSIR_SDK_VERSION || '').trim()

  const headers = {
    accept: 'application/json',
    authorization: getAuthHeader(),
    'x-platform': platform,
  }
  if (platform !== 'API' && sdkVersion) {
    headers['x-sdk-version'] = sdkVersion
  }
  let payload
  if (body !== undefined) {
    headers['content-type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const res = await fetch(u.toString(), { method, headers, body: payload })
  const text = await res.text().catch(() => '')
  let json = null
  if (text) {
    try { json = JSON.parse(text) } catch { json = null }
  }

  if (!res.ok) {
    const err = new Error(`Yassir API error (${res.status})`)
    err.status = res.status
    err.body = json ?? text
    throw err
  }

  return json ?? {}
}

function normalizePhoneE164(v) {
  const raw = String(v || '').trim()
  if (!raw) return ''
  if (raw.startsWith('+')) return raw.replace(/\s+/g, '')
  const digits = raw.replace(/[^\d]/g, '')
  return digits ? `+${digits}` : ''
}

function normalizeCustomerResponse(v) {
  if (!v || typeof v !== 'object') return v
  if (v.id) return v
  if (v.customer && typeof v.customer === 'object') {
    if (v.customer.id) return v.customer
    if (v.customer.customerId) return { ...v.customer, id: v.customer.customerId }
  }
  if (v.data && typeof v.data === 'object') {
    if (v.data.id) return v.data
    if (v.data.customerId) return { ...v.data, id: v.data.customerId }
  }
  if (v.result && typeof v.result === 'object') {
    if (v.result.id) return v.result
    if (v.result.customerId) return { ...v.result, id: v.result.customerId }
  }
  if (v.customerId) return { ...v, id: v.customerId }
  if (v.customer_id) return { ...v, id: v.customer_id }
  return v
}

async function ensureCustomer({ phoneE164, email, firstName, lastName }) {
  const phone = normalizePhoneE164(phoneE164)
  if (!phone) throw new Error('phoneE164 is required')

  const isNotFound = (e) => {
    const status = e && e.status
    const body = e && e.body
    const msg =
      (body && typeof body === 'object' && body.message ? String(body.message) : '') ||
      (e && e.message ? String(e.message) : '')
    if (status === 404) return true
    if (status === 400 && /not found/i.test(msg)) return true
    return false
  }

  try {
    const found = await yassirRequest('GET', `/api/v1/customers/search/${encodeURIComponent(phone)}`)
    return normalizeCustomerResponse(found)
  } catch (e) {
    if (isNotFound(e)) {
      const name = `${String(firstName || '').trim()} ${String(lastName || '').trim()}`.trim()
      const created = await yassirRequest('POST', `/api/v1/customers`, {
        body: {
          phone,
          name: name || undefined,
          email: email || undefined,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        },
      })
      return normalizeCustomerResponse(created)
    }
    throw e
  }
}

async function listPaymentMethods({ country, amountCents }) {
  const c = iso2ToIso3(country)
  return yassirRequest('GET', `/api/v1/payment-methods`, {
    query: { countryCode: c || undefined, amount: amountCents != null ? Number(amountCents) : undefined },
  })
}

async function createPaymentIntent({ customerId, country, amountCents, currency, merchantTransactionId, description, callbackUrl, successRedirectUrl, failRedirectUrl }) {
  const countryCode = iso2ToIso3(country)
  if (!countryCode) throw new Error('countryCode is required')
  const body = {
    customerId,
    countryCode,
    amount: Number(amountCents),
    currency,
    merchantTransactionId,
    description,
    callbackUrl,
    successRedirectUrl,
    failRedirectUrl,
  }
  return yassirRequest('POST', `/api/v1/payments/intents`, { body })
}

async function proceedIntent({ intentId, paymentMethodCode, paymentMethodId, msisdn, otp }) {
  const body = {
    ...(paymentMethodCode ? { paymentMethodCode, paymentMethod: paymentMethodCode } : {}),
    ...(paymentMethodId ? { paymentMethodId } : {}),
    ...(msisdn ? { msisdn } : {}),
    ...(otp ? { otp } : {}),
  }
  return yassirRequest('POST', `/api/v1/payments/intents/${encodeURIComponent(intentId)}/proceed`, { body })
}

async function checkIntent({ intentId }) {
  return yassirRequest('GET', `/api/v1/payments/intents/${encodeURIComponent(intentId)}/check`)
}

module.exports = {
  getBaseUrl,
  yassirRequest,
  ensureCustomer,
  listPaymentMethods,
  createPaymentIntent,
  proceedIntent,
  checkIntent,
  normalizePhoneE164,
}
