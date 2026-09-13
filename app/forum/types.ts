export type ForumScript = {
  id: string
  titre: string
  description: string
  contenu: string
  pdf_url: string | null
  cover_url: string | null
  ordre: number
}

// Fiche "Ressources" — table forum_resources, affichée dans le topic
// "Ressources" (forum_topics.display_mode === 'resources') à la place des
// tickets. Même forme que ForumScript côté carte/PDF, pdf_url obligatoire
// en base (contrairement aux scripts).
export type ForumResource = {
  id: string
  titre: string
  description: string | null
  cover_url: string | null
  pdf_url: string
  ordre: number
}

// Forme minimale partagée par ScriptsRow (cartes) — ForumScript et
// ForumResource la satisfont toutes les deux structurellement, sans cast.
export type ForumCardItem = {
  id: string
  titre: string
  description: string | null
  cover_url: string | null
  pdf_url: string | null
}

// Forme minimale attendue par ScriptPdfModal — un ForumCardItem la satisfait.
export type PdfPreviewItem = Pick<ForumCardItem, 'titre' | 'pdf_url'>

// Topic "de sens" — table forum_topics (Philosophie, Ressources, …).
// display_mode pilote l'affichage du panneau principal pour ce topic :
// 'tickets' (par défaut) ou 'resources' (liste de forum_resources).
export type ForumTopic = {
  id: string
  nom: string
  ordre: number
  display_mode: 'tickets' | 'resources'
}

// Topic "de travail" — une feuille_entrainement affichée comme topic de forum.
export type FeuilleTopic = {
  id: string
  titre: string
}

// Le topic actif dans l'UI, quelle que soit sa table d'origine — le `kind`
// dit quelle colonne (topic_id / feuille_id) utiliser pour lire/écrire les
// tickets, cf. la contrainte CHECK d'exclusivité sur forum_tickets.
// displayMode n'existe que pour 'sens' (seule table qui porte la colonne).
export type ActiveTopic =
  | { kind: 'sens'; id: string; nom: string; displayMode: 'tickets' | 'resources' }
  | { kind: 'feuille'; id: string; nom: string }

export type ForumTicket = {
  id: string
  topic_id: string | null
  feuille_id: string | null
  user_id: string
  titre: string
  statut: string | null
  created_at: string
}

export type ForumMessage = {
  id: string
  ticket_id: string
  user_id: string
  contenu: string
  image_url: string | null
  created_at: string
}
