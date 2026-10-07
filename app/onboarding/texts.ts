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
        `Règle 2${NBSP}: Prouver chaque session de travail.`,
        `Règle 3${NBSP}: Poser une question par blocage.`,
      ],
    },
    {
      intitule: `La philosophie du voyage${NBSP}?`,
      texte: `Le chemin sera long et difficile, et vous apprendrez à fabriquer des ponts qui résistent au temps. Mais ne doutez pas que durant ce voyage vous rencontrerez beaucoup de joie${NBSP}; et un fort sentiment de confiance en votre capacité à résoudre des problèmes.`,
    },
  ],
  case: 'Lu et approuvé',
  bouton: 'Continuer',
}

// Étape Focus, entre la charte et l'invitation au Script 1 (modal bloquant,
// puis bandeau de la Bibliothèque). [TEXTE PROVISOIRE] : tous les textes de
// ce bloc sont à relire.
export const FOCUS = {
  titre: 'Choisissez vos deux premières feuilles', // [TEXTE PROVISOIRE]
  consigne: `Avant de commencer, mettez en Focus deux feuilles de la Bibliothèque${NBSP}: une feuille «${NBSP}Problèmes Chaotiques${NBSP}» et une feuille «${NBSP}Exercices Mécaniques${NBSP}».`, // [TEXTE PROVISOIRE]
  geste:
    "Pour mettre une feuille en Focus, cliquez sur le petit cercle blanc en haut à droite de sa carte : il devient violet.", // [TEXTE PROVISOIRE]
  checklist: {
    chaotique: `Une feuille «${NBSP}Problèmes Chaotiques${NBSP}» en Focus`, // [TEXTE PROVISOIRE]
    mecanique: `Une feuille «${NBSP}Exercices Mécaniques${NBSP}» en Focus`, // [TEXTE PROVISOIRE]
  },
  bouton: 'Aller à la Bibliothèque',
  recommandations: {
    titre: 'Feuilles recommandées', // [TEXTE PROVISOIRE]
    intro: `Repérez la ligne de votre âge, puis la colonne de votre moyenne en mathématiques.`, // [TEXTE PROVISOIRE]
    sections: { chaotique: 'Problèmes Chaotiques', mecanique: 'Exercices Mécaniques' },
    colonneAge: 'Âge',
    niveaux: {
      fragile: { nom: 'Fragile', detail: `moyenne < 10` },
      moyen: { nom: 'Moyen', detail: '10 à 14' },
      fort: { nom: 'Fort', detail: `≥ 15` },
    },
    caseVide: 'Pas encore de feuille recommandée',
    exerciceDepart: "à partir de l'exo",
    votreAge: 'votre âge', // [TEXTE PROVISOIRE]
    chargement: 'Chargement…',
    erreur: 'Impossible de charger les recommandations.', // [TEXTE PROVISOIRE]
    fermer: 'Fermer',
  },
  bandeau: {
    consigne: `Mettez en Focus une feuille «${NBSP}Problèmes Chaotiques${NBSP}» et une feuille «${NBSP}Exercices Mécaniques${NBSP}» (le petit cercle en haut à droite de la carte).`, // [TEXTE PROVISOIRE]
    lien: 'Voir les recommandations',
    reussite: `C'est fait${NBSP}: l'étape est validée.`, // [TEXTE PROVISOIRE]
    continuer: 'Continuer',
  },
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
