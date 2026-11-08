import type { ParcoursAccueil } from '@/lib/parcours/charger'
import type { Progression } from '@/lib/parcours/progression'
import { niveauPixels } from '@/lib/pixels'
import PixelGrid from '../PixelGrid'
import StreakBadge from '../StreakBadge'
import StationsParcours, { type Station } from './StationsParcours'

// Accueil d'un élève qui a un parcours : bloc objectif (nom du parcours et
// J-n) et carte parcours (stations, compteurs pixels / série, PixelGrid de
// l'élève dans l'espace restant, puis le niveau).
export default function AccueilParcours({
  parcours,
  progression,
  pixels,
  streak,
  compteARebours,
}: {
  parcours: ParcoursAccueil
  progression: Progression
  // Nombre de pixels de l'élève (même compteur que l'accueil sans parcours).
  pixels: number
  // Série de jours consécutifs (0 : compteur de série masqué).
  streak: number
  // « J-12 », « J+3 » ; null si le parcours n'a pas de date_objectif.
  compteARebours: string | null
}) {
  const { etapes } = parcours
  const { etapeCouranteIndex, termine, acquisParTest } = progression

  const stations: Station[] = etapes.map((e, i) => ({
    id: e.id,
    libelle: (e.type === 'examen' ? e.libelle : e.titre) ?? e.titre ?? 'Étape',
    examen: e.type === 'examen',
    statut:
      termine || acquisParTest[i] || (etapeCouranteIndex !== null && i < etapeCouranteIndex)
        ? 'fait'
        : i === etapeCouranteIndex
          ? 'courant'
          : 'a_venir',
  }))

  return (
    // Prend l'espace restant de l'accueil ; la carte aussi, pour la PixelGrid.
    <div className="flex w-full max-w-sm flex-1 flex-col gap-4">
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
      <div className="flex flex-1 flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
        {stations.length === 0 ? (
          <p className="text-sm text-text-muted">Ce parcours n’a pas encore d’étape.</p>
        ) : (
          <StationsParcours stations={stations} />
        )}

        <div className="h-px bg-border" />

        <StreakBadge streak={streak} pixels={pixels} />

        <PixelGrid count={pixels} ajuster />

        <p className="text-center text-sm text-text-secondary">Niveau {niveauPixels(pixels)} / 12</p>
      </div>
    </div>
  )
}
