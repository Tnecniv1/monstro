import Link from 'next/link'

export type EtatProchaineAction =
  // examen : étape examen (« Sujet n », « Examen · libellé ») ; libelle : son libellé.
  | { type: 'commencer'; feuilleId: string; titre: string; exo: number; examen: boolean; libelle: string | null }
  // Problème d'une feuille chaotique (lib/parcours/accompagnement.ts).
  | { type: 'chaotique'; feuilleId: string; titre: string; exo: number }
  // exo/titre : exercice en cours (lib/exerciceEnCours.ts), s'il est connu.
  | { type: 'en_cours'; exo?: number; titre?: string }
  | { type: 'termine' }
  | { type: 'aucune' }

// Couleurs du label « Problème chaotique », distinctes du violet du parcours.
const CHAOTIQUE_TEXTE = '#B8472A'
const CHAOTIQUE_FOND = '#FDEEE9'

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
          {etat.exo != null ? (
            <div className="space-y-0.5">
              <p className="text-xl font-extrabold text-text-primary">Exercice {etat.exo}</p>
              {etat.titre && <p className="truncate text-sm text-text-muted">{etat.titre}</p>}
            </div>
          ) : (
            <p className="text-xl font-extrabold text-text-primary">Entraînement en cours</p>
          )}
          <Link href="/entrainement" className={bouton}>
            Reprendre
          </Link>
        </>
      )}

      {etat.type === 'chaotique' && (
        <>
          <div className="space-y-1">
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
              style={{ color: CHAOTIQUE_TEXTE, background: CHAOTIQUE_FOND }}
            >
              Problème chaotique
            </span>
            <p className="truncate text-xl font-extrabold leading-snug text-text-primary">Problème {etat.exo}</p>
            <p className="truncate text-[13px] text-text-muted">{etat.titre}</p>
          </div>
          <Link
            href={`/entrainement?feuille=${encodeURIComponent(etat.feuilleId)}&exo=${etat.exo}`}
            className={bouton}
          >
            Commencer
          </Link>
        </>
      )}

      {etat.type === 'commencer' && (
        <>
          <div className="space-y-0.5">
            <p className="truncate text-xl font-extrabold leading-snug text-text-primary">
              {etat.examen ? 'Sujet' : 'Exercice'} {etat.exo}
            </p>
            <p className="truncate text-[13px] text-text-muted">
              {etat.examen ? `Examen · ${etat.libelle ?? etat.titre}` : etat.titre}
            </p>
          </div>
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
