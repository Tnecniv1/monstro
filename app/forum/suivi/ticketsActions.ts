'use server'

import { requireAdmin } from '@/lib/admin/requireAdmin'
import { createClient } from '@/lib/supabase/server'

export type TypeTicket = 'question' | 'bloque_init' | 'inactif' | 'irregulier'

// Ligne de suivi_ticket encore ouverte (les tickets résolus et remplacés ne
// sont jamais chargés).
export type TicketSuivi = {
  id: string
  type: TypeTicket
  etat: 'a_faire' | 'action_faite'
  // Type bloque_init : première étape non faite (1 à 8).
  etape_bloquee: number | null
  // Type question : la question du forum (forum_tickets).
  question_id: string | null
  ouvert_le: string
  eleve: { prenom: string | null; nom: string | null; pseudo: string } | null
  question: { titre: string } | null
}

// Recalcule les tickets (RPC refresh_tickets(), idempotente) puis renvoie ceux
// qui sont ouverts. Appelée à l'ouverture de l'onglet Tickets.
export async function chargerTicketsAction(): Promise<{ tickets: TicketSuivi[]; erreur: string | null }> {
  await requireAdmin()
  const supabase = createClient()

  const { error: erreurCalcul } = await supabase.rpc('refresh_tickets')
  if (erreurCalcul) return { tickets: [], erreur: erreurCalcul.message }

  const { data, error } = await supabase
    .from('suivi_ticket')
    .select(
      'id, type, etat, etape_bloquee, question_id, ouvert_le, eleve:user_profile(prenom, nom, pseudo), question:forum_tickets(titre)'
    )
    .in('etat', ['a_faire', 'action_faite'])
  if (error) return { tickets: [], erreur: error.message }
  return { tickets: (data ?? []) as unknown as TicketSuivi[], erreur: null }
}

// Bouton « Fait » : à faire → action faite. Le ticket reste ouvert jusqu'à sa
// résolution automatique.
export async function marquerActionFaiteAction(id: string): Promise<{ erreur: string | null }> {
  await requireAdmin()
  const supabase = createClient()
  const { error } = await supabase
    .from('suivi_ticket')
    .update({ etat: 'action_faite', action_faite_le: new Date().toISOString() })
    .eq('id', id)
    .eq('etat', 'a_faire')
  return { erreur: error?.message ?? null }
}
