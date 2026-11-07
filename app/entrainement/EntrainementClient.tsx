'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NouvelEntrainementButton from './NouvelEntrainementButton'
import NouvelEntrainementModal from './NouvelEntrainementModal'
import CarteEntrainement, { type Entrainement } from './CarteEntrainement'
import KanbanFeuilles from './KanbanFeuilles'

type Vue = 'liste' | 'kanban'

export default function EntrainementClient({
  userId,
  enCours,
  correctionEnCours,
  termines,
  canStartCorrection,
  preselection = null,
}: {
  userId: string
  enCours: Entrainement | null
  correctionEnCours: Entrainement | null
  termines: Entrainement[]
  canStartCorrection: boolean
  // ?feuille=&exo= reçus de l'accueil parcours (COMMENCER).
  preselection?: { feuilleId: string; exo: number } | null
}) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  // Gardée en état : l'URL est nettoyée dès l'ouverture, la prop repasse à null.
  const [modalPreselection, setModalPreselection] = useState<{ feuilleId: string; exo: number } | null>(null)

  // Au montage : modale pré-remplie si aucune activité en cours (même règle que
  // le bouton), puis URL nettoyée pour qu'un rechargement ne la rouvre pas.
  // Activité en cours : les paramètres sont ignorés.
  useEffect(() => {
    if (!preselection || enCours || correctionEnCours) return
    setModalPreselection(preselection)
    setModalOpen(true)
    router.replace('/entrainement')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [vue, setVue] = useState<Vue>('liste')

  return (
    <>
      {/* Titre + toggle Liste / Kanban */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-text-primary">Entraînements</h1>
        <div className="inline-flex rounded-lg bg-surface p-1 text-sm font-medium">
          <button
            onClick={() => setVue('liste')}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              vue === 'liste' ? 'bg-surface-2 border border-border-strong text-text-primary' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Liste
          </button>
          <button
            onClick={() => setVue('kanban')}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              vue === 'kanban' ? 'bg-surface-2 border border-border-strong text-text-primary' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Kanban
          </button>
        </div>
      </div>

      <NouvelEntrainementButton
        disabled={!!enCours || !!correctionEnCours}
        onOpen={() => { setModalPreselection(null); setModalOpen(true) }}
      />
      {modalOpen && (
        <NouvelEntrainementModal
          userId={userId}
          feuilleInitialeId={modalPreselection?.feuilleId}
          exoInitial={modalPreselection?.exo}
          onClose={() => { setModalOpen(false); setModalPreselection(null) }}
        />
      )}

      {vue === 'liste' ? (
        <>
          {/* Entraînement en cours */}
          {enCours && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                En cours
              </h2>
              <CarteEntrainement e={enCours} enCours />
            </section>
          )}

          {/* Correction en cours */}
          {correctionEnCours && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                Correction en cours
              </h2>
              <CarteEntrainement e={correctionEnCours} correctionEnCours canStartCorrection={false} />
            </section>
          )}

          {/* Historique */}
          {termines.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                Historique
              </h2>
              <div className="space-y-3">
                {termines.map((e) => (
                  <CarteEntrainement
                    key={e.id}
                    e={e}
                    canStartCorrection={canStartCorrection}
                  />
                ))}
              </div>
            </section>
          )}

          {termines.length === 0 && !enCours && !correctionEnCours && (
            <p className="text-center text-sm text-text-muted py-12">
              Aucun entraînement pour l&apos;instant.
            </p>
          )}
        </>
      ) : (
        <KanbanFeuilles userId={userId} />
      )}
    </>
  )
}
