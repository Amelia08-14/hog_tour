// src/components/home/Ticket.tsx
export default function Ticket() {
  return (
    <section className="py-16 bg-bg2 border-t border-orange/10">
      <div className="max-w-container mx-auto px-6 md:px-10">
        <div className="reveal reveal-streak relative bg-bg3 border border-orange/12 px-10 md:px-16 py-14 overflow-hidden">
          {/* Damier déco */}
          <div className="absolute top-0 right-0 bottom-0 w-[40%] pointer-events-none opacity-60"
            style={{ maskImage: 'linear-gradient(to left, rgba(0,0,0,1) 0%, transparent 100%)' }}>
            <svg width="100%" height="100%">
              <defs>
                <pattern id="checker" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                  <rect x="0"  y="0"  width="20" height="20" fill="rgba(255,255,255,.04)"/>
                  <rect x="20" y="20" width="20" height="20" fill="rgba(255,255,255,.04)"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#checker)"/>
            </svg>
          </div>

          <div className="relative z-10">
            <h2 className="font-display tracking-wide text-htext mb-7"
              style={{ fontSize: 'clamp(32px, 4.5vw, 56px)' }}>
              Réservez votre ticket
            </h2>
            <div className="h-px bg-white/10 mb-7"/>
            <div className="flex items-center gap-12 flex-wrap">
              <span className="text-muted text-[14px]">Octobre, 2026</span>
              <div className="flex-1 min-w-[180px]">
                <p className="font-condensed font-bold text-[20px] tracking-[0.12em]">HOG TOUR 2026 ®</p>
                <p className="flex items-center gap-1.5 text-muted text-[13px] mt-1">
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  Alger
                </p>
              </div>
              <a href="/inscription"
                className="bg-orange text-black font-condensed font-extrabold text-[13px] tracking-[0.22em] uppercase px-9 py-3.5 hover:bg-white hover:-translate-y-0.5 transition-all duration-200 flex-shrink-0">
                INSCRIPTION
              </a>
            </div>
            <div className="h-px bg-white/10 mt-7"/>
          </div>
        </div>
      </div>
    </section>
  )
}
