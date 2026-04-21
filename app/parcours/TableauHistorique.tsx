'use client'

export type EntHistorique = {
  id: string
  date_creation: string
  ref_exo: number
  statut: string
  feuille_entrainement: {
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
}

function formatTemps(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${h}h`
}

function couleurTaux(taux: number) {
  if (taux >= 80) return 'text-green-600'
  if (taux >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

function grouperParFeuille(historique: EntHistorique[]): LigneFeuille[] {
  const map = new Map<string, LigneFeuille>()

  for (const e of historique) {
    const feuille = e.feuille_entrainement
    if (!feuille) continue

    // Utilise le titre comme clé de regroupement (feuille_entrainement n'a pas d'id exposé ici)
    const key = feuille.titre
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
      })
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.dernierDate.localeCompare(a.dernierDate)
  )
}

export default function TableauHistorique({ historique }: { historique: EntHistorique[] }) {
  if (historique.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        Aucun entraînement terminé pour l&apos;instant.
      </p>
    )
  }

  const lignes = grouperParFeuille(historique)

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
            <th className="px-4 py-3">Feuille</th>
            <th className="px-4 py-3">Progression</th>
            <th className="px-4 py-3">Réussite</th>
            <th className="px-4 py-3">Temps total</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => {
            const taux = Math.round((l.succes / l.exoFaits) * 100)
            const pct = Math.min(100, Math.round((l.exoFaits / l.volume) * 100))
            return (
              <tr
                key={l.feuilleId}
                className={`border-b border-gray-100 last:border-0 ${
                  i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                {/* Feuille */}
                <td className="px-4 py-3 text-gray-900 font-medium max-w-[180px]">
                  <span className="block truncate">{l.titre}</span>
                </td>

                {/* Progression */}
                <td className="px-4 py-3">
                  <div className="space-y-1.5 min-w-[120px]">
                    <span className="text-gray-700 text-xs">
                      {l.exoFaits} / {l.volume} exercices
                    </span>
                    <div className="h-1 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-black transition-all"
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
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
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
