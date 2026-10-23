'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { markScript1Ouvert } from '../onboarding/profileWrites'
import AvantScript1Modal from './AvantScript1Modal'
import ScriptsRow from './ScriptsRow'
import ScriptTextModal from './ScriptTextModal'
import ScriptPdfModal from './ScriptPdfModal'
import ForumTabs from './ForumTabs'
import TicketsPanel from './TicketsPanel'
import ProblemesGrille from './ProblemesGrille'
import EquipePanel from './EquipePanel'
import { useForumAttente } from '../components/ForumAttenteProvider'
import { PointAttente } from '../components/PastilleCompteur'
import { FILTRE_PROBLEMES_DEFAUT, TICKET_COLUMNS, TOPICS_MASQUES, forumProblemesHref, problemeHref } from './types'
import type { ActiveTopic, Feuille, FiltreProblemes, ForumOnglet, ForumResource, ForumScript, ForumTicket, ForumTopic, InitialTicket } from './types'

interface Props {
  scripts: ForumScript[]
  resources: ForumResource[]
  topicsSens: ForumTopic[]
  feuilles: Feuille[]
  focusIds: string[]
  script1Ouvert: boolean
  autoOpenScriptOrdre: number | null
  initialTicket: InitialTicket | null
  ouvrirEquipe: boolean
  initialFiltre: FiltreProblemes | null
  userId: string
  isAdmin: boolean
}

export default function ForumClient({
  scripts,
  resources,
  topicsSens,
  feuilles,
  focusIds,
  script1Ouvert: initialScript1Ouvert,
  autoOpenScriptOrdre,
  initialTicket,
  ouvrirEquipe,
  initialFiltre,
  userId,
  isAdmin,
}: Props) {
  // Scripts (citation + étapes) et ressources (PDF) ouvrent deux modals
  // différents — ScriptPdfModal reste inchangé, dédié aux ressources.
  const [openScript, setOpenScript] = useState<ForumScript | null>(null)
  const [openResource, setOpenResource] = useState<ForumResource | null>(null)

  // Onboarding (modal 3) : avant la toute première ouverture du Script 1
  // (ordre = 1) par un élève, un court modal s'intercale.
  const [script1Ouvert, setScript1Ouvert] = useState(initialScript1Ouvert)
  const [pendingScript1, setPendingScript1] = useState<ForumScript | null>(null)
  const [savingScript1, setSavingScript1] = useState(false)
  const [script1Error, setScript1Error] = useState(false)

  function selectScript(script: ForumScript) {
    if (script.ordre === 1 && !script1Ouvert && !isAdmin) {
      setPendingScript1(script)
      return
    }
    setOpenScript(script)
  }

  async function confirmScript1() {
    if (!pendingScript1) return
    setSavingScript1(true)
    setScript1Error(false)
    const result = await markScript1Ouvert(userId)
    setSavingScript1(false)
    // Écriture refusée ou 0 ligne : on ne continue pas le parcours.
    if (!result.ok) {
      setScript1Error(true)
      return
    }
    setScript1Ouvert(true)
    setOpenScript(pendingScript1)
    setPendingScript1(null)
  }

  // Onglet initial, par priorité : ?ticket=<id> (onglet du ticket),
  // ?script=N (Scripts), élève qui n'a pas encore ouvert le Script 1
  // (Scripts), sinon Questions — admin compris.
  const [activeTopic, setActiveTopic] = useState<ForumOnglet>(() => {
    if (initialTicket) return topicDuTicket(initialTicket, topicsSens)
    // ?onglet=equipe (compteur de jetons ADN de l'accueil)
    if (ouvrirEquipe) return { kind: 'equipe' }
    if (autoOpenScriptOrdre != null) return { kind: 'scripts' }
    // ?filtre= (retour depuis la page d'un problème)
    if (initialFiltre) return { kind: 'questions' }
    if (!initialScript1Ouvert && !isAdmin) return { kind: 'scripts' }
    return { kind: 'questions' }
  })
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(initialTicket?.id ?? null)

  // Filtre de la grille des problèmes (« Mes questions » par défaut), gardé
  // ici pour survivre aux changements d'onglet, et dans l'URL (?filtre=) sans
  // nouvel aller-retour serveur.
  const [filtre, setFiltre] = useState<FiltreProblemes>(initialFiltre ?? FILTRE_PROBLEMES_DEFAUT)
  function changerFiltre(nouveau: FiltreProblemes) {
    setFiltre(nouveau)
    window.history.replaceState(null, '', forumProblemesHref(nouveau))
  }

  // ?script=N : ouvre le script d'ordre N une seule fois, puis retire le
  // paramètre de l'URL pour qu'un rafraîchissement ne le rouvre pas
  // (history.replaceState : pas de nouvel aller-retour serveur).
  const autoOpenDone = useRef(false)
  useEffect(() => {
    if (autoOpenDone.current || autoOpenScriptOrdre == null) return
    autoOpenDone.current = true
    const script = scripts.find((s) => s.ordre === autoOpenScriptOrdre)
    if (script) selectScript(script)
    window.history.replaceState(null, '', '/forum')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenScriptOrdre])

  // Retire ?ticket= de l'URL (comme ?script=) : un rafraîchissement ne
  // force plus la sélection.
  useEffect(() => {
    if (initialTicket || ouvrirEquipe) window.history.replaceState(null, '', '/forum')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // "Mon ticket en cours" — accès rapide toujours visible, indépendant du
  // topic actif. Un non-admin ne peut en avoir qu'un (trigger DB), mais on
  // ne prend que le plus récent dans tous les cas.
  const [monTicket, setMonTicket] = useState<ForumTicket | null>(null)
  const [monTicketVersion, setMonTicketVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('forum_tickets')
      .select(TICKET_COLUMNS)
      .eq('user_id', userId)
      .neq('statut', 'ferme')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (cancelled) return
        const ticket = ((data ?? [])[0] as ForumTicket) ?? null
        // Ticket d'un topic masqué : pas d'accès rapide (son onglet n'existe plus).
        setMonTicket(ticket?.topic_id && TOPICS_MASQUES.includes(ticket.topic_id) ? null : ticket)
      })
    return () => {
      cancelled = true
    }
  }, [userId, monTicketVersion])

  // Questions en attente (pastille de l'onglet Questions, point de « Ton ticket en cours »).
  const { ids: enAttente, count: compteurQuestions } = useForumAttente()

  function refreshMonTicket() {
    setMonTicketVersion((v) => v + 1)
  }

  function selectTopic(topic: ForumOnglet) {
    setActiveTopic((prev) => (sameTopic(prev, topic) ? prev : topic))
    setSelectedTicketId(null)
  }

  function openMonTicket() {
    if (!monTicket) return
    const topic = topicDuTicket(monTicket, topicsSens)
    setActiveTopic((prev) => (sameTopic(prev, topic) ? prev : topic))
    setSelectedTicketId(monTicket.id)
  }

  const showResources = activeTopic.kind === 'sens' && activeTopic.displayMode === 'resources'

  // Question du forum : le bandeau mène à la page de son problème (question
  // Problème numérotée) ou à celle de la question ; ticket d'un topic de
  // sens : il s'ouvre dans son onglet.
  const monTicketHref = !monTicket || monTicket.topic_id != null
    ? null
    : monTicket.sujet === 'probleme' && monTicket.feuille_id && monTicket.numero_exercice != null
      ? problemeHref(monTicket.feuille_id, monTicket.numero_exercice)
      : `/forum/question/${monTicket.id}`
  const monTicketContenu = monTicket && (
    <>
      <span className="flex min-w-0 items-center gap-2">
        {enAttente.has(monTicket.id) && <PointAttente />}
        <span className="text-sm text-text-primary truncate">
          <span className="font-medium">Ton ticket en cours</span> — {monTicket.titre}
        </span>
      </span>
      <span className="text-xs font-medium text-accent shrink-0">Ouvrir →</span>
    </>
  )
  const monTicketClass =
    'w-full shrink-0 flex items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5 text-left hover:bg-accent/10 transition-colors'

  return (
    <div className="flex flex-col gap-7">
      {/* Titre (+ Suivi) à gauche, onglets à droite ; passe à la ligne sur
          petit écran. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-text-primary">Forum</h1>
          {isAdmin && (
            <Link
              href="/forum/suivi"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-2 transition-colors"
            >
              Suivi
            </Link>
          )}
        </div>
        <ForumTabs
          topicsSens={topicsSens}
          selected={activeTopic}
          onSelect={selectTopic}
          compteurQuestions={compteurQuestions}
        />
      </div>

      {monTicket &&
        (monTicketHref ? (
          <Link href={monTicketHref} className={monTicketClass}>
            {monTicketContenu}
          </Link>
        ) : (
          <button onClick={openMonTicket} className={monTicketClass}>
            {monTicketContenu}
          </button>
        ))}

      {/* Contenu de l'onglet, à sa hauteur naturelle : c'est la page qui défile. */}
      <div>
        {activeTopic.kind === 'scripts' ? (
          <ScriptsRow items={scripts} onSelect={selectScript} variant="grid" showNumber />
        ) : showResources ? (
          <ScriptsRow
            items={resources}
            onSelect={setOpenResource}
            variant="grid"
            emptyMessage="Aucune ressource pour l'instant."
          />
        ) : activeTopic.kind === 'equipe' ? (
          <EquipePanel userId={userId} isAdmin={isAdmin} />
        ) : activeTopic.kind === 'questions' ? (
          // Problèmes : grille des problèmes, la carte FAQ en tête (Méthode,
          // Application, anciennes questions sans numéro).
          <ProblemesGrille
            feuilles={feuilles}
            focusIds={focusIds}
            userId={userId}
            filtre={filtre}
            onFiltre={changerFiltre}
          />
        ) : (
          <TicketsPanel
            key={`sens:${activeTopic.id}`}
            activeTopic={activeTopic}
            userId={userId}
            isAdmin={isAdmin}
            hasOpenTicket={!!monTicket}
            feuilles={feuilles}
            focusIds={focusIds}
            scripts={scripts}
            selectedTicketId={selectedTicketId}
            onSelectTicket={setSelectedTicketId}
            onTicketsChanged={refreshMonTicket}
          />
        )}
      </div>

      {pendingScript1 && (
        <AvantScript1Modal saving={savingScript1} error={script1Error} onOk={confirmScript1} />
      )}
      {openScript && <ScriptTextModal script={openScript} onClose={() => setOpenScript(null)} />}
      {openResource && <ScriptPdfModal script={openResource} onClose={() => setOpenResource(null)} />}
    </div>
  )
}

// Onglet d'un ticket : son topic de sens, ou Questions (topic_id null, ou
// topic introuvable).
function topicDuTicket(ticket: Pick<ForumTicket, 'topic_id'> | null, topicsSens: ForumTopic[]): ActiveTopic {
  const t = ticket?.topic_id ? topicsSens.find((x) => x.id === ticket.topic_id) : undefined
  return t ? { kind: 'sens', id: t.id, nom: t.nom, displayMode: t.display_mode } : { kind: 'questions' }
}

function sameTopic(a: ForumOnglet, b: ForumOnglet): boolean {
  if (a.kind !== 'sens' || b.kind !== 'sens') return a.kind === b.kind
  return a.id === b.id
}
