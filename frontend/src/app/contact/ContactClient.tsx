'use client'
import { useState, type FormEvent } from 'react'
import type { Lang } from '@/i18n/shared'
import { t } from '@/i18n/messages'

export default function ContactClient({ lang }: { lang: Lang }) {
  const [sent, setSent] = useState(false)
  const [msgLen, setMsgLen] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const form = e.currentTarget as HTMLFormElement
    const fd = new FormData(form)
    const name = String(fd.get('nom') || '').trim()
    const email = String(fd.get('email') || '').trim()
    const dial = String(fd.get('dial') || '').trim()
    const phone = String(fd.get('phone') || '').trim()
    const message = String(fd.get('message') || '').trim()

    if (!name || !email || !phone || !message) {
      setError(t(lang, 'contact.required'))
      return
    }

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
    const base = apiBase || (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : '')
    const url = base ? `${base.replace(/\/$/, '')}/v1/contact` : '/v1/contact'

    try {
      setLoading(true)
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone: `${dial} ${phone}`.trim(),
          message,
        }),
      })
      if (!res.ok) {
        setError(t(lang, 'contact.failed'))
        return
      }
      setSent(true)
    } catch {
      setError(t(lang, 'contact.failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="min-h-screen flex items-center pt-[120px] pb-20 bg-bg">
      <div className="max-w-container mx-auto px-6 md:px-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-start">

          <div className={lang === 'ar' ? 'lg:order-2 text-right' : ''}>
            <h1 className={`font-display leading-[.88] ${lang === 'ar' ? 'tracking-normal' : 'tracking-wide'}`} style={{ fontSize: 'clamp(44px,6vw,76px)' }}>
              {t(lang, 'contact.title')}
            </h1>
            <p className="text-muted text-[18px] mt-3 mb-10">{t(lang, 'contact.lead')}</p>

            <div className="flex flex-col gap-3">
              {[
                { icon: <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 11.5 19.79 19.79 0 01.04 2.82 2 2 0 012 .66h3a2 2 0 012 1.72 12.07 12.07 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />, val: '+213 774 31 87 51', href: 'tel:+213774318751' },
                { icon: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>, val: 'contact@hogalgierschapteralgeria.com', href: 'mailto:contact@hogalgierschapteralgeria.com' },
              ].map((item, i) => (
                <a key={i} href={item.href}
                  className="flex items-center gap-4 border border-orange/10 bg-bg3 px-5 py-4 hover:border-orange/30 transition-colors duration-200 group">
                  <div className="w-[38px] h-[38px] flex-shrink-0 bg-orange/10 border border-orange/10 flex items-center justify-center text-orange group-hover:bg-orange/15 transition-colors">
                    <svg width="16" height="16" fill="none" stroke="#FF6B00" strokeWidth="2" viewBox="0 0 24 24">{item.icon}</svg>
                  </div>
                  <span className="text-htext text-[14px] group-hover:text-orange transition-colors">{item.val}</span>
                </a>
              ))}
            </div>

            <div className={`flex gap-[3px] mt-3 ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
              {[
                { l: 'Facebook', h: 'https://www.facebook.com/profile.php?id=61581997936557' },
                { l: 'Instagram', h: 'https://www.instagram.com/hogalgierschapteralgeria/' },
                { l: 'Youtube', h: 'https://www.youtube.com/@HOGAlgiersChapterAlgeria' },
              ].map(s => (
                <a key={s.l} href={s.h} target="_blank" rel="noreferrer"
                  className={`flex-1 text-center py-3.5 bg-bg3 border border-orange/10 font-condensed font-semibold text-[10.5px] text-muted hover:border-orange hover:text-orange hover:bg-orange/5 transition-all duration-200 ${lang === 'ar' ? '' : 'tracking-[0.18em] uppercase'}`}>
                  {s.l}
                </a>
              ))}
            </div>
          </div>

          <div className={lang === 'ar' ? 'lg:order-1 text-right' : ''}>
            {sent ? (
              <div className="flex flex-col items-start gap-4 py-10">
                <div className="w-[52px] h-[52px] bg-orange flex items-center justify-center">
                  <svg width="22" height="22" fill="none" stroke="#000" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <p className={`font-display text-[28px] text-orange ${lang === 'ar' ? '' : 'tracking-[0.2em]'}`}>{t(lang, 'contact.sent')}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-1">
                {[
                  { id: 'nom', label: `${t(lang, 'contact.name')} *`, type: 'text', ph: '' },
                  { id: 'email', label: `${t(lang, 'contact.email')} *`, type: 'email', ph: '' },
                ].map(f => (
                  <div key={f.id}>
                    <label htmlFor={f.id} className="block text-htext text-[14px] pb-2">{f.label}</label>
                    <input id={f.id} name={f.id} type={f.type} required placeholder={f.ph}
                      className={`w-full bg-transparent border-b border-white/15 pb-3 pt-1 text-htext text-[18px] outline-none placeholder:text-muted focus:border-orange transition-colors duration-200 ${lang === 'ar' ? 'text-right' : ''}`} />
                  </div>
                ))}

                <div>
                  <label className="block text-htext text-[14px] pb-2">{t(lang, 'contact.phone')} *</label>
                  <div className="flex border-b border-white/15 focus-within:border-orange transition-colors duration-200">
                    <select name="dial" className="bg-transparent border-none outline-none text-htext text-[14px] pr-2 cursor-pointer">
                      {['🇩🇿 +213', '🇫🇷 +33', '🇲🇦 +212', '🇧🇪 +32', '🇺🇸 +1', '🇬🇧 +44'].map(c => <option key={c}>{c}</option>)}
                    </select>
                    <input name="phone" type="tel" required
                      className="flex-1 bg-transparent border-none pb-3 pt-1 text-htext text-[18px] outline-none placeholder:text-muted text-left" />
                  </div>
                </div>

                <div className="relative">
                  <div className={`absolute top-0 text-muted text-[11px] tracking-wide ${lang === 'ar' ? 'left-0' : 'right-0'}`}>{msgLen} / 180</div>
                  <label className="block text-htext text-[14px] pb-2">{t(lang, 'contact.message')} *</label>
                  <textarea required rows={5} maxLength={180}
                    name="message"
                    className={`w-full bg-transparent border-b border-white/15 pb-3 pt-1 text-htext text-[18px] outline-none placeholder:text-muted focus:border-orange transition-colors duration-200 resize-none leading-relaxed ${lang === 'ar' ? 'text-right' : ''}`}
                    onChange={e => setMsgLen(e.target.value.length)} />
                </div>

                {error && (
                  <div className="mt-5 border border-orange/20 bg-bg2 px-5 py-4 text-[13px] text-htext leading-relaxed">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`self-start mt-5 bg-orange text-black font-condensed font-extrabold text-[13px] px-12 py-4 hover:bg-white hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed hover:disabled:translate-y-0 transition-all duration-200 ${lang === 'ar' ? '' : 'tracking-[0.3em] uppercase'}`}
                >
                  {loading ? (lang === 'en' ? 'SENDING…' : lang === 'ar' ? 'جارٍ الإرسال…' : 'ENVOI…') : (t(lang, 'contact.send') as string)}
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
    </section>
  )
}
