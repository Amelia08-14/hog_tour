// Tarifs réservés aux membres du H.O.G Algérie (pension complète, en DZD).
// `roomCents` est le prix de la chambre ; `persons` le nombre de motards qui la
// partagent. Chaque inscrit règle sa part (`perPersonCents`), comme pour
// « Chambre double — Motard » dans la grille publique.
const HOG_PREFIX = 'HOG — '
const HOG_TARIFFS = [
  { value: `${HOG_PREFIX}Chambre single`, room: 'Chambre single', occupancy: 'Motard seul', persons: 1, roomCents: 5300000 },
  { value: `${HOG_PREFIX}Chambre double (couple)`, room: 'Chambre double', occupancy: 'Couple à moto', persons: 1, roomCents: 8500000 },
  { value: `${HOG_PREFIX}Chambre double (2 motards)`, room: 'Chambre double', occupancy: 'Deux motards', persons: 2, roomCents: 9000000 },
  { value: `${HOG_PREFIX}Suite (motard seul)`, room: 'Suite', occupancy: 'Motard seul', persons: 1, roomCents: 10780000 },
  { value: `${HOG_PREFIX}Suite (2 motards)`, room: 'Suite', occupancy: 'Deux motards', persons: 2, roomCents: 16200000 },
  { value: `${HOG_PREFIX}Suite (couple)`, room: 'Suite', occupancy: 'Couple à moto', persons: 1, roomCents: 15700000 },
].map(t => ({ ...t, perPersonCents: Math.round(t.roomCents / t.persons), currency: 'DZD' }))

const byValue = new Map(HOG_TARIFFS.map(t => [t.value, t]))
const isHogTariff = value => byValue.has(String(value || ''))
const hogTariff = value => byValue.get(String(value || '')) || null

module.exports = { HOG_TARIFFS, HOG_PREFIX, isHogTariff, hogTariff }
