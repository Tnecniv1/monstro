import type { ParcoursAccueil } from '@/lib/parcours/charger'
import { plageEtape, type Progression } from '@/lib/parcours/progression'
import { couleurTaux, formatTemps } from './format'
import type { EntHistorique } from './TableauHistorique'

const VERT = '#15803D'
const VERT_FOND = '#F0FDF4'

// Tableau « Parcours » de /parcours, pour un élève qui a un parcours : une
// ligne par étape, dans l'ordre. Progression = exercices distincts faits
// (succes, echec ou corrige) dans la plage, via calculerProgression comme
// l'accueil. Correction = rattrapés ÷ (rattrapés + échecs), « — » sans échec.
// Réussite et temps : mêmes formules que TableauHistorique, restreintes aux
// entraînements terminés dont le ref_exo est dans la plage (« — » sinon).
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
            const total = Math.max(0, fin - debut + 1)
            const faits = progression.faitsParEtape[i] ?? 0
            const rattrapes = progression.rattrapesParEtape[i] ?? 0
            const aCorriger = rattrapes + (progression.echecsParEtape[i] ?? 0)
            const pct = total > 0 ? Math.min(100, Math.round((faits / total) * 100)) : 0
            const restreinte = e.exo_debut != null || e.exo_fin != null
            const courante = i === progression.etapeCouranteIndex

            // Entraînements terminés de cette étape (feuille + ref_exo dans la plage).
            const termines = historique.filter(
              (h) => e.feuille_id && h.feuille_entrainement?.id === e.feuille_id && h.ref_exo >= debut && h.ref_exo <= fin
            )
            const succes = termines.filter((h) => h.observation?.etat === 'succes').length
            const taux = termines.length > 0 ? Math.round((succes / termines.length) * 100) : null
            const temps = termines.reduce((s, h) => s + h.session.reduce((t, sess) => t + sess.temps_min, 0), 0)

            return (
              <tr
                key={e.id}
                className={`border-b border-border last:border-0 ${
                  courante ? 'bg-accent-soft' : i % 2 === 0 ? 'bg-surface' : 'bg-surface-2'
                }`}
              >
                {/* Feuille */}
                <td className="px-4 py-3 text-text-primary max-w-[220px]">
                  <span className={`block truncate ${courante ? 'font-bold' : 'font-medium'}`}>
                    {e.titre ?? 'Feuille introuvable'}
                  </span>
                  {(e.type === 'examen' || restreinte) && (
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      {e.type === 'examen' && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{ color: VERT, background: VERT_FOND }}
                        >
                          Examen
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
                  <div className="space-y-1.5 min-w-[120px]">
                    <span className="text-text-secondary text-xs">
                      {faits} / {total} exercices
                    </span>
                    <div className="h-1 w-full rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
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
          })}
        </tbody>
      </table>
    </div>
  )
}
