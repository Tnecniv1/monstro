import type { ParcoursAccueil } from '@/lib/parcours/charger'
import type { Progression } from '@/lib/parcours/progression'
import PixelGrid from '../PixelGrid'
import StationsParcours, { type Station } from './StationsParcours'

// Accueil d'un élève qui a un parcours : bloc objectif (nom du parcours et
// J-n) et carte parcours (stations, puis la PixelGrid de l'élève).
export default function AccueilParcours({
  parcours,
  progression,
  pixels,
  compteARebours,
}: {
  parcours: ParcoursAccueil
  progression: Progression
  // Nombre de pixels de l'élève (même compteur que l'accueil sans parcours).
  pixels: number
  // « J-12 », « J+3 » ; null si le parcours n'a pas de date_objectif.
  compteARebours: string | null
}) {
  const { etapes } = parcours
  const { etapeCouranteIndex, termine } = progression

  const stations: Station[] = etapes.map((e, i) => ({
    id: e.id,
    libelle: (e.type === 'examen' ? e.libelle : e.titre) ?? e.titre ?? 'Étape',
    examen: e.type === 'examen',
    statut:
      termine || (etapeCouranteIndex !== null && i < etapeCouranteIndex)
        ? 'fait'
        : i === etapeCouranteIndex
          ? 'courant'
          : 'a_venir',
  }))

  return (
    <div className="w-full max-w-sm space-y-4">
      {/* Bloc objectif */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Mon objectif</p>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="min-w-0 text-2xl font-extrabold leading-tight text-text-primary">{parcours.nom}</h2>
          {compteARebours && (
            <span className="shrink-0 text-xl font-extrabold text-accent">{compteARebours}</span>
          )}
        </div>
      </div>

      {/* Carte parcours */}
      <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
        {stations.length === 0 ? (
          <p className="text-sm text-text-muted">Ce parcours n’a pas encore d’étape.</p>
        ) : (
          <StationsParcours stations={stations} />
        )}

        <div className="h-px bg-border" />

        <PixelGrid count={pixels} pleineLargeur fondTransparent />
      </div>
    </div>
  )
}
