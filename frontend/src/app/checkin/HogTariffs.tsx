'use client'
import { formatMoney, type HogTariff, type Participant } from './lib'

// Prise en charge d'un membre du H.O.G Algérie : statut, montant retenu et
// grille de référence (la ligne du participant est mise en évidence).
export default function HogTariffs({ person, grid }: { person: Participant; grid: HogTariff[] }) {
  const chosen = person.hogTariff
  return (
    <section className="border border-orange/40 bg-[#1f1407]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-orange/25">
        <span className="bg-orange text-black font-condensed font-extrabold text-[11px] tracking-[0.18em] uppercase px-2 py-1">Membre H.O.G</span>
        <span className="font-condensed font-bold tracking-[0.12em] uppercase text-[13px] text-orange">Tarifs référentiels</span>
      </div>
      <div className="px-4 py-3 text-[13px] leading-relaxed text-htext">
        {chosen
          ? <>Tarif retenu : <strong>{chosen.room} · {chosen.occupancy}</strong></>
          : <>Aucun hébergement choisi à l’inscription : propose la grille ci-dessous.</>}
        <p className="text-muted mt-1">Statut déclaré à l’inscription : demande la carte de membre H.O.G avant d’encaisser.</p>
      </div>
      {grid.length > 0 && (
        <div className="px-2 pb-2">
          {grid.map(row => {
            const active = chosen?.value === row.value
            return (
              <div
                key={row.value}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 text-[13px] ${active ? 'bg-orange text-black' : 'border-t border-white/5 text-htext'}`}
              >
                <div className="min-w-0">
                  <div className="font-semibold">{row.room}</div>
                  <div className={active ? 'text-black/70 text-[12px]' : 'text-muted text-[12px]'}>{row.occupancy}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold">{formatMoney(row.roomCents, row.currency)}</div>
                  {row.persons > 1 && (
                    <div className={active ? 'text-black/70 text-[11px]' : 'text-muted text-[11px]'}>
                      {formatMoney(row.perPersonCents, row.currency)} / motard
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
