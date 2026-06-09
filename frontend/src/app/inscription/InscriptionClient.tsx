'use client'
import { useEffect, useMemo, useState, type ChangeEventHandler, type ReactNode, type FormEvent, type FormEventHandler } from 'react'
import { useSearchParams } from 'next/navigation'
import { getCountries, getCountryCallingCode } from 'libphonenumber-js'
import type { Lang } from '@/i18n/shared'
import { t } from '@/i18n/messages'

const V = {
  sexe: { femme: 'Femme', homme: 'Homme' },
  nationalite: { dz: 'Algérienne', autre: 'Autre' },
  residence: { dz: 'Algérie', lby: 'Lybie', tun: 'Tunisie', ailleurs: 'Ailleurs' },
  profil: { solo: 'Solo', groupe: "Membre d'un groupe de Motards" },
} as const

export default function InscriptionClient({ lang }: { lang: Lang }) {
  const sp = useSearchParams()
  const isTestMode = sp.get('test') === '1'
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sexe, setSexe] = useState('')
  const [nationalite, setNationalite] = useState('')
  const [nationaliteAutre, setNationaliteAutre] = useState('')
  const [residenceZone, setResidenceZone] = useState('')
  const [harley, setHarley] = useState('')
  const [motoModele, setMotoModele] = useState('')
  const [profil, setProfil] = useState('')
  const [profilGroupe, setProfilGroupe] = useState('')
  const [taille, setTaille] = useState('')
  const [hasPermisFile, setHasPermisFile] = useState(false)
  const [hasCarteFile, setHasCarteFile] = useState(false)
  const [paiement, setPaiement] = useState('')
  const [pays, setPays] = useState('')
  const [phoneCountry, setPhoneCountry] = useState('DZ')
  const [badgeQrUrl, setBadgeQrUrl] = useState<string | null>(null)
  const [mailSent, setMailSent] = useState<boolean | null>(null)
  const [payUrl, setPayUrl] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const ON_SITE_ZONES = [V.residence.dz, V.residence.lby, V.residence.tun]

  // Bloqué si résident Algérie sans Harley-Davidson
  const blocked = residenceZone === V.residence.dz && harley === 'Non'

  useEffect(() => {
    // Réinitialiser la question Harley quand on quitte l'Algérie
    if (residenceZone !== V.residence.dz) {
      setHarley('')
      setMotoModele('')
    }
    if (ON_SITE_ZONES.includes(residenceZone as typeof V.residence.dz)) {
      setPaiement('on_site')
      return
    }
    if (residenceZone === V.residence.ailleurs) {
      setPaiement('online_yassir')
      return
    }
    setPaiement('')
  }, [residenceZone])

  const countryOptions = useMemo(() => {
    if (!mounted) return []
    const locale = lang === 'ar' ? 'ar' : lang === 'en' ? 'en' : 'fr'
    const dn = new Intl.DisplayNames([locale], { type: 'region' })
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
      .sort((a, b) => a.name.localeCompare(b.name, locale))
  }, [mounted, lang])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    // Bloqué : pas de Harley en Algérie
    if (blocked) return

    // Question Harley obligatoire pour l'Algérie
    if (residenceZone === V.residence.dz && !harley) {
      setError('Veuillez indiquer si vous possédez une Harley-Davidson.')
      return
    }

    const missingState: string[] = []
    if (!sexe) missingState.push(String(t(lang, 'registration.fields.sex')))
    if (!nationalite) missingState.push(String(t(lang, 'registration.fields.nationality')))
    if (!residenceZone) missingState.push(String(t(lang, 'registration.fields.residence')))
    if (!profil) missingState.push(String(t(lang, 'registration.fields.profile')))
    if (!taille) missingState.push(String(t(lang, 'registration.fields.tshirtSize')))
    if (!pays) missingState.push(String(t(lang, 'registration.fields.country')))

    if (missingState.length) {
      setError(`${t(lang, 'registration.errors.completePrefix')} ${missingState.join(', ')}.`)
      return
    }

    if (nationalite === V.nationalite.autre && !nationaliteAutre.trim()) {
      setError(String(t(lang, 'registration.errors.specifyNationality')))
      return
    }

    if (residenceZone === V.residence.dz && harley === 'Oui' && !motoModele.trim()) {
      setError('Veuillez indiquer le modèle de votre Harley-Davidson.')
      return
    }

    if (profil === V.profil.groupe && !profilGroupe.trim()) {
      setError(String(t(lang, 'registration.errors.specifyGroup')))
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
      nationaliteAutre: nationalite === V.nationalite.autre ? nationaliteAutre.trim() : '',
      residenceZone,
      harleyOwner: residenceZone === V.residence.dz ? harley : 'Oui',
      motoModele: residenceZone === V.residence.dz && harley === 'Oui' ? motoModele.trim() : '',
      profil,
      profilGroupe: profil === V.profil.groupe ? profilGroupe.trim() : '',
      tailleTshirt: taille,
      paiementMode: paiement || (ON_SITE_ZONES.includes(residenceZone as typeof V.residence.dz) ? 'on_site' : residenceZone ? 'online_yassir' : ''),
      permisNum: String(fd.get('permis') || '').trim(),
      immatriculation: String(fd.get('immat') || '').trim(),
      passportNum: String(fd.get('passport') || '').trim(),
      phoneE164: (() => {
        try {
          const cc = getCountryCallingCode(phoneCountry as any)
          const digits = String(fd.get('phoneNumber') || '').replace(/[^\d]/g, '')
          const national = digits.replace(/^0+/, '')
          if (!cc || !national) return ''
          return `+${cc}${national}`
        } catch {
          return ''
        }
      })(),
    }

    const requiredText = [
      payload.prenom,
      payload.nom,
      payload.adresse,
      payload.ville,
      payload.phoneNumber,
      payload.email,
      payload.permisNum,
      payload.immatriculation,
      payload.passportNum,
    ]

    if (requiredText.some(v => !v)) {
      setError(String(t(lang, 'registration.errors.required')))
      return
    }

    // Email valide
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      setError('Veuillez saisir une adresse email valide.')
      return
    }

    // Téléphone valide (format E.164 reconstruit)
    if (!/^\+\d{6,20}$/.test(payload.phoneE164.replace(/\s+/g, ''))) {
      setError(String(t(lang, 'registration.errors.invalidPhone')))
      return
    }

    // Champs alphanumériques propres
    const alnum = /^[A-Za-z0-9]+$/
    if (!alnum.test(payload.permisNum) || !alnum.test(payload.passportNum) || !alnum.test(payload.immatriculation)) {
      setError('Les numéros de permis, passeport et immatriculation ne doivent contenir que des lettres et des chiffres.')
      return
    }

    // Pièces jointes obligatoires
    if (!hasPermisFile) {
      setError('Veuillez joindre une photo de votre permis de conduire.')
      return
    }
    if (!hasCarteFile) {
      setError('Veuillez joindre une photo de la carte grise de la moto.')
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
      if (payload.phoneE164) out.set('phoneE164', payload.phoneE164)
      out.set('email', payload.email)
      out.set('nationalite', payload.nationalite)
      if (payload.nationaliteAutre) out.set('nationaliteAutre', payload.nationaliteAutre)
      out.set('residenceZone', payload.residenceZone)
      out.set('harleyOwner', payload.harleyOwner)
      if (payload.motoModele) out.set('motoModele', payload.motoModele)
      out.set('profil', payload.profil)
      if (payload.profilGroupe) out.set('profilGroupe', payload.profilGroupe)
      out.set('tailleTshirt', payload.tailleTshirt)
      out.set('paiementMode', payload.paiementMode)
      out.set('permisNum', payload.permisNum)
      out.set('immatriculation', payload.immatriculation)
      out.set('passportNum', payload.passportNum)
      if (isTestMode) out.set('testMode', '1')

      for (const v of fd.getAll('files')) {
        if (typeof File !== 'undefined' && v instanceof File && v.size > 0) {
          out.append('files', v, v.name)
        }
      }

      const res = await fetch(url, { method: 'POST', body: out })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const err = String((data as any)?.error || '')
        const fields = Array.isArray((data as any)?.fields) ? (data as any).fields as string[] : []
        if (res.status === 409 && err === 'duplicate_passport') {
          setError('Ce numéro de passeport est déjà utilisé pour une inscription. Si vous pensez qu\'il s\'agit d\'une erreur, contactez-nous à contact@hogalgierschapteralgeria.com.')
        } else if (res.status === 403 && err === 'not_harley_owner') {
          setError('Les inscriptions sont réservées aux propriétaires d\'une Harley-Davidson pour le moment. Merci pour votre compréhension.')
        } else if (res.status === 400 && err === 'invalid_email') {
          setError('L\'adresse email saisie n\'est pas valide. Vérifiez le format (exemple : nom@domaine.com).')
        } else if (res.status === 400 && err === 'invalid_alnum') {
          setError('Les numéros de permis, passeport et immatriculation ne doivent contenir que des lettres et des chiffres, sans espaces ni symboles.')
        } else if (res.status === 400 && err === 'missing_attachments') {
          setError('Merci de joindre les deux pièces obligatoires : photo du permis et photo de la carte grise.')
        } else if (res.status === 400 && err === 'phone_missing') {
          setError('Le numéro de téléphone est invalide. Vérifiez l\'indicatif du pays et le numéro saisi.')
        } else if (res.status === 400 && err === 'invalid_fields' && fields.includes('residenceZone')) {
          setError('Le lieu de résidence sélectionné n\'est pas valide. Merci de choisir Algérie ou Ailleurs.')
        } else if (res.status === 400 && err === 'missing_fields') {
          const labelFor: Record<string, string> = {
            prenom: 'prénom', nom: 'nom', sexe: 'sexe', adresse: 'adresse', ville: 'ville',
            paysIso2: 'pays', phoneNumber: 'téléphone', email: 'email', nationalite: 'nationalité',
            nationaliteAutre: 'précision de nationalité', residenceZone: 'lieu de résidence',
            profil: 'profil', profilGroupe: 'nom du groupe', tailleTshirt: 'taille de t-shirt',
            permisNum: 'numéro de permis', immatriculation: 'immatriculation', passportNum: 'numéro de passeport',
          }
          const human = fields.map(f => labelFor[f] || f)
          setError(human.length
            ? `Merci de compléter les champs suivants : ${human.join(', ')}.`
            : 'Merci de compléter tous les champs obligatoires.')
        } else {
          setError('Une erreur est survenue lors de l\'envoi. Merci de réessayer dans un instant ou de nous contacter à contact@hogalgierschapteralgeria.com.')
        }
        return
      }

      const paymentUrl = typeof (data as any)?.payment?.url === 'string' ? String((data as any).payment.url) : ''
      if (paymentUrl) {
        window.location.href = paymentUrl
        return
      }

      const ms = (data?.mail?.sent ?? null) as boolean | null
      setMailSent(typeof ms === 'boolean' ? ms : null)
      const rawBadgeUrl = (data?.badge?.url ?? data?.badge?.qrUrl ?? null) as string | null
      const normalizedBadgeUrl = rawBadgeUrl ? rawBadgeUrl.replace(/\/v1\/qr(\?|$)/, '/v1/badge$1') : null
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
      setError(String(t(lang, 'registration.errors.cannotContact')))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-10 bg-bg">
        <div className="max-w-[520px] w-full bg-bg3 border border-orange/10 p-16 text-center flex flex-col items-center">
          <div className="w-[60px] h-[60px] bg-orange flex items-center justify-center mb-6">
            <svg width="28" height="28" fill="none" stroke="#000" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h2 className={`font-display text-[32px] text-orange mb-3 ${lang === 'ar' ? 'tracking-normal' : 'tracking-[0.2em]'}`}>
            {t(lang, 'registration.success.title')}
          </h2>
          <p className="text-muted text-[14px] leading-relaxed mb-8">{t(lang, 'registration.success.lead')}</p>
          {mailSent === true && (
            <p className="text-muted2 text-[12px] leading-relaxed mb-6">{t(lang, 'registration.success.mailSent')}</p>
          )}
          {mailSent === false && (
            <p className="text-muted2 text-[12px] leading-relaxed mb-6">{t(lang, 'registration.success.mailFailed')}</p>
          )}
          {badgeQrUrl && (
            <p className="text-muted2 text-[12px] leading-relaxed mb-8 break-all">
              {t(lang, 'registration.success.badgeLabel')}{' '}
              <a className="text-orange underline" href={badgeQrUrl}>
                {badgeQrUrl}
              </a>
            </p>
          )}
          {payUrl && (
            <a
              href={payUrl}
              className={`mb-3 bg-bg3 border border-orange/20 text-htext font-condensed font-bold text-[12px] px-8 py-3 hover:border-orange/40 transition-colors ${lang === 'ar' ? '' : 'tracking-[0.2em] uppercase'}`}
            >
              {t(lang, 'registration.buttons.payOnline')}
            </a>
          )}
          <a
            href="/"
            className={`bg-orange text-black font-condensed font-bold text-[13px] px-9 py-3.5 hover:bg-white transition-colors ${lang === 'ar' ? '' : 'tracking-[0.2em] uppercase'}`}
          >
            {t(lang, 'registration.buttons.backHome')}
          </a>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="relative pt-[140px] pb-20 bg-bg2 border-b border-orange/10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)',
            backgroundSize: '80px 80px',
            maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%,black 30%,transparent 70%)',
          }}
        />
        <div className="max-w-container mx-auto px-6 md:px-10 relative z-10">
          <div className="section-tag">{t(lang, 'registration.tag')}</div>
          <h1 className="font-display leading-[.88] tracking-wide mt-3" style={{ fontSize: 'clamp(44px,6vw,80px)' }}>
            {t(lang, 'registration.titleA')}
            <br />
            <span className="text-orange">{t(lang, 'registration.titleB')}</span>
          </h1>
          <p className={`text-muted text-[13px] mt-4 ${lang === 'ar' ? '' : 'tracking-[0.22em] uppercase'}`}>{t(lang, 'registration.dates')}</p>
        </div>
      </div>

      <section className="py-20 bg-bg">
        <div className="max-w-[1040px] mx-auto px-6 md:px-10">
          <div className="relative bg-bg3 border border-orange/12">
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(to right,#FF6B00,rgba(255,107,0,.2))' }} />
            <div className="absolute top-[10px] left-[10px] w-5 h-5 border-t border-l border-orange" />
            <div className="absolute top-[10px] right-[10px] w-5 h-5 border-t border-r border-orange" />
            <div className="absolute bottom-[10px] left-[10px] w-5 h-5 border-b border-l border-orange" />
            <div className="absolute bottom-[10px] right-[10px] w-5 h-5 border-b border-r border-orange" />

            <div className="flex items-center justify-between flex-wrap gap-3 px-8 md:px-10 py-6 border-b border-orange/10">
              <p className={`font-display text-orange text-[22px] ${lang === 'ar' ? '' : 'tracking-[0.3em]'}`}>{t(lang, 'registration.frameTitle')}</p>
              <p className={`text-muted text-[11px] ${lang === 'ar' ? '' : 'tracking-[0.18em] uppercase'}`}>{t(lang, 'registration.frameSub')}</p>
            </div>

            <form onSubmit={handleSubmit} className="px-8 md:px-10 py-10 flex flex-col gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <F id="prenom" label={`${t(lang, 'registration.fields.firstName')} *`} type="text" ph={String(t(lang, 'registration.placeholders.firstName'))} />
                <F id="nom" label={`${t(lang, 'registration.fields.lastName')} *`} type="text" ph={String(t(lang, 'registration.placeholders.lastName'))} />
              </div>

              <G label={`${t(lang, 'registration.fields.sex')} *`}>
                <div className="flex gap-5 flex-wrap">
                  <CB value={V.sexe.femme} label={String(t(lang, 'registration.options.female'))} state={sexe} set={setSexe} />
                  <CB value={V.sexe.homme} label={String(t(lang, 'registration.options.male'))} state={sexe} set={setSexe} />
                </div>
              </G>

              <F id="adresse" label={`${t(lang, 'registration.fields.address')} *`} type="text" ph="" />
              <F id="ville" label={`${t(lang, 'registration.fields.city')} *`} type="text" ph="" />
              <G label={`${t(lang, 'registration.fields.country')} *`}>
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
                  <option value="">{String(t(lang, 'registration.placeholders.country'))}</option>
                  {countryOptions.map(c => (
                    <option key={c.iso2} value={c.iso2}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </G>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <G label={`${t(lang, 'registration.fields.phone')} *`}>
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
                      placeholder={String(t(lang, 'registration.placeholders.phone'))}
                      className="min-w-0 bg-transparent border-none px-3 py-3.5 text-htext text-[14px] outline-none placeholder:text-muted2"
                    />
                  </div>
                </G>
                <F id="email" label={`${t(lang, 'registration.fields.email')} *`} type="email" ph={String(t(lang, 'registration.placeholders.email'))} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                <div>
                  <G label={`${t(lang, 'registration.fields.nationality')} *`}>
                    <div className="flex gap-5 flex-wrap">
                      <CB value={V.nationalite.dz} label={String(t(lang, 'registration.options.nationalityDz'))} state={nationalite} set={setNationalite} />
                      <CB value={V.nationalite.autre} label={String(t(lang, 'registration.options.nationalityOther'))} state={nationalite} set={setNationalite} />
                    </div>
                  </G>
                  {nationalite === V.nationalite.autre && (
                    <div className="mt-4">
                      <F
                        id="nationalite-autre"
                        label={String(t(lang, 'registration.fields.specify'))}
                        type="text"
                        ph={String(t(lang, 'registration.placeholders.nationalityOther'))}
                        value={nationaliteAutre}
                        onChange={e => setNationaliteAutre(e.target.value)}
                      />
                    </div>
                  )}
                </div>
                <G label={`${t(lang, 'registration.fields.residence')} *`}>
                  <div className="flex gap-5 flex-wrap">
                    <CB value={V.residence.dz} label={String(t(lang, 'registration.options.residenceDz'))} state={residenceZone} set={setResidenceZone} />
                    <CB value={V.residence.lby} label={String(t(lang, 'registration.options.residenceLby'))} state={residenceZone} set={setResidenceZone} />
                    <CB value={V.residence.tun} label={String(t(lang, 'registration.options.residenceTun'))} state={residenceZone} set={setResidenceZone} />
                    <CB value={V.residence.ailleurs} label={String(t(lang, 'registration.options.residenceAbroad'))} state={residenceZone} set={setResidenceZone} />
                  </div>
                </G>
              </div>

              {/* Question Harley-Davidson — uniquement pour les résidents en Algérie */}
              {residenceZone === V.residence.dz && (
                <G label="Possédez-vous une Harley-Davidson ? *">
                  <div className="flex gap-5 flex-wrap">
                    <CB value="Oui" label="Oui" state={harley} set={setHarley} />
                    <CB value="Non" label="Non" state={harley} set={setHarley} />
                  </div>
                </G>
              )}

              {/* Message de blocage si pas de Harley */}
              {blocked && (
                <div className="border border-orange/30 bg-bg2 px-6 py-6 text-[14px] text-htext leading-relaxed">
                  Désolé, mais les inscriptions sont ouvertes uniquement aux propriétaires d&apos;une Harley-Davidson pour le moment. Merci pour votre compréhension.
                </div>
              )}

              {!blocked && (
                <>
                  {/* Modèle de moto — pour les résidents Algérie avec Harley */}
                  {residenceZone === V.residence.dz && harley === 'Oui' && (
                    <F
                      id="moto-modele"
                      label="Modèle de votre Harley-Davidson *"
                      type="text"
                      ph="Ex : Street Glide, Fat Boy, Sportster…"
                      value={motoModele}
                      onChange={e => setMotoModele(e.target.value)}
                    />
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <F id="permis" label={`${t(lang, 'registration.fields.license')} *`} type="text" ph={String(t(lang, 'registration.placeholders.license'))} clean />
                    <UF id="up-permis" label={String(t(lang, 'registration.fields.uploadLicense'))} lang={lang} onPicked={setHasPermisFile} />
                  </div>

                  <F id="passport" label={`${t(lang, 'registration.fields.passport')} *`} type="text" ph={String(t(lang, 'registration.placeholders.passport'))} clean />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <F id="immat" label={`${t(lang, 'registration.fields.plate')} *`} type="text" ph={String(t(lang, 'registration.placeholders.plate'))} clean />
                    <UF id="up-carte" label={String(t(lang, 'registration.fields.uploadRegistration'))} lang={lang} onPicked={setHasCarteFile} />
                  </div>

                  <G label={`${t(lang, 'registration.fields.profile')} *`}>
                    <div className="flex gap-5 flex-wrap">
                      <CB value={V.profil.solo} label={String(t(lang, 'registration.options.profileSolo'))} state={profil} set={setProfil} />
                      <CB value={V.profil.groupe} label={String(t(lang, 'registration.options.profileGroup'))} state={profil} set={setProfil} />
                    </div>
                  </G>
                  {profil === V.profil.groupe && (
                    <F
                      id="profil-groupe"
                      label={String(t(lang, 'registration.fields.specify'))}
                      type="text"
                      ph={String(t(lang, 'registration.placeholders.groupName'))}
                      value={profilGroupe}
                      onChange={e => setProfilGroupe(e.target.value)}
                    />
                  )}

                  <G label={`${t(lang, 'registration.fields.tshirtSize')} *`}>
                    <div className="flex gap-5 flex-wrap">
                      {['S', 'M', 'L', 'XL', 'XXL'].map(sz => (
                        <CB key={sz} value={sz} label={sz} state={taille} set={setTaille} />
                      ))}
                    </div>
                  </G>

                  {error && (
                    <div className="border border-orange/20 bg-bg2 px-5 py-4 text-[13px] text-htext leading-relaxed">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className={`mt-2 bg-orange text-black font-condensed font-extrabold text-[14px] py-5 hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5 hover:disabled:translate-y-0 transition-all duration-200 ${lang === 'ar' ? '' : 'tracking-[0.3em] uppercase'}`}
                  >
                    {loading ? t(lang, 'registration.buttons.submitting') : t(lang, 'registration.buttons.submit')}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      </section>
    </>
  )
}

function F({
  id,
  label,
  type,
  ph,
  required = true,
  value,
  onChange,
  clean = false,
}: {
  id: string
  label: string
  type: string
  ph: string
  required?: boolean
  value?: string
  onChange?: ChangeEventHandler<HTMLInputElement>
  clean?: boolean
}) {
  // clean = n'accepte que lettres et chiffres (permis, passeport, immatriculation)
  const handleInput: FormEventHandler<HTMLInputElement> = (e) => {
    if (clean) {
      const el = e.currentTarget
      const cleaned = el.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
      if (cleaned !== el.value) el.value = cleaned
    }
  }
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
        onInput={handleInput}
        inputMode={clean ? 'text' : undefined}
        className="bg-bg2 border border-white/8 px-4 py-3.5 text-htext text-[14px] outline-none placeholder:text-muted2 focus:border-orange/50 transition-colors w-full"
      />
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

function CB({
  value,
  label,
  state,
  set,
}: {
  value: string
  label: string
  state: string
  set: (s: string) => void
}) {
  const checked = state === value
  return (
    <label className="flex items-center gap-2 cursor-pointer text-htext text-[14px] select-none">
      <div
        onClick={() => set(value)}
        className={`w-4 h-4 min-w-[16px] rounded-[3px] border flex items-center justify-center transition-all duration-150 cursor-pointer
          ${checked ? 'bg-orange border-orange' : 'bg-white/[.04] border-white/25 hover:border-orange/40'}`}
      >
        {checked && <svg width="10" height="10" fill="none" stroke="#000" strokeWidth="2.5" viewBox="0 0 12 12"><polyline points="2 6 5 9 10 3" /></svg>}
      </div>
      <input type="checkbox" checked={checked} onChange={() => set(value)} className="hidden" />
      {label}
    </label>
  )
}

function UF({ id, label, lang, onPicked }: { id: string; label: string; lang: Lang; onPicked?: (has: boolean) => void }) {
  const [name, setName] = useState(String(t(lang, 'registration.upload.none')))
  return (
    <div className="flex flex-col gap-2">
      <p className="text-htext text-[14px]">{label} *</p>
      <div className="flex items-center gap-3 flex-wrap">
        <label
          htmlFor={id}
          className={`bg-orange text-black font-condensed font-extrabold text-[11px] px-5 py-3 cursor-pointer hover:bg-white transition-colors whitespace-nowrap ${lang === 'ar' ? '' : 'tracking-[0.18em] uppercase'}`}
        >
          {t(lang, 'registration.buttons.chooseFile')}
        </label>
        <span className="text-muted text-[13px]">{name}</span>
      </div>
      <input
        id={id}
        name="files"
        type="file"
        accept=".jpg,.jpeg,.png,.pdf,.webp"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          setName(f?.name ?? String(t(lang, 'registration.upload.none')))
          onPicked?.(Boolean(f))
        }}
      />
    </div>
  )
}

