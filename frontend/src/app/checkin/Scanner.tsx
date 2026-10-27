'use client'
import { useEffect, useRef, useState } from 'react'

// Lecture du QR par la caméra. Safari iOS n'a pas BarcodeDetector : les images
// sont décodées en JavaScript (jsQR), ce qui fonctionne partout en HTTPS.
export default function Scanner({ onResult, onClose }: { onResult: (qr: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState('')
  const handled = useRef(false)

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let stream: MediaStream | undefined

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Ce navigateur ne donne pas accès à la caméra. Ouvre la page dans Safari, ou saisis le code à la main.')
        return
      }
      try {
        const { default: jsQR } = await import('jsqr')
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        })
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return }
        const el = video.current
        if (!el) return
        el.srcObject = stream
        await el.play()
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) throw new Error('canvas')
        const tick = () => {
          if (stopped || handled.current) return
          if (el.readyState >= 2 && el.videoWidth) {
            const width = Math.min(el.videoWidth, 720)
            canvas.width = width
            canvas.height = Math.round((el.videoHeight * width) / el.videoWidth)
            ctx.drawImage(el, 0, 0, canvas.width, canvas.height)
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })
            if (code?.data) {
              handled.current = true
              try { navigator.vibrate?.(60) } catch { /* sans effet sur iOS */ }
              onResult(code.data)
              return
            }
          }
          timer = setTimeout(tick, 110)
        }
        tick()
      } catch (e) {
        const name = (e as Error)?.name
        setError(name === 'NotAllowedError'
          ? 'L’accès à la caméra est refusé. Autorise-le dans Réglages › Safari › Caméra, puis rouvre le scanner.'
          : 'Caméra indisponible. Saisis le code à la main ci-dessous.')
      }
    }
    start()
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach(t => t.stop())
    }
    // onResult est volontairement hors des dépendances : la caméra ne doit pas redémarrer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-between px-5 py-4">
        <span className="font-condensed font-bold tracking-[0.2em] text-[13px] uppercase text-orange">Scanner un badge</span>
        <button onClick={onClose} className="text-htext text-[14px] px-3 py-2 border border-white/15">Fermer</button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[68vw] max-w-[320px] aspect-square border-2 border-orange/90 shadow-[0_0_0_9999px_rgba(0,0,0,.55)]" />
        </div>
        {error && (
          <div className="absolute inset-x-5 top-5 border border-orange/30 bg-bg3 px-4 py-3 text-[13px] text-htext leading-relaxed">{error}</div>
        )}
      </div>
      <form
        className="p-4 flex gap-2 bg-bg2"
        onSubmit={e => { e.preventDefault(); if (manual.trim() && !handled.current) { handled.current = true; onResult(manual.trim()) } }}
      >
        <input
          value={manual}
          onChange={e => setManual(e.target.value)}
          placeholder="Ou colle le contenu du QR"
          className="flex-1 bg-bg border border-white/10 px-3 py-3 text-[16px] text-htext outline-none focus:border-orange/50"
        />
        <button className="bg-orange text-black font-condensed font-extrabold tracking-[0.15em] uppercase text-[12px] px-4">Valider</button>
      </form>
    </div>
  )
}
