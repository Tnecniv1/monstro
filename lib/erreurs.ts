// Grille des erreurs d'un entraînement : trois sections de quatre compteurs
// (table erreur, une colonne par clé). Logique pure, sans dépendance au DOM —
// réutilisable telle quelle côté mobile.

export type CleErreur =
  | 'c1' | 'c2' | 'c3' | 'c4'
  | 's1' | 's2' | 's3' | 's4'
  | 'r1' | 'r2' | 'r3' | 'r4'

// Ligne de la table erreur (hors entrainement_id).
export type CompteursErreurs = Record<CleErreur, number>

export type SectionErreurs = {
  titre: string
  items: { cle: CleErreur; code: string; description: string }[]
}

export const SECTIONS_ERREURS: SectionErreurs[] = [
  {
    titre: 'Compréhension',
    items: [
      { cle: 'c1', code: 'C1', description: "Reformuler le problème, observer clairement ce que l'on cherche à faire" },
      { cle: 'c2', code: 'C2', description: "Définir ce que l'on sait, et ce que l'on ne sait pas" },
      { cle: 'c3', code: 'C3', description: 'Trouver une idée, démarrer quelques part, et explorer des itérations' },
      { cle: 'c4', code: 'C4', description: 'Développer une intuition du problème, et construire une image mentale' },
    ],
  },
  {
    titre: 'Savoir',
    items: [
      { cle: 's1', code: 'S1', description: 'Décrire le problème en langage mathématique, et le mettre en équation' },
      { cle: 's2', code: 'S2', description: 'Construire un raisonnement logique, nécessaire et suffisant' },
      { cle: 's3', code: 'S3', description: 'Trouver les algorithme de travail pertinent, et les exécuter correctement' },
      { cle: 's4', code: 'S4', description: "Calculer sans faire d'erreur Vérifier son brouillon, et le mettre à l'épreuve" },
    ],
  },
  {
    titre: 'Rédaction',
    items: [
      { cle: 'r1', code: 'R1', description: 'Respecter la structure, la langue et les conventions de publication' },
      { cle: 'r2', code: 'R2', description: "Décrire l'ensemble du raisonnement, et le prouver par les calculs" },
      { cle: 'r3', code: 'R3', description: 'Décrire clairement les gestes, faisant danser élégamment la narration et le calcul' },
      { cle: 'r4', code: 'R4', description: 'Faire des dessins pour expliquer les points compliqués' },
    ],
  },
]

export const CLES_ERREURS: CleErreur[] = SECTIONS_ERREURS.flatMap((s) => s.items.map((i) => i.cle))

export function compteursVides(): CompteursErreurs {
  return Object.fromEntries(CLES_ERREURS.map((k) => [k, 0])) as CompteursErreurs
}
