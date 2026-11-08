// Test de positionnement d'un parcours : fonctions pures, sans Supabase ni
// React (fichier identique côté web et côté mobile).
//
// Règles :
// - Le test porte sur les étapes feuille, dans l'ordre du parcours (examens
//   exclus) ; les questions d'une feuille sont posées dans leur ordre.
// - Une question est juste si l'ensemble des choix sélectionnés est exactement
//   reponses_correctes. « Je ne sais pas » (null) = faux.
// - Une feuille de n questions est acquise si au moins seuil = ceil(2n/3)
//   sont justes (4/6, 6/9, 2/3, 2/2, 1/1).
// - Arrêt anticipé dans une feuille : dès que le seuil est atteint, elle est
//   acquise et on passe à la feuille suivante sans poser ses questions
//   restantes ; dès que le seuil ne peut plus être atteint, elle est non
//   acquise et le test s'arrête : c'est l'étape de départ.
// - Une feuille sans question arrête toujours le test (étape de départ).
// - Toutes les feuilles acquises : départ = première étape (tout type) après
//   la dernière feuille, ou dernière étape du parcours s'il n'y en a pas.
//
// Exemples, parcours F1 (a1…a6) → F2 (b1…b6) → Examen E ; seuil 4 sur 6.
// J = juste, F = faux ou « Je ne sais pas ».
// 1. 4/6, acquise : a1 F, a2 J, a3 F, a4 J, a5 J, a6 J.
//    Après a3 (2 fausses), 4 justes restent possibles : on continue. Après a6,
//    4 justes : F1 acquise → prochaineQuestion → b1.
// 2. 3/6, non acquise : a1 J, a2 F, a3 J, a4 F, a5 J, a6 F.
//    Après a6, 3 fausses : 4 justes impossibles → prochaineQuestion → null,
//    etapeDepart → F1.
// 3. Arrêt anticipé après 4 justes : a1 J, a2 J, a3 J, a4 J.
//    Seuil atteint : a5 et a6 ne sont pas posées → prochaineQuestion → b1.
//    Si F2 se termine de même (b1…b4 J), départ → E (étape après F2) ;
//    sans l'examen E, le départ serait F2 (dernière étape du parcours).
// 4. Arrêt après 3 fausses : a1 F, a2 F, a3 F.
//    Au plus 3 justes possibles : a4…a6 ne sont pas posées → prochaineQuestion
//    → null, etapeDepart → F1.
// En cours de test (ex. seule a1 répondue) : prochaineQuestion → a2,
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

// Nombre de justes nécessaires pour acquérir une feuille de n questions.
export function seuilFeuille(n: number): number {
  return Math.ceil((2 * n) / 3)
}

// Parcourt le test dans l'ordre : première question à poser, ou étape où le
// test s'arrête (feuille sans question ou seuil devenu impossible), ou fin.
// Une feuille est quittée dès que son sort est joué (seuil atteint ou
// impossible) : ses questions restantes ne sont pas posées.
function parcourir<Q extends QuestionTest>(
  test: Test<Q>,
  reponses: Reponses
): { question: Q } | { arret: string } | { fin: true } {
  for (const feuille of test.feuilles) {
    const n = feuille.questions.length
    if (n === 0) return { arret: feuille.etapeId }
    const seuil = seuilFeuille(n)
    let justes = 0
    let fausses = 0
    let acquise = false
    for (const q of feuille.questions) {
      if (!repondue(reponses, q.id)) return { question: q }
      if (estJuste(q, reponses[q.id])) justes++
      else fausses++
      if (justes >= seuil) {
        acquise = true
        break
      }
      if (n - fausses < seuil) return { arret: feuille.etapeId }
    }
    if (!acquise) return { arret: feuille.etapeId }
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
