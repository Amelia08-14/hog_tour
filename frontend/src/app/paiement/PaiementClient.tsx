'use client'
import { useMemo, useState, useEffect, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'

type Info = {
  prenom: string
  nom: string
  hebergement: string
  residenceZone: string
  amountCents: number | null
  currency: string
  paymentStatus: string
  paymentMethod: string
}

type PaymentMethod = { code: string; name: string; id: string }
type Step = 'accommodation' | 'payment'

// localOK = Algérie/Lybie/Tunisie (DZD) · abroadOK = Ailleurs (EUR) · esptOK = Espagne/Portugal (EUR)
const ACCOMMODATIONS = [
  { value: 'Chambre simple',          labelDzd: '75 000 DA',          labelEur: '960 €',  labelEspt: '920 €',  desc: 'Pension complète — 1 personne, chambre individuelle', localOK: true,  abroadOK: true,  esptOK: true },
  { value: 'Chambre double — Motard', labelDzd: '65 000 DA / motard', labelEur: '880 € / motard', labelEspt: '880 € / motard', desc: 'Pension complète — 2 motards, chambre partagée', localOK: true,  abroadOK: true,  esptOK: false },
  { value: 'Chambre double couple',   labelDzd: '125 000 DA',         labelEur: '1 740 €', labelEspt: '1 640 €', desc: 'Pension complète — couple, 1 moto',  localOK: true,  abroadOK: true,  esptOK: true },
  { value: 'Chambre double couple — 2 motos', labelDzd: '125 000 DA', labelEur: '1 760 €', labelEspt: '1 660 €', desc: 'Pension complète — couple, 2 motos / 2 bikers', localOK: false, abroadOK: true,  esptOK: true },
]

const isCouple = (v: string) => /couple/i.test(v || '')
const isTwoMotos = (v: string) => /2\s*motos/i.test(v || '')
const isDoubleMotard = (v: string) => /motard/i.test(v || '')
// Affiche le formulaire 2e personne (partenaire ou co-motard)
const needsSecondPerson = (v: string) => isCouple(v) || isDoubleMotard(v)
// Nécessite les infos moto complètes (permis + carte grise + immatriculation)
const needsFullMoto = (v: string) => isTwoMotos(v) || isDoubleMotard(v)

const EUR_INCLUDES_NOTE = 'Traversée bateau en demi pension, moto incluse et carburant pris en charge durant tout l’événement.'

function formatAmount(cents: number, currency: string) {
  if (currency === 'DZD')
    return new Intl.NumberFormat('fr-DZ', { style: 'currency', currency: 'DZD', maximumFractionDigits: 0 }).format(cents / 100)
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR' }).format(cents / 100)
}

function isYassirCash(code: string) {
  const c = (code || '').toLowerCase()
  return c === 'wallet_v2' || c.includes('cash') || c === 'yassir'
}

function methodDisplay(code: string, name: string): { label: string; sub: string } {
  const c = (code || '').toLowerCase()
  if (c.includes('stripe'))                                               return { label: 'Carte bancaire',  sub: 'Stripe' }
  if (isYassirCash(code))                                                  return { label: 'Yassir Cash',     sub: '' }
  if (c.includes('cib') || c.includes('dahabia') || c.includes('satim')) return { label: 'CIB / Dahabia',   sub: 'via SATIM' }
  if (c.includes('wallet'))                                               return { label: 'Paiement mobile', sub: 'Yassir Wallet' }
  return { label: name || code, sub: '' }
}

export default function PaiementClient() {
  const sp = useSearchParams()
  const token    = sp.get('token')    || ''
  const paymentId = sp.get('paymentId') || ''
  const sig      = sp.get('sig')      || ''
  const isTestMode = sp.get('test') === '1'

  const [info, setInfo]       = useState<Info | null>(null)
  const [infoError, setInfoError] = useState<string | null>(null)
  const [step, setStep]       = useState<Step>('accommodation')
  const [selectedAccommodation, setSelectedAccommodation] = useState('')
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [onSiteDone, setOnSiteDone] = useState(false)

  // Partenaire (chambre couple, étrangers)
  const [pPrenom, setPPrenom] = useState('')
  const [pNom, setPNom] = useState('')
  const [pSexe, setPSexe] = useState('')
  const [pEmail, setPEmail] = useState('')
  const [pPhone, setPPhone] = useState('')
  const [pNationalite, setPNationalite] = useState('')
  const [pPassport, setPPassport] = useState('')
  const [pImmat, setPImmat] = useState('')
  const [pTshirt, setPTshirt] = useState('')
  const [pPermisNum, setPPermisNum] = useState('')
  const [pPassportFile, setPPassportFile] = useState<File | null>(null)
  const [pPermisFile, setPPermisFile] = useState<File | null>(null)
  const [pCarteFile, setPCarteFile] = useState<File | null>(null)

  const apiBase = useMemo(() => {
    const v = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
    const base = v || (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : '')
    return base ? base.replace(/\/$/, '') : ''
  }, [])

  function apiUrl(path: string) { return apiBase ? `${apiBase}${path}` : path }

  const qs = useMemo(() => {
    if (token)     return `token=${encodeURIComponent(token)}&sig=${encodeURIComponent(sig)}`
    if (paymentId) return `paymentId=${encodeURIComponent(paymentId)}&sig=${encodeURIComponent(sig)}`
    return ''
  }, [token, paymentId, sig])

  useEffect(() => {
    if (!qs) return
    fetch(apiUrl(`/v1/payments/info?${qs}`))
      .then(r => r.json())
      .then(data => {
        if (data.error) { setInfoError('Lien invalide ou expiré.'); return }
        const d = data as Info
        setInfo(d)
        if (d.hebergement && d.amountCents != null) {
          setSelectedAccommodation(d.hebergement)
          setStep('payment')
          fetchMethods()
        }
      })
      .catch(() => setInfoError('Impossible de charger les informations.'))
  }, [qs])

  async function fetchMethods() {
    if (!paymentId || !sig) { setMethods([]); return }
    try {
      const res = await fetch(apiUrl(`/v1/payments/methods?paymentId=${encodeURIComponent(paymentId)}&sig=${encodeURIComponent(sig)}`))
      const data = await res.json().catch(() => ({}))
      if (Array.isArray(data.methods)) setMethods(data.methods as PaymentMethod[])
      else setMethods([])
    } catch { setMethods([]) }
  }

  const zone = (info?.residenceZone || '').toLowerCase()
  const isLocal = zone === 'algérie' || zone === 'algerie' || zone === 'tunisie' || zone === 'lybie' || zone === 'libye'
  const isEspPt = zone.includes('espagne') || zone.includes('portugal')
  const isAilleurs = zone === 'ailleurs'
  const isAbroad = isAilleurs || isEspPt   // paie en EUR + formulaire partenaire

  // Devise/label de prix selon la zone
  function priceLabelFor(o: typeof ACCOMMODATIONS[number]) {
    if (isEspPt) return o.labelEspt
    if (isLocal) return o.labelDzd
    return o.labelEur
  }

  const accommodationOptions = useMemo(() => {
    const base = ACCOMMODATIONS.filter(o =>
      isEspPt ? o.esptOK : isLocal ? o.localOK : o.abroadOK,
    )
    if (isTestMode) base.push({ value: 'Pack test', labelDzd: '500 DA', labelEur: '1 €', labelEspt: '1 €', desc: 'Test', localOK: true, abroadOK: true, esptOK: true })
    return base
  }, [isTestMode, isLocal, isEspPt, isAilleurs])

  const partnerRequired = isAbroad && needsSecondPerson(selectedAccommodation)

  async function handleConfirmAccommodation(e: FormEvent) {
    e.preventDefault()
    if (!selectedAccommodation) { setError('Choisissez un hébergement.'); return }
    if (!paymentId || !sig)     { setError('Lien de paiement invalide.'); return }

    // Validation 2e personne (partenaire couple ou co-motard, étranger)
    const twoMotos = needsFullMoto(selectedAccommodation)
    if (partnerRequired) {
      if (!pPrenom.trim() || !pNom.trim()) { setError('Veuillez renseigner le prénom et le nom de votre partenaire.'); return }
      if (!pPassport.trim() || !/^[A-Za-z0-9]+$/.test(pPassport.trim())) { setError('Numéro de passeport du partenaire invalide (lettres et chiffres uniquement).'); return }
      if (!pPassportFile) { setError('Veuillez joindre la photo du passeport de votre partenaire.'); return }
      if (pEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pEmail.trim())) { setError('Email du partenaire invalide.'); return }
      if (!pTshirt) { setError('Veuillez choisir la taille de T-shirt du partenaire.'); return }
      if (twoMotos) {
        if (!pPermisNum.trim() || !/^[A-Za-z0-9]+$/.test(pPermisNum.trim())) { setError('Numéro de permis du partenaire invalide (lettres et chiffres uniquement).'); return }
        if (!pImmat.trim()) { setError('Veuillez renseigner l\'immatriculation de la moto du partenaire.'); return }
        if (!pPermisFile) { setError('Veuillez joindre la photo du permis du partenaire.'); return }
        if (!pCarteFile) { setError('Veuillez joindre la photo de la carte grise du partenaire.'); return }
      }
    }

    setError(null)
    setLoading(true)
    try {
      const fd = new FormData()
      fd.set('paymentId', paymentId)
      fd.set('sig', sig)
      fd.set('hebergement', selectedAccommodation)
      if (partnerRequired) {
        // Ordre des fichiers communiqué au backend pour le bon étiquetage
        const fileTypes: string[] = ['passport']
        if (twoMotos) { fileTypes.push('permis', 'carte') }
        fd.set('partner', JSON.stringify({
          prenom: pPrenom.trim(), nom: pNom.trim(), sexe: pSexe,
          email: pEmail.trim(), phone: pPhone.trim(), nationalite: pNationalite.trim(),
          passportNum: pPassport.trim(),
          tailleTshirt: pTshirt,
          permisNum: twoMotos ? pPermisNum.trim() : '',
          immatriculation: twoMotos ? pImmat.trim() : '',
          fileTypes,
        }))
        // Append dans le même ordre que fileTypes
        if (pPassportFile) fd.append('files', pPassportFile, pPassportFile.name)
        if (twoMotos && pPermisFile) fd.append('files', pPermisFile, pPermisFile.name)
        if (twoMotos && pCarteFile) fd.append('files', pCarteFile, pCarteFile.name)
      }
      const res = await fetch(apiUrl('/v1/payments/choose-accommodation'), { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(partnerErrorMessage(String(data?.error || ''), String(data?.message || ''))); return }
      setInfo(prev => prev ? { ...prev, hebergement: data.hebergement, amountCents: data.amountCents, currency: data.currency } : prev)
      setStep('payment')
      fetchMethods()
    } catch { setError('Impossible de contacter le serveur.') }
    finally { setLoading(false) }
  }

  function partnerErrorMessage(err: string, msg: string): string {
    switch (err) {
      case 'partner_incomplete': return 'Informations du partenaire incomplètes (prénom, nom, passeport requis).'
      case 'partner_passport_invalid': return 'Numéro de passeport du partenaire invalide.'
      case 'partner_passport_photo_missing': return 'La photo du passeport du partenaire est obligatoire.'
      case 'partner_tshirt_missing': return 'Veuillez choisir la taille de T-shirt du partenaire.'
      case 'partner_permis_invalid': return 'Numéro de permis du partenaire invalide.'
      case 'partner_plate_missing': return 'L\'immatriculation de la moto du partenaire est requise.'
      case 'partner_docs_missing': return 'Merci de joindre les 3 photos du partenaire : passeport, permis et carte grise.'
      case 'partner_upload_failed': return 'Échec de l\'envoi des photos du partenaire. Réessayez.'
      default: return msg || err || 'Erreur.'
    }
  }

  async function handlePayOnline(methodCode: string) {
    setError(null)
    if ((!token && !paymentId) || !sig) { setError('Lien de paiement invalide.'); return }
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/v1/payments/yassir/start'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: token || undefined, paymentId: paymentId || undefined, sig, paymentMethodCode: methodCode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(String(data?.message || data?.error || 'Paiement impossible.')); return }
      const redirectUrl = String(data?.redirectUrl || data?.paymentUrl || data?.url || '').trim()
      if (redirectUrl) window.location.href = redirectUrl
      else setError('Aucune URL de redirection reçue.')
    } catch { setError('Impossible de contacter le serveur.') }
    finally { setLoading(false) }
  }

  // Paiement sur place (Tunisie / Lybie)
  async function handlePayOnSite() {
    setError(null)
    if (!paymentId || !sig) { setError('Lien de paiement invalide.'); return }
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/v1/payments/choose-onsite'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paymentId, sig }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(String(data?.message || data?.error || 'Erreur.')); return }
      setOnSiteDone(true)
    } catch { setError('Impossible de contacter le serveur.') }
    finally { setLoading(false) }
  }

  if (onSiteDone) return (
    <section className="min-h-screen pt-[80px] pb-20 bg-bg flex items-center justify-center">
      <div className="max-w-[520px] w-full mx-auto px-6">
        <div className="border border-orange/12 bg-bg3 p-10 text-center">
          <div className="text-4xl mb-5" style={{ color: '#FF6B00' }}>✓</div>
          <h1 className="font-display text-htext uppercase tracking-wide mb-3" style={{ fontSize: 'clamp(20px,4vw,28px)' }}>
            Inscription confirmée
          </h1>
          <div style={{ height: 1, background: 'linear-gradient(to right,transparent,rgba(255,107,0,.3),transparent)', margin: '16px 0' }} />
          <p className="text-muted text-[14px] leading-relaxed">
            Vous réglez votre inscription <strong className="text-htext">sur place lors de l&apos;événement</strong>.<br />
            Un email de confirmation avec votre badge vous a été envoyé.
          </p>
          <a href="/" className="inline-block mt-8 text-[11px] font-condensed font-bold uppercase tracking-[3px] text-orange/70 hover:text-orange transition-colors">
            Retour à l&apos;accueil →
          </a>
        </div>
      </div>
    </section>
  )

  return (
    <section className="min-h-screen pt-[80px] pb-20 bg-bg">
      <div className="max-w-container mx-auto px-6 md:px-10 w-full">
        <div className="section-tag">Paiement</div>
        <h1 className="font-display leading-[.88] tracking-wide mt-3" style={{ fontSize: 'clamp(34px,4vw,56px)' }}>
          {step === 'accommodation' ? 'Choix de l’hébergement' : 'Finaliser mon inscription'}
        </h1>

        {infoError && (
          <div className="mt-6 max-w-[560px] border border-orange/20 bg-bg3 px-5 py-4 text-[13px] text-orange">{infoError}</div>
        )}
        {error && (
          <div className="mt-4 max-w-[560px] border border-orange/20 bg-bg3 px-5 py-4 text-[13px] text-orange">{error}</div>
        )}

        {/* Step 1 — hébergement */}
        {step === 'accommodation' && (
          <form onSubmit={handleConfirmAccommodation} className="mt-8 max-w-[600px]">
            {info && (
              <p className="text-muted text-[13px] mb-6">
                Bonjour <span className="text-htext font-semibold">{info.prenom} {info.nom}</span> — choisissez votre hébergement pour voir le montant à régler.
              </p>
            )}
            <div className="flex flex-col gap-3">
              {accommodationOptions.map(opt => {
                const priceLabel = priceLabelFor(opt)
                const selected = selectedAccommodation === opt.value
                return (
                  <label
                    key={opt.value}
                    onClick={() => setSelectedAccommodation(opt.value)}
                    className={`flex items-center justify-between gap-4 border px-5 py-4 cursor-pointer transition-all ${selected ? 'border-orange bg-bg3' : 'border-orange/12 bg-bg3 hover:border-orange/30'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-4 h-4 min-w-[16px] rounded-[3px] border flex items-center justify-center transition-all ${selected ? 'bg-orange border-orange' : 'bg-white/[.04] border-white/25'}`}>
                        {selected && <svg width="10" height="10" fill="none" stroke="#000" strokeWidth="2.5" viewBox="0 0 12 12"><polyline points="2 6 5 9 10 3" /></svg>}
                      </div>
                      <div>
                        <div className="text-htext text-[14px] font-semibold">{opt.value}</div>
                        <div className="text-muted text-[11px] mt-0.5">{opt.desc}</div>
                      </div>
                    </div>
                    <div className="text-orange font-bold text-[15px] tracking-wide whitespace-nowrap shrink-0">{priceLabel}</div>
                  </label>
                )
              })}
            </div>
            <div className="mt-4 border border-orange/10 bg-bg3 px-4 py-3 flex gap-2">
              <span className="text-orange/60 text-[11px] mt-[1px]">★</span>
              <p className="text-muted text-[11px] leading-relaxed">
                {isAbroad ? EUR_INCLUDES_NOTE : 'Carburant pris en charge tout au long de l’événement.'}
              </p>
            </div>

            {/* Formulaire 2e personne — couple ou co-motard (étrangers) */}
            {partnerRequired && (
              <div className="mt-6 border border-orange/20 bg-bg3 p-6">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-5 h-px bg-orange/40" />
                  <span className="text-[9px] uppercase tracking-[3px] text-orange/60">
                    {isDoubleMotard(selectedAccommodation) ? 'Informations du 2ᵉ motard' : 'Informations du partenaire'}
                  </span>
                </div>
                <p className="text-muted text-[11px] mb-5 leading-relaxed">
                  {isDoubleMotard(selectedAccommodation)
                    ? 'Cette chambre est partagée par 2 motards. Renseignez les informations du 2ᵉ motard (avec sa moto).'
                    : isTwoMotos(selectedAccommodation)
                      ? 'Votre partenaire voyage avec sa propre moto. Renseignez ses informations ci-dessous.'
                      : 'Votre partenaire vous accompagne. Renseignez ses informations ci-dessous.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <PF label="Prénom *" value={pPrenom} onChange={setPPrenom} />
                  <PF label="Nom *" value={pNom} onChange={setPNom} />
                </div>
                <div className="mt-4">
                  <p className="text-htext text-[13px] mb-2">Sexe</p>
                  <div className="flex gap-5">
                    {['Femme', 'Homme'].map(s => (
                      <label key={s} className="flex items-center gap-2 cursor-pointer text-htext text-[13px]" onClick={() => setPSexe(s)}>
                        <span className={`w-4 h-4 rounded-[3px] border flex items-center justify-center ${pSexe === s ? 'bg-orange border-orange' : 'bg-white/[.04] border-white/25'}`}>
                          {pSexe === s && <svg width="10" height="10" fill="none" stroke="#000" strokeWidth="2.5" viewBox="0 0 12 12"><polyline points="2 6 5 9 10 3" /></svg>}
                        </span>
                        {s}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <PF label="Email" type="email" value={pEmail} onChange={setPEmail} />
                  <PF label="Téléphone" value={pPhone} onChange={setPPhone} ph="+33 …" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <PF label="Nationalité" value={pNationalite} onChange={setPNationalite} />
                  <PF label="N° Passeport *" value={pPassport} onChange={v => setPPassport(v.replace(/[^A-Za-z0-9]/g, '').toUpperCase())} />
                </div>

                {/* Taille T-shirt partenaire — toujours */}
                <div className="mt-4">
                  <p className="text-htext text-[13px] mb-2">Taille T-shirt du partenaire *</p>
                  <div className="flex gap-4 flex-wrap">
                    {['S', 'M', 'L', 'XL', 'XXL'].map(sz => (
                      <label key={sz} className="flex items-center gap-2 cursor-pointer text-htext text-[13px]" onClick={() => setPTshirt(sz)}>
                        <span className={`w-4 h-4 rounded-[3px] border flex items-center justify-center ${pTshirt === sz ? 'bg-orange border-orange' : 'bg-white/[.04] border-white/25'}`}>
                          {pTshirt === sz && <svg width="10" height="10" fill="none" stroke="#000" strokeWidth="2.5" viewBox="0 0 12 12"><polyline points="2 6 5 9 10 3" /></svg>}
                        </span>
                        {sz}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Permis + immatriculation — 2 motos ou double motard */}
                {needsFullMoto(selectedAccommodation) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <PF label="N° Permis *" value={pPermisNum} onChange={v => setPPermisNum(v.replace(/[^A-Za-z0-9]/g, '').toUpperCase())} />
                    <PF label="Immatriculation moto *" value={pImmat} onChange={v => setPImmat(v.replace(/[^A-Za-z0-9]/g, '').toUpperCase())} />
                  </div>
                )}

                {/* Uploads */}
                <div className="mt-4">
                  <p className="text-htext text-[13px] mb-2">Photo du passeport du partenaire *</p>
                  <PartnerFile id="partner-passport" file={pPassportFile} onPick={setPPassportFile} />
                </div>
                {needsFullMoto(selectedAccommodation) && (
                  <>
                    <div className="mt-4">
                      <p className="text-htext text-[13px] mb-2">Photo du permis *</p>
                      <PartnerFile id="partner-permis" file={pPermisFile} onPick={setPPermisFile} />
                    </div>
                    <div className="mt-4">
                      <p className="text-htext text-[13px] mb-2">Photo de la carte grise *</p>
                      <PartnerFile id="partner-carte" file={pCarteFile} onPick={setPCarteFile} />
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !selectedAccommodation}
              className="mt-6 w-full bg-orange text-black font-condensed font-bold text-[13px] tracking-[0.2em] uppercase px-9 py-4 hover:bg-white transition-colors disabled:opacity-60"
            >
              {loading ? 'Traitement…' : 'Confirmer mon choix →'}
            </button>
          </form>
        )}

        {/* Step 2 — paiement */}
        {step === 'payment' && info && (
          <div className="mt-8 max-w-[560px]">
            {/* Recap */}
            <div className="border border-orange/12 bg-bg3 p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-5 h-px bg-orange/40" />
                <span className="text-[9px] uppercase tracking-[3px] text-orange/60">Récapitulatif</span>
                <div className="w-5 h-px bg-orange/40" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 border border-orange/8 bg-bg2 px-4 py-3">
                  <div className="text-[8px] uppercase tracking-[2px] text-muted mb-1">Participant</div>
                  <div className="text-[14px] font-semibold text-htext uppercase tracking-wide">{info.prenom} {info.nom}</div>
                </div>
                <div className="border border-orange/8 bg-bg2 px-4 py-3">
                  <div className="text-[8px] uppercase tracking-[2px] text-muted mb-1">Hébergement</div>
                  <div className="text-[13px] font-medium text-htext">{info.hebergement}</div>
                </div>
                <div className="border border-orange/8 bg-bg2 px-4 py-3">
                  <div className="text-[8px] uppercase tracking-[2px] text-muted mb-1">Montant</div>
                  <div className="text-[18px] font-bold text-orange tracking-wide">
                    {info.amountCents != null ? formatAmount(info.amountCents, info.currency) : '—'}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setStep('accommodation')} className="mt-4 text-[11px] text-muted hover:text-htext transition-colors">
                ← Modifier le choix d&apos;hébergement
              </button>
            </div>

            {/* Paiement sur place — pour tous */}
            <div className="border border-orange/12 bg-bg3 p-8">
              <p className="text-muted text-[12px] mb-4 leading-relaxed uppercase tracking-[2px]">Mode de paiement</p>
              <p className="text-muted text-[13px] leading-relaxed mb-5">
                Vous réglez votre inscription <strong className="text-htext">sur place lors de l&apos;événement</strong>.
                Confirmez ci-dessous pour valider votre inscription et recevoir votre badge par email.
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={handlePayOnSite}
                className="w-full bg-orange text-black font-condensed font-bold text-[13px] tracking-[0.2em] uppercase px-9 py-4 hover:bg-white transition-colors disabled:opacity-60"
              >
                {loading ? 'Traitement…' : 'Confirmer mon inscription — paiement sur place'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function PartnerFile({ id, file, onPick }: { id: string; file: File | null; onPick: (f: File | null) => void }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <label htmlFor={id} className="bg-orange text-black font-condensed font-extrabold text-[11px] px-5 py-3 cursor-pointer hover:bg-white transition-colors tracking-[0.18em] uppercase">
        Choisir un fichier
      </label>
      <span className="text-muted text-[13px]">{file?.name || 'Aucun fichier choisi'}</span>
      <input id={id} type="file" accept=".jpg,.jpeg,.png,.pdf,.webp" className="hidden"
        onChange={e => onPick(e.target.files?.[0] || null)} />
    </div>
  )
}

function PF({ label, value, onChange, type = 'text', ph = '' }: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  ph?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-htext text-[13px]">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={ph}
        onChange={e => onChange(e.target.value)}
        className="bg-bg2 border border-white/8 px-4 py-3 text-htext text-[14px] outline-none placeholder:text-muted2 focus:border-orange/50 transition-colors w-full"
      />
    </div>
  )
}
