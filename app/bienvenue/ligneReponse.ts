import { estJuste } from '@/lib/parcours/positionnement'

// Ligne positionnement_reponse d'une réponse au test. Fonction pure (testée
// à part) : qcm_positionnement_id reçoit question_id, l'id de la ligne
// qcm_positionnement, jamais l'id composé « <etape_id>:<question_id> » du
// test. positionnement_id et qcm_question_id (ancien modèle) restent null.
export type LigneReponse = {
  passage_id: string
  user_id: string
  parcours_id: string
  etape_id: string
  qcm_positionnement_id: string
  positionnement_id: null
  qcm_question_id: null
  choix: string[] | null
  juste: boolean
}

export function ligneReponse(p: {
  passageId: string
  userId: string
  parcoursId: string
  question: { etape_id: string; question_id: string; reponses_correctes: string[] | null; id: string; ordre: number }
  choix: string[] | null
}): LigneReponse {
  return {
    passage_id: p.passageId,
    user_id: p.userId,
    parcours_id: p.parcoursId,
    etape_id: p.question.etape_id,
    qcm_positionnement_id: p.question.question_id,
    positionnement_id: null,
    qcm_question_id: null,
    choix: p.choix,
    juste: estJuste(p.question, p.choix),
  }
}
