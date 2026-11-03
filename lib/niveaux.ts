// Classe et niveau de l'élève (colonnes user_profile.niveau_scolaire et
// user_profile.niveau). Les valeurs doivent rester alignées sur les
// contraintes CHECK en base. Affichés uniquement à l'inscription et sur le
// profil.

export const NIVEAUX_SCOLAIRES = [
  { valeur: 'cp', libelle: 'CP' },
  { valeur: 'ce1', libelle: 'CE1' },
  { valeur: 'ce2', libelle: 'CE2' },
  { valeur: 'cm1', libelle: 'CM1' },
  { valeur: 'cm2', libelle: 'CM2' },
  { valeur: '6e', libelle: '6e' },
  { valeur: '5e', libelle: '5e' },
  { valeur: '4e', libelle: '4e' },
  { valeur: '3e', libelle: '3e' },
  { valeur: '2nde', libelle: '2nde' },
  { valeur: '1re', libelle: '1re' },
  { valeur: 'terminale', libelle: 'Terminale' },
  { valeur: 'licence', libelle: 'Licence' },
  { valeur: 'cpge', libelle: 'CPGE' },
  { valeur: 'master', libelle: 'Master' },
  { valeur: 'autodidacte', libelle: 'Autodidacte' },
] as const

export const NIVEAUX = [
  { valeur: 'faible', libelle: 'Faible' },
  { valeur: 'moyen', libelle: 'Moyen' },
  { valeur: 'fort', libelle: 'Fort' },
] as const

export type NiveauScolaire = (typeof NIVEAUX_SCOLAIRES)[number]['valeur']
export type Niveau = (typeof NIVEAUX)[number]['valeur']
