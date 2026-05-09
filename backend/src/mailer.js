const nodemailer = require('nodemailer')

let transporterPromise

function bool(v) {
  const s = String(v || '').toLowerCase().trim()
  return s === '1' || s === 'true' || s === 'yes'
}

async function getTransporter() {
  if (transporterPromise) return transporterPromise

  transporterPromise = (async () => {
    const host = String(process.env.SMTP_HOST || '')
    const port = Number(process.env.SMTP_PORT || 587)
    const secure = bool(process.env.SMTP_SECURE)
    const user = String(process.env.SMTP_USER || '')
    const pass = String(process.env.SMTP_PASS || '')

    if (!host || !user || !pass) throw new Error('SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS)')

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    })
  })()

  return transporterPromise
}

async function sendMail({ subject, text, html, replyTo }) {
  if (bool(process.env.MAIL_DISABLED)) return

  const from = String(process.env.MAIL_FROM || 'contact@hogalgierschapteralgeria.com')
  const to = String(process.env.MAIL_TO || 'contact@hogalgierschapteralgeria.com')

  const transporter = await getTransporter()
  await transporter.sendMail({
    from,
    to,
    replyTo: replyTo || undefined,
    subject,
    text,
    html,
  })
}

module.exports = { sendMail }

