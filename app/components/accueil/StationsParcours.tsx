'use client'

import { useEffect, useRef } from 'react'

export type Station = {
  id: string
  libelle: string
  examen: boolean
  statut: 'fait' | 'courant' | 'a_venir'
}

const VIOLET = '#6D28D9'
const GRIS = '#D1D5DB'
const VERT = '#15803D'
const VERT_FOND = '#F0FDF4'

const STATUTS: Record<Station['statut'], string> = { fait: 'terminée', courant: 'en cours', a_venir: 'à venir' }

// Au-delà de 5 stations, la ligne défile horizontalement.
const MAX_SANS_DEFILEMENT = 5

function styleRond(s: Station): React.CSSProperties {
  const couleur = s.examen ? VERT : VIOLET
  if (s.statut === 'fait') return { background: couleur, border: `2px solid ${couleur}` }
  if (s.statut === 'courant') return { background: s.examen ? VERT_FOND : '#FFFFFF', border: `4px solid ${couleur}` }
  return { background: s.examen ? VERT_FOND : '#FFFFFF', border: `2px solid ${s.examen ? '#BBF7D0' : GRIS}` }
}

// Ligne de stations du parcours, une par étape, reliées par un trait (violet
// jusqu'à l'étape en cours). Centrée sur l'étape en cours quand elle défile.
export default function StationsParcours({ stations }: { stations: Station[] }) {
  const conteneur = useRef<HTMLDivElement>(null)
  const courante = useRef<HTMLLIElement>(null)
  const defile = stations.length > MAX_SANS_DEFILEMENT
  const indexCourant = stations.findIndex((s) => s.statut === 'courant')
  // Parcours terminé : tout le trait est violet.
  const atteint = indexCourant === -1 ? stations.length - 1 : indexCourant

  useEffect(() => {
    const c = conteneur.current
    const el = courante.current
    if (!defile || !c || !el) return
    const rc = c.getBoundingClientRect()
    const re = el.getBoundingClientRect()
    c.scrollLeft += re.left + re.width / 2 - (rc.left + rc.width / 2)
  }, [defile])

  return (
    <div ref={conteneur} className={defile ? 'overflow-x-auto -mx-4 px-4 pb-1' : ''}>
      <ol className={`relative flex ${defile ? 'w-max' : 'w-full'}`}>
        {stations.map((s, i) => (
          <li
            key={s.id}
            title={`${s.libelle} · ${STATUTS[s.statut]}`}
            ref={s.statut === 'courant' ? courante : undefined}
            className={`relative flex flex-col items-center ${defile ? 'w-[72px] shrink-0' : 'min-w-0 flex-1'}`}
          >
            {/* Trait vers la station précédente et vers la suivante (centre du rond à 10px) */}
            {i > 0 && (
              <span
                aria-hidden
                className="absolute left-0 right-1/2 top-[9px] h-[2px]"
                style={{ background: i <= atteint ? VIOLET : GRIS }}
              />
            )}
            {i < stations.length - 1 && (
              <span
                aria-hidden
                className="absolute left-1/2 right-0 top-[9px] h-[2px]"
                style={{ background: i < atteint ? VIOLET : GRIS }}
              />
            )}
            <span
              role="img"
              aria-label={`${s.libelle} (${STATUTS[s.statut]})`}
              className="relative z-10 h-5 w-5 rounded-full"
              style={styleRond(s)}
            />
            {/* Libellé visible seulement sous l'étape en cours (nom) et sous les examens (« Examen ») */}
            {s.statut === 'courant' ? (
              <span
                aria-hidden
                className="mt-1.5 line-clamp-2 w-full break-words px-0.5 text-center text-[11px] font-bold leading-tight"
                style={{ color: s.examen ? VERT : '#1F2937' }}
              >
                {s.libelle}
              </span>
            ) : s.examen ? (
              <span aria-hidden className="mt-1.5 text-center text-[11px] font-semibold leading-tight" style={{ color: VERT }}>
                Examen
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  )
}
