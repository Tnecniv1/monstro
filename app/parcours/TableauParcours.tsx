import type { ParcoursAccueil } from '@/lib/parcours/charger'
import { cleExercice, plageEtape, type EtapeProgression, type Progression } from '@/lib/parcours/progression'
import { couleurTaux, formatTemps } from './format'
import type { EntHistorique } from './TableauHistorique'

const VERT = '#15803D'
const VERT_FOND = '#F0FDF4'
// Feuilles chaotiques (lib/parcours/accompagnement.ts).
const CHAOTIQUE_TEXTE = '#B8472A'
const CHAOTIQUE_FOND = '#FDEEE9'

// Tableau « Parcours » de /parcours, pour un élève qui a un parcours : une
// ligne par étape, dans l'ordre. Progression = exercices distincts faits
// (succes, echec ou corrige) dans la plage, via calculerProgression comme
// l'accueil ; « Acquise · test de positionnement » pour une étape d'avant le
// départ du test (règle A). Correction = rattrapés ÷ (rattrapés + échecs), « — » sans échec.
// Réussite et temps : mêmes formules que TableauHistorique, restreintes aux
// entraînements terminés dont le ref_exo est dans la plage (« — » sinon).
// Sous les étapes, séparées par « En parallèle » : les feuilles chaotiques du
// parcours, mêmes colonnes et mêmes formules sur leur plage, toutes dates.
export default function TableauParcours({
  parcours,
  progression,
  historique,
}: {
  parcours: ParcoursAccueil
  progression: Progression
  // Entraînements terminés de l'élève (même jeu que TableauHistorique).
  historique: EntHistorique[]
}) {
  if (parcours.etapes.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">Ce parcours n&apos;a pas encore d&apos;étape.</p>
  }

  return (
    <div className="max-h-[220px] overflow-y-auto overflow-x-auto border border-border rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2 text-left text-xs font-medium text-text-muted uppercase tracking-wide">
            <th className="sticky top-0 z-10 bg-surface-2 px-4 py-3">Feuille</th>
            <th className="sticky top-0 z-10 bg-surface-2 px-4 py-3">Progression</th>
            <th className="sticky top-0 z-10 bg-surface-2 px-4 py-3">Réussite</th>
            <th className="sticky top-0 z-10 bg-surface-2 px-4 py-3">Correction</th>
            <th className="sticky top-0 z-10 bg-surface-2 px-4 py-3">Temps total</th>
          </tr>
        </thead>
        <tbody>
          {parcours.etapes.map((e, i) => {
            const { debut, fin } = plageEtape(e)
            return (
              <Ligne
                key={e.id}
                titre={e.titre}
                badge={e.type === 'examen' ? { texte: 'Examen', couleur: VERT, fond: VERT_FOND } : null}
                restreinte={e.exo_debut != null || e.exo_fin != null}
                debut={debut}
                fin={fin}
                feuilleId={e.feuille_id}
                faits={progression.faitsParEtape[i] ?? 0}
                rattrapes={progression.rattrapesParEtape[i] ?? 0}
                echecs={progression.echecsParEtape[i] ?? 0}
                acquise={progression.acquisParTest[i] ?? false}
                courante={i === progression.etapeCouranteIndex}
                pair={i % 2 === 0}
                historique={historique}
              />
            )
          })}

          {/* Feuilles chaotiques : mêmes colonnes, sur leur plage, toutes dates. */}
          {parcours.chaotiques.length > 0 && (
            <tr className="border-b border-border bg-surface">
              <td colSpan={5} className="px-4 pb-2 pt-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
                En parallèle
              </td>
            </tr>
          )}
          {parcours.chaotiques.map((c, i) => {
            const { debut, fin } = plageEtape(c as unknown as EtapeProgression)
            let faits = 0
            let rattrapes = 0
            let echecs = 0
            for (let n = debut; n <= fin; n++) {
              const cle = cleExercice(c.feuille_id, n)
              if (parcours.exercices.faits.has(cle)) faits++
              if (parcours.exercices.rattrapes.has(cle)) rattrapes++
              if (parcours.exercices.echecs.has(cle)) echecs++
            }
            return (
              <Ligne
                key={c.id}
                titre={c.titre}
                badge={{ texte: `1 problème sur ${c.rythme}`, couleur: CHAOTIQUE_TEXTE, fond: CHAOTIQUE_FOND }}
                restreinte={c.exo_debut != null || c.exo_fin != null}
                debut={debut}
                fin={fin}
                feuilleId={c.feuille_id}
                faits={faits}
                rattrapes={rattrapes}
                echecs={echecs}
                acquise={false}
                courante={false}
                pair={i % 2 === 0}
                historique={historique}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Une ligne du tableau (étape ou feuille chaotique).
function Ligne({
  titre,
  badge,
  restreinte,
  debut,
  fin,
  feuilleId,
  faits,
  rattrapes,
  echecs,
  acquise,
  courante,
  pair,
  historique,
}: {
  titre: string | null
  badge: { texte: string; couleur: string; fond: string } | null
  restreinte: boolean
  debut: number
  fin: number
  feuilleId: string | null
  faits: number
  rattrapes: number
  echecs: number
  acquise: boolean
  courante: boolean
  pair: boolean
  historique: EntHistorique[]
}) {
  const total = Math.max(0, fin - debut + 1)
  const aCorriger = rattrapes + echecs
  const pct = total > 0 ? Math.min(100, Math.round((faits / total) * 100)) : 0

  // Entraînements terminés de cette feuille, ref_exo dans la plage.
  const termines = historique.filter(
    (h) => feuilleId && h.feuille_entrainement?.id === feuilleId && h.ref_exo >= debut && h.ref_exo <= fin
  )
  const succes = termines.filter((h) => h.observation?.etat === 'succes').length
  const taux = termines.length > 0 ? Math.round((succes / termines.length) * 100) : null
  const temps = termines.reduce((s, h) => s + h.session.reduce((t, sess) => t + sess.temps_min, 0), 0)

  return (
    <tr
      className={`border-b border-border last:border-0 ${
        courante ? 'bg-accent-soft' : pair ? 'bg-surface' : 'bg-surface-2'
      }`}
    >
      {/* Feuille */}
      <td className="px-4 py-3 text-text-primary max-w-[220px]">
        <span className={`block truncate ${courante ? 'font-bold' : 'font-medium'}`}>
          {titre ?? 'Feuille introuvable'}
        </span>
        {(badge || restreinte) && (
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {badge && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ color: badge.couleur, background: badge.fond }}
              >
                {badge.texte}
              </span>
            )}
            {restreinte && (
              <span className="text-xs text-text-muted">
                ex. {debut}–{fin}
              </span>
            )}
          </span>
        )}
      </td>

      {/* Progression */}
      <td className="px-4 py-3">
        {acquise ? (
          <span className="block min-w-[120px] text-xs font-semibold text-success">
            Acquise · test de positionnement
          </span>
        ) : (
          <div className="space-y-1.5 min-w-[120px]">
            <span className="text-text-secondary text-xs">
              {faits} / {total} exercices
            </span>
            <div className="h-1 w-full rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </td>

      {/* Réussite */}
      <td className={`px-4 py-3 font-semibold ${taux === null ? 'text-text-muted' : couleurTaux(taux)}`}>
        {taux === null ? '—' : `${taux}%`}
      </td>

      {/* Correction */}
      <td className={`px-4 py-3 whitespace-nowrap ${aCorriger === 0 ? 'text-text-muted' : 'text-text-secondary'}`}>
        {aCorriger === 0 ? '—' : `${rattrapes} / ${aCorriger}`}
      </td>

      {/* Temps total */}
      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
        {termines.length > 0 && temps > 0 ? formatTemps(temps) : '—'}
      </td>
    </tr>
  )
}
