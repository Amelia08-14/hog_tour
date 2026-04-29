// src/components/home/Gallery.tsx
// Remplacer les placeholders par <Image fill /> de next/image
const PHOTOS = ['Convoi motos sur route','Road Team Harley','Moto challenge cones','Rider numéro 12','Road Team dos','Moto slalom']

export default function Gallery() {
  return (
    <section className="bg-bg">
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: '280px 280px' }}>
        {PHOTOS.map((label, i) => (
          <div key={i}
            className="group relative bg-bg3 border border-white/[.04] flex flex-col items-center justify-center gap-3 overflow-hidden cursor-pointer hover:border-orange/30 transition-colors duration-300">
            {/* Overlay hover */}
            <div className="absolute inset-0 bg-orange/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"/>
            {/* Texture */}
            <div className="absolute inset-0 opacity-[.02]"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(255,107,0,1) 10px,rgba(255,107,0,1) 11px)' }}/>
            <svg width="32" height="32" fill="none" stroke="#FF6B00" strokeWidth="1" viewBox="0 0 24 24" className="opacity-20 relative z-[1]">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span className="text-muted2 text-[10px] tracking-[0.15em] uppercase opacity-40 relative z-[1]">{label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
