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

// Feuille d'entraînement — sert au formulaire de question (Problème) et à
// afficher la référence d'une question dans la liste.
export type Feuille = {
  id: string
  titre: string
}

// Le panneau actif dans l'UI : un topic de sens (tickets topic_id renseigné)
// ou la liste unique des questions (topic_id null, sujet renseigné).
// displayMode n'existe que pour 'sens' (seule table qui porte la colonne).
export type ActiveTopic =
  | { kind: 'sens'; id: string; nom: string; displayMode: 'tickets' | 'resources' }
  | { kind: 'questions' }

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
