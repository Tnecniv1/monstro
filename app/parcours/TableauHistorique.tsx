'use client'

export type EntHistorique = {
  id: string
  date_creation: string
  ref_exo: number
  statut: string
  feuille_entrainement: {
    id: string
    titre: string
    volume: number
    noeud: { nom: string } | null
  } | null
  observation: { etat: string } | null
  session: { temps_min: number }[]
}

type LigneFeuille = {
  feuilleId: string
  titre: string
  volume: number
  exoFaits: number
  succes: number
  tempsTotal: number
  dernierDate: string
  isFocus: boolean
}

function formatTemps(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${h}h`
}

function couleurTaux(taux: number) {
  if (taux >= 80) return 'text-success'
  if (taux >= 50) return 'text-warning'
  return 'text-danger'
}

function grouperParFeuille(historique: EntHistorique[], focusIds: Set<string>): LigneFeuille[] {
  const map = new Map<string, LigneFeuille>()

  for (const e of historique) {
    const feuille = e.feuille_entrainement
    if (!feuille) continue

    const key = feuille.id
    const tempsEnt = e.session.reduce((s, sess) => s + sess.temps_min, 0)

    if (map.has(key)) {
      const ligne = map.get(key)!
      ligne.exoFaits += 1
      ligne.succes += e.observation?.etat === 'succes' ? 1 : 0
      ligne.tempsTotal += tempsEnt
      if (e.date_creation > ligne.dernierDate) ligne.dernierDate = e.date_creation
    } else {
      map.set(key, {
        feuilleId: key,
        titre: feuille.titre,
        volume: feuille.volume,
        exoFaits: 1,
        succes: e.observation?.etat === 'succes' ? 1 : 0,
        tempsTotal: tempsEnt,
        dernierDate: e.date_creation,
        isFocus: focusIds.has(key),
      })
    }
  }

  // 1. Focus d'abord (quel que soit leur état), dernierDate décroissante entre elles
  // 2. Puis terminées hors focus, dernierDate décroissante
  // 3. Puis non-terminées hors focus, dernierDate décroissante
  return Array.from(map.values()).sort((a, b) => {
    if (a.isFocus !== b.isFocus) return a.isFocus ? -1 : 1
    if (!a.isFocus) {
      const aTerminee = a.exoFaits >= a.volume
      const bTerminee = b.exoFaits >= b.volume
      if (aTerminee !== bTerminee) return aTerminee ? -1 : 1
    }
    return b.dernierDate.localeCompare(a.dernierDate)
  })
}

export default function TableauHistorique({
  historique,
  focusIds,
}: {
  historique: EntHistorique[]
  focusIds: Set<string>
}) {
  if (historique.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        Aucun entraînement terminé pour l&apos;instant.
      </p>
    )
  }

  const lignes = grouperParFeuille(historique, focusIds)

  return (
    <div className="max-h-[220px] overflow-y-auto overflow-x-auto border border-border rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2 text-left text-xs font-medium text-text-muted uppercase tracking-wide">
            <th className="sticky top-0 z-10 bg-surface-2 px-4 py-3">Feuille</th>
            <th className="sticky top-0 z-10 bg-surface-2 px-4 py-3">Progression</th>
            <th className="sticky top-0 z-10 bg-surface-2 px-4 py-3">Réussite</th>
            <th className="sticky top-0 z-10 bg-surface-2 px-4 py-3">Temps total</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => {
            const taux = Math.round((l.succes / l.exoFaits) * 100)
            const pct = Math.min(100, Math.round((l.exoFaits / l.volume) * 100))
            return (
              <tr
                key={l.feuilleId}
                className={`border-b border-border last:border-0 ${
                  i % 2 === 0 ? 'bg-surface' : 'bg-surface-2'
                }`}
              >
                {/* Feuille */}
                <td className="px-4 py-3 text-text-primary font-medium max-w-[180px]">
                  <span className="block truncate">{l.titre}</span>
                </td>

                {/* Progression */}
                <td className="px-4 py-3">
                  <div className="space-y-1.5 min-w-[120px]">
                    <span className="text-text-secondary text-xs">
                      {l.exoFaits} / {l.volume} exercices
                    </span>
                    <div className="h-1 w-full rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </td>

                {/* Réussite */}
                <td className={`px-4 py-3 font-semibold ${couleurTaux(taux)}`}>
                  {taux}%
                </td>

                {/* Temps total */}
                <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                  {l.tempsTotal > 0 ? formatTemps(l.tempsTotal) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
