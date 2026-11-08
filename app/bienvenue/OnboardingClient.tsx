'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ETAPES_ONBOARDING, type EtapeOnboarding } from '@/lib/onboarding'
import { construireTest, estJuste, etapeDepart, prochaineQuestion, type Reponses } from '@/lib/parcours/positionnement'
import QcmTexte from '../components/QcmTexte'
import MathText from '../components/MathText'
import StationsParcours, { type Station } from '../components/accueil/StationsParcours'
import { markScript1Ouvert } from '../onboarding/profileWrites'
import type { ForumScriptEtape } from '../forum/types'

export type EtapeBienvenue = { id: string; ordre: number; type: 'feuille' | 'examen'; titre: string }

export type QuestionBienvenue = {
  // id de la ligne parcours_positionnement
  id: string
  qcm_question_id: string
  etape_id: string
  ordre: number
  reponses_correctes: string[] | null
  enonce: string
  choix: { id: string; texte: string }[]
  image_url: string | null
}

export type DonneesOnboarding =
  | { etape: null; erreur: string }
  | { etape: 'objectif'; erreur: string }
  | { etape: 'objectif'; parcours: { id: string; nom: string; description: string | null }[] }
  | { etape: 'positionnement'; erreur: string }
  | { etape: 'positionnement'; parcoursId: string; etapes: EtapeBienvenue[]; questions: QuestionBienvenue[] }
  | { etape: 'introduction'; erreur: string }
  | {
      etape: 'introduction'
      script: { titre: string; citation: string | null; etapes: ForumScriptEtape[] } | null
    }

const LIBELLES: Record<EtapeOnboarding, string> = {
  objectif: 'Objectif',
  positionnement: 'Positionnement',
  introduction: 'Introduction',
}

const ERREUR_ECRITURE = 'L’enregistrement a échoué. Vérifie ta connexion et réessaie.'

const btnAction =
  'h-14 w-full rounded-2xl bg-accent text-sm font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-40'

// Onboarding plein écran (sans barre d'onglets) : barre de progression en
// 3 segments, contenu, gros bouton d'action en bas. Largeur max 420 px.
export default function OnboardingClient({ userId, donnees }: { userId: string; donnees: DonneesOnboarding }) {
  const router = useRouter()
  return (
    <div className="flex min-h-dvh justify-center bg-bg">
      <div className="flex min-h-dvh w-full max-w-[420px] flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <EnTete etape={donnees.etape} />
        {'erreur' in donnees ? (
          <Erreur message={donnees.erreur} onReessayer={() => router.refresh()} />
        ) : donnees.etape === 'objectif' ? (
          <EtapeObjectif userId={userId} parcours={donnees.parcours} />
        ) : donnees.etape === 'positionnement' ? (
          <EtapePositionnement
            userId={userId}
            parcoursId={donnees.parcoursId}
            etapes={donnees.etapes}
            questions={donnees.questions}
          />
        ) : (
          <EtapeIntroduction userId={userId} script={donnees.script} />
        )}
      </div>
    </div>
  )
}

function EnTete({ etape }: { etape: EtapeOnboarding | null }) {
  const courant = etape ? ETAPES_ONBOARDING.indexOf(etape) : -1
  async function deconnecter() {
    await createClient().auth.signOut()
    window.location.assign('/')
  }
  return (
    <header className="mb-6 space-y-2">
      <div className="flex gap-1.5">
        {ETAPES_ONBOARDING.map((e, i) => (
          <div key={e} className="min-w-0 flex-1 space-y-1">
            <div className={`h-1.5 rounded-full ${i <= courant ? 'bg-accent' : 'bg-track'}`} />
            <p
              className={`truncate text-[11px] font-semibold ${
                i === courant ? 'text-accent' : i < courant ? 'text-text-secondary' : 'text-text-muted'
              }`}
            >
              {LIBELLES[e]}
            </p>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={deconnecter} className="text-xs text-text-muted hover:text-text-secondary">
          Se déconnecter
        </button>
      </div>
    </header>
  )
}

function Erreur({ message, onReessayer }: { message: string; onReessayer: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-text-primary">{message}</div>
      </div>
      <button type="button" onClick={onReessayer} className={btnAction}>
        Réessayer
      </button>
    </div>
  )
}

// Contenu défilant au-dessus d'un pied fixé en bas de l'écran.
function Ecran({ children, pied }: { children: React.ReactNode; pied: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-5 pb-4">{children}</div>
      <div className="sticky bottom-0 -mx-4 space-y-3 bg-bg px-4 pb-[max(0px,env(safe-area-inset-bottom))] pt-2">
        {pied}
      </div>
    </div>
  )
}

function Titre({ titre, sousTitre }: { titre: string; sousTitre?: string }) {
  return (
    <div className="space-y-1.5">
      <h1 className="text-2xl font-extrabold leading-tight text-text-primary">{titre}</h1>
      {sousTitre && <p className="text-sm text-text-secondary">{sousTitre}</p>}
    </div>
  )
}

function MessageErreur({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">{message}</p>
}

// ─── Étape 1 : Objectif ────────────────────────────────────────────────────

function EtapeObjectif({
  userId,
  parcours,
}: {
  userId: string
  parcours: { id: string; nom: string; description: string | null }[]
}) {
  const router = useRouter()
  const [choix, setChoix] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function continuer() {
    if (!choix) return
    setEnCours(true)
    setErreur(null)
    const { error } = await createClient().from('parcours_eleve').insert({
      user_id: userId,
      parcours_id: choix,
      created_at: new Date().toISOString(),
      etape_depart_id: null,
      positionnement_at: null,
      date_objectif: null,
    })
    if (error) {
      console.error('[bienvenue] objectif', error)
      setErreur(ERREUR_ECRITURE)
      setEnCours(false)
      return
    }
    router.refresh()
  }

  return (
    <Ecran
      pied={
        <>
          <MessageErreur message={erreur} />
          <button type="button" onClick={continuer} disabled={!choix || enCours} className={btnAction}>
            {enCours ? 'Enregistrement…' : erreur ? 'Réessayer' : 'Continuer'}
          </button>
        </>
      }
    >
      <Titre titre="Quel est ton objectif ?" sousTitre="Monstro construit ton parcours à partir de ton examen." />
      {parcours.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-text-muted">
          Aucun objectif n’est disponible pour le moment.
        </p>
      ) : (
        <ul className="space-y-3">
          {parcours.map((p) => {
            const actif = p.id === choix
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setChoix(p.id)}
                  aria-pressed={actif}
                  className={`w-full rounded-2xl px-4 py-4 text-left transition-colors ${
                    actif ? 'border-2 border-accent bg-accent-soft' : 'border border-border bg-surface hover:bg-surface-2'
                  }`}
                >
                  <span className={`block text-base font-bold ${actif ? 'text-accent' : 'text-text-primary'}`}>{p.nom}</span>
                  {p.description && <span className="mt-1 block text-sm text-text-secondary">{p.description}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Ecran>
  )
}

// ─── Étape 2 : Positionnement ──────────────────────────────────────────────

type Phase =
  | { nom: 'intro' }
  | { nom: 'questions' }
  | { nom: 'resultat'; departId: string | null; passe: boolean }

// Enregistre une réponse du test (positionnement_reponse) en arrière-plan :
// jamais attendue, un échec est seulement journalisé.
function journaliserReponse(ligne: {
  passage_id: string
  user_id: string
  parcours_id: string
  etape_id: string
  positionnement_id: string
  qcm_question_id: string
  choix: string[] | null
  juste: boolean
}) {
  try {
    createClient()
      .from('positionnement_reponse')
      .insert(ligne)
      .then(({ error }) => {
        if (error) console.error('[bienvenue] positionnement_reponse', error)
      })
  } catch (e) {
    console.error('[bienvenue] positionnement_reponse', e)
  }
}

// Identifiant d'un passage du test (crypto.randomUUID, repli si absent).
function nouveauPassage(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function EtapePositionnement({
  userId,
  parcoursId,
  etapes,
  questions,
}: {
  userId: string
  parcoursId: string
  etapes: EtapeBienvenue[]
  questions: QuestionBienvenue[]
}) {
  const router = useRouter()
  // Passage en cours (un par « Commencer le test ») : regroupe ses réponses.
  const [passageId, setPassageId] = useState<string | null>(null)
  const test = useMemo(() => construireTest(etapes, questions), [etapes, questions])
  const [phase, setPhase] = useState<Phase>({ nom: 'intro' })
  // Réponses en mémoire seulement : un élève qui quitte recommence le test.
  const [reponses, setReponses] = useState<Reponses>({})
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  // Écriture à refaire en cas d'échec (« Réessayer »).
  const [aEnregistrer, setAEnregistrer] = useState<{ departId: string | null; passe: boolean } | null>(null)

  const sansQuestion = questions.length === 0

  async function enregistrer(departId: string | null, passe: boolean) {
    setEnCours(true)
    setErreur(null)
    setAEnregistrer({ departId, passe })
    const maintenant = new Date().toISOString()
    const { data, error } = await createClient()
      .from('parcours_eleve')
      .update({ etape_depart_id: departId, positionnement_at: maintenant, updated_at: maintenant })
      .eq('user_id', userId)
      .select('user_id')
    setEnCours(false)
    if (error || !data || data.length === 0) {
      console.error('[bienvenue] positionnement', error ?? '0 ligne mise à jour')
      setErreur(ERREUR_ECRITURE)
      return false
    }
    setAEnregistrer(null)
    return true
  }

  // Parcours sans aucune question : pas de test, départ au début, étape 3.
  async function sauterSansTest() {
    if (await enregistrer(null, true)) router.refresh()
  }

  async function terminer(r: Reponses) {
    const departId = etapeDepart(test, r)
    if (await enregistrer(departId, false)) setPhase({ nom: 'resultat', departId, passe: false })
  }

  async function passer() {
    if (await enregistrer(null, true)) setPhase({ nom: 'resultat', departId: null, passe: true })
  }

  function commencer() {
    setReponses({})
    setPassageId(nouveauPassage())
    if (!prochaineQuestion(test, {})) terminer({})
    else setPhase({ nom: 'questions' })
  }

  function repondre(questionId: string, choix: string[] | null) {
    const question = questions.find((q) => q.id === questionId)
    if (question && passageId) {
      journaliserReponse({
        passage_id: passageId,
        user_id: userId,
        parcours_id: parcoursId,
        etape_id: question.etape_id,
        positionnement_id: question.id,
        qcm_question_id: question.qcm_question_id,
        choix,
        juste: estJuste(question, choix),
      })
    }
    const suivantes = { ...reponses, [questionId]: choix }
    setReponses(suivantes)
    if (!prochaineQuestion(test, suivantes)) terminer(suivantes)
  }

  async function reessayer() {
    if (!aEnregistrer) return
    if (sansQuestion) return sauterSansTest()
    if (await enregistrer(aEnregistrer.departId, aEnregistrer.passe))
      setPhase({ nom: 'resultat', departId: aEnregistrer.departId, passe: aEnregistrer.passe })
  }

  if (sansQuestion) {
    return (
      <Ecran
        pied={
          <>
            <MessageErreur message={erreur} />
            <button type="button" onClick={erreur ? reessayer : sauterSansTest} disabled={enCours} className={btnAction}>
              {enCours ? 'Enregistrement…' : erreur ? 'Réessayer' : 'Continuer'}
            </button>
          </>
        }
      >
        <Titre
          titre="Trouvons ton point de départ"
          sousTitre="Ton parcours n’a pas encore de test : tu commences au début. Si c’est trop facile, tu avanceras très vite."
        />
      </Ecran>
    )
  }

  if (phase.nom === 'resultat') {
    return <ResultatPositionnement etapes={etapes} departId={phase.departId} passe={phase.passe} />
  }

  if (phase.nom === 'questions') {
    const question = prochaineQuestion(test, reponses)
    const total = questions.length
    const repondues = Object.keys(reponses).length
    if (!question || erreur || enCours) {
      // Fin du test : enregistrement du départ (ou échec à réessayer).
      return (
        <Ecran
          pied={
            erreur ? (
              <>
                <MessageErreur message={erreur} />
                <button type="button" onClick={reessayer} disabled={enCours} className={btnAction}>
                  Réessayer
                </button>
              </>
            ) : null
          }
        >
          <p className="pt-10 text-center text-sm text-text-muted">Calcul de ton point de départ…</p>
        </Ecran>
      )
    }
    return (
      <QuestionTest
        key={question.id}
        question={question}
        numero={repondues + 1}
        progression={total > 0 ? repondues / total : 0}
        onRepondre={(choix) => repondre(question.id, choix)}
      />
    )
  }

  return (
    <Ecran
      pied={
        <>
          <MessageErreur message={erreur} />
          <button type="button" onClick={erreur ? reessayer : commencer} disabled={enCours} className={btnAction}>
            {enCours ? 'Enregistrement…' : erreur ? 'Réessayer' : 'Commencer le test'}
          </button>
          <button
            type="button"
            onClick={passer}
            disabled={enCours}
            className="block w-full py-1 text-center text-sm text-text-muted underline-offset-2 hover:underline disabled:opacity-40"
          >
            Passer, je commence au début du parcours
          </button>
        </>
      }
    >
      <Titre
        titre="Trouvons ton point de départ"
        sousTitre="Une dizaine de questions, 5 à 10 minutes. Si tu ne sais pas, réponds « Je ne sais pas » : c’est ce qui nous aide le plus à bien te placer."
      />
      <div className="rounded-2xl border border-border bg-surface p-4 text-sm font-semibold text-text-primary">
        Ce n’est pas une note.
      </div>
    </Ecran>
  )
}

function QuestionTest({
  question,
  numero,
  progression,
  onRepondre,
}: {
  question: QuestionBienvenue
  numero: number
  progression: number
  onRepondre: (choix: string[] | null) => void
}) {
  const multiple = (question.reponses_correctes?.length ?? 0) > 1
  const [coches, setCoches] = useState<string[]>([])

  function basculer(id: string) {
    setCoches((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  }

  const btnChoix = 'w-full rounded-2xl border px-4 py-3.5 text-left text-sm transition-colors'

  return (
    <Ecran
      pied={
        multiple ? (
          <button type="button" onClick={() => onRepondre(coches)} disabled={coches.length === 0} className={btnAction}>
            Valider
          </button>
        ) : null
      }
    >
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Question {numero}</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-track">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(progression * 100)}%` }} />
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <div className="text-base leading-relaxed text-text-primary">
          <QcmTexte text={question.enonce} />
        </div>
        {question.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={question.image_url} alt="" className="mx-auto max-h-64 rounded-lg" />
        )}
      </div>

      {multiple && <p className="text-xs font-semibold text-text-muted">Plusieurs réponses possibles</p>}

      <ul className="space-y-2">
        {question.choix.map((c) => {
          const coche = coches.includes(c.id)
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => (multiple ? basculer(c.id) : onRepondre([c.id]))}
                aria-pressed={multiple ? coche : undefined}
                className={`${btnChoix} flex items-start gap-3 ${
                  coche ? 'border-2 border-accent bg-accent-soft' : 'border-border bg-surface hover:bg-surface-2'
                }`}
              >
                {multiple && (
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${
                      coche ? 'border-accent bg-accent text-white' : 'border-border-strong bg-surface'
                    }`}
                  >
                    {coche ? '✓' : ''}
                  </span>
                )}
                <span className="min-w-0 text-text-primary">
                  <QcmTexte text={c.texte} />
                </span>
              </button>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            onClick={() => onRepondre(null)}
            className={`${btnChoix} border-dashed border-border-strong bg-surface text-center font-semibold text-text-secondary hover:bg-surface-2`}
          >
            Je ne sais pas
          </button>
        </li>
      </ul>
    </Ecran>
  )
}

function ResultatPositionnement({
  etapes,
  departId,
  passe,
}: {
  etapes: EtapeBienvenue[]
  departId: string | null
  passe: boolean
}) {
  const router = useRouter()
  const [enCours, setEnCours] = useState(false)
  const depart = departId ? etapes.find((e) => e.id === departId) ?? null : null
  const indexDepart = depart ? etapes.indexOf(depart) : 0
  const acquises = depart ? etapes.filter((e) => e.ordre < depart.ordre).length : 0

  const stations: Station[] = etapes.map((e, i) => ({
    id: e.id,
    libelle: e.titre,
    examen: e.type === 'examen',
    statut: depart && e.ordre < depart.ordre ? 'fait' : i === indexDepart ? 'courant' : 'a_venir',
  }))

  return (
    <Ecran
      pied={
        <button
          type="button"
          onClick={() => {
            setEnCours(true)
            router.refresh()
          }}
          disabled={enCours}
          className={btnAction}
        >
          Continuer
        </button>
      }
    >
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Ton point de départ</p>
        {depart && !passe ? (
          <>
            <h1 className="text-2xl font-extrabold leading-tight text-text-primary">Tu commences au {depart.titre}</h1>
            {acquises > 0 && <p className="text-sm text-text-secondary">Les étapes d’avant sont considérées comme acquises.</p>}
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold leading-tight text-text-primary">Tu commences au début de ton parcours.</h1>
            <p className="text-sm text-text-secondary">Si c’est trop facile, tu avanceras très vite.</p>
          </>
        )}
      </div>
      {stations.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <StationsParcours stations={stations} />
        </div>
      )}
    </Ecran>
  )
}

// ─── Étape 3 : Introduction ────────────────────────────────────────────────

function EtapeIntroduction({
  userId,
  script,
}: {
  userId: string
  script: { titre: string; citation: string | null; etapes: ForumScriptEtape[] } | null
}) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function compris() {
    setEnCours(true)
    setErreur(null)
    const r = await markScript1Ouvert(userId)
    if (!r.ok) {
      setErreur(ERREUR_ECRITURE)
      setEnCours(false)
      return
    }
    // Rechargement complet : le middleware et l'accueil relisent l'état.
    window.location.assign('/')
  }

  return (
    <Ecran
      pied={
        <>
          <MessageErreur message={erreur} />
          <button type="button" onClick={compris} disabled={enCours} className={btnAction}>
            {enCours ? 'Enregistrement…' : erreur ? 'Réessayer' : 'J’ai compris'}
          </button>
        </>
      }
    >
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">La méthode · Script #1</p>
        <h1 className="text-2xl font-extrabold leading-tight text-text-primary">
          {script ? <MathText text={script.titre} /> : 'La structure d’un entraînement'}
        </h1>
      </div>

      {script?.citation && (
        <blockquote className="border-l-2 border-accent pl-3 text-sm italic leading-relaxed text-text-secondary">
          <MathText text={script.citation} />
        </blockquote>
      )}

      {script && script.etapes.length > 0 ? (
        <ol className="space-y-3">
          {script.etapes.map((e, i) => (
            <li key={i} className="flex gap-3 rounded-2xl border border-border bg-surface p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                {i + 1}
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-bold text-text-primary">
                  <MathText text={e.titre} />
                </p>
                <p className="text-sm leading-relaxed text-text-secondary">
                  <MathText text={e.description} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        !script && (
          <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-text-muted">
            Sur l’accueil, appuie sur COMMENCER : Monstro choisit pour toi la feuille et l’exercice.
          </p>
        )
      )}
    </Ecran>
  )
}
