export type Lang = 'fr' | 'en' | 'ar'

export function normalizeLang(v: unknown): Lang {
  const s = String(v || '').toLowerCase().trim()
  if (s === 'en') return 'en'
  if (s === 'ar') return 'ar'
  return 'fr'
}

export function dirForLang(lang: Lang): 'ltr' | 'rtl' {
  return lang === 'ar' ? 'rtl' : 'ltr'
}

