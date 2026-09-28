// Tous les textes de l'onboarding élève.

// Espace insécable, à placer avant ? : ; et dans les nombres (évite qu'un
// signe ou un morceau de nombre passe seul à la ligne).
const NBSP = String.fromCharCode(0xa0)

// Modal 1 — chaque section : un intitulé en gras, puis un texte ou une liste.
export type CharteSection = { intitule: string; texte?: string; liste?: string[] }

export const CHARTE: { titre: string; sections: CharteSection[]; case: string; bouton: string } = {
  titre: `Comment gagner la partie${NBSP}?`,
  sections: [
    {
      intitule: `Le but du jeu${NBSP}?`,
      texte: `Résoudre 1${NBSP}000 problèmes.`,
    },
    {
      intitule: `Les règles du jeu${NBSP}?`,
      liste: [
        `Règle 1${NBSP}: Respecter le parcours d'apprentissage.`,
        `Règle 2${NBSP}: Poser une question par blocage.`,
        `Règle 3${NBSP}: Prouver chaque session de travail.`,
      ],
    },
    {
      intitule: `La philosophie du voyage${NBSP}?`,
      texte: `Le chemin sera long et difficile, mais vous apprendrez à fabriquer des ponts qui résistent au temps. Mais durant ce voyage, vous rencontrerez beaucoup de joie${NBSP}; et un fort sentiment de confiance en votre capacité à résoudre des problèmes.`,
    },
  ],
  case: 'Lu et approuvé',
  bouton: 'Continuer',
}

export const INVITATION_SCRIPT1 = {
  titre: `Comment résoudre votre premier problème${NBSP}?`,
  texte: 'Cliquez sur la page Forum, puis ouvrez le script #1.',
  bouton: 'Continuer',
}

export const AVANT_SCRIPT1 = {
  texte:
    "Si vous ne comprenez pas une des étapes du script, posez simplement votre question sur le forum, dans la rubrique adaptée 'Méthode'.",
  bouton: 'Ok',
}

export const ERREUR_ENREGISTREMENT =
  "Impossible d'enregistrer votre réponse. Réessayez, et prévenez-nous si le problème continue."
