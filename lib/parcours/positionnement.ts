// Test de positionnement d'un parcours : fonctions pures, sans Supabase ni
// React (fichier identique côté web et côté mobile).
//
// Règles :
// - Le test porte sur les étapes feuille, dans l'ordre du parcours (examens
//   exclus) ; les questions d'une feuille sont posées dans leur ordre.
// - Une question est juste si l'ensemble des choix sélectionnés est exactement
//   reponses_correctes. « Je ne sais pas » (null) = faux.
// - Une feuille est acquise si toutes ses questions sont justes.
// - Le test s'arrête à la première feuille non acquise (dès la première
//   réponse fausse) : c'est l'étape de départ. Une feuille sans question
//   arrête le test et devient l'étape de départ.
// - Toutes les feuilles acquises : départ = première étape (tout type) après
//   la dernière feuille, ou dernière étape du parcours s'il n'y en a pas.
//
// Exemples, parcours F1 (q1, q2) → F2 (q3) → F3 (q4) → Examen E :
// 1. Tout faux : q1 = null (« Je ne sais pas »).
//    prochaineQuestion → null (arrêt dès q1) ; etapeDepart → F1.
// 2. Arrêt en feuille 2 : q1 = ['a'] juste, q2 = ['b','c'] juste, q3 = ['a']
//    alors que la bonne réponse est ['a','d'].
//    prochaineQuestion → null ; etapeDepart → F2 (F1 acquise).
// 3. Tout juste : q1, q2, q3, q4 justes.
//    prochaineQuestion → null ; etapeDepart → E (première étape après F3).
//    Sans l'examen E, le départ serait F3 (dernière étape du parcours).
// En cours de test (ex. seule q1 répondue juste) : prochaineQuestion → q2,
// etapeDepart → null (pas encore déterminé).

export type EtapeTest = {
  id: string
  ordre: number
  type: 'feuille' | 'examen'
}

// Ligne de parcours_positionnement avec les bonnes réponses de sa question
// (le type réel peut porter en plus l'énoncé, les choix, l'image…).
export type QuestionTest = {
  // id de la ligne parcours_positionnement (une même question peut être
  // associée à deux feuilles).
  id: string
  etape_id: string
  ordre: number
  reponses_correctes: string[] | null
}

export type FeuilleTest<Q extends QuestionTest> = {
  etapeId: string
  questions: Q[]
}

export type Test<Q extends QuestionTest> = {
  feuilles: FeuilleTest<Q>[]
  // Départ si toutes les feuilles sont acquises ; null si le parcours n'a
  // aucune étape.
  etapeApresFeuilles: string | null
}

// Réponses par id de question (QuestionTest.id) : choix sélectionnés, ou
// null pour « Je ne sais pas ». Absente : pas encore répondue.
export type Reponses = Record<string, string[] | null>

export function construireTest<Q extends QuestionTest>(etapes: EtapeTest[], questions: Q[]): Test<Q> {
  const triees = etapes.slice().sort((a, b) => a.ordre - b.ordre)
  const feuilles = triees
    .filter((e) => e.type === 'feuille')
    .map((e) => ({
      etapeId: e.id,
      questions: questions.filter((q) => q.etape_id === e.id).sort((a, b) => a.ordre - b.ordre),
    }))

  let etapeApresFeuilles: string | null
  const derniere = feuilles.length > 0 ? triees.find((e) => e.id === feuilles[feuilles.length - 1].etapeId) : undefined
  if (!derniere) {
    // Aucune feuille : rien à tester, départ au début du parcours.
    etapeApresFeuilles = triees[0]?.id ?? null
  } else {
    const suivante = triees.find((e) => e.ordre > derniere.ordre)
    etapeApresFeuilles = (suivante ?? triees[triees.length - 1]).id
  }

  return { feuilles, etapeApresFeuilles }
}

export function estJuste(question: QuestionTest, choix: string[] | null): boolean {
  if (!choix) return false
  const attendues = new Set(question.reponses_correctes ?? [])
  const choisies = new Set(choix)
  if (attendues.size === 0 || attendues.size !== choisies.size) return false
  return Array.from(choisies).every((c) => attendues.has(c))
}

function repondue(reponses: Reponses, id: string): boolean {
  return Object.prototype.hasOwnProperty.call(reponses, id)
}

// Parcourt le test dans l'ordre : première question sans réponse, ou étape
// où le test s'arrête (feuille sans question ou réponse fausse), ou fin.
function parcourir<Q extends QuestionTest>(
  test: Test<Q>,
  reponses: Reponses
): { question: Q } | { arret: string } | { fin: true } {
  for (const feuille of test.feuilles) {
    if (feuille.questions.length === 0) return { arret: feuille.etapeId }
    for (const q of feuille.questions) {
      if (!repondue(reponses, q.id)) return { question: q }
      if (!estJuste(q, reponses[q.id])) return { arret: feuille.etapeId }
    }
  }
  return { fin: true }
}

// Question suivante à poser, ou null si le test est terminé.
export function prochaineQuestion<Q extends QuestionTest>(test: Test<Q>, reponses: Reponses): Q | null {
  const r = parcourir(test, reponses)
  return 'question' in r ? r.question : null
}

// Étape de départ (etape_id) une fois le test terminé ; null tant qu'il
// reste une question à poser, ou si le parcours n'a aucune étape.
export function etapeDepart<Q extends QuestionTest>(test: Test<Q>, reponses: Reponses): string | null {
  const r = parcourir(test, reponses)
  if ('question' in r) return null
  if ('arret' in r) return r.arret
  return test.etapeApresFeuilles
}
