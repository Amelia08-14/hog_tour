'use client'
import { useEffect, useState } from 'react'

const EVENT = new Date('2026-10-29T07:00:00')

function pad(n: number) { return String(n).padStart(2, '0') }

export default function HeroCountdown({ lang }: { lang: string }) {
  const [ms, setMs] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => setMs(Math.max(0, EVENT.getTime() - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (ms === null) return null

  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)

  const isAr = lang === 'ar'
  const label  = isAr ? 'الإطلاق خلال' : lang === 'en' ? 'STARTS IN' : 'DÉPART DANS'
  const units  = isAr
    ? ['يوم', 'ساعة', 'دقيقة', 'ثانية']
    : lang === 'en' ? ['DAYS', 'HRS', 'MIN', 'SEC'] : ['JOURS', 'HRS', 'MIN', 'SEC']

  return (
    <div className="au-countdown hero-countdown">
      <p className="hero-countdown-label font-condensed">{label}</p>
      <div className="hero-countdown-blocks">
        {([d, h, m, s] as number[]).map((v, i) => (
          <div key={i} className="hero-countdown-item">
            <div className="hero-countdown-block">
              <span className="hero-countdown-val font-display">{pad(v)}</span>
              <span className="hero-countdown-unit font-condensed">{units[i]}</span>
            </div>
            {i < 3 && <span className="hero-countdown-sep font-display" aria-hidden="true">:</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
