require('dotenv').config()
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
async function main() {
  const username = String(process.argv[2] || '').toLowerCase()
  const name = process.argv[3] || username
  const station = process.argv[4] || 'both'
  if (!/^[a-z0-9._-]{3,80}$/.test(username) || name.length > 120 || !['both', 'alger', 'ghardaia'].includes(station)) throw new Error('Usage: npm run checkin:user -- identifiant "Nom agent" [both|alger|ghardaia] [--simple]')
  // --simple : mot de passe a saisir au pouce sur un telephone, en plein
  // soleil, par une equipe pressee. Reste tire au sort.
  const simple = process.argv.includes('--simple')
  const filename = path.resolve(process.env.CHECKIN_USERS_FILE || './config/checkin-users.json')
  fs.mkdirSync(path.dirname(filename), { recursive: true })
  const list = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : []
  if (list.some(u => u.username === username)) throw new Error('Compte existant. Désactive-le ou retire-le du fichier avant de le recréer.')
  // Le mot de passe n’apparaît ni dans les arguments du processus ni dans le fichier JSON.
  const password = simple ? simplePassword() : crypto.randomBytes(18).toString('base64url')
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  list.push({ username, name, stations: station === 'both' ? ['alger', 'ghardaia'] : [station], passwordHash: `scrypt:${salt}:${hash}` })
  fs.writeFileSync(filename, JSON.stringify(list, null, 2) + '\n', { mode: 0o600 })
  console.log(`Compte créé : ${username}\nMot de passe (à conserver) : ${password}\nCHECKIN_USERS_FILE=${filename}`)
}
// Deux mots tires au sort et quatre chiffres : minuscules uniquement, aucun
// caractere ambigu, et assez d'aleatoire pour resister a la limite de 10
// tentatives par quart d'heure imposee par le serveur.
const WORDS = [
  'sable', 'route', 'dune', 'moto', 'casque', 'piste', 'oasis', 'palmier',
  'soleil', 'etoile', 'desert', 'guidon', 'phare', 'selle', 'virage', 'cactus',
  'menthe', 'figue', 'datte', 'cedre', 'argile', 'safran', 'ambre', 'cuivre',
  'granit', 'lagune', 'falaise', 'colline', 'rocher', 'ruisseau', 'bivouac', 'tente',
  'boussole', 'carnet', 'lampe', 'gourde', 'corde', 'sifflet', 'fanion', 'drapeau',
  'tambour', 'luth', 'flute', 'plume', 'encre', 'papier', 'timbre', 'cachet',
]
function pick(list) { return list[crypto.randomInt(list.length)] }
function simplePassword() {
  let a = pick(WORDS), b = pick(WORDS)
  while (b === a) b = pick(WORDS)
  return `${a}-${b}-${String(crypto.randomInt(1000, 10000))}`
}
main().catch(e => { console.error(e.message); process.exitCode = 1 })
