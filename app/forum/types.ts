export type ForumScriptEtape = {
  titre: string
  description: string
}

// pdf_url/contenu existent toujours en base mais ne sont plus lus/affichés
// pour les scripts — remplacés par citation + etapes (ScriptTextModal).
export type ForumScript = {
  id: string
  titre: string
  description: string
  citation: string | null
  etapes: ForumScriptEtape[]
  cover_url: string | null
  ordre: number
}

// Fiche "Ressources" — table forum_resources, affichée dans le topic
// "Ressources" (forum_topics.display_mode === 'resources') à la place des
// tickets. Inchangée : reste un PDF (ScriptPdfModal), pas de citation/etapes.
export type ForumResource = {
  id: string
  titre: string
  description: string | null
  cover_url: string | null
  pdf_url: string
  ordre: number
}

// Forme minimale attendue par ScriptPdfModal — un ForumResource la satisfait.
export type PdfPreviewItem = {
  titre: string
  pdf_url: string | null
}

// Topic "de sens" — table forum_topics (Philosophie, Ressources, …).
// display_mode pilote l'affichage du panneau principal pour ce topic :
// 'tickets' (par défaut) ou 'resources' (liste de forum_resources).
export type ForumTopic = {
  id: string
  nom: string
  ordre: number
  display_mode: 'tickets' | 'resources'
}

// Topics de sens masqués dans le Forum : plus d'onglet, et un lien vers l'un
// de leurs tickets ramène à Questions. Rien n'est supprimé en base (topic et
// tickets conservés) : retirer l'id de cette liste réactive l'onglet.
// Même liste que monstro-expo/components/forum/types.ts.
export const TOPICS_MASQUES: readonly string[] = [
  '491256c0-c23b-4181-a039-d1a904f5dac6', // Philosophie
]

// Feuille d'entraînement — sert au formulaire de question, à la référence
// d'une question et à la grille des problèmes (numéros 1 à volume).
export type Feuille = {
  id: string
  titre: string
  volume: number | null
}

// Filtre de la grille des problèmes, gardé dans l'URL de /forum (?filtre=) :
// 'mes' (problèmes où l'utilisateur a posé une question), 'toutes' (problèmes
// qui ont au moins une question) ou l'id d'une feuille en Focus.
export type FiltreProblemes = string

export const FILTRE_PROBLEMES_DEFAUT: FiltreProblemes = 'mes'

// /forum avec ce filtre (le filtre par défaut est omis).
export function forumProblemesHref(filtre: FiltreProblemes): string {
  return filtre === FILTRE_PROBLEMES_DEFAUT ? '/forum' : `/forum?filtre=${encodeURIComponent(filtre)}`
}

// Page d'un problème (feuille + numéro) : énoncé, question, fil. `depuis` :
// filtre de la grille d'où l'on vient, pour le lien retour.
export function problemeHref(feuilleId: string, numero: number, depuis?: FiltreProblemes): string {
  const base = `/forum/probleme/${feuilleId}/${numero}`
  return depuis && depuis !== FILTRE_PROBLEMES_DEFAUT ? `${base}?depuis=${encodeURIComponent(depuis)}` : base
}

// FAQ (/forum/faq) : toutes les questions du forum hors grille des problèmes,
// c'est-à-dire Méthode, Application et questions Problème sans numéro.
export function estQuestionFaq(t: Pick<ForumTicket, 'sujet' | 'feuille_id' | 'numero_exercice'>): boolean {
  return !(t.sujet === 'probleme' && t.feuille_id && t.numero_exercice != null)
}

// Page FAQ ; `depuis` : filtre de la grille d'où l'on vient, pour le lien retour.
export function faqHref(depuis?: FiltreProblemes): string {
  return depuis && depuis !== FILTRE_PROBLEMES_DEFAUT ? `/forum/faq?depuis=${encodeURIComponent(depuis)}` : '/forum/faq'
}

// Filtre de grille passé en ?depuis= (page problème, FAQ) : mes, toutes ou un
// id de feuille ; « Mes questions » à défaut. /forum revalide le filtre.
export function filtreDepuis(param: string | string[] | undefined): FiltreProblemes {
  const valeur = Array.isArray(param) ? param[0] : param
  return valeur === 'toutes' || (valeur && /^[0-9a-f-]{36}$/i.test(valeur)) ? valeur : FILTRE_PROBLEMES_DEFAUT
}

// Titre donné automatiquement à une question posée depuis la page d'un problème.
export function titreQuestionProbleme(feuilleTitre: string, numero: number): string {
  return `${feuilleTitre} · n° ${numero}`
}

// Le panneau actif dans l'UI : un topic de sens (tickets topic_id renseigné)
// ou la liste unique des questions (topic_id null, sujet renseigné).
// displayMode n'existe que pour 'sens' (seule table qui porte la colonne).
export type ActiveTopic =
  | { kind: 'sens'; id: string; nom: string; displayMode: 'tickets' | 'resources' }
  | { kind: 'questions' }

// Onglet de la page forum : Scripts (cartes des scripts), un panneau
// ActiveTopic (topic de sens ou Questions), ou Équipe (sessions en direct).
export type ForumOnglet = { kind: 'scripts' } | ActiveTopic | { kind: 'equipe' }

// Session en direct (visio) — ligne renvoyée par la RPC get_live_sessions().
// lien : null tant que l'on n'est ni inscrit ni admin.
// inscrits : liste des élèves pour un admin, null sinon.
// inscrits_initiales / inscrits_avatars : les 5 premiers inscrits (initiale du
// prénom, photo de profil ou null), dans le même ordre, visibles par tous.
export type LiveSession = {
  id: string
  debut: string
  duree_minutes: number
  places: number
  animateur_nom: string
  animateur_avatar_url: string | null
  nb_inscrits: number
  inscrit: boolean
  lien: string | null
  inscrits: { prenom: string | null; nom: string | null; pseudo: string | null }[] | null
  inscrits_initiales: string[]
  inscrits_avatars: (string | null)[]
}

// Sujet d'une question — null pour un ticket de topic de sens.
// probleme : feuille_id obligatoire (+ numero_exercice à la création).
// methode : script_id optionnel. application : ni feuille ni script.
export type QuestionSujet = 'probleme' | 'methode' | 'application'

export const SUJET_LABEL: Record<QuestionSujet, string> = {
  probleme: 'Problème',
  methode: 'Méthode',
  application: 'Application',
}

export type TicketStatut = 'ouvert' | 'ferme'

export const STATUT_LABEL: Record<TicketStatut, string> = {
  ouvert: 'Ouvert',
  ferme: 'Résolue',
}

export type ForumTicket = {
  id: string
  topic_id: string | null
  feuille_id: string | null
  script_id: string | null
  sujet: QuestionSujet | null
  numero_exercice: number | null
  epingle: boolean
  user_id: string
  titre: string
  statut: TicketStatut | null
  created_at: string
}

// Colonnes lues partout où l'on charge un ForumTicket.
export const TICKET_COLUMNS =
  'id, topic_id, feuille_id, script_id, sujet, numero_exercice, epingle, user_id, titre, statut, created_at'

export type ForumMessage = {
  id: string
  ticket_id: string
  user_id: string
  contenu: string
  image_url: string | null
  created_at: string
}

// Ticket demandé par ?ticket=<id> : topic_id choisit l'onglet à ouvrir
// (null = Questions).
export type InitialTicket = Pick<ForumTicket, 'id' | 'topic_id'>
