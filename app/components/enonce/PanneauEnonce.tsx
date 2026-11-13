'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { ExerciceEnCours } from '@/lib/exerciceEnCours'
import { PageSeule, PagesDefilantes, useDocumentPdf } from './DocumentPdf'
import VoletForum from './VoletForum'

type Onglet = 'enonce' | 'correction' | 'forum'
type OngletDocument = Exclude<Onglet, 'forum'>

const LIBELLES: Record<Onglet, string> = { enonce: 'Énoncé', correction: 'Correction', forum: 'Forum' }

// Glissement vers le bas au-delà duquel le panneau se ferme.
const SEUIL_FERMETURE = 100

// Panneau de l'énoncé flottant (chargé à la demande par EnonceFlottant) :
// téléphone, panneau qui monte du bas (85 % de la hauteur) ; écran large,
// panneau latéral à droite (480 px). Énoncé | Correction : l'exercice seul en
// texte s'il est transcrit (feuille publiée, lib/exerciceTexte.ts), avec en
// bas la feuille et « Voir la feuille entière » ; sinon le PDF de la feuille
// page par page (pdf.js). Plein écran, J'AI FINI · REPRENDRE. Forum : question
// de l'élève sur l'exercice (VoletForum), badge des non-lus, ni texte ni PDF.
// Fermeture : glisser
// vers le bas (poignée, en-tête), chevron, ou toucher le fond assombri.
export default function PanneauEnonce({
  exercice,
  userId,
  nbNonLus,
  ongletInitial = 'enonce',
  onFermer,
}: {
  exercice: ExerciceEnCours
  userId: string
  nbNonLus: number
  ongletInitial?: Onglet
  onFermer: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [onglet, setOnglet] = useState<Onglet>(ongletInitial)
  // Document du dernier volet Énoncé / Correction : gardé chargé pendant le
  // volet Forum, pour le retrouver tel quel.
  const [ongletDoc, setOngletDoc] = useState<OngletDocument>('enonce')
  const forum = onglet === 'forum'
  const [pleinEcran, setPleinEcran] = useState(false)
  // Exercice en texte : « Voir la feuille entière » bascule sur le PDF.
  const [feuilleEntiere, setFeuilleEntiere] = useState(false)
  const [page, setPage] = useState(1)
  const [decalage, setDecalage] = useState(0)
  const departY = useRef<number | null>(null)

  // Énoncé / Correction du dernier volet document (inchangé pendant le Forum).
  const html = ongletDoc === 'enonce' ? exercice.enonceHtml : exercice.correctionHtml
  const modeTexte = html !== null && !feuilleEntiere
  // PDF du volet ; pour la feuille entière depuis une correction en texte
  // sans PDF de correction, celui de l'énoncé.
  const urlPdf =
    ongletDoc === 'enonce' ? exercice.enonceUrl : exercice.correctionUrl ?? (html !== null ? exercice.enonceUrl : null)
  // Pas de PDF chargé tant que l'exercice est affiché en texte ; un PDF déjà
  // affiché reste chargé pendant le volet Forum.
  const url = modeTexte ? null : urlPdf
  const { doc: docCharge, erreur, reessayer } = useDocumentPdf(url)
  // useDocumentPdf garde le dernier document quand url passe à null.
  const doc = url ? docCharge : null
  const nbPages = doc?.numPages ?? null
  const correctionDisponible = exercice.correctionUrl !== null || exercice.correctionHtml !== null

  // Changement de document : retour à la page 1.
  useEffect(() => setPage(1), [url])

  // Pas de défilement de la page derrière le panneau.
  useEffect(() => {
    const avant = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = avant
    }
  }, [])

  // Échap : quitte le plein écran, sinon ferme le panneau.
  useEffect(() => {
    function touche(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (pleinEcran) setPleinEcran(false)
      else onFermer()
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [pleinEcran, onFermer])

  const surPageVisible = useCallback((p: number) => setPage(p), [])

  function reprendre() {
    onFermer()
    if (pathname === '/entrainement') window.scrollTo({ top: 0, behavior: 'smooth' })
    else router.push('/entrainement')
  }

  // Glisser vers le bas depuis la poignée ou l'en-tête.
  const glisser = {
    onTouchStart: (e: React.TouchEvent) => {
      departY.current = e.touches[0].clientY
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (departY.current === null) return
      setDecalage(Math.max(0, e.touches[0].clientY - departY.current))
    },
    onTouchEnd: () => {
      const fermer = decalage > SEUIL_FERMETURE
      departY.current = null
      setDecalage(0)
      if (fermer) onFermer()
    },
  }

  const libelleOnglet = LIBELLES[ongletDoc]

  // Énoncé ou Correction : retour à l'exercice (texte) ; le Forum ne change
  // pas le volet document.
  function choisirOnglet(o: Onglet) {
    setOnglet(o)
    if (o === 'forum') return
    setOngletDoc(o)
    setFeuilleEntiere(false)
  }

  if (pleinEcran && modeTexte) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-surface">
        <div className="flex items-center gap-3 border-b border-border px-3 py-2" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
          <button
            type="button"
            onClick={() => setPleinEcran(false)}
            aria-label="Revenir au panneau"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-text-secondary hover:bg-surface-2"
          >
            <IconeRetour />
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">{`Exercice ${exercice.exo} · ${libelleOnglet}`}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
          <TexteExercice html={html ?? ''} grand />
        </div>
      </div>
    )
  }

  if (pleinEcran) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#2A2A2E' }}>
        <div className="flex items-center gap-3 px-3 py-2 text-white" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
          <button
            type="button"
            onClick={() => setPleinEcran(false)}
            aria-label="Revenir au panneau"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20"
          >
            <IconeRetour />
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{`Exercice ${exercice.exo} · ${libelleOnglet}`}</p>
        </div>
        <div className="flex-1 overflow-auto px-2 py-2" style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
          {doc ? (
            <PageSeule doc={doc} numero={page} />
          ) : (
            <Etat erreur={erreur} onReessayer={reessayer} sombre />
          )}
        </div>
        <div
          className="flex items-center justify-center gap-4 px-3 py-3 text-white"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="Page précédente"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30"
          >
            ←
          </button>
          <span className="min-w-[90px] text-center text-sm tabular-nums">
            Page {page} / {nbPages ?? '…'}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => (nbPages ? Math.min(nbPages, p + 1) : p))}
            disabled={!nbPages || page >= nbPages}
            aria-label="Page suivante"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30"
          >
            →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Exercice ${exercice.exo}`}>
      {/* Fond assombri : toucher ferme. */}
      <button type="button" aria-label="Fermer" onClick={onFermer} className="absolute inset-0 h-full w-full bg-black/50" />

      <div
        className="absolute inset-x-0 bottom-0 flex h-[85dvh] flex-col rounded-t-[22px] bg-surface shadow-2xl md:inset-x-auto md:inset-y-0 md:right-0 md:h-full md:w-[480px] md:rounded-none md:rounded-l-[22px]"
        style={{ transform: decalage ? `translateY(${decalage}px)` : undefined, transition: decalage ? 'none' : 'transform 0.2s' }}
      >
        {/* Poignée et en-tête : on glisse vers le bas pour fermer. */}
        <div {...glisser} className="shrink-0 px-4 pt-2">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-gray-300 md:hidden" />
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-2xl font-extrabold leading-tight text-text-primary">Exercice {exercice.exo}</p>
              <p className="truncate text-sm text-text-muted">{exercice.titre}</p>
            </div>
            <button
              type="button"
              onClick={() => setPleinEcran(true)}
              disabled={forum || (!modeTexte && !url)}
              aria-label="Plein écran"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-lg text-text-secondary hover:bg-surface-2 disabled:opacity-30"
            >
              ⤢
            </button>
            <button
              type="button"
              onClick={onFermer}
              aria-label="Réduire"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-text-secondary hover:bg-surface-2"
            >
              <Chevron sens="bas" />
            </button>
          </div>

          {/* Énoncé | Correction | Forum */}
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl p-1" style={{ background: '#F3F4F6' }}>
            {(['enonce', 'correction', 'forum'] as const).map((o) => {
              const indisponible = o === 'correction' && !correctionDisponible
              const actif = onglet === o
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => !indisponible && choisirOnglet(o)}
                  disabled={indisponible}
                  aria-pressed={actif}
                  aria-label={o === 'forum' && nbNonLus > 0 ? `Forum, ${nbNonLus} non lu${nbNonLus > 1 ? 's' : ''}` : undefined}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors ${
                    actif ? 'bg-white text-text-primary shadow-sm' : 'text-text-muted'
                  } ${indisponible ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  {LIBELLES[o]}
                  {o === 'forum' && nbNonLus > 0 && (
                    <span
                      aria-hidden
                      className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none text-white"
                      style={{ background: '#DC2626' }}
                    >
                      {nbNonLus}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {!correctionDisponible && !forum && (
            <p className="mt-1 text-center text-xs text-text-muted">Pas de correction pour cette feuille</p>
          )}
        </div>

        {forum ? (
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            <VoletForum exercice={exercice} userId={userId} />
          </div>
        ) : (
          <>
            {modeTexte ? (
              // Exercice seul, en texte ; en bas, la feuille et son PDF.
              <div className="mt-3 min-h-0 flex-1 overflow-y-auto border-t border-border px-4 py-4">
                <TexteExercice html={html ?? ''} />
                <div className="mt-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border pt-3">
                  <span className="min-w-0 truncate text-xs text-text-muted">{exercice.titre}</span>
                  {urlPdf && (
                    <button
                      type="button"
                      onClick={() => setFeuilleEntiere(true)}
                      className="-mr-2 inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-accent hover:underline"
                    >
                      Voir la feuille entière
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {html !== null && (
                  <button
                    type="button"
                    onClick={() => setFeuilleEntiere(false)}
                    className="mx-4 mt-2 inline-flex min-h-[44px] items-center self-start px-0 text-sm font-semibold text-accent hover:underline"
                  >
                    ‹ Retour à l’exercice
                  </button>
                )}
                {/* Document */}
                <div className="relative mt-3 min-h-0 flex-1 overflow-y-auto bg-surface-2 px-3 py-3" style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
                  {!url ? (
                    <p className="py-10 text-center text-sm text-text-muted">Pas de document pour cette feuille.</p>
                  ) : doc ? (
                    // pageInitiale : au retour du plein écran, la page qu'on y lisait.
                    <PagesDefilantes key={url} doc={doc} pageInitiale={page} onPageVisible={surPageVisible} />
                  ) : (
                    <Etat erreur={erreur} onReessayer={reessayer} />
                  )}
                </div>
                {doc && (
                  <p className="shrink-0 py-1 text-center text-xs tabular-nums text-text-muted">
                    page {page} / {nbPages}
                  </p>
                )}
              </>
            )}

            <div className="shrink-0 px-4 pb-3 pt-1" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
              <button
                type="button"
                onClick={reprendre}
                className="block w-full rounded-2xl bg-accent py-4 text-center text-base font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-90"
              >
                J’ai fini · Reprendre
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// HTML rendu côté serveur depuis la table exercice (lib/exerciceTexte.ts,
// HTML brut du Markdown ignoré). Formules centrées trop larges : défilement.
function TexteExercice({ html, grand = false }: { html: string; grand?: boolean }) {
  return (
    <div
      className={`prose max-w-none text-text-primary prose-p:text-text-primary prose-strong:text-text-primary prose-pre:text-sm [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden ${
        grand ? 'prose-lg' : 'prose-sm sm:prose-base'
      }`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function Etat({ erreur, onReessayer, sombre = false }: { erreur: string | null; onReessayer: () => void; sombre?: boolean }) {
  if (!erreur) {
    return <p className={`py-10 text-center text-sm ${sombre ? 'text-white/70' : 'text-text-muted'}`}>Chargement du document…</p>
  }
  return (
    <div className="space-y-3 py-10 text-center">
      <p className={`text-sm ${sombre ? 'text-white' : 'text-danger'}`}>{erreur}</p>
      <button
        type="button"
        onClick={onReessayer}
        className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${sombre ? 'bg-white/10 text-white' : 'border border-border text-text-secondary'}`}
      >
        Réessayer
      </button>
    </div>
  )
}

export function Chevron({ sens }: { sens: 'haut' | 'bas' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={sens === 'haut' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  )
}

function IconeRetour() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}
