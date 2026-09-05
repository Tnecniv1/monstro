// Logique du système de "tentatives" des conversations socratiques : tous
// les TAILLE_SET messages étudiant d'un set, le tuteur évalue la dernière
// réponse comme tentative de résolution de l'objectif du sujet, et termine
// son message par un marqueur [[TENTATIVE:SUCCES]] ou [[TENTATIVE:ECHEC]].
//
// Fonctions pures, sans dépendance serveur (pas de SDK Anthropic, pas de
// Supabase) : importées à la fois par la route API (app/api/socratique/message)
// pour décider quand injecter l'instruction d'évaluation, et par le frontend
// (ConversationDetail.tsx) pour l'indicateur de progression et le nettoyage
// à l'affichage — donc safe à embarquer dans le bundle client.

export const MESSAGE_AMORCE = 'Commence la session sur ce sujet.'
export const MARQUEUR_PREFIXE = '[[TENTATIVE:'
export const MARQUEUR_SUCCES = '[[TENTATIVE:SUCCES]]'
export const MARQUEUR_ECHEC = '[[TENTATIVE:ECHEC]]'
export const TAILLE_SET = 5

export type MessageRoleContenu = { role: 'user' | 'assistant'; contenu: string }

/**
 * Nombre de messages étudiant (hors amorce silencieuse) envoyés depuis la
 * dernière frontière de set — le dernier message assistant qui contient un
 * marqueur de tentative, ou le tout début de la conversation s'il n'y en a
 * aucun.
 */
export function compterMessagesDuSet(historique: MessageRoleContenu[]): number {
  let indexFrontiere = -1
  for (let i = historique.length - 1; i >= 0; i--) {
    const m = historique[i]
    if (m.role === 'assistant' && m.contenu.includes(MARQUEUR_PREFIXE)) {
      indexFrontiere = i
      break
    }
  }

  return historique
    .slice(indexFrontiere + 1)
    .filter((m) => m.role === 'user' && m.contenu !== MESSAGE_AMORCE).length
}
