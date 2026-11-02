'use client'

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import PastilleCompteur from '../../components/PastilleCompteur'
import { formatHeure, formatJourDate, jourParis } from '../relativeTime'
import {
  chargerConversationsAction,
  envoyerReponseAction,
  marquerConversationLueAction,
  synchroniserTwilioAction,
  type ConversationWhatsApp,
  type MessageWhatsApp,
} from './conversationActions'

// Codes de referent.relation (formulaire Agora, plus les anciennes valeurs parent et autre)
const RELATIONS: Record<string, string> = {
  pere: 'Père',
  mere: 'Mère',
  frere: 'Frère',
  soeur: 'Sœur',
  parrain: 'Parrain',
  marraine: 'Marraine',
  ami: 'Ami',
  oncle: 'Oncle',
  tante: 'Tante',
  coach_sport: 'Coach de sport',
  parent: 'Parent',
  autre: 'Proche',
}

// WhatsApp : réponse libre possible 24 h après le dernier message du parent
const FENETRE_MS = 24 * 3_600_000
// Zone de réponse : auto-agrandissement jusqu'à ~5 lignes (text-sm, py-2, bordure)
const HAUTEUR_MAX_TEXTAREA = 120

// 33612345678 → « +33 6 12 34 56 78 » ; autres pays : « + » et les chiffres tels quels
function telephoneLisible(t: string): string {
  if (/^33\d{9}$/.test(t)) return `+33 ${t[2]} ${t.slice(3).replace(/(\d{2})(?=\d)/g, '$1 ')}`
  return `+${t}`
}

function nomAffiche(c: ConversationWhatsApp): string {
  return [c.suiveur?.prenom, c.suiveur?.nom].filter(Boolean).join(' ') || telephoneLisible(c.telephone)
}

// « Mère de Lucas », « Ami d'Alice », « Numéro inconnu »
function sousTitre(c: ConversationWhatsApp): string {
  if (!c.suiveur) return 'Numéro inconnu'
  const eleves = c.suiveur.eleves.join(', ')
  if (c.suiveur.relation === 'moi') return eleves ? `${eleves} (élève)` : 'Élève'
  const relation = RELATIONS[c.suiveur.relation ?? ''] ?? 'Suiveur'
  if (!eleves) return relation
  return /^[aeiouyàâéèêëîïôöûü]/i.test(eleves) ? `${relation} d'${eleves}` : `${relation} de ${eleves}`
}

function libelleMedia(type: string | null): string | null {
  if (!type) return null
  if (type.startsWith('image/')) return 'Photo'
  if (type.startsWith('audio/')) return 'Note vocale'
  return 'Pièce jointe'
}

function apercu(m: MessageWhatsApp): string {
  const texte = m.contenu?.trim() || libelleMedia(m.media_type) || (m.rapport_url ? 'Rapport' : '')
  return m.sens === 'sortant' ? `Vous : ${texte}` : texte
}

function nonLus(c: ConversationWhatsApp): number {
  return c.messages.filter((m) => m.sens === 'entrant' && !m.lu_le).length
}

function joursDepuis(jour: string): number {
  return Math.round((Date.parse(jourParis(new Date().toISOString())) - Date.parse(jour)) / 86_400_000)
}

// Heure de la liste : « 14:32 », « hier », « lun. », sinon « 28/10 » (heure de Paris)
function heureListe(iso: string): string {
  const diffJ = joursDepuis(jourParis(iso))
  if (diffJ <= 0) return formatHeure(iso)
  if (diffJ === 1) return 'hier'
  const options: Intl.DateTimeFormatOptions =
    diffJ < 7 ? { weekday: 'short' } : { day: '2-digit', month: '2-digit' }
  return new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', ...options })
}

// Séparateur du fil : « Aujourd'hui », « Hier », sinon « Dimanche 1 novembre »
function separateurJour(jour: string): string {
  const diffJ = joursDepuis(jour)
  if (diffJ === 0) return "Aujourd'hui"
  if (diffJ === 1) return 'Hier'
  return formatJourDate(`${jour}T12:00:00Z`)
}

function fenetreReponse(messages: MessageWhatsApp[]): { ouverte: boolean; texte: string } {
  const dernier = messages.findLast((m) => m.sens === 'entrant')
  const reste = dernier ? Date.parse(dernier.created_at) + FENETRE_MS - Date.now() : 0
  if (reste <= 0) return { ouverte: false, texte: 'Fenêtre fermée : le parent doit écrire en premier.' }
  const heures = Math.floor(reste / 3_600_000)
  return { ouverte: true, texte: `Réponse possible encore ${heures < 1 ? "moins d'1" : heures} h` }
}

// Monté à l'ouverture de l'onglet Conversation : charge toutes les conversations
// (pas de temps réel) et tient à jour la pastille du toggle via onNonLusChange.
export default function ConversationView({ onNonLusChange }: { onNonLusChange: Dispatch<SetStateAction<number>> }) {
  const [conversations, setConversations] = useState<ConversationWhatsApp[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [selection, setSelection] = useState<string | null>(null)
  const [imageAgrandie, setImageAgrandie] = useState<string | null>(null)
  const [synchronisation, setSynchronisation] = useState(false)
  const [retourSync, setRetourSync] = useState<{ texte: string; erreur: boolean } | null>(null)
  // Brouillon de réponse propre à chaque numéro : changer de conversation ne le mélange pas
  const [brouillons, setBrouillons] = useState<Record<string, string>>({})

  // Conversations fraîches : la pastille du toggle repart du total recalculé
  const appliquer = useCallback(
    (r: { conversations: ConversationWhatsApp[]; erreur: string | null }) => {
      setErreur(r.erreur)
      setConversations(r.conversations)
      onNonLusChange(r.conversations.reduce((t, c) => t + nonLus(c), 0))
    },
    [onNonLusChange],
  )

  useEffect(() => {
    let actif = true
    chargerConversationsAction()
      .then((r) => {
        if (actif) appliquer(r)
      })
      .catch((e) => {
        if (!actif) return
        setErreur(e instanceof Error ? e.message : String(e))
        setConversations([])
      })
    return () => {
      actif = false
    }
  }, [appliquer])

  // Import des messages Twilio manquants, puis rechargement des conversations
  async function synchroniser() {
    setSynchronisation(true)
    setRetourSync(null)
    try {
      const { resume, erreur } = await synchroniserTwilioAction()
      if (!resume) {
        setRetourSync({ texte: erreur ?? 'Synchronisation impossible.', erreur: true })
        return
      }
      const n = resume.entrantsImportes + resume.sortantsImportes
      setRetourSync({ texte: n === 0 ? 'Déjà à jour' : `${n} message${n > 1 ? 's' : ''} importé${n > 1 ? 's' : ''}`, erreur: false })
      appliquer(await chargerConversationsAction())
    } catch (e) {
      setRetourSync({ texte: e instanceof Error ? e.message : String(e), erreur: true })
    } finally {
      setSynchronisation(false)
    }
  }

  useEffect(() => {
    if (!imageAgrandie) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setImageAgrandie(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [imageAgrandie])

  // Ouvrir une conversation marque lus ses messages entrants, puis met à jour
  // la ligne et la pastille du toggle sans recharger.
  async function ouvrir(c: ConversationWhatsApp) {
    setSelection(c.telephone)
    const compte = nonLus(c)
    if (compte === 0) return
    const r = await marquerConversationLueAction(c.telephone)
    if (r.erreur || !r.lu_le) {
      setErreur(r.erreur)
      return
    }
    const lu_le = r.lu_le
    setConversations(
      (prev) =>
        prev &&
        prev.map((x) =>
          x.telephone !== c.telephone
            ? x
            : { ...x, messages: x.messages.map((m) => (m.sens === 'entrant' && !m.lu_le ? { ...m, lu_le } : m)) },
        ),
    )
    onNonLusChange((n) => Math.max(0, n - compte))
  }

  // Réponse envoyée : bulle ajoutée au fil, conversation remontée en tête, brouillon vidé
  function ajouterReponse(telephone: string, message: MessageWhatsApp) {
    setConversations((prev) => {
      const cible = prev?.find((c) => c.telephone === telephone)
      if (!prev || !cible) return prev
      return [{ ...cible, messages: [...cible.messages, message] }, ...prev.filter((c) => c.telephone !== telephone)]
    })
    setBrouillons((b) => ({ ...b, [telephone]: '' }))
  }

  if (conversations == null) {
    return (
      <section className="rounded-2xl border border-border bg-surface">
        <ul className="divide-y divide-border animate-pulse md:w-80">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="space-y-2 px-4 py-3">
              <span className="block h-4 w-2/3 rounded bg-surface-2" />
              <span className="block h-3 w-1/2 rounded bg-surface-2" />
            </li>
          ))}
        </ul>
      </section>
    )
  }

  const courante = conversations.find((c) => c.telephone === selection) ?? null

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-end gap-3 border-b border-border px-4 py-2">
        {retourSync && (
          <p className={`min-w-0 truncate text-xs ${retourSync.erreur ? 'text-danger' : 'text-text-muted'}`}>{retourSync.texte}</p>
        )}
        <button
          type="button"
          onClick={synchroniser}
          disabled={synchronisation}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-2 disabled:opacity-50 transition-colors"
        >
          <IconeRafraichir className={`h-3.5 w-3.5 ${synchronisation ? 'animate-spin' : ''}`} />
          {synchronisation ? 'Synchronisation…' : 'Synchroniser avec Twilio'}
        </button>
      </div>

      {erreur &&<p className="border-b border-border px-4 py-3 text-sm text-danger">Erreur : {erreur}</p>}

      {conversations.length === 0 ? (
        !erreur && <p className="px-4 py-12 text-center text-sm text-text-muted">Aucune conversation pour l&apos;instant.</p>
      ) : (
        <div className="grid h-[70vh] min-h-[480px] md:grid-cols-[320px_1fr]">
          <ul className={`min-h-0 divide-y divide-border overflow-y-auto md:block md:border-r md:border-border ${courante ? 'hidden' : ''}`}>
            {conversations.map((c) => (
              <LigneConversation
                key={c.telephone}
                conversation={c}
                active={c.telephone === selection}
                onOuvrir={() => ouvrir(c)}
              />
            ))}
          </ul>

          {courante ? (
            <Fil
              key={courante.telephone}
              conversation={courante}
              onRetour={() => setSelection(null)}
              onAgrandir={setImageAgrandie}
              brouillon={brouillons[courante.telephone] ?? ''}
              onBrouillon={(texte) => setBrouillons((b) => ({ ...b, [courante.telephone]: texte }))}
              onEnvoye={(m) => ajouterReponse(courante.telephone, m)}
            />
          ) : (
            <div className="hidden items-center justify-center bg-bg text-sm text-text-muted md:flex">
              Sélectionne une conversation.
            </div>
          )}
        </div>
      )}

      {imageAgrandie && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setImageAgrandie(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image agrandie"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageAgrandie} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </section>
  )
}

function LigneConversation({
  conversation: c,
  active,
  onOuvrir,
}: {
  conversation: ConversationWhatsApp
  active: boolean
  onOuvrir: () => void
}) {
  const dernier = c.messages[c.messages.length - 1]
  const compte = nonLus(c)
  return (
    <li>
      <button
        type="button"
        onClick={onOuvrir}
        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
          active ? 'bg-accent/5' : 'hover:bg-surface-2'
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-text-primary">{nomAffiche(c)}</span>
          <span className="block truncate text-xs text-text-muted">{sousTitre(c)}</span>
          <span className={`mt-1 block truncate text-sm ${compte > 0 ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
            {apercu(dernier)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`text-xs tabular-nums ${compte > 0 ? 'font-semibold text-text-primary' : 'text-text-muted'}`}>
            {heureListe(dernier.created_at)}
          </span>
          <PastilleCompteur count={compte} />
        </span>
      </button>
    </li>
  )
}

function Fil({
  conversation: c,
  onRetour,
  onAgrandir,
  brouillon,
  onBrouillon,
  onEnvoye,
}: {
  conversation: ConversationWhatsApp
  onRetour: () => void
  onAgrandir: (url: string) => void
  brouillon: string
  onBrouillon: (texte: string) => void
  onEnvoye: (message: MessageWhatsApp) => void
}) {
  const filRef = useRef<HTMLDivElement>(null)

  // Ouverture et nouveau message : on se place sur le message le plus récent
  useLayoutEffect(() => {
    const el = filRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [c.messages.length])

  return (
    <div className="flex min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-4 py-3">
        <button
          type="button"
          onClick={onRetour}
          aria-label="Retour aux conversations"
          className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-surface-2 md:hidden"
        >
          ←
        </button>
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-text-primary">{nomAffiche(c)}</h2>
          <p className="truncate text-xs text-text-muted">
            {c.suiveur ? `${sousTitre(c)} · ${telephoneLisible(c.telephone)}` : 'Numéro inconnu'}
          </p>
        </div>
      </header>

      <div ref={filRef} className="min-h-0 flex-1 overflow-y-auto bg-bg px-4 py-4">
        {c.messages.map((m, i) => {
          const jour = jourParis(m.created_at)
          const nouveauJour = i === 0 || jourParis(c.messages[i - 1].created_at) !== jour
          return (
            <Fragment key={m.id}>
              {nouveauJour && (
                <div className="my-4 flex justify-center first:mt-0">
                  <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-text-muted">
                    {separateurJour(jour)}
                  </span>
                </div>
              )}
              <Bulle message={m} onAgrandir={onAgrandir} />
            </Fragment>
          )
        })}
      </div>

      <ZoneReponse
        telephone={c.telephone}
        messages={c.messages}
        brouillon={brouillon}
        onBrouillon={onBrouillon}
        onEnvoye={onEnvoye}
      />
    </div>
  )
}

function Bulle({ message: m, onAgrandir }: { message: MessageWhatsApp; onAgrandir: (url: string) => void }) {
  const sortant = m.sens === 'sortant'
  return (
    <div className={`mt-2 flex flex-col ${sortant ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[80%] space-y-2 rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
          sortant ? 'bg-accent text-white' : 'border border-border bg-surface text-text-primary'
        }`}
      >
        {m.rapport_url && <Vignette url={m.rapport_url} alt="Rapport hebdomadaire" onAgrandir={onAgrandir} />}
        {m.media_url ? (
          <Media url={m.media_url} type={m.media_type} onAgrandir={onAgrandir} />
        ) : (
          m.media_type && <p className="italic opacity-80">Pièce jointe indisponible</p>
        )}
        {m.contenu && <p className="whitespace-pre-wrap break-words">{m.contenu}</p>}
      </div>
      <span className="mt-0.5 px-1 text-[11px] tabular-nums text-text-muted">{formatHeure(m.created_at)}</span>
    </div>
  )
}

function Media({ url, type, onAgrandir }: { url: string; type: string | null; onAgrandir: (url: string) => void }) {
  if (type?.startsWith('image/')) return <Vignette url={url} alt="Photo" onAgrandir={onAgrandir} />
  if (type?.startsWith('audio/')) return <audio controls src={url} className="max-w-full" />
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
      Pièce jointe
    </a>
  )
}

function Vignette({ url, alt, onAgrandir }: { url: string; alt: string; onAgrandir: (url: string) => void }) {
  return (
    <button type="button" onClick={() => onAgrandir(url)} aria-label="Agrandir l'image" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="max-h-60 rounded-lg object-cover" />
    </button>
  )
}

// Flèche circulaire (pas de bibliothèque d'icônes dans le projet)
function IconeRafraichir({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

// Réponse libre au parent : possible seulement dans les 24 h qui suivent son dernier message
// (revérifié côté serveur). Entrée = retour à la ligne, Ctrl/Cmd+Entrée = envoyer.
// Une instance par conversation (Fil a pour key le numéro) : telephone ne change jamais ici.
function ZoneReponse({
  telephone,
  messages,
  brouillon,
  onBrouillon,
  onEnvoye,
}: {
  telephone: string
  messages: MessageWhatsApp[]
  brouillon: string
  onBrouillon: (texte: string) => void
  onEnvoye: (message: MessageWhatsApp) => void
}) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fenetre = fenetreReponse(messages)
  const peutEnvoyer = fenetre.ouverte && !enCours && brouillon.trim() !== ''

  // Auto-agrandissement jusqu'à ~5 lignes, puis défilement dans le champ
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, HAUTEUR_MAX_TEXTAREA)}px`
  }, [brouillon])

  async function envoyer() {
    if (!peutEnvoyer) return
    setEnCours(true)
    setErreur(null)
    try {
      const r = await envoyerReponseAction(telephone, brouillon)
      // message non null : parti chez Twilio, même si erreur signale un échec d'enregistrement
      if (r.message) onEnvoye(r.message)
      setErreur(r.erreur)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e))
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="shrink-0 space-y-2 border-t border-border bg-surface px-4 py-3">
      <p className={`text-xs ${fenetre.ouverte ? 'text-text-secondary' : 'text-text-muted'}`}>{fenetre.texte}</p>
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={brouillon}
          onChange={(e) => onBrouillon(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              envoyer()
            }
          }}
          disabled={!fenetre.ouverte}
          readOnly={enCours}
          maxLength={1600}
          placeholder={fenetre.ouverte ? 'Votre message (Ctrl+Entrée pour envoyer)' : ''}
          className="min-h-10 flex-1 resize-none overflow-y-auto rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none disabled:bg-surface-2"
        />
        <button
          type="button"
          onClick={envoyer}
          disabled={!peutEnvoyer}
          className="h-10 shrink-0 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:brightness-90 disabled:opacity-50"
        >
          {enCours ? 'Envoi…' : 'Envoyer'}
        </button>
      </div>
      {erreur && <p className="text-xs text-danger">{erreur}</p>}
    </div>
  )
}
