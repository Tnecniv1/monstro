export type ForumScript = {
  id: string
  titre: string
  description: string
  contenu: string
  pdf_url: string | null
  ordre: number
}

// Topic "de sens" — table forum_topics (Philosophie, Ressources, …).
export type ForumTopic = {
  id: string
  nom: string
  ordre: number
}

// Topic "de travail" — une feuille_entrainement affichée comme topic de forum.
export type FeuilleTopic = {
  id: string
  titre: string
}

// Le topic actif dans l'UI, quelle que soit sa table d'origine — le `kind`
// dit quelle colonne (topic_id / feuille_id) utiliser pour lire/écrire les
// tickets, cf. la contrainte CHECK d'exclusivité sur forum_tickets.
export type ActiveTopic = { kind: 'sens'; id: string; nom: string } | { kind: 'feuille'; id: string; nom: string }

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
