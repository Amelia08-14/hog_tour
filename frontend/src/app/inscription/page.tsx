'use client'
// src/app/inscription/page.tsx
import { useEffect, useMemo, useState, type ChangeEventHandler, type ReactNode, type FormEvent } from 'react'
import { getCountries, getCountryCallingCode } from 'libphonenumber-js'

export default function InscriptionPage() {
  const [sent,        setSent]        = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [sexe,        setSexe]        = useState('')
  const [nationalite, setNationalite] = useState('')
  const [nationaliteAutre, setNationaliteAutre] = useState('')
  const [residenceZone, setResidenceZone] = useState('')
  const [profil,      setProfil]      = useState('')
  const [profilGroupe, setProfilGroupe] = useState('')
  const [hebergement, setHebergement] = useState('')
  const [taille,      setTaille]      = useState('')
  const [paiement,    setPaiement]    = useState('')
  const [pays, setPays] = useState('')
  const [phoneCountry, setPhoneCountry] = useState('DZ')
  const [badgeQrUrl, setBadgeQrUrl] = useState<string | null>(null)
  const [mailSent, setMailSent] = useState<boolean | null>(null)
  const [payUrl, setPayUrl] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (residenceZone === 'Algérie') {
      setPaiement('on_site')
      return
    }
    if (residenceZone === 'Ailleurs') {
      setPaiement('online_yassir')
      return
    }
    setPaiement('')
  }, [residenceZone])

  const countryOptions = useMemo(() => {
    if (!mounted) return []
    const dn = new Intl.DisplayNames(['fr'], { type: 'region' })
    const isoToFlag = (iso2: string) =>
      iso2
        .toUpperCase()
        .split('')
        .map(c => String.fromCodePoint(127397 + c.charCodeAt(0)))
        .join('')

    return getCountries()
      .map(iso2 => {
        const name = dn.of(iso2) ?? iso2
        const dial = `+${getCountryCallingCode(iso2)}`
        return { iso2, name, dial, flag: isoToFlag(iso2) }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [mounted])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const missingState: string[] = []
    if (!sexe) missingState.push('Sexe')
    if (!nationalite) missingState.push('Nationalité')
    if (!residenceZone) missingState.push('Lieu de résidence')
    if (!profil) missingState.push('Vous êtes')
    if (!hebergement) missingState.push("Option d'hébergement")
    if (!taille) missingState.push('Taille T-shirt')
    if (!pays) missingState.push('Pays')

    if (missingState.length) {
      setError(`Veuillez compléter : ${missingState.join(', ')}.`)
      return
    }

    if (nationalite === 'Autre' && !nationaliteAutre.trim()) {
      setError('Veuillez précisez svp votre nationalité.')
      return
    }

    if (profil === "Membre d'un groupe de Motards" && !profilGroupe.trim()) {
      setError('Veuillez précisez svp le nom de votre groupe.')
      return
    }

    const form = e.currentTarget as HTMLFormElement
    const fd = new FormData(form)

    const payload = {
      prenom: String(fd.get('prenom') || '').trim(),
      nom: String(fd.get('nom') || '').trim(),
      sexe,
      adresse: String(fd.get('adresse') || '').trim(),
      ville: String(fd.get('ville') || '').trim(),
      paysIso2: pays,
      phoneCountryIso2: phoneCountry,
      phoneNumber: String(fd.get('phoneNumber') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      nationalite,
      nationaliteAutre: nationalite === 'Autre' ? nationaliteAutre.trim() : '',
      residenceZone,
      profil,
      profilGroupe: profil === "Membre d'un groupe de Motards" ? profilGroupe.trim() : '',
      hebergement,
      tailleTshirt: taille,
      paiementMode: paiement || (residenceZone === 'Algérie' ? 'on_site' : residenceZone ? 'online_yassir' : ''),
      permisNum: String(fd.get('permis') || '').trim(),
      immatriculation: String(fd.get('immat') || '').trim(),
      passportNum: String(fd.get('passport') || '').trim(),
    }

    const requiredText = [
      ['prenom', payload.prenom],
      ['nom', payload.nom],
      ['adresse', payload.adresse],
      ['ville', payload.ville],
      ['phoneNumber', payload.phoneNumber],
      ['email', payload.email],
      ['permisNum', payload.permisNum],
      ['immatriculation', payload.immatriculation],
      ['passportNum', payload.passportNum],
    ] as const

    const missingText = requiredText.filter(([, v]) => !v).map(([k]) => k)
    if (missingText.length) {
      setError('Veuillez remplir tous les champs obligatoires.')
      return
    }

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
    const base = apiBase || (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : '')
    const url = base ? `${base.replace(/\/$/, '')}/v1/registrations` : '/v1/registrations'

    try {
      setLoading(true)
      const out = new FormData()
      out.set('prenom', payload.prenom)
      out.set('nom', payload.nom)
      out.set('sexe', payload.sexe)
      out.set('adresse', payload.adresse)
      out.set('ville', payload.ville)
      out.set('paysIso2', payload.paysIso2)
      out.set('phoneCountryIso2', payload.phoneCountryIso2)
      out.set('phoneNumber', payload.phoneNumber)
      out.set('email', payload.email)
      out.set('nationalite', payload.nationalite)
      if (payload.nationaliteAutre) out.set('nationaliteAutre', payload.nationaliteAutre)
      out.set('residenceZone', payload.residenceZone)
      out.set('profil', payload.profil)
      if (payload.profilGroupe) out.set('profilGroupe', payload.profilGroupe)
      out.set('hebergement', payload.hebergement)
      out.set('tailleTshirt', payload.tailleTshirt)
      out.set('paiementMode', payload.paiementMode)
      out.set('permisNum', payload.permisNum)
      out.set('immatriculation', payload.immatriculation)
      out.set('passportNum', payload.passportNum)

      for (const v of fd.getAll('files')) {
        if (typeof File !== 'undefined' && v instanceof File && v.size > 0) {
          out.append('files', v, v.name)
        }
      }

      const res = await fetch(url, { method: 'POST', body: out })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError("Une erreur est survenue. Merci de réessayer.")
        return
      }

      const ms = (data?.mail?.sent ?? null) as boolean | null
      setMailSent(typeof ms === 'boolean' ? ms : null)
      const rawBadgeUrl = (data?.badge?.url ?? data?.badge?.qrUrl ?? null) as string | null
      const normalizedBadgeUrl = rawBadgeUrl
        ? rawBadgeUrl.replace(/\/v1\/qr(\?|$)/, '/v1/badge$1')
        : null
      setBadgeQrUrl(normalizedBadgeUrl)

      const payMode = String(data?.payment?.mode ?? '')
      const payStatus = String(data?.payment?.status ?? '')
      if (normalizedBadgeUrl && payMode === 'online_yassir' && payStatus !== 'paid') {
        try {
          const u = new URL(normalizedBadgeUrl)
          const token = u.searchParams.get('token') || ''
          const sig = u.searchParams.get('sig') || ''
          if (token && sig) setPayUrl(`/paiement?token=${encodeURIComponent(token)}&sig=${encodeURIComponent(sig)}`)
        } catch {}
      } else {
        setPayUrl(null)
      }

      setSent(true)
    } catch {
      setError("Impossible de contacter le serveur. Merci de réessayer.")
    } finally {
      setLoading(false)
    }
  }

  if (sent) return (
    <div className="min-h-screen flex items-center justify-center p-10 bg-bg">
      <div className="max-w-[480px] w-full bg-bg3 border border-orange/10 p-16 text-center flex flex-col items-center">
        <div className="w-[60px] h-[60px] bg-orange flex items-center justify-center mb-6">
          <svg width="28" height="28" fill="none" stroke="#000" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 className="font-display text-[32px] tracking-[0.2em] text-orange mb-3">Inscription envoyée !</h2>
        <p className="text-muted text-[14px] leading-relaxed mb-8">Nous avons bien reçu votre demande et vous contacterons dans les plus brefs délais.</p>
        {mailSent === true && (
          <p className="text-muted2 text-[12px] leading-relaxed mb-6">Un email de confirmation vient de vous être envoyé.</p>
        )}
        {mailSent === false && (
          <p className="text-muted2 text-[12px] leading-relaxed mb-6">
            L'email de confirmation n'a pas pu être envoyé. Merci de conserver le lien du badge ci-dessous.
          </p>
        )}
        {badgeQrUrl && (
          <p className="text-muted2 text-[12px] leading-relaxed mb-8 break-all">
            Badge : <a className="text-orange underline" href={badgeQrUrl}>{badgeQrUrl}</a>
          </p>
        )}
        {payUrl && (
          <a
            href={payUrl}
            className="mb-3 bg-bg3 border border-orange/20 text-htext font-condensed font-bold text-[12px] tracking-[0.2em] uppercase px-8 py-3 hover:border-orange/40 transition-colors"
          >
            Payer en ligne (carte)
          </a>
        )}
        <a href="/" className="bg-orange text-black font-condensed font-bold text-[13px] tracking-[0.2em] uppercase px-9 py-3.5 hover:bg-white transition-colors">
          Retour à l'accueil
        </a>
      </div>
    </div>
  )

  return (
    <>
      {/* Page header */}
      <div className="relative pt-[140px] pb-20 bg-bg2 border-b border-orange/10 overflow-hidden">
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage:'linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)', backgroundSize:'80px 80px', maskImage:'radial-gradient(ellipse 80% 80% at 50% 50%,black 30%,transparent 70%)' }}/>
        <div className="max-w-container mx-auto px-6 md:px-10 relative z-10">
          <div className="section-tag">Inscription</div>
          <h1 className="font-display leading-[.88] tracking-wide mt-3" style={{ fontSize:'clamp(44px,6vw,80px)' }}>
            Inscription<br /><span className="text-orange">H.O.G Tour 2026</span>
          </h1>
          <p className="text-muted text-[13px] tracking-[0.22em] uppercase mt-4">29 Octobre — 1er Novembre 2026 · Alger → Ghardaïa</p>
        </div>
      </div>

      <section className="py-20 bg-bg">
        <div className="max-w-[1040px] mx-auto px-6 md:px-10">

          {/* Cadre principal */}
          <div className="relative bg-bg3 border border-orange/12">
            {/* Ligne orange top */}
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background:'linear-gradient(to right,#FF6B00,rgba(255,107,0,.2))' }}/>
            {/* Coins */}
            <div className="absolute top-[10px] left-[10px] w-5 h-5 border-t border-l border-orange"/>
            <div className="absolute top-[10px] right-[10px] w-5 h-5 border-t border-r border-orange"/>
            <div className="absolute bottom-[10px] left-[10px] w-5 h-5 border-b border-l border-orange"/>
            <div className="absolute bottom-[10px] right-[10px] w-5 h-5 border-b border-r border-orange"/>

            {/* Header cadre */}
            <div className="flex items-center justify-between flex-wrap gap-3 px-8 md:px-10 py-6 border-b border-orange/10">
              <p className="font-display text-orange text-[22px] tracking-[0.3em]">HOG TOUR 2026 ®</p>
              <p className="text-muted text-[11px] tracking-[0.18em] uppercase">29 Oct — 1er Nov · Algiers Chapter · #8062</p>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleSubmit} className="px-8 md:px-10 py-10 flex flex-col gap-6">

              {/* Prénom / Nom */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <F id="prenom" label="Prénom *"  type="text"  ph="Entrez votre prénom" />
                <F id="nom"    label="Nom *"      type="text"  ph="Entrez votre nom"    />
              </div>

              {/* Sexe */}
              <G label="Sexe *">
                <div className="flex gap-5 flex-wrap">
                  <CB v="Femme" state={sexe} set={setSexe} />
                  <CB v="Homme" state={sexe} set={setSexe} />
                </div>
              </G>

              {/* Adresse / Ville / Pays */}
              <F id="adresse" label="Adresse *" type="text" ph="" />
              <F id="ville"   label="Ville *"   type="text" ph="" />
              <G label="Pays *">
                <select
                  value={pays}
                  onChange={e => {
                    const v = e.target.value
                    setPays(v)
                    if (v) setPhoneCountry(v)
                  }}
                  required
                  className="w-full bg-bg2 border border-white/8 rounded-none px-4 py-3.5 text-htext text-[14px] outline-none focus:border-orange/50 transition-colors cursor-pointer appearance-none"
                >
                  <option value="">Sélectionnez un pays</option>
                  {countryOptions.map(c => (
                    <option key={c.iso2} value={c.iso2}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </G>

              {/* Téléphone / Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <G label="Téléphone *">
                  <div className="grid grid-cols-[170px_minmax(0,1fr)] border border-white/8 bg-bg2 focus-within:border-orange/50 transition-colors">
                    <div className="relative border-r border-white/8 min-w-0">
                      <select
                        value={phoneCountry}
                        onChange={e => setPhoneCountry(e.target.value)}
                        className="w-full bg-transparent border-none outline-none text-htext text-[13px] cursor-pointer appearance-none px-3 py-3.5 pr-9 overflow-hidden text-ellipsis whitespace-nowrap"
                        required
                      >
                        {countryOptions.map(c => (
                          <option key={c.iso2} value={c.iso2}>
                            {c.flag} {c.dial} · {c.name}
                          </option>
                        ))}
                      </select>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                    <input
                      name="phoneNumber"
                      type="tel"
                      required
                      placeholder="Entrez votre numéro de téléphone"
                      className="min-w-0 bg-transparent border-none px-3 py-3.5 text-htext text-[14px] outline-none placeholder:text-muted2"
                    />
                  </div>
                </G>
                <F id="email" label="Email *" type="email" ph="Entrez votre email" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                <div>
                  <G label="Nationalité *">
                    <div className="flex gap-5 flex-wrap">
                      <CB v="Algérienne" state={nationalite} set={setNationalite} />
                      <CB v="Autre"      state={nationalite} set={setNationalite} />
                    </div>
                  </G>
                  {nationalite === 'Autre' && (
                    <div className="mt-4">
                      <F
                        id="nationalite-autre"
                        label="Veuillez précisez svp"
                        type="text"
                        ph="Votre nationalité"
                        value={nationaliteAutre}
                        onChange={e => setNationaliteAutre(e.target.value)}
                      />
                    </div>
                  )}
                </div>
                <G label="Vous vivez en Algérie ou ailleurs ? *">
                  <div className="flex gap-5 flex-wrap">
                    <CB v="Algérie"  state={residenceZone} set={setResidenceZone} />
                    <CB v="Ailleurs" state={residenceZone} set={setResidenceZone} />
                  </div>
                </G>
              </div>

              {/* Permis + upload */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <F id="permis" label="Numéro de Permis de Conduire *" type="text" ph="Entrez votre Numéro de Permis svp" />
                <UF id="up-permis" label="Télécharger une image de votre permis svp" />
              </div>

              {/* Passeport */}
              <F id="passport" label="Numéro de Passeport *" type="text" ph="Entrez votre numéro de passeport" />

              {/* Immatriculation + carte grise */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <F id="immat" label="Immatriculation *" type="text" ph="Entrez votre numéro d'immatriculation SVP" />
                <UF id="up-carte" label="Inclure en pièce jointe carte grise moto" />
              </div>

              {/* Vous êtes ? */}
              <G label="Vous êtes ? *">
                <div className="flex gap-5 flex-wrap">
                  <CB v="Solo"                         state={profil} set={setProfil} />
                  <CB v="Membre d'un groupe de Motards" state={profil} set={setProfil} />
                </div>
              </G>
              {profil === "Membre d'un groupe de Motards" && (
                <F
                  id="profil-groupe"
                  label="Veuillez précisez svp"
                  type="text"
                  ph="Nom du groupe / club"
                  value={profilGroupe}
                  onChange={e => setProfilGroupe(e.target.value)}
                />
              )}

              {/* Option hébergement */}
              <G label="Option d'hébergement *">
                <div className="flex gap-5 flex-wrap">
                  <CB v="Chambre simple (480 €)"          state={hebergement} set={setHebergement} />
                  <CB v="Chambre double 400€/ motard"      state={hebergement} set={setHebergement} />
                  <CB v="Chambre double pour couple 780€"  state={hebergement} set={setHebergement} />
                </div>
              </G>

              {/* Taille T-shirt */}
              <G label="Taille T-shirt *">
                <div className="flex gap-5 flex-wrap">
                  {['S','M','L','XL','XXL'].map(t => <CB key={t} v={t} state={taille} set={setTaille} />)}
                </div>
              </G>

              {/* Modalités paiement */}
              <G label="Modalités de paiement *">
                <div className="border border-white/8 bg-bg2 px-5 py-4 text-[13px] text-htext leading-relaxed">
                  {residenceZone === 'Algérie'
                    ? 'Résidence en Algérie : paiement sur place.'
                    : residenceZone === 'Ailleurs'
                      ? 'Résidence à l’étranger : paiement en ligne (Yassir).'
                      : 'Choisissez votre lieu de résidence pour voir les modalités de paiement.'}
                </div>
              </G>

              {error && (
                <div className="border border-orange/20 bg-bg2 px-5 py-4 text-[13px] text-htext leading-relaxed">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="mt-2 bg-orange text-black font-condensed font-extrabold text-[14px] tracking-[0.3em] uppercase py-5 hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5 hover:disabled:translate-y-0 transition-all duration-200">
                {loading ? 'Envoi en cours…' : 'SUBMIT'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  )
}

/* ── Helpers ── */
function F({
  id,
  label,
  type,
  ph,
  required = true,
  value,
  onChange,
}: {
  id: string
  label: string
  type: string
  ph: string
  required?: boolean
  value?: string
  onChange?: ChangeEventHandler<HTMLInputElement>
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-htext text-[14px]">{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        placeholder={ph}
        required={required}
        value={value}
        onChange={onChange}
        className="bg-bg2 border border-white/8 px-4 py-3.5 text-htext text-[14px] outline-none placeholder:text-muted2 focus:border-orange/50 transition-colors w-full"/>
    </div>
  )
}
function G({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-htext text-[14px]">{label}</p>
      {children}
    </div>
  )
}
function CB({ v, state, set }: { v: string; state: string; set: (s: string) => void }) {
  const checked = state === v
  return (
    <label className="flex items-center gap-2 cursor-pointer text-htext text-[14px] select-none">
      <div onClick={() => set(v)}
        className={`w-4 h-4 min-w-[16px] rounded-[3px] border flex items-center justify-center transition-all duration-150 cursor-pointer
          ${checked ? 'bg-orange border-orange' : 'bg-white/[.04] border-white/25 hover:border-orange/40'}`}>
        {checked && <svg width="10" height="10" fill="none" stroke="#000" strokeWidth="2.5" viewBox="0 0 12 12"><polyline points="2 6 5 9 10 3"/></svg>}
      </div>
      <input type="checkbox" checked={checked} onChange={() => set(v)} className="hidden"/>
      {v}
    </label>
  )
}
function UF({ id, label }: { id: string; label: string }) {
  const [name, setName] = useState('No file chosen')
  return (
    <div className="flex flex-col gap-2">
      <p className="text-htext text-[14px]">{label}</p>
      <div className="flex items-center gap-3 flex-wrap">
        <label htmlFor={id}
          className="bg-orange text-black font-condensed font-extrabold text-[11px] tracking-[0.18em] uppercase px-5 py-3 cursor-pointer hover:bg-white transition-colors whitespace-nowrap">
          Choisir un fichier
        </label>
        <span className="text-muted text-[13px]">{name}</span>
      </div>
      <input id={id} name="files" type="file" accept=".jpg,.jpeg,.png,.pdf,.webp" className="hidden"
        onChange={e => setName(e.target.files?.[0]?.name ?? 'No file chosen')}/>
    </div>
  )
}
