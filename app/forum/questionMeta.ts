import type { Feuille, ForumScript, ForumTicket, TicketStatut } from './types'

// Partagé par TicketsPanel (liste) et TicketDetail (en-tête).
export const STATUT_STYLE: Record<TicketStatut, string> = {
  ouvert: 'bg-accent/10 text-accent',
  ferme: 'bg-success/15 text-success',
}

// Référence d'une question — Problème : "Titre de la feuille · n° X" (ou le
// titre seul pour les anciens tickets sans numéro) ; Méthode : "#ordre titre"
// du script. null s'il n'y a rien à afficher.
export function questionReference(
  ticket: Pick<ForumTicket, 'sujet' | 'feuille_id' | 'numero_exercice' | 'script_id'>,
  feuilleById: Map<string, Feuille>,
  scriptById: Map<string, ForumScript>
): string | null {
  if (ticket.sujet === 'probleme' && ticket.feuille_id) {
    const titre = feuilleById.get(ticket.feuille_id)?.titre
    if (!titre) return null
    return ticket.numero_exercice != null ? `${titre} · n° ${ticket.numero_exercice}` : titre
  }
  if (ticket.sujet === 'methode' && ticket.script_id) {
    const script = scriptById.get(ticket.script_id)
    return script ? `#${script.ordre} ${script.titre}` : null
  }
  return null
}
