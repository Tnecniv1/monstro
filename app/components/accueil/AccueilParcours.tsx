import type { ParcoursAccueil } from '@/lib/parcours/charger'
import type { Progression } from '@/lib/parcours/progression'
import { niveauPixels } from '@/lib/pixels'
import PixelGrid from '../PixelGrid'
import StationsParcours, { type Station } from './StationsParcours'

// Accueil d'un élève qui a un parcours : bloc objectif (nom du parcours et
// J-n) et carte parcours (stations, PixelGrid de l'élève dans l'espace
// restant, puis une légende : pixels · niveau à gauche, série à droite).
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
  // Série de jours consécutifs (0 : rien à droite de la légende).
  streak: number
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

        <PixelGrid count={pixels} ajuster />

        <div className="flex items-center justify-between gap-3 text-sm text-text-secondary">
          <p className="min-w-0 truncate">
            <span className="font-bold text-text-primary">{pixels.toLocaleString('fr-FR')}</span> pixels · Niveau{' '}
            {niveauPixels(pixels)} / 12
          </p>
          {streak > 0 && (
            <span className="flex shrink-0 items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-warning">
                <path d="M6 3 L18 3 L18 6 L12 12 L18 18 L18 21 L6 21 L6 18 L12 12 L6 6 Z" />
              </svg>
              {streak} j
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
