import Link from 'next/link'

export type EtatProchaineAction =
  | { type: 'commencer'; feuilleId: string; titre: string; exo: number }
  | { type: 'en_cours' }
  | { type: 'termine' }
  | { type: 'aucune' }

const bouton =
  'block w-full rounded-2xl bg-accent py-4 text-center text-base font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-90'

// Carte « Prochaine action » de l'accueil parcours. COMMENCER mène à
// /entrainement?feuille=&exo=, qui ouvre la modale de création pré-remplie.
// Entraînement ou correction déjà en cours : REPRENDRE.
export default function ProchaineAction({ etat }: { etat: EtatProchaineAction }) {
  if (etat.type === 'aucune') return null

  return (
    <div className="w-full max-w-sm space-y-3 rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Prochaine action</p>

      {etat.type === 'termine' && <p className="text-xl font-extrabold text-text-primary">Parcours terminé</p>}

      {etat.type === 'en_cours' && (
        <>
          <p className="text-xl font-extrabold text-text-primary">Entraînement en cours</p>
          <Link href="/entrainement" className={bouton}>
            Reprendre
          </Link>
        </>
      )}

      {etat.type === 'commencer' && (
        <>
          <p className="text-xl font-extrabold leading-snug text-text-primary">
            {etat.titre} · exercice {etat.exo}
          </p>
          <Link
            href={`/entrainement?feuille=${encodeURIComponent(etat.feuilleId)}&exo=${etat.exo}`}
            className={bouton}
          >
            Commencer
          </Link>
        </>
      )}
    </div>
  )
}
