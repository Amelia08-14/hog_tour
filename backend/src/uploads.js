const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

function getUploadsDir() {
  const raw = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads')
  const resolved = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw)
  fs.mkdirSync(resolved, { recursive: true })
  return resolved
}

function safeBasename(name) {
  const s = String(name || '').replace(/[/\\?%*:|"<>]/g, '_').trim()
  return s || 'file'
}

function getExtFromName(name) {
  const base = safeBasename(name)
  const ext = path.extname(base).toLowerCase()
  if (!ext || ext.length > 12) return ''
  return ext
}

async function writeRegistrationFiles(registrationId, files) {
  const uploadsDir = getUploadsDir()
  const out = []
  const rid = String(registrationId)
  const dir = path.join(uploadsDir, rid)
  await fs.promises.mkdir(dir, { recursive: true })

  for (const f of files || []) {
    if (!f || !Buffer.isBuffer(f.buffer) || !f.buffer.length) continue
    const id = uuidv4()
    const ext = getExtFromName(f.originalname)
    const storedName = `${id}${ext}`
    const storagePath = path.join(rid, storedName)
    const abs = path.join(uploadsDir, storagePath)
    await fs.promises.writeFile(abs, f.buffer)
    out.push({
      id,
      registrationId: rid,
      originalName: safeBasename(f.originalname),
      mime: String(f.mimetype || ''),
      size: typeof f.size === 'number' ? f.size : f.buffer.length,
      storagePath,
    })
  }

  return out
}

async function deleteStoredFiles(storagePaths) {
  const uploadsDir = getUploadsDir()
  for (const sp of storagePaths || []) {
    const p = String(sp || '')
    if (!p) continue
    const abs = path.resolve(uploadsDir, p)
    if (!abs.startsWith(path.resolve(uploadsDir) + path.sep)) continue
    try { await fs.promises.unlink(abs) } catch {}
  }
}

function resolveStoragePath(storagePath) {
  const uploadsDir = getUploadsDir()
  const abs = path.resolve(uploadsDir, String(storagePath || ''))
  if (!abs.startsWith(path.resolve(uploadsDir) + path.sep)) return null
  return abs
}

module.exports = { getUploadsDir, writeRegistrationFiles, deleteStoredFiles, resolveStoragePath }

